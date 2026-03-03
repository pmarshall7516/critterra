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
});
