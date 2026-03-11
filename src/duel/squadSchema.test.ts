import { describe, expect, it } from 'vitest';
import type { CritterDefinition } from '@/game/critters/types';
import type { EquipmentEffectDefinition } from '@/game/equipmentEffects/types';
import type { GameItemDefinition } from '@/game/items/types';
import type { ElementChart, SkillDefinition, SkillEffectDefinition } from '@/game/skills/types';
import { buildDuelCatalogIndexes, toSavedSquadPayload, type DuelSquadDraft } from '@/duel/squadSchema';
import type { DuelCatalogContent } from '@/duel/types';

const EMPTY_STATS = {
  hp: 0,
  attack: 0,
  defense: 0,
  speed: 0,
};

function createCritter(id: number, name: string): CritterDefinition {
  return {
    id,
    name,
    element: 'normal',
    rarity: 'common',
    description: '',
    spriteUrl: '',
    baseStats: {
      hp: 100,
      attack: 20,
      defense: 20,
      speed: 20,
    },
    abilities: [],
    levels: [
      {
        level: 1,
        missions: [],
        requiredMissionCount: 0,
        statDelta: { ...EMPTY_STATS },
        unlockEquipSlots: 1,
        abilityUnlockIds: [],
        skillUnlockIds: ['jab'],
      },
      {
        level: 5,
        missions: [],
        requiredMissionCount: 0,
        statDelta: { ...EMPTY_STATS },
        unlockEquipSlots: 2,
        abilityUnlockIds: [],
        skillUnlockIds: ['blast'],
      },
    ],
  };
}

function createSkill(id: string, name: string): SkillDefinition {
  return {
    skill_id: id,
    skill_name: name,
    element: 'normal',
    type: 'damage',
    priority: 1,
    damage: 25,
  };
}

function createEquipment(
  id: string,
  name: string,
  input: {
    slot: string;
    equipSize?: number;
    isActive?: boolean;
  },
): GameItemDefinition {
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
      slot: input.slot,
      equipSize: input.equipSize ?? 1,
      equipmentEffectIds: [],
    },
    consumable: false,
    maxStack: 1,
    isActive: input.isActive ?? true,
    starterGrantAmount: 0,
  };
}

function createDraft(partial: Partial<DuelSquadDraft>): DuelSquadDraft {
  return {
    name: partial.name ?? 'Test Squad',
    sortIndex: partial.sortIndex,
    members:
      partial.members ??
      [
        {
          critterId: 1,
          level: 1,
          equippedSkillIds: ['jab', null, null, null],
          equippedItems: [],
        },
      ],
  };
}

const catalogs: DuelCatalogContent = {
  critters: [createCritter(1, 'Alpha'), createCritter(2, 'Beta')],
  skills: [createSkill('jab', 'Jab'), createSkill('blast', 'Blast')],
  items: [
    createEquipment('helm_a', 'Iron Helm', { slot: 'head' }),
    createEquipment('helm_b', 'Stone Helm', { slot: 'head' }),
    createEquipment('armor', 'Plate Armor', { slot: 'body', equipSize: 2 }),
    createEquipment('ring', 'Swift Ring', { slot: 'ring' }),
  ],
  skillEffects: [] as SkillEffectDefinition[],
  equipmentEffects: [] as EquipmentEffectDefinition[],
  elementChart: [] as ElementChart,
};

const indexes = buildDuelCatalogIndexes(catalogs);

describe('duel squad schema validation', () => {
  it('rejects duplicate critter species in the same squad', () => {
    const draft = createDraft({
      members: [
        {
          critterId: 1,
          level: 1,
          equippedSkillIds: ['jab', null, null, null],
          equippedItems: [],
        },
        {
          critterId: 1,
          level: 1,
          equippedSkillIds: ['jab', null, null, null],
          equippedItems: [],
        },
      ],
    });

    const result = toSavedSquadPayload(draft, indexes);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path === 'members.1.critterId')).toBe(true);
  });

  it('enforces level-based skill unlocks', () => {
    const draft = createDraft({
      members: [
        {
          critterId: 1,
          level: 1,
          equippedSkillIds: ['blast', null, null, null],
          equippedItems: [],
        },
      ],
    });

    const result = toSavedSquadPayload(draft, indexes);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path === 'members.0.equippedSkillIds.0')).toBe(true);
  });

  it('enforces one equipment item per equipment type key', () => {
    const draft = createDraft({
      members: [
        {
          critterId: 1,
          level: 5,
          equippedSkillIds: ['jab', 'blast', null, null],
          equippedItems: [
            { itemId: 'helm_a', slotIndex: 0 },
            { itemId: 'helm_b', slotIndex: 1 },
          ],
        },
      ],
    });

    const result = toSavedSquadPayload(draft, indexes);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path === 'members.0.equippedItems.1')).toBe(true);
  });

  it('enforces equipment fit against unlocked slot count at selected level', () => {
    const validAtLevelFive = createDraft({
      members: [
        {
          critterId: 1,
          level: 5,
          equippedSkillIds: ['jab', 'blast', null, null],
          equippedItems: [{ itemId: 'armor', slotIndex: 1 }],
        },
      ],
    });
    const validResult = toSavedSquadPayload(validAtLevelFive, indexes);
    expect(validResult.ok).toBe(true);

    const invalidAtLevelOne = createDraft({
      members: [
        {
          critterId: 1,
          level: 1,
          equippedSkillIds: ['jab', null, null, null],
          equippedItems: [{ itemId: 'armor', slotIndex: 0 }],
        },
      ],
    });
    const invalidResult = toSavedSquadPayload(invalidAtLevelOne, indexes);
    expect(invalidResult.ok).toBe(false);
    expect(invalidResult.issues.some((issue) => issue.path === 'members.0.equippedItems.0.slotIndex')).toBe(true);
  });
});
