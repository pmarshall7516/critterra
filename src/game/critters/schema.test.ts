import { describe, expect, it } from 'vitest';
import { sanitizeCritterDefinition } from '@/game/critters/schema';

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
});
