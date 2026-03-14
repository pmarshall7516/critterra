import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import type { CritterDefinition, PlayerCritterCollectionEntry, PlayerCritterProgress } from '@/game/critters/types';
import { PLAYER_CRITTER_PROGRESS_VERSION } from '@/game/critters/types';

const EMPTY_STATS = {
  hp: 0,
  attack: 0,
  defense: 0,
  speed: 0,
} as const;

function createCritter(): CritterDefinition {
  return {
    id: 1,
    name: 'Buddo',
    element: 'bloom',
    rarity: 'common',
    description: '',
    spriteUrl: '',
    baseStats: { hp: 24, attack: 10, defense: 8, speed: 7 },
    abilities: [],
    levels: [
      {
        level: 1,
        missions: [],
        requiredMissionCount: 0,
        statDelta: { ...EMPTY_STATS },
        unlockEquipSlots: 1,
        abilityUnlockIds: [],
        skillUnlockIds: ['tackle'],
      },
      {
        level: 2,
        missions: [],
        requiredMissionCount: 0,
        statDelta: { ...EMPTY_STATS },
        unlockEquipSlots: 0,
        abilityUnlockIds: [],
        skillUnlockIds: ['vine-whip'],
      },
    ],
  };
}

function createProgressEntry(
  overrides?: Partial<PlayerCritterCollectionEntry>,
): PlayerCritterCollectionEntry {
  return {
    critterId: 1,
    unlocked: true,
    seen: true,
    unlockedAt: null,
    unlockSource: 'missions',
    level: 1,
    currentHp: 12,
    missionProgress: {},
    statBonus: { ...EMPTY_STATS },
    effectiveStats: { hp: 24, attack: 10, defense: 8, speed: 7 },
    unlockedAbilityIds: [],
    equippedAbilityId: null,
    equippedSkillIds: ['tackle', null, null, null],
    equippedEquipmentAnchors: [],
    lastProgressAt: null,
    ...overrides,
  };
}

function createRuntime(progressEntry: PlayerCritterCollectionEntry): any {
  const critter = createCritter();
  const runtime: any = Object.create(GameRuntime.prototype);
  runtime.critterLookup = { [critter.id]: critter };
  runtime.playerCritterProgress = {
    version: PLAYER_CRITTER_PROGRESS_VERSION,
    unlockedSquadSlots: 8,
    squad: [critter.id, null, null, null, null, null, null, null],
    collection: [progressEntry],
    lockedKnockoutTargetCritterId: null,
    lockedDamageTargetCritterId: null,
  } as PlayerCritterProgress;
  runtime.resolveEquipmentStateForCritter = vi.fn(() => ({ anchors: [], slots: [] }));
  runtime.getEquipmentEffectsFromAnchors = vi.fn(() => []);
  runtime.applyEquipmentEffectsToStats = vi.fn((stats) => ({ ...stats }));
  runtime.tryAutoAssignFirstUnlockedCritter = vi.fn(() => false);
  runtime.ensureLockedKnockoutTargetSelectionValid = vi.fn();
  runtime.markProgressDirty = vi.fn();
  runtime.showMessage = vi.fn();
  runtime.flags = {};
  return runtime;
}

describe('GameRuntime tryAdvanceCritter', () => {
  it('auto-equips newly unlocked skills into the first open slot when leveling up', () => {
    const progress = createProgressEntry();
    const runtime = createRuntime(progress);

    expect(runtime.tryAdvanceCritter(1)).toBe(true);
    expect(progress.level).toBe(2);
    expect(progress.equippedSkillIds).toEqual(['tackle', 'vine-whip', null, null]);
  });

  it('does not replace existing equipped skills when all four slots are already full', () => {
    const progress = createProgressEntry({
      equippedSkillIds: ['tackle', 'jab', 'guard', 'gust'],
    });
    const runtime = createRuntime(progress);

    expect(runtime.tryAdvanceCritter(1)).toBe(true);
    expect(progress.equippedSkillIds).toEqual(['tackle', 'jab', 'guard', 'gust']);
  });
});
