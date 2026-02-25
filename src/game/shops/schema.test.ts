import { describe, expect, it } from 'vitest';
import { parseShopCatalog, sanitizeShopCatalog } from '@/game/shops/schema';

describe('sanitizeShopCatalog', () => {
  it('defaults item entry repeatable to true', () => {
    const shops = sanitizeShopCatalog([
      {
        id: 'starter-shop',
        name: 'Starter Shop',
        entries: [
          {
            id: 'field-bandage-entry',
            kind: 'item',
            itemId: 'field-bandage',
            quantity: 1,
            costs: [{ itemId: 'lume', quantity: 10 }],
          },
        ],
      },
    ]);
    expect(shops).toHaveLength(1);
    expect(shops[0]?.entries).toHaveLength(1);
    expect(shops[0]?.entries[0]).toMatchObject({
      kind: 'item',
      repeatable: true,
    });
  });

  it('drops invalid critter entries when unlockFlagId is missing', () => {
    const shops = sanitizeShopCatalog([
      {
        id: 'starter-shop',
        name: 'Starter Shop',
        entries: [
          {
            id: 'bad-critter-entry',
            kind: 'critter',
            critterId: 1,
            costs: [{ itemId: 'lume', quantity: 25 }],
          },
        ],
      },
    ]);
    expect(shops).toHaveLength(1);
    expect(shops[0]?.entries).toHaveLength(0);
  });

  it('merges duplicate costs and clamps quantities', () => {
    const shops = sanitizeShopCatalog([
      {
        id: 'starter-shop',
        name: 'Starter Shop',
        entries: [
          {
            id: 'field-bandage-entry',
            kind: 'item',
            itemId: 'field-bandage',
            quantity: 0,
            costs: [
              { itemId: 'lume', quantity: 0 },
              { itemId: 'lume', quantity: 4.7 },
              { itemId: 'wood', quantity: 2.2 },
            ],
          },
        ],
      },
    ]);
    expect(shops).toHaveLength(1);
    const entry = shops[0]?.entries[0];
    expect(entry).toMatchObject({
      kind: 'item',
      quantity: 1,
      costs: [
        { itemId: 'lume', quantity: 5 },
        { itemId: 'wood', quantity: 2 },
      ],
    });
  });
});

describe('parseShopCatalog strict validation', () => {
  it('rejects duplicate shop IDs in strict mode', () => {
    expect(() =>
      parseShopCatalog(
        [
          { id: 'starter-shop', name: 'A', entries: [] },
          { id: 'starter-shop', name: 'B', entries: [] },
        ],
        { strictUnique: true },
      ),
    ).toThrow('Duplicate shop ID');
  });

  it('rejects duplicate entry IDs in strict mode', () => {
    expect(() =>
      parseShopCatalog(
        [
          {
            id: 'starter-shop',
            name: 'Starter Shop',
            entries: [
              {
                id: 'dupe',
                kind: 'item',
                itemId: 'field-bandage',
                quantity: 1,
                costs: [{ itemId: 'lume', quantity: 10 }],
              },
              {
                id: 'dupe',
                kind: 'item',
                itemId: 'field-bandage',
                quantity: 1,
                costs: [{ itemId: 'lume', quantity: 10 }],
              },
            ],
          },
        ],
        { strictUnique: true, strictEntryUnique: true },
      ),
    ).toThrow('duplicate entry ID');
  });

  it('rejects critter entries without unlockFlagId in strict mode', () => {
    expect(() =>
      parseShopCatalog(
        [
          {
            id: 'starter-shop',
            name: 'Starter Shop',
            entries: [
              {
                id: 'critter-entry',
                kind: 'critter',
                critterId: 7,
                costs: [{ itemId: 'lume', quantity: 20 }],
              },
            ],
          },
        ],
        { strictUnique: true },
      ),
    ).toThrow('requires unlockFlagId');
  });
});
