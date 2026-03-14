import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import { missionProgressKey } from '@/game/critters/schema';
import type { CritterDefinition, PlayerCritterCollectionEntry, PlayerCritterProgress } from '@/game/critters/types';
import { PLAYER_CRITTER_PROGRESS_VERSION } from '@/game/critters/types';
import type { GameItemDefinition } from '@/game/items/types';

const EMPTY_STAT_DELTA = {
  hp: 0,
  attack: 0,
  defense: 0,
  speed: 0,
};

function createCritter(input: {
  id: number;
  name: string;
  element?: CritterDefinition['element'];
  levels: CritterDefinition['levels'];
}): CritterDefinition {
  return {
    id: input.id,
    name: input.name,
    element: input.element ?? 'bloom',
    rarity: 'common',
    description: '',
    spriteUrl: '',
    baseStats: {
      hp: 10,
      attack: 10,
      defense: 10,
      speed: 10,
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
  input: {
    unlocked: boolean;
    level: number;
    seen?: boolean;
    equippedEquipmentAnchors?: PlayerCritterCollectionEntry['equippedEquipmentAnchors'];
  },
): PlayerCritterCollectionEntry {
  return {
    critterId: critter.id,
    unlocked: input.unlocked,
    seen: input.seen ?? input.unlocked,
    unlockedAt: input.unlocked ? new Date().toISOString() : null,
    unlockSource: input.unlocked ? 'missions' : null,
    level: input.level,
    currentHp: input.unlocked ? critter.baseStats.hp : 0,
    missionProgress: buildMissionProgressTemplate(critter),
    statBonus: { ...EMPTY_STAT_DELTA },
    effectiveStats: { ...critter.baseStats },
    unlockedAbilityIds: [],
    equippedAbilityId: null,
    equippedSkillIds: [null, null, null, null],
    equippedEquipmentAnchors: input.equippedEquipmentAnchors ?? [],
    lastProgressAt: null,
  };
}

function createRuntimeHarness(input: {
  critters: CritterDefinition[];
  progress: PlayerCritterProgress;
  items?: GameItemDefinition[];
}) {
  const items = input.items ?? [];
  const runtime = Object.create(GameRuntime.prototype) as any;
  runtime.critterDatabase = input.critters;
  runtime.critterLookup = input.critters.reduce<Record<number, CritterDefinition>>((registry, critter) => {
    registry[critter.id] = critter;
    return registry;
  }, {});
  runtime.playerCritterProgress = input.progress;
  runtime.itemDatabase = items;
  runtime.itemById = items.reduce<Record<string, GameItemDefinition>>((registry, item) => {
    registry[item.id] = item;
    return registry;
  }, {});
  runtime.sideStoryMissions = {};
  runtime.flags = {};
  runtime.markProgressDirty = vi.fn();
  runtime.showMessage = vi.fn();
  return runtime;
}

function createEquipmentItem(id: string, name: string): GameItemDefinition {
  return {
    id,
    name,
    category: 'equipment',
    description: '',
    imageUrl: '',
    misuseText: '',
    successText: '',
    effectType: 'equip_effect',
    effectConfig: {
      equipSize: 1,
      equipmentEffectIds: [],
    },
    consumable: false,
    maxStack: 99,
    isActive: true,
    starterGrantAmount: 0,
  };
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

describe('GameRuntime knockout mission targeting', () => {
  it('credits attacker only when no locked target is selected', () => {
    const attacker = createCritter({
      id: 1,
      name: 'Attacker',
      levels: [
        {
          level: 2,
          missions: [{ id: 'attacker-ko', type: 'opposing_knockouts', targetValue: 5 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const lockedA = createCritter({
      id: 2,
      name: 'Locked A',
      levels: [
        {
          level: 1,
          missions: [{ id: 'locked-a-ko', type: 'opposing_knockouts', targetValue: 5 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const lockedB = createCritter({
      id: 3,
      name: 'Locked B',
      levels: [
        {
          level: 1,
          missions: [{ id: 'locked-b-ko', type: 'opposing_knockouts', targetValue: 5 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const opponent = createCritter({ id: 99, name: 'Opponent', element: 'ember', levels: [] });
    const progress: PlayerCritterProgress = {
      version: PLAYER_CRITTER_PROGRESS_VERSION,
      unlockedSquadSlots: 2,
      squad: [1, null, null, null, null, null, null, null],
      collection: [
        createCollectionEntry(attacker, { unlocked: true, level: 1 }),
        createCollectionEntry(lockedA, { unlocked: false, level: 0 }),
        createCollectionEntry(lockedB, { unlocked: false, level: 0 }),
      ],
      lockedKnockoutTargetCritterId: null,
    lockedDamageTargetCritterId: null,
    };
    const runtime = createRuntimeHarness({
      critters: [attacker, lockedA, lockedB, opponent],
      progress,
    });

    runtime.recordOpposingKnockoutProgress(99, 1);

    expect(readMissionProgress(progress, 1, 2, 'attacker-ko')).toBe(1);
    expect(readMissionProgress(progress, 2, 1, 'locked-a-ko')).toBe(0);
    expect(readMissionProgress(progress, 3, 1, 'locked-b-ko')).toBe(0);
  });

  it('credits both attacker and selected locked target when missions match', () => {
    const attacker = createCritter({
      id: 1,
      name: 'Attacker',
      levels: [
        {
          level: 2,
          missions: [{ id: 'attacker-ko', type: 'opposing_knockouts', targetValue: 5 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const lockedTarget = createCritter({
      id: 2,
      name: 'Locked Target',
      levels: [
        {
          level: 1,
          missions: [{ id: 'locked-target-ko', type: 'opposing_knockouts', targetValue: 5 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const otherLocked = createCritter({
      id: 3,
      name: 'Other Locked',
      levels: [
        {
          level: 1,
          missions: [{ id: 'other-locked-ko', type: 'opposing_knockouts', targetValue: 5 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const opponent = createCritter({ id: 99, name: 'Opponent', element: 'ember', levels: [] });
    const progress: PlayerCritterProgress = {
      version: PLAYER_CRITTER_PROGRESS_VERSION,
      unlockedSquadSlots: 2,
      squad: [1, null, null, null, null, null, null, null],
      collection: [
        createCollectionEntry(attacker, { unlocked: true, level: 1 }),
        createCollectionEntry(lockedTarget, { unlocked: false, level: 0, seen: true }),
        createCollectionEntry(otherLocked, { unlocked: false, level: 0, seen: true }),
      ],
      lockedKnockoutTargetCritterId: 2,
      lockedDamageTargetCritterId: null,
    };
    const runtime = createRuntimeHarness({
      critters: [attacker, lockedTarget, otherLocked, opponent],
      progress,
    });

    runtime.recordOpposingKnockoutProgress(99, 1);

    expect(readMissionProgress(progress, 1, 2, 'attacker-ko')).toBe(1);
    expect(readMissionProgress(progress, 2, 1, 'locked-target-ko')).toBe(1);
    expect(readMissionProgress(progress, 3, 1, 'other-locked-ko')).toBe(0);
  });

  it('does not credit locked critters when no target is selected', () => {
    const attacker = createCritter({
      id: 1,
      name: 'Attacker',
      levels: [
        {
          level: 2,
          missions: [{ id: 'attacker-ko', type: 'opposing_knockouts', targetValue: 5 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const lockedTarget = createCritter({
      id: 2,
      name: 'Locked Target',
      levels: [
        {
          level: 1,
          missions: [{ id: 'locked-target-ko', type: 'opposing_knockouts', targetValue: 5 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const opponent = createCritter({ id: 99, name: 'Opponent', element: 'ember', levels: [] });
    const progress: PlayerCritterProgress = {
      version: PLAYER_CRITTER_PROGRESS_VERSION,
      unlockedSquadSlots: 2,
      squad: [1, null, null, null, null, null, null, null],
      collection: [
        createCollectionEntry(attacker, { unlocked: true, level: 1 }),
        createCollectionEntry(lockedTarget, { unlocked: false, level: 0, seen: true }),
      ],
      lockedKnockoutTargetCritterId: null,
    lockedDamageTargetCritterId: null,
    };
    const runtime = createRuntimeHarness({
      critters: [attacker, lockedTarget, opponent],
      progress,
    });

    runtime.recordOpposingKnockoutProgress(99, 1);

    expect(readMissionProgress(progress, 2, 1, 'locked-target-ko')).toBe(0);
  });

  it('auto-clears selected locked target when it becomes invalid', () => {
    const attacker = createCritter({
      id: 1,
      name: 'Attacker',
      levels: [
        {
          level: 2,
          missions: [{ id: 'attacker-ko', type: 'opposing_knockouts', targetValue: 5 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const unlockedTarget = createCritter({
      id: 2,
      name: 'Unlocked Target',
      levels: [
        {
          level: 2,
          missions: [{ id: 'unused', type: 'opposing_knockouts', targetValue: 5 }],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const opponent = createCritter({ id: 99, name: 'Opponent', element: 'ember', levels: [] });
    const progress: PlayerCritterProgress = {
      version: PLAYER_CRITTER_PROGRESS_VERSION,
      unlockedSquadSlots: 2,
      squad: [1, null, null, null, null, null, null, null],
      collection: [
        createCollectionEntry(attacker, { unlocked: true, level: 1 }),
        createCollectionEntry(unlockedTarget, { unlocked: true, level: 1 }),
      ],
      lockedKnockoutTargetCritterId: 2,
      lockedDamageTargetCritterId: null,
    };
    const runtime = createRuntimeHarness({
      critters: [attacker, unlockedTarget, opponent],
      progress,
    });

    runtime.recordOpposingKnockoutProgress(99, 1);

    expect(progress.lockedKnockoutTargetCritterId).toBeNull();
  });

  it('credits knockout-with-item missions when the attacker meets the equipped item requirements', () => {
    const attacker = createCritter({
      id: 1,
      name: 'Attacker',
      levels: [
        {
          level: 1,
          missions: [],
          requiredMissionCount: 0,
          unlockEquipSlots: 2,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
        {
          level: 2,
          missions: [
            {
              id: 'item-ko',
              type: 'opposing_knockouts_with_item',
              targetValue: 5,
              requiredEquippedItemCount: 2,
              requiredEquippedItemIds: ['trainer-charm'],
            },
          ],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const opponent = createCritter({ id: 99, name: 'Opponent', element: 'ember', levels: [] });
    const progress: PlayerCritterProgress = {
      version: PLAYER_CRITTER_PROGRESS_VERSION,
      unlockedSquadSlots: 2,
      squad: [1, null, null, null, null, null, null, null],
      collection: [
        createCollectionEntry(attacker, {
          unlocked: true,
          level: 1,
          equippedEquipmentAnchors: [
            { itemId: 'trainer-charm', slotIndex: 0 },
            { itemId: 'battle-ribbon', slotIndex: 1 },
          ],
        }),
      ],
      lockedKnockoutTargetCritterId: null,
    lockedDamageTargetCritterId: null,
    };
    const runtime = createRuntimeHarness({
      critters: [attacker, opponent],
      progress,
      items: [
        createEquipmentItem('trainer-charm', 'Trainer Charm'),
        createEquipmentItem('battle-ribbon', 'Battle Ribbon'),
      ],
    });

    runtime.recordOpposingKnockoutProgress(99, 1);

    expect(readMissionProgress(progress, 1, 2, 'item-ko')).toBe(1);
  });

  it('does not credit knockout-with-item missions when the attacker lacks the required equipment setup', () => {
    const attacker = createCritter({
      id: 1,
      name: 'Attacker',
      levels: [
        {
          level: 1,
          missions: [],
          requiredMissionCount: 0,
          unlockEquipSlots: 2,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
        {
          level: 2,
          missions: [
            {
              id: 'item-ko',
              type: 'opposing_knockouts_with_item',
              targetValue: 5,
              requiredEquippedItemCount: 2,
              requiredEquippedItemIds: ['trainer-charm'],
            },
          ],
          requiredMissionCount: 1,
          unlockEquipSlots: 0,
          statDelta: { ...EMPTY_STAT_DELTA },
          abilityUnlockIds: [],
          skillUnlockIds: [],
        },
      ],
    });
    const opponent = createCritter({ id: 99, name: 'Opponent', element: 'ember', levels: [] });
    const progress: PlayerCritterProgress = {
      version: PLAYER_CRITTER_PROGRESS_VERSION,
      unlockedSquadSlots: 2,
      squad: [1, null, null, null, null, null, null, null],
      collection: [
        createCollectionEntry(attacker, {
          unlocked: true,
          level: 1,
          equippedEquipmentAnchors: [{ itemId: 'battle-ribbon', slotIndex: 0 }],
        }),
      ],
      lockedKnockoutTargetCritterId: null,
    lockedDamageTargetCritterId: null,
    };
    const runtime = createRuntimeHarness({
      critters: [attacker, opponent],
      progress,
      items: [
        createEquipmentItem('trainer-charm', 'Trainer Charm'),
        createEquipmentItem('battle-ribbon', 'Battle Ribbon'),
      ],
    });

    runtime.recordOpposingKnockoutProgress(99, 1);

    expect(readMissionProgress(progress, 1, 2, 'item-ko')).toBe(0);
  });
});
