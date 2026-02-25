import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import type { GameItemDefinition, PlayerItemInventory } from '@/game/items/types';
import { PLAYER_ITEM_INVENTORY_VERSION } from '@/game/items/types';
import type { ShopDefinition, ShopEntryDefinition } from '@/game/shops/types';

function makeItem(overrides: Partial<GameItemDefinition> & Pick<GameItemDefinition, 'id' | 'name'>): GameItemDefinition {
  return {
    id: overrides.id,
    name: overrides.name,
    category: overrides.category ?? 'material',
    description: overrides.description ?? '',
    imageUrl: overrides.imageUrl ?? '',
    misuseText: overrides.misuseText ?? '',
    successText: overrides.successText,
    effectType: overrides.effectType ?? 'other_stub',
    effectConfig: overrides.effectConfig ?? {},
    value: overrides.value,
    consumable: overrides.consumable ?? false,
    maxStack: overrides.maxStack ?? 99,
    isActive: overrides.isActive ?? true,
    starterGrantAmount: overrides.starterGrantAmount ?? 0,
  };
}

function makeInventory(entries: Array<{ itemId: string; quantity: number }>): PlayerItemInventory {
  return {
    version: PLAYER_ITEM_INVENTORY_VERSION,
    entries: entries.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity })),
  };
}

function getQuantity(inventory: PlayerItemInventory, itemId: string): number {
  const found = inventory.entries.find((entry) => entry.itemId === itemId);
  return found?.quantity ?? 0;
}

function createRuntimeHarness(input: {
  items: GameItemDefinition[];
  inventory: PlayerItemInventory;
  entry: ShopEntryDefinition;
  shopId?: string;
  critterLookup?: Record<number, { name: string }>;
}) {
  const runtime = Object.create(GameRuntime.prototype) as any;
  const shopId = input.shopId ?? 'starter-shop';
  const shop: ShopDefinition = {
    id: shopId,
    name: 'Starter Shop',
    entries: [input.entry],
  };
  runtime.shopPrompt = {
    npcName: 'Trader',
    title: "Trader's Shop",
    shopId,
  };
  runtime.shopById = { [shopId]: shop };
  runtime.itemDatabase = input.items;
  runtime.itemById = input.items.reduce<Record<string, GameItemDefinition>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
  runtime.playerItemInventory = input.inventory;
  runtime.flags = {};
  runtime.critterLookup = input.critterLookup ?? {};
  runtime.markProgressDirty = vi.fn();
  runtime.showMessage = vi.fn();
  return runtime;
}

describe('GameRuntime.purchaseShopEntry', () => {
  it('purchases an item entry with multiple costs and deducts all requirements', () => {
    const items = [
      makeItem({ id: 'lume', name: 'Lume', maxStack: 9999 }),
      makeItem({ id: 'wood', name: 'Wood', maxStack: 9999 }),
      makeItem({ id: 'stone', name: 'Stone', maxStack: 9999 }),
      makeItem({ id: 'field-bandage', name: 'Field Bandage', maxStack: 20 }),
    ];
    const runtime = createRuntimeHarness({
      items,
      inventory: makeInventory([
        { itemId: 'lume', quantity: 20 },
        { itemId: 'wood', quantity: 5 },
        { itemId: 'stone', quantity: 3 },
      ]),
      entry: {
        id: 'bandage-entry',
        kind: 'item',
        itemId: 'field-bandage',
        quantity: 1,
        costs: [
          { itemId: 'lume', quantity: 10 },
          { itemId: 'wood', quantity: 2 },
          { itemId: 'stone', quantity: 1 },
        ],
        repeatable: true,
      },
    });

    expect(runtime.purchaseShopEntry('bandage-entry')).toBe(true);
    expect(getQuantity(runtime.playerItemInventory, 'lume')).toBe(10);
    expect(getQuantity(runtime.playerItemInventory, 'wood')).toBe(3);
    expect(getQuantity(runtime.playerItemInventory, 'stone')).toBe(2);
    expect(getQuantity(runtime.playerItemInventory, 'field-bandage')).toBe(1);
  });

  it('rejects purchase when any cost requirement is missing', () => {
    const items = [
      makeItem({ id: 'lume', name: 'Lume', maxStack: 9999 }),
      makeItem({ id: 'wood', name: 'Wood', maxStack: 9999 }),
      makeItem({ id: 'field-bandage', name: 'Field Bandage', maxStack: 20 }),
    ];
    const runtime = createRuntimeHarness({
      items,
      inventory: makeInventory([
        { itemId: 'lume', quantity: 50 },
        { itemId: 'wood', quantity: 1 },
      ]),
      entry: {
        id: 'bandage-entry',
        kind: 'item',
        itemId: 'field-bandage',
        quantity: 1,
        costs: [
          { itemId: 'lume', quantity: 10 },
          { itemId: 'wood', quantity: 2 },
        ],
      },
    });

    expect(runtime.purchaseShopEntry('bandage-entry')).toBe(false);
    expect(getQuantity(runtime.playerItemInventory, 'lume')).toBe(50);
    expect(getQuantity(runtime.playerItemInventory, 'wood')).toBe(1);
    expect(getQuantity(runtime.playerItemInventory, 'field-bandage')).toBe(0);
  });

  it('rejects item purchase when reward does not fully fit max stack', () => {
    const items = [
      makeItem({ id: 'lume', name: 'Lume', maxStack: 9999 }),
      makeItem({ id: 'field-bandage', name: 'Field Bandage', maxStack: 10 }),
    ];
    const runtime = createRuntimeHarness({
      items,
      inventory: makeInventory([
        { itemId: 'lume', quantity: 50 },
        { itemId: 'field-bandage', quantity: 10 },
      ]),
      entry: {
        id: 'bandage-entry',
        kind: 'item',
        itemId: 'field-bandage',
        quantity: 1,
        costs: [{ itemId: 'lume', quantity: 5 }],
      },
    });

    expect(runtime.purchaseShopEntry('bandage-entry')).toBe(false);
    expect(getQuantity(runtime.playerItemInventory, 'lume')).toBe(50);
    expect(getQuantity(runtime.playerItemInventory, 'field-bandage')).toBe(10);
  });

  it('marks non-repeatable item entries as one-time purchases', () => {
    const items = [
      makeItem({ id: 'lume', name: 'Lume', maxStack: 9999 }),
      makeItem({ id: 'field-bandage', name: 'Field Bandage', maxStack: 20 }),
    ];
    const runtime = createRuntimeHarness({
      items,
      inventory: makeInventory([{ itemId: 'lume', quantity: 30 }]),
      entry: {
        id: 'bandage-entry',
        kind: 'item',
        itemId: 'field-bandage',
        quantity: 1,
        costs: [{ itemId: 'lume', quantity: 10 }],
        repeatable: false,
      },
    });

    expect(runtime.purchaseShopEntry('bandage-entry')).toBe(true);
    expect(runtime.flags['shop-purchase:starter-shop:bandage-entry']).toBe(true);
    expect(runtime.purchaseShopEntry('bandage-entry')).toBe(false);
    expect(getQuantity(runtime.playerItemInventory, 'lume')).toBe(20);
    expect(getQuantity(runtime.playerItemInventory, 'field-bandage')).toBe(1);
  });

  it('critter purchase sets unlock flag and is always one-time', () => {
    const items = [makeItem({ id: 'lume', name: 'Lume', maxStack: 9999 })];
    const runtime = createRuntimeHarness({
      items,
      inventory: makeInventory([{ itemId: 'lume', quantity: 25 }]),
      entry: {
        id: 'critter-entry',
        kind: 'critter',
        critterId: 7,
        unlockFlagId: 'mission-critter-7',
        costs: [{ itemId: 'lume', quantity: 10 }],
      },
      critterLookup: {
        7: { name: 'Seedling' },
      },
    });

    expect(runtime.purchaseShopEntry('critter-entry')).toBe(true);
    expect(runtime.flags['mission-critter-7']).toBe(true);
    expect(runtime.flags['shop-purchase:starter-shop:critter-entry']).toBe(true);
    expect(getQuantity(runtime.playerItemInventory, 'lume')).toBe(15);
    expect(runtime.purchaseShopEntry('critter-entry')).toBe(false);
    expect(getQuantity(runtime.playerItemInventory, 'lume')).toBe(15);
  });
});
