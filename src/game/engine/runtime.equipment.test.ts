import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import type { CritterDefinition, PlayerCritterCollectionEntry, PlayerCritterProgress } from '@/game/critters/types';
import { PLAYER_CRITTER_PROGRESS_VERSION } from '@/game/critters/types';
import type { GameItemDefinition, PlayerItemInventory } from '@/game/items/types';
import { PLAYER_ITEM_INVENTORY_VERSION } from '@/game/items/types';
import type { EquipmentEffectDefinition } from '@/game/equipmentEffects/types';

const EMPTY_STATS = { hp: 0, attack: 0, defense: 0, speed: 0 } as const;

function createCritter(input: {
  id: number;
  name: string;
  level: number;
  extraEquipSlots?: number;
}): CritterDefinition {
  return {
    id: input.id,
    name: input.name,
    element: 'bloom',
    rarity: 'common',
    description: '',
    spriteUrl: '',
    baseStats: { hp: 20, attack: 10, defense: 8, speed: 7 },
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
        missions: [],
        requiredMissionCount: 0,
        statDelta: { ...EMPTY_STATS },
        unlockEquipSlots: input.extraEquipSlots ?? 0,
        abilityUnlockIds: [],
        skillUnlockIds: [],
      },
    ],
  };
}

function createProgressEntry(
  critter: CritterDefinition,
  input?: Partial<PlayerCritterCollectionEntry>,
): PlayerCritterCollectionEntry {
  return {
    critterId: critter.id,
    unlocked: input?.unlocked ?? true,
    unlockedAt: input?.unlockedAt ?? null,
    unlockSource: input?.unlockSource ?? null,
    level: input?.level ?? 1,
    currentHp: input?.currentHp ?? critter.baseStats.hp,
    missionProgress: {},
    statBonus: { ...EMPTY_STATS },
    effectiveStats: { ...critter.baseStats },
    unlockedAbilityIds: [],
    equippedSkillIds: [null, null, null, null],
    equippedEquipmentAnchors: input?.equippedEquipmentAnchors ?? [],
    lastProgressAt: null,
  };
}

function createEquipmentItem(input: {
  id: string;
  name: string;
  equipSize: number;
  effectIds?: string[];
}): GameItemDefinition {
  return {
    id: input.id,
    name: input.name,
    category: 'equipment',
    description: '',
    imageUrl: '',
    misuseText: '',
    successText: '',
    effectType: 'equip_effect',
    effectConfig: {
      equipSize: input.equipSize,
      equipmentEffectIds: input.effectIds ?? [],
    },
    consumable: false,
    maxStack: 99,
    isActive: true,
    starterGrantAmount: 0,
  };
}

function inventory(entries: Array<{ itemId: string; quantity: number }>): PlayerItemInventory {
  return {
    version: PLAYER_ITEM_INVENTORY_VERSION,
    entries,
  };
}

function createRuntimeHarness(input: {
  critters: CritterDefinition[];
  collection: PlayerCritterCollectionEntry[];
  squad: Array<number | null>;
  items: GameItemDefinition[];
  itemInventory: PlayerItemInventory;
  equipmentEffects?: EquipmentEffectDefinition[];
}) {
  const runtime = Object.create(GameRuntime.prototype) as any;
  runtime.critterDatabase = input.critters;
  runtime.critterLookup = input.critters.reduce<Record<number, CritterDefinition>>((registry, critter) => {
    registry[critter.id] = critter;
    return registry;
  }, {});
  runtime.playerCritterProgress = {
    version: PLAYER_CRITTER_PROGRESS_VERSION,
    unlockedSquadSlots: 8,
    squad: [...input.squad],
    collection: input.collection,
    lockedKnockoutTargetCritterId: null,
  } as PlayerCritterProgress;
  runtime.itemDatabase = input.items;
  runtime.itemById = input.items.reduce<Record<string, GameItemDefinition>>((registry, item) => {
    registry[item.id] = item;
    return registry;
  }, {});
  runtime.playerItemInventory = input.itemInventory;
  runtime.equipmentEffectLibrary = input.equipmentEffects ?? [];
  runtime.equipmentEffectLookupById = (input.equipmentEffects ?? []).reduce<Record<string, EquipmentEffectDefinition>>(
    (registry, effect) => {
      registry[effect.effect_id] = effect;
      return registry;
    },
    {},
  );
  runtime.skillLookupById = {};
  runtime.skillEffectLookupById = {};
  runtime.markProgressDirty = vi.fn();
  runtime.showMessage = vi.fn();
  runtime.sideStoryMissions = {};
  runtime.activeBattle = null;
  runtime.dialogue = null;
  runtime.healPrompt = null;
  runtime.shopPrompt = null;
  runtime.activeCutscene = null;
  runtime.starterSelection = null;
  runtime.activeScriptedScene = null;
  runtime.currentMapId = 'spawn';
  runtime.preloadMapVisualAssets = vi.fn();
  runtime.areMapVisualAssetsReady = vi.fn(() => true);
  return runtime as GameRuntime & { [key: string]: any };
}

describe('GameRuntime equipment integration', () => {
  it('requires selecting a squad critter when using equipment from backpack', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', level: 1 });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [createProgressEntry(critter, { level: 1 })],
      squad: [1, null, null, null, null, null, null, null],
      items: [createEquipmentItem({ id: 'simple-helmet', name: 'Simple Helmet', equipSize: 1 })],
      itemInventory: inventory([{ itemId: 'simple-helmet', quantity: 1 }]),
    });

    expect(runtime.useBackpackItem('simple-helmet')).toBe(false);
    expect((runtime as any).showMessage).toHaveBeenCalledWith('Choose a squad critter to equip.', 2200);
    const entry = (runtime as any).playerCritterProgress.collection[0] as PlayerCritterCollectionEntry;
    expect(entry.equippedEquipmentAnchors).toEqual([]);
  });

  it('auto-equips equipment from backpack to the first valid slot and does not consume the item', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', level: 2, extraEquipSlots: 1 });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [
        createProgressEntry(critter, {
          level: 2,
          equippedEquipmentAnchors: [{ itemId: 'starter-charm', slotIndex: 0 }],
        }),
      ],
      squad: [1, null, null, null, null, null, null, null],
      items: [
        createEquipmentItem({ id: 'starter-charm', name: 'Starter Charm', equipSize: 1 }),
        createEquipmentItem({ id: 'simple-helmet', name: 'Simple Helmet', equipSize: 1 }),
      ],
      itemInventory: inventory([
        { itemId: 'starter-charm', quantity: 1 },
        { itemId: 'simple-helmet', quantity: 1 },
      ]),
    });
    const inventoryBefore = JSON.parse(JSON.stringify((runtime as any).playerItemInventory)) as PlayerItemInventory;

    expect(runtime.useBackpackItemOnSquadSlot('simple-helmet', 0)).toBe(true);
    const entry = (runtime as any).playerCritterProgress.collection[0] as PlayerCritterCollectionEntry;
    expect(entry.equippedEquipmentAnchors).toEqual([
      { itemId: 'starter-charm', slotIndex: 0 },
      { itemId: 'simple-helmet', slotIndex: 1 },
    ]);
    expect((runtime as any).playerItemInventory).toEqual(inventoryBefore);
  });

  it('prevents backpack equipment use when contiguous slots are unavailable', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', level: 2, extraEquipSlots: 1 });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [
        createProgressEntry(critter, {
          level: 2,
          equippedEquipmentAnchors: [{ itemId: 'starter-charm', slotIndex: 0 }],
        }),
      ],
      squad: [1, null, null, null, null, null, null, null],
      items: [
        createEquipmentItem({ id: 'starter-charm', name: 'Starter Charm', equipSize: 1 }),
        createEquipmentItem({ id: 'heavy-armor', name: 'Heavy Armor', equipSize: 2 }),
      ],
      itemInventory: inventory([
        { itemId: 'starter-charm', quantity: 1 },
        { itemId: 'heavy-armor', quantity: 1 },
      ]),
    });

    expect(runtime.useBackpackItemOnSquadSlot('heavy-armor', 0)).toBe(false);
    const entry = (runtime as any).playerCritterProgress.collection[0] as PlayerCritterCollectionEntry;
    expect(entry.equippedEquipmentAnchors).toEqual([{ itemId: 'starter-charm', slotIndex: 0 }]);
    expect((runtime as any).showMessage).toHaveBeenCalledWith('Heavy Armor needs 2 contiguous empty equip slots.', 2200);
  });

  it('prevents equipping duplicate equipment via backpack use on the same critter', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', level: 2, extraEquipSlots: 1 });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [
        createProgressEntry(critter, {
          level: 2,
          equippedEquipmentAnchors: [{ itemId: 'simple-helmet', slotIndex: 0 }],
        }),
      ],
      squad: [1, null, null, null, null, null, null, null],
      items: [createEquipmentItem({ id: 'simple-helmet', name: 'Simple Helmet', equipSize: 1 })],
      itemInventory: inventory([{ itemId: 'simple-helmet', quantity: 2 }]),
    });

    expect(runtime.useBackpackItemOnSquadSlot('simple-helmet', 0)).toBe(false);
    expect((runtime as any).showMessage).toHaveBeenCalledWith('Buddo already has Simple Helmet equipped.', 2200);
  });

  it('enforces ownership quantity across critters via backpack equipment use', () => {
    const critterA = createCritter({ id: 1, name: 'A', level: 1 });
    const critterB = createCritter({ id: 2, name: 'B', level: 1 });
    const runtime = createRuntimeHarness({
      critters: [critterA, critterB],
      collection: [createProgressEntry(critterA, { level: 1 }), createProgressEntry(critterB, { level: 1 })],
      squad: [1, 2, null, null, null, null, null, null],
      items: [createEquipmentItem({ id: 'simple-helmet', name: 'Simple Helmet', equipSize: 1 })],
      itemInventory: inventory([{ itemId: 'simple-helmet', quantity: 1 }]),
    });

    expect(runtime.useBackpackItemOnSquadSlot('simple-helmet', 0)).toBe(true);
    expect(runtime.useBackpackItemOnSquadSlot('simple-helmet', 1)).toBe(false);
    expect((runtime as any).showMessage).toHaveBeenCalledWith('No unequipped copies of Simple Helmet are available.', 2200);
  });

  it('computes equippable equipment quantities in backpack summary', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', level: 1 });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [
        createProgressEntry(critter, {
          level: 1,
          equippedEquipmentAnchors: [{ itemId: 'simple-helmet', slotIndex: 0 }],
        }),
      ],
      squad: [1, null, null, null, null, null, null, null],
      items: [
        createEquipmentItem({ id: 'simple-helmet', name: 'Simple Helmet', equipSize: 1 }),
        createEquipmentItem({ id: 'heavy-armor', name: 'Heavy Armor', equipSize: 1 }),
        {
          ...createEquipmentItem({ id: 'soft-ore', name: 'Soft Ore', equipSize: 1 }),
          category: 'material',
          effectType: 'other_stub',
          consumable: true,
        } as GameItemDefinition,
      ],
      itemInventory: inventory([
        { itemId: 'simple-helmet', quantity: 2 },
        { itemId: 'heavy-armor', quantity: 1 },
        { itemId: 'soft-ore', quantity: 3 },
      ]),
    });

    const summary = (runtime as any).getBackpackSummary() as {
      items: Array<{
        itemId: string;
        hasUseAction: boolean;
        canUse: boolean;
        quantityEquippable?: number;
        equippedByCritters?: Array<{ critterId: number; critterName: string; spriteUrl: string }>;
      }>;
    };
    const helmet = summary.items.find((item) => item.itemId === 'simple-helmet');
    const armor = summary.items.find((item) => item.itemId === 'heavy-armor');
    const ore = summary.items.find((item) => item.itemId === 'soft-ore');
    expect(helmet).toMatchObject({ hasUseAction: true, canUse: true, quantityEquippable: 1 });
    expect(armor).toMatchObject({ hasUseAction: true, canUse: true, quantityEquippable: 1 });
    expect(ore).toMatchObject({ hasUseAction: false, canUse: false });
    expect(helmet?.equippedByCritters).toEqual([
      {
        critterId: 1,
        critterName: 'Buddo',
        spriteUrl: '',
      },
    ]);
    expect(armor?.equippedByCritters).toEqual([]);
  });

  it('locks equipment use in backpack summary when all copies are already equipped', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', level: 1 });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [
        createProgressEntry(critter, {
          level: 1,
          equippedEquipmentAnchors: [{ itemId: 'simple-helmet', slotIndex: 0 }],
        }),
      ],
      squad: [1, null, null, null, null, null, null, null],
      items: [createEquipmentItem({ id: 'simple-helmet', name: 'Simple Helmet', equipSize: 1 })],
      itemInventory: inventory([{ itemId: 'simple-helmet', quantity: 1 }]),
    });

    const summary = (runtime as any).getBackpackSummary() as {
      items: Array<{ itemId: string; canUse: boolean; quantityEquippable?: number }>;
    };
    const helmet = summary.items.find((item) => item.itemId === 'simple-helmet');
    expect(helmet).toMatchObject({ canUse: false, quantityEquippable: 0 });
  });

  it('prevents equipping multi-slot items when contiguous slots are unavailable', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', level: 1, extraEquipSlots: 0 });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [createProgressEntry(critter, { level: 1 })],
      squad: [1, null, null, null, null, null, null, null],
      items: [createEquipmentItem({ id: 'heavy-armor', name: 'Heavy Armor', equipSize: 2 })],
      itemInventory: inventory([{ itemId: 'heavy-armor', quantity: 1 }]),
    });

    expect(runtime.equipEquipmentItem(1, 0, 'heavy-armor')).toBe(false);
    const entry = (runtime as any).playerCritterProgress.collection[0] as PlayerCritterCollectionEntry;
    expect(entry.equippedEquipmentAnchors).toEqual([]);
  });

  it('prevents equipping duplicate copies of the same item on one critter', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', level: 2, extraEquipSlots: 1 });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [createProgressEntry(critter, { level: 2 })],
      squad: [1, null, null, null, null, null, null, null],
      items: [createEquipmentItem({ id: 'simple-helmet', name: 'Simple Helmet', equipSize: 1 })],
      itemInventory: inventory([{ itemId: 'simple-helmet', quantity: 2 }]),
    });

    expect(runtime.equipEquipmentItem(1, 0, 'simple-helmet')).toBe(true);
    expect(runtime.equipEquipmentItem(1, 1, 'simple-helmet')).toBe(false);
    const entry = (runtime as any).playerCritterProgress.collection[0] as PlayerCritterCollectionEntry;
    expect(entry.equippedEquipmentAnchors).toEqual([{ itemId: 'simple-helmet', slotIndex: 0 }]);
  });

  it('enforces ownership quantity across critters', () => {
    const critterA = createCritter({ id: 1, name: 'A', level: 1 });
    const critterB = createCritter({ id: 2, name: 'B', level: 1 });
    const runtime = createRuntimeHarness({
      critters: [critterA, critterB],
      collection: [createProgressEntry(critterA, { level: 1 }), createProgressEntry(critterB, { level: 1 })],
      squad: [1, 2, null, null, null, null, null, null],
      items: [createEquipmentItem({ id: 'simple-helmet', name: 'Simple Helmet', equipSize: 1 })],
      itemInventory: inventory([{ itemId: 'simple-helmet', quantity: 1 }]),
    });

    expect(runtime.equipEquipmentItem(1, 0, 'simple-helmet')).toBe(true);
    expect(runtime.equipEquipmentItem(2, 0, 'simple-helmet')).toBe(false);
  });

  it('unequips all equipment when a critter is removed from the squad', () => {
    const critterA = createCritter({ id: 1, name: 'Buddo', level: 1 });
    const critterB = createCritter({ id: 2, name: 'Sprout', level: 1 });
    const runtime = createRuntimeHarness({
      critters: [critterA, critterB],
      collection: [
        createProgressEntry(critterA, {
          level: 1,
          equippedEquipmentAnchors: [{ itemId: 'simple-helmet', slotIndex: 0 }],
        }),
        createProgressEntry(critterB, { level: 1 }),
      ],
      squad: [1, 2, null, null, null, null, null, null],
      items: [createEquipmentItem({ id: 'simple-helmet', name: 'Simple Helmet', equipSize: 1 })],
      itemInventory: inventory([{ itemId: 'simple-helmet', quantity: 1 }]),
    });

    expect(runtime.clearSquadSlot(0)).toBe(true);
    expect((runtime as any).playerCritterProgress.squad[0]).toBeNull();
    const removedCritter = (runtime as any).playerCritterProgress.collection[0] as PlayerCritterCollectionEntry;
    expect(removedCritter.equippedEquipmentAnchors).toEqual([]);
  });

  it('unequips all equipment when a critter is swapped out of a squad slot', () => {
    const critterA = createCritter({ id: 1, name: 'Buddo', level: 1 });
    const critterB = createCritter({ id: 2, name: 'Sprout', level: 1 });
    const critterC = createCritter({ id: 3, name: 'Moss', level: 1 });
    const runtime = createRuntimeHarness({
      critters: [critterA, critterB, critterC],
      collection: [
        createProgressEntry(critterA, {
          level: 1,
          equippedEquipmentAnchors: [{ itemId: 'simple-helmet', slotIndex: 0 }],
        }),
        createProgressEntry(critterB, { level: 1 }),
        createProgressEntry(critterC, { level: 1 }),
      ],
      squad: [1, 3, null, null, null, null, null, null],
      items: [createEquipmentItem({ id: 'simple-helmet', name: 'Simple Helmet', equipSize: 1 })],
      itemInventory: inventory([{ itemId: 'simple-helmet', quantity: 1 }]),
    });

    expect(runtime.assignCritterToSquadSlot(0, 2)).toBe(true);
    expect((runtime as any).playerCritterProgress.squad[0]).toBe(2);
    const replacedCritter = (runtime as any).playerCritterProgress.collection[0] as PlayerCritterCollectionEntry;
    expect(replacedCritter.equippedEquipmentAnchors).toEqual([]);
  });

  it('applies equipment effects to battle stats and squad snapshot overrides', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', level: 2, extraEquipSlots: 1 });
    const effects: EquipmentEffectDefinition[] = [
      {
        effect_id: 'def-flat-3',
        effect_name: 'Defense +3',
        description: 'Raises defense by 3.',
        iconUrl: 'https://example.com/def-icon.png',
        modifiers: [{ stat: 'defense', mode: 'flat', value: 3 }],
      },
      {
        effect_id: 'hp-percent-20',
        effect_name: 'HP +20%',
        description: 'Raises HP by 20%.',
        modifiers: [{ stat: 'hp', mode: 'percent', value: 0.2 }],
      },
    ];
    const equippedItem = createEquipmentItem({
      id: 'simple-helmet',
      name: 'Simple Helmet',
      equipSize: 2,
      effectIds: ['def-flat-3', 'hp-percent-20'],
    });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [
        createProgressEntry(critter, {
          level: 2,
          currentHp: 20,
          equippedEquipmentAnchors: [{ itemId: 'simple-helmet', slotIndex: 0 }],
        }),
      ],
      squad: [1, null, null, null, null, null, null, null],
      items: [equippedItem],
      itemInventory: inventory([{ itemId: 'simple-helmet', quantity: 1 }]),
      equipmentEffects: effects,
    });

    const team = (runtime as any).buildPlayerBattleTeam() as Array<{ defense: number; maxHp: number; equipmentEffectIds: string[] }>;
    expect(team[0]?.defense).toBe(11);
    expect(team[0]?.maxHp).toBe(24);
    expect(team[0]?.equipmentEffectIds).toEqual(['def-flat-3', 'hp-percent-20']);

    const summary = (runtime as any).getCritterSummary() as {
      squadSlots: Array<{
        equipmentAdjustedStats: { hp: number; defense: number } | null;
        equipmentSlots: Array<{ itemId: string } | null>;
      }>;
    };
    const firstSlot = summary.squadSlots[0];
    expect(firstSlot.equipmentAdjustedStats?.defense).toBe(11);
    expect(firstSlot.equipmentAdjustedStats?.hp).toBe(24);
    expect(firstSlot.equipmentSlots).toHaveLength(2);
    expect(firstSlot.equipmentSlots[0]?.itemId).toBe('simple-helmet');
    expect(firstSlot.equipmentSlots[1]?.itemId).toBe('simple-helmet');
    expect((firstSlot.equipmentSlots[0] as any)?.effectIconUrls ?? []).toContain('https://example.com/def-icon.png');
  });

  it('appends equipment source name to battle effect icon tooltips', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', level: 1 });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [
        createProgressEntry(critter, {
          level: 1,
          equippedEquipmentAnchors: [{ itemId: 'basic-helmet', slotIndex: 0 }],
        }),
      ],
      squad: [1, null, null, null, null, null, null, null],
      items: [
        createEquipmentItem({
          id: 'basic-helmet',
          name: 'Basic Helmet',
          equipSize: 1,
          effectIds: ['def-flat-2'],
        }),
      ],
      itemInventory: inventory([{ itemId: 'basic-helmet', quantity: 1 }]),
      equipmentEffects: [
        {
          effect_id: 'def-flat-2',
          effect_name: 'Defense +2',
          description: '+2 Defense',
          iconUrl: 'https://example.com/def-flat-2.png',
          modifiers: [{ stat: 'defense', mode: 'flat', value: 2 }],
        },
      ],
    });

    const team = (runtime as any).buildPlayerBattleTeam();
    const snapshotEntry = (runtime as any).mapBattleTeamEntryToSnapshot(team[0]);
    expect(snapshotEntry.activeEffectDescriptions).toContain('+2 Defense (Basic Helmet)');
  });

  it('appends skill source name to battle effect icon tooltips', () => {
    const critter = createCritter({ id: 1, name: 'Buddo', level: 1 });
    const runtime = createRuntimeHarness({
      critters: [critter],
      collection: [createProgressEntry(critter, { level: 1 })],
      squad: [1, null, null, null, null, null, null, null],
      items: [],
      itemInventory: inventory([]),
    });
    (runtime as any).skillEffectLookupById = {
      'focus-def': {
        effect_id: 'focus-def',
        effect_name: 'Focus Defense',
        effect_type: 'def_buff',
        buffPercent: 0.2,
        description: '+<buff> Defense',
        iconUrl: 'https://example.com/focus-def.png',
      },
    };
    (runtime as any).skillLookupById = {
      'iron-wall': {
        skill_id: 'iron-wall',
        skill_name: 'Iron Wall',
        element: 'stone',
        type: 'support',
        effectIds: ['focus-def'],
      },
    };

    const snapshotEntry = (runtime as any).mapBattleTeamEntryToSnapshot({
      slotIndex: 0,
      critterId: 1,
      name: 'Buddo',
      element: 'bloom',
      spriteUrl: '',
      level: 1,
      maxHp: 20,
      currentHp: 20,
      attack: 10,
      defense: 8,
      speed: 7,
      fainted: false,
      knockoutProgressCounted: false,
      attackModifier: 1,
      defenseModifier: 1,
      speedModifier: 1,
      activeEffectIds: ['focus-def'],
      activeEffectSourceById: {
        'focus-def': 'Iron Wall',
      },
      equipmentEffectIds: [],
      equipmentEffectSourceById: {},
      persistentHeal: null,
      consecutiveSuccessfulGuardCount: 0,
      equippedSkillIds: ['iron-wall', null, null, null],
    });
    expect(snapshotEntry.activeEffectDescriptions).toContain('+20 Defense (Iron Wall)');
  });
});
