import { describe, expect, it } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import { buildDefaultElementChart } from '@/game/skills/schema';
import type { SkillDefinition } from '@/game/skills/types';

function createBattleCritter(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slotIndex: 0,
    critterId: 1,
    name: 'Critter',
    element: 'bloom',
    spriteUrl: '',
    level: 10,
    maxHp: 40,
    currentHp: 40,
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

function createRuntimeHarnessWithRng(rng: () => number) {
  const runtime = Object.create(GameRuntime.prototype) as any;
  runtime.elementChart = buildDefaultElementChart();
  runtime.skillEffectLookupById = {};
  runtime.rng = rng;
  return runtime as GameRuntime;
}

describe('GameRuntime RNG plumbing', () => {
  it('uses injected runtime rng for proc chances (not Math.random)', () => {
    const rng = () => 0.9; // should fail a 0.25 procChance
    const runtime = createRuntimeHarnessWithRng(rng);
    const attacker = createBattleCritter({ name: 'Attacker' });
    const defender = createBattleCritter({ critterId: 2, name: 'Defender', element: 'stone' });
    const battle: any = {
      source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
      playerTeam: [attacker],
      opponentTeam: [defender],
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
    };
    const skill: SkillDefinition = {
      skill_id: 'focus',
      skill_name: 'Focus',
      element: 'bloom',
      type: 'support',
      priority: 1,
      effectAttachments: [{ effectId: 'atk-buff', buffPercent: 0.1, procChance: 0.25 }],
      effectIds: ['atk-buff'],
    };
    const result: any = (runtime as any).executeBattleSkillWithSkill(battle, 'player', skill, 0, false, false);
    const mainEvent = result.narrationEvents[0];
    const hasEffect = (mainEvent.followUpEvents ?? []).some((e: any) =>
      e.postDamageResolution?.attackerEffectIds?.includes('atk-buff'),
    );
    expect(hasEffect).toBe(false);
  });
});

