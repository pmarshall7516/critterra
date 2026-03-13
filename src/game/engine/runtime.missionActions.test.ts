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
    seen: input?.seen ?? input?.unlocked ?? true,
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
    lockedDamageTargetCritterId: null,
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

  it('advances heal_with_skills mission by heal amount when player heals via skill', () => {
    const critter = createCritter({
      id: 1,
      name: 'Healer',
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
          missions: [{ id: 'heal-skills-1', type: 'heal_with_skills', targetValue: 50 }],
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
    (runtime as any).advanceHealWithSkillsMissions(1, 10);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'heal-skills-1')).toBe(10);
    (runtime as any).advanceHealWithSkillsMissions(1, 15);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'heal-skills-1')).toBe(25);
  });

  it('advances land_critical_hits mission when player lands a critical hit', () => {
    const critter = createCritter({
      id: 1,
      name: 'Sniper',
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
          missions: [{ id: 'crits-1', type: 'land_critical_hits', targetValue: 5 }],
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
    (runtime as any).advanceLandCriticalHitsMissions(1, 1);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'crits-1')).toBe(1);
    (runtime as any).advanceLandCriticalHitsMissions(1, 1);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'crits-1')).toBe(2);
  });

  it('advances use_skill mission in any mode for any skill use', () => {
    const critter = createCritter({
      id: 1,
      name: 'Skill User',
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
          missions: [{ id: 'use-any-1', type: 'use_skill', targetValue: 3, useSkillMode: 'any' }],
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
    (runtime as any).advanceUseSkillMissions(1, 'tackle', 'normal');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'use-any-1')).toBe(1);
    (runtime as any).advanceUseSkillMissions(1, 'vine-whip', 'bloom');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'use-any-1')).toBe(2);
  });

  it('advances use_skill mission in element mode only when element matches', () => {
    const critter = createCritter({
      id: 1,
      name: 'Bloom User',
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
              id: 'use-bloom-1',
              type: 'use_skill',
              targetValue: 2,
              useSkillMode: 'element',
              useSkillElements: ['bloom', 'ember'],
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
      collection: [createCollectionEntry(critter, { level: 1 })],
    });
    (runtime as any).advanceUseSkillMissions(1, 'vine-whip', 'bloom');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'use-bloom-1')).toBe(1);
    (runtime as any).advanceUseSkillMissions(1, 'tackle', 'normal');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'use-bloom-1')).toBe(1);
    (runtime as any).advanceUseSkillMissions(1, 'ember-shot', 'ember');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'use-bloom-1')).toBe(2);
  });

  it('advances use_skill mission in specific mode only when skillId in list', () => {
    const critter = createCritter({
      id: 1,
      name: 'Tackle User',
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
              id: 'use-tackle-1',
              type: 'use_skill',
              targetValue: 2,
              useSkillMode: 'specific',
              useSkillIds: ['tackle', 'vine-whip'],
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
      collection: [createCollectionEntry(critter, { level: 1 })],
    });
    (runtime as any).advanceUseSkillMissions(1, 'tackle', 'normal');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'use-tackle-1')).toBe(1);
    (runtime as any).advanceUseSkillMissions(1, 'ember-shot', 'ember');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'use-tackle-1')).toBe(1);
    (runtime as any).advanceUseSkillMissions(1, 'vine-whip', 'bloom');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'use-tackle-1')).toBe(2);
  });

  it('does not advance use_skill for locked critters', () => {
    const critter = createCritter({
      id: 1,
      name: 'Locked',
      levels: [
        {
          level: 1,
          missions: [{ id: 'use-1', type: 'use_skill', targetValue: 1, useSkillMode: 'any' }],
          requiredMissionCount: 0,
          unlockEquipSlots: 1,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [createCollectionEntry(critter, { unlocked: false, level: 0 })],
    });
    (runtime as any).advanceUseSkillMissions(1, 'tackle', 'normal');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 1, 'use-1')).toBe(0);
  });

  it('recordDealDamageProgress credits attacker and caps at targetValue', () => {
    const critter = createCritter({
      id: 1,
      name: 'Brawler',
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
            { id: 'deal-1', type: 'deal_damage', targetValue: 100 },
            {
              id: 'deal-bloom',
              type: 'deal_damage',
              targetValue: 50,
              dealDamageMode: 'element',
              dealDamageElements: ['bloom'],
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
      collection: [createCollectionEntry(critter, { level: 1 })],
    });
    (runtime as any).recordDealDamageProgress(1, 50, 'skill', 'ember');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'deal-1')).toBe(50);
    // Ember damage does not match the bloom element filter.
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'deal-bloom')).toBe(0);
    (runtime as any).recordDealDamageProgress(1, 60, 'skill', 'bloom');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'deal-1')).toBe(100);
    // Remaining damage after capping generic mission is applied to the element-filtered mission.
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'deal-bloom')).toBe(10);
  });

  it('recordDealDamageProgress credits locked damage target when set', () => {
    const critterA = createCritter({
      id: 1,
      name: 'Attacker',
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
          missions: [{ id: 'deal-1', type: 'deal_damage', targetValue: 200 }],
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
      name: 'Tracker',
      levels: [
        {
          level: 1,
          missions: [{ id: 'deal-l1', type: 'deal_damage', targetValue: 150 }],
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
      collection: [
        createCollectionEntry(critterA, { level: 1 }),
        createCollectionEntry(critterB, { unlocked: false, level: 0, seen: true }),
      ],
    });
    runtime.playerCritterProgress.lockedDamageTargetCritterId = 2;
    (runtime as any).recordDealDamageProgress(1, 100, 'skill', 'normal');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'deal-1')).toBe(100);
    expect(readMissionProgress(runtime.playerCritterProgress, 2, 1, 'deal-l1')).toBe(100);
    (runtime as any).recordDealDamageProgress(1, 80, 'skill', 'normal');
    expect(readMissionProgress(runtime.playerCritterProgress, 2, 1, 'deal-l1')).toBe(150);
  });

  it('switching KO tracking clears any existing locked damage target', () => {
    const knockoutCritter = createCritter({
      id: 1,
      name: 'KO Tracker',
      levels: [
        {
          level: 1,
          missions: [{ id: 'ko-1', type: 'opposing_knockouts', targetValue: 3 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const damageCritter = createCritter({
      id: 2,
      name: 'Damage Tracker',
      levels: [
        {
          level: 1,
          missions: [{ id: 'deal-1', type: 'deal_damage', targetValue: 100 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const runtime = createRuntimeHarness({
      critters: [knockoutCritter, damageCritter],
      collection: [
        createCollectionEntry(knockoutCritter, { unlocked: false, level: 0, seen: true }),
        createCollectionEntry(damageCritter, { unlocked: false, level: 0, seen: true }),
      ],
    });

    runtime.playerCritterProgress.lockedDamageTargetCritterId = 2;

    expect(runtime.setLockedKnockoutTargetCritter(1)).toBe(true);
    expect(runtime.playerCritterProgress.lockedKnockoutTargetCritterId).toBe(1);
    expect(runtime.playerCritterProgress.lockedDamageTargetCritterId).toBeNull();
  });

  it('switching damage tracking clears any existing locked KO target', () => {
    const knockoutCritter = createCritter({
      id: 1,
      name: 'KO Tracker',
      levels: [
        {
          level: 1,
          missions: [{ id: 'ko-1', type: 'opposing_knockouts', targetValue: 3 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const damageCritter = createCritter({
      id: 2,
      name: 'Damage Tracker',
      levels: [
        {
          level: 1,
          missions: [{ id: 'deal-1', type: 'deal_damage', targetValue: 100 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const runtime = createRuntimeHarness({
      critters: [knockoutCritter, damageCritter],
      collection: [
        createCollectionEntry(knockoutCritter, { unlocked: false, level: 0, seen: true }),
        createCollectionEntry(damageCritter, { unlocked: false, level: 0, seen: true }),
      ],
    });

    runtime.playerCritterProgress.lockedKnockoutTargetCritterId = 1;

    expect(runtime.setLockedDamageTargetCritter(2)).toBe(true);
    expect(runtime.playerCritterProgress.lockedKnockoutTargetCritterId).toBeNull();
    expect(runtime.playerCritterProgress.lockedDamageTargetCritterId).toBe(2);
  });

  it('clears both trackers when a legacy conflicting selection reaches the critter summary', () => {
    const knockoutCritter = createCritter({
      id: 1,
      name: 'KO Tracker',
      levels: [
        {
          level: 1,
          missions: [{ id: 'ko-1', type: 'opposing_knockouts', targetValue: 3 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const damageCritter = createCritter({
      id: 2,
      name: 'Damage Tracker',
      levels: [
        {
          level: 1,
          missions: [{ id: 'deal-1', type: 'deal_damage', targetValue: 100 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STATS },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const runtime = createRuntimeHarness({
      critters: [knockoutCritter, damageCritter],
      collection: [
        createCollectionEntry(knockoutCritter, { unlocked: false, level: 0, seen: true }),
        createCollectionEntry(damageCritter, { unlocked: false, level: 0, seen: true }),
      ],
    });
    runtime.playerCritterProgress.lockedKnockoutTargetCritterId = 1;
    runtime.playerCritterProgress.lockedDamageTargetCritterId = 2;
    runtime.resolveEquippedSkillSlotsForSnapshot = vi.fn(() => [null, null, null, null]);
    runtime.getCompletedMissionCount = vi.fn(() => 0);

    const summary = runtime.getCritterSummary();

    expect(summary.lockedKnockoutTracker.selectedCritterId).toBeNull();
    expect(summary.lockedDamageTracker.selectedCritterId).toBeNull();
    expect(runtime.playerCritterProgress.lockedKnockoutTargetCritterId).toBeNull();
    expect(runtime.playerCritterProgress.lockedDamageTargetCritterId).toBeNull();
    expect(runtime.markProgressDirty).toHaveBeenCalled();
  });

  it('recordDealDamageProgress ignores non-skill damage sources', () => {
    const critter = createCritter({
      id: 1,
      name: 'Tracker',
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
          missions: [{ id: 'deal-1', type: 'deal_damage', targetValue: 100 }],
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
    (runtime as any).recordDealDamageProgress(1, 50);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'deal-1')).toBe(0);
    (runtime as any).recordDealDamageProgress(1, 50, 'skill', 'normal');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'deal-1')).toBe(50);
  });

  it('advances effect_buffed_actions mission for damage dealt while effect is active', () => {
    const critter = createCritter({
      id: 1,
      name: 'Buffer',
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
              id: 'buffed-deal-1',
              type: 'effect_buffed_actions',
              targetValue: 100,
              effectTemplateId: 'atk_buff',
              effectBuffMode: 'deal_damage',
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
      collection: [createCollectionEntry(critter, { level: 1 })],
    });
    (runtime as any).hasAnySkillEffectTemplateActive = vi.fn(() => true);
    (runtime as any).recordEffectBuffedDealDamageProgress(1, 60);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'buffed-deal-1')).toBe(60);
    (runtime as any).recordEffectBuffedDealDamageProgress(1, 60);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'buffed-deal-1')).toBe(100);
  });

  it('advances effect_buffed_actions mission for damage absorbed while effect is active', () => {
    const critter = createCritter({
      id: 1,
      name: 'Wall',
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
              id: 'buffed-tank-1',
              type: 'effect_buffed_actions',
              targetValue: 80,
              effectTemplateId: 'def_buff',
              effectBuffMode: 'damage_absorbed',
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
      collection: [createCollectionEntry(critter, { level: 1 })],
    });
    (runtime as any).hasAnySkillEffectTemplateActive = vi.fn(() => true);
    (runtime as any).recordDamageTakenWhileBuffedProgress(1, 50);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'buffed-tank-1')).toBe(50);
    (runtime as any).recordDamageTakenWhileBuffedProgress(1, 50);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'buffed-tank-1')).toBe(80);
  });

  it('advances absorb_damage mission in damage mode when critter takes damage', () => {
    const critter = createCritter({
      id: 1,
      name: 'Punching Bag',
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
              id: 'absorb-dmg-1',
              type: 'absorb_damage',
              targetValue: 100,
              absorbMode: 'damage',
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
      collection: [createCollectionEntry(critter, { level: 1 })],
    });
    (runtime as any).recordAbsorbDamageProgress(1, 40);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'absorb-dmg-1')).toBe(40);
    (runtime as any).recordAbsorbDamageProgress(1, 80);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'absorb-dmg-1')).toBe(100);
  });

  it('advances absorb_damage mission in knockout mode when critter faints', () => {
    const critter = createCritter({
      id: 1,
      name: 'Glass Cannon',
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
              id: 'absorb-ko-1',
              type: 'absorb_damage',
              targetValue: 2,
              absorbMode: 'knockout',
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
      collection: [createCollectionEntry(critter, { level: 1 })],
    });
    (runtime as any).recordSelfKnockoutProgress(1);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'absorb-ko-1')).toBe(1);
    (runtime as any).recordSelfKnockoutProgress(1);
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'absorb-ko-1')).toBe(2);
  });

  it('advances absorb_damage mission in element mode only for matching skill element damage', () => {
    const critter = createCritter({
      id: 1,
      name: 'Element Tank',
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
              id: 'absorb-ember',
              type: 'absorb_damage',
              targetValue: 90,
              absorbMode: 'element',
              absorbDamageElements: ['ember', 'bloom'],
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
      collection: [createCollectionEntry(critter, { level: 1 })],
    });
    (runtime as any).recordAbsorbDamageProgress(1, 40, 'skill', 'tide');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'absorb-ember')).toBe(0);
    (runtime as any).recordAbsorbDamageProgress(1, 40, 'skill', 'ember');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'absorb-ember')).toBe(40);
    (runtime as any).recordAbsorbDamageProgress(1, 60, 'skill', 'bloom');
    expect(readMissionProgress(runtime.playerCritterProgress, 1, 2, 'absorb-ember')).toBe(90);
  });
});
