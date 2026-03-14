import { describe, expect, it } from 'vitest';
import {
  sanitizeCritterDefinition,
  sanitizePlayerCritterProgress,
} from '@/game/critters/schema';
import type { CritterDefinition } from '@/game/critters/types';

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
    baseStats: { hp: 20, attack: 10, defense: 8, speed: 7 },
    abilities: [{ id: 'legacy-local', name: 'Legacy Local', kind: 'passive', description: '' }],
    levels: [
      {
        level: 1,
        missions: [],
        requiredMissionCount: 0,
        statDelta: { ...EMPTY_STATS },
        unlockEquipSlots: 1,
        abilityUnlockIds: ['global-guard'],
        skillUnlockIds: [],
      },
    ],
  };
}

describe('critter ability progress', () => {
  it('filters level-row unlocks against the global ability catalog when provided', () => {
    const critter = sanitizeCritterDefinition(
      {
        ...createCritter(),
        levels: [
          {
            level: 1,
            missions: [],
            requiredMissionCount: 0,
            statDelta: { ...EMPTY_STATS },
            unlockEquipSlots: 1,
            abilityUnlockIds: ['global-guard', 'legacy-local', 'missing'],
            skillUnlockIds: [],
          },
        ],
      },
      0,
      { allowedAbilityIds: ['global-guard'] },
    );

    expect(critter?.levels[0]?.abilityUnlockIds).toEqual(['global-guard']);
  });

  it('backfills missing equippedAbilityId and clears stale equipped ids during save migration', () => {
    const critter = createCritter();
    const migrated = sanitizePlayerCritterProgress(
      {
        version: 9,
        unlockedSquadSlots: 2,
        squad: [1, null, null, null, null, null, null, null],
        collection: [
          {
            critterId: 1,
            unlocked: true,
            level: 1,
            currentHp: 20,
            missionProgress: {},
            equippedSkillIds: [null, null, null, null],
            equippedEquipmentAnchors: [],
          },
        ],
      },
      [critter],
    );
    expect(migrated.collection[0]?.equippedAbilityId).toBeNull();

    const stale = sanitizePlayerCritterProgress(
      {
        version: 9,
        unlockedSquadSlots: 2,
        squad: [1, null, null, null, null, null, null, null],
        collection: [
          {
            critterId: 1,
            unlocked: true,
            level: 1,
            currentHp: 20,
            missionProgress: {},
            equippedAbilityId: 'missing-ability',
            equippedSkillIds: [null, null, null, null],
            equippedEquipmentAnchors: [],
          },
        ],
      },
      [critter],
    );
    expect(stale.collection[0]?.equippedAbilityId).toBeNull();
  });
});
