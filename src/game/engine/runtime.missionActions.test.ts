import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import { missionProgressKey } from '@/game/critters/schema';
import type { CritterDefinition, PlayerCritterCollectionEntry, PlayerCritterProgress } from '@/game/critters/types';
import { PLAYER_CRITTER_PROGRESS_VERSION } from '@/game/critters/types';
import type { GameItemDefinition } from '@/game/items/types';
import { PLAYER_ITEM_INVENTORY_VERSION } from '@/game/items/types';

const EMPTY_STATS = {
  hp: 0,
  attack: 0,
  defense: 0,
  speed: 0,
};

function createCritter(input: {
  id: number;
  name: string;
  levels: CritterDefinition['levels'];
}): CritterDefinition {
  return {
    id: input.id,
    name: input.name,
    element: 'bloom',
    rarity: 'common',
    description: '',
    spriteUrl: '',
    baseStats: {
      hp: 20,
      attack: 10,
      defense: 8,
      speed: 7,
    },
    abilities: [],
    levels: input.levels,
  };
}

function buildMissionProgressTemplate(critter: CritterDefinition): Record<string, number> {
  const progress: Record<string, number> = {};
  for (const levelRow of critter.levels) {
    for (const mission of levelRow.missions) {
      progress[missionProgressKey(levelRow.level, mission.id)] = 0;
    }
  }
  return progress;
}

function createCollectionEntry(
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
    missionProgress: input?.missionProgress ?? buildMissionProgressTemplate(critter),
    statBonus: input?.statBonus ?? { ...EMPTY_STATS },
    effectiveStats: input?.effectiveStats ?? { ...critter.baseStats },
    unlockedAbilityIds: input?.unlockedAbilityIds ?? [],
    equippedSkillIds: input?.equippedSkillIds ?? [null, null, null, null],
    equippedEquipmentAnchors: input?.equippedEquipmentAnchors ?? [],
    lastProgressAt: input?.lastProgressAt ?? null,
  };
}

function createHealingItem(input: {
  id: string;
  name: string;
  healAmount?: number;
}): GameItemDefinition {
  return {
    id: input.id,
    name: input.name,
    category: 'healing',
    description: '',
    imageUrl: '',
    misuseText: '',
    successText: '',
    effectType: 'heal_flat',
    effectConfig: {
      healAmount: input.healAmount ?? 5,
      curesStatus: false,
    },
    value: input.healAmount ?? 5,
    consumable: false,
    maxStack: 99,
    isActive: true,
    starterGrantAmount: 0,
  };
}

function createRuntimeHarness(input: {
  critters: CritterDefinition[];
  collection: PlayerCritterCollectionEntry[];
  squad?: Array<number | null>;
  items?: GameItemDefinition[];
}): any {
  const items = input.items ?? [];
  const runtime: any = Object.create(GameRuntime.prototype);
  runtime.critterDatabase = input.critters;
  runtime.critterLookup = input.critters.reduce<Record<number, CritterDefinition>>((registry, critter) => {
    registry[critter.id] = critter;
    return registry;
  }, {});
  runtime.playerCritterProgress = {
    version: PLAYER_CRITTER_PROGRESS_VERSION,
    unlockedSquadSlots: 8,
    squad: input.squad ?? [null, null, null, null, null, null, null, null],
    collection: input.collection,
    lockedKnockoutTargetCritterId: null,
  } as PlayerCritterProgress;
  runtime.itemDatabase = items;
  runtime.itemById = items.reduce<Record<string, GameItemDefinition>>((registry, item) => {
    registry[item.id] = item;
    return registry;
  }, {});
  runtime.playerItemInventory = {
    version: PLAYER_ITEM_INVENTORY_VERSION,
    entries: items.map((item) => ({ itemId: item.id, quantity: 1 })),
  };
  runtime.sideStoryMissions = {};
  runtime.flags = {};
  runtime.activeBattle = null;
  runtime.dialogue = null;
  runtime.healPrompt = null;
  runtime.shopPrompt = null;
  runtime.activeCutscene = null;
  runtime.starterSelection = null;
  runtime.activeScriptedScene = null;
  runtime.currentMapId = 'spawn';
  runtime.markProgressDirty = vi.fn();
  runtime.showMessage = vi.fn();
  runtime.isPlayerControlLocked = vi.fn(() => false);
  runtime.resolveEquipmentStateForCritter = vi.fn(() => ({ anchors: [] }));
  runtime.getEquipmentEffectsFromAnchors = vi.fn(() => []);
  runtime.applyEquipmentEffectsToStats = vi.fn((stats) => ({ ...stats }));
  runtime.resolveItemSuccessText = vi.fn((_item, fallback) => fallback);
  runtime.executeBattleSkill = vi.fn(() => ({ narrationEvents: [], defenderFainted: false }));
  runtime.startBattleNarration = vi.fn();
  runtime.resolveOpponentCounterAfterSwap = vi.fn();
  return runtime;
}

function readMissionProgress(
  progress: PlayerCritterProgress,
  critterId: number,
  level: number,
  missionId: string,
): number {
  const entry = progress.collection.find((item) => item.critterId === critterId);
  if (!entry) {
    return -1;
  }
  return entry.missionProgress[missionProgressKey(level, missionId)] ?? 0;
}

describe('GameRuntime mission action tracking', () => {
  it('increments Use Guard only on a successful guard', () => {
    const critter = createCritter({
      id: 1,
      name: 'Buddo',
      levels: [
        {
          level: 1,
          missions: [],
          requiredMissionCount: 0,
          unlockEquipSlots: 1,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
        {
          level: 2,
          missions: [{ id: 'guard-1', type: 'use_guard', targetValue: 3 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [createCollectionEntry(critter, { level: 1 })],
    });
    const player = {
      critterId: 1,
      name: 'Buddo',
      consecutiveSuccessfulGuardCount: 0,
    };
    const opponent = { critterId: 99, name: 'Enemy' };
    const battle = {
      phase: 'player-turn',
      result: 'ongoing',
      turnNumber: 0,
    };
    runtime.getActiveBattleCritter = vi.fn((_battle, side) => (side === 'player' ? player : opponent));
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
      (runtime as any).resolvePlayerTurnAction(battle, 'guard');
    } finally {
      randomSpy.mockRestore();
    }

    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'guard-1')).toBe(1);
  });

  it('does not increment Use Guard when guard fails', () => {
    const critter = createCritter({
      id: 1,
      name: 'Buddo',
      levels: [
        {
          level: 1,
          missions: [],
          requiredMissionCount: 0,
          unlockEquipSlots: 1,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
        {
          level: 2,
          missions: [{ id: 'guard-1', type: 'use_guard', targetValue: 3 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [createCollectionEntry(critter, { level: 1 })],
    });
    const player = {
      critterId: 1,
      name: 'Buddo',
      consecutiveSuccessfulGuardCount: 2,
    };
    const opponent = { critterId: 99, name: 'Enemy' };
    const battle = {
      phase: 'player-turn',
      result: 'ongoing',
      turnNumber: 0,
    };
    runtime.getActiveBattleCritter = vi.fn((_battle, side) => (side === 'player' ? player : opponent));
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    try {
      (runtime as any).resolvePlayerTurnAction(battle, 'guard');
    } finally {
      randomSpy.mockRestore();
    }

    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'guard-1')).toBe(0);
  });

  it('increments Swap In when a critter is swapped into battle', () => {
    const critterA = createCritter({
      id: 1,
      name: 'Frontliner',
      levels: [
        {
          level: 1,
          missions: [],
          requiredMissionCount: 0,
          unlockEquipSlots: 1,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const critterB = createCritter({
      id: 2,
      name: 'Switcher',
      levels: [
        {
          level: 1,
          missions: [],
          requiredMissionCount: 0,
          unlockEquipSlots: 1,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
        {
          level: 2,
          missions: [{ id: 'swap-1', type: 'swap_in', targetValue: 4 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const runtime = createRuntimeHarness({
      critters: [critterA, critterB],
      collection: [createCollectionEntry(critterA, { level: 1 }), createCollectionEntry(critterB, { level: 1 })],
      squad: [1, 2, null, null, null, null, null, null],
    });
    runtime.activeBattle = {
      phase: 'choose-swap',
      activeNarration: null,
      pendingForcedSwap: false,
      playerActiveIndex: 0,
      turnNumber: 0,
      playerTeam: [
        {
          slotIndex: 0,
          critterId: 1,
          name: 'Frontliner',
          currentHp: 20,
          fainted: false,
          consecutiveSuccessfulGuardCount: 0,
          attackModifier: 1,
          defenseModifier: 1,
          speedModifier: 1,
          activeEffectIds: [],
        },
        {
          slotIndex: 1,
          critterId: 2,
          name: 'Switcher',
          currentHp: 20,
          fainted: false,
          consecutiveSuccessfulGuardCount: 0,
          attackModifier: 1,
          defenseModifier: 1,
          speedModifier: 1,
          activeEffectIds: [],
        },
      ],
    };

    expect(runtime.battleSelectSquadSlot(1)).toBe(true);
    expect(readMissionProgress(runtime.playerCritterProgress, 2, 2, 'swap-1')).toBe(1);
  });

  it('increments Swap Out when a critter is swapped out of battle', () => {
    const critterA = createCritter({
      id: 1,
      name: 'Frontliner',
      levels: [
        {
          level: 1,
          missions: [],
          requiredMissionCount: 0,
          unlockEquipSlots: 1,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
        {
          level: 2,
          missions: [{ id: 'swap-out-1', type: 'swap_out', targetValue: 4 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const critterB = createCritter({
      id: 2,
      name: 'Switcher',
      levels: [
        {
          level: 1,
          missions: [],
          requiredMissionCount: 0,
          unlockEquipSlots: 1,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const runtime = createRuntimeHarness({
      critters: [critterA, critterB],
      collection: [createCollectionEntry(critterA, { level: 1 }), createCollectionEntry(critterB, { level: 1 })],
      squad: [1, 2, null, null, null, null, null, null],
    });
    runtime.activeBattle = {
      phase: 'choose-swap',
      activeNarration: null,
      pendingForcedSwap: false,
      playerActiveIndex: 0,
      turnNumber: 0,
      playerTeam: [
        {
          slotIndex: 0,
          critterId: 1,
          name: 'Frontliner',
          currentHp: 20,
          fainted: false,
          consecutiveSuccessfulGuardCount: 0,
          attackModifier: 1,
          defenseModifier: 1,
          speedModifier: 1,
          activeEffectIds: [],
        },
        {
          slotIndex: 1,
          critterId: 2,
          name: 'Switcher',
          currentHp: 20,
          fainted: false,
          consecutiveSuccessfulGuardCount: 0,
          attackModifier: 1,
          defenseModifier: 1,
          speedModifier: 1,
          activeEffectIds: [],
        },
      ],
    };

    expect(runtime.battleSelectSquadSlot(1)).toBe(true);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'swap-out-1')).toBe(1);
  });

  it('increments Heal Critter for a general healing-item mission', () => {
    const critter = createCritter({
      id: 1,
      name: 'Medic',
      levels: [
        {
          level: 1,
          missions: [],
          requiredMissionCount: 0,
          unlockEquipSlots: 1,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
        {
          level: 2,
          missions: [{ id: 'heal-1', type: 'heal_critter', targetValue: 2 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [createCollectionEntry(critter, { level: 1, currentHp: 10 })],
      squad: [1, null, null, null, null, null, null, null],
      items: [createHealingItem({ id: 'field-bandage', name: 'Field Bandage', healAmount: 5 })],
    });

    expect(runtime.useBackpackItemOnSquadSlot('field-bandage', 0)).toBe(true);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'heal-1')).toBe(1);
  });

  it('does not increment Heal Critter when the wrong healing item is used for a specific-item mission', () => {
    const critter = createCritter({
      id: 1,
      name: 'Medic',
      levels: [
        {
          level: 1,
          missions: [],
          requiredMissionCount: 0,
          unlockEquipSlots: 1,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
        {
          level: 2,
          missions: [
            {
              id: 'heal-1',
              type: 'heal_critter',
              targetValue: 2,
              requiredHealingItemIds: ['super-tonic'],
            },
          ],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [createCollectionEntry(critter, { level: 1, currentHp: 10 })],
      squad: [1, null, null, null, null, null, null, null],
      items: [
        createHealingItem({ id: 'field-bandage', name: 'Field Bandage', healAmount: 5 }),
        createHealingItem({ id: 'super-tonic', name: 'Super Tonic', healAmount: 8 }),
      ],
    });

    expect(runtime.useBackpackItemOnSquadSlot('field-bandage', 0)).toBe(true);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'heal-1')).toBe(0);
  });

  it('surfaces the three most recently tracked active missions in the critter summary', () => {
    const critters = [1, 2, 3, 4].map((id) =>
      createCritter({
        id,
        name: `Tracker ${id}`,
        levels: [
          {
            level: 1,
            missions: [],
            requiredMissionCount: 0,
            unlockEquipSlots: 1,
            statDelta: { ...EMPTY_STATS },
            abilityUnlockIds: [],
            skillUnlockIds: [],
          },
          {
            level: 2,
            missions: [{ id: 'ko-1', type: 'opposing_knockouts', targetValue: 5 }],
            requiredMissionCount: 1,
            unlockEquipSlots: 0,
            statDelta: { ...EMPTY_STATS },
            abilityUnlockIds: [],
            skillUnlockIds: [],
          },
        ],
      }),
    );
    const runtime = createRuntimeHarness({
      critters,
      collection: critters.map((critter) => createCollectionEntry(critter, { level: 1 })),
    });
    runtime.ensureLockedKnockoutTargetSelectionValid = vi.fn(() => false);
    runtime.getEligibleLockedKnockoutTargetCritterIds = vi.fn(() => []);
    runtime.resolveEquippedSkillSlotsForSnapshot = vi.fn(() => [null, null, null, null]);
    runtime.getCompletedMissionCount = vi.fn(() => 0);
    runtime.sideStoryMissions = {
      'critter-1-level-2-mission-ko-1': {
        progress: 1,
        target: 5,
        completed: false,
        updatedAt: '2026-03-03T08:00:00.000Z',
      },
      'critter-2-level-2-mission-ko-1': {
        progress: 2,
        target: 5,
        completed: false,
        updatedAt: '2026-03-03T11:00:00.000Z',
      },
      'critter-3-level-2-mission-ko-1': {
        progress: 3,
        target: 5,
        completed: false,
        updatedAt: '2026-03-03T07:30:00.000Z',
      },
      'critter-4-level-2-mission-ko-1': {
        progress: 4,
        target: 5,
        completed: false,
        updatedAt: '2026-03-03T09:15:00.000Z',
      },
    };

    const summary = runtime.getCritterSummary();

    expect(summary.recentTrackedMissions).toHaveLength(3);
    expect(summary.recentTrackedMissions.map((mission: any) => mission.critterId)).toEqual([2, 4, 1]);
    expect(summary.recentTrackedMissions[0]).toMatchObject({
      critterName: 'Tracker 2',
      currentValue: 2,
      targetValue: 5,
    });
  });
});
