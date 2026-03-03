import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import type { GameItemDefinition, PlayerItemInventory } from '@/game/items/types';
import { PLAYER_ITEM_INVENTORY_VERSION } from '@/game/items/types';

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
  return inventory.entries.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
}

function createRuntimeHarness(items: GameItemDefinition[]) {
  const runtime = Object.create(GameRuntime.prototype) as any;
  runtime.itemDatabase = items;
  runtime.itemById = items.reduce<Record<string, GameItemDefinition>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
  runtime.playerItemInventory = makeInventory([]);
  runtime.playerName = 'Player';
  runtime.selectedStarterId = '';
  runtime.critterLookup = {};
  runtime.flags = {};
  runtime.pendingBattleRewardDialogue = null;
  runtime.activeBattle = null;
  runtime.markProgressDirty = vi.fn();
  runtime.syncPlayerBattleHealthToProgress = vi.fn().mockReturnValue(false);
  return runtime;
}

function createBattle(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    source: {
      type: 'wild',
      mapId: 'starter-town',
      groupId: 'grass-a',
      label: 'Wild Buddo',
      wildEncounterDrops: [],
    },
    phase: 'player-turn',
    result: 'ongoing',
    transitionEffect: 'scanline',
    transitionDurationMs: 0,
    transitionRemainingMs: 0,
    turnNumber: 1,
    logLine: 'Choose your move.',
    playerTeam: [],
    opponentTeam: [],
    playerActiveIndex: null,
    opponentActiveIndex: null,
    pendingOpponentSwitchIndex: null,
    pendingOpponentSwitchDelayMs: 0,
    pendingOpponentSwitchAnnouncementShown: false,
    pendingForcedSwap: false,
    narrationQueue: [],
    activeNarration: null,
    activeAnimation: null,
    pendingKnockoutResolution: null,
    nextAnimationToken: 1,
    ...overrides,
  };
}

describe('GameRuntime wild encounter drops', () => {
  it('resolves independent rolls and merges duplicate item drops', () => {
    const runtime = createRuntimeHarness([
      makeItem({ id: 'lume', name: 'Lume' }),
      makeItem({ id: 'wood', name: 'Wood' }),
    ]);
    const randomSpy = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.4)
      .mockReturnValueOnce(0.3)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.9);

    try {
      expect(
        (runtime as any).resolveWildEncounterDropRewards([
          { itemId: 'lume', minAmount: 1, maxAmount: 3, dropChance: 0.5 },
          { itemId: 'lume', minAmount: 2, maxAmount: 4, dropChance: 0.5 },
          { itemId: 'wood', minAmount: 1, maxAmount: 1, dropChance: 0.2 },
        ]),
      ).toEqual([{ itemId: 'lume', quantity: 4 }]);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('grants configured drops after winning a wild battle', () => {
    const runtime = createRuntimeHarness([makeItem({ id: 'lume', name: 'Lume' })]);
    const battle = createBattle({
      source: {
        type: 'wild',
        mapId: 'starter-town',
        groupId: 'grass-a',
        label: 'Wild Buddo',
        wildEncounterDrops: [{ itemId: 'lume', minAmount: 2, maxAmount: 4, dropChance: 1 }],
      },
    });
    runtime.activeBattle = battle;
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.25).mockReturnValueOnce(0.5);

    try {
      (runtime as any).setBattleResult(battle, 'won', 'The wild Buddo fainted. You won the battle!');

      expect(runtime.pendingBattleRewardDialogue).toMatchObject({
        speaker: 'Battle',
        rewards: [{ itemId: 'lume', quantity: 3 }],
      });
      expect(getQuantity(runtime.playerItemInventory, 'lume')).toBe(0);

      expect(runtime.battleAcknowledgeResult()).toBe(true);
      while (runtime.dialogue) {
        (runtime as any).advanceDialogue();
      }

      expect(getQuantity(runtime.playerItemInventory, 'lume')).toBe(3);
      expect(runtime.markProgressDirty).toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('does not queue rewards when no wild drop roll succeeds', () => {
    const runtime = createRuntimeHarness([makeItem({ id: 'lume', name: 'Lume' })]);
    const battle = createBattle({
      source: {
        type: 'wild',
        mapId: 'starter-town',
        groupId: 'grass-a',
        label: 'Wild Buddo',
        wildEncounterDrops: [{ itemId: 'lume', minAmount: 1, maxAmount: 1, dropChance: 0 }],
      },
    });

    (runtime as any).setBattleResult(battle, 'won', 'The wild Buddo fainted. You won the battle!');

    expect(runtime.pendingBattleRewardDialogue).toBeNull();
  });

  it('does not queue rewards for escaped wild battles or non-wild wins', () => {
    const runtime = createRuntimeHarness([makeItem({ id: 'lume', name: 'Lume' })]);
    const escapedBattle = createBattle({
      source: {
        type: 'wild',
        mapId: 'starter-town',
        groupId: 'grass-a',
        label: 'Wild Buddo',
        wildEncounterDrops: [{ itemId: 'lume', minAmount: 1, maxAmount: 1, dropChance: 1 }],
      },
    });
    const npcBattle = createBattle({
      source: {
        type: 'npc',
        mapId: 'starter-town',
        npcId: 'trainer-1',
        label: 'Trainer',
        wildEncounterDrops: [{ itemId: 'lume', minAmount: 1, maxAmount: 1, dropChance: 1 }],
      },
    });

    (runtime as any).setBattleResult(escapedBattle, 'escaped', 'You got away safely.');
    expect(runtime.pendingBattleRewardDialogue).toBeNull();

    (runtime as any).setBattleResult(npcBattle, 'won', 'Trainer was defeated.');
    expect(runtime.pendingBattleRewardDialogue).toBeNull();
  });
});
