import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import type { SkillDefinition } from '@/game/skills/types';

function createRuntimeHarness(attacker: Record<string, unknown>, defender: Record<string, unknown>) {
  if (typeof attacker.pendingCritChanceBonus !== 'number') {
    attacker.pendingCritChanceBonus = 0;
  }
  if (typeof defender.pendingCritChanceBonus !== 'number') {
    defender.pendingCritChanceBonus = 0;
  }
  if (typeof attacker.equipmentDefensePositiveBonus !== 'number') {
    attacker.equipmentDefensePositiveBonus = 0;
  }
  if (typeof defender.equipmentDefensePositiveBonus !== 'number') {
    defender.equipmentDefensePositiveBonus = 0;
  }
  if (!Array.isArray(attacker.activeEffectIds)) {
    attacker.activeEffectIds = [];
  }
  if (!Array.isArray(defender.activeEffectIds)) {
    defender.activeEffectIds = [];
  }
  if (!attacker.activeEffectSourceById || typeof attacker.activeEffectSourceById !== 'object') {
    attacker.activeEffectSourceById = {};
  }
  if (!defender.activeEffectSourceById || typeof defender.activeEffectSourceById !== 'object') {
    defender.activeEffectSourceById = {};
  }
  const runtime: any = Object.create(GameRuntime.prototype);
  runtime.elementChart = [];
  runtime.skillEffectLookupById = {};
  runtime.flags = {};
  runtime.pendingGuardDefeat = null;
  runtime.pendingNpcInteractBattleDefeat = null;
  runtime.pendingBattleRewardDialogue = null;
  runtime.playerCritterProgress = {
    collection: [],
    squad: [],
    unlockedSquadSlots: 0,
  };
  runtime.getActiveBattleCritter = vi.fn((_battle: unknown, side: 'player' | 'opponent') =>
    side === 'player' ? attacker : defender,
  );
  runtime.formatBattleAttackWithSkillPrefix = vi.fn(
    (_battle: unknown, _team: string, attackerName: string, defenderName: string, skillName: string) =>
      `${attackerName} used ${skillName} on ${defenderName} and`,
  );
  runtime.recordOpposingKnockoutProgress = vi.fn();
  runtime.syncPlayerBattleHealthToProgress = vi.fn(() => false);
  runtime.markProgressDirty = vi.fn();
  runtime.getNpcsForMap = vi.fn(() => []);
  runtime.handleJacobBattleComplete = vi.fn();
  runtime.resolveWildEncounterDropRewards = vi.fn(() => []);
  runtime.normalizeNpcItemRewards = vi.fn(() => []);
  runtime.buildRewardDialogueLines = vi.fn(() => []);
  return runtime as GameRuntime & { [key: string]: any };
}

function createBattleState(attacker: Record<string, unknown>, defender: Record<string, unknown>) {
  return {
    id: 1,
    source: {
      type: 'npc',
      mapId: 'test-map',
      label: 'Rival',
    },
    playerTeam: [attacker],
    opponentTeam: [defender],
    playerActiveIndex: 0,
    opponentActiveIndex: 0,
    pendingOpponentSwitchIndex: null,
    pendingOpponentSwitchDelayMs: 0,
    pendingOpponentSwitchAnnouncementShown: false,
    pendingForcedSwap: false,
    narrationQueue: [],
    activeNarration: null,
    activeAnimation: null,
    pendingKnockoutResolution: null,
    pendingEndTurnResolution: false,
    nextAnimationToken: 1,
    logLine: '',
    result: 'ongoing',
    phase: 'player-turn',
  } as any;
}

describe('GameRuntime skill healing', () => {
  it('applies flat support heals to the attacker', () => {
    const attacker = {
      name: 'Buddo',
      element: 'bloom',
      currentHp: 18,
      maxHp: 50,
      fainted: false,
    };
    const defender = {
      name: 'Target',
      element: 'stone',
      currentHp: 40,
      maxHp: 40,
      fainted: false,
    };
    const runtime = createRuntimeHarness(attacker, defender);
    const skill: SkillDefinition = {
      skill_id: 'field-patch',
      skill_name: 'Field Patch',
      element: 'bloom',
      type: 'support',
      priority: 1,
      healMode: 'flat',
      healValue: 12,
    };

    const result = (runtime as any).executeBattleSkillWithSkill(
      { playerTeam: [], opponentTeam: [], playerActiveIndex: 0, opponentActiveIndex: 0 },
      'player',
      skill,
      0,
      false,
      false,
    );

    expect(attacker.currentHp).toBe(18);
    expect(result.defenderFainted).toBe(false);
    expect(result.narrationEvents[0]?.message).toContain('used Field Patch');
    expect(result.narrationEvents[0]?.followUpEvents?.[0]?.message).toContain('restored');

    const battle = createBattleState(attacker, defender);
    (runtime as any).activeBattle = battle;
    (runtime as any).startBattleNarration(battle, result.narrationEvents);
    expect(attacker.currentHp).toBe(18);
    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(attacker.currentHp).toBe(30);
  });

  it('keeps crit buffs active through support turns and consumes them on the next damaging skill', () => {
    const attacker: any = {
      name: 'Buddo',
      element: 'forge',
      currentHp: 30,
      maxHp: 50,
      attack: 24,
      attackModifier: 1,
      defense: 18,
      defenseModifier: 1,
      speed: 16,
      speedModifier: 1,
      level: 10,
      fainted: false,
      activeEffectIds: [] as string[],
      activeEffectSourceById: {} as Record<string, string>,
      activeEffectValueById: {} as Record<string, number>,
      pendingCritChanceBonus: 0,
      equipmentDefensePositiveBonus: 0,
      persistentStatus: null,
      persistentHeal: null,
      equipmentEffectInstances: [],
      equipmentEffectSourceById: {},
    };
    const defender: any = {
      name: 'Target',
      element: 'stone',
      currentHp: 120,
      maxHp: 120,
      attack: 12,
      attackModifier: 1,
      defense: 14,
      defenseModifier: 1,
      speed: 10,
      speedModifier: 1,
      level: 10,
      fainted: false,
      activeEffectIds: [] as string[],
      activeEffectSourceById: {} as Record<string, string>,
      activeEffectValueById: {} as Record<string, number>,
      pendingCritChanceBonus: 0,
      equipmentDefensePositiveBonus: 0,
      persistentStatus: null,
      persistentHeal: null,
      equipmentEffectInstances: [],
      equipmentEffectSourceById: {},
    };
    const runtime = createRuntimeHarness(attacker, defender);
    (runtime as any).skillEffectLookupById = {
      'crit-buff': {
        effect_id: 'crit-buff',
        effect_name: 'Crit Buff',
        effect_type: 'crit_buff',
        buffPercent: 0.7,
        description: 'Raise crit chance',
        iconUrl: 'https://example.com/crit-icon.png',
      },
    };
    const battle = createBattleState(attacker, defender);
    const decompress: SkillDefinition = {
      skill_id: 'decompress',
      skill_name: 'Decompress',
      element: 'forge',
      type: 'support',
      priority: 1,
      targetKind: 'target_self',
      effectIds: ['crit-buff'],
      effectAttachments: [{ effectId: 'crit-buff', procChance: 1, buffPercent: 0.7 }],
    };
    const polish: SkillDefinition = {
      skill_id: 'polish',
      skill_name: 'Polish',
      element: 'forge',
      type: 'support',
      priority: 1,
      targetKind: 'target_self',
    };
    const strike: SkillDefinition = {
      skill_id: 'strike',
      skill_name: 'Strike',
      element: 'forge',
      type: 'damage',
      priority: 1,
      damage: 35,
    };

    const buffResult = (runtime as any).executeBattleSkillWithSkill(battle, 'player', decompress, 0, false, false);
    (runtime as any).activeBattle = battle;
    (runtime as any).startBattleNarration(battle, buffResult.narrationEvents);
    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(attacker.pendingCritChanceBonus).toBeCloseTo(0.7);
    expect(attacker.activeEffectIds).toContain('crit-buff');

    const supportResult = (runtime as any).executeBattleSkillWithSkill(battle, 'player', polish, 0, false, false);
    expect(attacker.pendingCritChanceBonus).toBeCloseTo(0.7);
    expect(attacker.activeEffectIds).toContain('crit-buff');
    (runtime as any).startBattleNarration(battle, supportResult.narrationEvents);
    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(attacker.pendingCritChanceBonus).toBeCloseTo(0.7);

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.2);
    try {
      const damageResult = (runtime as any).executeBattleSkillWithSkill(battle, 'player', strike, 0, false, false);
      expect(attacker.pendingCritChanceBonus).toBe(0);
      expect(attacker.activeEffectIds).not.toContain('crit-buff');
      expect(damageResult.narrationEvents[0]?.message).toContain('dealt');
      expect(damageResult.narrationEvents[0]?.followUpEvents?.[0]?.message).toBe('It was a crit!');
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('applies percent_damage healing after the hit resolves', () => {
    const attacker = {
      name: 'Buddo',
      element: 'bloom',
      currentHp: 10,
      maxHp: 100,
      attack: 30,
      attackModifier: 1,
      level: 10,
      fainted: false,
    };
    const defender = {
      name: 'Target',
      element: 'stone',
      currentHp: 200,
      maxHp: 200,
      defense: 12,
      defenseModifier: 1,
      fainted: false,
    };
    const runtime = createRuntimeHarness(attacker, defender);
    const battle = createBattleState(attacker, defender);
    const skill: SkillDefinition = {
      skill_id: 'drain-bite',
      skill_name: 'Drain Bite',
      element: 'bloom',
      type: 'damage',
      priority: 1,
      damage: 40,
      healMode: 'percent_damage',
      healValue: 0.5,
    };
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      const result = (runtime as any).executeBattleSkillWithSkill(
        battle,
        'player',
        skill,
        0,
        false,
        false,
      );
      const expectedHeal = Math.floor(Math.min(result.damageToDefender ?? 0, 200) * 0.5);

      expect(result.damageToDefender).toBeGreaterThan(0);
      expect(attacker.currentHp).toBe(10);
      expect(result.narrationEvents.length).toBe(1);

      (runtime as any).activeBattle = battle;
      (runtime as any).startBattleNarration(battle, result.narrationEvents);

      expect(battle.logLine).toContain('dealt');
      expect(battle.logLine).not.toContain('restored');
      expect(attacker.currentHp).toBe(10);
      expect((runtime as any).battleAdvanceNarration()).toBe(true);
      expect(attacker.currentHp).toBe(10 + expectedHeal);
      expect(battle.logLine).toContain(`restored ${expectedHeal} HP`);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('still applies self-heal and self-buffs when the hit knocks out the defender', () => {
    const attacker = {
      name: 'Buddo',
      element: 'bloom',
      currentHp: 18,
      maxHp: 100,
      attack: 30,
      attackModifier: 1,
      defense: 20,
      defenseModifier: 1,
      speed: 18,
      speedModifier: 1,
      level: 10,
      fainted: false,
      activeEffectIds: [] as string[],
    };
    const defender = {
      name: 'Target',
      element: 'stone',
      currentHp: 14,
      maxHp: 50,
      attack: 12,
      attackModifier: 1,
      defense: 8,
      defenseModifier: 1,
      speed: 10,
      speedModifier: 1,
      fainted: false,
      activeEffectIds: [] as string[],
    };
    const runtime = createRuntimeHarness(attacker, defender);
    (runtime as any).skillEffectLookupById = {
      'battle-focus': {
        effect_id: 'battle-focus',
        effect_name: 'Battle Focus',
        effect_type: 'atk_buff',
        buffPercent: 0.25,
        description: 'Attack up',
      },
    };
    const battle = createBattleState(attacker, defender);
    const skill: SkillDefinition = {
      skill_id: 'drain-burst',
      skill_name: 'Drain Burst',
      element: 'bloom',
      type: 'damage',
      priority: 1,
      damage: 40,
      healMode: 'percent_damage',
      healValue: 0.5,
      effectIds: ['battle-focus'],
    };
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      const result = (runtime as any).executeBattleSkillWithSkill(
        battle,
        'player',
        skill,
        0,
        false,
        false,
      );
      const expectedHeal = Math.floor(14 * 0.5);

      expect(result.defenderFainted).toBe(true);
      expect(attacker.currentHp).toBe(18);
      expect(attacker.attackModifier).toBe(1);
      expect(result.narrationEvents.length).toBe(1);

      (runtime as any).activeBattle = battle;
      (runtime as any).startBattleNarration(battle, result.narrationEvents);

      expect(defender.fainted).toBe(true);
      expect(battle.logLine).toContain('dealt');
      expect(battle.logLine).not.toContain('fainted');
      expect(battle.logLine).not.toContain('restored');
      expect((runtime as any).battleAdvanceNarration()).toBe(true);
      expect(attacker.currentHp).toBe(18 + expectedHeal);
      expect(battle.logLine).toContain(`restored ${expectedHeal} HP`);
      expect(attacker.attackModifier).toBe(1);
      expect((runtime as any).battleAdvanceNarration()).toBe(true);
      expect(attacker.attackModifier).toBe(1.25);
      expect(attacker.activeEffectIds).toContain('battle-focus');
      expect(battle.logLine).toContain('Battle Focus');
      expect((runtime as any).battleAdvanceNarration()).toBe(true);
      expect(battle.logLine).toContain('Target fainted.');
      expect((runtime as any).battleAdvanceNarration()).toBe(true);
      expect(battle.logLine).toBe('You won the battle.');
      expect(battle.result).toBe('won');
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('guarantees at least 1 HP for percent-damage healing on low-damage knockouts', () => {
    const attacker = {
      name: 'Buddo',
      element: 'bloom',
      currentHp: 9,
      maxHp: 40,
      attack: 6,
      attackModifier: 1,
      level: 5,
      fainted: false,
      persistentHeal: null,
      activeEffectIds: [] as string[],
    };
    const defender = {
      name: 'Target',
      element: 'stone',
      currentHp: 1,
      maxHp: 20,
      defense: 999,
      defenseModifier: 1,
      fainted: false,
      persistentHeal: null,
      activeEffectIds: [] as string[],
    };
    const runtime = createRuntimeHarness(attacker, defender);
    const battle = createBattleState(attacker, defender);
    const skill: SkillDefinition = {
      skill_id: 'sap',
      skill_name: 'Sap',
      element: 'bloom',
      type: 'damage',
      priority: 1,
      damage: 10,
      healMode: 'percent_damage',
      healValue: 0.2,
    };
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      const result = (runtime as any).executeBattleSkillWithSkill(
        battle,
        'player',
        skill,
        0,
        false,
        false,
      );

      expect(result.defenderFainted).toBe(true);
      (runtime as any).activeBattle = battle;
      (runtime as any).startBattleNarration(battle, result.narrationEvents);
      expect(attacker.currentHp).toBe(9);
      expect((runtime as any).battleAdvanceNarration()).toBe(true);
      expect(attacker.currentHp).toBe(10);
      expect(battle.logLine).toContain('restored 1 HP');
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('does not apply stat buffs when effect proc chance fails', () => {
    const attacker = {
      name: 'Buddo',
      element: 'bloom',
      currentHp: 20,
      maxHp: 40,
      attackModifier: 1,
      defenseModifier: 1,
      speedModifier: 1,
      fainted: false,
      activeEffectIds: [] as string[],
      activeEffectSourceById: {} as Record<string, string>,
      activeEffectValueById: {} as Record<string, number>,
    };
    const defender = {
      name: 'Target',
      element: 'stone',
      currentHp: 40,
      maxHp: 40,
      fainted: false,
      activeEffectIds: [] as string[],
    };
    const runtime = createRuntimeHarness(attacker, defender);
    (runtime as any).skillEffectLookupById = {
      'battle-focus': {
        effect_id: 'battle-focus',
        effect_name: 'Battle Focus',
        effect_type: 'atk_buff',
        description: 'Attack up',
      },
    };
    const skill: SkillDefinition = {
      skill_id: 'battle-focus',
      skill_name: 'Battle Focus',
      element: 'bloom',
      type: 'support',
      priority: 1,
      effectAttachments: [{ effectId: 'battle-focus', buffPercent: 0.2, procChance: 0.25 }],
      effectIds: ['battle-focus'],
    };
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    try {
      const result = (runtime as any).executeBattleSkillWithSkill(
        { playerTeam: [attacker], opponentTeam: [defender], playerActiveIndex: 0, opponentActiveIndex: 0 },
        'player',
        skill,
        0,
        false,
        false,
      );
      const effectEvent = result.narrationEvents[0]?.followUpEvents?.find((event: any) =>
        event.postDamageResolution?.attackerEffectIds?.includes('battle-focus'),
      );
      expect(effectEvent).toBeUndefined();
      expect(attacker.attackModifier).toBe(1);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('keeps additive stacking for repeated successful procs of the same effect', () => {
    const attacker = {
      name: 'Buddo',
      element: 'bloom',
      currentHp: 20,
      maxHp: 40,
      attackModifier: 1,
      defenseModifier: 1,
      speedModifier: 1,
      fainted: false,
      activeEffectIds: [] as string[],
      activeEffectSourceById: {} as Record<string, string>,
      activeEffectValueById: {} as Record<string, number>,
    };
    const defender = {
      name: 'Target',
      element: 'stone',
      currentHp: 40,
      maxHp: 40,
      fainted: false,
      activeEffectIds: [] as string[],
    };
    const runtime = createRuntimeHarness(attacker, defender);
    (runtime as any).skillEffectLookupById = {
      'battle-focus': {
        effect_id: 'battle-focus',
        effect_name: 'Battle Focus',
        effect_type: 'atk_buff',
        description: 'Attack up',
      },
    };
    const battle = createBattleState(attacker, defender);
    const skill: SkillDefinition = {
      skill_id: 'battle-focus',
      skill_name: 'Battle Focus',
      element: 'bloom',
      type: 'support',
      priority: 1,
      effectAttachments: [{ effectId: 'battle-focus', buffPercent: 0.2, procChance: 1 }],
      effectIds: ['battle-focus'],
    };

    const first = (runtime as any).executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);
    (runtime as any).activeBattle = battle;
    (runtime as any).startBattleNarration(battle, first.narrationEvents);
    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(attacker.attackModifier).toBeCloseTo(1.2, 5);
    expect(attacker.activeEffectValueById['battle-focus']).toBeCloseTo(0.2, 5);
    expect((runtime as any).battleAdvanceNarration()).toBe(true);

    const second = (runtime as any).executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);
    (runtime as any).startBattleNarration(battle, second.narrationEvents);
    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(attacker.attackModifier).toBeCloseTo(1.4, 5);
    expect(attacker.activeEffectValueById['battle-focus']).toBeCloseTo(0.4, 5);
  });

  it('applies persistent end-of-turn healing after a completed turn and clears when duration ends', () => {
    const attacker = {
      name: 'Buddo',
      element: 'tide',
      currentHp: 20,
      maxHp: 40,
      fainted: false,
      persistentHeal: null as {
        effectId: string;
        sourceName: string;
        mode: 'flat' | 'percent_max_hp';
        value: number;
        remainingTurns: number;
      } | null,
      activeEffectIds: [] as string[],
      activeEffectSourceById: {} as Record<string, string>,
      activeEffectValueById: {} as Record<string, number>,
    };
    const defender = {
      name: 'Target',
      element: 'stone',
      currentHp: 40,
      maxHp: 40,
      fainted: false,
      persistentHeal: null,
      activeEffectIds: [] as string[],
      activeEffectSourceById: {} as Record<string, string>,
      activeEffectValueById: {} as Record<string, number>,
    };
    const runtime = createRuntimeHarness(attacker, defender);
    (runtime as any).skillEffectLookupById = {
      'persistent-heal': {
        effect_id: 'persistent-heal',
        effect_name: 'Persistent Heal',
        effect_type: 'persistent_heal',
        description: 'Restores HP each turn.',
      },
    };
    const battle = createBattleState(attacker, defender);
    const skill: SkillDefinition = {
      skill_id: 'aqua-ring',
      skill_name: 'Aqua Ring',
      element: 'tide',
      type: 'support',
      priority: 1,
      effectAttachments: [
        {
          effectId: 'persistent-heal',
          procChance: 1,
          persistentHealMode: 'flat',
          persistentHealValue: 3,
          persistentHealDurationTurns: 2,
        },
      ],
      effectIds: ['persistent-heal'],
    };

    const result = (runtime as any).executeBattleSkillWithSkill(
      battle,
      'player',
      skill,
      0,
      false,
      false,
    );

    battle.pendingEndTurnResolution = true;
    (runtime as any).activeBattle = battle;
    (runtime as any).startBattleNarration(battle, result.narrationEvents);
    expect(attacker.persistentHeal).toBeNull();

    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(attacker.persistentHeal).toEqual({
      effectId: 'persistent-heal',
      sourceName: 'Aqua Ring',
      mode: 'flat',
      value: 3,
      remainingTurns: 2,
    });
    expect(battle.logLine).toContain('gained end-of-turn healing');

    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(attacker.currentHp).toBe(23);
    expect(attacker.persistentHeal).toEqual({
      effectId: 'persistent-heal',
      sourceName: 'Aqua Ring',
      mode: 'flat',
      value: 3,
      remainingTurns: 1,
    });
    expect(battle.logLine).toContain('was healed +3 HP by Aqua Ring');

    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(battle.logLine).toBe('Choose your move.');

    battle.pendingEndTurnResolution = true;
    battle.activeNarration = {
      message: 'Turn resolved.',
      attacker: null,
    };
    battle.narrationQueue = [];
    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(attacker.currentHp).toBe(26);
    expect(attacker.persistentHeal).toBeNull();
    expect(battle.logLine).toContain('was healed +3 HP by Aqua Ring');
  });

  it('reapplies persistent-heal as refresh+replace', () => {
    const attacker = {
      name: 'Buddo',
      element: 'tide',
      currentHp: 20,
      maxHp: 40,
      fainted: false,
      persistentHeal: null as {
        effectId: string;
        sourceName: string;
        mode: 'flat' | 'percent_max_hp';
        value: number;
        remainingTurns: number;
      } | null,
      activeEffectIds: [] as string[],
      activeEffectSourceById: {} as Record<string, string>,
      activeEffectValueById: {} as Record<string, number>,
    };
    const defender = {
      name: 'Target',
      element: 'stone',
      currentHp: 40,
      maxHp: 40,
      fainted: false,
      persistentHeal: null,
      activeEffectIds: [] as string[],
      activeEffectSourceById: {} as Record<string, string>,
      activeEffectValueById: {} as Record<string, number>,
    };
    const runtime = createRuntimeHarness(attacker, defender);
    (runtime as any).skillEffectLookupById = {
      'persistent-heal': {
        effect_id: 'persistent-heal',
        effect_name: 'Persistent Heal',
        effect_type: 'persistent_heal',
        description: 'Restores HP each turn.',
      },
    };
    const battle = createBattleState(attacker, defender);
    (runtime as any).activeBattle = battle;

    const firstSkill: SkillDefinition = {
      skill_id: 'aqua-ring',
      skill_name: 'Aqua Ring',
      element: 'tide',
      type: 'support',
      priority: 1,
      effectAttachments: [
        {
          effectId: 'persistent-heal',
          procChance: 1,
          persistentHealMode: 'flat',
          persistentHealValue: 2,
          persistentHealDurationTurns: 3,
        },
      ],
      effectIds: ['persistent-heal'],
    };
    const secondSkill: SkillDefinition = {
      ...firstSkill,
      skill_id: 'tidal-upgrade',
      skill_name: 'Tidal Upgrade',
      effectAttachments: [
        {
          effectId: 'persistent-heal',
          procChance: 1,
          persistentHealMode: 'flat',
          persistentHealValue: 5,
          persistentHealDurationTurns: 1,
        },
      ],
    };

    const first = (runtime as any).executeBattleSkillWithSkill(battle, 'player', firstSkill, 0, false, false);
    (runtime as any).startBattleNarration(battle, first.narrationEvents);
    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(attacker.persistentHeal?.value).toBe(2);
    expect(attacker.persistentHeal?.remainingTurns).toBe(3);

    const second = (runtime as any).executeBattleSkillWithSkill(battle, 'player', secondSkill, 0, false, false);
    (runtime as any).startBattleNarration(battle, second.narrationEvents);
    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(attacker.persistentHeal).toEqual({
      effectId: 'persistent-heal',
      sourceName: 'Tidal Upgrade',
      mode: 'flat',
      value: 5,
      remainingTurns: 1,
    });

    battle.pendingEndTurnResolution = true;
    battle.activeNarration = { message: 'Turn resolved.', attacker: null };
    battle.narrationQueue = [];
    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(attacker.currentHp).toBe(25);
    expect(attacker.persistentHeal).toBeNull();
  });

  it('plays end-of-turn toxic and healing narration in speed order with heal sources', () => {
    const attacker = {
      name: 'Buddo',
      element: 'tide',
      currentHp: 20,
      maxHp: 30,
      attack: 20,
      attackModifier: 1,
      defense: 12,
      defenseModifier: 1,
      speed: 10,
      speedModifier: 1,
      level: 10,
      fainted: false,
      persistentStatus: null,
      persistentHeal: {
        effectId: 'persistent-heal',
        sourceName: 'Aqua Ring',
        mode: 'flat' as const,
        value: 3,
        remainingTurns: 2,
      },
      activeEffectIds: ['persistent-heal'],
      activeEffectSourceById: { 'persistent-heal': 'Aqua Ring' },
      activeEffectValueById: { 'persistent-heal': 3 },
      equipmentEffectInstances: [],
      equipmentEffectSourceById: {},
      pendingCritChanceBonus: 0,
      equipmentDefensePositiveBonus: 0,
    };
    const defender = {
      name: 'Enemy',
      element: 'shade',
      currentHp: 40,
      maxHp: 40,
      attack: 18,
      attackModifier: 1,
      defense: 12,
      defenseModifier: 1,
      speed: 40,
      speedModifier: 1,
      level: 10,
      fainted: false,
      persistentStatus: {
        kind: 'toxic' as const,
        potencyBase: 0.1,
        potencyPerTurn: 0,
        turnCount: 0,
        source: 'Venom',
        effectId: 'status-inflict-toxic',
      },
      persistentHeal: null,
      activeEffectIds: [],
      activeEffectSourceById: {},
      activeEffectValueById: {},
      equipmentEffectInstances: [],
      equipmentEffectSourceById: {},
      pendingCritChanceBonus: 0,
      equipmentDefensePositiveBonus: 0,
    };
    const runtime = createRuntimeHarness(attacker, defender);
    const battle = createBattleState(attacker, defender);

    (runtime as any).activeBattle = battle;
    const events = (runtime as any).buildEndTurnHealingNarrationEvents(battle);
    expect(events).toHaveLength(2);
    expect(events[0]?.message).toContain('Enemy took');
    expect(events[1]?.message).toBe('Your Buddo was healed +3 HP by Aqua Ring.');

    (runtime as any).startBattleNarration(battle, events);
    expect(battle.logLine).toContain('Enemy took');
    expect(defender.currentHp).toBe(36);

    expect((runtime as any).battleAdvanceNarration()).toBe(true);
    expect(battle.logLine).toBe('Your Buddo was healed +3 HP by Aqua Ring.');
    expect(attacker.currentHp).toBe(23);
  });

  it('applies persistent-heal attachments to the damage target (defender)', () => {
    const attacker = {
      name: 'Buddo',
      element: 'tide',
      currentHp: 30,
      maxHp: 40,
      attack: 20,
      attackModifier: 1,
      level: 10,
      fainted: false,
      persistentHeal: null,
      activeEffectIds: [] as string[],
      activeEffectSourceById: {} as Record<string, string>,
      activeEffectValueById: {} as Record<string, number>,
    };
    const defender = {
      name: 'Target',
      element: 'stone',
      currentHp: 32,
      maxHp: 40,
      defense: 18,
      defenseModifier: 1,
      fainted: false,
      persistentHeal: null as {
        effectId: string;
        sourceName: string;
        mode: 'flat' | 'percent_max_hp';
        value: number;
        remainingTurns: number;
      } | null,
      activeEffectIds: [] as string[],
      activeEffectSourceById: {} as Record<string, string>,
      activeEffectValueById: {} as Record<string, number>,
    };
    const runtime = createRuntimeHarness(attacker, defender);
    (runtime as any).skillEffectLookupById = {
      'persistent-heal': {
        effect_id: 'persistent-heal',
        effect_name: 'Persistent Heal',
        effect_type: 'persistent_heal',
        description: 'Restores HP each turn.',
      },
    };
    const battle = createBattleState(attacker, defender);
    const skill: SkillDefinition = {
      skill_id: 'soak-mark',
      skill_name: 'Soak Mark',
      element: 'tide',
      type: 'damage',
      priority: 1,
      damage: 8,
      effectAttachments: [
        {
          effectId: 'persistent-heal',
          procChance: 1,
          persistentHealMode: 'flat',
          persistentHealValue: 2,
          persistentHealDurationTurns: 2,
        },
      ],
      effectIds: ['persistent-heal'],
    };

    const result = (runtime as any).executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);
    (runtime as any).activeBattle = battle;
    (runtime as any).startBattleNarration(battle, result.narrationEvents);
    expect((runtime as any).battleAdvanceNarration()).toBe(true);

    expect(attacker.persistentHeal).toBeNull();
    expect(defender.persistentHeal).toEqual({
      effectId: 'persistent-heal',
      sourceName: 'Soak Mark',
      mode: 'flat',
      value: 2,
      remainingTurns: 2,
    });
  });
});
