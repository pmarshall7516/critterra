import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import type { GameItemDefinition, PlayerItemInventory } from '@/game/items/types';
import { PLAYER_ITEM_INVENTORY_VERSION } from '@/game/items/types';
import type { NpcSpriteConfig, WorldMap } from '@/game/world/types';

type RuntimeHarness = any;
type FishingSessionHarness = {
  mapId: string;
  groupId: string;
  tableId: string;
  fishFrequency: number;
  targetTile: { x: number; y: number };
  itemId: string;
  itemName: string;
  power: number;
  hasPendingBite: boolean;
  waitDurationMs: number;
  waitRemainingMs: number;
  biteWindowRemainingMs: number;
  biteWindowDurationMs: number;
  castAnimationElapsedMs: number;
  castAnimationDurationMs: number;
};

function makeTool(input: {
  id: string;
  name: string;
  power: number;
  actionId?: string;
  requiresFacingTileKeyword?: string[];
  successText?: string;
}): GameItemDefinition {
  return {
    id: input.id,
    name: input.name,
    category: 'tool',
    description: '',
    imageUrl: '',
    misuseText: 'There is nothing to fish here.',
    successText: '',
    effectType: 'tool_action',
    effectConfig: {
      actionId: input.actionId ?? 'fishing',
      power: input.power,
      requiresFacingTileKeyword: input.requiresFacingTileKeyword ?? ['water'],
      successText: input.successText,
    },
    value: input.power,
    consumable: false,
    maxStack: 1,
    isActive: true,
    starterGrantAmount: 0,
  };
}

function makeInventory(entries: Array<{ itemId: string; quantity: number }>): PlayerItemInventory {
  return {
    version: PLAYER_ITEM_INVENTORY_VERSION,
    entries: entries.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity })),
  };
}

function makePlayerSprite(overrides?: Partial<NpcSpriteConfig>): NpcSpriteConfig {
  return {
    url: '/player.png',
    frameWidth: 64,
    frameHeight: 64,
    facingFrames: {
      up: 1,
      down: 2,
      left: 3,
      right: 4,
    },
    animationSets: {
      idle: {
        up: [1],
        down: [2],
        left: [3],
        right: [10],
      },
      walk: {
        up: [1, 5],
        down: [2, 6],
        left: [3, 7],
        right: [4, 8],
      },
      fish: {
        up: [11, 12, 13],
        down: [14, 15, 16],
        left: [17, 18, 19],
        right: [30, 31, 32],
      },
    },
    defaultIdleAnimation: 'idle',
    defaultMoveAnimation: 'walk',
    ...overrides,
  };
}

function makeTestMap(includeFishingGroup = true): WorldMap {
  const tiles = [
    ['G', 'G', 'G'],
    ['G', 'Z', 'G'],
    ['G', 'G', 'G'],
  ];
  return {
    id: 'test-map',
    name: 'Test Map',
    width: 3,
    height: 3,
    layers: [
      {
        id: 'base',
        orderId: 1,
        name: 'Base',
        tiles,
        rotations: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
        collisionEdges: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
        visible: true,
        collision: true,
      },
    ],
    tiles,
    npcs: [],
    warps: [],
    interactions: [],
    encounterGroups: includeFishingGroup
      ? [
          {
            id: 'fishing-group',
            tilePositions: [{ x: 1, y: 1 }],
            walkEncounterTableId: null,
            fishEncounterTableId: 'fish-table',
            walkFrequency: 0,
            fishFrequency: 0.5,
          },
        ]
      : [],
    cameraSize: { widthTiles: 19, heightTiles: 15 },
    cameraPoint: null,
  };
}

function makeFishingSession(overrides?: Partial<FishingSessionHarness>): FishingSessionHarness {
  return {
    mapId: 'test-map',
    groupId: 'fishing-group',
    tableId: 'fish-table',
    fishFrequency: 0.5,
    targetTile: { x: 1, y: 1 },
    itemId: 'old-rod',
    itemName: 'Old Rod',
    power: 0.2,
    hasPendingBite: false,
    waitDurationMs: 1000,
    waitRemainingMs: 1000,
    biteWindowRemainingMs: 0,
    biteWindowDurationMs: 0,
    castAnimationElapsedMs: 0,
    castAnimationDurationMs: 0,
    ...overrides,
  };
}

function createRuntimeHarness(input?: {
  items?: GameItemDefinition[];
  inventory?: PlayerItemInventory;
  map?: WorldMap;
  playerSpriteConfig?: NpcSpriteConfig;
}): RuntimeHarness {
  const runtime = Object.create(GameRuntime.prototype) as RuntimeHarness;
  const map = input?.map ?? makeTestMap();
  runtime.itemDatabase = input?.items ?? [];
  runtime.playerItemInventory = input?.inventory ?? makeInventory([]);
  runtime.encounterTableLookup = {
    'fish-table': {
      id: 'fish-table',
      entries: [{ kind: 'item', itemId: 'seaweed', weight: 1 }],
    },
  };
  runtime.currentMapId = map.id;
  runtime.activeBattle = null;
  runtime.dialogue = null;
  runtime.healPrompt = null;
  runtime.shopPrompt = null;
  runtime.activeCutscene = null;
  runtime.starterSelection = null;
  runtime.activeScriptedScene = null;
  runtime.flags = {};
  runtime.playerPosition = { x: 0, y: 1 };
  runtime.facing = 'right';
  runtime.heldDirections = [];
  runtime.moveStep = null;
  runtime.playerStridePhase = 0;
  runtime.playerAnimationMs = 0;
  runtime.fishingSession = null;
  runtime.tileDefinitions = {
    G: { code: 'G', label: 'Grass', walkable: true, color: '#0f0', height: 0 },
    Z: { code: 'Z', label: 'Pond Water', walkable: false, color: '#00f', height: 0 },
  };
  runtime.playerSpriteConfig = input?.playerSpriteConfig ?? makePlayerSprite();
  runtime.preloadMapVisualAssets = vi.fn();
  runtime.areMapVisualAssetsReady = vi.fn(() => true);
  runtime.showMessage = vi.fn();
  runtime.startDialogue = vi.fn();
  runtime.ensureFishingBiteIconLoaded = vi.fn();
  runtime.getCurrentMap = vi.fn(() => map);
  runtime.getNpcsForMap = vi.fn(() => []);
  runtime.findInteractWarpAtPlayer = vi.fn(() => null);
  return runtime;
}

describe('GameRuntime fishing controls', () => {
  it('uses the highest-power owned fishing rod for the F hotkey', () => {
    const oldRod = makeTool({ id: 'old-rod', name: 'Old Rod', power: 0.2 });
    const goldRod = makeTool({ id: 'gold-rod', name: 'Gold Rod', power: 0.75 });
    const runtime = createRuntimeHarness({
      items: [oldRod, goldRod],
      inventory: makeInventory([
        { itemId: 'old-rod', quantity: 1 },
        { itemId: 'gold-rod', quantity: 1 },
      ]),
    });
    runtime.tryUseFishingTool = vi.fn(() => true);

    runtime.keyDown('f');

    expect(runtime.tryUseFishingTool).toHaveBeenCalledWith(goldRod);
  });

  it('uses the highest-power matching tool when Space targets a fishable tile', () => {
    const oldRod = makeTool({ id: 'old-rod', name: 'Old Rod', power: 0.2 });
    const goldRod = makeTool({ id: 'gold-rod', name: 'Gold Rod', power: 0.75 });
    const runtime = createRuntimeHarness({
      items: [oldRod, goldRod],
      inventory: makeInventory([
        { itemId: 'old-rod', quantity: 1 },
        { itemId: 'gold-rod', quantity: 1 },
      ]),
    });
    runtime.tryUseToolItem = vi.fn(() => true);

    runtime.keyDown(' ');

    expect(runtime.tryUseToolItem).toHaveBeenCalledWith(goldRod);
  });

  it('shows the tool name in the fishing cast popup', () => {
    const oldRod = makeTool({
      id: 'old-rod',
      name: 'Old Rod',
      power: 0.2,
      successText: 'You cast your line into the water.',
    });
    const runtime = createRuntimeHarness({
      items: [oldRod],
      inventory: makeInventory([{ itemId: 'old-rod', quantity: 1 }]),
    });
    runtime.resolveFishingBiteWaitMs = vi.fn(() => 900);

    expect(runtime.tryUseFishingTool(oldRod)).toBe(true);

    expect(runtime.showMessage).toHaveBeenCalledWith('Old Rod: You cast your line into the water.', 2000);
  });

  it('reels in too early with F and clears the cast', () => {
    const runtime = createRuntimeHarness();
    runtime.fishingSession = makeFishingSession();

    runtime.keyDown('F');

    expect(runtime.fishingSession).toBeNull();
    expect(runtime.showMessage).toHaveBeenCalledWith('You reeled in too early and caught nothing.', 1800);
  });

  it('reels in too early with Space and clears the cast', () => {
    const runtime = createRuntimeHarness();
    runtime.fishingSession = makeFishingSession();

    runtime.keyDown(' ');

    expect(runtime.fishingSession).toBeNull();
    expect(runtime.showMessage).toHaveBeenCalledWith('You reeled in too early and caught nothing.', 1800);
  });

  it('keeps F and Space on the successful reel-in path when a bite is ready', () => {
    const runtime = createRuntimeHarness();
    runtime.resolveFishingReelIn = vi.fn();
    runtime.fishingSession = makeFishingSession({ hasPendingBite: true, biteWindowRemainingMs: 600, biteWindowDurationMs: 600 });

    runtime.keyDown('f');
    runtime.keyDown(' ');

    expect(runtime.resolveFishingReelIn).toHaveBeenCalledTimes(2);
  });

  it('still cancels the cast on movement', () => {
    const runtime = createRuntimeHarness();
    runtime.fishingSession = makeFishingSession();
    runtime.heldDirections = ['right'];
    runtime.canStepTo = vi.fn(() => true);

    runtime.tryMovementFromInput();

    expect(runtime.fishingSession).toBeNull();
    expect(runtime.showMessage).toHaveBeenCalledWith('Cancelled Cast', 1000);
    expect(runtime.moveStep).not.toBeNull();
  });
});

describe('GameRuntime fishing cast animation', () => {
  it('plays the fish animation once, then falls back to idle', () => {
    const runtime = createRuntimeHarness();
    const castDuration = runtime.resolveFishingCastAnimationDurationMs('right');
    runtime.fishingSession = makeFishingSession({
      castAnimationDurationMs: castDuration,
      castAnimationElapsedMs: 0,
      waitRemainingMs: 1000,
    });

    expect(runtime.getActiveFishingCastAnimationFrameIndex('right')).toBe(30);

    runtime.tickFishing(130);
    expect(runtime.fishingSession.castAnimationElapsedMs).toBe(130);
    expect(runtime.getActiveFishingCastAnimationFrameIndex('right')).toBe(31);

    runtime.tickFishing(300);
    expect(runtime.fishingSession.castAnimationElapsedMs).toBe(castDuration);
    expect(runtime.getActiveFishingCastAnimationFrameIndex('right')).toBe(-1);
    expect(runtime.getSpriteFrameIndex(runtime.playerSpriteConfig, 'right', false, 0)).toBe(10);
  });

  it('skips the fish animation when the sprite does not define one', () => {
    const playerSpriteConfig = makePlayerSprite({
      animationSets: {
        idle: {
          up: [1],
          down: [2],
          left: [3],
          right: [10],
        },
        walk: {
          up: [1, 5],
          down: [2, 6],
          left: [3, 7],
          right: [4, 8],
        },
      },
    });
    const runtime = createRuntimeHarness({ playerSpriteConfig });
    const castDuration = runtime.resolveFishingCastAnimationDurationMs('right');
    runtime.fishingSession = makeFishingSession({
      castAnimationDurationMs: castDuration,
      castAnimationElapsedMs: 0,
    });

    expect(castDuration).toBe(0);
    expect(runtime.getActiveFishingCastAnimationFrameIndex('right')).toBe(-1);
  });
});

describe('GameRuntime fishing power', () => {
  it('guarantees a bite when power is 1', () => {
    const runtime = createRuntimeHarness();
    runtime.getRng = vi.fn(() => () => 0.9999);
    runtime.resolveFishingBiteWindowMs = vi.fn(() => 1200);
    runtime.fishingSession = makeFishingSession({
      power: 1,
      fishFrequency: 0.01,
      waitRemainingMs: 0,
      waitDurationMs: 1000,
      hasPendingBite: false,
    });

    runtime.tickFishing(16);

    expect(runtime.fishingSession?.hasPendingBite).toBe(true);
    expect(runtime.startDialogue).not.toHaveBeenCalled();
  });

  it('still allows no-bite outcomes at lower power', () => {
    const runtime = createRuntimeHarness();
    runtime.getRng = vi.fn(() => () => 0.9999);
    runtime.fishingSession = makeFishingSession({
      power: 0,
      fishFrequency: 0.5,
      waitRemainingMs: 0,
      waitDurationMs: 1000,
      hasPendingBite: false,
    });

    runtime.tickFishing(16);

    expect(runtime.fishingSession).toBeNull();
    expect(runtime.startDialogue).toHaveBeenCalledWith('Fishing', ['No bites right now.']);
  });
});
