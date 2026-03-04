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
    fainted: false,
    knockoutProgressCounted: false,
    attackModifier: 1,
    defenseModifier: 1,
    speedModifier: 1,
    activeEffectIds: [],
    equipmentEffectIds: [],
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

  it('calculates damage before applying percent-damage healing and attacker effects', () => {
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
      damage: 25,
      healMode: 'percent_damage',
      healValue: 0.2,
      effectIds: ['battle-focus'],
    };

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.5);

    const result = runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);

    expect(result.damageToDefender).toBe(6);
    expect(attacker.currentHp).toBe(21);
    expect(attacker.attackModifier).toBe(1.5);
    expect(attacker.activeEffectIds).toEqual(['battle-focus']);
    expect(defender.currentHp).toBe(40);
    expect(result.narration?.message).toContain('recovered 1 HP');
  });

  it('supports flat healing on support skills', () => {
    const runtime = createRuntimeHarness();
    const attacker = createBattleCritter({ currentHp: 11, maxHp: 40 });
    const defender = createBattleCritter({
      critterId: 2,
      name: 'Defender',
      currentHp: 40,
      maxHp: 40,
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
      skill_id: 'mend',
      skill_name: 'Mend',
      element: 'bloom',
      type: 'support',
      healMode: 'flat',
      healValue: 7,
    };

    const result = runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);

    expect(result.damageToDefender).toBeUndefined();
    expect(attacker.currentHp).toBe(18);
    expect(result.narration?.message).toContain('healed 7 HP');
  });

  it('supports max-hp percentage healing on damage skills', () => {
    const runtime = createRuntimeHarness();
    const attacker = createBattleCritter({ currentHp: 20, maxHp: 40 });
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
      skill_id: 'drain-bite',
      skill_name: 'Drain Bite',
      element: 'ember',
      type: 'damage',
      damage: 20,
      healMode: 'percent_max_hp',
      healValue: 0.25,
    };

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.5);

    const result = runtime.executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);

    expect(result.damageToDefender).toBe(4);
    expect(attacker.currentHp).toBe(30);
    expect(result.narration?.message).toContain('recovered 10 HP');
  });
});
