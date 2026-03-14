import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import { missionProgressKey } from '@/game/critters/schema';
import type { CritterDefinition, PlayerCritterCollectionEntry, PlayerCritterProgress } from '@/game/critters/types';
import { PLAYER_CRITTER_PROGRESS_VERSION } from '@/game/critters/types';
import type { GameItemDefinition, PlayerItemInventory } from '@/game/items/types';
import { PLAYER_ITEM_INVENTORY_VERSION } from '@/game/items/types';

const EMPTY_STATS = {
  hp: 0,
  attack: 0,
  defense: 0,
  speed: 0,
} as const;

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
    maxStack: overrides.maxStack ?? 9999,
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
        skillUnlockIds: [],
      },
      {
        level: 2,
        missions: [
          {
            id: 'pay-lume',
            type: 'pay_item',
            targetValue: 50,
            requiredPaymentItemId: 'lume',
          },
        ],
        requiredMissionCount: 1,
        statDelta: { ...EMPTY_STATS },
        unlockEquipSlots: 0,
        abilityUnlockIds: [],
        skillUnlockIds: [],
      },
    ],
  };
}

function createProgressEntry(): PlayerCritterCollectionEntry {
  return {
    critterId: 1,
    unlocked: true,
    unlockedAt: null,
    unlockSource: 'missions',
    level: 1,
    currentHp: 24,
    missionProgress: {},
    statBonus: { ...EMPTY_STATS },
    effectiveStats: { hp: 24, attack: 10, defense: 8, speed: 7 },
    unlockedAbilityIds: [],
    equippedAbilityId: null,
    equippedSkillIds: [null, null, null, null],
    equippedEquipmentAnchors: [],
    lastProgressAt: null,
  };
}

function createRuntimeHarness(quantityOwned: number) {
  const critter = createCritter();
  const progress = createProgressEntry();
  const items = [makeItem({ id: 'lume', name: 'Lume', category: 'material' })];
  const runtime = Object.create(GameRuntime.prototype) as any;
  runtime.critterLookup = { [critter.id]: critter };
  runtime.playerCritterProgress = {
    version: PLAYER_CRITTER_PROGRESS_VERSION,
    unlockedSquadSlots: 8,
    squad: [critter.id, null, null, null, null, null, null, null],
    collection: [progress],
    lockedKnockoutTargetCritterId: null,
    lockedDamageTargetCritterId: null,
  } as PlayerCritterProgress;
  runtime.itemDatabase = items;
  runtime.itemById = { lume: items[0] };
  runtime.playerItemInventory = makeInventory([{ itemId: 'lume', quantity: quantityOwned }]);
  runtime.markProgressDirty = vi.fn();
  runtime.showMessage = vi.fn();
  runtime.flags = {};
  return { runtime, progress };
}

describe('GameRuntime.payCritterMission', () => {
  it('consumes the configured item and completes the pay mission', () => {
    const { runtime, progress } = createRuntimeHarness(80);

    expect(runtime.payCritterMission(1, 'pay-lume')).toBe(true);
    expect(getQuantity(runtime.playerItemInventory, 'lume')).toBe(30);
    expect(progress.missionProgress[missionProgressKey(2, 'pay-lume')]).toBe(50);
    expect(progress.lastProgressAt).toBeTruthy();
    expect(runtime.markProgressDirty).toHaveBeenCalled();
    expect(runtime.showMessage).toHaveBeenCalledWith('Paid 50x Lume for Buddo.', 2200);
  });

  it('rejects payment when the player lacks enough of the configured item', () => {
    const { runtime, progress } = createRuntimeHarness(10);

    expect(runtime.payCritterMission(1, 'pay-lume')).toBe(false);
    expect(getQuantity(runtime.playerItemInventory, 'lume')).toBe(10);
    expect(progress.missionProgress[missionProgressKey(2, 'pay-lume')]).toBeUndefined();
    expect(runtime.markProgressDirty).not.toHaveBeenCalled();
    expect(runtime.showMessage).toHaveBeenCalledWith('Need 50x Lume.', 2200);
  });
});
