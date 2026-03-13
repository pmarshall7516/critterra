import { describe, expect, it } from 'vitest';
import {
  createDefaultPlayerCritterProgress,
  sanitizeCritterDefinition,
  sanitizePlayerCritterProgress,
} from '@/game/critters/schema';
import { BASE_CRITTER_DATABASE } from '@/game/critters/baseDatabase';

describe('sanitizeCritterDefinition', () => {
  it('maps legacy pay mission type aliases to pay_item', () => {
    const critter = sanitizeCritterDefinition({
      id: 999,
      name: 'Legacy Paymon',
      element: 'bloom',
      rarity: 'common',
      description: '',
      spriteUrl: '',
      baseStats: {
        hp: 12,
        attack: 8,
        defense: 8,
        speed: 8,
      },
      abilities: [],
      levels: [
        {
          level: 1,
          requiredMissionCount: 1,
          unlockEquipSlots: 1,
          statDelta: {
            hp: 0,
            attack: 0,
            defense: 0,
            speed: 0,
          },
          abilityUnlockIds: [],
          skillUnlockIds: [],
          missions: [
            {
              id: 'pay-lume',
              type: 'pay',
              targetValue: 50,
              requiredPaymentItemId: 'lume',
            },
          ],
        },
      ],
    });

    expect(critter).not.toBeNull();
    expect(critter?.levels[0]?.missions[0]).toMatchObject({
      type: 'pay_item',
      requiredPaymentItemId: 'lume',
      targetValue: 50,
    });
  });

  it('accepts heal_with_skills and land_critical_hits mission types with targetValue', () => {
    const critter = sanitizeCritterDefinition({
      id: 100,
      name: 'Mission Test',
      element: 'bloom',
      rarity: 'common',
      description: '',
      spriteUrl: '',
      baseStats: { hp: 12, attack: 8, defense: 8, speed: 8 },
      abilities: [],
      levels: [
        {
          level: 1,
          requiredMissionCount: 2,
          unlockEquipSlots: 1,
          statDelta: { hp: 0, attack: 0, defense: 0, speed: 0 },
          abilityUnlockIds: [],
          skillUnlockIds: [],
          missions: [
            { id: 'heal-skills-1', type: 'heal_with_skills', targetValue: 50 },
            { id: 'crits-1', type: 'land_critical_hits', targetValue: 5 },
          ],
        },
      ],
    });

    expect(critter).not.toBeNull();
    expect(critter?.levels[0]?.missions[0]).toMatchObject({
      type: 'heal_with_skills',
      targetValue: 50,
    });
    expect(critter?.levels[0]?.missions[1]).toMatchObject({
      type: 'land_critical_hits',
      targetValue: 5,
    });
  });

  it('accepts use_skill mission with mode any, element, and specific', () => {
    const critter = sanitizeCritterDefinition({
      id: 101,
      name: 'Use Skill Test',
      element: 'bloom',
      rarity: 'common',
      description: '',
      spriteUrl: '',
      baseStats: { hp: 12, attack: 8, defense: 8, speed: 8 },
      abilities: [],
      levels: [
        {
          level: 1,
          requiredMissionCount: 1,
          unlockEquipSlots: 1,
          statDelta: { hp: 0, attack: 0, defense: 0, speed: 0 },
          abilityUnlockIds: [],
          skillUnlockIds: ['tackle', 'vine-whip'],
          missions: [
            { id: 'use-any', type: 'use_skill', targetValue: 10, useSkillMode: 'any' },
            {
              id: 'use-element',
              type: 'use_skill',
              targetValue: 5,
              useSkillMode: 'element',
              useSkillElements: ['bloom', 'ember'],
            },
            {
              id: 'use-specific',
              type: 'use_skill',
              targetValue: 3,
              useSkillMode: 'specific',
              useSkillIds: ['tackle'],
            },
          ],
        },
      ],
    });

    expect(critter).not.toBeNull();
    expect(critter?.levels[0]?.missions[0]).toMatchObject({
      type: 'use_skill',
      targetValue: 10,
      useSkillMode: 'any',
    });
    expect(critter?.levels[0]?.missions[1]).toMatchObject({
      type: 'use_skill',
      targetValue: 5,
      useSkillMode: 'element',
      useSkillElements: ['bloom', 'ember'],
    });
    expect(critter?.levels[0]?.missions[2]).toMatchObject({
      type: 'use_skill',
      targetValue: 3,
      useSkillMode: 'specific',
      useSkillIds: ['tackle'],
    });
  });

  it('accepts deal_damage mission with targetValue and optional mode/element', () => {
    const critter = sanitizeCritterDefinition({
      id: 102,
      name: 'Deal Damage Test',
      element: 'ember',
      rarity: 'common',
      description: '',
      spriteUrl: '',
      baseStats: { hp: 12, attack: 8, defense: 8, speed: 8 },
      abilities: [],
      levels: [
        {
          level: 1,
          requiredMissionCount: 1,
          unlockEquipSlots: 1,
          statDelta: { hp: 0, attack: 0, defense: 0, speed: 0 },
          abilityUnlockIds: [],
          skillUnlockIds: [],
          missions: [
            { id: 'deal-1', type: 'deal_damage', targetValue: 500 },
            {
              id: 'deal-ember',
              type: 'deal_damage',
              targetValue: 100,
              dealDamageMode: 'element',
              dealDamageElements: ['ember', 'bloom'],
            },
          ],
        },
      ],
    });

    expect(critter).not.toBeNull();
    expect(critter?.levels[0]?.missions[0]).toMatchObject({
      type: 'deal_damage',
      targetValue: 500,
    });
    expect(critter?.levels[0]?.missions[1]).toMatchObject({
      type: 'deal_damage',
      targetValue: 100,
      dealDamageMode: 'element',
      dealDamageElements: ['ember', 'bloom'],
    });
  });

  it('accepts skill_effect_buffed_actions mission with effect template ids and mode', () => {
    const critter = sanitizeCritterDefinition({
      id: 103,
      name: 'Buffed Actions Test',
      element: 'bloom',
      rarity: 'common',
      description: '',
      spriteUrl: '',
      baseStats: { hp: 12, attack: 8, defense: 8, speed: 8 },
      abilities: [],
      levels: [
        {
          level: 1,
          requiredMissionCount: 1,
          unlockEquipSlots: 1,
          statDelta: { hp: 0, attack: 0, defense: 0, speed: 0 },
          abilityUnlockIds: [],
          skillUnlockIds: [],
          missions: [
            {
              id: 'buffed-damage',
              type: 'effect_buffed_actions',
              targetValue: 250,
              effectTemplateId: 'atk_buff',
              effectBuffMode: 'deal_damage',
            },
          ],
        },
      ],
    });

    expect(critter).not.toBeNull();
    expect(critter?.levels[0]?.missions[0]).toMatchObject({
      type: 'skill_effect_buffed_actions',
      targetValue: 250,
      skillEffectTemplateIds: ['atk_buff'],
      effectBuffMode: 'deal_damage',
    });
  });

  it('accepts absorb_damage mission with damage, element, and knockout modes', () => {
    const critter = sanitizeCritterDefinition({
      id: 104,
      name: 'Absorb Damage Test',
      element: 'stone',
      rarity: 'common',
      description: '',
      spriteUrl: '',
      baseStats: { hp: 12, attack: 8, defense: 8, speed: 8 },
      abilities: [],
      levels: [
        {
          level: 1,
          requiredMissionCount: 3,
          unlockEquipSlots: 1,
          statDelta: { hp: 0, attack: 0, defense: 0, speed: 0 },
          abilityUnlockIds: [],
          skillUnlockIds: [],
          missions: [
            {
              id: 'absorb-damage',
              type: 'absorb_damage',
              targetValue: 300,
              absorbMode: 'damage',
            },
            {
              id: 'absorb-kos',
              type: 'absorb_damage',
              targetValue: 3,
              absorbMode: 'knockout',
            },
            {
              id: 'absorb-ember',
              type: 'absorb_damage',
              targetValue: 120,
              absorbMode: 'element',
              absorbDamageElements: ['ember', 'bloom'],
            },
          ],
        },
      ],
    });

    expect(critter).not.toBeNull();
    expect(critter?.levels[0]?.missions[0]).toMatchObject({
      type: 'absorb_damage',
      targetValue: 300,
      absorbMode: 'damage',
    });
    expect(critter?.levels[0]?.missions[1]).toMatchObject({
      type: 'absorb_damage',
      targetValue: 3,
      absorbMode: 'knockout',
    });
    expect(critter?.levels[0]?.missions[2]).toMatchObject({
      type: 'absorb_damage',
      targetValue: 120,
      absorbMode: 'element',
      absorbDamageElements: ['ember', 'bloom'],
    });
  });
});

describe('sanitizePlayerCritterProgress', () => {
  it('includes lockedDamageTargetCritterId and defaults to null', () => {
    const progress = createDefaultPlayerCritterProgress(BASE_CRITTER_DATABASE);
    expect(progress).toHaveProperty('lockedDamageTargetCritterId', null);
  });

  it('resolves lockedDamageTargetCritterId from save only when critter is locked', () => {
    const database: typeof BASE_CRITTER_DATABASE = [
      ...BASE_CRITTER_DATABASE,
      {
        id: 2,
        name: 'Other',
        element: 'ember' as const,
        rarity: 'common' as const,
        description: '',
        spriteUrl: '',
        baseStats: { hp: 12, attack: 8, defense: 8, speed: 8 },
        abilities: [],
        levels: [],
      },
    ];
    const progress = sanitizePlayerCritterProgress(
      {
        version: 9,
        unlockedSquadSlots: 2,
        squad: [1, null, null, null, null, null, null, null],
        collection: [
          {
            critterId: 1,
            unlocked: true,
            unlockedAt: new Date().toISOString(),
            unlockSource: null,
            level: 1,
            currentHp: 14,
            missionProgress: {},
            statBonus: { hp: 0, attack: 0, defense: 0, speed: 0 },
            effectiveStats: { hp: 14, attack: 9, defense: 9, speed: 10 },
            unlockedAbilityIds: [],
            equippedSkillIds: [null, null, null, null],
            equippedEquipmentAnchors: [],
            lastProgressAt: null,
          },
          {
            critterId: 2,
            unlocked: false,
            unlockedAt: null,
            unlockSource: null,
            level: 0,
            currentHp: 0,
            missionProgress: {},
            statBonus: { hp: 0, attack: 0, defense: 0, speed: 0 },
            effectiveStats: { hp: 12, attack: 8, defense: 8, speed: 8 },
            unlockedAbilityIds: [],
            equippedSkillIds: [null, null, null, null],
            equippedEquipmentAnchors: [],
            lastProgressAt: null,
          },
        ],
        lockedKnockoutTargetCritterId: null,
        lockedDamageTargetCritterId: 2,
      },
      database,
    );
    expect(progress.lockedDamageTargetCritterId).toBe(2);
    const progressWithUnlocked = sanitizePlayerCritterProgress(
      {
        version: 9,
        unlockedSquadSlots: 2,
        squad: [1, 2, null, null, null, null, null, null],
        collection: [
          progress.collection[0],
          { ...progress.collection[1], unlocked: true, level: 1, currentHp: 12 },
        ],
        lockedKnockoutTargetCritterId: null,
        lockedDamageTargetCritterId: 2,
      },
      database,
    );
    expect(progressWithUnlocked.lockedDamageTargetCritterId).toBeNull();
  });

  it('clears conflicting locked knockout and damage tracker selections from saves', () => {
    const database: typeof BASE_CRITTER_DATABASE = [
      ...BASE_CRITTER_DATABASE,
      {
        id: 2,
        name: 'Locked KO',
        element: 'ember' as const,
        rarity: 'common' as const,
        description: '',
        spriteUrl: '',
        baseStats: { hp: 12, attack: 8, defense: 8, speed: 8 },
        abilities: [],
        levels: [],
      },
      {
        id: 3,
        name: 'Locked Damage',
        element: 'tide' as const,
        rarity: 'common' as const,
        description: '',
        spriteUrl: '',
        baseStats: { hp: 11, attack: 7, defense: 9, speed: 8 },
        abilities: [],
        levels: [],
      },
    ];
    const progress = sanitizePlayerCritterProgress(
      {
        version: 9,
        unlockedSquadSlots: 2,
        squad: [1, null, null, null, null, null, null, null],
        collection: [
          {
            critterId: 1,
            unlocked: true,
            unlockedAt: new Date().toISOString(),
            unlockSource: null,
            level: 1,
            currentHp: 14,
            missionProgress: {},
            statBonus: { hp: 0, attack: 0, defense: 0, speed: 0 },
            effectiveStats: { hp: 14, attack: 9, defense: 9, speed: 10 },
            unlockedAbilityIds: [],
            equippedSkillIds: [null, null, null, null],
            equippedEquipmentAnchors: [],
            lastProgressAt: null,
          },
          {
            critterId: 2,
            unlocked: false,
            unlockedAt: null,
            unlockSource: null,
            level: 0,
            currentHp: 0,
            missionProgress: {},
            statBonus: { hp: 0, attack: 0, defense: 0, speed: 0 },
            effectiveStats: { hp: 12, attack: 8, defense: 8, speed: 8 },
            unlockedAbilityIds: [],
            equippedSkillIds: [null, null, null, null],
            equippedEquipmentAnchors: [],
            lastProgressAt: null,
          },
          {
            critterId: 3,
            unlocked: false,
            unlockedAt: null,
            unlockSource: null,
            level: 0,
            currentHp: 0,
            missionProgress: {},
            statBonus: { hp: 0, attack: 0, defense: 0, speed: 0 },
            effectiveStats: { hp: 11, attack: 7, defense: 9, speed: 8 },
            unlockedAbilityIds: [],
            equippedSkillIds: [null, null, null, null],
            equippedEquipmentAnchors: [],
            lastProgressAt: null,
          },
        ],
        lockedKnockoutTargetCritterId: 2,
        lockedDamageTargetCritterId: 3,
      },
      database,
    );

    expect(progress.lockedKnockoutTargetCritterId).toBeNull();
    expect(progress.lockedDamageTargetCritterId).toBeNull();
  });
});
