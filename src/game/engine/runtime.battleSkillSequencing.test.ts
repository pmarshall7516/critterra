import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import { buildDefaultElementChart } from '@/game/skills/schema';
import type { SkillDefinition } from '@/game/skills/types';

function createBattleCritter(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slotIndex: 0,
    critterId: 1,
    name: 'Attacker',
    element: 'bloom',
    spriteUrl: '',
    level: 10,
    maxHp: 40,
    currentHp: 20,
    attack: 10,
    defense: 10,
    speed: 10,
    equipmentDefensePositiveBonus: 0,
    fainted: false,
    knockoutProgressCounted: false,
    attackModifier: 1,
    defenseModifier: 1,
    speedModifier: 1,
    pendingCritChanceBonus: 0,
    activeEffectIds: [],
    activeEffectValueById: {},
    activeEffectSourceById: {},
    equipmentEffectIds: [],
    equipmentEffectSourceById: {},
    persistentHeal: null,
    consecutiveSuccessfulGuardCount: 0,
    equippedSkillIds: [null, null, null, null],
    ...overrides,
  };
}

function createRuntimeHarness() {
  const runtime = Object.create(GameRuntime.prototype) as any;
  runtime.elementChart = buildDefaultElementChart();
  runtime.skillEffectLookupById = {
    'battle-focus': {
      effect_id: 'battle-focus',
      effect_name: 'Battle Focus',
      effect_type: 'atk_buff',
      buffPercent: 0.5,
      description: '',
    },
  };
  return runtime;
}

describe('GameRuntime battle skill sequencing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calculates damage before scheduling percent-damage healing and attacker effects in follow-up events', () => {
    const runtime = createRuntimeHarness();
    const attacker = createBattleCritter();
    const defender = createBattleCritter({
      critterId: 2,
      name: 'Defender',
      element: 'stone',
      currentHp: 40,
      maxHp: 40,
      attack: 9,
      defense: 10,
    });
    const battle = {
      source: {
        type: 'wild',
        mapId: 'test-map',
        label: 'Wild',
      },
      playerTeam: [attacker],
      opponentTeam: [defender],
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
    };
    const skill: SkillDefinition = {
      skill_id: 'sap',
      skill_name: 'Sap',
      element: 'bloom',
      type: 'damage',
      priority: 1,
      damage: 25,
      healMode: 'percent_damage',
      healValue: 0.2,
      effectIds: ['battle-focus'],
    };

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.5);

    const result = runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);

    expect(result.damageToDefender).toBe(6);
    expect(result.narrationEvents.length).toBeGreaterThan(0);
    const mainEvent = result.narrationEvents[0];
    expect(mainEvent.followUpEvents).toBeDefined();
    expect(mainEvent.followUpEvents!.length).toBeGreaterThan(0);
    const healEvent = mainEvent.followUpEvents!.find((e: any) => e.postDamageResolution?.healToAttacker > 0);
    expect(healEvent).toBeDefined();
    const effectEvent = mainEvent.followUpEvents!.find((e: any) =>
      e.postDamageResolution?.attackerEffectIds?.includes('battle-focus')
    );
    expect(effectEvent).toBeDefined();
  });

  it('schedules flat healing on support skills via follow-up events', () => {
    const runtime = createRuntimeHarness();
    const attacker = createBattleCritter({ currentHp: 11, maxHp: 40 });
    const defender = createBattleCritter({
      critterId: 2,
      name: 'Defender',
      element: 'stone',
      currentHp: 40,
      maxHp: 40,
    });
    const battle = {
      source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
      playerTeam: [attacker],
      opponentTeam: [defender],
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
    };
    const skill: SkillDefinition = {
      skill_id: 'heal',
      skill_name: 'Heal',
      element: 'bloom',
      type: 'support',
      priority: 1,
      healMode: 'flat',
      healValue: 7,
    };

    const result = runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);

    expect(result.damageToDefender).toBeUndefined();
    expect(result.narrationEvents.length).toBeGreaterThan(0);
    const mainEvent = result.narrationEvents[0];
    expect(mainEvent.followUpEvents).toBeDefined();
  });

  it('supports support skills that only apply effects without direct healing', () => {
    const runtime = createRuntimeHarness();
    const attacker = createBattleCritter({ currentHp: 11, maxHp: 40 });
    const defender = createBattleCritter({
      critterId: 2,
      name: 'Defender',
      element: 'stone',
      currentHp: 40,
      maxHp: 40,
    });
    const battle = {
      source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
      playerTeam: [attacker],
      opponentTeam: [defender],
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
    };
    const skill: SkillDefinition = {
      skill_id: 'battle-focus',
      skill_name: 'Battle Focus',
      element: 'bloom',
      type: 'support',
      priority: 1,
      effectIds: ['battle-focus'],
    };

    const result = runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);

    expect(result.damageToDefender).toBeUndefined();
    expect(result.narrationEvents.length).toBeGreaterThan(0);
    const mainEvent = result.narrationEvents[0];
    expect(mainEvent.followUpEvents).toBeDefined();
    const healEvent = mainEvent.followUpEvents!.find((event: any) => event.postDamageResolution?.healToAttacker > 0);
    expect(healEvent).toBeUndefined();
    const effectEvent = mainEvent.followUpEvents!.find((event: any) =>
      event.postDamageResolution?.attackerEffectIds?.includes('battle-focus'),
    );
    expect(effectEvent).toBeDefined();
    expect(effectEvent?.postDamageResolution?.attackerEffectBuffPercentById).toEqual({
      'battle-focus': 0.5,
    });
  });

  it('does not schedule skill effects when proc chance fails', () => {
    const runtime = createRuntimeHarness();
    const attacker = createBattleCritter({ currentHp: 11, maxHp: 40 });
    const defender = createBattleCritter({
      critterId: 2,
      name: 'Defender',
      element: 'stone',
      currentHp: 40,
      maxHp: 40,
    });
    const battle = {
      source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
      playerTeam: [attacker],
      opponentTeam: [defender],
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
    };
    const skill: SkillDefinition = {
      skill_id: 'battle-focus',
      skill_name: 'Battle Focus',
      element: 'bloom',
      type: 'support',
      priority: 1,
      effectAttachments: [{ effectId: 'battle-focus', buffPercent: 0.5, procChance: 0.25 }],
      effectIds: ['battle-focus'],
    };
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.8);

    try {
      const result = runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);
      const mainEvent = result.narrationEvents[0];
      const effectEvent = mainEvent.followUpEvents!.find((event: any) =>
        event.postDamageResolution?.attackerEffectIds?.includes('battle-focus'),
      );
      expect(effectEvent).toBeUndefined();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('schedules max-hp percentage healing on damage skills via follow-up events', () => {
    const runtime = createRuntimeHarness();
    const attacker = createBattleCritter({ currentHp: 20, maxHp: 100 });
    const defender = createBattleCritter({
      critterId: 2,
      name: 'Defender',
      element: 'stone',
      currentHp: 40,
      maxHp: 40,
      attack: 9,
      defense: 10,
    });
    const battle = {
      source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
      playerTeam: [attacker],
      opponentTeam: [defender],
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
    };
    const skill: SkillDefinition = {
      skill_id: 'drain-hit',
      skill_name: 'Drain Hit',
      element: 'bloom',
      type: 'damage',
      priority: 1,
      damage: 18,
      healMode: 'percent_max_hp',
      healValue: 0.1,
    };

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.5);

    const result = runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);

    expect(result.damageToDefender).toBe(4);
    expect(result.narrationEvents.length).toBeGreaterThan(0);
    const mainEvent = result.narrationEvents[0];
    expect(mainEvent.followUpEvents).toBeDefined();
    const healEvent = mainEvent.followUpEvents!.find((e: any) => e.postDamageResolution?.healToAttacker > 0);
    expect(healEvent).toBeDefined();
  });

  it('uses skill priority before speed when resolving turn order', () => {
    const runtime = createRuntimeHarness();
    const player = createBattleCritter({
      name: 'Player',
      speed: 5,
      equippedSkillIds: ['high-priority', null, null, null],
    });
    const opponent = createBattleCritter({
      critterId: 2,
      name: 'Opponent',
      speed: 20,
      equippedSkillIds: ['normal-priority', null, null, null],
    });
    const battle = {
      phase: 'player-turn',
      result: 'ongoing',
      turnNumber: 0,
      pendingEndTurnResolution: false,
      source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
      playerTeam: [player],
      opponentTeam: [opponent],
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
    };
    runtime.skillLookupById = {
      'high-priority': {
        skill_id: 'high-priority',
        skill_name: 'Quick',
        element: 'normal',
        type: 'damage',
        priority: 2,
        damage: 20,
      },
      'normal-priority': {
        skill_id: 'normal-priority',
        skill_name: 'Slow',
        element: 'normal',
        type: 'damage',
        priority: 1,
        damage: 20,
      },
    } as Record<string, SkillDefinition>;
    const callOrder: string[] = [];
    runtime.executeBattleSkillWithSkill = vi.fn((_: unknown, team: 'player' | 'opponent') => {
      callOrder.push(team);
      return { narrationEvents: [], defenderFainted: false };
    });
    runtime.startBattleNarration = vi.fn();

    runtime.resolvePlayerTurnAction(battle, 'attack', 0);

    expect(callOrder).toEqual(['player', 'opponent']);
  });

  it('falls back to speed when priorities are tied', () => {
    const runtime = createRuntimeHarness();
    const player = createBattleCritter({
      name: 'Player',
      speed: 5,
      equippedSkillIds: ['normal-player', null, null, null],
    });
    const opponent = createBattleCritter({
      critterId: 2,
      name: 'Opponent',
      speed: 20,
      equippedSkillIds: ['normal-opponent', null, null, null],
    });
    const battle = {
      phase: 'player-turn',
      result: 'ongoing',
      turnNumber: 0,
      pendingEndTurnResolution: false,
      source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
      playerTeam: [player],
      opponentTeam: [opponent],
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
    };
    runtime.skillLookupById = {
      'normal-player': {
        skill_id: 'normal-player',
        skill_name: 'P',
        element: 'normal',
        type: 'damage',
        priority: 1,
        damage: 20,
      },
      'normal-opponent': {
        skill_id: 'normal-opponent',
        skill_name: 'O',
        element: 'normal',
        type: 'damage',
        priority: 1,
        damage: 20,
      },
    } as Record<string, SkillDefinition>;
    const callOrder: string[] = [];
    runtime.executeBattleSkillWithSkill = vi.fn((_: unknown, team: 'player' | 'opponent') => {
      callOrder.push(team);
      return { narrationEvents: [], defenderFainted: false };
    });
    runtime.startBattleNarration = vi.fn();

    runtime.resolvePlayerTurnAction(battle, 'attack', 0);

    expect(callOrder).toEqual(['opponent', 'player']);
  });

  it('applies target debuffs to the defender using attachment values', () => {
    const runtime = createRuntimeHarness();
    runtime.skillEffectLookupById['target-def-down'] = {
      effect_id: 'target-def-down',
      effect_name: 'Target Defense Down',
      effect_type: 'target_def_debuff',
      description: '',
    };
    const attacker = createBattleCritter({ name: 'Player' });
    const defender = createBattleCritter({ critterId: 2, name: 'Opponent', defenseModifier: 1 });
    const battle = {
      source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
      playerTeam: [attacker],
      opponentTeam: [defender],
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
    };
    const skill: SkillDefinition = {
      skill_id: 'weaken',
      skill_name: 'Weaken',
      element: 'normal',
      type: 'support',
      priority: 1,
      effectAttachments: [{ effectId: 'target-def-down', procChance: 1, buffPercent: 0.25 }],
      effectIds: ['target-def-down'],
    };

    const result = runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);
    const postResolution = result.narrationEvents[0]?.followUpEvents?.find(
      (event: any) => event.postDamageResolution?.defenderEffectIds?.includes('target-def-down'),
    )?.postDamageResolution;
    expect(postResolution).toBeTruthy();

    runtime.applyBattlePostDamageResolution(battle, postResolution);
    expect(defender.defenseModifier).toBe(0.75);
  });

  it('does not apply percent-damage recoil when damage dealt is zero', () => {
    const runtime = createRuntimeHarness();
    runtime.skillEffectLookupById.recoil = {
      effect_id: 'recoil',
      effect_name: 'Recoil',
      effect_type: 'recoil',
      description: '',
    };
    const attacker = createBattleCritter({ name: 'Player' });
    const defender = createBattleCritter({ critterId: 2, name: 'Opponent' });
    const battle = {
      source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
      playerTeam: [attacker],
      opponentTeam: [defender],
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
    };
    const skill: SkillDefinition = {
      skill_id: 'steady',
      skill_name: 'Steady',
      element: 'normal',
      type: 'support',
      priority: 1,
      effectAttachments: [
        {
          effectId: 'recoil',
          procChance: 1,
          recoilMode: 'percent_damage_dealt',
          recoilPercent: 0.5,
        },
      ],
      effectIds: ['recoil'],
    };

    const result = runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);
    const recoilEvent = result.narrationEvents[0]?.followUpEvents?.find(
      (event: any) => (event.postDamageResolution?.recoilToAttacker ?? 0) > 0,
    );
    expect(recoilEvent).toBeUndefined();
  });

  it('applies max-hp recoil when configured', () => {
    const runtime = createRuntimeHarness();
    runtime.skillEffectLookupById.recoil = {
      effect_id: 'recoil',
      effect_name: 'Recoil',
      effect_type: 'recoil',
      description: '',
    };
    const attacker = createBattleCritter({ name: 'Player', maxHp: 100 });
    const defender = createBattleCritter({ critterId: 2, name: 'Opponent' });
    const battle = {
      source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
      playerTeam: [attacker],
      opponentTeam: [defender],
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
    };
    const skill: SkillDefinition = {
      skill_id: 'reckless-focus',
      skill_name: 'Reckless Focus',
      element: 'normal',
      type: 'support',
      priority: 1,
      effectAttachments: [
        {
          effectId: 'recoil',
          procChance: 1,
          recoilMode: 'percent_max_hp',
          recoilPercent: 0.2,
        },
      ],
      effectIds: ['recoil'],
    };

    const result = runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);
    const recoilEvent = result.narrationEvents[0]?.followUpEvents?.find(
      (event: any) => (event.postDamageResolution?.recoilToAttacker ?? 0) > 0,
    );
    expect(recoilEvent?.postDamageResolution?.recoilToAttacker).toBe(20);
  });

  it('ignores positive defense boosts on crits but still applies defense debuffs', () => {
    const runtime = createRuntimeHarness();
    const attacker = createBattleCritter({ name: 'Player', attack: 30, level: 10 });
    const skill: SkillDefinition = {
      skill_id: 'slash',
      skill_name: 'Slash',
      element: 'normal',
      type: 'damage',
      priority: 1,
      damage: 40,
    };

    const runDamage = (defenderOverrides: Record<string, unknown>): number => {
      const defender = createBattleCritter({
        critterId: 2,
        name: 'Opponent',
        element: 'stone',
        currentHp: 200,
        maxHp: 200,
        defense: 28,
        defenseModifier: 1.5,
        equipmentDefensePositiveBonus: 8,
        ...defenderOverrides,
      });
      const battle = {
        source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
        playerTeam: [attacker],
        opponentTeam: [defender],
        playerActiveIndex: 0,
        opponentActiveIndex: 0,
      };
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5);
      try {
        return runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false).damageToDefender ?? 0;
      } finally {
        randomSpy.mockRestore();
      }
    };

    const critDamageWithPositiveBoosts = runDamage({});
    const critDamageWithoutPositiveBoosts = runDamage({
      defense: 20,
      defenseModifier: 1,
      equipmentDefensePositiveBonus: 0,
    });
    const critDamageWithDefenseDebuff = runDamage({
      defenseModifier: 0.5,
    });

    expect(critDamageWithPositiveBoosts).toBe(critDamageWithoutPositiveBoosts);
    expect(critDamageWithDefenseDebuff).toBeGreaterThan(critDamageWithPositiveBoosts);
  });
});
