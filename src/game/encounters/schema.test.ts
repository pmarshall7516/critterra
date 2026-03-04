import { describe, expect, it } from 'vitest';
import { sanitizeEncounterEntries } from '@/game/encounters/schema';

describe('sanitizeEncounterEntries', () => {
  it('sanitizes critter drop pools and discards invalid drop rows', () => {
    const entries = sanitizeEncounterEntries([
      {
        kind: 'critter',
        critterId: 5,
        weight: 0.5,
        drops: [
          {
            itemId: ' Field Bandage ',
            minAmount: 5,
            maxAmount: 2,
            percent: 1.5,
          },
          {
            itemId: '',
            minAmount: 1,
            maxAmount: 1,
            dropChance: 0.4,
          },
        ],
      },
    ]);

    expect(entries).toEqual([
      {
        kind: 'critter',
        critterId: 5,
        weight: 0.5,
        minLevel: null,
        maxLevel: null,
        drops: [
          {
            itemId: 'field-bandage',
            minAmount: 2,
            maxAmount: 5,
            dropChance: 1,
          },
        ],
      },
    ]);
  });

  it('defaults missing drop amounts to 1 and clamps drop chance into range', () => {
    const entries = sanitizeEncounterEntries([
      {
        kind: 'critter',
        critterId: 8,
        weight: 1,
        drops: [
          {
            itemId: 'lume',
            dropChance: -2,
          },
        ],
      },
    ]);

    expect(entries[0]).toMatchObject({
      kind: 'critter',
      critterId: 8,
      drops: [
        {
          itemId: 'lume',
          minAmount: 1,
          maxAmount: 1,
          dropChance: 0,
        },
      ],
    });
  });

  it('preserves critter rows without drops', () => {
    const entries = sanitizeEncounterEntries([
      {
        kind: 'critter',
        critterId: 9,
        weight: 1,
        minLevel: 2,
        maxLevel: 6,
      },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'critter',
      critterId: 9,
      minLevel: 2,
      maxLevel: 6,
    });
    expect('drops' in entries[0]).toBe(false);
  });
});
