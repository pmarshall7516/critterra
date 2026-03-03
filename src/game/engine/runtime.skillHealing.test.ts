import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import type { SkillDefinition } from '@/game/skills/types';

function createRuntimeHarness(attacker: Record<string, unknown>, defender: Record<string, unknown>) {
  const runtime: any = Object.create(GameRuntime.prototype);
  runtime.elementChart = [];
  runtime.getActiveBattleCritter = vi.fn((_battle: unknown, side: 'player' | 'opponent') =>
    side === 'player' ? attacker : defender,
  );
  runtime.applySkillEffectsToAttacker = vi.fn();
  runtime.formatBattleAttackWithSkillPrefix = vi.fn(
    (_battle: unknown, _team: string, attackerName: string, defenderName: string, skillName: string) =>
      `${attackerName} used ${skillName} on ${defenderName} and`,
  );
  runtime.buildKnockoutMessage = vi.fn(() => '');
  return runtime as GameRuntime & { [key: string]: any };
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

    expect(attacker.currentHp).toBe(30);
    expect(result.defenderFainted).toBe(false);
    expect(result.narration?.message).toContain('healed 12 HP');
  });

  it('heals damage skills based on damage dealt when percent_damage is selected', () => {
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
        { playerTeam: [], opponentTeam: [], playerActiveIndex: 0, opponentActiveIndex: 0 },
        'player',
        skill,
        0,
        false,
        false,
      );
      const expectedHeal = Math.floor((result.damageToDefender ?? 0) * 0.5);

      expect(result.damageToDefender).toBeGreaterThan(0);
      expect(attacker.currentHp).toBe(10 + expectedHeal);
      expect(result.narration?.message).toContain(`restored ${expectedHeal} HP`);
    } finally {
      randomSpy.mockRestore();
    }
  });
});
