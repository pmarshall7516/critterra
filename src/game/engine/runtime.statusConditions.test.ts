import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import type { PersistentStatusCondition } from '@/game/battle/statusConditions';
import type { CritterDefinition, PlayerCritterCollectionEntry, PlayerCritterProgress } from '@/game/critters/types';
import { PLAYER_CRITTER_PROGRESS_VERSION } from '@/game/critters/types';

const EMPTY_STATS = { hp: 0, attack: 0, defense: 0, speed: 0 } as const;

function createCritter(input: { id: number; name: string; hp?: number }): CritterDefinition {
  return {
    id: input.id,
    name: input.name,
    element: 'bloom',
    rarity: 'common',
    description: '',
    spriteUrl: '',
    baseStats: {
      hp: input.hp ?? 80,
      attack: 10,
      defense: 9,
      speed: 8,
    },
    abilities: [],
    levels: [
      {
        level: 1,
        missions: [],
        requiredMissionCount: 0,
        statDelta: { ...EMPTY_STATS },
        unlockEquipSlots: 0,
        abilityUnlockIds: [],
        skillUnlockIds: [],
      },
    ],
  };
}

function createProgressEntry(
  critter: CritterDefinition,
  input?: Partial<PlayerCritterCollectionEntry>,
): PlayerCritterCollectionEntry {
  return {
    critterId: critter.id,
    unlocked: input?.unlocked ?? true,
    unlockedAt: input?.unlockedAt ?? null,
    unlockSource: input?.unlockSource ?? null,
    level: input?.level ?? 1,
    currentHp: input?.currentHp ?? critter.baseStats.hp,
    missionProgress: input?.missionProgress ?? {},
    statBonus: input?.statBonus ?? { ...EMPTY_STATS },
    effectiveStats: input?.effectiveStats ?? { ...critter.baseStats },
    unlockedAbilityIds: input?.unlockedAbilityIds ?? [],
    equippedSkillIds: input?.equippedSkillIds ?? [null, null, null, null],
    equippedEquipmentAnchors: input?.equippedEquipmentAnchors ?? [],
    persistentStatus: input?.persistentStatus ?? null,
    lastProgressAt: input?.lastProgressAt ?? null,
  };
}

function createRuntimeHarness(
  critters: CritterDefinition[],
  collection: PlayerCritterCollectionEntry[],
  squad: Array<number | null>,
) {
  const runtime = Object.create(GameRuntime.prototype) as any;
  runtime.playerCritterProgress = {
    version: PLAYER_CRITTER_PROGRESS_VERSION,
    unlockedSquadSlots: 8,
    squad: [...squad],
    collection,
    lockedKnockoutTargetCritterId: null,
    lockedDamageTargetCritterId: null,
  } as PlayerCritterProgress;
  runtime.critterLookup = critters.reduce<Record<number, CritterDefinition>>((registry, critter) => {
    registry[critter.id] = critter;
    return registry;
  }, {});
  runtime.resolveEquipmentStateForCritter = vi.fn(() => ({ anchors: [] }));
  runtime.getEquipmentEffectInstancesFromAnchors = vi.fn(() => []);
  runtime.applyEquipmentEffectsToStats = vi.fn((stats: { hp: number; attack: number; defense: number; speed: number }) => stats);
  return runtime as GameRuntime & { [key: string]: any };
}

describe('GameRuntime status-condition persistence', () => {
  it('syncs toxic and stun persistent statuses from battle back into critter progress', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', hp: 80 });
    const entry = createProgressEntry(critter, { currentHp: 80, persistentStatus: null });
    const runtime = createRuntimeHarness([critter], [entry], [1, null, null, null, null, null, null, null]);
    const toxicStatus: PersistentStatusCondition = {
      kind: 'toxic',
      potencyBase: 0.1,
      potencyPerTurn: 0.05,
      turnCount: 2,
      source: 'Toxic Strike',
      effectId: 'status-inflict-toxic',
    };
    const stunStatus: PersistentStatusCondition = {
      kind: 'stun',
      stunFailChance: 0.35,
      stunSlowdown: 0.5,
      source: 'Stun Burst',
      effectId: 'status-inflict-stun',
    };

    const firstUpdate = (runtime as any).syncPlayerBattleHealthToProgress({
      playerTeam: [{ critterId: 1, currentHp: 57, maxHp: 80, persistentStatus: toxicStatus }],
    });
    expect(firstUpdate).toBe(true);
    expect(entry.currentHp).toBe(57);
    expect(entry.persistentStatus).toEqual(toxicStatus);

    const secondUpdate = (runtime as any).syncPlayerBattleHealthToProgress({
      playerTeam: [{ critterId: 1, currentHp: 57, maxHp: 80, persistentStatus: stunStatus }],
    });
    expect(secondUpdate).toBe(true);
    expect(entry.persistentStatus).toEqual(stunStatus);
  });

  it('clears persistent statuses for squad critters when the squad is fully healed', () => {
    const critterA = createCritter({ id: 1, name: 'Alpha', hp: 90 });
    const critterB = createCritter({ id: 2, name: 'Bravo', hp: 70 });
    const critterC = createCritter({ id: 3, name: 'BenchOnly', hp: 60 });
    const collection: PlayerCritterCollectionEntry[] = [
      createProgressEntry(critterA, {
        currentHp: 14,
        persistentStatus: {
          kind: 'toxic',
          potencyBase: 0.05,
          potencyPerTurn: 0.05,
          turnCount: 1,
          source: 'Spore',
          effectId: 'status-inflict-toxic',
        },
      }),
      createProgressEntry(critterB, {
        currentHp: 8,
        persistentStatus: {
          kind: 'stun',
          stunFailChance: 0.4,
          stunSlowdown: 0.5,
          source: 'Shock',
          effectId: 'status-inflict-stun',
        },
      }),
      createProgressEntry(critterC, {
        currentHp: 11,
        persistentStatus: {
          kind: 'toxic',
          potencyBase: 0.1,
          potencyPerTurn: 0.1,
          turnCount: 3,
          source: 'Venom',
          effectId: 'status-inflict-toxic',
        },
      }),
    ];
    const runtime = createRuntimeHarness(
      [critterA, critterB, critterC],
      collection,
      [1, 2, null, null, null, null, null, null],
    );

    (runtime as any).healSquadToFull();

    expect(collection[0].currentHp).toBe(90);
    expect(collection[0].persistentStatus).toBeNull();
    expect(collection[1].currentHp).toBe(70);
    expect(collection[1].persistentStatus).toBeNull();
    expect(collection[2].currentHp).toBe(11);
    expect(collection[2].persistentStatus?.kind).toBe('toxic');
  });

  it('marks swap counter turns for end-of-turn resolution so toxic/heal effects still tick', () => {
    const runtime = Object.create(GameRuntime.prototype) as any;
    runtime.consumePreActionStatusCancellation = vi.fn(() => ({ blocked: false }));
    runtime.executeBattleSkill = vi.fn(() => ({ narrationEvents: [], defenderFainted: false }));
    runtime.startBattleNarration = vi.fn();
    const battle = {
      result: 'ongoing',
      phase: 'player-turn',
      pendingKnockoutResolution: null,
      pendingOpponentSwitchIndex: null,
      pendingEndTurnResolution: false,
      source: { type: 'wild', mapId: 'test-map', label: 'Wild' },
      playerActiveIndex: 0,
      opponentActiveIndex: 0,
      playerTeam: [
        {
          name: 'Swapper',
          currentHp: 50,
          fainted: false,
          actedThisTurn: false,
          flinch: null,
          persistentStatus: null,
        },
      ],
      opponentTeam: [
        {
          name: 'Enemy',
          currentHp: 50,
          fainted: false,
          actedThisTurn: false,
          flinch: null,
          persistentStatus: null,
        },
      ],
    } as any;

    (runtime as any).resolveOpponentCounterAfterSwap(battle, 'OldMon', 'Swapper');

    expect(battle.pendingEndTurnResolution).toBe(true);
  });
});
