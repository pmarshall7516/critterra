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
});
