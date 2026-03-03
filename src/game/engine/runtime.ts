import { DIALOGUES } from '@/game/data/dialogues';
import { AUTOSAVE_INTERVAL_MS, MOVE_DURATION_MS, TILE_SIZE, WARP_COOLDOWN_MS } from '@/shared/constants';
import type { Direction, Vector2 } from '@/shared/types';
import { SAVE_VERSION, createNewSave, loadSave, persistSave } from '@/game/saves/saveManager';
import type { SaveProfile } from '@/game/saves/types';
import { BASE_CRITTER_DATABASE } from '@/game/critters/baseDatabase';
import {
  buildCritterLookup,
  computeCritterDerivedProgress,
  computeCritterUnlockedEquipSlots,
  createDefaultPlayerCritterProgress,
  missionProgressKey,
  sanitizeCritterDatabase,
  sanitizePlayerCritterProgress,
} from '@/game/critters/schema';
import {
  MAX_SQUAD_SLOTS,
  isKnockoutMissionType,
  type CritterDefinition,
  type CritterElement,
  type CritterStats,
  type EquippedEquipmentAnchor,
  type EquippedSkillSlots,
  type CritterLevelMissionRequirement,
  type PlayerCritterProgress,
} from '@/game/critters/types';
import { areEquippedSkillSlotsEqual, equipSkillInUniqueSlot } from '@/game/critters/equippedSkills';
import {
  canEquipAtSlot,
  removeEquipmentAtSlot,
  resolveEquipmentState,
  type EquippedEquipmentSlot,
  type ResolvedEquipmentState,
} from '@/game/critters/equipmentSlots';
import { sanitizeEncounterTableLibrary } from '@/game/encounters/schema';
import type {
  EncounterTableCritterEntry,
  EncounterTableDefinition,
  EncounterTableEntry,
  EncounterTableItemEntry,
} from '@/game/encounters/types';
import { collisionEdgeMaskAt, createMap, isInsideMap, tileAt } from '@/game/world/mapBuilder';
import { atlasIndexToColumnRow } from '@/game/world/atlasCoords';
import { CUSTOM_TILESET_CONFIG, type CustomTilesetConfig } from '@/game/world/customTiles';
import { PLAYER_SPRITE_CONFIG } from '@/game/world/playerSprite';
import { BASE_TILE_DEFINITIONS, BLANK_TILE_CODE, FALLBACK_TILE_CODE, TILE_DEFINITIONS } from '@/game/world/tiles';
import {
  DEFAULT_NPC_CHARACTER_LIBRARY,
  DEFAULT_NPC_SPRITE_LIBRARY,
  DEFAULT_STORY_NPC_SPRITE_LIBRARY,
  normalizeCoreStoryNpcCharacters,
  type NpcCharacterTemplateEntry,
  type NpcSpriteLibraryEntry,
} from '@/game/world/npcCatalog';
import { NPC_LAYER_ORDER_ID } from '@/game/world/types';
import type {
  InteractionDefinition,
  NpcInteractionActionDefinition,
  NpcDefinition,
  NpcItemRewardDefinition,
  NpcMovementGuardDefinition,
  NpcStoryStateDefinition,
  NpcSpriteConfig,
  TileDefinition,
  WorldMapInput,
  WarpDefinition,
  WorldMap,
} from '@/game/world/types';
import { readStoredWorldContent } from '@/game/content/worldContentStore';
import type { SkillDefinition, SkillEffectDefinition, ElementChart } from '@/game/skills/types';
import { DEFAULT_TACKLE_SKILL } from '@/game/skills/types';
import {
  buildDefaultElementChart,
  getElementChartMultiplier,
  sanitizeElementChart,
  sanitizeSkillEffectLibrary,
  sanitizeSkillLibrary,
} from '@/game/skills/schema';
import {
  createDefaultPlayerItemInventory,
  getItemInventoryQuantity,
  sanitizeItemCatalog,
  sanitizePlayerItemInventory,
  setItemInventoryQuantity,
} from '@/game/items/schema';
import type { GameItemDefinition, ItemEffectType, PlayerItemInventory } from '@/game/items/types';
import { sanitizeShopCatalog } from '@/game/shops/schema';
import type { ShopDefinition, ShopEntryDefinition } from '@/game/shops/types';
import type { EquipmentEffectDefinition, EquipmentEffectModifier, EquipmentEffectStat } from '@/game/equipmentEffects/types';
import { sanitizeEquipmentEffectLibrary } from '@/game/equipmentEffects/schema';

interface MoveStep {
  from: Vector2;
  to: Vector2;
  elapsed: number;
  duration: number;
}

interface DialogueState {
  speaker: string;
  lines: string[];
  index: number;
  setFlag?: string;
  healSquad?: boolean;
  rewardItems?: NpcItemRewardDefinition[];
  rewardSetFlag?: string;
}

interface HealPromptState {
  speaker: string;
  text: string;
}

interface ShopPromptState {
  npcName: string;
  title: string;
  shopId: string;
}

interface TransientMessage {
  text: string;
  remainingMs: number;
}

interface FishingSessionState {
  mapId: string;
  groupId: string;
  tableId: string;
  fishFrequency: number;
  targetTile: Vector2;
  itemId: string;
  itemName: string;
  power: number;
  hasPendingBite: boolean;
  waitDurationMs: number;
  waitRemainingMs: number;
  biteWindowRemainingMs: number;
  biteWindowDurationMs: number;
}

interface RuntimeImageState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  url: string | null;
  image: HTMLImageElement | null;
}

interface NpcRuntimeState {
  position: Vector2;
  anchorPosition: Vector2;
  facing: Direction;
  turnTimerMs: number;
  moveStep: MoveStep | null;
  moveCooldownMs: number;
  patternIndex: number;
  patternDirection: 1 | -1;
  animationMs: number;
  /** Alternates 0/1 each cell moved; used for half-cycle walk animation (first leg / second leg). */
  stridePhase: number;
}

interface NpcSpriteSheetState {
  status: 'loading' | 'ready' | 'error';
  image: HTMLImageElement | null;
  columns: number;
}

interface PerTileTilesetState {
  status: 'loading' | 'ready' | 'error';
  image: HTMLImageElement | null;
  requestedTileWidth: number;
  requestedTileHeight: number;
  sourceCellWidth: number;
  sourceCellHeight: number;
  columns: number;
  rows: number;
  cellCount: number;
}

interface MapTilesetRequirements {
  usesGlobalTileset: boolean;
  perTileTilesets: Array<{
    key: string;
    url: string;
    tileWidth: number;
    tileHeight: number;
  }>;
}

interface ResolvedNpcDefinition extends NpcDefinition {
  __characterKey: string;
  __sourceMapId: string;
  __instanceKey: string;
}

interface StarterSelectionState {
  confirmCritterId: number | null;
  optionCritterIds: number[];
}

interface StoryCutsceneState {
  id: 'jacob-duel-intro';
  phase: 'entering' | 'awaiting-battle' | 'post-battle-dialogue' | 'exiting';
  path: Vector2[];
}

interface ScriptedSceneState {
  npcStateKey: string;
  npcId: string;
  steps: NpcInteractionActionDefinition[];
  stepIndex: number;
  stepStarted: boolean;
  waitRemainingMs: number;
  path: Vector2[] | null;
}

type BattleTransitionEffect = 'scanline' | 'radial-burst' | 'shutter-slice';
type BattlePhase = 'transition' | 'choose-starter' | 'player-turn' | 'choose-swap' | 'result';
type BattleResult = 'ongoing' | 'won' | 'lost' | 'escaped';
type BattleSourceType = 'wild' | 'npc';

type BattleEquippedSkillSlots = [string | null, string | null, string | null, string | null];

interface BattleCritterState {
  slotIndex: number | null;
  critterId: number;
  name: string;
  element: string;
  spriteUrl: string;
  level: number;
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  speed: number;
  fainted: boolean;
  knockoutProgressCounted: boolean;
  attackModifier: number;
  defenseModifier: number;
  speedModifier: number;
  /** Effect IDs currently applied to this critter (e.g. stat buffs from skills they used). Cleared on switch/KO. */
  activeEffectIds: string[];
  /** Passive equipment effect IDs active for this critter in battle. */
  equipmentEffectIds: string[];
  consecutiveSuccessfulGuardCount: number;
  /** Player team only: skill ids for 4 slots. */
  equippedSkillIds?: BattleEquippedSkillSlots;
}

interface BattleSourceState {
  type: BattleSourceType;
  mapId: string;
  label: string;
  groupId?: string;
  npcId?: string;
}

interface PendingNpcInteractBattleDefeat {
  npc: NpcDefinition;
  defeatedFlag: string;
  rewards: NpcItemRewardDefinition[];
}

interface PendingNpcInteractBattleStart {
  npc: NpcDefinition;
  defeatedFlag: string;
  rewards: NpcItemRewardDefinition[];
}

interface PendingNpcShopStart {
  npc: NpcDefinition;
}

interface PendingGuardBattleDefeat {
  npc: NpcDefinition;
  guard: NpcMovementGuardDefinition;
  defeatedFlag?: string;
  rewards: NpcItemRewardDefinition[];
}

interface PendingBattleRewardDialogue {
  speaker: string;
  lines: string[];
  rewards: NpcItemRewardDefinition[];
}

interface BattleRuntimeState {
  id: number;
  source: BattleSourceState;
  phase: BattlePhase;
  result: BattleResult;
  transitionEffect: BattleTransitionEffect;
  transitionDurationMs: number;
  transitionRemainingMs: number;
  turnNumber: number;
  logLine: string;
  playerTeam: BattleCritterState[];
  opponentTeam: BattleCritterState[];
  playerActiveIndex: number | null;
  opponentActiveIndex: number | null;
  pendingOpponentSwitchIndex: number | null;
  pendingOpponentSwitchDelayMs: number;
  pendingOpponentSwitchAnnouncementShown: boolean;
  pendingForcedSwap: boolean;
  narrationQueue: BattleNarrationEvent[];
  activeNarration: BattleNarrationEvent | null;
  activeAnimation: BattleAnimationState | null;
  pendingKnockoutResolution: BattlePendingKnockoutResolution | null;
  nextAnimationToken: number;
}

interface BattleNarrationEvent {
  message: string;
  attacker: 'player' | 'opponent' | null;
  /** When present, apply this damage to the defender when this event is shown (so HP bars update in attack order). */
  applyDamageDefender?: 'player' | 'opponent';
  applyDamageAmount?: number;
}

interface BattleAnimationState {
  attacker: 'player' | 'opponent';
  remainingMs: number;
  durationMs: number;
  token: number;
}

interface BattlePendingKnockoutResolution {
  defenderTeam: 'player' | 'opponent';
  remainingMs: number;
  playerAttackerCritterId: number | null;
}

export interface RuntimeBattleSnapshot {
  id: number;
  phase: BattlePhase;
  result: BattleResult;
  source: BattleSourceState;
  transition: {
    effect: BattleTransitionEffect;
    remainingMs: number;
    totalMs: number;
  } | null;
  turnNumber: number;
  logLine: string;
  playerActiveIndex: number | null;
  opponentActiveIndex: number | null;
  playerTeam: Array<{
    slotIndex: number | null;
    critterId: number;
    name: string;
    element: string;
    spriteUrl: string;
    level: number;
    maxHp: number;
    currentHp: number;
    attack: number;
    defense: number;
    speed: number;
    fainted: boolean;
    activeEffectIds: string[];
    activeEffectIconUrls: string[];
    activeEffectDescriptions: string[];
  }>;
  opponentTeam: Array<{
    slotIndex: number | null;
    critterId: number;
    name: string;
    element: string;
    spriteUrl: string;
    level: number;
    maxHp: number;
    currentHp: number;
    attack: number;
    defense: number;
    speed: number;
    fainted: boolean;
    activeEffectIds: string[];
    activeEffectIconUrls: string[];
    activeEffectDescriptions: string[];
  }>;
  canAttack: boolean;
  canGuard: boolean;
  canSwap: boolean;
  canRetreat: boolean;
  canCancelSwap: boolean;
  canAdvanceNarration: boolean;
  /** Resolved skill info for the active player critter's 4 slots (for Attack sub-menu). */
  playerActiveSkillSlots: Array<{
    skillId: string;
    name: string;
    element: string;
    type: string;
    damage?: number;
    healPercent?: number;
    effectDescriptions?: string;
    effectIconUrls?: string[];
  } | null>;
  activeAnimation:
    | {
        attacker: 'player' | 'opponent';
        token: number;
      }
    | null;
  requiresStarterSelection: boolean;
  requiresSwapSelection: boolean;
}

export interface RuntimeSnapshot {
  playerName: string;
  mapName: string;
  mapId: string;
  objective: string;
  message: string | null;
  warpHint: string | null;
  dialogue: {
    speaker: string;
    text: string;
    lineIndex: number;
    totalLines: number;
  } | null;
  saveStatus: 'Saved' | 'Unsaved';
  lastSavedAt: string | null;
  lastEncounter: {
    mapId: string;
    groupId: string;
    critterId: number;
    critterName: string;
    level: number;
  } | null;
  battle: RuntimeBattleSnapshot | null;
  story: {
    inputLocked: boolean;
    starterSelection: {
      confirmCritterId: number | null;
      options: Array<{
        critterId: number;
        name: string;
        element: string;
        rarity: string;
        spriteUrl: string;
        description: string;
      }>;
    } | null;
    healPrompt: {
      speaker: string;
      text: string;
    } | null;
    shopPrompt: {
      npcName: string;
      title: string;
      shopId: string;
      entries: Array<{
        entryId: string;
        kind: 'item' | 'critter';
        name: string;
        quantity: number;
        imageUrl: string;
        repeatable: boolean;
        oneTimePurchased: boolean;
        affordable: boolean;
        disableReason: string | null;
        costs: Array<{
          itemId: string;
          itemName: string;
          itemImageUrl: string;
          requiredQuantity: number;
          ownedQuantity: number;
        }>;
      }>;
    } | null;
  };
  fishing: {
    isCasting: boolean;
    biteReady: boolean;
    targetTile: { x: number; y: number } | null;
    remainingMs: number | null;
    power: number | null;
  };
  critters: {
    unlockedCount: number;
    totalCount: number;
    unlockedSquadSlots: number;
    maxSquadSlots: number;
    lockedKnockoutTracker: {
      selectedCritterId: number | null;
      selectedCritterName: string | null;
      eligibleCritterIds: number[];
      missionRows: Array<{
        id: string;
        type: string;
        targetValue: number;
        currentValue: number;
        completed: boolean;
        knockoutElements?: string[];
        knockoutCritterIds?: number[];
        knockoutCritterNames?: string[];
        requiredEquippedItemCount?: number;
        requiredEquippedItemIds?: string[];
        requiredEquippedItemNames?: string[];
        requiredHealingItemIds?: string[];
        requiredHealingItemNames?: string[];
      }>;
    };
    squadSlots: Array<{
      index: number;
      unlocked: boolean;
      critterId: number | null;
      critterName: string | null;
      level: number | null;
      currentHp: number | null;
      maxHp: number | null;
      equipmentAdjustedStats: {
        hp: number;
        attack: number;
        defense: number;
        speed: number;
      } | null;
      equipmentSlots: Array<{
        itemId: string;
        itemName: string;
        imageUrl: string;
        equipSize: number;
        anchorSlotIndex: number;
        spanIndex: number;
        effectIconUrls: string[];
        effectDescriptions: string[];
      } | null>;
    }>;
    collection: Array<{
      critterId: number;
      name: string;
      element: string;
      rarity: string;
      spriteUrl: string;
      unlocked: boolean;
      lockedKnockoutTargetEligible: boolean;
      lockedKnockoutTargetSelected: boolean;
      level: number;
      maxLevel: number;
      currentHp: number | null;
      maxHp: number | null;
      canAdvance: boolean;
      advanceActionLabel: 'Unlock' | 'Level Up' | null;
      missionCompletions: number | null;
      baseStats: {
        hp: number;
        attack: number;
        defense: number;
        speed: number;
      };
      statBonus: {
        hp: number;
        attack: number;
        defense: number;
        speed: number;
      };
      effectiveStats: {
        hp: number;
        attack: number;
        defense: number;
        speed: number;
      };
      abilities: Array<{
        id: string;
        name: string;
        kind: string;
        description: string;
        unlocked: boolean;
      }>;
      unlockedAbilityIds: string[];
      equippedSkillSlots: Array<{
        skillId: string;
        name: string;
        element: string;
        type: string;
        damage?: number;
        healPercent?: number;
        effectDescriptions?: string;
        effectIconUrls?: string[];
      } | null>;
      unlockedSkillIds: string[];
      unlockedSkillOptions: Array<{ skillId: string; name: string }>;
      levelProgress: Array<{
        level: number;
        requiredMissionCount: number;
        completedMissionCount: number;
        completed: boolean;
        missions: Array<{
          id: string;
          type: string;
          targetValue: number;
          currentValue: number;
          completed: boolean;
          ascendsFromCritterId?: number;
          ascendsFromCritterName?: string;
          knockoutElements?: string[];
          knockoutCritterIds?: number[];
          knockoutCritterNames?: string[];
          requiredEquippedItemCount?: number;
          requiredEquippedItemIds?: string[];
          requiredEquippedItemNames?: string[];
          requiredHealingItemIds?: string[];
          requiredHealingItemNames?: string[];
          storyFlagId?: string;
          label?: string;
        }>;
      }>;
      activeRequirement: {
        level: number;
        targetLevel: number;
        requiredMissionCount: number;
        completedMissionCount: number;
        completed: boolean;
        missions: Array<{
          id: string;
          type: string;
          targetValue: number;
          currentValue: number;
          completed: boolean;
          ascendsFromCritterId?: number;
          ascendsFromCritterName?: string;
          knockoutElements?: string[];
          knockoutCritterIds?: number[];
          knockoutCritterNames?: string[];
          requiredEquippedItemCount?: number;
          requiredEquippedItemIds?: string[];
          requiredEquippedItemNames?: string[];
          requiredHealingItemIds?: string[];
          requiredHealingItemNames?: string[];
          storyFlagId?: string;
          label?: string;
        }>;
      } | null;
    }>;
  };
  backpack: {
    totalOwnedKinds: number;
    totalOwnedCount: number;
    categories: string[];
    items: Array<{
      itemId: string;
      name: string;
      category: string;
      description: string;
      imageUrl: string;
      misuseText: string;
      effectType: ItemEffectType;
      effectSummary: string;
      equipSize?: number;
      quantityEquippable?: number;
      equippedByCritters?: Array<{
        critterId: number;
        critterName: string;
        spriteUrl: string;
      }>;
      consumable: boolean;
      isActive: boolean;
      quantityOwned: number;
      hasUseAction: boolean;
      canUse: boolean;
    }>;
  };
}

const DIRECTION_DELTAS: Record<Direction, Vector2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const COLLISION_EDGE_BIT: Record<Direction, number> = {
  up: 1,
  right: 2,
  down: 4,
  left: 8,
};

const UNCLE_HANK_NPC_ID = 'uncle-hank-story';
const JACOB_NPC_ID = 'jacob-story';
const STARTER_ENCOUNTER_TABLE_ID = 'starter-critter';
const FLAG_DEMO_START = 'demo-start';
const FLAG_SELECTED_STARTER = 'selected-starter-critter';
const FLAG_STARTER_SELECTION_DONE = 'starter-selection-done';
const FLAG_DEMO_DONE = 'demo-done';
const FLAG_JACOB_LEFT_HOUSE = 'jacob-left-house';
const FLAG_JACOB_BATTLE_WON = 'jacob-battle-won';

const DEFAULT_RESPAWN_MAP_ID = 'user-house';
const DEFAULT_RESPAWN_POSITION = { x: 5, y: 7 } as const;
const DEFAULT_RESPAWN_FACING = 'down' as const;

const SPAWN_MAP_INPUT: WorldMapInput = {
  id: 'spawn',
  name: 'Portlock Beach',
  layers: [
    {
      id: 1,
      name: 'Base',
      tiles: Array.from({ length: 9 }, () => '.'.repeat(11)),
      rotations: Array.from({ length: 9 }, () => '0'.repeat(11)),
      collisionEdges: Array.from({ length: 9 }, () => '0'.repeat(11)),
      visible: true,
      collision: true,
    },
  ],
  npcs: [],
  warps: [],
  interactions: [],
};

export interface RuntimeInitOptions {
  forceNewGame?: boolean;
  playerName?: string;
}

/** Keep URLs stable so browser and CDN caches can accelerate recurring loads. */
function resolveAssetUrl(url: string): string {
  return url.trim();
}

const DEFAULT_FISHING_POWER = 0.2;
const FISHING_POWER_MIN = 0;
const FISHING_POWER_MAX = 1;
const FISHING_MIN_BITE_WAIT_MS = 900;
const FISHING_MAX_BITE_WAIT_MS = 4200;
const FISHING_MIN_BITE_WINDOW_MS = 1000;
const FISHING_MAX_BITE_WINDOW_MS = 7000;
const BATTLE_KNOCKOUT_RESOLUTION_DELAY_MS = 520;

export class GameRuntime {
  private mapRegistry: Record<string, WorldMap> = buildMapRegistryFromInputs([SPAWN_MAP_INPUT], TILE_DEFINITIONS);
  private tileDefinitions: Record<string, TileDefinition> = TILE_DEFINITIONS;
  private critterDatabase: CritterDefinition[] = [...BASE_CRITTER_DATABASE];
  private critterLookup: Record<number, CritterDefinition> = buildCritterLookup(BASE_CRITTER_DATABASE);
  private encounterTables: EncounterTableDefinition[] = [];
  private encounterTableLookup: Record<string, EncounterTableDefinition> = {};
  private skillDatabase: SkillDefinition[] = [];
  private skillLookupById: Record<string, SkillDefinition> = {};
  private skillEffectLibrary: SkillEffectDefinition[] = [];
  private skillEffectLookupById: Record<string, SkillEffectDefinition> = {};
  private equipmentEffectLibrary: EquipmentEffectDefinition[] = [];
  private equipmentEffectLookupById: Record<string, EquipmentEffectDefinition> = {};
  private elementChart: ElementChart = buildDefaultElementChart();
  private itemDatabase: GameItemDefinition[] = [];
  private itemById: Record<string, GameItemDefinition> = {};
  private shopCatalog: ShopDefinition[] = [];
  private shopById: Record<string, ShopDefinition> = {};
  private playerItemInventory: PlayerItemInventory = createDefaultPlayerItemInventory();
  private npcSpriteLibrary: NpcSpriteLibraryEntry[] = [
    ...DEFAULT_NPC_SPRITE_LIBRARY,
    ...DEFAULT_STORY_NPC_SPRITE_LIBRARY,
  ];
  private npcCharacterLibrary: NpcCharacterTemplateEntry[] = normalizeCoreStoryNpcCharacters([
    ...DEFAULT_NPC_CHARACTER_LIBRARY,
  ]);
  private customTilesetConfig: CustomTilesetConfig | null = CUSTOM_TILESET_CONFIG;
  private playerSpriteConfig: NpcSpriteConfig = PLAYER_SPRITE_CONFIG;
  private currentMapId: string;
  private playerPosition: Vector2;
  private facing: Direction;
  private respawnMapId = DEFAULT_RESPAWN_MAP_ID;
  private respawnPosition: Vector2 = { x: DEFAULT_RESPAWN_POSITION.x, y: DEFAULT_RESPAWN_POSITION.y };
  private respawnFacing: Direction = DEFAULT_RESPAWN_FACING;
  private moveStep: MoveStep | null = null;
  private heldDirections: Direction[] = [];
  private dialogue: DialogueState | null = null;
  private healPrompt: HealPromptState | null = null;
  private shopPrompt: ShopPromptState | null = null;
  private flags: Record<string, boolean>;
  private mainStoryStageId: string | null = null;
  private sideStoryStageId: string | null = null;
  private sideStoryFlags: Record<string, boolean> = {};
  private sideStoryMissions: SaveProfile['progressTracking']['sideStory']['missions'] = {};
  private playerName: string;
  private selectedStarterId: string | null;
  private playerCritterProgress: PlayerCritterProgress = createDefaultPlayerCritterProgress();
  private playerAnimationMs = 0;
  /** Alternates 0/1 each cell moved; used for half-cycle walk animation (first leg / second leg). */
  private playerStridePhase = 0;
  private warpCooldownMs = 0;
  private autosaveMs = AUTOSAVE_INTERVAL_MS;
  private dirty = false;
  private lastSavedAt: string | null = null;
  private transientMessage: TransientMessage | null = null;
  private fishingSession: FishingSessionState | null = null;
  private fishingBiteIcon: RuntimeImageState = {
    status: 'idle',
    url: null,
    image: null,
  };
  private lastEncounter: RuntimeSnapshot['lastEncounter'] = null;
  private activeBattle: BattleRuntimeState | null = null;
  private starterSelection: StarterSelectionState | null = null;
  private activeCutscene: StoryCutsceneState | null = null;
  private activeScriptedScene: ScriptedSceneState | null = null;
  private pendingStoryAction: 'open-starter-selection' | 'start-jacob-battle' | 'start-jacob-exit' | null = null;
  private pendingGuardDefeat: PendingGuardBattleDefeat | null = null;
  private pendingNpcInteractBattleDefeat: PendingNpcInteractBattleDefeat | null = null;
  private pendingNpcInteractBattleStart: PendingNpcInteractBattleStart | null = null;
  private pendingNpcShopStart: PendingNpcShopStart | null = null;
  private pendingBattleRewardDialogue: PendingBattleRewardDialogue | null = null;
  private pendingGuardBattle: { npc: NpcDefinition; guard: NpcMovementGuardDefinition } | null = null;
  private nextBattleId = 1;
  private warpHintLabel: string | null = null;
  private npcRuntimeStates: Record<string, NpcRuntimeState> = {};
  private lastNpcResetMapId: string | null = null;
  private npcSpriteSheets: Record<string, NpcSpriteSheetState> = {};
  private playerSpriteSheet: NpcSpriteSheetState = {
    status: 'error',
    image: null,
    columns: 0,
  };
  private tilesetImage: HTMLImageElement | null = null;
  private tilesetColumns = 0;
  private tilesetRows = 0;
  private tilesetCellCount = 0;
  private tilesetSourceCellWidth = 0;
  private tilesetSourceCellHeight = 0;
  private tilesetLoadState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  /** Per-tile tilesets keyed by URL+tile dimensions (e.g. "url::16x16"). */
  private perTileTilesetCache = new Map<string, PerTileTilesetState>();
  private mapTilesetRequirementsCache = new Map<string, MapTilesetRequirements>();
  private announcedCritterAdvanceKeys = new Set<string>();

  constructor(options?: RuntimeInitOptions) {
    const storedWorldContent = readStoredWorldContent();
    if (storedWorldContent) {
      const tileDefinitionsFromSavedTiles = buildTileDefinitionsFromSavedPaintTiles(storedWorldContent.savedPaintTiles);
      this.tileDefinitions = {
        ...BASE_TILE_DEFINITIONS,
        ...tileDefinitionsFromSavedTiles,
        ...storedWorldContent.customTileDefinitions,
      };
      this.critterDatabase = sanitizeCritterDatabase(storedWorldContent.critters);
      this.critterLookup = buildCritterLookup(this.critterDatabase);
      this.encounterTables = sanitizeEncounterTableLibrary(storedWorldContent.encounterTables);
      this.encounterTableLookup = buildEncounterTableLookup(this.encounterTables);
      this.npcSpriteLibrary = [
        ...sanitizeRuntimeNpcSpriteLibrary(storedWorldContent.npcSpriteLibrary),
        ...DEFAULT_STORY_NPC_SPRITE_LIBRARY,
      ];
      this.npcCharacterLibrary = normalizeCoreStoryNpcCharacters(
        sanitizeRuntimeNpcCharacterLibrary(storedWorldContent.npcCharacterLibrary),
      );
      this.customTilesetConfig = storedWorldContent.customTilesetConfig ?? CUSTOM_TILESET_CONFIG;
      this.playerSpriteConfig = storedWorldContent.playerSpriteConfig ?? PLAYER_SPRITE_CONFIG;

      const registry = buildMapRegistryFromInputs(storedWorldContent.maps, this.tileDefinitions);
      if (Object.keys(registry).length > 0) {
        this.mapRegistry = registry;
      }

      this.skillEffectLibrary = storedWorldContent.skillEffects ?? [];
      this.skillEffectLookupById = (this.skillEffectLibrary as SkillEffectDefinition[]).reduce(
        (acc, e) => {
          acc[e.effect_id] = e;
          return acc;
        },
        {} as Record<string, SkillEffectDefinition>,
      );
      this.equipmentEffectLibrary = sanitizeEquipmentEffectLibrary(storedWorldContent.equipmentEffects ?? []);
      this.equipmentEffectLookupById = this.equipmentEffectLibrary.reduce(
        (acc, effect) => {
          acc[effect.effect_id] = effect;
          return acc;
        },
        {} as Record<string, EquipmentEffectDefinition>,
      );
      const knownEffectIds = new Set(this.skillEffectLibrary.map((e) => e.effect_id));
      this.skillDatabase = sanitizeSkillLibrary(storedWorldContent.critterSkills, knownEffectIds);
      this.skillLookupById = (this.skillDatabase as SkillDefinition[]).reduce(
        (acc, s) => {
          acc[s.skill_id] = s;
          return acc;
        },
        {} as Record<string, SkillDefinition>,
      );
      this.elementChart = sanitizeElementChart(storedWorldContent.elementChart) ?? buildDefaultElementChart();
      this.itemDatabase = sanitizeItemCatalog(storedWorldContent.items);
      this.shopCatalog = sanitizeShopCatalog(storedWorldContent.shops);
    }
    this.itemById = buildItemLookup(this.itemDatabase);
    this.shopById = buildShopLookup(this.shopCatalog);

    const save = !options?.forceNewGame ? loadSave() : null;
    const hasUsableSave = Boolean(save && this.isValidSave(save));
    const state = hasUsableSave ? (save as SaveProfile) : createNewSave(options?.playerName ?? 'Player');

    this.currentMapId = state.currentMapId;
    this.playerPosition = { x: state.player.x, y: state.player.y };
    this.facing = state.player.facing;
    const resolvedRespawn = this.resolveRespawnPoint(state.respawnPoint);
    this.respawnMapId = resolvedRespawn.mapId;
    this.respawnPosition = resolvedRespawn.position;
    this.respawnFacing = resolvedRespawn.facing;
    this.flags = { ...state.progressTracking.mainStory.flags };
    let migratedMainStoryFlags = false;
    if (this.flags[FLAG_DEMO_DONE] && !this.flags[FLAG_JACOB_LEFT_HOUSE]) {
      this.flags[FLAG_JACOB_LEFT_HOUSE] = true;
      migratedMainStoryFlags = true;
    }
    if ((this.flags[FLAG_DEMO_DONE] || this.flags[FLAG_JACOB_LEFT_HOUSE]) && !this.flags[FLAG_JACOB_BATTLE_WON]) {
      this.flags[FLAG_JACOB_BATTLE_WON] = true;
      migratedMainStoryFlags = true;
    }
    this.mainStoryStageId = state.progressTracking.mainStory.stageId;
    this.sideStoryStageId = state.progressTracking.sideStory.stageId;
    this.sideStoryFlags = { ...state.progressTracking.sideStory.flags };
    this.sideStoryMissions = cloneSideStoryMissionTracking(state.progressTracking.sideStory.missions);
    this.playerName = state.playerName;
    this.selectedStarterId = state.selectedStarterId;
    this.playerCritterProgress = sanitizePlayerCritterProgress(
      state.playerCritterProgress,
      this.critterDatabase,
    );
    if (this.ensureLockedKnockoutTargetSelectionValid()) {
      this.dirty = true;
    }
    this.playerItemInventory = sanitizePlayerItemInventory(state.playerItemInventory, this.itemDatabase);
    if (migratedMainStoryFlags) {
      this.dirty = true;
    }
    if (this.ensureMinimumSquadCritterAssignment()) {
      this.dirty = true;
    }
    this.lastSavedAt = state.updatedAt;
    this.ensureNpcRuntimeState();
    this.preloadKnownNpcSpriteSheets();
    this.ensurePlayerSpriteLoaded();
    this.preloadMapVisualAssets(this.currentMapId);
    this.preloadNeighborMapVisualAssets(this.currentMapId);
    this.ensureFishingBiteIconLoaded();
    this.updateWarpHint();

    const preferredPlayerName = options?.playerName?.trim();
    if (preferredPlayerName && preferredPlayerName !== this.playerName) {
      this.playerName = preferredPlayerName.slice(0, 20);
      this.dirty = true;
    }

    if (!hasUsableSave || options?.forceNewGame || state.version < SAVE_VERSION || this.dirty) {
      this.dirty = true;
      this.persistNow();
    }
  }

  public hasSave(): boolean {
    return loadSave() !== null;
  }

  public keyDown(key: string): void {
    if (this.activeBattle) {
      return;
    }

    if (this.dialogue) {
      this.heldDirections = [];
      if (isInteractKey(key)) {
        this.handleInteract();
      }
      return;
    }

    if (this.healPrompt) {
      this.heldDirections = [];
      if (key === 'y' || key === 'Y' || key === 'Enter' || isInteractKey(key)) {
        this.resolveHealPromptChoice(true);
      } else if (key === 'n' || key === 'N' || key === 'Escape') {
        this.resolveHealPromptChoice(false);
      }
      return;
    }

    if (this.shopPrompt) {
      this.heldDirections = [];
      if (key === 'Escape') {
        this.shopPrompt = null;
      }
      return;
    }

    if (this.isPlayerControlLocked()) {
      return;
    }

    if (this.tryHandleFishingInputKey(key)) {
      return;
    }

    const direction = toDirection(key);
    if (direction) {
      this.pushHeldDirection(direction);
      return;
    }

    if (isInteractKey(key)) {
      this.handleInteract();
    }
  }

  public keyUp(key: string): void {
    if (this.dialogue || this.isPlayerControlLocked()) {
      this.heldDirections = [];
      return;
    }

    const direction = toDirection(key);
    if (!direction) {
      return;
    }

    this.heldDirections = this.heldDirections.filter((held) => held !== direction);
  }

  public update(deltaMs: number): void {
    this.playerAnimationMs += deltaMs;
    this.tickMessage(deltaMs);
    this.tickFishing(deltaMs);
    this.updateStoryState(deltaMs);

    if (this.activeBattle) {
      this.updateBattle(deltaMs);
      this.tickAutosave(deltaMs);
      return;
    }

    this.updateNpcs(deltaMs);

    if (this.warpCooldownMs > 0) {
      this.warpCooldownMs = Math.max(0, this.warpCooldownMs - deltaMs);
    }

    if (this.moveStep) {
      this.moveStep.elapsed += deltaMs;
      if (this.moveStep.elapsed >= this.moveStep.duration) {
        this.playerPosition = { ...this.moveStep.to };
        this.playerStridePhase = (this.playerStridePhase + 1) % 2;
        this.moveStep = null;
        const previousMapId = this.currentMapId;
        this.checkAutomaticWarp();
        if (!this.dialogue && this.currentMapId === previousMapId) {
          this.tryTriggerWalkEncounter();
        }
        this.markDirty();
      }
    } else if (!this.dialogue && !this.isPlayerControlLocked()) {
      this.tryMovementFromInput();
    }

    this.tickAutosave(deltaMs);
    this.updateWarpHint();
    this.maybeShowCritterAdvanceNotice();
  }

  /** Reference viewport size in tiles; canvas never shrinks below this when map camera is smaller. */
  private static readonly REFERENCE_VIEWPORT_TILES = { width: 19, height: 15 };

  /** Viewport size in pixels for the current map (used by GameView to size the canvas). */
  public getViewportSize(): { width: number; height: number } {
    const map = this.getCurrentMap();
    const mapW = map.cameraSize.widthTiles * TILE_SIZE;
    const mapH = map.cameraSize.heightTiles * TILE_SIZE;
    const refW = GameRuntime.REFERENCE_VIEWPORT_TILES.width * TILE_SIZE;
    const refH = GameRuntime.REFERENCE_VIEWPORT_TILES.height * TILE_SIZE;
    return {
      width: Math.max(refW, mapW),
      height: Math.max(refH, mapH),
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const map = this.getCurrentMap();
    this.preloadMapVisualAssets(map.id);
    this.preloadNeighborMapVisualAssets(map.id);
    const mapAssetsReady = this.areMapVisualAssetsReady(map.id);
    const mapNpcs = this.getNpcsForMap(map.id);
    const playerRenderPos = this.getPlayerRenderPosition();

    const viewTilesX = map.cameraSize.widthTiles;
    const viewTilesY = map.cameraSize.heightTiles;
    const viewPixelW = viewTilesX * TILE_SIZE;
    const viewPixelH = viewTilesY * TILE_SIZE;

    let cameraX: number;
    let cameraY: number;
    if (map.width <= viewTilesX) {
      cameraX = -(viewTilesX - map.width) / 2;
    } else {
      cameraX = playerRenderPos.x - viewTilesX / 2;
      cameraX = Math.max(0, Math.min(map.width - viewTilesX, cameraX));
    }
    if (map.height <= viewTilesY) {
      cameraY = -(viewTilesY - map.height) / 2;
    } else {
      cameraY = playerRenderPos.y - viewTilesY / 2;
      cameraY = Math.max(0, Math.min(map.height - viewTilesY, cameraY));
    }

    ctx.fillStyle = '#101419';
    ctx.fillRect(0, 0, width, height);

    const offsetX = (width - viewPixelW) / 2;
    const offsetY = (height - viewPixelH) / 2;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.beginPath();
    ctx.rect(0, 0, viewPixelW, viewPixelH);
    ctx.clip();

    if (!mapAssetsReady) {
      ctx.fillStyle = '#101419';
      ctx.fillRect(0, 0, viewPixelW, viewPixelH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Loading ${map.name}...`, Math.round(viewPixelW / 2), Math.round(viewPixelH / 2));
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
      return;
    }

    const startX = Math.floor(cameraX) - 1;
    const endX = Math.ceil(cameraX + viewTilesX) + 1;
    const startY = Math.floor(cameraY) - 1;
    const endY = Math.ceil(cameraY + viewTilesY) + 1;
    const cameraPixelX = Math.round(cameraX * TILE_SIZE);
    const cameraPixelY = Math.round(cameraY * TILE_SIZE);

    type DepthDrawEntry = {
      depthY: number;
      layerOrder: number;
      kind: 'overlay' | 'actor';
      draw: () => void;
    };

    const depthDraws: DepthDrawEntry[] = [];
    const visibleLayers = map.layers
      .filter((layer) => layer.visible)
      .sort((left, right) => left.orderId - right.orderId);

    for (const layer of visibleLayers) {
      for (let y = startY; y < endY; y += 1) {
        const tileRow = layer.tiles[y];
        if (!tileRow) {
          continue;
        }
        const rotationRow = layer.rotations[y] ?? [];
        for (let x = startX; x < endX; x += 1) {
          if (x < 0 || x >= tileRow.length) {
            continue;
          }

          const code = tileRow[x];
          if (!code || code === BLANK_TILE_CODE) {
            continue;
          }

          const tile = this.getTileDefinition(code);
          const screenX = x * TILE_SIZE - cameraPixelX;
          const screenY = y * TILE_SIZE - cameraPixelY;
          const tileTransform = sanitizeTileTransformValue(rotationRow[x] ?? 0);

          // Draw atlas first so transparent pixels on higher layers reveal lower layers.
          // Only use color fallback when atlas art is unavailable for this tile.
          const isOverhead = this.shouldDepthSortTile(layer.orderId, tile);
          if (!isOverhead) {
            const drewAtlas = this.drawTileFromTileset(ctx, tile, screenX, screenY, tileTransform);
            if (!drewAtlas) {
              this.drawTile(ctx, tile.color, tile.accentColor ?? tile.color, screenX, screenY, tile.height);
            }
          } else {
            depthDraws.push({
              depthY: y + 1,
              layerOrder: layer.orderId,
              kind: 'overlay',
              draw: () => {
                const drewOverlayAtlas = this.drawTileFromTileset(ctx, tile, screenX, screenY, tileTransform);
                if (!drewOverlayAtlas) {
                  this.drawTile(ctx, tile.color, tile.accentColor ?? tile.color, screenX, screenY, tile.height);
                }
              },
            });
          }
        }
      }
    }

    for (const npc of mapNpcs) {
      const npcState = this.getNpcRuntimeState(npc);
      const npcRenderPosition = this.getNpcRenderPosition(npc);
      depthDraws.push({
        depthY: npcRenderPosition.y + 1,
        layerOrder: Number.MAX_SAFE_INTEGER,
        kind: 'actor',
        draw: () => {
          this.drawNpc(ctx, npc, npcRenderPosition, cameraX, cameraY, npcState.facing, npcState.moveStep !== null);
        },
      });
    }

    depthDraws.push({
      depthY: playerRenderPos.y + 1,
      layerOrder: Number.MAX_SAFE_INTEGER,
      kind: 'actor',
      draw: () => {
        this.drawPlayer(ctx, playerRenderPos, cameraX, cameraY, this.facing, this.moveStep !== null);
      },
    });

    depthDraws.sort((a, b) => {
      if (a.depthY !== b.depthY) {
        return a.depthY - b.depthY;
      }
      if (a.kind !== b.kind) {
        // At equal Y: draw actor first, then overlay.
        // This makes same-cell tall tiles (trees/buildings) cover the actor.
        return a.kind === 'actor' ? -1 : 1;
      }
      return a.layerOrder - b.layerOrder;
    });
    for (const entry of depthDraws) {
      entry.draw();
    }

    this.drawFishingCastIndicator(ctx, cameraPixelX, cameraPixelY, playerRenderPos);
    this.drawFishingBiteIndicator(ctx, cameraPixelX, cameraPixelY);

    ctx.restore();

    if (this.transientMessage) {
      const messageText = this.transientMessage.text;
      ctx.font = '16px sans-serif';
      const textWidth = Math.ceil(ctx.measureText(messageText).width);
      const horizontalPadding = 12;
      const boxWidth = Math.max(120, textWidth + horizontalPadding * 2);
      const boxHeight = 38;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(16, 16, boxWidth, boxHeight);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(messageText, 16 + horizontalPadding, 40);
    }
  }

  private drawFishingBiteIndicator(
    ctx: CanvasRenderingContext2D,
    cameraPixelX: number,
    cameraPixelY: number,
  ): void {
    const session = this.fishingSession;
    if (!session?.hasPendingBite) {
      return;
    }
    const drawX = session.targetTile.x * TILE_SIZE - cameraPixelX + TILE_SIZE / 2;
    const drawY = session.targetTile.y * TILE_SIZE - cameraPixelY - TILE_SIZE * 0.56;
    if (this.fishingBiteIcon.status === 'ready' && this.fishingBiteIcon.image) {
      const iconSize = Math.round(TILE_SIZE * 0.8);
      ctx.drawImage(
        this.fishingBiteIcon.image,
        Math.round(drawX - iconSize / 2),
        Math.round(drawY - iconSize / 2),
        iconSize,
        iconSize,
      );
      return;
    }
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = 3;
    ctx.strokeText('!', drawX, drawY);
    ctx.fillStyle = '#ffd94f';
    ctx.fillText('!', drawX, drawY);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  private drawFishingCastIndicator(
    ctx: CanvasRenderingContext2D,
    cameraPixelX: number,
    cameraPixelY: number,
    playerRenderPos: Vector2,
  ): void {
    const session = this.fishingSession;
    if (!session || session.hasPendingBite) {
      return;
    }
    const startX = playerRenderPos.x * TILE_SIZE - cameraPixelX + TILE_SIZE * 0.48;
    const startY = playerRenderPos.y * TILE_SIZE - cameraPixelY + TILE_SIZE * 0.63;
    const targetX = session.targetTile.x * TILE_SIZE - cameraPixelX + TILE_SIZE / 2;
    const targetY = session.targetTile.y * TILE_SIZE - cameraPixelY + TILE_SIZE * 0.54;
    const progress = session.waitDurationMs > 0 ? clamp(1 - session.waitRemainingMs / session.waitDurationMs, 0, 1) : 1;
    const castArc = Math.sin(progress * Math.PI) * TILE_SIZE * 0.24;
    const bobberX = lerp(startX, targetX, progress);
    const bobberY = lerp(startY, targetY, progress) - castArc + Math.sin(this.playerAnimationMs / 140) * 1.2;
    const ripplePulse = 0.65 + Math.sin(this.playerAnimationMs / 190) * 0.35;
    const rippleRadius = TILE_SIZE * (0.12 + 0.05 * ripplePulse);

    ctx.save();
    ctx.strokeStyle = 'rgba(139, 212, 255, 0.64)';
    ctx.lineWidth = Math.max(1, Math.floor(TILE_SIZE / 20));
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(bobberX, bobberY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(116, 197, 245, 0.44)';
    ctx.beginPath();
    ctx.ellipse(targetX, targetY, rippleRadius * 1.5, rippleRadius, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 224, 120, 0.96)';
    ctx.beginPath();
    ctx.arc(bobberX, bobberY, Math.max(2, TILE_SIZE * 0.08), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private ensureFishingBiteIconLoaded(): void {
    if (this.fishingBiteIcon.status === 'loading' || this.fishingBiteIcon.status === 'ready') {
      return;
    }
    const resolvedUrl = this.resolveFishingBiteIconUrl();
    if (!resolvedUrl) {
      this.fishingBiteIcon = {
        status: 'error',
        url: null,
        image: null,
      };
      return;
    }

    this.fishingBiteIcon = {
      status: 'loading',
      url: resolvedUrl,
      image: null,
    };
    const image = new Image();
    image.onload = () => {
      const applyReady = () => {
        this.fishingBiteIcon = {
          status: 'ready',
          url: resolvedUrl,
          image,
        };
      };
      if (typeof image.decode === 'function') {
        image.decode().then(applyReady).catch(applyReady);
      } else {
        applyReady();
      }
    };
    image.onerror = () => {
      this.fishingBiteIcon = {
        status: 'error',
        url: resolvedUrl,
        image: null,
      };
    };
    image.src = resolveAssetUrl(resolvedUrl);
  }

  private resolveFishingBiteIconUrl(): string | null {
    const knownUrls: string[] = [];
    if (this.customTilesetConfig?.url) {
      knownUrls.push(this.customTilesetConfig.url);
    }
    if (this.playerSpriteConfig?.url) {
      knownUrls.push(this.playerSpriteConfig.url);
    }
    for (const item of this.itemDatabase) {
      if (item.imageUrl) {
        knownUrls.push(item.imageUrl);
      }
    }
    for (const effect of this.skillEffectLibrary) {
      if (effect.iconUrl) {
        knownUrls.push(effect.iconUrl);
      }
    }
    for (const effect of this.equipmentEffectLibrary) {
      if (effect.iconUrl) {
        knownUrls.push(effect.iconUrl);
      }
    }

    for (const url of knownUrls) {
      const root = extractSupabasePublicRoot(url);
      if (root) {
        return `${root}/icons/exclaim-icon.png`;
      }
    }
    try {
      const envUrl = (typeof import.meta !== 'undefined' &&
        (import.meta as { env?: { VITE_SUPABASE_URL?: string } }).env?.VITE_SUPABASE_URL) as string | undefined;
      const base = typeof envUrl === 'string' && envUrl.trim() ? envUrl.trim().replace(/\/+$/, '') : '';
      if (base) {
        return `${base}/storage/v1/object/public/icons/exclaim-icon.png`;
      }
    } catch {
      // ignore
    }
    return null;
  }

  public getSnapshot(): RuntimeSnapshot {
    const map = this.getCurrentMap();
    const critterSummary = this.getCritterSummary();
    const backpackSummary = this.getBackpackSummary();

    return {
      playerName: this.playerName,
      mapName: map.name,
      mapId: map.id,
      objective: this.getObjectiveText(),
      message: this.transientMessage?.text ?? null,
      warpHint: this.activeBattle ? null : this.warpHintLabel,
      dialogue: this.dialogue
        ? {
            speaker: this.dialogue.speaker,
            text: this.dialogue.lines[this.dialogue.index],
            lineIndex: this.dialogue.index + 1,
            totalLines: this.dialogue.lines.length,
          }
        : null,
      saveStatus: this.dirty ? 'Unsaved' : 'Saved',
      lastSavedAt: this.lastSavedAt,
      lastEncounter: this.lastEncounter ? { ...this.lastEncounter } : null,
      battle: this.getBattleSnapshot(),
      story: {
        inputLocked: this.isPlayerControlLocked(),
        starterSelection: this.getStarterSelectionSnapshot(),
        healPrompt: this.getHealPromptSnapshot(),
        shopPrompt: this.getShopPromptSnapshot(),
      },
      fishing: this.getFishingSnapshot(),
      critters: critterSummary,
      backpack: backpackSummary,
    };
  }

  public renderGameToText(): string {
    const map = this.getCurrentMap();
    const mapNpcs = this.getNpcsForMap(map.id);
    const playerRenderPosition = this.getPlayerRenderPosition();
    const facingTile = this.getFacingTile();
    const facingTileCode = tileAt(map, facingTile.x, facingTile.y);
    const critterSummary = this.getCritterSummary();
    const backpackSummary = this.getBackpackSummary();

    const activeFlags = Object.keys(this.flags)
      .filter((flag) => this.flags[flag])
      .sort();

    const payload = {
      coordinateSystem: {
        origin: 'top-left tile is (0, 0)',
        xAxis: '+x moves right',
        yAxis: '+y moves down',
      },
      map: {
        id: map.id,
        name: map.name,
        width: map.width,
        height: map.height,
      },
      objective: this.getObjectiveText(),
      player: {
        name: this.playerName,
        tile: { x: this.playerPosition.x, y: this.playerPosition.y },
        render: {
          x: Number(playerRenderPosition.x.toFixed(2)),
          y: Number(playerRenderPosition.y.toFixed(2)),
        },
        facing: this.facing,
        moving: this.moveStep !== null,
        facingTile: {
          x: facingTile.x,
          y: facingTile.y,
          tileCode: facingTileCode,
        },
      },
      warpHint: this.activeBattle ? null : this.warpHintLabel,
      dialogue: this.dialogue
        ? {
            speaker: this.dialogue.speaker,
            text: this.dialogue.lines[this.dialogue.index],
            lineIndex: this.dialogue.index + 1,
            totalLines: this.dialogue.lines.length,
          }
        : null,
      message: this.transientMessage?.text ?? null,
      encounter: this.lastEncounter,
      battle: this.getBattleSnapshot(),
      story: {
        inputLocked: this.isPlayerControlLocked(),
        starterSelection: this.getStarterSelectionSnapshot(),
        healPrompt: this.getHealPromptSnapshot(),
        shopPrompt: this.getShopPromptSnapshot(),
      },
      fishing: this.getFishingSnapshot(),
      flags: activeFlags,
      npcs: mapNpcs.map((npc) => {
        const npcState = this.getNpcRuntimeState(npc);
        const npcRenderPosition = this.getNpcRenderPosition(npc);
        return {
          id: npc.id,
          name: npc.name,
          x: npcRenderPosition.x,
          y: npcRenderPosition.y,
          facing: npcState.facing,
          moving: npcState.moveStep !== null,
          movementType: npc.movement?.type ?? 'static',
          idleAnimation: npc.idleAnimation ?? npc.sprite?.defaultIdleAnimation ?? null,
          moveAnimation: npc.moveAnimation ?? npc.sprite?.defaultMoveAnimation ?? null,
          frameIndex: this.getNpcFrameIndex(npc, npcState.facing, npcState.moveStep !== null),
        };
      }),
      nearbyWarps: map.warps
        .filter((warp) =>
          this.getWarpFromPositions(warp).some((from) => {
            const distance = Math.abs(from.x - this.playerPosition.x) + Math.abs(from.y - this.playerPosition.y);
            return distance <= 2;
          }),
        )
        .map((warp) => ({
          id: warp.id,
          from: warp.from,
          fromPositions: this.getWarpFromPositions(warp),
          toMapId: warp.toMapId,
          requireInteract: Boolean(warp.requireInteract),
          requiredFacing: warp.requiredFacing ?? null,
        })),
      nearbyInteractions: map.interactions
        .filter((interaction) => this.isInteractionVisible(interaction))
        .filter((interaction) => {
          const distance =
            Math.abs(interaction.position.x - this.playerPosition.x) +
            Math.abs(interaction.position.y - this.playerPosition.y);
          return distance <= 2;
        })
        .map((interaction) => ({
          id: interaction.id,
          x: interaction.position.x,
          y: interaction.position.y,
          speaker: interaction.speaker ?? 'Note',
          kind: this.resolveInteractionKind(interaction),
        })),
      save: {
        status: this.dirty ? 'Unsaved' : 'Saved',
        lastSavedAt: this.lastSavedAt,
      },
      critters: {
        unlockedCount: critterSummary.unlockedCount,
        totalCount: critterSummary.totalCount,
        unlockedSquadSlots: critterSummary.unlockedSquadSlots,
        maxSquadSlots: critterSummary.maxSquadSlots,
        squad: critterSummary.squadSlots,
        collection: critterSummary.collection,
      },
      backpack: backpackSummary,
    };

    return JSON.stringify(payload);
  }

  public saveNow(): void {
    this.persistNow();
    this.showMessage('Progress Saved');
  }

  public useBackpackItem(itemId: string): boolean {
    return this.tryUseBackpackItem(itemId, null);
  }

  public useBackpackItemOnSquadSlot(itemId: string, squadSlotIndex: number): boolean {
    return this.tryUseBackpackItem(itemId, squadSlotIndex);
  }

  public chooseHealPrompt(shouldHeal: boolean): boolean {
    return this.resolveHealPromptChoice(shouldHeal);
  }

  public closeShopPrompt(): boolean {
    if (!this.shopPrompt) {
      return false;
    }
    this.shopPrompt = null;
    return true;
  }

  public purchaseShopEntry(entryId: string): boolean {
    const shopPrompt = this.shopPrompt;
    if (!shopPrompt || !entryId.trim()) {
      return false;
    }

    const shop = this.shopById[shopPrompt.shopId];
    if (!shop) {
      return false;
    }
    const entry = shop.entries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      return false;
    }

    if (this.isShopEntryOneTimePurchased(shop.id, entry)) {
      this.showMessage('That entry can only be purchased once.', 2200);
      return false;
    }

    const affordability = this.getShopEntryAffordability(entry);
    if (!affordability.canAfford) {
      this.showMessage(affordability.reason ?? 'You cannot afford that purchase.', 2200);
      return false;
    }

    let nextInventory = this.playerItemInventory;
    for (const cost of entry.costs) {
      const owned = getItemInventoryQuantity(nextInventory, cost.itemId);
      if (owned < cost.quantity) {
        this.showMessage('You do not have enough materials for that purchase.', 2200);
        return false;
      }
      nextInventory = setItemInventoryQuantity(nextInventory, this.itemDatabase, cost.itemId, owned - cost.quantity);
    }

    let purchaseMessage = '';
    if (entry.kind === 'item') {
      const item = this.itemById[entry.itemId];
      if (!item || !item.isActive) {
        this.showMessage('That shop entry is unavailable.', 2200);
        return false;
      }
      const before = getItemInventoryQuantity(nextInventory, item.id);
      nextInventory = setItemInventoryQuantity(nextInventory, this.itemDatabase, item.id, before + entry.quantity);
      const after = getItemInventoryQuantity(nextInventory, item.id);
      if (after - before < entry.quantity) {
        this.showMessage(`${item.name} does not have enough backpack space.`, 2200);
        return false;
      }
      purchaseMessage = `Purchased ${entry.quantity}x ${item.name}.`;
    } else {
      this.flags[entry.unlockFlagId] = true;
      const critterName = this.critterLookup[entry.critterId]?.name ?? `Critter #${entry.critterId}`;
      purchaseMessage = `Purchased ${critterName}.`;
    }

    this.playerItemInventory = nextInventory;
    if (this.isShopEntryOneTime(entry)) {
      this.flags[this.getShopPurchaseFlagKey(shop.id, entry.id)] = true;
    }
    this.markProgressDirty();
    this.showMessage(purchaseMessage, 2200);
    return true;
  }

  private tryUseBackpackItem(itemId: string, squadSlotIndex: number | null): boolean {
    if (this.activeBattle) {
      this.showMessage('Backpack items are unavailable during battle.', 2200);
      return false;
    }
    if (this.dialogue || this.isPlayerControlLocked()) {
      return false;
    }

    const item = this.itemById[itemId];
    if (!item || !item.isActive) {
      return false;
    }
    if (item.category === 'material') {
      this.showItemMisuse(item, 'Materials are used for crafting or shopping.');
      return false;
    }

    const quantity = getItemInventoryQuantity(this.playerItemInventory, item.id);
    if (quantity <= 0) {
      this.showItemMisuse(item, `You do not have any ${item.name}.`);
      return false;
    }

    let used = false;
    if (item.effectType === 'tool_action') {
      used = this.tryUseToolItem(item);
    } else if (item.effectType === 'equip_effect' || item.effectType === 'equip_stub') {
      used = this.tryUseEquipmentItem(item, squadSlotIndex);
    } else if (item.effectType === 'heal_flat' || item.effectType === 'heal_percent') {
      used = this.tryUseHealingItem(item, squadSlotIndex);
    } else {
      const effect = item.effectConfig as { successText?: string };
      this.showMessage(this.resolveItemSuccessText(item, effect.successText?.trim() || `${item.name} used.`), 2000);
      used = true;
    }

    if (!used) {
      return false;
    }

    if (item.consumable) {
      this.playerItemInventory = setItemInventoryQuantity(this.playerItemInventory, this.itemDatabase, item.id, quantity - 1);
      this.markProgressDirty();
    }
    return true;
  }

  public selectStarterCandidate(critterId: number): boolean {
    if (!this.starterSelection) {
      return false;
    }
    if (!this.starterSelection.optionCritterIds.includes(critterId)) {
      return false;
    }
    this.starterSelection.confirmCritterId = critterId;
    return true;
  }

  public cancelStarterCandidate(): boolean {
    if (!this.starterSelection || this.starterSelection.confirmCritterId === null) {
      return false;
    }
    this.starterSelection.confirmCritterId = null;
    return true;
  }

  public confirmStarterCandidate(): boolean {
    if (!this.starterSelection || this.starterSelection.confirmCritterId === null) {
      return false;
    }

    const critterId = this.starterSelection.confirmCritterId;
    const critter = this.critterLookup[critterId];
    if (!critter) {
      return false;
    }

    this.selectedStarterId = String(critter.id);
    this.flags[FLAG_SELECTED_STARTER] = true;
    this.flags[`selected-${critter.element}-starter`] = true;
    this.starterSelection = null;
    this.pendingStoryAction = null;
    const uncleNpc = this.getNpcsForMap(this.currentMapId).find((entry) => entry.id === UNCLE_HANK_NPC_ID);
    if (uncleNpc?.dialogueLines && uncleNpc.dialogueLines.length > 0) {
      this.startDialogue(uncleNpc.dialogueSpeaker ?? uncleNpc.name, uncleNpc.dialogueLines, uncleNpc.dialogueSetFlag);
    } else {
      this.startDialogue('Uncle Hank', ['Try Unlocking your new Critter in your Collection.']);
    }
    this.markProgressDirty();
    return true;
  }

  public tryAdvanceCritter(critterId: number): boolean {
    const critter = this.critterLookup[critterId];
    if (!critter) {
      return false;
    }

    const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === critterId);
    if (!progress) {
      return false;
    }

    const currentLevel = progress.unlocked ? Math.max(1, progress.level) : 0;
    const targetLevel = currentLevel + 1;
    const levelRow = critter.levels.find((entry) => entry.level === targetLevel);
    if (!levelRow) {
      return false;
    }

    const requiredMissionCount = Math.min(levelRow.requiredMissionCount, levelRow.missions.length);
    const completedMissionCount = levelRow.missions.reduce((count, mission) => {
      const currentValue = this.getMissionCurrentValue(
        mission,
        levelRow.level,
        progress.missionProgress,
        levelRow.missions,
      );
      return count + (currentValue >= mission.targetValue ? 1 : 0);
    }, 0);
    if (completedMissionCount < requiredMissionCount) {
      return false;
    }

    const nextLevel = Math.max(1, targetLevel);
    progress.unlocked = true;
    progress.level = nextLevel;
    progress.unlockedAt = progress.unlockedAt ?? new Date().toISOString();
    progress.unlockSource = progress.unlockSource ?? 'missions';
    progress.lastProgressAt = new Date().toISOString();
    const derived = computeCritterDerivedProgress(critter, nextLevel);
    progress.statBonus = derived.statBonus;
    progress.effectiveStats = derived.effectiveStats;
    const equipmentState = this.resolveEquipmentStateForCritter(progress, critter, true);
    const equipmentEffects = this.getEquipmentEffectsFromAnchors(equipmentState.anchors);
    const adjustedStats = this.applyEquipmentEffectsToStats(derived.effectiveStats, equipmentEffects);
    const nextMaxHp = Math.max(1, adjustedStats.hp);
    // Unlocks and level-ups both restore HP to full.
    progress.currentHp = nextMaxHp;
    progress.unlockedAbilityIds = derived.unlockedAbilityIds;
    const newSkillIds = levelRow.skillUnlockIds ?? [];
    const hasNoEquippedSkills = progress.equippedSkillIds.every((id) => id === null);
    if (hasNoEquippedSkills && newSkillIds.length > 0) {
      const next = [...progress.equippedSkillIds] as typeof progress.equippedSkillIds;
      next[0] = newSkillIds[0];
      progress.equippedSkillIds = next;
    }
    const autoAssignedToSquad = currentLevel === 0 && this.tryAutoAssignFirstUnlockedCritter(critter.id);
    this.ensureLockedKnockoutTargetSelectionValid();

    this.markProgressDirty();
    this.showMessage(
      currentLevel === 0
        ? `${critter.name} unlocked${autoAssignedToSquad ? ' and joined your squad!' : '!'}`
        : `${critter.name} reached Lv.${nextLevel}!`,
      5000,
    );

    if (
      currentLevel === 0 &&
      this.flags[FLAG_SELECTED_STARTER] &&
      !this.flags[FLAG_STARTER_SELECTION_DONE] &&
      this.playerCritterProgress.squad.some((entry) => entry === critter.id)
    ) {
      this.flags[FLAG_STARTER_SELECTION_DONE] = true;
      this.markProgressDirty();
    }

    return true;
  }

  public setLockedKnockoutTargetCritter(critterId: number | null): boolean {
    if (critterId === null) {
      if (this.playerCritterProgress.lockedKnockoutTargetCritterId === null) {
        return false;
      }
      this.playerCritterProgress.lockedKnockoutTargetCritterId = null;
      this.markProgressDirty();
      this.showMessage('Cleared locked KO mission target.', 2200);
      return true;
    }

    const normalizedCritterId = Number.isFinite(critterId) ? Math.max(1, Math.floor(critterId)) : -1;
    if (normalizedCritterId < 1) {
      return false;
    }
    const context = this.getLockedKnockoutTargetContext(normalizedCritterId);
    if (!context) {
      return false;
    }
    if (this.playerCritterProgress.lockedKnockoutTargetCritterId === normalizedCritterId) {
      return false;
    }

    this.playerCritterProgress.lockedKnockoutTargetCritterId = normalizedCritterId;
    this.markProgressDirty();
    this.showMessage(`Tracking ${context.critter.name}'s KO missions.`, 2200);
    return true;
  }

  public assignCritterToSquadSlot(slotIndex: number, critterId: number): boolean {
    const safeSlotIndex = Number.isFinite(slotIndex) ? Math.floor(slotIndex) : -1;
    if (
      safeSlotIndex < 0 ||
      safeSlotIndex >= this.playerCritterProgress.squad.length ||
      safeSlotIndex >= this.playerCritterProgress.unlockedSquadSlots
    ) {
      return false;
    }

    const critter = this.critterLookup[critterId];
    if (!critter) {
      return false;
    }

    const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === critterId);
    if (!progress?.unlocked) {
      return false;
    }

    const existingCritterId = this.playerCritterProgress.squad[safeSlotIndex];
    if (existingCritterId !== null && !this.isCritterFullyHealthy(existingCritterId)) {
      this.showMessage('Only fully healthy critters can leave the squad.', 2200);
      return false;
    }

    const existingSlotIndex = this.playerCritterProgress.squad.findIndex((entry) => entry === critterId);
    if (existingSlotIndex >= 0) {
      return false;
    }

    this.playerCritterProgress.squad[safeSlotIndex] = critterId;
    this.markProgressDirty();
    this.showMessage(`${critter.name} joined your squad.`, 2200);
    return true;
  }

  public clearSquadSlot(slotIndex: number): boolean {
    const safeSlotIndex = Number.isFinite(slotIndex) ? Math.floor(slotIndex) : -1;
    if (
      safeSlotIndex < 0 ||
      safeSlotIndex >= this.playerCritterProgress.squad.length ||
      safeSlotIndex >= this.playerCritterProgress.unlockedSquadSlots
    ) {
      return false;
    }

    const currentCritterId = this.playerCritterProgress.squad[safeSlotIndex];
    if (currentCritterId === null) {
      return false;
    }
    if (!this.isCritterFullyHealthy(currentCritterId)) {
      this.showMessage('Only fully healthy critters can leave the squad.', 2200);
      return false;
    }
    if (this.countAssignedSquadCritters() <= 1 && this.hasAnyUnlockedCritter()) {
      this.showMessage('Your squad must keep at least one critter.', 2200);
      return false;
    }

    const critterName = this.critterLookup[currentCritterId]?.name ?? 'Critter';
    this.playerCritterProgress.squad[safeSlotIndex] = null;
    this.markProgressDirty();
    this.showMessage(`${critterName} removed from squad.`, 2000);
    return true;
  }

  public setEquippedSkill(critterId: number, slotIndex: number, skillId: string | null): boolean {
    const slot = Math.floor(slotIndex);
    if (slot < 0 || slot > 3) return false;
    const progress = this.playerCritterProgress.collection.find((e) => e.critterId === critterId);
    if (!progress?.unlocked) return false;
    const critter = this.critterLookup[critterId];
    if (!critter) return false;
    const derived = computeCritterDerivedProgress(critter, progress.level);
    if (skillId !== null) {
      if (!derived.unlockedSkillIds.includes(skillId)) return false;
    } else {
      const equippedCount = progress.equippedSkillIds.filter((id) => id !== null).length;
      if (equippedCount <= 1) return false;
    }
    const next = equipSkillInUniqueSlot(progress.equippedSkillIds, slot, skillId);
    if (areEquippedSkillSlotsEqual(next, progress.equippedSkillIds)) {
      return false;
    }
    progress.equippedSkillIds = next;
    this.markProgressDirty();
    return true;
  }

  public equipEquipmentItem(critterId: number, slotIndex: number, itemId: string): boolean {
    const safeSlotIndex = Number.isFinite(slotIndex) ? Math.floor(slotIndex) : -1;
    const normalizedItemId = sanitizeRuntimeIdentifier(itemId);
    if (safeSlotIndex < 0 || !normalizedItemId) {
      return false;
    }

    const critter = this.critterLookup[critterId];
    const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === critterId);
    if (!critter || !progress?.unlocked) {
      return false;
    }
    const isInSquad = this.playerCritterProgress.squad.some((entry) => entry === critterId);
    if (!isInSquad) {
      return false;
    }

    const item = this.getEquipmentItemById(normalizedItemId);
    if (!item || !item.isActive) {
      return false;
    }
    const slotCount = Math.max(0, computeCritterUnlockedEquipSlots(critter, progress.level));
    if (slotCount <= 0 || safeSlotIndex >= slotCount) {
      return false;
    }

    const currentState = this.resolveEquipmentStateForCritter(progress, critter, false);
    const anchorsWithoutClicked = removeEquipmentAtSlot(currentState, safeSlotIndex);
    const baseState = resolveEquipmentState(anchorsWithoutClicked, slotCount, (id) => this.getEquipmentItemSizeById(id));
    const equipSize = this.getEquipmentItemSizeById(item.id);
    if (
      !canEquipAtSlot({
        state: baseState,
        slotIndex: safeSlotIndex,
        itemId: item.id,
        equipSize,
      })
    ) {
      this.showMessage(`${item.name} needs ${equipSize} contiguous empty equip slot${equipSize === 1 ? '' : 's'}.`, 2400);
      return false;
    }

    const ownedQuantity = getItemInventoryQuantity(this.playerItemInventory, item.id);
    const equippedElsewhereCount = this.countEquippedItemCopies(item.id, {
      critterIdOverride: critterId,
      anchorsOverride: baseState.anchors,
    });
    if (ownedQuantity <= equippedElsewhereCount) {
      this.showMessage(`No unequipped copies of ${item.name} are available.`, 2200);
      return false;
    }

    const nextAnchors = [...baseState.anchors, { itemId: item.id, slotIndex: safeSlotIndex }];
    const nextState = resolveEquipmentState(nextAnchors, slotCount, (id) => this.getEquipmentItemSizeById(id));
    progress.equippedEquipmentAnchors = nextState.anchors;
    this.markProgressDirty();
    this.showMessage(`Equipped ${item.name}.`, 1800);
    return true;
  }

  public unequipEquipmentItem(critterId: number, slotIndex: number): boolean {
    const safeSlotIndex = Number.isFinite(slotIndex) ? Math.floor(slotIndex) : -1;
    if (safeSlotIndex < 0) {
      return false;
    }
    const critter = this.critterLookup[critterId];
    const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === critterId);
    if (!critter || !progress?.unlocked) {
      return false;
    }
    const slotCount = Math.max(0, computeCritterUnlockedEquipSlots(critter, progress.level));
    if (slotCount <= 0 || safeSlotIndex >= slotCount) {
      return false;
    }
    const currentState = this.resolveEquipmentStateForCritter(progress, critter, false);
    const nextAnchors = removeEquipmentAtSlot(currentState, safeSlotIndex);
    if (nextAnchors.length === currentState.anchors.length) {
      return false;
    }
    progress.equippedEquipmentAnchors = nextAnchors;
    this.markProgressDirty();
    this.showMessage('Unequipped item.', 1600);
    return true;
  }

  public battleChooseAction(action: 'guard' | 'swap' | 'retreat'): boolean {
    const battle = this.activeBattle;
    if (
      !battle ||
      battle.phase !== 'player-turn' ||
      battle.result !== 'ongoing' ||
      battle.activeNarration ||
      battle.pendingKnockoutResolution !== null ||
      battle.pendingOpponentSwitchIndex !== null
    ) {
      return false;
    }

    if (action === 'guard') {
      this.resolvePlayerTurnAction(battle, 'guard');
      return true;
    }

    if (action === 'swap') {
      if (!this.hasAvailableSwapTarget(battle)) {
        return false;
      }
      battle.phase = 'choose-swap';
      battle.pendingForcedSwap = false;
      battle.logLine = 'Choose a squad critter to swap in.';
      return true;
    }

    if (action === 'retreat') {
      if (battle.source.type !== 'wild') {
        return false;
      }
      this.setBattleResult(battle, 'escaped', 'You escaped safely.');
      return true;
    }

    return false;
  }

  public battleChooseSkill(skillSlotIndex: number): boolean {
    const battle = this.activeBattle;
    if (
      !battle ||
      battle.phase !== 'player-turn' ||
      battle.result !== 'ongoing' ||
      battle.activeNarration ||
      battle.pendingKnockoutResolution !== null ||
      battle.pendingOpponentSwitchIndex !== null
    ) {
      return false;
    }
    const slot = Math.floor(skillSlotIndex);
    if (slot < 0 || slot > 3) {
      return false;
    }
    const player = this.getActiveBattleCritter(battle, 'player');
    if (!player?.equippedSkillIds) {
      return false;
    }
    const skillId = player.equippedSkillIds[slot];
    if (!skillId) {
      return false;
    }
    const skill = this.skillLookupById[skillId] ?? DEFAULT_TACKLE_SKILL;
    if (!skill) {
      return false;
    }
    this.resolvePlayerTurnAction(battle, 'attack', slot);
    return true;
  }

  public battleSelectSquadSlot(slotIndex: number): boolean {
    const battle = this.activeBattle;
    if (!battle || battle.activeNarration || (battle.phase !== 'choose-starter' && battle.phase !== 'choose-swap')) {
      return false;
    }

    const teamIndex = battle.playerTeam.findIndex((entry) => entry.slotIndex === slotIndex);
    if (teamIndex < 0) {
      return false;
    }

    const selected = battle.playerTeam[teamIndex];
    if (selected.fainted || selected.currentHp <= 0) {
      return false;
    }

    if (battle.phase === 'choose-swap' && !battle.pendingForcedSwap && battle.playerActiveIndex === teamIndex) {
      return false;
    }

    const previousIndex = battle.playerActiveIndex;
    if (previousIndex !== null && battle.playerTeam[previousIndex]) {
      const prev = battle.playerTeam[previousIndex];
      prev.consecutiveSuccessfulGuardCount = 0;
      prev.attackModifier = 1;
      prev.defenseModifier = 1;
      prev.speedModifier = 1;
      prev.activeEffectIds = [];
    }
    battle.playerActiveIndex = teamIndex;

    if (battle.phase === 'choose-starter') {
      if (battle.source.type === 'npc' && battle.opponentActiveIndex === null) {
        const opponentIndex = this.findFirstAliveTeamIndex(battle.opponentTeam);
        if (opponentIndex < 0) {
          this.setBattleResult(battle, 'won', `${battle.source.label} has no available critters.`);
          return true;
        }
        battle.opponentActiveIndex = opponentIndex;
        battle.logLine = `${battle.source.label} selected ${battle.opponentTeam[opponentIndex].name}. Choose your move.`;
      } else {
        battle.logLine = `${selected.name}, I choose you!`;
      }
      battle.phase = 'player-turn';
      return true;
    }

    if (battle.pendingForcedSwap) {
      battle.pendingForcedSwap = false;
      battle.phase = 'player-turn';
      battle.logLine = `${selected.name} stepped in after the knockout.`;
      if (this.incrementSimpleCritterMissionProgress(selected.critterId, (mission) => mission.type === 'swap_in')) {
        this.markProgressDirty();
      }
      return true;
    }

    battle.phase = 'player-turn';
    battle.turnNumber += 1;
    if (this.incrementSimpleCritterMissionProgress(selected.critterId, (mission) => mission.type === 'swap_in')) {
      this.markProgressDirty();
    }
    const previousName =
      previousIndex !== null && battle.playerTeam[previousIndex] ? battle.playerTeam[previousIndex].name : 'Critter';
    this.resolveOpponentCounterAfterSwap(battle, previousName, selected.name);
    return true;
  }

  public cancelBattleSwapSelection(): boolean {
    const battle = this.activeBattle;
    if (!battle || battle.activeNarration || battle.phase !== 'choose-swap' || battle.pendingForcedSwap) {
      return false;
    }
    battle.phase = 'player-turn';
    battle.logLine = 'Choose your move.';
    return true;
  }

  public battleAcknowledgeResult(): boolean {
    if (!this.activeBattle || this.activeBattle.phase !== 'result') {
      return false;
    }
    if (this.activeBattle.result === 'lost' && this.hasAnyUnlockedCritter()) {
      this.performBlackout();
    }
    this.activeBattle = null;
    if (this.pendingBattleRewardDialogue && this.pendingBattleRewardDialogue.rewards.length > 0) {
      this.startDialogue(
        this.pendingBattleRewardDialogue.speaker,
        this.pendingBattleRewardDialogue.lines,
        undefined,
        undefined,
        this.pendingBattleRewardDialogue.rewards,
      );
      this.pendingBattleRewardDialogue = null;
    }
    return true;
  }

  public battleAdvanceNarration(): boolean {
    const battle = this.activeBattle;
    if (!battle || !battle.activeNarration || battle.pendingKnockoutResolution !== null) {
      return false;
    }

    this.advanceBattleNarration(battle);
    return true;
  }

  private isValidSave(save: SaveProfile): boolean {
    return save.currentMapId in this.mapRegistry;
  }

  private getCurrentMap(): WorldMap {
    const map = this.mapRegistry[this.currentMapId];
    if (!map) {
      throw new Error(`Missing map ${this.currentMapId}`);
    }

    return map;
  }

  private getNpcsForMap(mapId: string): ResolvedNpcDefinition[] {
    const resolved: ResolvedNpcDefinition[] = [];
    const seenCharacterKeys = new Set<string>();
    const characterIds = new Set(this.npcCharacterLibrary.map((entry) => entry.id));
    const map = this.mapRegistry[mapId];
    if (!map) {
      return resolved;
    }

    for (const sourceMap of Object.values(this.mapRegistry)) {
      for (const sourceNpc of sourceMap.npcs) {
        // Character-library entries are authoritative for story NPCs.
        if (characterIds.has(sourceNpc.id) || isCoreStoryNpcName(sourceNpc.name)) {
          continue;
        }
        const nextNpc = this.resolveNpcForStory(sourceNpc, sourceMap.id);
        if (nextNpc.npc.requiresFlag && !this.flags[nextNpc.npc.requiresFlag]) {
          continue;
        }
        if (nextNpc.npc.hideIfFlag && this.flags[nextNpc.npc.hideIfFlag]) {
          continue;
        }
        if (nextNpc.mapId !== mapId) {
          continue;
        }
        seenCharacterKeys.add(nextNpc.npc.__characterKey);
        resolved.push(nextNpc.npc);
      }
    }

    const storyCharacters = this.getCharacterStoryNpcsForMap(mapId);
    for (const npc of storyCharacters) {
      if (seenCharacterKeys.has(npc.__characterKey)) {
        continue;
      }
      resolved.push(npc);
    }

    return resolved;
  }

  private resolveNpcForStory(
    baseNpc: NpcDefinition,
    sourceMapId: string,
  ): { mapId: string; npc: ResolvedNpcDefinition } {
    let mapId = sourceMapId;
    let position: Vector2 = { ...baseNpc.position };
    let facing = baseNpc.facing;
    let dialogueId = baseNpc.dialogueId;
    let dialogueLines = baseNpc.dialogueLines ? [...baseNpc.dialogueLines] : undefined;
    let dialogueSpeaker = baseNpc.dialogueSpeaker;
    let dialogueSetFlag = baseNpc.dialogueSetFlag;
    let firstInteractionSetFlag = baseNpc.firstInteractionSetFlag;
    let firstInteractBattle = Boolean(baseNpc.firstInteractBattle);
    let interactBattleRepeatable = Boolean(baseNpc.interactBattleRepeatable);
    let interactBattleDefeatedFlag = baseNpc.interactBattleDefeatedFlag;
    let battleRewards = baseNpc.battleRewards ? baseNpc.battleRewards.map((entry) => ({ ...entry })) : undefined;
    let healer = Boolean(baseNpc.healer);
    let shopId = typeof baseNpc.shopId === 'string' ? baseNpc.shopId.trim() || undefined : undefined;
    let interactionRewards = baseNpc.interactionRewards
      ? baseNpc.interactionRewards.map((entry) => ({ ...entry }))
      : undefined;
    let interactionRewardSetFlag = baseNpc.interactionRewardSetFlag;
    let battleTeamIds = baseNpc.battleTeamIds ? [...baseNpc.battleTeamIds] : undefined;
    let movement = baseNpc.movement
      ? {
          ...baseNpc.movement,
          pattern: baseNpc.movement.pattern ? [...baseNpc.movement.pattern] : undefined,
        }
      : undefined;
    let interactionScript = baseNpc.interactionScript
      ? baseNpc.interactionScript.map((step) => ({ ...step }))
      : undefined;
    let idleAnimation = baseNpc.idleAnimation;
    let moveAnimation = baseNpc.moveAnimation;
    let sprite = baseNpc.sprite;
    let movementGuards = baseNpc.movementGuards
      ? baseNpc.movementGuards.map((guard) => ({
          ...guard,
          dialogueLines: guard.dialogueLines ? [...guard.dialogueLines] : undefined,
          postDuelDialogueLines: guard.postDuelDialogueLines ? [...guard.postDuelDialogueLines] : undefined,
          battleTeamIds: guard.battleTeamIds ? [...guard.battleTeamIds] : undefined,
          battleRewards: guard.battleRewards ? guard.battleRewards.map((entry) => ({ ...entry })) : undefined,
        }))
      : undefined;
    let activeStoryStateKey = 'base';

    const states = Array.isArray(baseNpc.storyStates) ? baseNpc.storyStates : [];
    for (let stateIndex = 0; stateIndex < states.length; stateIndex += 1) {
      const state = states[stateIndex];
      if (state.requiresFlag && !this.flags[state.requiresFlag]) {
        continue;
      }
      activeStoryStateKey = state.id?.trim() || `instance-${stateIndex + 1}`;
      if (state.mapId && this.mapRegistry[state.mapId]) {
        mapId = state.mapId;
      }
      if (state.position) {
        position = { ...state.position };
      }
      if (state.facing) {
        facing = state.facing;
      }
      if (typeof state.dialogueId === 'string' && state.dialogueId.trim()) {
        dialogueId = state.dialogueId;
      }
      if (Array.isArray(state.dialogueLines)) {
        dialogueLines = state.dialogueLines.filter((line) => typeof line === 'string');
      }
      if (typeof state.dialogueSpeaker === 'string' && state.dialogueSpeaker.trim()) {
        dialogueSpeaker = state.dialogueSpeaker;
      }
      if (typeof state.dialogueSetFlag === 'string' && state.dialogueSetFlag.trim()) {
        dialogueSetFlag = state.dialogueSetFlag;
      }
      if (typeof state.firstInteractionSetFlag === 'string' && state.firstInteractionSetFlag.trim()) {
        firstInteractionSetFlag = state.firstInteractionSetFlag;
      }
      if (typeof state.firstInteractBattle === 'boolean') {
        firstInteractBattle = state.firstInteractBattle;
      }
      if (typeof state.interactBattleRepeatable === 'boolean') {
        interactBattleRepeatable = state.interactBattleRepeatable;
      }
      if (typeof state.interactBattleDefeatedFlag === 'string' && state.interactBattleDefeatedFlag.trim()) {
        interactBattleDefeatedFlag = state.interactBattleDefeatedFlag;
      }
      if (Array.isArray(state.battleRewards)) {
        battleRewards = state.battleRewards.map((entry) => ({ ...entry }));
      }
      if (typeof state.healer === 'boolean') {
        healer = state.healer;
      }
      if (typeof state.shopId === 'string') {
        shopId = state.shopId.trim() || undefined;
      }
      if (Array.isArray(state.interactionRewards)) {
        interactionRewards = state.interactionRewards.map((entry) => ({ ...entry }));
      }
      if (typeof state.interactionRewardSetFlag === 'string' && state.interactionRewardSetFlag.trim()) {
        interactionRewardSetFlag = state.interactionRewardSetFlag;
      }
      if (Array.isArray(state.battleTeamIds)) {
        battleTeamIds = state.battleTeamIds
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map((entry) => entry.trim());
      }
      if (state.movement) {
        movement = {
          ...state.movement,
          pattern: state.movement.pattern ? [...state.movement.pattern] : undefined,
        };
      }
      if (Array.isArray(state.interactionScript)) {
        interactionScript = state.interactionScript.map((step) => ({ ...step }));
      }
      if (typeof state.idleAnimation === 'string' && state.idleAnimation.trim()) {
        idleAnimation = state.idleAnimation;
      }
      if (typeof state.moveAnimation === 'string' && state.moveAnimation.trim()) {
        moveAnimation = state.moveAnimation;
      }
      if (state.sprite) {
        sprite = state.sprite;
      }
      if (Array.isArray(state.movementGuards)) {
        movementGuards = state.movementGuards.map((guard) => ({
          ...guard,
          dialogueLines: guard.dialogueLines ? [...guard.dialogueLines] : undefined,
          postDuelDialogueLines: guard.postDuelDialogueLines ? [...guard.postDuelDialogueLines] : undefined,
          battleTeamIds: guard.battleTeamIds ? [...guard.battleTeamIds] : undefined,
          battleRewards: guard.battleRewards ? guard.battleRewards.map((entry) => ({ ...entry })) : undefined,
        }));
      }
    }

    const resolvedNpc: ResolvedNpcDefinition = {
      ...baseNpc,
      position,
      facing,
      dialogueId,
      dialogueLines,
      dialogueSpeaker,
      dialogueSetFlag,
      firstInteractionSetFlag,
      firstInteractBattle,
      interactBattleRepeatable,
      interactBattleDefeatedFlag,
      battleRewards,
      healer,
      shopId,
      interactionRewards,
      interactionRewardSetFlag,
      battleTeamIds,
      movement,
      interactionScript,
      idleAnimation,
      moveAnimation,
      sprite,
      movementGuards,
      __characterKey: `${sourceMapId}:${baseNpc.id}`,
      __sourceMapId: sourceMapId,
      __instanceKey: `${sourceMapId}:${baseNpc.id}:${activeStoryStateKey}`,
    };

    return {
      mapId,
      npc: resolvedNpc,
    };
  }

  private getCharacterStoryNpcsForMap(mapId: string): ResolvedNpcDefinition[] {
    const resolved: ResolvedNpcDefinition[] = [];
    for (const character of this.npcCharacterLibrary) {
      const active = this.resolveActiveCharacterInstance(character);
      if (!active) {
        continue;
      }
      if (active.state.mapId !== mapId) {
        continue;
      }
      const state = active.state;
      if (!state.position) {
        continue;
      }
      const resolvedSprite = this.resolveCharacterSprite(character, state);
      const npc: ResolvedNpcDefinition = {
        id: character.id,
        name: character.npcName,
        position: { ...state.position },
        facing: state.facing ?? character.facing,
        color: character.color || '#9b73b8',
        dialogueId: state.dialogueId ?? character.dialogueId ?? 'custom_npc_dialogue',
        dialogueSpeaker: state.dialogueSpeaker ?? character.dialogueSpeaker,
        dialogueLines: state.dialogueLines ? [...state.dialogueLines] : character.dialogueLines ? [...character.dialogueLines] : undefined,
        dialogueSetFlag: state.dialogueSetFlag ?? character.dialogueSetFlag,
        firstInteractionSetFlag: state.firstInteractionSetFlag ?? character.firstInteractionSetFlag,
        firstInteractBattle:
          typeof state.firstInteractBattle === 'boolean'
            ? state.firstInteractBattle
            : Boolean(character.firstInteractBattle),
        interactBattleRepeatable:
          typeof state.interactBattleRepeatable === 'boolean'
            ? state.interactBattleRepeatable
            : Boolean(character.interactBattleRepeatable),
        interactBattleDefeatedFlag: state.interactBattleDefeatedFlag ?? character.interactBattleDefeatedFlag,
        battleRewards: state.battleRewards
          ? state.battleRewards.map((entry) => ({ ...entry }))
          : character.battleRewards
            ? character.battleRewards.map((entry) => ({ ...entry }))
            : undefined,
        healer: typeof state.healer === 'boolean' ? state.healer : Boolean(character.healer),
        shopId: state.shopId ?? character.shopId,
        interactionRewards: state.interactionRewards
          ? state.interactionRewards.map((entry) => ({ ...entry }))
          : character.interactionRewards
            ? character.interactionRewards.map((entry) => ({ ...entry }))
            : undefined,
        interactionRewardSetFlag: state.interactionRewardSetFlag ?? character.interactionRewardSetFlag,
        battleTeamIds: state.battleTeamIds ? [...state.battleTeamIds] : character.battleTeamIds ? [...character.battleTeamIds] : undefined,
        movement: state.movement
          ? {
              ...state.movement,
              pattern: state.movement.pattern ? [...state.movement.pattern] : undefined,
            }
          : character.movement
            ? {
                ...character.movement,
                pattern: character.movement.pattern ? [...character.movement.pattern] : undefined,
              }
            : undefined,
        idleAnimation: state.idleAnimation ?? character.idleAnimation,
        moveAnimation: state.moveAnimation ?? character.moveAnimation,
        sprite: resolvedSprite,
        movementGuards: state.movementGuards
          ? state.movementGuards.map((guard) => ({
              ...guard,
              dialogueLines: guard.dialogueLines ? [...guard.dialogueLines] : undefined,
              postDuelDialogueLines: guard.postDuelDialogueLines ? [...guard.postDuelDialogueLines] : undefined,
              battleTeamIds: guard.battleTeamIds ? [...guard.battleTeamIds] : undefined,
              battleRewards: guard.battleRewards ? guard.battleRewards.map((entry) => ({ ...entry })) : undefined,
            }))
          : character.movementGuards
            ? character.movementGuards.map((guard) => ({
                ...guard,
                dialogueLines: guard.dialogueLines ? [...guard.dialogueLines] : undefined,
                postDuelDialogueLines: guard.postDuelDialogueLines ? [...guard.postDuelDialogueLines] : undefined,
                battleTeamIds: guard.battleTeamIds ? [...guard.battleTeamIds] : undefined,
                battleRewards: guard.battleRewards ? guard.battleRewards.map((entry) => ({ ...entry })) : undefined,
              }))
            : undefined,
        interactionScript: state.interactionScript
          ? state.interactionScript.map((step) => ({
              ...step,
              ...(step.type === 'dialogue' && Array.isArray(step.lines) ? { lines: [...step.lines] } : {}),
              ...(step.type === 'move_path' && Array.isArray(step.directions) ? { directions: [...step.directions] } : {}),
            }))
          : character.interactionScript
            ? character.interactionScript.map((step) => ({
                ...step,
                ...(step.type === 'dialogue' && Array.isArray(step.lines) ? { lines: [...step.lines] } : {}),
                ...(step.type === 'move_path' && Array.isArray(step.directions) ? { directions: [...step.directions] } : {}),
              }))
            : undefined,
        __characterKey: `character:${character.id}`,
        __sourceMapId: `character:${character.id}`,
        __instanceKey: `character:${character.id}:instance-${active.index + 1}`,
      };
      resolved.push(npc);
    }
    return resolved;
  }

  private resolveActiveCharacterInstance(
    character: NpcCharacterTemplateEntry,
  ): { index: number; state: NpcStoryStateDefinition } | null {
    const states = Array.isArray(character.storyStates) ? character.storyStates : [];
    if (states.length === 0) {
      return null;
    }

    let active: { index: number; state: NpcStoryStateDefinition } | null = null;
    for (let index = 0; index < states.length; index += 1) {
      const state = states[index];
      if (!state || !state.mapId || !state.position || !this.mapRegistry[state.mapId]) {
        continue;
      }
      if (state.requiresFlag && !this.flags[state.requiresFlag]) {
        continue;
      }
      active = { index, state };
    }
    return active;
  }

  private resolveCharacterSprite(
    character: NpcCharacterTemplateEntry,
    state: NpcStoryStateDefinition,
  ): NpcSpriteConfig | undefined {
    if (state.sprite) {
      return {
        ...state.sprite,
        facingFrames: { ...state.sprite.facingFrames },
        walkFrames: state.sprite.walkFrames
          ? {
              up: state.sprite.walkFrames.up ? [...state.sprite.walkFrames.up] : undefined,
              down: state.sprite.walkFrames.down ? [...state.sprite.walkFrames.down] : undefined,
              left: state.sprite.walkFrames.left ? [...state.sprite.walkFrames.left] : undefined,
              right: state.sprite.walkFrames.right ? [...state.sprite.walkFrames.right] : undefined,
            }
          : undefined,
      };
    }

    if (!character.spriteId) {
      return undefined;
    }
    const entry = this.npcSpriteLibrary.find((candidate) => candidate.id === character.spriteId);
    if (!entry) {
      return undefined;
    }
    return {
      ...entry.sprite,
      facingFrames: { ...entry.sprite.facingFrames },
      walkFrames: entry.sprite.walkFrames
        ? {
            up: entry.sprite.walkFrames.up ? [...entry.sprite.walkFrames.up] : undefined,
            down: entry.sprite.walkFrames.down ? [...entry.sprite.walkFrames.down] : undefined,
            left: entry.sprite.walkFrames.left ? [...entry.sprite.walkFrames.left] : undefined,
            right: entry.sprite.walkFrames.right ? [...entry.sprite.walkFrames.right] : undefined,
          }
        : undefined,
    };
  }

  private getTileDefinition(code: string): TileDefinition {
    return this.tileDefinitions[code] ?? this.tileDefinitions[FALLBACK_TILE_CODE];
  }

  private shouldDepthSortTile(layerOrderId: number, tile: TileDefinition): boolean {
    // Layers strictly below the NPC layer (Base and any other floor layers) never participate in y-ordered rendering.
    if (layerOrderId < NPC_LAYER_ORDER_ID) {
      return false;
    }
    const hasExplicitYSort = typeof tile.ySortWithActors === 'boolean';
    const wantsDepthSort = hasExplicitYSort ? Boolean(tile.ySortWithActors) : layerOrderId >= NPC_LAYER_ORDER_ID || tile.height > 0;
    if (!wantsDepthSort) {
      return false;
    }

    // Upper map layers often hold interior furniture/decor where explicit layer order should win over actor y-sorting.
    // Keep these flat so they do not appear visually sliced by per-row depth ordering.
    // Respect explicit per-tile y-sort settings from tile metadata.
    if (!hasExplicitYSort && layerOrderId > NPC_LAYER_ORDER_ID && tile.height <= 0 && this.isFlatCoverTile(tile.label)) {
      return false;
    }
    return true;
  }

  private isFlatCoverTile(label: string): boolean {
    const normalized = label.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return [
      'grass',
      'flower',
      'path',
      'sand',
      'water',
      'floor',
      'ground',
      'healer',
      'hospital',
      'counter',
      'desk',
      'table',
      'bed',
      'machine',
      'terminal',
    ].some((keyword) =>
      normalized.includes(keyword),
    );
  }

  private ensureTilesetLoaded(): void {
    if (this.tilesetLoadState === 'loading' || this.tilesetLoadState === 'ready') {
      return;
    }

    const config = this.customTilesetConfig;
    if (!config || !config.url) {
      this.tilesetLoadState = 'error';
      return;
    }

    this.tilesetLoadState = 'loading';
    const image = new Image();
    image.onload = () => {
      const columns = Math.floor(image.width / config.tileWidth);
      const rows = Math.floor(image.height / config.tileHeight);
      const sourceCellWidth = columns > 0 ? image.width / columns : 0;
      const sourceCellHeight = rows > 0 ? image.height / rows : 0;
      const apply = () => {
        if (columns <= 0 || rows <= 0) {
          this.tilesetLoadState = 'error';
          this.tilesetImage = null;
          this.tilesetColumns = 0;
          this.tilesetRows = 0;
          this.tilesetCellCount = 0;
          this.tilesetSourceCellWidth = 0;
          this.tilesetSourceCellHeight = 0;
          return;
        }
        this.tilesetLoadState = 'ready';
        this.tilesetImage = image;
        this.tilesetColumns = columns;
        this.tilesetRows = rows;
        this.tilesetCellCount = columns * rows;
        this.tilesetSourceCellWidth = sourceCellWidth;
        this.tilesetSourceCellHeight = sourceCellHeight;
      };
      if (typeof image.decode === 'function') {
        image.decode().then(apply).catch(apply);
      } else {
        apply();
      }
    };
    image.onerror = () => {
      this.tilesetLoadState = 'error';
      this.tilesetImage = null;
      this.tilesetColumns = 0;
      this.tilesetRows = 0;
      this.tilesetCellCount = 0;
      this.tilesetSourceCellWidth = 0;
      this.tilesetSourceCellHeight = 0;
    };
    image.src = resolveAssetUrl(config.url);
  }

  private getPerTileTilesetCacheKey(url: string, tileWidth: number, tileHeight: number): string {
    return `${url}::${tileWidth}x${tileHeight}`;
  }

  private ensurePerTileTilesetInCache(url: string, tileWidth: number, tileHeight: number): void {
    const normalizedUrl = resolveAssetUrl(url);
    if (!normalizedUrl) {
      return;
    }

    const key = this.getPerTileTilesetCacheKey(normalizedUrl, tileWidth, tileHeight);
    const existing = this.perTileTilesetCache.get(key);
    if (existing && (existing.status === 'loading' || existing.status === 'ready' || existing.status === 'error')) {
      return;
    }

    this.perTileTilesetCache.set(key, {
      status: 'loading',
      image: null,
      requestedTileWidth: tileWidth,
      requestedTileHeight: tileHeight,
      sourceCellWidth: 0,
      sourceCellHeight: 0,
      columns: 0,
      rows: 0,
      cellCount: 0,
    });

    const image = new Image();
    image.onload = () => {
      const columns = Math.floor(image.width / tileWidth);
      const rows = Math.floor(image.height / tileHeight);
      const sourceCellWidth = columns > 0 ? image.width / columns : 0;
      const sourceCellHeight = rows > 0 ? image.height / rows : 0;
      const apply = () => {
        this.perTileTilesetCache.set(key, {
          status: columns > 0 && rows > 0 ? 'ready' : 'error',
          image: columns > 0 && rows > 0 ? image : null,
          requestedTileWidth: tileWidth,
          requestedTileHeight: tileHeight,
          sourceCellWidth: columns > 0 && rows > 0 ? sourceCellWidth : 0,
          sourceCellHeight: columns > 0 && rows > 0 ? sourceCellHeight : 0,
          columns: Math.max(0, columns),
          rows: Math.max(0, rows),
          cellCount: columns > 0 && rows > 0 ? columns * rows : 0,
        });
      };
      if (typeof image.decode === 'function') {
        image.decode().then(apply).catch(apply);
      } else {
        apply();
      }
    };
    image.onerror = () => {
      this.perTileTilesetCache.set(key, {
        status: 'error',
        image: null,
        requestedTileWidth: tileWidth,
        requestedTileHeight: tileHeight,
        sourceCellWidth: 0,
        sourceCellHeight: 0,
        columns: 0,
        rows: 0,
        cellCount: 0,
      });
    };
    image.src = normalizedUrl;
  }

  private getMapTilesetRequirements(mapId: string): MapTilesetRequirements {
    const cached = this.mapTilesetRequirementsCache.get(mapId);
    if (cached) {
      return cached;
    }

    const map = this.mapRegistry[mapId];
    if (!map) {
      const empty: MapTilesetRequirements = { usesGlobalTileset: false, perTileTilesets: [] };
      this.mapTilesetRequirementsCache.set(mapId, empty);
      return empty;
    }

    let usesGlobalTileset = false;
    const perTileTilesetByKey = new Map<string, MapTilesetRequirements['perTileTilesets'][number]>();
    const visitedCodes = new Set<string>();

    for (const layer of map.layers) {
      for (const row of layer.tiles) {
        for (const code of row) {
          if (!code || code === BLANK_TILE_CODE || visitedCodes.has(code)) {
            continue;
          }
          visitedCodes.add(code);
          const tile = this.getTileDefinition(code);
          if (typeof tile.atlasIndex !== 'number' || tile.atlasIndex < 0) {
            continue;
          }

          const tilesetUrl = tile.tilesetUrl?.trim();
          const tilePixelWidth = tile.tilePixelWidth ?? 0;
          const tilePixelHeight = tile.tilePixelHeight ?? 0;
          if (tilesetUrl && tilePixelWidth > 0 && tilePixelHeight > 0) {
            const normalizedUrl = resolveAssetUrl(tilesetUrl);
            if (!normalizedUrl) {
              continue;
            }
            const key = this.getPerTileTilesetCacheKey(normalizedUrl, tilePixelWidth, tilePixelHeight);
            if (!perTileTilesetByKey.has(key)) {
              perTileTilesetByKey.set(key, {
                key,
                url: normalizedUrl,
                tileWidth: tilePixelWidth,
                tileHeight: tilePixelHeight,
              });
            }
          } else {
            usesGlobalTileset = true;
          }
        }
      }
    }

    const requirements: MapTilesetRequirements = {
      usesGlobalTileset,
      perTileTilesets: Array.from(perTileTilesetByKey.values()),
    };
    this.mapTilesetRequirementsCache.set(mapId, requirements);
    return requirements;
  }

  private preloadMapVisualAssets(mapId: string): void {
    const map = this.mapRegistry[mapId];
    if (!map) {
      return;
    }

    const requirements = this.getMapTilesetRequirements(mapId);
    if (requirements.usesGlobalTileset) {
      this.ensureTilesetLoaded();
    }
    for (const requirement of requirements.perTileTilesets) {
      this.ensurePerTileTilesetInCache(requirement.url, requirement.tileWidth, requirement.tileHeight);
    }

    this.ensurePlayerSpriteLoaded();
    for (const npc of this.getNpcsForMap(map.id)) {
      this.ensureNpcSpriteLoaded(npc);
    }
  }

  private preloadNeighborMapVisualAssets(mapId: string): void {
    const map = this.mapRegistry[mapId];
    if (!map) {
      return;
    }
    for (const warp of map.warps) {
      this.preloadMapVisualAssets(warp.toMapId);
    }
  }

  private preloadKnownNpcSpriteSheets(): void {
    for (const entry of this.npcSpriteLibrary) {
      this.ensureNpcSpriteSheetLoaded(entry.sprite);
    }
  }

  private areMapVisualAssetsReady(mapId: string): boolean {
    const map = this.mapRegistry[mapId];
    if (!map) {
      return true;
    }

    const requirements = this.getMapTilesetRequirements(mapId);
    if (requirements.usesGlobalTileset && this.tilesetLoadState === 'loading') {
      return false;
    }
    for (const requirement of requirements.perTileTilesets) {
      const state = this.perTileTilesetCache.get(requirement.key);
      if (!state || state.status === 'loading') {
        return false;
      }
    }

    if (this.playerSpriteConfig?.url && this.playerSpriteSheet.status === 'loading') {
      return false;
    }
    for (const npc of this.getNpcsForMap(map.id)) {
      const spriteUrl = npc.sprite?.url?.trim();
      if (!spriteUrl) {
        continue;
      }
      const sheet = this.npcSpriteSheets[spriteUrl];
      if (!sheet || sheet.status === 'loading') {
        return false;
      }
    }

    return true;
  }

  private drawTileFromTileset(
    ctx: CanvasRenderingContext2D,
    tile: TileDefinition,
    x: number,
    y: number,
    tileTransform = 0,
  ): boolean {
    const url = tile.tilesetUrl?.trim();
    const tilePxW = tile.tilePixelWidth ?? 0;
    const tilePxH = tile.tilePixelHeight ?? 0;

    if (url && tilePxW > 0 && tilePxH > 0) {
      const normalizedUrl = resolveAssetUrl(url);
      this.ensurePerTileTilesetInCache(normalizedUrl, tilePxW, tilePxH);
      const key = this.getPerTileTilesetCacheKey(normalizedUrl, tilePxW, tilePxH);
      const cached = this.perTileTilesetCache.get(key);
      if (cached?.status === 'ready' && cached.image && cached.cellCount > 0) {
        if (
          typeof tile.atlasIndex !== 'number' ||
          tile.atlasIndex < 0 ||
          tile.atlasIndex >= cached.cellCount
        ) {
          return false;
        }
        const { column, row } = atlasIndexToColumnRow(tile.atlasIndex, cached.columns);
        const sourceX = column * cached.sourceCellWidth;
        const sourceY = row * cached.sourceCellHeight;
        ctx.imageSmoothingEnabled = false;
        const decodedTransform = decodeTileTransform(tileTransform);
        const rotation = decodedTransform.rotationQuarter;
        if (rotation === 0 && !decodedTransform.mirrorHorizontal) {
          ctx.drawImage(
            cached.image,
            sourceX,
            sourceY,
            cached.sourceCellWidth,
            cached.sourceCellHeight,
            x,
            y,
            TILE_SIZE,
            TILE_SIZE,
          );
          return true;
        }
        ctx.save();
        ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
        ctx.rotate((Math.PI / 2) * rotation);
        if (decodedTransform.mirrorHorizontal) {
          ctx.scale(-1, 1);
        }
        ctx.drawImage(
          cached.image,
          sourceX,
          sourceY,
          cached.sourceCellWidth,
          cached.sourceCellHeight,
          -TILE_SIZE / 2,
          -TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE,
        );
        ctx.restore();
        return true;
      }
      return false;
    }

    if (!this.tilesetImage || !this.customTilesetConfig) {
      return false;
    }
    if (
      typeof tile.atlasIndex !== 'number' ||
      tile.atlasIndex < 0 ||
      this.tilesetColumns <= 0 ||
      this.tilesetRows <= 0 ||
      this.tilesetCellCount <= 0
    ) {
      return false;
    }
    if (tile.atlasIndex >= this.tilesetCellCount) {
      return false;
    }

    const { column, row } = atlasIndexToColumnRow(tile.atlasIndex, this.tilesetColumns);
    const sourceX = column * this.tilesetSourceCellWidth;
    const sourceY = row * this.tilesetSourceCellHeight;

    ctx.imageSmoothingEnabled = false;
    const decodedTransform = decodeTileTransform(tileTransform);
    const rotation = decodedTransform.rotationQuarter;
    if (rotation === 0 && !decodedTransform.mirrorHorizontal) {
      ctx.drawImage(
        this.tilesetImage,
        sourceX,
        sourceY,
        this.tilesetSourceCellWidth,
        this.tilesetSourceCellHeight,
        x,
        y,
        TILE_SIZE,
        TILE_SIZE,
      );
      return true;
    }

    ctx.save();
    ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
    ctx.rotate((Math.PI / 2) * rotation);
    if (decodedTransform.mirrorHorizontal) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(
      this.tilesetImage,
      sourceX,
      sourceY,
      this.tilesetSourceCellWidth,
      this.tilesetSourceCellHeight,
      -TILE_SIZE / 2,
      -TILE_SIZE / 2,
      TILE_SIZE,
      TILE_SIZE,
    );
    ctx.restore();
    return true;
  }

  private ensureNpcRuntimeState(): void {
    const map = this.getCurrentMap();
    if (this.lastNpcResetMapId !== this.currentMapId) {
      this.lastNpcResetMapId = this.currentMapId;
      for (const npc of this.getNpcsForMap(map.id)) {
        const key = this.getNpcStateKey(npc);
        const state = this.npcRuntimeStates[key];
        if (state) {
          state.position = { ...npc.position };
          state.anchorPosition = { ...npc.position };
          state.facing = npc.facing ?? state.facing;
          state.moveStep = null;
          state.patternIndex = 0;
          state.patternDirection = 1;
        }
      }
    }
    for (const npc of this.getNpcsForMap(map.id)) {
      this.getNpcRuntimeState(npc);
      this.ensureNpcSpriteLoaded(npc);
    }
  }

  private ensurePlayerSpriteLoaded(): void {
    const sprite = this.playerSpriteConfig;
    if (!sprite?.url) {
      return;
    }
    if (this.playerSpriteSheet.status === 'ready' || this.playerSpriteSheet.status === 'loading') {
      return;
    }

    const image = new Image();
    this.playerSpriteSheet = {
      status: 'loading',
      image: null,
      columns: 0,
    };
    image.onload = () => {
      const atlasCellWidth = Math.max(1, sprite.atlasCellWidth ?? sprite.frameWidth);
      const columns = Math.floor(image.width / atlasCellWidth);
      const setReady = () => {
        this.playerSpriteSheet = {
          status: columns > 0 ? 'ready' : 'error',
          image: columns > 0 ? image : null,
          columns: Math.max(0, columns),
        };
      };
      if (typeof image.decode === 'function') {
        image.decode().then(setReady).catch(setReady);
      } else {
        setReady();
      }
    };
    image.onerror = () => {
      this.playerSpriteSheet = {
        status: 'error',
        image: null,
        columns: 0,
      };
    };
    image.src = resolveAssetUrl(sprite.url);
  }

  private ensureNpcSpriteLoaded(npc: NpcDefinition): void {
    this.ensureNpcSpriteSheetLoaded(npc.sprite);
  }

  private ensureNpcSpriteSheetLoaded(sprite: NpcSpriteConfig | null | undefined): void {
    const spriteUrl = sprite?.url?.trim();
    if (!sprite || !spriteUrl) {
      return;
    }

    const existing = this.npcSpriteSheets[spriteUrl];
    if (existing) {
      return;
    }

    const image = new Image();
    this.npcSpriteSheets[spriteUrl] = {
      status: 'loading',
      image: null,
      columns: 0,
    };

    image.onload = () => {
      const atlasCellWidth = Math.max(1, sprite.atlasCellWidth ?? sprite.frameWidth);
      const columns = Math.floor(image.width / atlasCellWidth);
      const setReady = () => {
        this.npcSpriteSheets[spriteUrl] = {
          status: columns > 0 ? 'ready' : 'error',
          image: columns > 0 ? image : null,
          columns: Math.max(0, columns),
        };
      };
      if (typeof image.decode === 'function') {
        image.decode().then(setReady).catch(setReady);
      } else {
        setReady();
      }
    };
    image.onerror = () => {
      this.npcSpriteSheets[spriteUrl] = {
        status: 'error',
        image: null,
        columns: 0,
      };
    };
    image.src = resolveAssetUrl(spriteUrl);
  }

  private getNpcRuntimeState(npc: NpcDefinition): NpcRuntimeState {
    const key = this.getNpcStateKey(npc);
    const existing = this.npcRuntimeStates[key];
    if (existing) {
      if (typeof existing.stridePhase !== 'number') {
        existing.stridePhase = 0;
      }
      const stepIntervalMs = clampNpcStepInterval(npc.movement?.stepIntervalMs);
      existing.moveCooldownMs = Math.min(existing.moveCooldownMs, stepIntervalMs);
      if (existing.anchorPosition.x !== npc.position.x || existing.anchorPosition.y !== npc.position.y) {
        existing.anchorPosition = { ...npc.position };
        existing.position = { ...npc.position };
        existing.moveStep = null;
        existing.patternIndex = 0;
        existing.patternDirection = 1;
        if (npc.facing) {
          existing.facing = npc.facing;
        }
      }
      return existing;
    }

    const created: NpcRuntimeState = {
      position: { ...npc.position },
      anchorPosition: { ...npc.position },
      facing: npc.facing ?? randomDirection(),
      turnTimerMs: randomTurnDelay(),
      moveStep: null,
      moveCooldownMs: clampNpcStepInterval(npc.movement?.stepIntervalMs),
      patternIndex: 0,
      patternDirection: 1,
      animationMs: 0,
      stridePhase: 0,
    };
    this.npcRuntimeStates[key] = created;
    return created;
  }

  private getNpcStateKey(npc: NpcDefinition): string {
    const resolvedNpc = npc as ResolvedNpcDefinition;
    if (typeof resolvedNpc.__characterKey === 'string' && resolvedNpc.__characterKey.trim()) {
      return resolvedNpc.__characterKey;
    }
    return `${this.currentMapId}:${npc.id}`;
  }

  private pushHeldDirection(direction: Direction): void {
    this.heldDirections = this.heldDirections.filter((held) => held !== direction);
    this.heldDirections.push(direction);
  }

  private updateNpcs(deltaMs: number): void {
    const map = this.getCurrentMap();
    const mapNpcs = this.getNpcsForMap(map.id);
    this.ensureNpcRuntimeState();

    for (const npc of mapNpcs) {
      const state = this.getNpcRuntimeState(npc);
      state.animationMs += deltaMs;
      this.ensureNpcSpriteLoaded(npc);

      if (state.moveStep) {
        state.moveStep.elapsed += deltaMs;
        if (state.moveStep.elapsed >= state.moveStep.duration) {
          state.position = { ...state.moveStep.to };
          state.stridePhase = (state.stridePhase + 1) % 2;
          state.moveStep = null;
        }
      }

      if (this.activeBattle || this.dialogue || this.activeScriptedScene || state.moveStep) {
        continue;
      }

      const movementType = this.getNpcMovementType(npc);
      if (movementType === 'static') {
        continue;
      }

      if (movementType === 'static-turning') {
        state.turnTimerMs -= deltaMs;
        if (state.turnTimerMs > 0) {
          continue;
        }
        const turnPattern = this.getNpcMovementPattern(npc);
        if (turnPattern.length > 0) {
          state.facing = turnPattern[state.patternIndex % turnPattern.length];
          state.patternIndex = (state.patternIndex + 1) % turnPattern.length;
        } else {
          state.facing = randomDifferentDirection(state.facing);
        }
        state.turnTimerMs = clampNpcStepInterval(npc.movement?.stepIntervalMs);
        continue;
      }

      state.moveCooldownMs -= deltaMs;
      if (state.moveCooldownMs > 0) {
        continue;
      }

      if (movementType === 'path') {
        const pattern = this.getNpcMovementPattern(npc);
        if (pattern.length === 0) {
          state.moveCooldownMs = clampNpcStepInterval(npc.movement?.stepIntervalMs);
          continue;
        }

        const direction = this.getNextNpcPathDirection(state, pattern, npc.movement?.pathMode);
        this.tryNpcMove(npc, state, direction);
        continue;
      }

      this.tryNpcWanderMove(npc, state);
    }
  }

  private getNpcMovementType(npc: NpcDefinition): 'static' | 'static-turning' | 'wander' | 'path' {
    const movementType = npc.movement?.type;
    if (movementType === 'static-turning') {
      return 'static-turning';
    }
    if (movementType === 'wander' || movementType === 'random') {
      return 'wander';
    }
    if (movementType === 'path' || movementType === 'loop') {
      return 'path';
    }
    return 'static';
  }

  private getNpcMovementPattern(npc: NpcDefinition): Direction[] {
    return (npc.movement?.pattern ?? []).filter(isDirection);
  }

  private getNextNpcPathDirection(
    state: NpcRuntimeState,
    pattern: Direction[],
    pathMode: 'loop' | 'pingpong' | undefined,
  ): Direction {
    const length = pattern.length;
    if (length <= 1) {
      state.patternIndex = 0;
      state.patternDirection = 1;
      return pattern[0];
    }
    const mode = pathMode === 'pingpong' ? 'pingpong' : 'loop';
    if (mode === 'loop') {
      const direction = pattern[state.patternIndex % length];
      state.patternIndex = (state.patternIndex + 1) % length;
      state.patternDirection = 1;
      return direction;
    }

    const safeIndex = clamp(state.patternIndex, 0, length - 1);
    const direction = pattern[safeIndex];
    let nextIndex = safeIndex + state.patternDirection;
    if (nextIndex < 0 || nextIndex >= length) {
      state.patternDirection = (state.patternDirection * -1) as 1 | -1;
      nextIndex = safeIndex + state.patternDirection;
      if (nextIndex < 0 || nextIndex >= length) {
        nextIndex = safeIndex;
      }
    }
    state.patternIndex = nextIndex;
    return direction;
  }

  private tryNpcWanderMove(npc: NpcDefinition, state: NpcRuntimeState): void {
    const candidates = shuffleDirections();
    for (const direction of candidates) {
      const delta = DIRECTION_DELTAS[direction];
      const target = {
        x: state.position.x + delta.x,
        y: state.position.y + delta.y,
      };
      if (!this.isNpcMoveWithinLeash(npc, state, target)) {
        continue;
      }
      if (!this.canNpcStepTo(npc, state.position, target, direction)) {
        continue;
      }
      this.tryNpcMove(npc, state, direction);
      return;
    }
    state.moveCooldownMs = clampNpcStepInterval(npc.movement?.stepIntervalMs);
  }

  private isNpcMoveWithinLeash(npc: NpcDefinition, state: NpcRuntimeState, target: Vector2): boolean {
    if (!Number.isFinite(npc.movement?.leashRadius)) {
      return true;
    }
    const leashRadius = Math.max(1, Math.floor(npc.movement?.leashRadius ?? 0));
    const distanceFromAnchor = Math.abs(target.x - state.anchorPosition.x) + Math.abs(target.y - state.anchorPosition.y);
    return distanceFromAnchor <= leashRadius;
  }

  private tryNpcMove(npc: NpcDefinition, state: NpcRuntimeState, direction: Direction): void {
    state.facing = direction;
    const delta = DIRECTION_DELTAS[direction];
    const target = {
      x: state.position.x + delta.x,
      y: state.position.y + delta.y,
    };
    if (this.canNpcStepTo(npc, state.position, target, direction)) {
      state.moveStep = {
        from: { ...state.position },
        to: target,
        elapsed: 0,
        duration: MOVE_DURATION_MS,
      };
    }
    state.moveCooldownMs = clampNpcStepInterval(npc.movement?.stepIntervalMs);
  }

  private getNpcRenderPosition(npc: NpcDefinition): Vector2 {
    const state = this.getNpcRuntimeState(npc);
    if (!state.moveStep) {
      return { ...state.position };
    }

    const progress = clamp(state.moveStep.elapsed / state.moveStep.duration, 0, 1);
    return {
      x: state.moveStep.from.x + (state.moveStep.to.x - state.moveStep.from.x) * progress,
      y: state.moveStep.from.y + (state.moveStep.to.y - state.moveStep.from.y) * progress,
    };
  }

  private getPlayerRenderPosition(): Vector2 {
    if (!this.moveStep) {
      return this.playerPosition;
    }

    const progress = clamp(this.moveStep.elapsed / this.moveStep.duration, 0, 1);
    return {
      x: this.moveStep.from.x + (this.moveStep.to.x - this.moveStep.from.x) * progress,
      y: this.moveStep.from.y + (this.moveStep.to.y - this.moveStep.from.y) * progress,
    };
  }

  private tryMovementFromInput(): void {
    const direction = this.heldDirections[this.heldDirections.length - 1];
    if (!direction) {
      return;
    }

    this.facing = direction;

    const delta = DIRECTION_DELTAS[direction];
    const targetX = this.playerPosition.x + delta.x;
    const targetY = this.playerPosition.y + delta.y;

    if (!this.canStepTo(targetX, targetY, direction)) {
      return;
    }

    const cancelledFishingCast = this.fishingSession !== null;
    this.clearFishingSession();
    if (cancelledFishingCast) {
      this.showMessage('Cancelled Cast', 1000);
    }
    this.moveStep = {
      from: { ...this.playerPosition },
      to: { x: targetX, y: targetY },
      elapsed: 0,
      duration: MOVE_DURATION_MS,
    };
  }

  private canStepTo(x: number, y: number, direction: Direction): boolean {
    if (!this.isTilePassable(x, y, this.playerPosition, direction)) {
      return false;
    }
    if (!this.isDemoLeashStepAllowed(x, y)) {
      return false;
    }
    if (!this.isNpcMovementGuardStepAllowed(x, y)) {
      return false;
    }

    return !this.isNpcOccupyingTile(x, y);
  }

  private isDemoLeashStepAllowed(targetX: number, targetY: number): boolean {
    if (!this.shouldEnforceDemoLeash()) {
      return true;
    }
    const unclePosition = this.getUncleHankPosition();
    if (!unclePosition) {
      return true;
    }
    const verticalBoundaryTiles = 6;
    const verticalDistance = Math.abs(targetY - unclePosition.y);
    if (verticalDistance <= verticalBoundaryTiles) {
      return true;
    }
    if (!this.dialogue) {
      this.startDialogue('Uncle Hank', ["Don't leave yet! Unlock your Partner Critter first!"]);
    }
    return false;
  }

  private shouldEnforceDemoLeash(): boolean {
    return this.currentMapId === 'uncle-s-house' && this.flags[FLAG_DEMO_START] && !this.flags[FLAG_DEMO_DONE];
  }

  private getUncleHankPosition(): Vector2 | null {
    const uncle = this.getNpcsForMap('uncle-s-house').find((entry) => entry.id === UNCLE_HANK_NPC_ID);
    if (!uncle) {
      return null;
    }
    const state = this.getNpcRuntimeState(uncle);
    return state.moveStep?.to ?? state.position;
  }

  private isNpcMovementGuardStepAllowed(targetX: number, targetY: number): boolean {
    const mapNpcs = this.getNpcsForMap(this.currentMapId);
    for (const npc of mapNpcs) {
      const guards = Array.isArray(npc.movementGuards) ? npc.movementGuards : [];
      for (const guard of guards) {
        if (!this.isNpcMovementGuardActive(guard)) {
          continue;
        }
        if (!this.doesNpcMovementGuardMatchTarget(guard, targetX, targetY)) {
          continue;
        }
        const battleTeamIds =
          Array.isArray(guard.battleTeamIds) && guard.battleTeamIds.length > 0
            ? guard.battleTeamIds
            : npc.battleTeamIds;
        if (Array.isArray(battleTeamIds) && battleTeamIds.length > 0) {
          const npcState = this.getNpcRuntimeState(npc);
          npcState.facing = oppositeDirection(this.facing);
          const preBattleLines = (Array.isArray(guard.dialogueLines) && guard.dialogueLines.length > 0
            ? guard.dialogueLines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
            : npc.dialogueLines && npc.dialogueLines.length > 0
              ? npc.dialogueLines
              : []
          ) as string[];
          if (preBattleLines.length > 0) {
            this.pendingGuardBattle = { npc, guard };
            const speaker =
              typeof guard.dialogueSpeaker === 'string' && guard.dialogueSpeaker.trim()
                ? guard.dialogueSpeaker.trim()
                : npc.dialogueSpeaker ?? npc.name;
            this.startDialogue(speaker, preBattleLines);
            return false;
          }
          this.startMovementGuardBattle(npc, guard, battleTeamIds);
          return false;
        }
        if (!this.dialogue) {
          this.startNpcMovementGuardDialogue(npc, guard);
        }
        return false;
      }
    }
    return true;
  }

  private isNpcMovementGuardActive(guard: NpcMovementGuardDefinition): boolean {
    const requiresFlag = typeof guard.requiresFlag === 'string' ? guard.requiresFlag.trim() : '';
    if (requiresFlag && !this.flags[requiresFlag]) {
      return false;
    }
    const hideIfFlag = typeof guard.hideIfFlag === 'string' ? guard.hideIfFlag.trim() : '';
    if (hideIfFlag && this.flags[hideIfFlag]) {
      return false;
    }
    const defeatedFlag = typeof guard.defeatedFlag === 'string' ? guard.defeatedFlag.trim() : '';
    const battleRepeatable = Boolean(guard.battleRepeatable);
    if (defeatedFlag && this.flags[defeatedFlag] && !battleRepeatable) {
      return false;
    }
    return true;
  }

  private doesNpcMovementGuardMatchTarget(guard: NpcMovementGuardDefinition, targetX: number, targetY: number): boolean {
    const hasExactX = typeof guard.x === 'number' && Number.isFinite(guard.x);
    const hasExactY = typeof guard.y === 'number' && Number.isFinite(guard.y);
    const hasMinX = typeof guard.minX === 'number' && Number.isFinite(guard.minX);
    const hasMaxX = typeof guard.maxX === 'number' && Number.isFinite(guard.maxX);
    const hasMinY = typeof guard.minY === 'number' && Number.isFinite(guard.minY);
    const hasMaxY = typeof guard.maxY === 'number' && Number.isFinite(guard.maxY);
    if (!hasExactX && !hasExactY && !hasMinX && !hasMaxX && !hasMinY && !hasMaxY) {
      return false;
    }
    if (hasExactX && targetX !== Math.floor(guard.x as number)) {
      return false;
    }
    if (hasExactY && targetY !== Math.floor(guard.y as number)) {
      return false;
    }

    const minX = hasMinX ? Math.floor(guard.minX as number) : Number.NEGATIVE_INFINITY;
    const maxX = hasMaxX ? Math.floor(guard.maxX as number) : Number.POSITIVE_INFINITY;
    const minY = hasMinY ? Math.floor(guard.minY as number) : Number.NEGATIVE_INFINITY;
    const maxY = hasMaxY ? Math.floor(guard.maxY as number) : Number.POSITIVE_INFINITY;
    return targetX >= minX && targetX <= maxX && targetY >= minY && targetY <= maxY;
  }

  private startNpcMovementGuardDialogue(npc: NpcDefinition, guard: NpcMovementGuardDefinition): void {
    const npcState = this.getNpcRuntimeState(npc);
    npcState.facing = oppositeDirection(this.facing);

    const lines = Array.isArray(guard.dialogueLines)
      ? guard.dialogueLines.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : [];
    const setFlag = typeof guard.setFlag === 'string' && guard.setFlag.trim() ? guard.setFlag.trim() : undefined;
    if (lines.length > 0) {
      const speaker =
        typeof guard.dialogueSpeaker === 'string' && guard.dialogueSpeaker.trim()
          ? guard.dialogueSpeaker.trim()
          : npc.dialogueSpeaker ?? npc.name;
      this.startDialogue(speaker, lines, setFlag);
      return;
    }
    const fallbackLines = npc.dialogueLines && npc.dialogueLines.length > 0 ? npc.dialogueLines : ['...'];
    this.startDialogue(npc.dialogueSpeaker ?? npc.name, fallbackLines, setFlag);
  }

  private canNpcStepTo(npc: NpcDefinition, from: Vector2, target: Vector2, direction: Direction): boolean {
    if (!this.isTilePassable(target.x, target.y, from, direction)) {
      return false;
    }

    if (target.x === this.playerPosition.x && target.y === this.playerPosition.y) {
      return false;
    }
    if (this.moveStep && target.x === this.moveStep.to.x && target.y === this.moveStep.to.y) {
      return false;
    }

    const map = this.getCurrentMap();
    const mapNpcs = this.getNpcsForMap(map.id);
    const npcKey = this.getNpcStateKey(npc);
    for (const entry of mapNpcs) {
      if (this.getNpcStateKey(entry) === npcKey) {
        continue;
      }
      const state = this.getNpcRuntimeState(entry);
      const occupiedPosition = state.moveStep?.to ?? state.position;
      if (occupiedPosition.x === target.x && occupiedPosition.y === target.y) {
        return false;
      }
    }

    return true;
  }

  private isTilePassable(targetX: number, targetY: number, from: Vector2, direction: Direction): boolean {
    const map = this.getCurrentMap();
    const visibleCode = tileAt(map, targetX, targetY);
    if (!visibleCode || visibleCode === BLANK_TILE_CODE) {
      return false;
    }

    const sourceMask = collisionEdgeMaskAt(map, from.x, from.y);
    if ((sourceMask & COLLISION_EDGE_BIT[direction]) !== 0) {
      return false;
    }

    const targetMask = collisionEdgeMaskAt(map, targetX, targetY);
    const oppositeBit = COLLISION_EDGE_BIT[oppositeDirection(direction)];
    if ((targetMask & oppositeBit) !== 0) {
      return false;
    }

    for (const layer of map.layers) {
      if (!layer.collision) {
        continue;
      }

      const row = layer.tiles[targetY];
      if (!row || targetX < 0 || targetX >= row.length) {
        continue;
      }

      const code = row[targetX];
      if (!code || code === BLANK_TILE_CODE) {
        continue;
      }

      const tile = this.getTileDefinition(code);
      if (!tile.walkable) {
        return false;
      }
    }

    return true;
  }

  private isNpcOccupyingTile(x: number, y: number): boolean {
    const map = this.getCurrentMap();
    return this.getNpcsForMap(map.id).some((npc) => {
      const state = this.getNpcRuntimeState(npc);
      const occupiedPosition = state.moveStep?.to ?? state.position;
      return occupiedPosition.x === x && occupiedPosition.y === y;
    });
  }

  private handleInteract(): void {
    if (this.dialogue) {
      this.advanceDialogue();
      return;
    }
    this.clearFishingSession();

    const interactWarp = this.findInteractWarpAtPlayer();
    if (interactWarp) {
      this.triggerWarp(interactWarp.warp, interactWarp.source);
      return;
    }

    const target = this.getFacingTile();
    const map = this.getCurrentMap();
    const mapNpcs = this.getNpcsForMap(map.id);

    const npc = mapNpcs.find((entry) => {
      const state = this.getNpcRuntimeState(entry);
      return state.position.x === target.x && state.position.y === target.y;
    });
    if (npc) {
      this.startNpcDialogue(npc);
      return;
    }

    const interaction = this.findInteractionAt(target.x, target.y);
    if (interaction) {
      if (this.resolveInteractionKind(interaction) === 'heal_tile') {
        this.startHealTilePrompt(interaction);
      } else {
        this.startDialogue(interaction.speaker ?? 'Note', interaction.lines, interaction.setFlag);
      }
      return;
    }

    if (tileAt(map, target.x, target.y) === 'D') {
      this.startDialogue('Door', ['It is locked.']);
    }
  }

  private startHealTilePrompt(interaction: InteractionDefinition): void {
    const promptText =
      interaction.lines.find((entry) => typeof entry === 'string' && entry.trim().length > 0)?.trim() ??
      'Would you like to heal your Critters?';
    this.heldDirections = [];
    this.healPrompt = {
      speaker: this.formatStoryText(interaction.speaker ?? 'Healer'),
      text: this.formatStoryText(promptText),
    };
  }

  private resolveHealPromptChoice(shouldHeal: boolean): boolean {
    if (!this.healPrompt) {
      return false;
    }

    const speaker = this.healPrompt.speaker;
    this.healPrompt = null;
    if (shouldHeal) {
      this.healSquadToFull();
      this.updateRespawnPointToCurrentPosition();
      this.markProgressDirty();
      this.startDialogue(speaker, ['Your Squad has been healed.', 'Thank you for stopping by!']);
      return true;
    }

    this.startDialogue(speaker, ['Your squad was not healed.', 'Thank you for stopping by!']);
    return true;
  }

  private resolveNpcInteractionMode(npc: NpcDefinition): 'dialogue' | 'battle' | 'healer' | 'shop' {
    if (typeof npc.shopId === 'string' && npc.shopId.trim()) {
      return 'shop';
    }
    if (npc.firstInteractBattle) {
      return 'battle';
    }
    if (npc.healer) {
      return 'healer';
    }
    return 'dialogue';
  }

  private startShopPrompt(npc: NpcDefinition): boolean {
    const shopId = typeof npc.shopId === 'string' ? npc.shopId.trim() : '';
    if (!shopId) {
      return false;
    }
    const shop = this.shopById[shopId];
    if (!shop) {
      this.showMessage(`Shop "${shopId}" was not found. Configure this NPC in NPC Studio.`, 2600);
      return false;
    }
    this.heldDirections = [];
    const npcName = this.formatStoryText(npc.name);
    this.shopPrompt = {
      npcName,
      title: this.formatStoryText(`${npc.name}'s Shop`),
      shopId,
    };
    return true;
  }

  private startNpcDialogue(npc: NpcDefinition): void {
    const npcState = this.getNpcRuntimeState(npc);
    npcState.facing = oppositeDirection(this.facing);
    npcState.turnTimerMs =
      this.getNpcMovementType(npc) === 'static-turning'
        ? clampNpcStepInterval(npc.movement?.stepIntervalMs)
        : randomTurnDelay();

    const firstInteractionFlag = npc.firstInteractionSetFlag?.trim();
    if (firstInteractionFlag && !this.flags[firstInteractionFlag]) {
      this.flags[firstInteractionFlag] = true;
      this.markProgressDirty();
    }

    const interactionMode = this.resolveNpcInteractionMode(npc);
    if (interactionMode === 'shop') {
      const preShopDialogue = this.resolveNpcDialogueForInteraction(npc);
      this.pendingNpcShopStart = { npc };
      this.startDialogue(preShopDialogue.speaker, preShopDialogue.lines, preShopDialogue.setFlag);
      return;
    }

    const interactionBattleDefeatedFlag =
      typeof npc.interactBattleDefeatedFlag === 'string' ? npc.interactBattleDefeatedFlag.trim() : '';
    let interactionBattleRewards = this.normalizeNpcItemRewards(npc.battleRewards);
    const interactionBattleRepeatable = Boolean(npc.interactBattleRepeatable);
    if (interactionMode === 'battle') {
      if (interactionBattleRewards.length === 0 && this.itemById.lume?.isActive) {
        interactionBattleRewards = this.normalizeNpcItemRewards([{ itemId: 'lume', quantity: 25 }]);
      }
      if (!interactionBattleDefeatedFlag) {
        this.showMessage(`${npc.name} battle is missing a Defeat Flag. Configure this battler in NPC Studio.`, 2600);
        return;
      }
      if (interactionBattleRewards.length === 0) {
        this.showMessage(`${npc.name} battle is missing rewards. Add at least one reward item in NPC Studio.`, 2600);
        return;
      }
      const hasDefeated = Boolean(this.flags[interactionBattleDefeatedFlag]);
      if (interactionBattleRepeatable || !hasDefeated) {
        const preBattleDialogue = this.resolveNpcDialogueForInteraction(npc);
        this.pendingNpcInteractBattleStart = {
          npc,
          defeatedFlag: interactionBattleDefeatedFlag,
          rewards: interactionBattleRewards,
        };
        this.startDialogue(preBattleDialogue.speaker, preBattleDialogue.lines, preBattleDialogue.setFlag);
        return;
      }
    }

    const postDuel = this.getPostDuelGuardDialogue(npc);
    if (postDuel) {
      this.startDialogue(postDuel.speaker, postDuel.lines, postDuel.setFlag);
      return;
    }

    const interactionRewards = this.normalizeNpcItemRewards(npc.interactionRewards);
    const interactionRewardSetFlag =
      typeof npc.interactionRewardSetFlag === 'string' ? npc.interactionRewardSetFlag.trim() : '';
    const shouldGrantInteractionRewards =
      interactionRewards.length > 0 && (!interactionRewardSetFlag || !this.flags[interactionRewardSetFlag]);
    const interactionRewardLines = shouldGrantInteractionRewards
      ? this.buildRewardDialogueLines(interactionRewards, {
          intro: `${npc.name} handed you something.`,
          fallback: `${npc.name} gave you an item.`,
        })
      : [];

    if (npc.id === UNCLE_HANK_NPC_ID && !this.flags[FLAG_SELECTED_STARTER] && !this.flags[FLAG_DEMO_DONE]) {
      this.pendingStoryAction = 'open-starter-selection';
      const starterLines = npc.dialogueLines && npc.dialogueLines.length > 0
        ? npc.dialogueLines
        : [
            'Hey <player-name>! How are you doing?',
            "Here for Critter pickup? I've got three right here that need a new home.",
          ];
      this.startDialogue(
        npc.dialogueSpeaker ?? npc.name,
        [...starterLines, ...interactionRewardLines],
        npc.dialogueSetFlag,
        undefined,
        shouldGrantInteractionRewards ? interactionRewards : undefined,
        shouldGrantInteractionRewards ? interactionRewardSetFlag || undefined : undefined,
      );
      return;
    }

    if (Array.isArray(npc.interactionScript) && npc.interactionScript.length > 0) {
      this.startScriptedScene(npc, npc.interactionScript);
      return;
    }

    if (npc.dialogueLines && npc.dialogueLines.length > 0) {
      this.startDialogue(
        npc.dialogueSpeaker ?? npc.name,
        [...npc.dialogueLines, ...interactionRewardLines],
        npc.dialogueSetFlag,
        interactionMode === 'healer',
        shouldGrantInteractionRewards ? interactionRewards : undefined,
        shouldGrantInteractionRewards ? interactionRewardSetFlag || undefined : undefined,
      );
      return;
    }

    const script = DIALOGUES[npc.dialogueId];
    if (!script) {
      this.startDialogue(
        npc.name,
        ['...', ...interactionRewardLines],
        undefined,
        interactionMode === 'healer',
        shouldGrantInteractionRewards ? interactionRewards : undefined,
        shouldGrantInteractionRewards ? interactionRewardSetFlag || undefined : undefined,
      );
      return;
    }

    this.startDialogue(
      script.speaker,
      [...script.lines, ...interactionRewardLines],
      script.setFlag,
      interactionMode === 'healer',
      shouldGrantInteractionRewards ? interactionRewards : undefined,
      shouldGrantInteractionRewards ? interactionRewardSetFlag || undefined : undefined,
    );
  }

  private getPostDuelGuardDialogue(
    npc: NpcDefinition,
  ): { speaker: string; lines: string[]; setFlag?: string } | null {
    const guards = Array.isArray(npc.movementGuards) ? npc.movementGuards : [];
    for (const guard of guards) {
      const defeatedFlag = typeof guard.defeatedFlag === 'string' ? guard.defeatedFlag.trim() : '';
      if (!defeatedFlag || !this.flags[defeatedFlag]) {
        continue;
      }
      const lines = Array.isArray(guard.postDuelDialogueLines)
        ? guard.postDuelDialogueLines.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        : [];
      if (lines.length === 0) {
        continue;
      }
      const speaker =
        typeof guard.postDuelDialogueSpeaker === 'string' && guard.postDuelDialogueSpeaker.trim()
          ? guard.postDuelDialogueSpeaker.trim()
          : npc.dialogueSpeaker ?? npc.name;
      const setFlag = typeof guard.setFlag === 'string' && guard.setFlag.trim() ? guard.setFlag.trim() : undefined;
      return { speaker, lines, setFlag };
    }
    return null;
  }

  private startMovementGuardBattle(
    npc: NpcDefinition,
    guard: NpcMovementGuardDefinition,
    teamIdsOverride?: string[],
  ): void {
    const playerTeam = this.buildPlayerBattleTeam();
    if (!this.hasBattleReadyCritter(playerTeam)) {
      this.handleEmptyPlayerBattleTeam();
      return;
    }
    const guardBattleTeamIds =
      Array.isArray(teamIdsOverride) && teamIdsOverride.length > 0
        ? teamIdsOverride
        : Array.isArray(guard.battleTeamIds) && guard.battleTeamIds.length > 0
          ? guard.battleTeamIds
          : npc.battleTeamIds ?? [];
    const opponentTeam = this.buildNpcBattleTeam(guardBattleTeamIds);
    if (opponentTeam.length === 0) {
      return;
    }
    const defeatedFlag = typeof guard.defeatedFlag === 'string' && guard.defeatedFlag.trim() ? guard.defeatedFlag.trim() : '';
    if (!defeatedFlag) {
      this.showMessage(`${npc.name} guard battle is missing a Defeat Flag. Configure this battler in NPC Studio.`, 2600);
      return;
    }
    let rewards = this.normalizeNpcItemRewards(guard.battleRewards ?? npc.battleRewards);
    if (rewards.length === 0 && this.itemById.lume?.isActive) {
      rewards = this.normalizeNpcItemRewards([{ itemId: 'lume', quantity: 25 }]);
    }
    if (rewards.length === 0) {
      this.showMessage(`${npc.name} guard battle is missing rewards. Add at least one reward item in NPC Studio.`, 2600);
      return;
    }
    const npcState = this.getNpcRuntimeState(npc);
    npcState.facing = oppositeDirection(this.facing);
    this.pendingGuardDefeat = {
      npc,
      guard,
      defeatedFlag,
      rewards,
    };
    this.pendingNpcInteractBattleDefeat = null;
    this.startBattle(
      {
        type: 'npc',
        mapId: this.currentMapId,
        label: npc.name,
        npcId: npc.id,
      },
      playerTeam,
      opponentTeam,
      `${npc.name} is blocking the way!`,
    );
  }

  private startNpcBattle(
    npc: NpcDefinition,
    options?: {
      defeatedFlag?: string;
      rewards?: NpcItemRewardDefinition[];
    },
  ): boolean {
    const playerTeam = this.buildPlayerBattleTeam();
    if (!this.hasBattleReadyCritter(playerTeam)) {
      this.handleEmptyPlayerBattleTeam();
      return false;
    }

    const opponentTeam = this.buildNpcBattleTeam(npc.battleTeamIds ?? []);
    if (opponentTeam.length === 0) {
      this.showMessage(`${npc.name} is not ready to battle yet.`, 2200);
      return false;
    }

    const rewards = this.normalizeNpcItemRewards(options?.rewards);
    this.pendingNpcInteractBattleDefeat =
      typeof options?.defeatedFlag === 'string' && options.defeatedFlag.trim()
        ? {
            npc,
            defeatedFlag: options.defeatedFlag.trim(),
            rewards,
          }
        : null;

    this.startBattle(
      {
        type: 'npc',
        mapId: this.currentMapId,
        label: npc.name,
        npcId: npc.id,
      },
      playerTeam,
      opponentTeam,
      `${npc.name} challenged you to a duel!`,
    );
    return true;
  }

  private resolveNpcDialogueForInteraction(
    npc: NpcDefinition,
  ): { speaker: string; lines: string[]; setFlag?: string } {
    const dialogueLines = Array.isArray(npc.dialogueLines)
      ? npc.dialogueLines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
      : [];
    if (dialogueLines.length > 0) {
      return {
        speaker: npc.dialogueSpeaker ?? npc.name,
        lines: dialogueLines,
        setFlag: npc.dialogueSetFlag?.trim() || undefined,
      };
    }
    const script = DIALOGUES[npc.dialogueId];
    if (script && Array.isArray(script.lines) && script.lines.length > 0) {
      return {
        speaker: script.speaker,
        lines: script.lines,
        setFlag: script.setFlag,
      };
    }
    return {
      speaker: npc.dialogueSpeaker ?? npc.name,
      lines: ['...'],
    };
  }

  private startDialogue(
    speaker: string,
    lines: string[],
    setFlag?: string,
    healSquad?: boolean,
    rewardItems?: NpcItemRewardDefinition[],
    rewardSetFlag?: string,
  ): void {
    const parsedLines = lines.map((line) => this.formatStoryText(line));
    this.heldDirections = [];
    this.dialogue = {
      speaker: this.formatStoryText(speaker),
      lines: parsedLines,
      index: 0,
      setFlag,
      healSquad: Boolean(healSquad),
      rewardItems: rewardItems && rewardItems.length > 0 ? rewardItems.map((entry) => ({ ...entry })) : undefined,
      rewardSetFlag: rewardSetFlag?.trim() || undefined,
    };
  }

  private advanceDialogue(): void {
    if (!this.dialogue) {
      return;
    }

    if (this.dialogue.index < this.dialogue.lines.length - 1) {
      this.dialogue.index += 1;
      return;
    }

    if (this.dialogue.setFlag) {
      this.flags[this.dialogue.setFlag] = true;
      this.markProgressDirty();
    }
    if (this.dialogue.healSquad) {
      this.healSquadToFull();
      this.updateRespawnPointToCurrentPosition();
      this.showMessage('Your squad was healed to full!', 2200);
      this.markProgressDirty();
    }
    if (this.dialogue.rewardItems && this.dialogue.rewardItems.length > 0) {
      this.grantNpcItemRewards(this.dialogue.rewardItems);
    }
    if (this.dialogue.rewardSetFlag) {
      this.flags[this.dialogue.rewardSetFlag] = true;
      this.markProgressDirty();
    }

    this.dialogue = null;
    if (this.pendingGuardBattle) {
      const { npc, guard } = this.pendingGuardBattle;
      this.pendingGuardBattle = null;
      this.startMovementGuardBattle(npc, guard);
      return;
    }
    if (this.pendingNpcShopStart) {
      const pending = this.pendingNpcShopStart;
      this.pendingNpcShopStart = null;
      if (!this.startShopPrompt(pending.npc)) {
        this.startDialogue(pending.npc.dialogueSpeaker ?? pending.npc.name, ['This shop is unavailable right now.']);
      }
      return;
    }
    if (this.pendingNpcInteractBattleStart) {
      const pending = this.pendingNpcInteractBattleStart;
      this.pendingNpcInteractBattleStart = null;
      this.startNpcBattle(pending.npc, {
        defeatedFlag: pending.defeatedFlag,
        rewards: pending.rewards,
      });
      return;
    }
    if (this.pendingStoryAction === 'open-starter-selection') {
      this.pendingStoryAction = null;
      this.openStarterSelection();
      return;
    }
    if (this.pendingStoryAction === 'start-jacob-battle') {
      this.pendingStoryAction = null;
      this.startJacobBattle();
      return;
    }
    if (this.pendingStoryAction === 'start-jacob-exit') {
      this.startJacobExitCutscene();
    }
  }

  private checkAutomaticWarp(): void {
    if (this.dialogue || this.warpCooldownMs > 0) {
      return;
    }

    const map = this.getCurrentMap();
    for (const warp of map.warps) {
      if (warp.requireInteract) {
        continue;
      }
      if (this.findWarpFromIndexAt(warp, this.playerPosition) < 0) {
        continue;
      }
      this.triggerWarp(warp, this.playerPosition);
      break;
    }
  }

  private tryTriggerWalkEncounter(): void {
    if (this.activeBattle) {
      return;
    }

    const map = this.getCurrentMap();
    const group = map.encounterGroups.find((entry) =>
      entry.tilePositions.some((position) => position.x === this.playerPosition.x && position.y === this.playerPosition.y),
    );
    if (!group) {
      return;
    }
    if (!group.walkEncounterTableId || group.walkFrequency <= 0) {
      return;
    }

    if (Math.random() >= group.walkFrequency) {
      return;
    }

    const table = this.encounterTableLookup[group.walkEncounterTableId];
    if (!table || table.entries.length === 0) {
      return;
    }

    const encounterEntry = sampleEncounterEntry(table.entries);
    if (!encounterEntry) {
      return;
    }
    this.resolveEncounterEntryOutcome(map.id, group.id, encounterEntry, 'walk');
  }

  private tryUseToolItem(item: GameItemDefinition): boolean {
    const effect = item.effectConfig as { actionId?: string; successText?: string };
    const actionId = typeof effect.actionId === 'string' ? effect.actionId.trim().toLowerCase() : '';
    if (actionId === 'fishing') {
      return this.tryUseFishingTool(item);
    }
    this.showMessage(this.resolveItemSuccessText(item, effect.successText?.trim() || `${item.name} used.`), 2000);
    return true;
  }

  private tryUseFishingTool(item: GameItemDefinition): boolean {
    const fishingContext = this.getFishingContextForFacingTile();
    if (!fishingContext) {
      this.showItemMisuse(item, 'There is nothing to fish here.');
      return false;
    }

    const power = this.resolveFishingPower(item);
    this.fishingSession = {
      mapId: fishingContext.map.id,
      groupId: fishingContext.group.id,
      tableId: fishingContext.table.id,
      fishFrequency: clamp(fishingContext.group.fishFrequency, 0, 1),
      targetTile: { ...fishingContext.targetTile },
      itemId: item.id,
      itemName: item.name,
      power,
      hasPendingBite: false,
      waitDurationMs: this.resolveFishingBiteWaitMs(power),
      waitRemainingMs: 0,
      biteWindowRemainingMs: 0,
      biteWindowDurationMs: 0,
    };
    this.fishingSession.waitRemainingMs = this.fishingSession.waitDurationMs;
    return true;
  }

  private tryHandleFishingInputKey(key: string): boolean {
    const isFishingKey = key === 'f' || key === 'F';
    const canReelWithInteract = isInteractKey(key) && this.fishingSession?.hasPendingBite;
    if (!isFishingKey && !canReelWithInteract) {
      return false;
    }

    if (canReelWithInteract) {
      this.resolveFishingReelIn();
      return true;
    }

    if (this.fishingSession) {
      if (this.fishingSession.hasPendingBite) {
        this.resolveFishingReelIn();
      }
      return true;
    }

    const fishingTool = this.getHotkeyFishingToolItem();
    if (!fishingTool) {
      return false;
    }
    this.tryUseFishingTool(fishingTool);
    return true;
  }

  private tickFishing(deltaMs: number): void {
    const session = this.fishingSession;
    if (!session) {
      return;
    }

    if (session.mapId !== this.currentMapId || this.activeBattle) {
      this.clearFishingSession();
      return;
    }

    if (session.hasPendingBite) {
      session.biteWindowRemainingMs = Math.max(0, session.biteWindowRemainingMs - deltaMs);
      if (session.biteWindowRemainingMs <= 0) {
        this.clearFishingSession();
        this.showMessage('The fish got away...', 1600);
      }
      return;
    }

    session.waitRemainingMs = Math.max(0, session.waitRemainingMs - deltaMs);
    if (session.waitRemainingMs > 0) {
      return;
    }

    if (Math.random() >= session.fishFrequency) {
      this.clearFishingSession();
      this.startDialogue('Fishing', ['No bites right now.']);
      return;
    }

    const biteWindowMs = this.resolveFishingBiteWindowMs(session.power);
    session.hasPendingBite = true;
    session.biteWindowDurationMs = biteWindowMs;
    session.biteWindowRemainingMs = biteWindowMs;
    this.ensureFishingBiteIconLoaded();
  }

  private clearFishingSession(): void {
    this.fishingSession = null;
  }

  private getHotkeyFishingToolItem(): GameItemDefinition | null {
    for (const item of this.itemDatabase) {
      if (!item.isActive || item.effectType !== 'tool_action') {
        continue;
      }
      const effect = item.effectConfig as { actionId?: string };
      const actionId = typeof effect.actionId === 'string' ? effect.actionId.trim().toLowerCase() : '';
      if (actionId !== 'fishing') {
        continue;
      }
      if (getItemInventoryQuantity(this.playerItemInventory, item.id) <= 0) {
        continue;
      }
      return item;
    }
    return null;
  }

  private getFishingContextForFacingTile(): {
    map: WorldMap;
    group: WorldMap['encounterGroups'][number];
    table: EncounterTableDefinition;
    targetTile: Vector2;
  } | null {
    const map = this.getCurrentMap();
    const targetTile = this.getFacingTile();
    if (!isInsideMap(map, targetTile.x, targetTile.y)) {
      return null;
    }

    const group = map.encounterGroups.find(
      (entry) =>
        Boolean(entry.fishEncounterTableId) &&
        entry.fishFrequency > 0 &&
        entry.tilePositions.some((position) => position.x === targetTile.x && position.y === targetTile.y),
    );
    if (!group?.fishEncounterTableId) {
      return null;
    }
    const table = this.encounterTableLookup[group.fishEncounterTableId];
    if (!table || table.entries.length === 0) {
      return null;
    }
    return {
      map,
      group,
      table,
      targetTile,
    };
  }

  private resolveFishingPower(item: GameItemDefinition): number {
    const effect = item.effectConfig as { power?: number };
    const raw =
      typeof effect.power === 'number' && Number.isFinite(effect.power)
        ? effect.power
        : typeof item.value === 'number' && Number.isFinite(item.value)
          ? item.value
          : DEFAULT_FISHING_POWER;
    return clamp(raw, FISHING_POWER_MIN, FISHING_POWER_MAX);
  }

  private resolveFishingBiteWaitMs(power: number): number {
    const clampedPower = clamp(power, FISHING_POWER_MIN, FISHING_POWER_MAX);
    const minWait = Math.round(lerp(2400, FISHING_MIN_BITE_WAIT_MS, clampedPower));
    const maxWait = Math.round(lerp(FISHING_MAX_BITE_WAIT_MS, 1600, clampedPower));
    return randomInt(Math.max(300, Math.min(minWait, maxWait)), Math.max(minWait, maxWait));
  }

  private resolveFishingBiteWindowMs(power: number): number {
    const clampedPower = clamp(power, FISHING_POWER_MIN, FISHING_POWER_MAX);
    const minWindow = Math.round(lerp(FISHING_MIN_BITE_WINDOW_MS, 5000, clampedPower));
    const maxWindow = Math.round(lerp(2000, FISHING_MAX_BITE_WINDOW_MS, clampedPower));
    return randomInt(Math.max(500, Math.min(minWindow, maxWindow)), Math.max(minWindow, maxWindow));
  }

  private resolveFishingReelIn(): void {
    const session = this.fishingSession;
    if (!session || !session.hasPendingBite) {
      return;
    }

    const table = this.encounterTableLookup[session.tableId];
    if (!table || table.entries.length === 0) {
      this.clearFishingSession();
      this.showMessage('The water seems quiet.', 1600);
      return;
    }

    const encounterEntry = sampleEncounterEntry(table.entries);
    this.clearFishingSession();
    if (!encounterEntry) {
      this.showMessage('The water seems quiet.', 1600);
      return;
    }
    this.resolveEncounterEntryOutcome(session.mapId, session.groupId, encounterEntry, 'fishing');
  }

  private resolveEncounterEntryOutcome(
    mapId: string,
    groupId: string,
    encounterEntry: EncounterTableEntry,
    source: 'walk' | 'fishing',
  ): void {
    if (isCritterEncounterEntry(encounterEntry)) {
      const critter = this.critterLookup[encounterEntry.critterId];
      if (!critter) {
        if (source === 'fishing') {
          this.showMessage('The fish escaped.', 1600);
        }
        return;
      }
      this.startWildBattle(mapId, groupId, critter, encounterEntry);
      return;
    }

    const item = this.itemById[encounterEntry.itemId];
    if (!item?.isActive) {
      this.showMessage(source === 'fishing' ? 'You reeled in nothing.' : 'You found nothing.', 1600);
      return;
    }
    const quantity = this.resolveEncounterItemAmount(encounterEntry);
    const granted = this.grantNpcItemRewards([{ itemId: item.id, quantity }]);
    if (granted.length === 0) {
      this.showMessage(source === 'fishing' ? 'You reeled in nothing.' : 'You found nothing.', 1600);
      return;
    }
    const reward = granted[0];
    if (source === 'fishing') {
      this.showMessage(`You fished up ${reward.quantity}x ${reward.itemName}!`, 2200);
      return;
    }
    this.showMessage(`You found ${reward.quantity}x ${reward.itemName}!`, 2200);
  }

  private resolveEncounterItemAmount(entry: EncounterTableItemEntry): number {
    const hasMin = typeof entry.minAmount === 'number' && Number.isFinite(entry.minAmount);
    const hasMax = typeof entry.maxAmount === 'number' && Number.isFinite(entry.maxAmount);
    const min = hasMin ? clamp(Math.floor(entry.minAmount as number), 1, 9999) : null;
    const max = hasMax ? clamp(Math.floor(entry.maxAmount as number), 1, 9999) : null;
    if (min !== null && max !== null) {
      return randomInt(Math.min(min, max), Math.max(min, max));
    }
    if (min !== null) {
      return min;
    }
    if (max !== null) {
      return max;
    }
    return 1;
  }

  private tryUseHealingItem(item: GameItemDefinition, squadSlotIndex: number | null): boolean {
    if (squadSlotIndex === null || !Number.isInteger(squadSlotIndex)) {
      this.showItemMisuse(item, 'Choose a squad critter to heal.');
      return false;
    }
    const slotLimit = this.getUnlockedSquadSlotLimit();
    if (squadSlotIndex < 0 || squadSlotIndex >= slotLimit) {
      this.showItemMisuse(item, 'Choose a valid squad slot.');
      return false;
    }
    const critterId = this.playerCritterProgress.squad[squadSlotIndex];
    if (critterId === null) {
      this.showItemMisuse(item, 'Choose a squad critter to heal.');
      return false;
    }
    const critter = this.critterLookup[critterId];
    const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === critterId);
    if (!critter || !progress?.unlocked) {
      this.showItemMisuse(item, 'Choose a squad critter to heal.');
      return false;
    }

    const equipmentState = this.resolveEquipmentStateForCritter(progress, critter, true);
    const equipmentEffects = this.getEquipmentEffectsFromAnchors(equipmentState.anchors);
    const adjustedStats = this.applyEquipmentEffectsToStats(progress.effectiveStats, equipmentEffects);
    const maxHp = Math.max(1, adjustedStats.hp);
    const currentHp = clamp(progress.currentHp, 0, maxHp);
    if (currentHp <= 0) {
      this.showItemMisuse(item, 'Cannot heal a knocked out critter this way. Please use a healer.');
      return false;
    }
    if (currentHp >= maxHp) {
      this.showItemMisuse(item, `${critter.name} is already at full HP.`);
      return false;
    }

    const effect = item.effectConfig as { healAmount?: number; healPercent?: number; curesStatus?: boolean };
    const value = typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : undefined;
    const healAmountFromFlat =
      item.effectType === 'heal_flat'
        ? clamp(
            typeof value === 'number'
              ? Math.floor(value)
              : typeof effect.healAmount === 'number'
                ? Math.floor(effect.healAmount)
                : 20,
            1,
            9999,
          )
        : 0;
    const healAmountFromPercent =
      item.effectType === 'heal_percent'
        ? Math.max(
            1,
            Math.floor(
              maxHp *
                clamp(
                  typeof value === 'number'
                    ? value
                    : typeof effect.healPercent === 'number'
                      ? effect.healPercent
                      : 0.25,
                  0.01,
                  1,
                ),
            ),
          )
        : 0;
    const requestedHeal = Math.max(healAmountFromFlat, healAmountFromPercent, 1);
    const appliedHeal = Math.min(requestedHeal, Math.max(0, maxHp - currentHp));
    if (appliedHeal <= 0) {
      this.showItemMisuse(item, `${critter.name} cannot be healed right now.`);
      return false;
    }

    progress.currentHp = currentHp + appliedHeal;
    this.incrementSimpleCritterMissionProgress(
      critterId,
      (mission) => mission.type === 'heal_critter' && this.matchesHealCritterMissionItem(mission, item.id),
    );
    this.markProgressDirty();
    const fallbackText = effect.curesStatus
      ? `${critter.name} recovered ${appliedHeal} HP and feels refreshed.`
      : `${critter.name} recovered ${appliedHeal} HP.`;
    this.showMessage(
      this.resolveItemSuccessText(item, fallbackText, {
        critterName: critter.name,
        value: appliedHeal,
      }),
      2200,
    );
    return true;
  }

  private tryUseEquipmentItem(item: GameItemDefinition, squadSlotIndex: number | null): boolean {
    if (squadSlotIndex === null || !Number.isInteger(squadSlotIndex)) {
      this.showItemMisuse(item, 'Choose a squad critter to equip.');
      return false;
    }
    const slotLimit = this.getUnlockedSquadSlotLimit();
    if (squadSlotIndex < 0 || squadSlotIndex >= slotLimit) {
      this.showItemMisuse(item, 'Choose a valid squad slot.');
      return false;
    }
    const critterId = this.playerCritterProgress.squad[squadSlotIndex];
    if (critterId === null) {
      this.showItemMisuse(item, 'Choose a squad critter to equip.');
      return false;
    }
    const critter = this.critterLookup[critterId];
    const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === critterId);
    if (!critter || !progress?.unlocked) {
      this.showItemMisuse(item, 'Choose a squad critter to equip.');
      return false;
    }

    const equipmentItem = this.getEquipmentItemById(item.id);
    if (!equipmentItem || !equipmentItem.isActive) {
      this.showItemMisuse(item, 'That equipment is unavailable.');
      return false;
    }

    const slotCount = Math.max(0, computeCritterUnlockedEquipSlots(critter, progress.level));
    if (slotCount <= 0) {
      this.showItemMisuse(item, `${critter.name} has no unlocked equip slots.`);
      return false;
    }

    const currentState = this.resolveEquipmentStateForCritter(progress, critter, false);
    const equipSize = this.getEquipmentItemSizeById(equipmentItem.id);

    const ownedQuantity = getItemInventoryQuantity(this.playerItemInventory, equipmentItem.id);
    const equippedElsewhereCount = this.countEquippedItemCopies(equipmentItem.id);
    if (ownedQuantity <= equippedElsewhereCount) {
      this.showItemMisuse(item, `No unequipped copies of ${equipmentItem.name} are available.`);
      return false;
    }

    if (currentState.anchors.some((anchor) => anchor.itemId === equipmentItem.id)) {
      this.showItemMisuse(item, `${critter.name} already has ${equipmentItem.name} equipped.`);
      return false;
    }

    let selectedSlot = -1;
    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      if (
        canEquipAtSlot({
          state: currentState,
          slotIndex,
          itemId: equipmentItem.id,
          equipSize,
        })
      ) {
        selectedSlot = slotIndex;
        break;
      }
    }
    if (selectedSlot < 0) {
      this.showItemMisuse(
        item,
        `${equipmentItem.name} needs ${equipSize} contiguous empty equip slot${equipSize === 1 ? '' : 's'}.`,
      );
      return false;
    }

    const nextAnchors = [...currentState.anchors, { itemId: equipmentItem.id, slotIndex: selectedSlot }];
    const nextState = resolveEquipmentState(nextAnchors, slotCount, (id) => this.getEquipmentItemSizeById(id));
    progress.equippedEquipmentAnchors = nextState.anchors;
    this.markProgressDirty();
    this.showMessage(`Equipped ${equipmentItem.name} on ${critter.name}.`, 1800);
    return true;
  }

  private resolveItemSuccessText(
    item: GameItemDefinition,
    fallback: string,
    context?: { critterName?: string; value?: number },
  ): string {
    const success = (item.successText ?? '').trim();
    let text = success || fallback;
    if (context?.critterName) {
      text = text.replace(/<Critter>/g, context.critterName).replace(/\{critter\}/gi, context.critterName);
    }
    if (typeof context?.value === 'number' && Number.isFinite(context.value)) {
      const valueLabel = String(Math.max(0, Math.floor(context.value)));
      text = text.replace(/<X>/g, valueLabel).replace(/\bX\b/g, valueLabel);
    }
    return text.trim() || fallback;
  }

  private showItemMisuse(item: GameItemDefinition, fallback: string): void {
    const text = item.misuseText.trim() || fallback;
    if (!text) {
      return;
    }
    this.showMessage(text, 2200);
  }

  private normalizeNpcItemRewards(rewards: NpcItemRewardDefinition[] | undefined): NpcItemRewardDefinition[] {
    if (!Array.isArray(rewards) || rewards.length === 0) {
      return [];
    }
    const merged = new Map<string, number>();
    for (const entry of rewards) {
      const itemId = typeof entry?.itemId === 'string' ? entry.itemId.trim() : '';
      const quantity =
        typeof entry?.quantity === 'number' && Number.isFinite(entry.quantity) ? Math.max(0, Math.floor(entry.quantity)) : 0;
      if (!itemId || quantity <= 0) {
        continue;
      }
      const item = this.itemById[itemId];
      if (!item || !item.isActive) {
        continue;
      }
      merged.set(itemId, (merged.get(itemId) ?? 0) + quantity);
    }
    return [...merged.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
  }

  private grantNpcItemRewards(
    rewards: NpcItemRewardDefinition[],
  ): Array<{ itemId: string; itemName: string; quantity: number }> {
    const normalized = this.normalizeNpcItemRewards(rewards);
    if (normalized.length === 0) {
      return [];
    }
    const granted: Array<{ itemId: string; itemName: string; quantity: number }> = [];
    let nextInventory = this.playerItemInventory;
    for (const entry of normalized) {
      const item = this.itemById[entry.itemId];
      if (!item || !item.isActive) {
        continue;
      }
      const before = getItemInventoryQuantity(nextInventory, item.id);
      nextInventory = setItemInventoryQuantity(nextInventory, this.itemDatabase, item.id, before + entry.quantity);
      const after = getItemInventoryQuantity(nextInventory, item.id);
      const grantedQuantity = Math.max(0, after - before);
      if (grantedQuantity <= 0) {
        continue;
      }
      granted.push({
        itemId: item.id,
        itemName: item.name,
        quantity: grantedQuantity,
      });
    }
    if (granted.length > 0) {
      this.playerItemInventory = nextInventory;
      this.markProgressDirty();
    }
    return granted;
  }

  private buildRewardDialogueLines(
    rewards: NpcItemRewardDefinition[],
    options?: {
      intro?: string;
      fallback?: string;
    },
  ): string[] {
    const normalized = this.normalizeNpcItemRewards(rewards);
    const lines: string[] = [];
    if (options?.intro?.trim()) {
      lines.push(options.intro.trim());
    }
    for (const reward of normalized) {
      const item = this.itemById[reward.itemId];
      if (!item) {
        continue;
      }
      lines.push(`You received ${reward.quantity} ${item.name}.`);
    }
    if (lines.length === 0 && options?.fallback?.trim()) {
      lines.push(options.fallback.trim());
    }
    return lines;
  }

  private startWildBattle(
    mapId: string,
    groupId: string,
    critter: CritterDefinition,
    encounterEntry: EncounterTableCritterEntry | null = null,
  ): void {
    const playerTeam = this.buildPlayerBattleTeam();
    if (!this.hasBattleReadyCritter(playerTeam)) {
      this.handleEmptyPlayerBattleTeam();
      return;
    }

    const encounterLevel = this.resolveEncounterLevel(critter, encounterEntry);
    const opponent = this.buildWildBattleCritter(critter, encounterLevel);
    this.pendingNpcShopStart = null;
    this.pendingNpcInteractBattleStart = null;
    this.pendingNpcInteractBattleDefeat = null;
    this.pendingBattleRewardDialogue = null;
    this.lastEncounter = {
      mapId,
      groupId,
      critterId: critter.id,
      critterName: critter.name,
      level: opponent.level,
    };
    this.startBattle(
      {
        type: 'wild',
        mapId,
        groupId,
        label: `Wild ${critter.name}`,
      },
      playerTeam,
      [opponent],
      `A wild ${critter.name} appeared!`,
    );
  }

  private startBattle(
    source: BattleSourceState,
    playerTeam: BattleCritterState[],
    opponentTeam: BattleCritterState[],
    openingLine: string,
  ): void {
    if (playerTeam.length === 0 || opponentTeam.length === 0) {
      return;
    }

    const transitionDurationMs = 760;
    this.clearFishingSession();
    this.pendingNpcShopStart = null;
    this.pendingNpcInteractBattleStart = null;
    this.moveStep = null;
    this.heldDirections = [];
    this.activeBattle = {
      id: this.nextBattleId,
      source,
      phase: 'transition',
      result: 'ongoing',
      transitionEffect: randomBattleTransitionEffect(),
      transitionDurationMs,
      transitionRemainingMs: transitionDurationMs,
      turnNumber: 1,
      logLine: openingLine,
      playerTeam,
      opponentTeam,
      playerActiveIndex: null,
      opponentActiveIndex: source.type === 'wild' ? 0 : null,
      pendingOpponentSwitchIndex: null,
      pendingOpponentSwitchDelayMs: 0,
      pendingOpponentSwitchAnnouncementShown: false,
      pendingForcedSwap: false,
      narrationQueue: [],
      activeNarration: null,
      activeAnimation: null,
      pendingKnockoutResolution: null,
      nextAnimationToken: 1,
    };
    this.nextBattleId += 1;
  }

  private updateBattle(deltaMs: number): void {
    const battle = this.activeBattle;
    if (!battle) {
      return;
    }

    if (battle.activeAnimation) {
      battle.activeAnimation.remainingMs = Math.max(0, battle.activeAnimation.remainingMs - deltaMs);
      if (battle.activeAnimation.remainingMs <= 0) {
        battle.activeAnimation = null;
      }
    }

    this.updatePendingKnockoutResolution(battle, deltaMs);
    this.updatePendingOpponentSwitchAnnouncement(battle, deltaMs);

    if (battle.phase !== 'transition') {
      return;
    }

    battle.transitionRemainingMs = Math.max(0, battle.transitionRemainingMs - deltaMs);
    if (battle.transitionRemainingMs > 0) {
      return;
    }

    battle.phase = 'choose-starter';
    battle.logLine =
      battle.source.type === 'wild'
        ? `${battle.source.label} appeared. Choose your lead critter.`
        : 'Choose your lead critter.';
  }

  private updatePendingKnockoutResolution(battle: BattleRuntimeState, deltaMs: number): void {
    const pending = battle.pendingKnockoutResolution;
    if (!pending) {
      return;
    }

    pending.remainingMs = Math.max(0, pending.remainingMs - deltaMs);
    if (pending.remainingMs > 0) {
      return;
    }

    battle.pendingKnockoutResolution = null;
    if (battle.result !== 'ongoing') {
      return;
    }

    if (pending.defenderTeam === 'opponent') {
      this.handleOpponentKnockout(battle, pending.playerAttackerCritterId);
      return;
    }
    this.handlePlayerKnockout(battle);
  }

  private updatePendingOpponentSwitchAnnouncement(battle: BattleRuntimeState, deltaMs: number): void {
    if (battle.result !== 'ongoing' || battle.pendingOpponentSwitchIndex === null) {
      return;
    }
    if (battle.pendingOpponentSwitchAnnouncementShown) {
      if (battle.activeNarration || battle.narrationQueue.length > 0) {
        return;
      }
      const nextIndex = battle.pendingOpponentSwitchIndex;
      if (nextIndex < 0 || nextIndex >= battle.opponentTeam.length) {
        battle.pendingOpponentSwitchIndex = null;
        battle.pendingOpponentSwitchDelayMs = 0;
        battle.pendingOpponentSwitchAnnouncementShown = false;
        return;
      }
      battle.opponentActiveIndex = nextIndex;
      battle.pendingOpponentSwitchIndex = null;
      battle.pendingOpponentSwitchDelayMs = 0;
      battle.pendingOpponentSwitchAnnouncementShown = false;
      battle.activeAnimation = {
        attacker: 'opponent',
        remainingMs: 320,
        durationMs: 320,
        token: battle.nextAnimationToken,
      };
      battle.nextAnimationToken += 1;
      if (battle.phase === 'player-turn') {
        battle.logLine = 'Choose your move.';
      }
      return;
    }
    if (battle.activeNarration || battle.narrationQueue.length > 0) {
      return;
    }
    battle.pendingOpponentSwitchDelayMs = Math.max(0, battle.pendingOpponentSwitchDelayMs - deltaMs);
    if (battle.pendingOpponentSwitchDelayMs > 0) {
      return;
    }
    const nextIndex = battle.pendingOpponentSwitchIndex;
    if (nextIndex < 0 || nextIndex >= battle.opponentTeam.length) {
      battle.pendingOpponentSwitchIndex = null;
      return;
    }
    const next = battle.opponentTeam[nextIndex];
    battle.pendingOpponentSwitchAnnouncementShown = true;
    battle.activeNarration = {
      message: `${battle.source.label} selected ${next.name}.`,
      attacker: null,
    };
    battle.logLine = battle.activeNarration.message;
    battle.activeAnimation = null;
  }

  private buildPlayerBattleTeam(): BattleCritterState[] {
    const collectionById = this.playerCritterProgress.collection.reduce<Record<number, PlayerCritterProgress['collection'][number]>>(
      (registry, entry) => {
        registry[entry.critterId] = entry;
        return registry;
      },
      {},
    );

    const team: BattleCritterState[] = [];
    for (let index = 0; index < this.playerCritterProgress.squad.length; index += 1) {
      if (index >= this.playerCritterProgress.unlockedSquadSlots) {
        continue;
      }

      const critterId = this.playerCritterProgress.squad[index];
      if (!critterId) {
        continue;
      }
      const critter = this.critterLookup[critterId];
      const progress = collectionById[critterId];
      if (!critter || !progress?.unlocked) {
        continue;
      }

      const level = Math.max(1, progress.level);
      const derived = computeCritterDerivedProgress(critter, level);
      const effectiveStats = progress.effectiveStats ?? derived.effectiveStats;
      const equipmentState = this.resolveEquipmentStateForCritter(progress, critter, true);
      const equipmentEffects = this.getEquipmentEffectsFromAnchors(equipmentState.anchors);
      const equipmentAdjustedStats = this.applyEquipmentEffectsToStats(effectiveStats, equipmentEffects);
      const equipmentEffectIds = equipmentEffects
        .map((effect) => effect.effect_id)
        .filter((id, idx, arr) => arr.indexOf(id) === idx);
      const maxHp = Math.max(1, equipmentAdjustedStats.hp);
      const currentHp = clamp(progress.currentHp, 0, maxHp);
      team.push({
        slotIndex: index,
        critterId: critter.id,
        name: critter.name,
        element: critter.element,
        spriteUrl: critter.spriteUrl,
        level,
        maxHp,
        currentHp,
        attack: Math.max(1, equipmentAdjustedStats.attack),
        defense: Math.max(1, equipmentAdjustedStats.defense),
        speed: Math.max(1, equipmentAdjustedStats.speed),
        fainted: currentHp <= 0,
        knockoutProgressCounted: false,
        attackModifier: 1,
        defenseModifier: 1,
        speedModifier: 1,
        activeEffectIds: [],
        equipmentEffectIds,
        consecutiveSuccessfulGuardCount: 0,
        equippedSkillIds: progress.equippedSkillIds,
      });
    }

    return team;
  }

  private hasBattleReadyCritter(team: BattleCritterState[]): boolean {
    return team.some((entry) => !entry.fainted && entry.currentHp > 0);
  }

  private resolveEncounterLevel(
    critter: CritterDefinition,
    encounterEntry: EncounterTableCritterEntry | null,
  ): number | null {
    if (!encounterEntry) {
      return null;
    }
    const configuredLevels = critter.levels.map((entry) => Math.max(1, entry.level));
    const levelsInRange = configuredLevels.filter((level) => {
      if (typeof encounterEntry.minLevel === 'number' && level < encounterEntry.minLevel) {
        return false;
      }
      if (typeof encounterEntry.maxLevel === 'number' && level > encounterEntry.maxLevel) {
        return false;
      }
      return true;
    });
    if (levelsInRange.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * levelsInRange.length);
    return levelsInRange[index] ?? null;
  }

  private buildWildBattleCritter(critter: CritterDefinition, levelOverride: number | null = null): BattleCritterState {
    const highestPlayerLevel = this.playerCritterProgress.collection.reduce((highest, entry) => {
      if (!entry.unlocked) {
        return highest;
      }
      return Math.max(highest, Math.max(1, entry.level));
    }, 1);
    const maxConfiguredLevel = Math.max(1, ...critter.levels.map((entry) => entry.level));
    const level =
      typeof levelOverride === 'number'
        ? clamp(levelOverride, 1, maxConfiguredLevel)
        : clamp(highestPlayerLevel + randomInt(-1, 1), 1, maxConfiguredLevel);
    const derived = computeCritterDerivedProgress(critter, level);
    const maxHp = Math.max(1, derived.effectiveStats.hp);

    // Randomly select up to 4 moves from unlocked movepool
    const unlockedSkillIds = derived.unlockedSkillIds ?? [];
    const shuffledSkills = [...unlockedSkillIds].sort(() => Math.random() - 0.5);
    const selectedSkills = shuffledSkills.slice(0, 4);
    const equippedSkillIds: BattleEquippedSkillSlots = [
      selectedSkills[0] ?? null,
      selectedSkills[1] ?? null,
      selectedSkills[2] ?? null,
      selectedSkills[3] ?? null,
    ];

    return {
      slotIndex: null,
      critterId: critter.id,
      name: critter.name,
      element: critter.element,
      spriteUrl: critter.spriteUrl,
      level,
      maxHp,
      currentHp: maxHp,
      attack: Math.max(1, derived.effectiveStats.attack),
      defense: Math.max(1, derived.effectiveStats.defense),
      speed: Math.max(1, derived.effectiveStats.speed),
      fainted: false,
      knockoutProgressCounted: false,
      attackModifier: 1,
      defenseModifier: 1,
      speedModifier: 1,
      activeEffectIds: [],
      equipmentEffectIds: [],
      consecutiveSuccessfulGuardCount: 0,
      equippedSkillIds,
    };
  }

  private resolvePlayerTurnAction(
    battle: BattleRuntimeState,
    action: 'attack' | 'guard',
    playerSkillSlotIndex?: number,
  ): void {
    if (battle.phase !== 'player-turn' || battle.result !== 'ongoing') {
      return;
    }

    const player = this.getActiveBattleCritter(battle, 'player');
    const opponent = this.getActiveBattleCritter(battle, 'opponent');
    if (!player || !opponent) {
      this.setBattleResult(battle, 'lost', 'Battle ended unexpectedly.');
      return;
    }

    battle.turnNumber += 1;

    const narration: BattleNarrationEvent[] = [];

    if (action === 'guard') {
      const guardSuccessChance = Math.pow(0.5, player.consecutiveSuccessfulGuardCount);
      const guardSucceeded = Math.random() < guardSuccessChance;
      if (guardSucceeded) {
        player.consecutiveSuccessfulGuardCount += 1;
        if (this.incrementSimpleCritterMissionProgress(player.critterId, (mission) => mission.type === 'use_guard')) {
          this.markProgressDirty();
        }
      } else {
        player.consecutiveSuccessfulGuardCount = 0;
      }
      narration.push({
        message: `Your ${player.name} used Guard!`,
        attacker: null,
      });
      if (!guardSucceeded) {
        narration.push({ message: "Guard failed!", attacker: null });
      }
      const opponentResult = this.executeBattleSkill(battle, 'opponent', true, guardSucceeded);
      if (opponentResult.narration) {
        narration.push(opponentResult.narration);
      }
      this.startBattleNarration(battle, narration);
      return;
    }

    const playerSkill =
      typeof playerSkillSlotIndex === 'number' && player.equippedSkillIds
        ? (this.skillLookupById[player.equippedSkillIds[playerSkillSlotIndex] ?? ''] ?? DEFAULT_TACKLE_SKILL)
        : DEFAULT_TACKLE_SKILL;

    const playerActsFirst =
      player.speed * Math.max(1, player.speedModifier) >= opponent.speed * Math.max(1, opponent.speedModifier);

    if (playerActsFirst) {
      const playerResult = this.executeBattleSkillWithSkill(
        battle,
        'player',
        playerSkill,
        playerSkillSlotIndex ?? 0,
        false,
        false,
      );
      if (playerResult.narration) {
        narration.push(playerResult.narration);
      }
      if (playerResult.defenderFainted || battle.result !== 'ongoing' || battle.phase !== 'player-turn') {
        this.startBattleNarration(battle, narration);
        return;
      }

      const opponentResult = this.executeBattleSkill(battle, 'opponent', false, false);
      if (opponentResult.narration) {
        narration.push(opponentResult.narration);
      }
      this.startBattleNarration(battle, narration);
      return;
    }

    const opponentResult = this.executeBattleSkill(battle, 'opponent', false, false);
    if (opponentResult.narration) {
      narration.push(opponentResult.narration);
    }
    if (opponentResult.defenderFainted || battle.result !== 'ongoing' || battle.phase !== 'player-turn') {
      this.startBattleNarration(battle, narration);
      return;
    }

    const playerResult = this.executeBattleSkillWithSkill(
      battle,
      'player',
      playerSkill,
      playerSkillSlotIndex ?? 0,
      false,
      false,
    );
    if (playerResult.narration) {
      narration.push(playerResult.narration);
    }
    this.startBattleNarration(battle, narration);
  }

  private resolveOpponentCounterAfterSwap(
    battle: BattleRuntimeState,
    previousCritterName: string,
    nextCritterName: string,
  ): void {
    if (battle.result !== 'ongoing') {
      return;
    }

    const narration: BattleNarrationEvent[] = [
      {
        message: `You swapped ${previousCritterName} for ${nextCritterName}.`,
        attacker: null,
      },
    ];
    const opponentAttack = this.executeBattleSkill(battle, 'opponent', false, false);
    if (opponentAttack.narration) {
      narration.push(opponentAttack.narration);
    }
    this.startBattleNarration(battle, narration);
  }

  private executeBattleSkill(
    battle: BattleRuntimeState,
    attackingTeam: 'player' | 'opponent',
    defenderGuarded: boolean,
    guardSucceeded: boolean,
  ): { narration: BattleNarrationEvent | null; defenderFainted: boolean; damageToDefender?: number } {
    const attacker = this.getActiveBattleCritter(battle, attackingTeam);
    let skill = DEFAULT_TACKLE_SKILL;
    let skillSlotIndex = 0;

    // For opponents, try to use a random move from their equipped skills
    if (attackingTeam === 'opponent' && attacker?.equippedSkillIds) {
      const availableSkills = attacker.equippedSkillIds.filter((id): id is string => id !== null);
      if (availableSkills.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableSkills.length);
        const selectedSkillId = availableSkills[randomIndex];
        if (selectedSkillId) {
          const foundSkill = this.skillLookupById[selectedSkillId];
          if (foundSkill) {
            skill = foundSkill;
            skillSlotIndex = attacker.equippedSkillIds.indexOf(selectedSkillId);
          }
        }
      }
    }

    return this.executeBattleSkillWithSkill(
      battle,
      attackingTeam,
      skill,
      skillSlotIndex,
      defenderGuarded,
      guardSucceeded,
    );
  }

  private executeBattleSkillWithSkill(
    battle: BattleRuntimeState,
    attackingTeam: 'player' | 'opponent',
    skill: SkillDefinition,
    _skillSlotIndex: number,
    defenderGuarded: boolean,
    guardSucceeded: boolean,
  ): { narration: BattleNarrationEvent | null; defenderFainted: boolean; damageToDefender?: number } {
    const attacker = this.getActiveBattleCritter(battle, attackingTeam);
    const defender = this.getActiveBattleCritter(battle, attackingTeam === 'player' ? 'opponent' : 'player');
    if (!attacker || !defender || attacker.fainted) {
      return { narration: null, defenderFainted: false };
    }

    const applyDamageDefender: 'player' | 'opponent' = attackingTeam === 'player' ? 'opponent' : 'player';
    const defenderTeam = attackingTeam === 'player' ? battle.opponentTeam : battle.playerTeam;
    const defenderActiveIndex = attackingTeam === 'player' ? battle.opponentActiveIndex : battle.playerActiveIndex;

    if (skill.type === 'support') {
      const healPercent = (skill.healPercent ?? 0) + (skill.element === attacker.element && (skill.healPercent ?? 0) > 0 ? 0.03 : 0);
      const healAmount = Math.floor(attacker.maxHp * healPercent);
      const actualHeal = Math.min(healAmount, Math.max(0, attacker.maxHp - attacker.currentHp));
      if (actualHeal > 0) {
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + actualHeal);
      }
      this.applySkillEffectsToAttacker(attacker, skill);
      const message =
        actualHeal > 0
          ? `Your ${attacker.name} used ${skill.skill_name} and healed ${actualHeal} HP!`
          : `Your ${attacker.name} used ${skill.skill_name}.`;
      return {
        narration: {
          message,
          attacker: attackingTeam,
        },
        defenderFainted: false,
      };
    }

    const power = skill.damage ?? 20;
    const A = Math.max(1, attacker.attack * Math.max(1, attacker.attackModifier));
    const D = Math.max(1, defender.defense * Math.max(1, defender.defenseModifier));
    const levelTerm = (2 * attacker.level) / 5 + 2;
    const base = ((levelTerm * power * A) / D) / 50 + 2;
    const typeMult = getElementChartMultiplier(
      this.elementChart,
      skill.element,
      defender.element as CritterElement,
    );
    const stab = skill.element === attacker.element ? 1.2 : 1;
    const isCrit = Math.random() < 0.0155;
    const critMult = isCrit ? 2 : 1;
    const defenseForCrit = Math.max(1, defender.defense);
    const baseForCrit = isCrit
      ? ((levelTerm * power * A) / defenseForCrit) / 50 + 2
      : base;
    const guardMult =
      defenderGuarded && guardSucceeded ? 0.02 : defenderGuarded && !guardSucceeded ? 1 : 1;
    const variance = randomNumber(0.85, 1.15);
    const damage = Math.max(
      1,
      Math.floor(baseForCrit * typeMult * stab * critMult * guardMult * variance),
    );

    this.applySkillEffectsToAttacker(attacker, skill);

    const guardSuffix =
      defenderGuarded && guardSucceeded
        ? ' Guard reduced the damage.'
        : defenderGuarded && !guardSucceeded
          ? ''
          : '';
    const critSuffix = isCrit ? ' Critical hit!' : '';
    const typeEffectSuffix =
      typeMult >= 2
        ? " It's super effective!"
        : typeMult >= 1.1
          ? " It's effective!"
          : typeMult < 1 && typeMult > 0
            ? " It's not very effective..."
            : typeMult === 0
              ? " It had no effect."
              : '';
    const attackPrefix = this.formatBattleAttackWithSkillPrefix(
      battle,
      attackingTeam,
      attacker.name,
      defender.name,
      skill.skill_name,
    );
    let message = `${attackPrefix} dealt ${damage} damage.${critSuffix}${typeEffectSuffix}${guardSuffix}`.trim();
    if (defender.fainted) {
      const knockoutSuffix = this.buildKnockoutMessage(battle, applyDamageDefender, defenderActiveIndex ?? -1);
      message = `${message} ${knockoutSuffix}`.trim();
    }

    const wouldFaint = defender.currentHp <= damage;
    return {
      narration: {
        message,
        attacker: attackingTeam,
        applyDamageDefender,
        applyDamageAmount: damage,
      },
      defenderFainted: wouldFaint,
      damageToDefender: damage,
    };
  }

  private applySkillEffectsToAttacker(attacker: BattleCritterState, skill: SkillDefinition): void {
    const effectIds = skill.effectIds ?? [];
    for (const effectId of effectIds) {
      const effect = this.skillEffectLookupById[effectId];
      if (!effect) continue;
      if (effect.effect_type === 'atk_buff') {
        attacker.attackModifier += effect.buffPercent;
      } else if (effect.effect_type === 'def_buff') {
        attacker.defenseModifier += effect.buffPercent;
      } else if (effect.effect_type === 'speed_buff') {
        attacker.speedModifier += effect.buffPercent;
      }
      if (!attacker.activeEffectIds.includes(effectId)) {
        attacker.activeEffectIds.push(effectId);
      }
    }
  }

  /** Build knockout follow-up message without mutating battle state (for deferred damage narration). */
  private buildKnockoutMessage(
    battle: BattleRuntimeState,
    defenderTeam: 'player' | 'opponent',
    defeatedIndex: number,
  ): string {
    const team = defenderTeam === 'player' ? battle.playerTeam : battle.opponentTeam;
    const defeated = defeatedIndex >= 0 && defeatedIndex < team.length ? team[defeatedIndex] : null;
    const nextIndex = this.findNextAliveTeamIndexExcluding(team, defeatedIndex);
    if (defenderTeam === 'opponent') {
      if (nextIndex < 0) {
        return battle.source.type === 'wild'
          ? `The wild ${defeated?.name ?? 'critter'} fainted. You won the battle.`
          : `${battle.source.label}'s ${defeated?.name ?? 'critter'} fainted. You won the battle.`;
      }
      return `${battle.source.label}'s ${defeated?.name ?? 'critter'} fainted.`;
    }
    if (nextIndex < 0) {
      return `Your ${defeated?.name ?? 'critter'} fainted. You blacked out.`;
    }
    return `Your ${defeated?.name ?? 'critter'} fainted. Choose another squad critter.`;
  }

  private findNextAliveTeamIndexExcluding(team: BattleCritterState[], excludeIndex: number): number {
    for (let index = 0; index < team.length; index += 1) {
      if (index === excludeIndex) {
        continue;
      }
      const entry = team[index];
      if (!entry.fainted && entry.currentHp > 0) {
        return index;
      }
    }
    return -1;
  }

  private handleOpponentKnockout(battle: BattleRuntimeState, playerAttackerCritterId: number | null): string {
    const defeatedIndex = battle.opponentActiveIndex;
    if (defeatedIndex === null) {
      return 'The opposing critter fainted.';
    }

    const defeated = battle.opponentTeam[defeatedIndex];
    if (!defeated) {
      return 'The opposing critter fainted.';
    }

    if (!defeated.knockoutProgressCounted) {
      this.recordOpposingKnockoutProgress(defeated.critterId, playerAttackerCritterId);
      defeated.knockoutProgressCounted = true;
    }

    const nextIndex = this.findNextAliveTeamIndex(battle.opponentTeam, defeatedIndex);
    if (nextIndex < 0) {
      this.setBattleResult(battle, 'won', `The wild ${defeated.name} fainted. You won the battle!`);
      return battle.source.type === 'wild'
        ? `The wild ${defeated.name} fainted. You won the battle.`
        : `${battle.source.label}'s ${defeated.name} fainted. You won the battle.`;
    }
    if (battle.source.type === 'npc') {
      battle.pendingOpponentSwitchIndex = nextIndex;
      battle.pendingOpponentSwitchDelayMs = 360;
      battle.pendingOpponentSwitchAnnouncementShown = false;
      return `${battle.source.label}'s ${defeated.name} fainted.`;
    }
    battle.opponentActiveIndex = nextIndex;
    return `${battle.source.label} sent out ${battle.opponentTeam[nextIndex].name}.`;
  }

  private handlePlayerKnockout(battle: BattleRuntimeState): string {
    const defeatedIndex = battle.playerActiveIndex;
    if (defeatedIndex === null) {
      this.setBattleResult(battle, 'lost', 'Your squad has no active critter.');
      return 'Your critter fainted.';
    }

    const defeated = battle.playerTeam[defeatedIndex];
    const nextIndex = this.findNextAliveTeamIndex(battle.playerTeam, defeatedIndex);
    if (nextIndex < 0) {
      this.setBattleResult(battle, 'lost', `${defeated?.name ?? 'Your critter'} fainted. You blacked out.`);
      return `Your ${defeated?.name ?? 'critter'} fainted. You blacked out.`;
    }

    battle.phase = 'choose-swap';
    battle.pendingForcedSwap = true;
    return `Your ${defeated?.name ?? 'critter'} fainted. Choose another squad critter.`;
  }

  private formatBattleAttackPrefix(
    battle: BattleRuntimeState,
    attackingTeam: 'player' | 'opponent',
    attackerName: string,
    defenderName: string,
  ): string {
    if (attackingTeam === 'player') {
      if (battle.source.type === 'wild') {
        return `Your ${attackerName} attacked the wild ${defenderName} and`;
      }
      return `Your ${attackerName} attacked ${battle.source.label}'s ${defenderName} and`;
    }

    if (battle.source.type === 'wild') {
      return `The wild ${attackerName} attacked your ${defenderName} and`;
    }
    return `${battle.source.label}'s ${attackerName} attacked your ${defenderName} and`;
  }

  private formatBattleAttackWithSkillPrefix(
    battle: BattleRuntimeState,
    attackingTeam: 'player' | 'opponent',
    attackerName: string,
    defenderName: string,
    skillName: string,
  ): string {
    if (attackingTeam === 'player') {
      if (battle.source.type === 'wild') {
        return `Your ${attackerName} used ${skillName} on the wild ${defenderName} and`;
      }
      return `Your ${attackerName} used ${skillName} on ${battle.source.label}'s ${defenderName} and`;
    }

    if (battle.source.type === 'wild') {
      return `The wild ${attackerName} used ${skillName} on your ${defenderName} and`;
    }
    return `${battle.source.label}'s ${attackerName} used ${skillName} on your ${defenderName} and`;
  }

  private startBattleNarration(battle: BattleRuntimeState, events: BattleNarrationEvent[]): void {
    if (events.length === 0) {
      battle.logLine = 'Choose your move.';
      return;
    }
    battle.narrationQueue = [...events];
    battle.activeNarration = null;
    battle.activeAnimation = null;
    this.advanceBattleNarration(battle);
  }

  private advanceBattleNarration(battle: BattleRuntimeState): void {
    const next = battle.narrationQueue.shift();
    if (!next) {
      battle.activeNarration = null;
      battle.activeAnimation = null;
      if (battle.result === 'ongoing' && battle.phase === 'player-turn') {
        battle.logLine = 'Choose your move.';
      }
      return;
    }

    battle.activeNarration = next;
    battle.logLine = next.message;

    if (
      next.applyDamageDefender !== undefined &&
      next.applyDamageAmount !== undefined &&
      next.applyDamageAmount > 0
    ) {
      const team = next.applyDamageDefender === 'player' ? battle.playerTeam : battle.opponentTeam;
      const activeIndex = next.applyDamageDefender === 'player' ? battle.playerActiveIndex : battle.opponentActiveIndex;
      const defender = activeIndex !== null ? team[activeIndex] : null;
      if (defender) {
        defender.currentHp = Math.max(0, defender.currentHp - next.applyDamageAmount);
        defender.fainted = defender.currentHp <= 0;
        if (defender.fainted) {
          const playerAttackerCritterId =
            next.applyDamageDefender === 'opponent' && battle.playerActiveIndex !== null
              ? battle.playerTeam[battle.playerActiveIndex]?.critterId ?? null
              : null;
          battle.pendingKnockoutResolution = {
            defenderTeam: next.applyDamageDefender,
            remainingMs: BATTLE_KNOCKOUT_RESOLUTION_DELAY_MS,
            playerAttackerCritterId,
          };
        }
      }
    }

    if (next.attacker) {
      battle.activeAnimation = {
        attacker: next.attacker,
        remainingMs: 320,
        durationMs: 320,
        token: battle.nextAnimationToken,
      };
      battle.nextAnimationToken += 1;
    } else {
      battle.activeAnimation = null;
    }
  }

  private findNextAliveTeamIndex(team: BattleCritterState[], excludeIndex: number): number {
    for (let index = 0; index < team.length; index += 1) {
      if (index === excludeIndex) {
        continue;
      }
      const entry = team[index];
      if (!entry.fainted && entry.currentHp > 0) {
        return index;
      }
    }
    return -1;
  }

  private findFirstAliveTeamIndex(team: BattleCritterState[]): number {
    for (let index = 0; index < team.length; index += 1) {
      const entry = team[index];
      if (!entry.fainted && entry.currentHp > 0) {
        return index;
      }
    }
    return -1;
  }

  private setBattleResult(battle: BattleRuntimeState, result: BattleResult, message: string): void {
    battle.result = result;
    battle.phase = 'result';
    battle.pendingOpponentSwitchIndex = null;
    battle.pendingOpponentSwitchDelayMs = 0;
    battle.pendingOpponentSwitchAnnouncementShown = false;
    battle.pendingForcedSwap = false;
    battle.pendingKnockoutResolution = null;
    battle.logLine = message;
    const wasGuardBattle = this.pendingGuardDefeat !== null;
    if (this.pendingGuardDefeat) {
      if (result === 'won') {
        const defeatedFlag = this.pendingGuardDefeat.defeatedFlag?.trim() ?? '';
        if (defeatedFlag) {
          this.flags[defeatedFlag] = true;
          this.markProgressDirty();
        }
        const rewards = this.normalizeNpcItemRewards(this.pendingGuardDefeat.rewards);
        if (rewards.length > 0) {
          const rewardSpeaker =
            this.pendingGuardDefeat.guard.postDuelDialogueSpeaker?.trim() ||
            this.pendingGuardDefeat.npc.dialogueSpeaker ||
            this.pendingGuardDefeat.npc.name;
          this.pendingBattleRewardDialogue = {
            speaker: rewardSpeaker,
            lines: this.buildRewardDialogueLines(rewards, {
              intro: `You defeated ${this.pendingGuardDefeat.npc.name}.`,
              fallback: `${this.pendingGuardDefeat.npc.name} gave you a reward.`,
            }),
            rewards,
          };
        }
      }
      this.pendingGuardDefeat = null;
    }
    if (this.pendingNpcInteractBattleDefeat) {
      if (result === 'won') {
        const defeatedFlag = this.pendingNpcInteractBattleDefeat.defeatedFlag.trim();
        if (defeatedFlag) {
          this.flags[defeatedFlag] = true;
          this.markProgressDirty();
        }
        const rewards = this.normalizeNpcItemRewards(this.pendingNpcInteractBattleDefeat.rewards);
        if (rewards.length > 0) {
          this.pendingBattleRewardDialogue = {
            speaker: this.pendingNpcInteractBattleDefeat.npc.dialogueSpeaker ?? this.pendingNpcInteractBattleDefeat.npc.name,
            lines: this.buildRewardDialogueLines(rewards, {
              intro: `You defeated ${this.pendingNpcInteractBattleDefeat.npc.name}.`,
              fallback: `${this.pendingNpcInteractBattleDefeat.npc.name} gave you a reward.`,
            }),
            rewards,
          };
        }
      }
      this.pendingNpcInteractBattleDefeat = null;
    }
    if (battle.source.type === 'npc' && battle.source.npcId === JACOB_NPC_ID && !wasGuardBattle && result === 'won') {
      const jacobNpc = this.getNpcsForMap(battle.source.mapId).find((entry) => entry.id === JACOB_NPC_ID);
      const jacobBattleFlag =
        typeof jacobNpc?.interactBattleDefeatedFlag === 'string' && jacobNpc.interactBattleDefeatedFlag.trim()
          ? jacobNpc.interactBattleDefeatedFlag.trim()
          : FLAG_JACOB_BATTLE_WON;
      this.flags[jacobBattleFlag] = true;
      this.flags[FLAG_JACOB_BATTLE_WON] = true;
      this.markProgressDirty();
      this.handleJacobBattleComplete();
    }
    if (this.syncPlayerBattleHealthToProgress(battle)) {
      this.markProgressDirty();
    }
  }

  private hasAvailableSwapTarget(battle: BattleRuntimeState): boolean {
    return battle.playerTeam.some(
      (entry, index) => index !== battle.playerActiveIndex && !entry.fainted && entry.currentHp > 0,
    );
  }

  private syncPlayerBattleHealthToProgress(battle: BattleRuntimeState): boolean {
    let updated = false;
    for (const battleEntry of battle.playerTeam) {
      const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === battleEntry.critterId);
      if (!progress?.unlocked) {
        continue;
      }
      const maxHp = Math.max(1, battleEntry.maxHp);
      const nextHp = clamp(battleEntry.currentHp, 0, maxHp);
      if (progress.currentHp !== nextHp) {
        progress.currentHp = nextHp;
        updated = true;
      }
    }
    return updated;
  }

  private getActiveBattleCritter(
    battle: BattleRuntimeState,
    team: 'player' | 'opponent',
  ): BattleCritterState | null {
    const index = team === 'player' ? battle.playerActiveIndex : battle.opponentActiveIndex;
    if (index === null) {
      return null;
    }
    return team === 'player' ? battle.playerTeam[index] ?? null : battle.opponentTeam[index] ?? null;
  }

  private getPlayerActiveSkillSlots(battle: BattleRuntimeState): RuntimeBattleSnapshot['playerActiveSkillSlots'] {
    const player = this.getActiveBattleCritter(battle, 'player');
    const slots: RuntimeBattleSnapshot['playerActiveSkillSlots'] = [null, null, null, null];
    if (!player?.equippedSkillIds) {
      return slots;
    }
    for (let i = 0; i < 4; i += 1) {
      const skillId = player.equippedSkillIds[i];
      if (!skillId) continue;
      const skill = this.skillLookupById[skillId];
      if (!skill) continue;
      const effectDescriptions = (skill.effectIds ?? [])
        .map((id) => {
          const effect = this.skillEffectLookupById[id];
          if (!effect?.description) return null;
          const buffLabel = Math.round((effect.buffPercent ?? 0) * 100);
          return effect.description.replace(/<buff>/g, String(buffLabel));
        })
        .filter(Boolean)
        .join(' ');
      const effectIconUrls = (skill.effectIds ?? [])
        .map((id) => this.skillEffectLookupById[id]?.iconUrl)
        .filter((url): url is string => typeof url === 'string' && url.length > 0);
      slots[i] = {
        skillId: skill.skill_id,
        name: skill.skill_name,
        element: skill.element,
        type: skill.type,
        ...(skill.type === 'damage' && skill.damage != null && { damage: skill.damage }),
        ...(skill.type === 'support' && skill.healPercent != null && { healPercent: skill.healPercent }),
        ...(effectDescriptions && { effectDescriptions }),
        ...(effectIconUrls.length > 0 && { effectIconUrls }),
      };
    }
    return slots;
  }

  private mapBattleTeamEntryToSnapshot(entry: BattleCritterState): RuntimeBattleSnapshot['playerTeam'][number] {
    const activeEffectIds = [...(entry.equipmentEffectIds ?? []), ...(entry.activeEffectIds ?? [])]
      .filter((id, index, values) => values.indexOf(id) === index);
    const activeEffectIconUrls: string[] = [];
    const activeEffectDescriptions: string[] = [];
    for (const id of activeEffectIds) {
      const skillEffect = this.skillEffectLookupById[id];
      if (skillEffect) {
        const url = skillEffect.iconUrl;
        if (typeof url === 'string' && url.length > 0) {
          activeEffectIconUrls.push(url);
          const buffLabel = Math.round((skillEffect.buffPercent ?? 0) * 100);
          activeEffectDescriptions.push(
            skillEffect.description ? skillEffect.description.replace(/<buff>/g, String(buffLabel)) : '',
          );
        }
        continue;
      }
      const equipmentEffect = this.equipmentEffectLookupById[id];
      if (!equipmentEffect) {
        continue;
      }
      const url = equipmentEffect.iconUrl;
      if (typeof url === 'string' && url.length > 0) {
        activeEffectIconUrls.push(url);
      }
      activeEffectDescriptions.push(this.summarizeEquipmentEffect(equipmentEffect));
    }
    while (activeEffectDescriptions.length < activeEffectIconUrls.length) {
      activeEffectDescriptions.push('');
    }
    if (activeEffectDescriptions.length > activeEffectIconUrls.length) {
      activeEffectDescriptions.length = activeEffectIconUrls.length;
    }
    return {
      slotIndex: entry.slotIndex,
      critterId: entry.critterId,
      name: entry.name,
      element: entry.element,
      spriteUrl: entry.spriteUrl,
      level: entry.level,
      maxHp: entry.maxHp,
      currentHp: entry.currentHp,
      attack: entry.attack,
      defense: entry.defense,
      speed: entry.speed,
      fainted: entry.fainted,
      activeEffectIds,
      activeEffectIconUrls,
      activeEffectDescriptions,
    };
  }

  private getBattleSnapshot(): RuntimeBattleSnapshot | null {
    const battle = this.activeBattle;
    if (!battle) {
      return null;
    }

    const narrationActive = Boolean(battle.activeNarration);
    const knockoutResolutionPending = battle.pendingKnockoutResolution !== null;
    const canUseActions =
      battle.phase === 'player-turn' &&
      battle.result === 'ongoing' &&
      !narrationActive &&
      !knockoutResolutionPending &&
      battle.pendingOpponentSwitchIndex === null;
    return {
      id: battle.id,
      phase: battle.phase,
      result: battle.result,
      source: {
        ...battle.source,
      },
      transition:
        battle.phase === 'transition'
          ? {
              effect: battle.transitionEffect,
              remainingMs: battle.transitionRemainingMs,
              totalMs: battle.transitionDurationMs,
            }
          : null,
      turnNumber: battle.turnNumber,
      logLine: battle.logLine,
      playerActiveIndex: battle.playerActiveIndex,
      opponentActiveIndex: battle.opponentActiveIndex,
      playerTeam: battle.playerTeam.map((entry) => this.mapBattleTeamEntryToSnapshot(entry)),
      opponentTeam: battle.opponentTeam.map((entry) => this.mapBattleTeamEntryToSnapshot(entry)),
      canAttack: canUseActions,
      canGuard: canUseActions,
      canSwap: canUseActions && this.hasAvailableSwapTarget(battle),
      canRetreat: canUseActions && battle.source.type === 'wild',
      canCancelSwap: battle.phase === 'choose-swap' && !battle.pendingForcedSwap && !narrationActive,
      canAdvanceNarration: narrationActive && !knockoutResolutionPending,
      playerActiveSkillSlots: this.getPlayerActiveSkillSlots(battle),
      activeAnimation: battle.activeAnimation
        ? {
            attacker: battle.activeAnimation.attacker,
            token: battle.activeAnimation.token,
          }
        : null,
      requiresStarterSelection: battle.phase === 'choose-starter',
      requiresSwapSelection: battle.phase === 'choose-swap',
    };
  }

  private getFishingSnapshot(): RuntimeSnapshot['fishing'] {
    const session = this.fishingSession;
    if (!session) {
      return {
        isCasting: false,
        biteReady: false,
        targetTile: null,
        remainingMs: null,
        power: null,
      };
    }
    const remainingMs = session.hasPendingBite
      ? session.biteWindowRemainingMs
      : session.waitRemainingMs;
    return {
      isCasting: true,
      biteReady: session.hasPendingBite,
      targetTile: { ...session.targetTile },
      remainingMs: Math.max(0, Math.floor(remainingMs)),
      power: session.power,
    };
  }

  private findInteractWarpAtPlayer(): { warp: WarpDefinition; source: Vector2 } | null {
    const map = this.getCurrentMap();
    const facingTile = this.getFacingTile();
    for (const warp of map.warps) {
      if (!warp.requireInteract) {
        continue;
      }
      if (warp.requiredFacing && warp.requiredFacing !== this.facing) {
        continue;
      }
      if (this.findWarpFromIndexAt(warp, this.playerPosition) >= 0) {
        return { warp, source: this.playerPosition };
      }
      if (this.findWarpFromIndexAt(warp, facingTile) >= 0) {
        return { warp, source: facingTile };
      }
    }

    return null;
  }

  private triggerWarp(warp: WarpDefinition, sourcePosition: Vector2): void {
    if (this.warpCooldownMs > 0) {
      return;
    }

    const destination = this.resolveWarpDestination(warp, sourcePosition);
    this.currentMapId = warp.toMapId;
    this.playerPosition = { ...destination };
    this.facing = warp.toFacing ?? this.facing;
    this.moveStep = null;
    this.ensureNpcRuntimeState();
    this.preloadMapVisualAssets(this.currentMapId);
    this.preloadNeighborMapVisualAssets(this.currentMapId);
    this.warpCooldownMs = WARP_COOLDOWN_MS;
    this.warpHintLabel = null;
    this.showMessage(this.getCurrentMap().name);
    this.markDirty();
  }

  private getFacingTile(): Vector2 {
    const delta = DIRECTION_DELTAS[this.facing];
    return {
      x: this.playerPosition.x + delta.x,
      y: this.playerPosition.y + delta.y,
    };
  }

  private getWarpFromPositions(warp: WarpDefinition): Vector2[] {
    if (Array.isArray(warp.fromPositions) && warp.fromPositions.length > 0) {
      return warp.fromPositions.map((position) => ({ ...position }));
    }
    return [{ ...warp.from }];
  }

  private getWarpToPositions(warp: WarpDefinition): Vector2[] {
    if (Array.isArray(warp.toPositions) && warp.toPositions.length > 0) {
      return warp.toPositions.map((position) => ({ ...position }));
    }
    return [{ ...warp.to }];
  }

  private findWarpFromIndexAt(warp: WarpDefinition, position: Vector2): number {
    const fromPositions = this.getWarpFromPositions(warp);
    return fromPositions.findIndex((from) => from.x === position.x && from.y === position.y);
  }

  private resolveWarpDestination(warp: WarpDefinition, sourcePosition: Vector2): Vector2 {
    const destinations = this.getWarpToPositions(warp);
    if (destinations.length === 0) {
      return { ...warp.to };
    }

    const sourceIndex = this.findWarpFromIndexAt(warp, sourcePosition);
    if (sourceIndex < 0 || destinations.length === 1) {
      return { ...destinations[0] };
    }

    if (sourceIndex < destinations.length) {
      return { ...destinations[sourceIndex] };
    }

    return { ...destinations[destinations.length - 1] };
  }

  private findInteractionAt(x: number, y: number): InteractionDefinition | null {
    const map = this.getCurrentMap();

    for (const interaction of map.interactions) {
      if (interaction.position.x !== x || interaction.position.y !== y) {
        continue;
      }

      if (!this.isInteractionVisible(interaction)) {
        continue;
      }

      return interaction;
    }

    return null;
  }

  private updateWarpHint(): void {
    if (this.dialogue || this.healPrompt || this.shopPrompt) {
      this.warpHintLabel = null;
      return;
    }

    const map = this.getCurrentMap();
    const facingTile = this.getFacingTile();
    let best: { label: string; distance: number } | null = null;

    for (const warp of map.warps) {
      const label = typeof warp.label === 'string' ? warp.label.trim() : '';
      if (!label) {
        continue;
      }

      const fromPositions = this.getWarpFromPositions(warp);
      let minDistance = Number.POSITIVE_INFINITY;
      for (const from of fromPositions) {
        const playerDistance = Math.abs(from.x - this.playerPosition.x) + Math.abs(from.y - this.playerPosition.y);
        minDistance = Math.min(minDistance, playerDistance);
        if (warp.requireInteract) {
          const facingDistance = Math.abs(from.x - facingTile.x) + Math.abs(from.y - facingTile.y);
          minDistance = Math.min(minDistance, facingDistance);
        }
      }

      if (minDistance > 1) {
        continue;
      }

      if (!best || minDistance < best.distance) {
        best = { label, distance: minDistance };
      }
    }

    this.warpHintLabel = best?.label ?? null;
  }

  private isPlayerControlLocked(): boolean {
    this.preloadMapVisualAssets(this.currentMapId);
    return Boolean(
      this.dialogue ||
      this.healPrompt ||
      this.shopPrompt ||
      this.activeCutscene ||
      this.starterSelection ||
      this.activeScriptedScene ||
      !this.areMapVisualAssetsReady(this.currentMapId),
    );
  }

  private getHealPromptSnapshot(): RuntimeSnapshot['story']['healPrompt'] {
    if (!this.healPrompt) {
      return null;
    }
    return {
      speaker: this.healPrompt.speaker,
      text: this.healPrompt.text,
    };
  }

  private getShopPromptSnapshot(): RuntimeSnapshot['story']['shopPrompt'] {
    if (!this.shopPrompt) {
      return null;
    }
    const shop = this.shopById[this.shopPrompt.shopId];
    if (!shop) {
      return null;
    }
    const entries = shop.entries
      .map((entry) => {
        if (entry.kind === 'item') {
          const item = this.itemById[entry.itemId];
          if (!item || !item.isActive) {
            return null;
          }
          const affordability = this.getShopEntryAffordability(entry);
          return {
            entryId: entry.id,
            kind: 'item' as const,
            name: item.name,
            quantity: entry.quantity,
            imageUrl: item.imageUrl,
            repeatable: entry.repeatable !== false,
            oneTimePurchased: this.isShopEntryOneTimePurchased(shop.id, entry),
            affordable: affordability.canAfford,
            disableReason: affordability.reason,
            costs: entry.costs.map((cost) => ({
              itemId: cost.itemId,
              itemName: this.itemById[cost.itemId]?.name ?? cost.itemId,
              itemImageUrl: this.itemById[cost.itemId]?.imageUrl ?? '',
              requiredQuantity: cost.quantity,
              ownedQuantity: getItemInventoryQuantity(this.playerItemInventory, cost.itemId),
            })),
          };
        }

        const critter = this.critterLookup[entry.critterId];
        const affordability = this.getShopEntryAffordability(entry);
        return {
          entryId: entry.id,
          kind: 'critter' as const,
          name: critter?.name ?? `Critter #${entry.critterId}`,
          quantity: 1,
          imageUrl: critter?.spriteUrl ?? '',
          repeatable: false,
          oneTimePurchased: this.isShopEntryOneTimePurchased(shop.id, entry),
          affordable: affordability.canAfford,
          disableReason: affordability.reason,
          costs: entry.costs.map((cost) => ({
            itemId: cost.itemId,
            itemName: this.itemById[cost.itemId]?.name ?? cost.itemId,
            itemImageUrl: this.itemById[cost.itemId]?.imageUrl ?? '',
            requiredQuantity: cost.quantity,
            ownedQuantity: getItemInventoryQuantity(this.playerItemInventory, cost.itemId),
          })),
        };
      })
      .filter((entry): entry is NonNullable<RuntimeSnapshot['story']['shopPrompt']>['entries'][number] => Boolean(entry));

    return {
      npcName: this.shopPrompt.npcName,
      title: this.shopPrompt.title,
      shopId: this.shopPrompt.shopId,
      entries,
    };
  }

  private getShopPurchaseFlagKey(shopId: string, entryId: string): string {
    return `shop-purchase:${shopId}:${entryId}`;
  }

  private isShopEntryOneTime(entry: ShopEntryDefinition): boolean {
    return entry.kind === 'critter' || entry.repeatable === false;
  }

  private isShopEntryOneTimePurchased(shopId: string, entry: ShopEntryDefinition): boolean {
    if (!this.isShopEntryOneTime(entry)) {
      return false;
    }
    return Boolean(this.flags[this.getShopPurchaseFlagKey(shopId, entry.id)]);
  }

  private getShopEntryAffordability(entry: ShopEntryDefinition): { canAfford: boolean; reason: string | null } {
    if (!this.shopPrompt) {
      return { canAfford: false, reason: 'Shop is not open.' };
    }
    if (this.isShopEntryOneTimePurchased(this.shopPrompt.shopId, entry)) {
      return { canAfford: false, reason: 'Already purchased.' };
    }
    for (const cost of entry.costs) {
      const owned = getItemInventoryQuantity(this.playerItemInventory, cost.itemId);
      if (owned < cost.quantity) {
        const itemName = this.itemById[cost.itemId]?.name ?? cost.itemId;
        return { canAfford: false, reason: `Need more ${itemName}.` };
      }
    }
    if (entry.kind === 'item') {
      const item = this.itemById[entry.itemId];
      if (!item || !item.isActive) {
        return { canAfford: false, reason: 'Item is unavailable.' };
      }
      const owned = getItemInventoryQuantity(this.playerItemInventory, item.id);
      const matchingCost = entry.costs.reduce((total, cost) => {
        if (cost.itemId !== item.id) {
          return total;
        }
        return total + cost.quantity;
      }, 0);
      const postCostOwned = Math.max(0, owned - matchingCost);
      if (postCostOwned + entry.quantity > item.maxStack) {
        return { canAfford: false, reason: `${item.name} stack is full.` };
      }
    }
    return { canAfford: true, reason: null };
  }

  private getStarterSelectionSnapshot(): RuntimeSnapshot['story']['starterSelection'] {
    if (!this.starterSelection) {
      return null;
    }
    const options = this.starterSelection.optionCritterIds
      .map((critterId) => this.critterLookup[critterId])
      .filter((entry): entry is CritterDefinition => Boolean(entry))
      .map((entry) => ({
        critterId: entry.id,
        name: entry.name,
        element: entry.element,
        rarity: entry.rarity,
        spriteUrl: entry.spriteUrl,
        description: entry.description,
      }));
    return {
      confirmCritterId: this.starterSelection.confirmCritterId,
      options,
    };
  }

  private updateStoryState(_deltaMs: number): void {
    this.updateActiveScriptedScene(_deltaMs);
    if (!this.activeBattle) {
      this.tryStartJacobCutscene();
      this.updateJacobCutsceneMovement();
    }
  }

  private startScriptedScene(npc: NpcDefinition, steps: NpcInteractionActionDefinition[]): void {
    if (steps.length === 0 || this.activeScriptedScene) {
      return;
    }
    this.activeScriptedScene = {
      npcStateKey: this.getNpcStateKey(npc),
      npcId: npc.id,
      steps: steps.map((step) => ({ ...step })),
      stepIndex: 0,
      stepStarted: false,
      waitRemainingMs: 0,
      path: null,
    };
    this.heldDirections = [];
    this.moveStep = null;
  }

  private updateActiveScriptedScene(deltaMs: number): void {
    const scene = this.activeScriptedScene;
    if (!scene) {
      return;
    }
    const npc = this.getNpcsForMap(this.currentMapId).find((entry) => this.getNpcStateKey(entry) === scene.npcStateKey);
    if (!npc) {
      this.activeScriptedScene = null;
      return;
    }
    const npcState = this.getNpcRuntimeState(npc);
    if (scene.path && scene.path.length > 0) {
      this.advanceCutsceneNpcPath(npc, npcState, scene.path);
      if (scene.path.length === 0 && !npcState.moveStep) {
        scene.path = null;
        scene.stepIndex += 1;
        scene.stepStarted = false;
      }
      return;
    }
    const step = scene.steps[scene.stepIndex];
    if (!step) {
      this.activeScriptedScene = null;
      return;
    }

    if (step.type === 'dialogue') {
      if (!scene.stepStarted) {
        const lines = Array.isArray(step.lines) ? step.lines.filter((line) => typeof line === 'string' && line.trim().length > 0) : [];
        if (lines.length > 0) {
          this.startDialogue(step.speaker ?? npc.name, lines, step.setFlag);
        }
        scene.stepStarted = true;
        return;
      }
      if (this.dialogue) {
        return;
      }
      scene.stepIndex += 1;
      scene.stepStarted = false;
      return;
    }

    if (step.type === 'give_item') {
      const rawItemId = typeof step.itemId === 'string' ? step.itemId.trim() : '';
      const quantity =
        typeof step.quantity === 'number' && Number.isFinite(step.quantity)
          ? Math.max(0, Math.floor(step.quantity))
          : 0;
      const rewards =
        rawItemId && quantity > 0
          ? this.normalizeNpcItemRewards([{ itemId: rawItemId, quantity }])
          : [];
      if (!scene.stepStarted) {
        const customMessage = typeof step.message === 'string' ? step.message.trim() : '';
        const lines = customMessage
          ? [customMessage]
          : this.buildRewardDialogueLines(rewards, {
              intro: `${npc.name} gave you an item.`,
              fallback: `${npc.name} gave you an item.`,
            });
        if (lines.length > 0) {
          this.startDialogue(
            npc.dialogueSpeaker ?? npc.name,
            lines,
            typeof step.setFlag === 'string' && step.setFlag.trim() ? step.setFlag.trim() : undefined,
            undefined,
            rewards,
          );
        }
        scene.stepStarted = true;
        return;
      }
      if (this.dialogue) {
        return;
      }
      scene.stepIndex += 1;
      scene.stepStarted = false;
      return;
    }

    if (step.type === 'set_flag') {
      const flag = step.flag.trim();
      if (flag.length > 0) {
        this.flags[flag] = true;
        this.markProgressDirty();
      }
      scene.stepIndex += 1;
      scene.stepStarted = false;
      return;
    }

    if (step.type === 'face_player') {
      npcState.facing = oppositeDirection(this.facing);
      scene.stepIndex += 1;
      scene.stepStarted = false;
      return;
    }

    if (step.type === 'wait') {
      if (!scene.stepStarted) {
        scene.waitRemainingMs = clamp(Math.floor(step.durationMs), 0, 60000);
        scene.stepStarted = true;
      }
      scene.waitRemainingMs = Math.max(0, scene.waitRemainingMs - deltaMs);
      if (scene.waitRemainingMs <= 0) {
        scene.stepIndex += 1;
        scene.stepStarted = false;
      }
      return;
    }

    if (step.type === 'move_to_player') {
      const target = this.pickAdjacentStoryTarget(this.playerPosition, npc, npcState.position);
      scene.path = this.buildNpcPath(npc, npcState.position, target);
      if (!scene.path || scene.path.length === 0) {
        scene.path = null;
        scene.stepIndex += 1;
      }
      scene.stepStarted = false;
      return;
    }

    if (step.type === 'move_path') {
      const directions = Array.isArray(step.directions) ? step.directions.filter((entry) => isDirection(entry)) : [];
      const path = this.buildNpcPathFromDirections(npc, npcState.position, directions);
      scene.path = path;
      if (scene.path.length === 0) {
        scene.path = null;
        scene.stepIndex += 1;
      }
      scene.stepStarted = false;
      return;
    }

    scene.stepIndex += 1;
    scene.stepStarted = false;
  }

  private buildNpcPathFromDirections(npc: NpcDefinition, from: Vector2, directions: Direction[]): Vector2[] {
    if (directions.length === 0) {
      return [];
    }
    const path: Vector2[] = [];
    let cursor = { ...from };
    for (const direction of directions) {
      const delta = DIRECTION_DELTAS[direction];
      const next = {
        x: cursor.x + delta.x,
        y: cursor.y + delta.y,
      };
      if (!this.canNpcStepTo(npc, cursor, next, direction)) {
        break;
      }
      path.push(next);
      cursor = next;
    }
    return path;
  }

  private openStarterSelection(): void {
    if (this.starterSelection) {
      return;
    }
    const table = this.encounterTableLookup[STARTER_ENCOUNTER_TABLE_ID];
    if (!table || table.entries.length === 0) {
      this.startDialogue('Uncle Hank', ['Hmm... I need to restock my starter critters.']);
      return;
    }
    const optionCritterIds = [...new Set(table.entries.filter(isCritterEncounterEntry).map((entry) => entry.critterId))]
      .filter((critterId) => Boolean(this.critterLookup[critterId]))
      .slice(0, 3);
    if (optionCritterIds.length === 0) {
      this.startDialogue('Uncle Hank', ['Hmm... I need to restock my starter critters.']);
      return;
    }
    this.starterSelection = {
      confirmCritterId: null,
      optionCritterIds,
    };
    this.heldDirections = [];
    this.moveStep = null;
  }

  private tryStartJacobCutscene(): void {
    if (this.flags[FLAG_DEMO_DONE] || !this.flags[FLAG_STARTER_SELECTION_DONE]) {
      return;
    }
    if (this.currentMapId !== 'uncle-s-house') {
      return;
    }
    if (this.activeCutscene || this.activeBattle || this.dialogue) {
      return;
    }

    const jacobNpc = this.getNpcsForMap(this.currentMapId).find((entry) => entry.id === JACOB_NPC_ID);
    if (!jacobNpc) {
      return;
    }
    const jacobState = this.getNpcRuntimeState(jacobNpc);
    jacobState.position = { ...jacobNpc.position };
    jacobState.moveStep = null;
    jacobState.facing = 'up';

    const target = this.pickAdjacentStoryTarget(this.playerPosition, jacobNpc, jacobState.position);
    const path = this.buildNpcPath(jacobNpc, jacobState.position, target);
    this.activeCutscene = {
      id: 'jacob-duel-intro',
      phase: 'entering',
      path,
    };
    this.heldDirections = [];
    this.moveStep = null;
  }

  private updateJacobCutsceneMovement(): void {
    if (!this.activeCutscene || this.activeCutscene.id !== 'jacob-duel-intro') {
      return;
    }
    const jacobNpc = this.getNpcsForMap(this.currentMapId).find((entry) => entry.id === JACOB_NPC_ID);
    if (!jacobNpc) {
      return;
    }

    const jacobState = this.getNpcRuntimeState(jacobNpc);
    if (this.activeCutscene.phase === 'entering') {
      const complete = this.advanceCutsceneNpcPath(jacobNpc, jacobState, this.activeCutscene.path);
      if (!complete) {
        return;
      }
      this.activeCutscene.phase = 'awaiting-battle';
      this.pendingStoryAction = 'start-jacob-battle';
      this.startDialogue('Jacob', [
        '<player-name>! You\'ve got a Critter?!',
        "Can we duel? I'm itchin' to see which Critter you chose.",
      ]);
      return;
    }

    if (this.activeCutscene.phase === 'exiting') {
      const complete = this.advanceCutsceneNpcPath(jacobNpc, jacobState, this.activeCutscene.path);
      if (!complete) {
        return;
      }
      this.flags[FLAG_JACOB_LEFT_HOUSE] = true;
      this.flags[FLAG_DEMO_DONE] = true;
      this.activeCutscene = null;
      this.markProgressDirty();
    }
  }

  private advanceCutsceneNpcPath(
    npc: NpcDefinition,
    state: NpcRuntimeState,
    path: Vector2[],
  ): boolean {
    if (state.moveStep) {
      return false;
    }
    if (path.length === 0) {
      return true;
    }
    const nextWaypoint = path[0];
    const nextStep = this.nextStepToward(state.position, nextWaypoint);
    if (!nextStep) {
      path.shift();
      return path.length === 0;
    }
    const deltaX = nextStep.x - state.position.x;
    const deltaY = nextStep.y - state.position.y;
    const direction = toDirectionFromDelta(deltaX, deltaY);
    if (!direction) {
      path.shift();
      return path.length === 0;
    }
    state.facing = direction;
    if (!this.canNpcStepTo(npc, state.position, nextStep, direction)) {
      path.shift();
      return path.length === 0;
    }
    state.moveStep = {
      from: { ...state.position },
      to: { ...nextStep },
      elapsed: 0,
      duration: MOVE_DURATION_MS,
    };
    if (nextStep.x === nextWaypoint.x && nextStep.y === nextWaypoint.y) {
      path.shift();
    }
    return path.length === 0;
  }

  private startJacobBattle(): void {
    const playerTeam = this.buildPlayerBattleTeam();
    if (!this.hasBattleReadyCritter(playerTeam)) {
      this.activeCutscene = null;
      this.handleEmptyPlayerBattleTeam();
      return;
    }

    const jacobNpc = this.getNpcsForMap(this.currentMapId).find((entry) => entry.id === JACOB_NPC_ID);
    const opponentTeam = this.buildNpcBattleTeam(jacobNpc?.battleTeamIds ?? []);
    if (opponentTeam.length === 0) {
      this.activeCutscene = null;
      return;
    }
    this.startBattle(
      {
        type: 'npc',
        mapId: this.currentMapId,
        label: jacobNpc?.name ?? 'Jacob',
        npcId: JACOB_NPC_ID,
      },
      playerTeam,
      opponentTeam,
      `${jacobNpc?.name ?? 'Jacob'} challenged you to a duel!`,
    );
  }

  private handleJacobBattleComplete(): void {
    if (this.flags[FLAG_DEMO_DONE]) {
      return;
    }
    if (this.activeCutscene?.id === 'jacob-duel-intro') {
      this.activeCutscene.phase = 'post-battle-dialogue';
    }
    const jacobNpc = this.getNpcsForMap(this.currentMapId).find((entry) => entry.id === JACOB_NPC_ID);
    let rewards = this.normalizeNpcItemRewards(jacobNpc?.battleRewards);
    if (rewards.length === 0 && this.itemById.lume?.isActive) {
      rewards = this.normalizeNpcItemRewards([{ itemId: 'lume', quantity: 25 }]);
    }
    const rewardLines = rewards.length > 0
      ? this.buildRewardDialogueLines(rewards, {
          intro: 'That duel was fun! Thanks <player-name>!',
          fallback: 'That duel was fun! Thanks <player-name>!',
        })
      : ['That duel was fun! Thanks <player-name>!'];
    this.pendingStoryAction = 'start-jacob-exit';
    this.startDialogue('Jacob', rewardLines, undefined, undefined, rewards.length > 0 ? rewards : undefined);
  }

  private startJacobExitCutscene(): void {
    const jacobNpc = this.getNpcsForMap(this.currentMapId).find((entry) => entry.id === JACOB_NPC_ID);
    const uncleNpc = this.getNpcsForMap(this.currentMapId).find((entry) => entry.id === UNCLE_HANK_NPC_ID);
    const uncleSpeaker = uncleNpc?.dialogueSpeaker ?? uncleNpc?.name ?? 'Uncle Hank';
    const uncleLines =
      uncleNpc?.dialogueLines && uncleNpc.dialogueLines.length > 0
        ? uncleNpc.dialogueLines
        : ['What a nice duel! Have fun now <player-name>.'];
    const uncleSetFlag = uncleNpc?.dialogueSetFlag;
    if (!jacobNpc) {
      this.flags[FLAG_JACOB_LEFT_HOUSE] = true;
      this.flags[FLAG_DEMO_DONE] = true;
      this.activeCutscene = null;
      this.pendingStoryAction = null;
      this.markProgressDirty();
      this.startDialogue(uncleSpeaker, uncleLines, uncleSetFlag);
      return;
    }
    const jacobState = this.getNpcRuntimeState(jacobNpc);
    const exitTarget = { x: 6, y: 12 };
    const path = this.buildNpcPath(jacobNpc, jacobState.position, exitTarget);
    this.activeCutscene = {
      id: 'jacob-duel-intro',
      phase: 'exiting',
      path,
    };
    this.pendingStoryAction = null;
    this.startDialogue(uncleSpeaker, uncleLines, uncleSetFlag);
  }

  private pickAdjacentStoryTarget(target: Vector2, npc: NpcDefinition, fallbackFrom: Vector2): Vector2 {
    const candidates = [
      { x: target.x, y: target.y + 1 },
      { x: target.x + 1, y: target.y },
      { x: target.x - 1, y: target.y },
      { x: target.x, y: target.y - 1 },
    ];
    const map = this.getCurrentMap();
    for (const candidate of candidates) {
      if (!isInsideMap(map, candidate.x, candidate.y)) {
        continue;
      }
      const code = tileAt(map, candidate.x, candidate.y);
      if (!code || code === BLANK_TILE_CODE || !this.getTileDefinition(code).walkable) {
        continue;
      }
      if (this.isNpcOccupyingTile(candidate.x, candidate.y)) {
        continue;
      }
      const path = this.buildNpcPath(npc, fallbackFrom, candidate);
      if (path.length > 0 || (candidate.x === fallbackFrom.x && candidate.y === fallbackFrom.y)) {
        return candidate;
      }
    }
    return { ...fallbackFrom };
  }

  private buildNpcPath(npc: NpcDefinition, from: Vector2, to: Vector2): Vector2[] {
    if (from.x === to.x && from.y === to.y) {
      return [];
    }

    const map = this.getCurrentMap();
    const toKey = `${to.x},${to.y}`;
    const startKey = `${from.x},${from.y}`;
    const queue: Vector2[] = [{ ...from }];
    const visited = new Set<string>([startKey]);
    const cameFrom = new Map<string, string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      const currentKey = `${current.x},${current.y}`;
      if (currentKey === toKey) {
        break;
      }

      for (const direction of ['up', 'right', 'down', 'left'] as const) {
        const delta = DIRECTION_DELTAS[direction];
        const next = {
          x: current.x + delta.x,
          y: current.y + delta.y,
        };
        const nextKey = `${next.x},${next.y}`;
        if (visited.has(nextKey)) {
          continue;
        }
        if (!isInsideMap(map, next.x, next.y)) {
          continue;
        }
        if (!this.canNpcStepTo(npc, current, next, direction)) {
          continue;
        }
        visited.add(nextKey);
        cameFrom.set(nextKey, currentKey);
        queue.push(next);
      }
    }

    if (!visited.has(toKey)) {
      return [];
    }

    const path: Vector2[] = [];
    let cursorKey = toKey;
    while (cursorKey !== startKey) {
      const [xText, yText] = cursorKey.split(',');
      const x = Number.parseInt(xText, 10);
      const y = Number.parseInt(yText, 10);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return [];
      }
      path.push({ x, y });
      const previousKey = cameFrom.get(cursorKey);
      if (!previousKey) {
        return [];
      }
      cursorKey = previousKey;
    }

    path.reverse();
    return path;
  }

  private nextStepToward(from: Vector2, to: Vector2): Vector2 | null {
    if (from.x === to.x && from.y === to.y) {
      return null;
    }
    if (from.x !== to.x) {
      return {
        x: from.x + (to.x > from.x ? 1 : -1),
        y: from.y,
      };
    }
    return {
      x: from.x,
      y: from.y + (to.y > from.y ? 1 : -1),
    };
  }

  private formatStoryText(input: string): string {
    const starterName =
      (this.selectedStarterId && this.critterLookup[Number.parseInt(this.selectedStarterId, 10)]?.name) ||
      'your starter critter';
    return input
      .replace(/<username>/gi, this.playerName)
      .replace(/<player-name>/gi, this.playerName)
      .replace(/<player-starter-critter-name>/gi, starterName);
  }

  private buildNpcBattleTeam(teamIds: string[]): BattleCritterState[] {
    const parsedTeam = teamIds
      .map((entry) => this.parseNpcBattleTeamEntry(entry))
      .filter((entry): entry is { critter: CritterDefinition; level: number | null } => Boolean(entry))
      .map((entry) => this.buildWildBattleCritter(entry.critter, entry.level));
    if (parsedTeam.length > 0) {
      return parsedTeam;
    }

    const moolnir =
      this.critterDatabase.find((entry) => entry.name.trim().toLowerCase() === 'moolnir') ??
      this.critterDatabase[0];
    if (!moolnir) {
      return [];
    }
    return [this.buildWildBattleCritter(moolnir, 1)];
  }

  private parseNpcBattleTeamEntry(token: string): { critter: CritterDefinition; level: number | null } | null {
    if (typeof token !== 'string' || !token.trim()) {
      return null;
    }
    const trimmed = token.trim();
    const [rawCritterToken, rawLevelToken] = trimmed.split(/[@:]/, 2);
    const critterToken = rawCritterToken.trim().toLowerCase();
    if (!critterToken) {
      return null;
    }

    const maybeNumericId = Number.parseInt(critterToken.replace(/^#/, ''), 10);
    const critter =
      (Number.isFinite(maybeNumericId) ? this.critterLookup[maybeNumericId] : undefined) ??
      this.critterDatabase.find((entry) => entry.name.trim().toLowerCase() === critterToken) ??
      this.critterDatabase.find((entry) => slugify(entry.name) === critterToken);
    if (!critter) {
      return null;
    }

    const level = rawLevelToken ? Number.parseInt(rawLevelToken, 10) : null;
    return {
      critter,
      level: Number.isFinite(level) && level !== null ? Math.max(1, level) : null,
    };
  }

  private tickAutosave(deltaMs: number): void {
    if (!this.dirty) {
      this.autosaveMs = AUTOSAVE_INTERVAL_MS;
      return;
    }

    this.autosaveMs -= deltaMs;
    if (this.autosaveMs <= 0) {
      this.persistNow();
      this.autosaveMs = AUTOSAVE_INTERVAL_MS;
    }
  }

  private getLockedKnockoutTargetContext(
    critterId: number,
  ): {
    critter: CritterDefinition;
    progress: PlayerCritterProgress['collection'][number];
    levelRow: CritterDefinition['levels'][number];
    knockoutMissions: CritterLevelMissionRequirement[];
  } | null {
    const critter = this.critterLookup[critterId];
    const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === critterId);
    if (!critter || !progress || progress.unlocked) {
      return null;
    }
    const currentLevel = Math.max(0, progress.level);
    const targetLevel = currentLevel + 1;
    const levelRow = critter.levels.find((entry) => entry.level === targetLevel);
    if (!levelRow) {
      return null;
    }
    if (this.hasPendingStoryFlagMission(levelRow.missions, levelRow.level, progress.missionProgress)) {
      return null;
    }
    const knockoutMissions = levelRow.missions.filter(
      (entry): entry is CritterLevelMissionRequirement => isKnockoutMissionType(entry.type),
    );
    if (knockoutMissions.length === 0) {
      return null;
    }
    return {
      critter,
      progress,
      levelRow,
      knockoutMissions,
    };
  }

  private getEligibleLockedKnockoutTargetCritterIds(): number[] {
    const eligible: number[] = [];
    for (const entry of this.playerCritterProgress.collection) {
      if (this.getLockedKnockoutTargetContext(entry.critterId)) {
        eligible.push(entry.critterId);
      }
    }
    return eligible;
  }

  private ensureLockedKnockoutTargetSelectionValid(): boolean {
    const selectedCritterId = this.playerCritterProgress.lockedKnockoutTargetCritterId;
    if (selectedCritterId === null) {
      return false;
    }
    if (this.getLockedKnockoutTargetContext(selectedCritterId)) {
      return false;
    }
    this.playerCritterProgress.lockedKnockoutTargetCritterId = null;
    return true;
  }

  private incrementSimpleCritterMissionProgress(
    critterId: number,
    missionMatcher: (mission: CritterLevelMissionRequirement) => boolean,
  ): boolean {
    const critter = this.critterLookup[critterId];
    const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === critterId);
    if (!critter || !progress?.unlocked) {
      return false;
    }

    const currentLevel = Math.max(1, progress.level);
    const targetLevel = currentLevel + 1;
    const levelRow = critter.levels.find((entry) => entry.level === targetLevel);
    if (!levelRow) {
      return false;
    }
    if (this.hasPendingStoryFlagMission(levelRow.missions, levelRow.level, progress.missionProgress)) {
      return false;
    }

    let updated = false;
    for (const mission of levelRow.missions) {
      if (!missionMatcher(mission)) {
        continue;
      }
      const key = missionProgressKey(levelRow.level, mission.id);
      const currentValue = Math.max(0, progress.missionProgress[key] ?? 0);
      const nextValue = Math.min(mission.targetValue, currentValue + 1);
      if (nextValue <= currentValue) {
        continue;
      }
      progress.missionProgress[key] = nextValue;
      updated = true;
    }

    if (updated) {
      progress.lastProgressAt = new Date().toISOString();
    }
    return updated;
  }

  private recordOpposingKnockoutProgress(opposingCritterId: number, knockoutAttackerCritterId: number | null): void {
    const opposingCritter = this.critterLookup[opposingCritterId];
    if (!opposingCritter) {
      return;
    }
    if (knockoutAttackerCritterId === null) {
      return;
    }

    const nowIso = new Date().toISOString();
    let updatedAny = this.ensureLockedKnockoutTargetSelectionValid();
    const knockoutAttackerProgress = this.playerCritterProgress.collection.find(
      (entry) => entry.critterId === knockoutAttackerCritterId,
    );
    const knockoutAttackerCritter = this.critterLookup[knockoutAttackerCritterId];
    const knockoutAttackerEquipmentAnchors =
      knockoutAttackerProgress && knockoutAttackerCritter
        ? this.resolveEquipmentStateForCritter(knockoutAttackerProgress, knockoutAttackerCritter, false).anchors
        : [];
    // Attacker always gets credit. Optionally also credit one selected locked knockout target.
    const critterIdsToUpdate = new Set<number>([knockoutAttackerCritterId]);
    const selectedLockedTargetCritterId = this.playerCritterProgress.lockedKnockoutTargetCritterId;
    if (selectedLockedTargetCritterId !== null) {
      critterIdsToUpdate.add(selectedLockedTargetCritterId);
    }
    const crittersToUpdate = this.critterDatabase.filter((c) => critterIdsToUpdate.has(c.id));
    for (const critter of crittersToUpdate) {
      const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === critter.id);
      if (!progress) {
        continue;
      }

      const currentLevel = progress.unlocked ? Math.max(1, progress.level) : 0;
      const targetLevel = currentLevel + 1;
      const levelRow = critter.levels.find((entry) => entry.level === targetLevel);
      if (!levelRow) {
        continue;
      }
      const levelLockedByStoryFlag = this.hasPendingStoryFlagMission(
        levelRow.missions,
        levelRow.level,
        progress.missionProgress,
      );

      let updatedCritter = false;
      for (const mission of levelRow.missions) {
        if (!isKnockoutMissionType(mission.type)) {
          continue;
        }
        if (levelLockedByStoryFlag) {
          if (this.syncKnockoutChallengeProgress(critter.id, levelRow.level, mission, 0, nowIso)) {
            updatedCritter = true;
          }
          continue;
        }
        if (!this.matchesOpposingKnockoutMission(mission, opposingCritterId, opposingCritter.element)) {
          continue;
        }
        if (
          mission.type === 'opposing_knockouts_with_item' &&
          !this.matchesKnockoutItemRequirement(mission, knockoutAttackerEquipmentAnchors)
        ) {
          continue;
        }
        const key = missionProgressKey(levelRow.level, mission.id);
        const currentValue = Math.max(0, progress.missionProgress[key] ?? 0);
        const nextValue = Math.min(mission.targetValue, currentValue + 1);
        if (nextValue > currentValue) {
          progress.missionProgress[key] = nextValue;
          updatedCritter = true;
        }
        if (this.syncKnockoutChallengeProgress(critter.id, levelRow.level, mission, nextValue, nowIso)) {
          updatedCritter = true;
        }
      }

      if (updatedCritter) {
        progress.lastProgressAt = nowIso;
        updatedAny = true;
      }
    }

    if (updatedAny) {
      this.markProgressDirty();
    }
  }

  private syncKnockoutChallengeProgress(
    critterId: number,
    level: number,
    mission: CritterLevelMissionRequirement,
    currentValue: number,
    updatedAt: string,
  ): boolean {
    const missionId = `critter-${critterId}-level-${level}-mission-${mission.id}`;
    const target = Math.max(1, mission.targetValue);
    const progressValue = Math.max(0, Math.min(target, currentValue));
    const completed = progressValue >= target;
    const previous = this.sideStoryMissions[missionId];
    if (
      previous &&
      previous.progress === progressValue &&
      previous.target === target &&
      previous.completed === completed
    ) {
      return false;
    }

    this.sideStoryMissions[missionId] = {
      progress: progressValue,
      target,
      completed,
      updatedAt,
    };
    return true;
  }

  private matchesOpposingKnockoutMission(
    mission: CritterLevelMissionRequirement,
    opposingCritterId: number,
    opposingElement: string,
  ): boolean {
    const requiredCritterIds = Array.isArray(mission.knockoutCritterIds) ? mission.knockoutCritterIds : [];
    if (requiredCritterIds.length > 0) {
      return requiredCritterIds.includes(opposingCritterId);
    }

    const requiredElements = Array.isArray(mission.knockoutElements) ? mission.knockoutElements : [];
    if (requiredElements.length > 0) {
      return requiredElements.includes(opposingElement as (typeof requiredElements)[number]);
    }

    return true;
  }

  private getRequiredEquippedItemCount(mission: CritterLevelMissionRequirement): number {
    if (mission.type !== 'opposing_knockouts_with_item') {
      return 0;
    }
    const rawCount = mission.requiredEquippedItemCount;
    if (typeof rawCount !== 'number' || !Number.isFinite(rawCount)) {
      return 1;
    }
    return Math.max(1, Math.min(8, Math.floor(rawCount)));
  }

  private matchesKnockoutItemRequirement(
    mission: CritterLevelMissionRequirement,
    attackerEquipmentAnchors: EquippedEquipmentAnchor[],
  ): boolean {
    if (mission.type !== 'opposing_knockouts_with_item') {
      return true;
    }

    const requiredCount = this.getRequiredEquippedItemCount(mission);
    if (attackerEquipmentAnchors.length < requiredCount) {
      return false;
    }

    const requiredItemIds = Array.isArray(mission.requiredEquippedItemIds) ? mission.requiredEquippedItemIds : [];
    if (requiredItemIds.length === 0) {
      return true;
    }

    return attackerEquipmentAnchors.some((anchor) => requiredItemIds.includes(anchor.itemId));
  }

  private matchesHealCritterMissionItem(
    mission: CritterLevelMissionRequirement,
    healingItemId: string,
  ): boolean {
    if (mission.type !== 'heal_critter') {
      return false;
    }
    const requiredItemIds = Array.isArray(mission.requiredHealingItemIds) ? mission.requiredHealingItemIds : [];
    if (requiredItemIds.length === 0) {
      return true;
    }
    return requiredItemIds.includes(healingItemId);
  }

  private maybeShowCritterAdvanceNotice(): void {
    if (this.transientMessage) {
      return;
    }

    for (const critter of this.critterDatabase) {
      const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === critter.id);
      if (!progress) {
        continue;
      }

      const currentLevel = progress.unlocked ? Math.max(1, progress.level) : 0;
      const targetLevel = currentLevel + 1;
      const noticeKey = `${critter.id}:${targetLevel}`;
      if (this.announcedCritterAdvanceKeys.has(noticeKey)) {
        continue;
      }

      const levelRow = critter.levels.find((entry) => entry.level === targetLevel);
      if (!levelRow) {
        continue;
      }

      const requiredMissionCount = Math.min(levelRow.requiredMissionCount, levelRow.missions.length);
      const completedMissionCount = levelRow.missions.reduce((count, mission) => {
        const currentValue = this.getMissionCurrentValue(
          mission,
          levelRow.level,
          progress.missionProgress,
          levelRow.missions,
        );
        return count + (currentValue >= mission.targetValue ? 1 : 0);
      }, 0);
      if (completedMissionCount < requiredMissionCount) {
        continue;
      }

      this.announcedCritterAdvanceKeys.add(noticeKey);
      this.showMessage(
        currentLevel === 0 ? `${critter.name} can be Unlocked!` : `${critter.name} can Level Up!`,
        5000,
      );
      break;
    }
  }

  private resolveEquippedSkillSlotsForSnapshot(
    equippedSkillIds: EquippedSkillSlots | undefined,
  ): RuntimeSnapshot['critters']['collection'][number]['equippedSkillSlots'] {
    const slots: RuntimeSnapshot['critters']['collection'][number]['equippedSkillSlots'] = [
      null,
      null,
      null,
      null,
    ];
    if (!equippedSkillIds) return slots;
    for (let i = 0; i < 4; i += 1) {
      const skillId = equippedSkillIds[i];
      if (!skillId) continue;
      const skill = this.skillLookupById[skillId];
      if (!skill) continue;
      const effectDescriptions = (skill.effectIds ?? [])
        .map((id) => {
          const effect = this.skillEffectLookupById[id];
          if (!effect?.description) return null;
          const buffLabel = Math.round((effect.buffPercent ?? 0) * 100);
          return effect.description.replace(/<buff>/g, String(buffLabel));
        })
        .filter(Boolean)
        .join(' ');
      const effectIconUrls = (skill.effectIds ?? [])
        .map((id) => this.skillEffectLookupById[id]?.iconUrl)
        .filter((url): url is string => typeof url === 'string' && url.length > 0);
      slots[i] = {
        skillId: skill.skill_id,
        name: skill.skill_name,
        element: skill.element,
        type: skill.type,
        ...(skill.type === 'damage' && skill.damage != null && { damage: skill.damage }),
        ...(skill.type === 'support' && skill.healPercent != null && { healPercent: skill.healPercent }),
        ...(effectDescriptions && { effectDescriptions }),
        ...(effectIconUrls.length > 0 && { effectIconUrls }),
      };
    }
    return slots;
  }

  private getEquipmentItemById(itemId: string): GameItemDefinition | null {
    const item = this.itemById[itemId];
    if (!item || item.category !== 'equipment') {
      return null;
    }
    if (item.effectType !== 'equip_effect' && item.effectType !== 'equip_stub') {
      return null;
    }
    return item;
  }

  private getEquipmentItemSizeById(itemId: string): number {
    const item = this.getEquipmentItemById(itemId);
    if (!item) {
      return 1;
    }
    const config = item.effectConfig as { equipSize?: number };
    if (typeof config.equipSize !== 'number' || !Number.isFinite(config.equipSize)) {
      return 1;
    }
    return Math.max(1, Math.min(8, Math.floor(config.equipSize)));
  }

  private getEquipmentEffectIdsForItem(item: GameItemDefinition): string[] {
    const config = item.effectConfig as { equipmentEffectIds?: string[] };
    if (!Array.isArray(config.equipmentEffectIds)) {
      return [];
    }
    return config.equipmentEffectIds
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
      .filter((entry, index, values) => values.indexOf(entry) === index);
  }

  private resolveEquipmentStateForCritter(
    progress: PlayerCritterProgress['collection'][number],
    critter: CritterDefinition,
    commitIfChanged: boolean,
  ): ResolvedEquipmentState {
    const slotCount = Math.max(0, computeCritterUnlockedEquipSlots(critter, progress.level));
    const rawAnchors = Array.isArray(progress.equippedEquipmentAnchors) ? progress.equippedEquipmentAnchors : [];
    const state = resolveEquipmentState(rawAnchors, slotCount, (itemId) => this.getEquipmentItemSizeById(itemId));
    if (commitIfChanged && !areEquipmentAnchorsEqual(rawAnchors, state.anchors)) {
      progress.equippedEquipmentAnchors = state.anchors;
      this.markProgressDirty();
    }
    return state;
  }

  private countEquippedItemCopies(
    itemId: string,
    options?: { critterIdOverride?: number; anchorsOverride?: EquippedEquipmentAnchor[] },
  ): number {
    const normalizedItemId = sanitizeRuntimeIdentifier(itemId);
    if (!normalizedItemId) {
      return 0;
    }
    let count = 0;
    for (const entry of this.playerCritterProgress.collection) {
      const critter = this.critterLookup[entry.critterId];
      if (!entry.unlocked || !critter) {
        continue;
      }
      const anchors =
        options?.critterIdOverride === entry.critterId && options.anchorsOverride
          ? options.anchorsOverride
          : this.resolveEquipmentStateForCritter(entry, critter, false).anchors;
      for (const anchor of anchors) {
        if (anchor.itemId === normalizedItemId) {
          count += 1;
        }
      }
    }
    return count;
  }

  private getEquipmentEffectsFromAnchors(anchors: EquippedEquipmentAnchor[]): EquipmentEffectDefinition[] {
    const effects: EquipmentEffectDefinition[] = [];
    for (const anchor of anchors) {
      const item = this.getEquipmentItemById(anchor.itemId);
      if (!item) {
        continue;
      }
      const effectIds = this.getEquipmentEffectIdsForItem(item);
      for (const effectId of effectIds) {
        const effect = this.equipmentEffectLookupById[effectId];
        if (!effect) {
          continue;
        }
        effects.push(effect);
      }
    }
    return effects;
  }

  private applyEquipmentEffectsToStats(
    baseStats: CritterStats,
    effects: EquipmentEffectDefinition[],
  ): CritterStats {
    const flatByStat: Record<EquipmentEffectStat, number> = {
      hp: 0,
      attack: 0,
      defense: 0,
      speed: 0,
    };
    const percentByStat: Record<EquipmentEffectStat, number> = {
      hp: 0,
      attack: 0,
      defense: 0,
      speed: 0,
    };
    for (const effect of effects) {
      for (const modifier of effect.modifiers ?? []) {
        if (modifier.mode === 'flat') {
          flatByStat[modifier.stat] += modifier.value;
        } else {
          percentByStat[modifier.stat] += modifier.value;
        }
      }
    }
    return {
      hp: applyStatModifier(baseStats.hp, flatByStat.hp, percentByStat.hp),
      attack: applyStatModifier(baseStats.attack, flatByStat.attack, percentByStat.attack),
      defense: applyStatModifier(baseStats.defense, flatByStat.defense, percentByStat.defense),
      speed: applyStatModifier(baseStats.speed, flatByStat.speed, percentByStat.speed),
    };
  }

  private summarizeEquipmentEffect(effect: EquipmentEffectDefinition): string {
    const description = effect.description.trim();
    if (description) {
      return description;
    }
    const parts = effect.modifiers.map((modifier: EquipmentEffectModifier) => {
      const stat = modifier.stat.toUpperCase();
      if (modifier.mode === 'percent') {
        const pct = Math.round(modifier.value * 100);
        return `${pct >= 0 ? '+' : ''}${pct}% ${stat}`;
      }
      const flat = Math.round(modifier.value);
      return `${flat >= 0 ? '+' : ''}${flat} ${stat}`;
    });
    return parts.join(', ');
  }

  private buildEquipmentSlotSnapshot(
    slot: EquippedEquipmentSlot,
  ): RuntimeSnapshot['critters']['squadSlots'][number]['equipmentSlots'][number] {
    const item = this.getEquipmentItemById(slot.itemId);
    const effectDefs = item ? this.getEquipmentEffectsFromAnchors([{ itemId: item.id, slotIndex: slot.anchorSlotIndex }]) : [];
    const effectIconUrls = effectDefs
      .map((effect) => effect.iconUrl)
      .filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
    const effectDescriptions = effectDefs
      .map((effect) => this.summarizeEquipmentEffect(effect))
      .filter((entry) => entry.length > 0);
    return {
      itemId: slot.itemId,
      itemName: item?.name ?? slot.itemId,
      imageUrl: item?.imageUrl ?? '',
      equipSize: slot.equipSize,
      anchorSlotIndex: slot.anchorSlotIndex,
      spanIndex: slot.spanIndex,
      effectIconUrls,
      effectDescriptions,
    };
  }

  private getCritterSummary(): RuntimeSnapshot['critters'] {
    if (this.ensureLockedKnockoutTargetSelectionValid()) {
      this.markProgressDirty();
    }

    const collectionById = this.playerCritterProgress.collection.reduce<
      Record<number, PlayerCritterProgress['collection'][number]>
    >((registry, entry) => {
      registry[entry.critterId] = entry;
      return registry;
    }, {});
    const eligibleLockedKnockoutTargetCritterIds = this.getEligibleLockedKnockoutTargetCritterIds();
    const eligibleLockedKnockoutTargetCritterIdSet = new Set<number>(eligibleLockedKnockoutTargetCritterIds);
    const selectedLockedKnockoutTargetCritterId = this.playerCritterProgress.lockedKnockoutTargetCritterId;
    const equipmentStateByCritterId = new Map<number, ResolvedEquipmentState>();
    const equipmentAdjustedStatsByCritterId = new Map<number, CritterStats>();

    const collection = this.critterDatabase.map((critter) => {
      const progress = collectionById[critter.id] ?? null;
      const unlocked = Boolean(progress?.unlocked);
      const level = unlocked ? Math.max(1, progress?.level ?? 1) : 0;
      const derived = computeCritterDerivedProgress(critter, level);
      const maxLevel = Math.max(1, ...critter.levels.map((entry) => entry.level));
      const levelProgress = critter.levels.map((levelRow) => {
        const missions = levelRow.missions.map((mission) => {
          const currentValue = this.getMissionCurrentValue(
            mission,
            levelRow.level,
            progress?.missionProgress ?? {},
            levelRow.missions,
          );
          const missionCompleted = currentValue >= mission.targetValue;
          const ascendsFromCritter = mission.ascendsFromCritterId
            ? this.critterLookup[mission.ascendsFromCritterId]
            : undefined;
          const knockoutCritterIds = Array.isArray(mission.knockoutCritterIds) ? mission.knockoutCritterIds : [];
          const knockoutCritterNames = knockoutCritterIds
            .map((critterId) => this.critterLookup[critterId]?.name ?? `#${critterId}`);
          const knockoutElements = Array.isArray(mission.knockoutElements) ? mission.knockoutElements : [];
          const requiredEquippedItemIds =
            mission.type === 'opposing_knockouts_with_item' && Array.isArray(mission.requiredEquippedItemIds)
              ? mission.requiredEquippedItemIds
              : [];
          const requiredEquippedItemNames = requiredEquippedItemIds.map(
            (itemId) => this.itemById[itemId]?.name ?? itemId,
          );
          const requiredHealingItemIds =
            mission.type === 'heal_critter' && Array.isArray(mission.requiredHealingItemIds)
              ? mission.requiredHealingItemIds
              : [];
          const requiredHealingItemNames = requiredHealingItemIds.map(
            (itemId) => this.itemById[itemId]?.name ?? itemId,
          );
          return {
            id: mission.id,
            type: mission.type,
            targetValue: mission.targetValue,
            currentValue,
            completed: missionCompleted,
            ascendsFromCritterId: mission.ascendsFromCritterId,
            ascendsFromCritterName: ascendsFromCritter?.name,
            knockoutElements,
            knockoutCritterIds,
            knockoutCritterNames,
            requiredEquippedItemCount:
              mission.type === 'opposing_knockouts_with_item' ? this.getRequiredEquippedItemCount(mission) : undefined,
            requiredEquippedItemIds,
            requiredEquippedItemNames,
            requiredHealingItemIds,
            requiredHealingItemNames,
            storyFlagId: mission.storyFlagId,
            label: mission.label,
          };
        });
        const completedMissionCount = missions.reduce((count, mission) => count + (mission.completed ? 1 : 0), 0);
        const needed = Math.min(levelRow.requiredMissionCount, levelRow.missions.length);
        const completed = completedMissionCount >= needed;
        return {
          level: levelRow.level,
          requiredMissionCount: needed,
          completedMissionCount,
          completed,
          missions,
        };
      });
      const targetLevel = level + 1;
      const activeRequirementLevelRow = levelProgress.find((entry) => entry.level === targetLevel) ?? null;
      const canAdvance = Boolean(activeRequirementLevelRow?.completed);
      const advanceActionLabel: 'Unlock' | 'Level Up' | null = canAdvance
        ? (level === 0 ? 'Unlock' : 'Level Up')
        : null;
      const availableAbilityIds = new Set(progress?.unlockedAbilityIds ?? derived.unlockedAbilityIds);
      const effectiveStats = progress?.effectiveStats ?? derived.effectiveStats;
      if (unlocked && progress) {
        const equipmentState = this.resolveEquipmentStateForCritter(progress, critter, true);
        const equipmentEffects = this.getEquipmentEffectsFromAnchors(equipmentState.anchors);
        equipmentStateByCritterId.set(critter.id, equipmentState);
        equipmentAdjustedStatsByCritterId.set(
          critter.id,
          this.applyEquipmentEffectsToStats(effectiveStats, equipmentEffects),
        );
      } else {
        equipmentStateByCritterId.set(critter.id, resolveEquipmentState([], 0, () => 1));
      }
      const maxHp = unlocked ? Math.max(1, effectiveStats.hp) : null;
      const currentHp =
        unlocked && maxHp !== null
          ? clamp(progress?.currentHp ?? maxHp, 0, maxHp)
          : null;
      const lockedKnockoutTargetEligible = eligibleLockedKnockoutTargetCritterIdSet.has(critter.id);
      const lockedKnockoutTargetSelected =
        lockedKnockoutTargetEligible && selectedLockedKnockoutTargetCritterId === critter.id;

      return {
        critterId: critter.id,
        name: critter.name,
        element: critter.element,
        rarity: critter.rarity,
        spriteUrl: critter.spriteUrl,
        unlocked,
        lockedKnockoutTargetEligible,
        lockedKnockoutTargetSelected,
        level,
        maxLevel,
        currentHp,
        maxHp,
        canAdvance,
        advanceActionLabel,
        missionCompletions: unlocked ? this.getCompletedMissionCount(critter, progress?.missionProgress ?? {}) : null,
        baseStats: { ...critter.baseStats },
        statBonus: progress?.statBonus ?? derived.statBonus,
        effectiveStats,
        abilities: critter.abilities.map((ability) => ({
          id: ability.id,
          name: ability.name,
          kind: ability.kind,
          description: ability.description,
          unlocked: availableAbilityIds.has(ability.id),
        })),
        unlockedAbilityIds: progress?.unlockedAbilityIds ?? derived.unlockedAbilityIds,
        equippedSkillSlots: this.resolveEquippedSkillSlotsForSnapshot(progress?.equippedSkillIds),
        unlockedSkillIds: derived.unlockedSkillIds,
        unlockedSkillOptions: derived.unlockedSkillIds.map((id) => {
          const skill = this.skillLookupById[id];
          return { skillId: id, name: skill?.skill_name ?? id };
        }),
        levelProgress,
        activeRequirement: activeRequirementLevelRow
          ? {
              level: activeRequirementLevelRow.level,
              targetLevel: activeRequirementLevelRow.level,
              requiredMissionCount: activeRequirementLevelRow.requiredMissionCount,
              completedMissionCount: activeRequirementLevelRow.completedMissionCount,
              completed: activeRequirementLevelRow.completed,
              missions: activeRequirementLevelRow.missions.map((mission) => ({ ...mission })),
            }
          : null,
      };
    });
    const selectedLockedKnockoutTargetEntry =
      selectedLockedKnockoutTargetCritterId === null
        ? null
        : collection.find((entry) => entry.critterId === selectedLockedKnockoutTargetCritterId) ?? null;
    const selectedLockedKnockoutMissionRows =
      selectedLockedKnockoutTargetEntry?.activeRequirement?.missions
        .filter((mission) => isKnockoutMissionType(mission.type))
        .map((mission) => ({ ...mission })) ?? [];

    const squadSlots = this.playerCritterProgress.squad.map((critterId, index) => {
      const unlocked = index < this.playerCritterProgress.unlockedSquadSlots;
      const critter = critterId ? this.critterLookup[critterId] : undefined;
      const progress = critterId ? collectionById[critterId] : undefined;
      const equipmentAdjustedStats =
        unlocked && critter && progress?.unlocked
          ? equipmentAdjustedStatsByCritterId.get(critter.id) ??
            { ...progress.effectiveStats }
          : null;
      const equipmentState =
        unlocked && critter && progress?.unlocked
          ? equipmentStateByCritterId.get(critter.id) ??
            this.resolveEquipmentStateForCritter(progress, critter, true)
          : null;
      const maxHp =
        unlocked && progress?.unlocked
          ? Math.max(1, equipmentAdjustedStats?.hp ?? progress.effectiveStats.hp)
          : null;
      const currentHp =
        unlocked && progress?.unlocked && maxHp !== null
          ? clamp(progress.currentHp, 0, maxHp)
          : null;
      const equipmentSlots =
        equipmentState?.slots.map((slot) => (slot ? this.buildEquipmentSlotSnapshot(slot) : null)) ?? [];

      return {
        index,
        unlocked,
        critterId: unlocked ? critterId : null,
        critterName: unlocked && critter ? critter.name : null,
        level: unlocked && progress?.unlocked ? progress.level : null,
        currentHp,
        maxHp,
        equipmentAdjustedStats,
        equipmentSlots,
      };
    });

    return {
      unlockedCount: collection.filter((entry) => entry.unlocked).length,
      totalCount: this.critterDatabase.length,
      unlockedSquadSlots: this.playerCritterProgress.unlockedSquadSlots,
      maxSquadSlots: MAX_SQUAD_SLOTS,
      lockedKnockoutTracker: {
        selectedCritterId: selectedLockedKnockoutTargetEntry?.critterId ?? null,
        selectedCritterName: selectedLockedKnockoutTargetEntry?.name ?? null,
        eligibleCritterIds: eligibleLockedKnockoutTargetCritterIds,
        missionRows: selectedLockedKnockoutMissionRows,
      },
      squadSlots,
      collection,
    };
  }

  private getBackpackSummary(): RuntimeSnapshot['backpack'] {
    const equippedByItemId = new Map<
      string,
      Array<{
        critterId: number;
        critterName: string;
        spriteUrl: string;
      }>
    >();
    for (const entry of this.playerCritterProgress.collection) {
      if (!entry.unlocked) {
        continue;
      }
      const critter = this.critterLookup[entry.critterId];
      if (!critter) {
        continue;
      }
      const equipmentState = this.resolveEquipmentStateForCritter(entry, critter, false);
      for (const anchor of equipmentState.anchors) {
        const equippedCritters = equippedByItemId.get(anchor.itemId) ?? [];
        if (equippedCritters.some((equippedCritter) => equippedCritter.critterId === critter.id)) {
          continue;
        }
        equippedCritters.push({
          critterId: critter.id,
          critterName: critter.name,
          spriteUrl: critter.spriteUrl,
        });
        equippedByItemId.set(anchor.itemId, equippedCritters);
      }
    }

    const allItems = [...this.itemDatabase]
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
      .map((item) => {
        const quantityOwned = getItemInventoryQuantity(this.playerItemInventory, item.id);
        const equippedByCritters = item.category === 'equipment' ? [...(equippedByItemId.get(item.id) ?? [])] : undefined;
        const quantityEquippable =
          item.category === 'equipment' ? Math.max(0, quantityOwned - (equippedByCritters?.length ?? 0)) : undefined;
        const hasUseAction = item.category !== 'material';
        return {
          itemId: item.id,
          name: item.name,
          category: item.category,
          description: item.description,
          imageUrl: item.imageUrl,
          misuseText: item.misuseText,
          effectType: item.effectType,
          effectSummary: describeItemEffect(item),
          ...(item.category === 'equipment' && { equipSize: this.getEquipmentItemSizeById(item.id) }),
          ...(item.category === 'equipment' && { quantityEquippable }),
          ...(item.category === 'equipment' && { equippedByCritters }),
          consumable: item.consumable,
          isActive: item.isActive,
          quantityOwned,
          hasUseAction,
          canUse:
            hasUseAction &&
            item.isActive &&
            (item.category === 'equipment' ? (quantityEquippable ?? 0) > 0 : quantityOwned > 0),
        };
      });
    const items = allItems.filter((item) => item.quantityOwned > 0);
    const categories = [...new Set(items.map((item) => item.category))].sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' }),
    );
    return {
      totalOwnedKinds: items.length,
      totalOwnedCount: items.reduce((sum, item) => sum + item.quantityOwned, 0),
      categories,
      items,
    };
  }

  private persistNow(): void {
    const save: SaveProfile = {
      id: 'slot-1',
      version: SAVE_VERSION,
      playerName: this.playerName,
      currentMapId: this.currentMapId,
      player: {
        x: this.playerPosition.x,
        y: this.playerPosition.y,
        facing: this.facing,
      },
      selectedStarterId: this.selectedStarterId,
      respawnPoint: {
        mapId: this.respawnMapId,
        position: {
          x: this.respawnPosition.x,
          y: this.respawnPosition.y,
        },
        facing: this.respawnFacing,
      },
      playerCritterProgress: {
        ...this.playerCritterProgress,
        squad: [...this.playerCritterProgress.squad],
        collection: this.playerCritterProgress.collection.map((entry) => ({
          ...entry,
          missionProgress: { ...entry.missionProgress },
          statBonus: { ...entry.statBonus },
          effectiveStats: { ...entry.effectiveStats },
          unlockedAbilityIds: [...entry.unlockedAbilityIds],
          equippedEquipmentAnchors: (entry.equippedEquipmentAnchors ?? []).map((anchor) => ({
            itemId: anchor.itemId,
            slotIndex: anchor.slotIndex,
          })),
        })),
      },
      playerItemInventory: {
        ...this.playerItemInventory,
        entries: this.playerItemInventory.entries.map((entry) => ({
          itemId: entry.itemId,
          quantity: entry.quantity,
        })),
      },
      progressTracking: {
        mainStory: {
          stageId: this.mainStoryStageId,
          flags: { ...this.flags },
        },
        sideStory: {
          stageId: this.sideStoryStageId,
          flags: { ...this.sideStoryFlags },
          missions: cloneSideStoryMissionTracking(this.sideStoryMissions),
        },
      },
      updatedAt: new Date().toISOString(),
    };

    persistSave(save);
    this.dirty = false;
    this.lastSavedAt = save.updatedAt;
  }

  private getCompletedMissionCount(critter: CritterDefinition, progress: Record<string, number>): number {
    let completed = 0;
    for (const levelRow of critter.levels) {
      for (const mission of levelRow.missions) {
        const currentValue = this.getMissionCurrentValue(mission, levelRow.level, progress, levelRow.missions);
        if (currentValue >= mission.targetValue) {
          completed += 1;
        }
      }
    }
    return completed;
  }

  private hasPendingStoryFlagMission(
    missions: CritterLevelMissionRequirement[],
    level: number,
    progress: Record<string, number>,
  ): boolean {
    for (const mission of missions) {
      if (mission.type !== 'story_flag') {
        continue;
      }
      const currentValue = this.getMissionRawCurrentValue(mission, level, progress);
      if (currentValue < mission.targetValue) {
        return true;
      }
    }
    return false;
  }

  private getMissionRawCurrentValue(
    mission: CritterLevelMissionRequirement,
    level: number,
    progress: Record<string, number>,
  ): number {
    if (mission.type === 'story_flag') {
      if (!mission.storyFlagId) {
        return 0;
      }
      return this.flags[mission.storyFlagId] ? 1 : 0;
    }

    if (mission.type === 'ascension') {
      const sourceCritterId = mission.ascendsFromCritterId;
      if (!sourceCritterId) {
        return 0;
      }
      const sourceProgress = this.playerCritterProgress.collection.find((entry) => entry.critterId === sourceCritterId);
      if (!sourceProgress?.unlocked) {
        return 0;
      }
      return Math.max(0, sourceProgress.level);
    }

    const key = missionProgressKey(level, mission.id);
    return Math.max(0, progress[key] ?? 0);
  }

  private getMissionCurrentValue(
    mission: CritterLevelMissionRequirement,
    level: number,
    progress: Record<string, number>,
    levelMissions?: CritterLevelMissionRequirement[],
  ): number {
    const currentValue = this.getMissionRawCurrentValue(mission, level, progress);
    if (mission.type === 'story_flag') {
      return currentValue;
    }
    const missions = Array.isArray(levelMissions) ? levelMissions : [];
    if (missions.length > 0 && this.hasPendingStoryFlagMission(missions, level, progress)) {
      return 0;
    }
    return currentValue;
  }

  private tryAutoAssignFirstUnlockedCritter(unlockedCritterId: number): boolean {
    const unlockedCount = this.playerCritterProgress.collection.reduce(
      (count, entry) => count + (entry.unlocked ? 1 : 0),
      0,
    );
    if (unlockedCount !== 1) {
      return false;
    }
    const slotLimit = this.getUnlockedSquadSlotLimit();
    if (slotLimit <= 0) {
      return false;
    }
    if (this.playerCritterProgress.squad[0] === unlockedCritterId) {
      return false;
    }
    if (this.countAssignedSquadCritters() > 0) {
      return false;
    }
    this.playerCritterProgress.squad[0] = unlockedCritterId;
    return true;
  }

  private ensureMinimumSquadCritterAssignment(): boolean {
    if (!this.hasAnyUnlockedCritter()) {
      return false;
    }
    if (this.countAssignedSquadCritters() > 0) {
      return false;
    }
    const slotLimit = this.getUnlockedSquadSlotLimit();
    if (slotLimit <= 0) {
      return false;
    }
    const firstUnlockedCritterId = this.playerCritterProgress.collection.find((entry) => entry.unlocked)?.critterId ?? null;
    if (firstUnlockedCritterId === null) {
      return false;
    }
    this.playerCritterProgress.squad[0] = firstUnlockedCritterId;
    return true;
  }

  private hasAnyUnlockedCritter(): boolean {
    return this.playerCritterProgress.collection.some((entry) => entry.unlocked);
  }

  private isCritterFullyHealthy(critterId: number): boolean {
    const progress = this.playerCritterProgress.collection.find((entry) => entry.critterId === critterId);
    const critter = this.critterLookup[critterId];
    if (!progress?.unlocked || !critter) {
      return false;
    }
    const equipmentState = this.resolveEquipmentStateForCritter(progress, critter, true);
    const equipmentEffects = this.getEquipmentEffectsFromAnchors(equipmentState.anchors);
    const adjustedStats = this.applyEquipmentEffectsToStats(progress.effectiveStats, equipmentEffects);
    const maxHp = Math.max(1, adjustedStats.hp);
    return clamp(progress.currentHp, 0, maxHp) >= maxHp;
  }

  private countAssignedSquadCritters(): number {
    const slotLimit = this.getUnlockedSquadSlotLimit();
    let count = 0;
    for (let index = 0; index < slotLimit; index += 1) {
      if (this.playerCritterProgress.squad[index] !== null) {
        count += 1;
      }
    }
    return count;
  }

  private getUnlockedSquadSlotLimit(): number {
    return Math.min(this.playerCritterProgress.unlockedSquadSlots, this.playerCritterProgress.squad.length);
  }

  private handleEmptyPlayerBattleTeam(): void {
    if (this.hasAnyUnlockedCritter()) {
      this.performBlackout();
      return;
    }
    this.showMessage('You need to unlock a critter before battling.', 2600);
  }

  private resolveFallbackRespawnMapId(candidateMapId: string): string {
    const preferred = candidateMapId.trim();
    if (preferred && this.mapRegistry[preferred]) {
      return preferred;
    }
    if (this.mapRegistry[DEFAULT_RESPAWN_MAP_ID]) {
      return DEFAULT_RESPAWN_MAP_ID;
    }
    return 'spawn';
  }

  private clampPositionToMap(position: Vector2, map: WorldMap, fallbackPosition?: Vector2): Vector2 {
    const fallback = fallbackPosition ?? { x: 0, y: 0 };
    const rawX = Number.isFinite(position.x) ? Math.floor(position.x) : fallback.x;
    const rawY = Number.isFinite(position.y) ? Math.floor(position.y) : fallback.y;
    return {
      x: Math.max(0, Math.min(Math.max(0, map.width - 1), rawX)),
      y: Math.max(0, Math.min(Math.max(0, map.height - 1), rawY)),
    };
  }

  private resolveRespawnPoint(rawRespawnPoint: SaveProfile['respawnPoint'] | undefined): SaveProfile['respawnPoint'] {
    const mapId = this.resolveFallbackRespawnMapId(rawRespawnPoint?.mapId ?? DEFAULT_RESPAWN_MAP_ID);
    const map = this.mapRegistry[mapId];
    const preferredPosition = rawRespawnPoint?.position ?? {
      x: DEFAULT_RESPAWN_POSITION.x,
      y: DEFAULT_RESPAWN_POSITION.y,
    };
    const defaultMapPosition =
      mapId === DEFAULT_RESPAWN_MAP_ID ? { x: DEFAULT_RESPAWN_POSITION.x, y: DEFAULT_RESPAWN_POSITION.y } : { x: 0, y: 0 };
    const position = map
      ? this.clampPositionToMap(preferredPosition, map, defaultMapPosition)
      : defaultMapPosition;
    const facing =
      rawRespawnPoint?.facing === 'up' ||
      rawRespawnPoint?.facing === 'down' ||
      rawRespawnPoint?.facing === 'left' ||
      rawRespawnPoint?.facing === 'right'
        ? rawRespawnPoint.facing
        : DEFAULT_RESPAWN_FACING;
    return {
      mapId,
      position,
      facing,
    };
  }

  private updateRespawnPointToCurrentPosition(): void {
    const map = this.mapRegistry[this.currentMapId];
    if (!map) {
      return;
    }
    this.respawnMapId = map.id;
    this.respawnPosition = this.clampPositionToMap(this.playerPosition, map);
    this.respawnFacing = this.facing;
  }

  private markDirty(): void {
    this.dirty = true;
  }

  /** Heal all squad critters to full HP (used by healers and blackout). */
  private healSquadToFull(): void {
    const squadIds = new Set(
      this.playerCritterProgress.squad.filter((id): id is number => id !== null && id !== undefined),
    );
    for (const entry of this.playerCritterProgress.collection) {
      if (!squadIds.has(entry.critterId)) {
        continue;
      }
      const critter = this.critterLookup[entry.critterId];
      if (!critter) {
        continue;
      }
      const equipmentState = this.resolveEquipmentStateForCritter(entry, critter, true);
      const equipmentEffects = this.getEquipmentEffectsFromAnchors(equipmentState.anchors);
      const adjustedStats = this.applyEquipmentEffectsToStats(entry.effectiveStats, equipmentEffects);
      const maxHp = Math.max(1, adjustedStats.hp);
      entry.currentHp = maxHp;
    }
  }

  /** Warp player to user-house (5,7) facing down and heal all squad critters to full. */
  private performBlackout(): void {
    const mapId = this.resolveFallbackRespawnMapId(this.respawnMapId);
    const map = this.mapRegistry[mapId];
    const fallbackPosition =
      mapId === DEFAULT_RESPAWN_MAP_ID
        ? { x: DEFAULT_RESPAWN_POSITION.x, y: DEFAULT_RESPAWN_POSITION.y }
        : { x: 0, y: 0 };
    const position = map ? this.clampPositionToMap(this.respawnPosition, map, fallbackPosition) : fallbackPosition;
    this.currentMapId = mapId;
    this.playerPosition = position;
    this.facing = this.respawnFacing;
    this.moveStep = null;
    this.preloadMapVisualAssets(this.currentMapId);
    this.preloadNeighborMapVisualAssets(this.currentMapId);
    this.heldDirections = [];
    this.dialogue = null;
    this.healPrompt = null;
    this.shopPrompt = null;
    this.pendingGuardBattle = null;
    this.pendingNpcShopStart = null;
    this.pendingNpcInteractBattleStart = null;
    this.pendingGuardDefeat = null;
    this.pendingNpcInteractBattleDefeat = null;
    this.pendingBattleRewardDialogue = null;

    this.healSquadToFull();
    this.showMessage('You blacked out and woke up at your last healing spot. Your squad was healed.', 3200);
    this.markProgressDirty();
  }

  private markProgressDirty(): void {
    this.markDirty();
    this.persistNow();
  }

  private tickMessage(deltaMs: number): void {
    if (!this.transientMessage) {
      return;
    }

    this.transientMessage.remainingMs -= deltaMs;
    if (this.transientMessage.remainingMs <= 0) {
      this.transientMessage = null;
    }
  }

  private showMessage(text: string, durationMs = 1200): void {
    this.transientMessage = {
      text,
      remainingMs: Math.max(200, Math.floor(durationMs)),
    };
  }

  private isInteractionVisible(interaction: InteractionDefinition): boolean {
    if (interaction.requiresFlag && !this.flags[interaction.requiresFlag]) {
      return false;
    }

    if (interaction.hideIfFlag && this.flags[interaction.hideIfFlag]) {
      return false;
    }

    return true;
  }

  private resolveInteractionKind(interaction: InteractionDefinition): 'dialogue' | 'heal_tile' {
    const rawKind = typeof interaction.kind === 'string' ? interaction.kind.trim().toLowerCase() : '';
    if (rawKind === 'heal_tile' || rawKind === 'heal') {
      return 'heal_tile';
    }
    return 'dialogue';
  }

  private getObjectiveText(): string {
    if (!this.flags[FLAG_SELECTED_STARTER]) {
      if (this.currentMapId === 'spawn') {
        return 'Head north to reach Portlock.';
      }
      if (this.currentMapId === 'portlock') {
        return 'Enter Uncle Hank\'s house for your starter pickup.';
      }
      if (this.currentMapId === 'uncle-s-house') {
        return this.starterSelection ? 'Choose your starter critter.' : 'Talk to Uncle Hank.';
      }
      return 'Find Uncle Hank to begin your story.';
    }

    if (!this.flags[FLAG_STARTER_SELECTION_DONE]) {
      return 'Unlock your starter critter in Collection.';
    }

    if (!this.flags[FLAG_DEMO_DONE]) {
      return this.activeBattle ? 'Finish your duel with Jacob.' : 'Get ready for Jacob\'s duel.';
    }

    return 'Explore Portlock with your partner critter.';
  }

  private drawTile(
    ctx: CanvasRenderingContext2D,
    color: string,
    accentColor: string,
    x: number,
    y: number,
    height: number,
  ): void {
    const lift = Math.round(height * Math.max(2, TILE_SIZE / 12));

    ctx.fillStyle = color;
    ctx.fillRect(x, y - lift, TILE_SIZE, TILE_SIZE);

    if (height > 0) {
      ctx.fillStyle = shadeColor(color, -20);
      ctx.fillRect(x, y + TILE_SIZE - lift, TILE_SIZE, lift);

      const sideWidth = Math.max(2, Math.floor(TILE_SIZE / 10));
      ctx.fillStyle = shadeColor(color, -28);
      ctx.fillRect(x + TILE_SIZE - sideWidth, y - lift, sideWidth, TILE_SIZE + lift);
    }

    ctx.strokeStyle = shadeColor(accentColor, -18);
    ctx.globalAlpha = 0.25;
    ctx.strokeRect(x + 0.5, y - lift + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    ctx.globalAlpha = 1;

    if (height === 0) {
      ctx.fillStyle = shadeColor(accentColor, 12);
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x + 2, y - lift + 2, TILE_SIZE - 4, 4);
      ctx.globalAlpha = 1;
    }
  }

  private drawNpc(
    ctx: CanvasRenderingContext2D,
    npc: NpcDefinition,
    position: Vector2,
    cameraX: number,
    cameraY: number,
    facing: Direction,
    isMoving: boolean,
  ): void {
    const sprite = npc.sprite;
    if (sprite?.url) {
      const sheet = this.npcSpriteSheets[sprite.url.trim()];
      if (sheet?.status === 'ready' && sheet.image && sheet.columns > 0) {
        const frameIndex = this.getNpcFrameIndex(npc, facing, isMoving);
        if (frameIndex >= 0 && this.drawSpriteFrame(ctx, sprite, sheet, frameIndex, position, cameraX, cameraY)) {
          return;
        }
      }
    }

    this.drawActor(ctx, position, npc.color, cameraX, cameraY, facing);
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    position: Vector2,
    cameraX: number,
    cameraY: number,
    facing: Direction,
    isMoving: boolean,
  ): void {
    this.ensurePlayerSpriteLoaded();
    const moveProgressAndPhase =
      this.moveStep && isMoving
        ? {
            progress: clamp(this.moveStep.elapsed / this.moveStep.duration, 0, 1),
            stridePhase: this.playerStridePhase,
          }
        : undefined;
    const frameIndex = this.getSpriteFrameIndex(
      this.playerSpriteConfig,
      facing,
      isMoving,
      this.playerAnimationMs,
      { moveProgressAndPhase },
    );
    if (
      this.playerSpriteSheet.status === 'ready' &&
      this.playerSpriteSheet.image &&
      this.playerSpriteSheet.columns > 0 &&
      frameIndex >= 0 &&
      this.drawSpriteFrame(
        ctx,
        this.playerSpriteConfig,
        this.playerSpriteSheet,
        frameIndex,
        position,
        cameraX,
        cameraY,
      )
    ) {
      return;
    }

    this.drawActor(ctx, position, '#2f5fd0', cameraX, cameraY, facing, true);
  }

  private getNpcFrameIndex(npc: NpcDefinition, facing: Direction, isMoving: boolean): number {
    const sprite = npc.sprite;
    if (!sprite) {
      return -1;
    }

    const state = this.getNpcRuntimeState(npc);
    const moveProgressAndPhase =
      state.moveStep && isMoving
        ? {
            progress: clamp(state.moveStep.elapsed / state.moveStep.duration, 0, 1),
            stridePhase: state.stridePhase ?? 0,
          }
        : undefined;
    return this.getSpriteFrameIndex(sprite, facing, isMoving, state.animationMs, {
      idleAnimationName: npc.idleAnimation,
      moveAnimationName: npc.moveAnimation,
      moveProgressAndPhase,
    });
  }

  private drawSpriteFrame(
    ctx: CanvasRenderingContext2D,
    sprite: NpcSpriteConfig,
    sheet: NpcSpriteSheetState,
    frameIndex: number,
    position: Vector2,
    cameraX: number,
    cameraY: number,
  ): boolean {
    if (!sheet.image || sheet.columns <= 0) {
      return false;
    }

    const atlasCellWidth = Math.max(1, sprite.atlasCellWidth ?? sprite.frameWidth);
    const atlasCellHeight = Math.max(1, sprite.atlasCellHeight ?? sprite.frameHeight);
    const frameCellsWide = Math.max(1, sprite.frameCellsWide ?? Math.max(1, Math.round(sprite.frameWidth / atlasCellWidth)));
    const frameCellsTall = Math.max(1, sprite.frameCellsTall ?? Math.max(1, Math.round(sprite.frameHeight / atlasCellHeight)));
    const sourceWidth = Math.max(1, atlasCellWidth * frameCellsWide);
    const sourceHeight = Math.max(1, atlasCellHeight * frameCellsTall);

    const sourceX = (frameIndex % sheet.columns) * atlasCellWidth;
    const sourceY = Math.floor(frameIndex / sheet.columns) * atlasCellHeight;

    const renderWidthTiles = Math.max(1, sprite.renderWidthTiles ?? 1);
    const renderHeightTiles = Math.max(1, sprite.renderHeightTiles ?? 2);
    const destWidth = renderWidthTiles * TILE_SIZE;
    const destHeight = renderHeightTiles * TILE_SIZE;
    const baseLeftX = (position.x - cameraX) * TILE_SIZE;
    const baseBottomY = (position.y - cameraY + 1) * TILE_SIZE;
    const drawX = baseLeftX + (TILE_SIZE - destWidth) / 2;
    const drawY = baseBottomY - destHeight;

    const centerX = baseLeftX + TILE_SIZE / 2;
    const baseY = baseBottomY;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(centerX, baseY - TILE_SIZE * 0.08, TILE_SIZE * 0.22, TILE_SIZE * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sheet.image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      drawX,
      drawY,
      destWidth,
      destHeight,
    );
    return true;
  }

  private getSpriteFrameIndex(
    sprite: {
      facingFrames: Record<Direction, number>;
      walkFrames?: Partial<Record<Direction, number[]>>;
      animationSets?: Partial<Record<string, Partial<Record<Direction, number[]>>>>;
      defaultIdleAnimation?: string;
      defaultMoveAnimation?: string;
    },
    facing: Direction,
    isMoving: boolean,
    animationMs: number,
    options?: {
      idleAnimationName?: string;
      moveAnimationName?: string;
      /** When moving: progress 0–1 through current cell, stridePhase 0|1 for first/second leg. Half cycle per cell. */
      moveProgressAndPhase?: { progress: number; stridePhase: number };
    },
  ): number {
    const requestedIdleAnimation = options?.idleAnimationName?.trim();
    const requestedMoveAnimation = options?.moveAnimationName?.trim();
    const idleAnimationName = requestedIdleAnimation || sprite.defaultIdleAnimation?.trim() || 'idle';
    const moveAnimationName = requestedMoveAnimation || sprite.defaultMoveAnimation?.trim() || 'walk';

    if (isMoving) {
      const { progress, stridePhase } = options?.moveProgressAndPhase ?? { progress: 0, stridePhase: 0 };
      const cycleProgress = Math.min(1, stridePhase * 0.5 + progress * 0.5);

      const moveFramesFromSet = this.getDirectionalAnimationFrames(sprite.animationSets, moveAnimationName, facing);
      if (moveFramesFromSet.length > 0) {
        const frameIdx = Math.min(
          Math.floor(cycleProgress * moveFramesFromSet.length),
          moveFramesFromSet.length - 1,
        );
        const frame = moveFramesFromSet[frameIdx];
        if (Number.isFinite(frame) && frame >= 0) {
          return Math.floor(frame);
        }
      }
      const walkFrames = sprite.walkFrames?.[facing];
      if (Array.isArray(walkFrames) && walkFrames.length > 0) {
        const frameIdx = Math.min(Math.floor(cycleProgress * walkFrames.length), walkFrames.length - 1);
        const frame = walkFrames[frameIdx];
        if (Number.isFinite(frame) && frame >= 0) {
          return Math.floor(frame);
        }
      }

      // If move animation frames are missing, use idle-set frames as a last moving fallback.
      const idleFramesFromSet = this.getDirectionalAnimationFrames(sprite.animationSets, idleAnimationName, facing);
      if (idleFramesFromSet.length > 0) {
        const frame = idleFramesFromSet[Math.floor(animationMs / 180) % idleFramesFromSet.length];
        if (Number.isFinite(frame) && frame >= 0) {
          return Math.floor(frame);
        }
      }
    } else {
      const idleFramesFromSet = this.getDirectionalAnimationFrames(sprite.animationSets, idleAnimationName, facing);
      if (idleFramesFromSet.length > 0) {
        const frame = idleFramesFromSet[0];
        if (Number.isFinite(frame) && frame >= 0) {
          return Math.floor(frame);
        }
      }
    }

    const facingFrame = sprite.facingFrames?.[facing];
    if (Number.isFinite(facingFrame) && facingFrame >= 0) {
      return Math.floor(facingFrame);
    }

    return -1;
  }

  private getDirectionalAnimationFrames(
    animationSets: Partial<Record<string, Partial<Record<Direction, number[]>>>> | undefined,
    animationName: string,
    direction: Direction,
  ): number[] {
    if (!animationSets || !animationName) {
      return [];
    }

    let set = animationSets[animationName];
    if (!set) {
      const normalizedName = animationName.trim().toLowerCase();
      if (normalizedName) {
        for (const [candidateName, candidateSet] of Object.entries(animationSets)) {
          if (candidateName.trim().toLowerCase() === normalizedName) {
            set = candidateSet;
            break;
          }
        }
      }
    }
    if (!set) {
      return [];
    }
    const frames = set[direction];
    if (!Array.isArray(frames)) {
      return [];
    }

    return frames
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .map((value) => Math.max(0, Math.floor(value)));
  }

  private drawActor(
    ctx: CanvasRenderingContext2D,
    position: Vector2,
    color: string,
    cameraX: number,
    cameraY: number,
    facing: Direction,
    isPlayer = false,
  ): void {
    const centerX = (position.x - cameraX) * TILE_SIZE + TILE_SIZE / 2;
    const baseY = (position.y - cameraY) * TILE_SIZE + TILE_SIZE;

    const shadowW = TILE_SIZE * 0.22;
    const shadowH = TILE_SIZE * 0.12;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(centerX, baseY - TILE_SIZE * 0.08, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyW = TILE_SIZE * 0.36;
    const bodyH = TILE_SIZE * 0.44;
    const bodyX = centerX - bodyW / 2;
    const bodyY = baseY - bodyH - TILE_SIZE * 0.14;

    ctx.fillStyle = color;
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

    ctx.fillStyle = shadeColor(color, 16);
    ctx.fillRect(bodyX + TILE_SIZE * 0.03, bodyY + TILE_SIZE * 0.03, bodyW - TILE_SIZE * 0.06, TILE_SIZE * 0.08);

    ctx.fillStyle = '#f4c9a3';
    const headSize = TILE_SIZE * 0.2;
    ctx.fillRect(centerX - headSize / 2, bodyY - headSize + TILE_SIZE * 0.02, headSize, headSize);

    const delta = DIRECTION_DELTAS[facing];
    ctx.strokeStyle = isPlayer ? '#f7faff' : '#dde5ef';
    ctx.lineWidth = Math.max(2, Math.floor(TILE_SIZE / 20));
    ctx.beginPath();
    ctx.moveTo(centerX, bodyY + bodyH * 0.45);
    ctx.lineTo(centerX + delta.x * (TILE_SIZE * 0.16), bodyY + bodyH * 0.45 + delta.y * (TILE_SIZE * 0.16));
    ctx.stroke();
  }
}

function areEquipmentAnchorsEqual(
  left: EquippedEquipmentAnchor[] | undefined,
  right: EquippedEquipmentAnchor[] | undefined,
): boolean {
  const safeLeft = Array.isArray(left) ? left : [];
  const safeRight = Array.isArray(right) ? right : [];
  if (safeLeft.length !== safeRight.length) {
    return false;
  }
  for (let i = 0; i < safeLeft.length; i += 1) {
    if (safeLeft[i]?.itemId !== safeRight[i]?.itemId || safeLeft[i]?.slotIndex !== safeRight[i]?.slotIndex) {
      return false;
    }
  }
  return true;
}

function applyStatModifier(baseValue: number, flatDelta: number, percentDelta: number): number {
  const withFlat = baseValue + flatDelta;
  const withPercent = withFlat * (1 + percentDelta);
  return Math.max(1, Math.round(withPercent));
}

function buildMapRegistryFromInputs(
  mapInputs: WorldMapInput[],
  tileDefinitions: Record<string, TileDefinition>,
): Record<string, WorldMap> {
  const registry: Record<string, WorldMap> = {};
  for (const input of mapInputs) {
    if (!input || typeof input !== 'object' || typeof input.id !== 'string' || typeof input.name !== 'string') {
      continue;
    }
    try {
      const map = createMap(input, { tileDefinitions });
      registry[map.id] = map;
    } catch {
      continue;
    }
  }
  return registry;
}

function buildEncounterTableLookup(tables: EncounterTableDefinition[]): Record<string, EncounterTableDefinition> {
  const lookup: Record<string, EncounterTableDefinition> = {};
  for (const table of tables) {
    lookup[table.id] = table;
  }
  return lookup;
}

function buildItemLookup(items: GameItemDefinition[]): Record<string, GameItemDefinition> {
  return items.reduce<Record<string, GameItemDefinition>>((registry, item) => {
    registry[item.id] = item;
    return registry;
  }, {});
}

function buildShopLookup(shops: ShopDefinition[]): Record<string, ShopDefinition> {
  return shops.reduce<Record<string, ShopDefinition>>((registry, shop) => {
    registry[shop.id] = shop;
    return registry;
  }, {});
}

function describeItemEffect(item: GameItemDefinition): string {
  if (item.effectType === 'tool_action') {
    const effect = item.effectConfig as { actionId?: string };
    if (typeof effect.actionId === 'string' && effect.actionId.trim()) {
      return `Tool action: ${effect.actionId.trim()}`;
    }
    return 'Tool action';
  }
  if (item.effectType === 'equip_effect' || item.effectType === 'equip_stub') {
    const effect = item.effectConfig as { equipSize?: number; equipmentEffectIds?: string[] };
    const equipSize =
      typeof effect.equipSize === 'number' && Number.isFinite(effect.equipSize)
        ? Math.max(1, Math.floor(effect.equipSize))
        : 1;
    const effectCount = Array.isArray(effect.equipmentEffectIds) ? effect.equipmentEffectIds.length : 0;
    return effectCount > 0
      ? `Equipment (${equipSize} slot${equipSize === 1 ? '' : 's'}) • ${effectCount} effect${effectCount === 1 ? '' : 's'}`
      : `Equipment (${equipSize} slot${equipSize === 1 ? '' : 's'})`;
  }
  if (item.effectType === 'heal_flat') {
    const effect = item.effectConfig as { healAmount?: number };
    const amount = typeof effect.healAmount === 'number' && Number.isFinite(effect.healAmount)
      ? Math.max(1, Math.floor(effect.healAmount))
      : 20;
    return `Heals ${amount} HP`;
  }
  if (item.effectType === 'heal_percent') {
    const effect = item.effectConfig as { healPercent?: number };
    const percent = typeof effect.healPercent === 'number' && Number.isFinite(effect.healPercent)
      ? Math.max(1, Math.round(clamp(effect.healPercent, 0.01, 1) * 100))
      : 25;
    return `Heals ${percent}% HP`;
  }
  const effect = item.effectConfig as { actionId?: string };
  if (typeof effect.actionId === 'string' && effect.actionId.trim()) {
    return `Special: ${effect.actionId.trim()}`;
  }
  return 'Special item';
}

function sanitizeRuntimeIdentifier(raw: unknown): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function sanitizeRuntimeNpcSpriteLibrary(raw: unknown): NpcSpriteLibraryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const merged = new Map<string, NpcSpriteLibraryEntry>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : '';
    const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : id;
    const spriteRaw = record.sprite;
    if (!id || !spriteRaw || typeof spriteRaw !== 'object' || Array.isArray(spriteRaw)) {
      continue;
    }
    const spriteRecord = spriteRaw as Record<string, unknown>;
    const url = typeof spriteRecord.url === 'string' && spriteRecord.url.trim() ? spriteRecord.url.trim() : '';
    if (!url) {
      continue;
    }
    const facing = spriteRecord.facingFrames;
    if (!facing || typeof facing !== 'object' || Array.isArray(facing)) {
      continue;
    }
    const facingFramesRecord = facing as Record<string, unknown>;
    const facingFrames: Record<Direction, number> = {
      up: Number.isFinite(facingFramesRecord.up) ? Math.max(0, Math.floor(facingFramesRecord.up as number)) : 0,
      down: Number.isFinite(facingFramesRecord.down)
        ? Math.max(0, Math.floor(facingFramesRecord.down as number))
        : 0,
      left: Number.isFinite(facingFramesRecord.left)
        ? Math.max(0, Math.floor(facingFramesRecord.left as number))
        : 0,
      right: Number.isFinite(facingFramesRecord.right)
        ? Math.max(0, Math.floor(facingFramesRecord.right as number))
        : 0,
    };
    merged.set(id, {
      id,
      label: label || id,
      sprite: {
        ...(spriteRecord as unknown as NpcSpriteConfig),
        url,
        facingFrames,
      },
    });
  }

  return [...merged.values()];
}

function sanitizeRuntimeNpcCharacterLibrary(raw: unknown): NpcCharacterTemplateEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const merged = new Map<string, NpcCharacterTemplateEntry>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : '';
    const npcName = typeof record.npcName === 'string' && record.npcName.trim() ? record.npcName.trim() : '';
    if (!id || !npcName) {
      continue;
    }
    const storyStatesRaw = Array.isArray(record.storyStates) ? record.storyStates : [];
    const storyStates: NpcStoryStateDefinition[] = [];
    for (const stateEntry of storyStatesRaw) {
      if (!stateEntry || typeof stateEntry !== 'object' || Array.isArray(stateEntry)) {
        continue;
      }
      const stateRecord = stateEntry as Record<string, unknown>;
      const mapId = typeof stateRecord.mapId === 'string' && stateRecord.mapId.trim() ? stateRecord.mapId.trim() : undefined;
      const positionRecord =
        stateRecord.position && typeof stateRecord.position === 'object' && !Array.isArray(stateRecord.position)
          ? (stateRecord.position as Record<string, unknown>)
          : null;
      const position =
        positionRecord &&
        Number.isFinite(positionRecord.x) &&
        Number.isFinite(positionRecord.y)
          ? {
              x: Math.floor(positionRecord.x as number),
              y: Math.floor(positionRecord.y as number),
            }
          : undefined;
      if (!mapId || !position) {
        continue;
      }
      storyStates.push({
        ...(stateRecord as unknown as NpcStoryStateDefinition),
        mapId,
        position,
        requiresFlag:
          typeof stateRecord.requiresFlag === 'string' && stateRecord.requiresFlag.trim()
            ? stateRecord.requiresFlag.trim()
            : undefined,
        firstInteractionSetFlag:
          typeof stateRecord.firstInteractionSetFlag === 'string' && stateRecord.firstInteractionSetFlag.trim()
            ? stateRecord.firstInteractionSetFlag.trim()
            : undefined,
        firstInteractBattle:
          typeof stateRecord.firstInteractBattle === 'boolean' ? stateRecord.firstInteractBattle : undefined,
        interactBattleRepeatable:
          typeof stateRecord.interactBattleRepeatable === 'boolean' ? stateRecord.interactBattleRepeatable : undefined,
        interactBattleDefeatedFlag:
          typeof stateRecord.interactBattleDefeatedFlag === 'string' && stateRecord.interactBattleDefeatedFlag.trim()
            ? stateRecord.interactBattleDefeatedFlag.trim()
            : typeof stateRecord.postDefeatSetFlag === 'string' && stateRecord.postDefeatSetFlag.trim()
              ? stateRecord.postDefeatSetFlag.trim()
            : undefined,
        battleRewards: sanitizeRuntimeNpcItemRewards(stateRecord.battleRewards),
        healer: typeof stateRecord.healer === 'boolean' ? stateRecord.healer : undefined,
        shopId:
          typeof stateRecord.shopId === 'string' && stateRecord.shopId.trim()
            ? sanitizeRuntimeIdentifier(stateRecord.shopId)
            : undefined,
        interactionRewards: sanitizeRuntimeNpcItemRewards(stateRecord.interactionRewards),
        interactionRewardSetFlag:
          typeof stateRecord.interactionRewardSetFlag === 'string' && stateRecord.interactionRewardSetFlag.trim()
            ? stateRecord.interactionRewardSetFlag.trim()
            : undefined,
        dialogueLines: Array.isArray(stateRecord.dialogueLines)
          ? stateRecord.dialogueLines.filter((line): line is string => typeof line === 'string')
          : undefined,
        battleTeamIds: Array.isArray(stateRecord.battleTeamIds)
          ? stateRecord.battleTeamIds
              .filter((team): team is string => typeof team === 'string' && team.trim().length > 0)
              .map((team) => team.trim())
          : undefined,
        movementGuards: sanitizeRuntimeNpcMovementGuards(stateRecord.movementGuards),
        interactionScript: sanitizeRuntimeNpcInteractionScript(stateRecord.interactionScript),
      });
    }
    merged.set(id, {
      ...(record as unknown as NpcCharacterTemplateEntry),
      id,
      npcName,
      label: typeof record.label === 'string' && record.label.trim() ? record.label.trim() : npcName,
      firstInteractionSetFlag:
        typeof record.firstInteractionSetFlag === 'string' && record.firstInteractionSetFlag.trim()
          ? record.firstInteractionSetFlag.trim()
          : undefined,
      firstInteractBattle: typeof record.firstInteractBattle === 'boolean' ? record.firstInteractBattle : undefined,
      interactBattleRepeatable:
        typeof record.interactBattleRepeatable === 'boolean' ? record.interactBattleRepeatable : undefined,
      interactBattleDefeatedFlag:
        typeof record.interactBattleDefeatedFlag === 'string' && record.interactBattleDefeatedFlag.trim()
          ? record.interactBattleDefeatedFlag.trim()
          : typeof record.postDefeatSetFlag === 'string' && record.postDefeatSetFlag.trim()
            ? record.postDefeatSetFlag.trim()
          : undefined,
      battleRewards: sanitizeRuntimeNpcItemRewards(record.battleRewards),
      healer: typeof record.healer === 'boolean' ? record.healer : undefined,
      shopId:
        typeof record.shopId === 'string' && record.shopId.trim() ? sanitizeRuntimeIdentifier(record.shopId) : undefined,
      interactionRewards: sanitizeRuntimeNpcItemRewards(record.interactionRewards),
      interactionRewardSetFlag:
        typeof record.interactionRewardSetFlag === 'string' && record.interactionRewardSetFlag.trim()
          ? record.interactionRewardSetFlag.trim()
          : undefined,
      battleTeamIds: Array.isArray(record.battleTeamIds)
        ? record.battleTeamIds
            .filter((team): team is string => typeof team === 'string' && team.trim().length > 0)
            .map((team) => team.trim())
        : undefined,
      movementGuards: sanitizeRuntimeNpcMovementGuards(record.movementGuards),
      interactionScript: sanitizeRuntimeNpcInteractionScript(record.interactionScript),
      storyStates,
    });
  }

  return normalizeCoreStoryNpcCharacters([...merged.values()]);
}

function sanitizeRuntimeNpcMovementGuards(raw: unknown): NpcMovementGuardDefinition[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const guards: NpcMovementGuardDefinition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const hasTarget =
      (typeof record.x === 'number' && Number.isFinite(record.x)) ||
      (typeof record.y === 'number' && Number.isFinite(record.y)) ||
      (typeof record.minX === 'number' && Number.isFinite(record.minX)) ||
      (typeof record.maxX === 'number' && Number.isFinite(record.maxX)) ||
      (typeof record.minY === 'number' && Number.isFinite(record.minY)) ||
      (typeof record.maxY === 'number' && Number.isFinite(record.maxY));
    if (!hasTarget) {
      continue;
    }
    guards.push({
      id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : undefined,
      requiresFlag:
        typeof record.requiresFlag === 'string' && record.requiresFlag.trim() ? record.requiresFlag.trim() : undefined,
      hideIfFlag:
        typeof record.hideIfFlag === 'string' && record.hideIfFlag.trim() ? record.hideIfFlag.trim() : undefined,
      x: typeof record.x === 'number' && Number.isFinite(record.x) ? Math.floor(record.x) : undefined,
      y: typeof record.y === 'number' && Number.isFinite(record.y) ? Math.floor(record.y) : undefined,
      minX: typeof record.minX === 'number' && Number.isFinite(record.minX) ? Math.floor(record.minX) : undefined,
      maxX: typeof record.maxX === 'number' && Number.isFinite(record.maxX) ? Math.floor(record.maxX) : undefined,
      minY: typeof record.minY === 'number' && Number.isFinite(record.minY) ? Math.floor(record.minY) : undefined,
      maxY: typeof record.maxY === 'number' && Number.isFinite(record.maxY) ? Math.floor(record.maxY) : undefined,
      dialogueSpeaker:
        typeof record.dialogueSpeaker === 'string' && record.dialogueSpeaker.trim()
          ? record.dialogueSpeaker.trim()
          : undefined,
      dialogueLines: Array.isArray(record.dialogueLines)
        ? record.dialogueLines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
        : undefined,
      setFlag: typeof record.setFlag === 'string' && record.setFlag.trim() ? record.setFlag.trim() : undefined,
      defeatedFlag:
        typeof record.defeatedFlag === 'string' && record.defeatedFlag.trim()
          ? record.defeatedFlag.trim()
          : typeof record.postDefeatSetFlag === 'string' && record.postDefeatSetFlag.trim()
            ? record.postDefeatSetFlag.trim()
          : undefined,
      battleTeamIds: Array.isArray(record.battleTeamIds)
        ? record.battleTeamIds
            .filter((teamId): teamId is string => typeof teamId === 'string' && teamId.trim().length > 0)
            .map((teamId) => teamId.trim())
        : undefined,
      battleRewards: sanitizeRuntimeNpcItemRewards(record.battleRewards),
      battleRepeatable: typeof record.battleRepeatable === 'boolean' ? record.battleRepeatable : undefined,
      postDuelDialogueSpeaker:
        typeof record.postDuelDialogueSpeaker === 'string' && record.postDuelDialogueSpeaker.trim()
          ? record.postDuelDialogueSpeaker.trim()
          : undefined,
      postDuelDialogueLines: Array.isArray(record.postDuelDialogueLines)
        ? record.postDuelDialogueLines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
        : undefined,
    });
  }
  return guards.length > 0 ? guards : undefined;
}

function sanitizeRuntimeNpcItemRewards(raw: unknown): NpcItemRewardDefinition[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const rewards: NpcItemRewardDefinition[] = [];
  const merged = new Map<string, number>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const itemId = typeof record.itemId === 'string' ? record.itemId.trim() : '';
    const quantity =
      typeof record.quantity === 'number' && Number.isFinite(record.quantity)
        ? Math.max(0, Math.floor(record.quantity))
        : 0;
    if (!itemId || quantity <= 0) {
      continue;
    }
    merged.set(itemId, (merged.get(itemId) ?? 0) + quantity);
  }
  for (const [itemId, quantity] of merged.entries()) {
    rewards.push({ itemId, quantity });
  }
  return rewards.length > 0 ? rewards : undefined;
}

function sanitizeRuntimeNpcInteractionScript(raw: unknown): NpcInteractionActionDefinition[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const actions: NpcInteractionActionDefinition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type.trim() : '';
    if (type === 'dialogue') {
      const lines = Array.isArray(record.lines)
        ? record.lines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
        : [];
      if (lines.length === 0) {
        continue;
      }
      actions.push({
        type: 'dialogue',
        speaker: typeof record.speaker === 'string' && record.speaker.trim() ? record.speaker.trim() : undefined,
        lines,
        setFlag: typeof record.setFlag === 'string' && record.setFlag.trim() ? record.setFlag.trim() : undefined,
      });
      continue;
    }
    if (type === 'set_flag') {
      const flag = typeof record.flag === 'string' ? record.flag.trim() : '';
      if (!flag) {
        continue;
      }
      actions.push({
        type: 'set_flag',
        flag,
      });
      continue;
    }
    if (type === 'move_to_player') {
      actions.push({ type: 'move_to_player' });
      continue;
    }
    if (type === 'face_player') {
      actions.push({ type: 'face_player' });
      continue;
    }
    if (type === 'wait') {
      const durationMsRaw = typeof record.durationMs === 'number' ? record.durationMs : 0;
      actions.push({
        type: 'wait',
        durationMs: Math.max(0, Math.min(60000, Math.floor(durationMsRaw))),
      });
      continue;
    }
    if (type === 'move_path') {
      const directions = Array.isArray(record.directions)
        ? record.directions.filter((direction): direction is Direction => isDirection(direction))
        : [];
      if (directions.length === 0) {
        continue;
      }
      actions.push({
        type: 'move_path',
        directions,
      });
      continue;
    }
    if (type === 'give_item') {
      const itemId = typeof record.itemId === 'string' ? record.itemId.trim() : '';
      const quantity =
        typeof record.quantity === 'number' && Number.isFinite(record.quantity)
          ? Math.max(0, Math.floor(record.quantity))
          : 0;
      if (!itemId || quantity <= 0) {
        continue;
      }
      actions.push({
        type: 'give_item',
        itemId,
        quantity,
        setFlag: typeof record.setFlag === 'string' && record.setFlag.trim() ? record.setFlag.trim() : undefined,
        message: typeof record.message === 'string' && record.message.trim() ? record.message.trim() : undefined,
      });
      continue;
    }
  }
  return actions.length > 0 ? actions : undefined;
}

function sampleEncounterEntry(
  entries: EncounterTableDefinition['entries'],
): EncounterTableDefinition['entries'][number] | null {
  if (entries.length === 0) {
    return null;
  }
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return entries[0] ?? null;
  }

  let roll = Math.random() * totalWeight;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) {
      return entry;
    }
  }
  return entries[entries.length - 1] ?? null;
}

function isCritterEncounterEntry(entry: EncounterTableEntry | null | undefined): entry is EncounterTableCritterEntry {
  return Boolean(entry && entry.kind === 'critter');
}

function extractSupabasePublicRoot(rawUrl: string): string | null {
  const marker = '/storage/v1/object/public/';
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }
    parsed.pathname = parsed.pathname.substring(0, markerIndex) + marker.slice(0, -1);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function buildTileDefinitionsFromSavedPaintTiles(
  savedPaintTiles: Array<{
    name?: string;
    ySortWithActors?: boolean;
    tilesetUrl?: string;
    tilePixelWidth?: number;
    tilePixelHeight?: number;
    cells?: Array<{ code?: string; atlasIndex?: number }>;
  }> | null | undefined,
): Record<string, TileDefinition> {
  if (!Array.isArray(savedPaintTiles)) {
    return {};
  }

  const definitions: Record<string, TileDefinition> = {};

  for (const tile of savedPaintTiles) {
    const tileName = typeof tile?.name === 'string' && tile.name.trim() ? tile.name.trim() : 'Custom Tile';
    const ySortWithActors = typeof tile?.ySortWithActors === 'boolean' ? tile.ySortWithActors : undefined;
    const tilesetUrl = typeof tile?.tilesetUrl === 'string' && tile.tilesetUrl.trim() ? tile.tilesetUrl.trim() : undefined;
    const tilePixelWidth = typeof tile?.tilePixelWidth === 'number' && Number.isFinite(tile.tilePixelWidth) ? Math.max(1, Math.floor(tile.tilePixelWidth)) : undefined;
    const tilePixelHeight = typeof tile?.tilePixelHeight === 'number' && Number.isFinite(tile.tilePixelHeight) ? Math.max(1, Math.floor(tile.tilePixelHeight)) : undefined;
    const cells = Array.isArray(tile?.cells) ? tile.cells : [];
    const hasPerTileTileset = Boolean(tilesetUrl && tilePixelWidth && tilePixelHeight);

    for (const cell of cells) {
      const code = typeof cell?.code === 'string' ? cell.code.trim().slice(0, 1) : '';
      if (!code || code in BASE_TILE_DEFINITIONS) {
        continue;
      }
      const atlasIndex =
        typeof cell?.atlasIndex === 'number' && Number.isFinite(cell.atlasIndex) ? Math.max(0, Math.floor(cell.atlasIndex)) : 0;

      const existing = definitions[code];
      const existingHasTileset = Boolean(existing?.tilesetUrl && existing?.tilePixelWidth && existing?.tilePixelHeight);
      if (existing && !hasPerTileTileset && existingHasTileset) {
        continue;
      }
      if (existing && hasPerTileTileset === existingHasTileset) {
        continue;
      }

      definitions[code] = {
        code,
        label: `${tileName} ${code}`.slice(0, 60),
        walkable: true,
        color: colorForCode(code, 0),
        accentColor: colorForCode(code, 1),
        height: 0,
        atlasIndex,
        ySortWithActors,
        ...(tilesetUrl !== undefined && { tilesetUrl }),
        ...(tilePixelWidth !== undefined && { tilePixelWidth }),
        ...(tilePixelHeight !== undefined && { tilePixelHeight }),
      };
    }
  }

  return definitions;
}

function colorForCode(code: string, shift = 0): string {
  const safe = code || 'X';
  const value = safe.codePointAt(0) ?? 88;
  const hue = (value * 17 + shift * 13) % 360;
  const saturation = 45 + ((value + shift * 7) % 20);
  const lightness = 38 + ((value + shift * 5) % 16);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function cloneSideStoryMissionTracking(
  missions: SaveProfile['progressTracking']['sideStory']['missions'],
): SaveProfile['progressTracking']['sideStory']['missions'] {
  const cloned: SaveProfile['progressTracking']['sideStory']['missions'] = {};
  for (const [missionId, progress] of Object.entries(missions)) {
    cloned[missionId] = {
      ...progress,
    };
  }
  return cloned;
}

function toDirection(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    default:
      return null;
  }
}

function toDirectionFromDelta(deltaX: number, deltaY: number): Direction | null {
  if (deltaX === 1 && deltaY === 0) {
    return 'right';
  }
  if (deltaX === -1 && deltaY === 0) {
    return 'left';
  }
  if (deltaX === 0 && deltaY === 1) {
    return 'down';
  }
  if (deltaX === 0 && deltaY === -1) {
    return 'up';
  }
  return null;
}

function isInteractKey(key: string): boolean {
  return key === ' ';
}

function randomBattleTransitionEffect(): BattleTransitionEffect {
  const effects: BattleTransitionEffect[] = ['scanline', 'radial-burst', 'shutter-slice'];
  return effects[Math.floor(Math.random() * effects.length)];
}

function randomInt(min: number, max: number): number {
  const safeMin = Math.ceil(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function randomNumber(min: number, max: number): number {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  return safeMin + Math.random() * (safeMax - safeMin);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeTileTransformValue(value: number): number {
  const intValue = Number.isFinite(value) ? Math.floor(Math.abs(value)) : 0;
  return intValue % 8;
}

function decodeTileTransform(value: number): { rotationQuarter: number; mirrorHorizontal: boolean } {
  const normalized = sanitizeTileTransformValue(value);
  return {
    rotationQuarter: normalized % 4,
    mirrorHorizontal: normalized >= 4,
  };
}

function oppositeDirection(direction: Direction): Direction {
  switch (direction) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    default:
      return 'down';
  }
}

function randomDifferentDirection(previous: Direction): Direction {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  const candidates = directions.filter((direction) => direction !== previous);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function randomDirection(): Direction {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  return directions[Math.floor(Math.random() * directions.length)];
}

function shuffleDirections(): Direction[] {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  for (let index = directions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = directions[index];
    directions[index] = directions[swapIndex];
    directions[swapIndex] = current;
  }
  return directions;
}

function isDirection(value: string): value is Direction {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}

function clampNpcStepInterval(value: number | undefined): number {
  const fallback = 850;
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value as number));
}

function randomTurnDelay(): number {
  return 900 + Math.random() * 2200;
}

function isCoreStoryNpcName(value: string | undefined): boolean {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'uncle hank' || normalized === 'jacob';
}

function shadeColor(hex: string, percent: number): string {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);

  if (Number.isNaN(value)) {
    return hex;
  }

  const amount = Math.round((255 * percent) / 100);
  const r = clampByte((value >> 16) + amount);
  const g = clampByte(((value >> 8) & 0x00ff) + amount);
  const b = clampByte((value & 0x0000ff) + amount);

  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}
