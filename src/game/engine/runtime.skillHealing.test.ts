import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import type { SkillDefinition } from '@/game/skills/types';

function createRuntimeHarness(attacker: Record<string, unknown>, defender: Record<string, unknown>) {
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
    nextAnimationToken: 1,
    logLine: '',
    result: 'ongoing',
    phase: 'player-turn',
  };
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
});
