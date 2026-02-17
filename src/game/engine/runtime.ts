import { DIALOGUES } from '@/game/data/dialogues';
import { AUTOSAVE_INTERVAL_MS, MOVE_DURATION_MS, TILE_SIZE, WARP_COOLDOWN_MS } from '@/shared/constants';
import type { Direction, Vector2 } from '@/shared/types';
import { SAVE_VERSION, createNewSave, loadSave, persistSave } from '@/game/saves/saveManager';
import type { SaveProfile } from '@/game/saves/types';
import { BASE_CRITTER_DATABASE } from '@/game/critters/baseDatabase';
import {
  buildCritterLookup,
  computeCritterDerivedProgress,
  createDefaultPlayerCritterProgress,
  missionProgressKey,
  sanitizeCritterDatabase,
  sanitizePlayerCritterProgress,
} from '@/game/critters/schema';
import {
  MAX_SQUAD_SLOTS,
  type CritterDefinition,
  type CritterLevelMissionRequirement,
  type PlayerCritterProgress,
} from '@/game/critters/types';
import { sanitizeEncounterTableLibrary } from '@/game/encounters/schema';
import type { EncounterTableDefinition } from '@/game/encounters/types';
import { collisionEdgeMaskAt, createMap, tileAt } from '@/game/world/mapBuilder';
import { CUSTOM_TILESET_CONFIG, type CustomTilesetConfig } from '@/game/world/customTiles';
import { PLAYER_SPRITE_CONFIG } from '@/game/world/playerSprite';
import { BASE_TILE_DEFINITIONS, BLANK_TILE_CODE, FALLBACK_TILE_CODE, TILE_DEFINITIONS } from '@/game/world/tiles';
import type {
  InteractionDefinition,
  NpcDefinition,
  NpcSpriteConfig,
  TileDefinition,
  WorldMapInput,
  WarpDefinition,
  WorldMap,
} from '@/game/world/types';
import { readStoredWorldContent } from '@/game/content/worldContentStore';

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
}

interface TransientMessage {
  text: string;
  remainingMs: number;
}

interface NpcRuntimeState {
  position: Vector2;
  facing: Direction;
  turnTimerMs: number;
  moveStep: MoveStep | null;
  moveCooldownMs: number;
  patternIndex: number;
  animationMs: number;
}

interface NpcSpriteSheetState {
  status: 'loading' | 'ready' | 'error';
  image: HTMLImageElement | null;
  columns: number;
}

type BattleTransitionEffect = 'scanline' | 'radial-burst' | 'shutter-slice';
type BattlePhase = 'transition' | 'choose-starter' | 'player-turn' | 'choose-swap' | 'result';
type BattleResult = 'ongoing' | 'won' | 'lost' | 'escaped';
type BattleSourceType = 'wild' | 'npc';

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
}

interface BattleSourceState {
  type: BattleSourceType;
  mapId: string;
  label: string;
  groupId?: string;
  npcId?: string;
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
  pendingForcedSwap: boolean;
  narrationQueue: BattleNarrationEvent[];
  activeNarration: BattleNarrationEvent | null;
  activeAnimation: BattleAnimationState | null;
  nextAnimationToken: number;
}

interface BattleNarrationEvent {
  message: string;
  attacker: 'player' | 'opponent' | null;
}

interface BattleAnimationState {
  attacker: 'player' | 'opponent';
  remainingMs: number;
  durationMs: number;
  token: number;
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
  }>;
  canAttack: boolean;
  canGuard: boolean;
  canSwap: boolean;
  canRetreat: boolean;
  canCancelSwap: boolean;
  canAdvanceNarration: boolean;
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
  critters: {
    unlockedCount: number;
    totalCount: number;
    unlockedSquadSlots: number;
    maxSquadSlots: number;
    squadSlots: Array<{
      index: number;
      unlocked: boolean;
      critterId: number | null;
      critterName: string | null;
      level: number | null;
      currentHp: number | null;
      maxHp: number | null;
    }>;
    collection: Array<{
      critterId: number;
      name: string;
      element: string;
      rarity: string;
      spriteUrl: string;
      unlocked: boolean;
      level: number;
      maxLevel: number;
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
        }>;
      } | null;
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

export class GameRuntime {
  private mapRegistry: Record<string, WorldMap> = buildMapRegistryFromInputs([SPAWN_MAP_INPUT], TILE_DEFINITIONS);
  private tileDefinitions: Record<string, TileDefinition> = TILE_DEFINITIONS;
  private critterDatabase: CritterDefinition[] = [...BASE_CRITTER_DATABASE];
  private critterLookup: Record<number, CritterDefinition> = buildCritterLookup(BASE_CRITTER_DATABASE);
  private encounterTables: EncounterTableDefinition[] = [];
  private encounterTableLookup: Record<string, EncounterTableDefinition> = {};
  private customTilesetConfig: CustomTilesetConfig | null = CUSTOM_TILESET_CONFIG;
  private playerSpriteConfig: NpcSpriteConfig = PLAYER_SPRITE_CONFIG;
  private currentMapId: string;
  private playerPosition: Vector2;
  private facing: Direction;
  private moveStep: MoveStep | null = null;
  private heldDirections: Direction[] = [];
  private dialogue: DialogueState | null = null;
  private flags: Record<string, boolean>;
  private mainStoryStageId: string | null = null;
  private sideStoryStageId: string | null = null;
  private sideStoryFlags: Record<string, boolean> = {};
  private sideStoryMissions: SaveProfile['progressTracking']['sideStory']['missions'] = {};
  private playerName: string;
  private selectedStarterId: string | null;
  private playerCritterProgress: PlayerCritterProgress = createDefaultPlayerCritterProgress();
  private playerAnimationMs = 0;
  private warpCooldownMs = 0;
  private autosaveMs = AUTOSAVE_INTERVAL_MS;
  private dirty = false;
  private lastSavedAt: string | null = null;
  private transientMessage: TransientMessage | null = null;
  private lastEncounter: RuntimeSnapshot['lastEncounter'] = null;
  private activeBattle: BattleRuntimeState | null = null;
  private nextBattleId = 1;
  private warpHintLabel: string | null = null;
  private npcRuntimeStates: Record<string, NpcRuntimeState> = {};
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
  private tilesetLoadAttempted = false;
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
      this.customTilesetConfig = storedWorldContent.customTilesetConfig ?? CUSTOM_TILESET_CONFIG;
      this.playerSpriteConfig = storedWorldContent.playerSpriteConfig ?? PLAYER_SPRITE_CONFIG;

      const registry = buildMapRegistryFromInputs(storedWorldContent.maps, this.tileDefinitions);
      if (Object.keys(registry).length > 0) {
        this.mapRegistry = registry;
      }
    }

    const save = !options?.forceNewGame ? loadSave() : null;
    const hasUsableSave = Boolean(save && this.isValidSave(save));
    const state = hasUsableSave ? (save as SaveProfile) : createNewSave(options?.playerName ?? 'Player');

    this.currentMapId = state.currentMapId;
    this.playerPosition = { x: state.player.x, y: state.player.y };
    this.facing = state.player.facing;
    this.flags = { ...state.progressTracking.mainStory.flags };
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
    if (this.ensureMinimumSquadCritterAssignment()) {
      this.dirty = true;
    }
    this.lastSavedAt = state.updatedAt;
    this.ensureNpcRuntimeState();
    this.ensurePlayerSpriteLoaded();
    this.ensureTilesetLoaded();
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
    const direction = toDirection(key);
    if (!direction) {
      return;
    }

    this.heldDirections = this.heldDirections.filter((held) => held !== direction);
  }

  public update(deltaMs: number): void {
    this.playerAnimationMs += deltaMs;
    this.tickMessage(deltaMs);

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
        this.moveStep = null;
        const previousMapId = this.currentMapId;
        this.checkAutomaticWarp();
        if (!this.dialogue && this.currentMapId === previousMapId) {
          this.tryTriggerWalkEncounter();
        }
        this.markDirty();
      }
    } else if (!this.dialogue) {
      this.tryMovementFromInput();
    }

    this.tickAutosave(deltaMs);
    this.updateWarpHint();
    this.maybeShowCritterAdvanceNotice();
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const map = this.getCurrentMap();
    const playerRenderPos = this.getPlayerRenderPosition();

    const viewTilesX = width / TILE_SIZE;
    const viewTilesY = height / TILE_SIZE;

    const cameraX =
      map.width <= viewTilesX
        ? -(viewTilesX - map.width) / 2
        : playerRenderPos.x - viewTilesX / 2;
    const cameraY =
      map.height <= viewTilesY
        ? -(viewTilesY - map.height) / 2
        : playerRenderPos.y - viewTilesY / 2;

    ctx.fillStyle = '#101419';
    ctx.fillRect(0, 0, width, height);

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
          const rotationQuarter = sanitizeRotationQuarter(rotationRow[x] ?? 0);

          // Draw atlas first so transparent pixels on higher layers reveal lower layers.
          // Only use color fallback when atlas art is unavailable for this tile.
          const isOverhead = this.shouldDepthSortTile(layer.orderId, tile);
          if (!isOverhead) {
            const drewAtlas = this.drawTileFromTileset(ctx, tile, screenX, screenY, rotationQuarter);
            if (!drewAtlas) {
              this.drawTile(ctx, tile.color, tile.accentColor ?? tile.color, screenX, screenY, tile.height);
            }
          } else {
            depthDraws.push({
              depthY: y + 1,
              layerOrder: layer.orderId,
              kind: 'overlay',
              draw: () => {
                const drewOverlayAtlas = this.drawTileFromTileset(ctx, tile, screenX, screenY, rotationQuarter);
                if (!drewOverlayAtlas) {
                  this.drawTile(ctx, tile.color, tile.accentColor ?? tile.color, screenX, screenY, tile.height);
                }
              },
            });
          }
        }
      }
    }

    for (const npc of map.npcs) {
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

  public getSnapshot(): RuntimeSnapshot {
    const map = this.getCurrentMap();
    const critterSummary = this.getCritterSummary();

    return {
      playerName: this.playerName,
      mapName: map.name,
      mapId: map.id,
      objective: this.getObjectiveText(),
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
      critters: critterSummary,
    };
  }

  public renderGameToText(): string {
    const map = this.getCurrentMap();
    const playerRenderPosition = this.getPlayerRenderPosition();
    const facingTile = this.getFacingTile();
    const facingTileCode = tileAt(map, facingTile.x, facingTile.y);
    const critterSummary = this.getCritterSummary();

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
      flags: activeFlags,
      npcs: map.npcs.map((npc) => ({
        id: npc.id,
        name: npc.name,
        x: this.getNpcRenderPosition(npc).x,
        y: this.getNpcRenderPosition(npc).y,
        facing: this.getNpcRuntimeState(npc).facing,
        movementType: npc.movement?.type ?? 'static',
      })),
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
    };

    return JSON.stringify(payload);
  }

  public saveNow(): void {
    this.persistNow();
    this.showMessage('Progress Saved');
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
      const currentValue = this.getMissionCurrentValue(mission, levelRow.level, progress.missionProgress);
      return count + (currentValue >= mission.targetValue ? 1 : 0);
    }, 0);
    if (completedMissionCount < requiredMissionCount) {
      return false;
    }

    const nextLevel = Math.max(1, targetLevel);
    const previousMaxHp = Math.max(1, progress.effectiveStats.hp);
    const previousCurrentHp = clamp(progress.currentHp, 0, previousMaxHp);
    progress.unlocked = true;
    progress.level = nextLevel;
    progress.unlockedAt = progress.unlockedAt ?? new Date().toISOString();
    progress.unlockSource = progress.unlockSource ?? 'missions';
    progress.lastProgressAt = new Date().toISOString();
    const derived = computeCritterDerivedProgress(critter, nextLevel);
    progress.statBonus = derived.statBonus;
    progress.effectiveStats = derived.effectiveStats;
    const nextMaxHp = Math.max(1, derived.effectiveStats.hp);
    progress.currentHp = currentLevel === 0 ? nextMaxHp : clamp(previousCurrentHp, 0, nextMaxHp);
    progress.unlockedAbilityIds = derived.unlockedAbilityIds;
    const autoAssignedToSquad = currentLevel === 0 && this.tryAutoAssignFirstUnlockedCritter(critter.id);

    this.markProgressDirty();
    this.showMessage(
      currentLevel === 0
        ? `${critter.name} unlocked${autoAssignedToSquad ? ' and joined your squad!' : '!'}`
        : `${critter.name} reached Lv.${nextLevel}!`,
      5000,
    );
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

  public battleChooseAction(action: 'attack' | 'guard' | 'swap' | 'retreat'): boolean {
    const battle = this.activeBattle;
    if (!battle || battle.phase !== 'player-turn' || battle.result !== 'ongoing' || battle.activeNarration) {
      return false;
    }

    if (action === 'attack') {
      this.resolvePlayerTurnAction(battle, 'attack');
      return true;
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
    battle.playerActiveIndex = teamIndex;

    if (battle.phase === 'choose-starter') {
      battle.phase = 'player-turn';
      battle.logLine = `${selected.name}, I choose you!`;
      return true;
    }

    if (battle.pendingForcedSwap) {
      battle.pendingForcedSwap = false;
      battle.phase = 'player-turn';
      battle.logLine = `${selected.name} stepped in after the knockout.`;
      return true;
    }

    battle.phase = 'player-turn';
    battle.turnNumber += 1;
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
    if (!this.activeBattle || this.activeBattle.phase !== 'result' || this.activeBattle.activeNarration) {
      return false;
    }
    this.activeBattle = null;
    return true;
  }

  public battleAdvanceNarration(): boolean {
    const battle = this.activeBattle;
    if (!battle || !battle.activeNarration) {
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

  private getTileDefinition(code: string): TileDefinition {
    return this.tileDefinitions[code] ?? this.tileDefinitions[FALLBACK_TILE_CODE];
  }

  private shouldDepthSortTile(layerOrderId: number, tile: TileDefinition): boolean {
    if (typeof tile.ySortWithActors === 'boolean') {
      return tile.ySortWithActors;
    }
    if (layerOrderId > 1 && tile.height <= 0 && this.isFlatCoverTile(tile.label)) {
      return false;
    }
    return layerOrderId > 1 || tile.height > 0;
  }

  private isFlatCoverTile(label: string): boolean {
    const normalized = label.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return ['grass', 'flower', 'path', 'sand', 'water', 'floor', 'ground'].some((keyword) =>
      normalized.includes(keyword),
    );
  }

  private ensureTilesetLoaded(): void {
    if (this.tilesetLoadAttempted) {
      return;
    }

    this.tilesetLoadAttempted = true;
    const config = this.customTilesetConfig;
    if (!config || !config.url) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      const columns = Math.floor(image.width / config.tileWidth);
      if (columns <= 0) {
        return;
      }
      const rows = Math.floor(image.height / config.tileHeight);
      if (rows <= 0) {
        return;
      }

      this.tilesetImage = image;
      this.tilesetColumns = columns;
      this.tilesetRows = rows;
      this.tilesetCellCount = columns * rows;
    };
    image.onerror = () => {
      this.tilesetImage = null;
      this.tilesetColumns = 0;
      this.tilesetRows = 0;
      this.tilesetCellCount = 0;
    };
    image.src = config.url;
  }

  private drawTileFromTileset(
    ctx: CanvasRenderingContext2D,
    tile: TileDefinition,
    x: number,
    y: number,
    rotationQuarter = 0,
  ): boolean {
    if (!this.tilesetImage || !this.customTilesetConfig) {
      return false;
    }
    const config = this.customTilesetConfig;
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

    const column = tile.atlasIndex % this.tilesetColumns;
    const row = Math.floor(tile.atlasIndex / this.tilesetColumns);
    const sourceX = column * config.tileWidth;
    const sourceY = row * config.tileHeight;

    ctx.imageSmoothingEnabled = false;
    const rotation = sanitizeRotationQuarter(rotationQuarter);
    if (rotation === 0) {
      ctx.drawImage(
        this.tilesetImage,
        sourceX,
        sourceY,
        config.tileWidth,
        config.tileHeight,
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
    ctx.drawImage(
      this.tilesetImage,
      sourceX,
      sourceY,
      config.tileWidth,
      config.tileHeight,
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
    for (const npc of map.npcs) {
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
      this.playerSpriteSheet = {
        status: columns > 0 ? 'ready' : 'error',
        image: columns > 0 ? image : null,
        columns: Math.max(0, columns),
      };
    };
    image.onerror = () => {
      this.playerSpriteSheet = {
        status: 'error',
        image: null,
        columns: 0,
      };
    };
    image.src = sprite.url;
  }

  private ensureNpcSpriteLoaded(npc: NpcDefinition): void {
    const sprite = npc.sprite;
    if (!sprite?.url) {
      return;
    }

    const existing = this.npcSpriteSheets[sprite.url];
    if (existing) {
      return;
    }

    const image = new Image();
    this.npcSpriteSheets[sprite.url] = {
      status: 'loading',
      image: null,
      columns: 0,
    };

    image.onload = () => {
      const atlasCellWidth = Math.max(1, sprite.atlasCellWidth ?? sprite.frameWidth);
      const columns = Math.floor(image.width / atlasCellWidth);
      this.npcSpriteSheets[sprite.url] = {
        status: columns > 0 ? 'ready' : 'error',
        image: columns > 0 ? image : null,
        columns: Math.max(0, columns),
      };
    };
    image.onerror = () => {
      this.npcSpriteSheets[sprite.url] = {
        status: 'error',
        image: null,
        columns: 0,
      };
    };
    image.src = sprite.url;
  }

  private getNpcRuntimeState(npc: NpcDefinition): NpcRuntimeState {
    const key = this.getNpcStateKey(npc.id);
    const existing = this.npcRuntimeStates[key];
    if (existing) {
      return existing;
    }

    const created: NpcRuntimeState = {
      position: { ...npc.position },
      facing: 'down',
      turnTimerMs: randomTurnDelay(),
      moveStep: null,
      moveCooldownMs: clampNpcStepInterval(npc.movement?.stepIntervalMs),
      patternIndex: 0,
      animationMs: 0,
    };
    this.npcRuntimeStates[key] = created;
    return created;
  }

  private getNpcStateKey(npcId: string): string {
    return `${this.currentMapId}:${npcId}`;
  }

  private pushHeldDirection(direction: Direction): void {
    this.heldDirections = this.heldDirections.filter((held) => held !== direction);
    this.heldDirections.push(direction);
  }

  private updateNpcs(deltaMs: number): void {
    const map = this.getCurrentMap();
    this.ensureNpcRuntimeState();

    for (const npc of map.npcs) {
      const state = this.getNpcRuntimeState(npc);
      state.animationMs += deltaMs;
      this.ensureNpcSpriteLoaded(npc);

      if (state.moveStep) {
        state.moveStep.elapsed += deltaMs;
        if (state.moveStep.elapsed >= state.moveStep.duration) {
          state.position = { ...state.moveStep.to };
          state.moveStep = null;
        }
      }

      if (this.activeBattle || this.dialogue || state.moveStep) {
        continue;
      }

      const movementType = npc.movement?.type ?? 'static';
      if (movementType === 'static') {
        state.turnTimerMs -= deltaMs;
        if (state.turnTimerMs <= 0) {
          state.facing = randomDifferentDirection(state.facing);
          state.turnTimerMs = randomTurnDelay();
        }
        continue;
      }

      state.moveCooldownMs -= deltaMs;
      if (state.moveCooldownMs > 0) {
        continue;
      }

      if (movementType === 'loop') {
        const pattern = (npc.movement?.pattern ?? []).filter(isDirection);
        if (pattern.length === 0) {
          state.moveCooldownMs = clampNpcStepInterval(npc.movement?.stepIntervalMs);
          continue;
        }

        const direction = pattern[state.patternIndex % pattern.length];
        state.patternIndex = (state.patternIndex + 1) % pattern.length;
        this.tryNpcMove(npc, state, direction);
        continue;
      }

      const direction = randomDirection();
      this.tryNpcMove(npc, state, direction);
    }
  }

  private tryNpcMove(npc: NpcDefinition, state: NpcRuntimeState, direction: Direction): void {
    state.facing = direction;
    const delta = DIRECTION_DELTAS[direction];
    const target = {
      x: state.position.x + delta.x,
      y: state.position.y + delta.y,
    };
    if (this.canNpcStepTo(npc.id, state.position, target, direction)) {
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

    return !this.isNpcOccupyingTile(x, y);
  }

  private canNpcStepTo(npcId: string, from: Vector2, target: Vector2, direction: Direction): boolean {
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
    for (const npc of map.npcs) {
      if (npc.id === npcId) {
        continue;
      }
      const state = this.getNpcRuntimeState(npc);
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
    return map.npcs.some((npc) => {
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

    const interactWarp = this.findInteractWarpAtPlayer();
    if (interactWarp) {
      this.triggerWarp(interactWarp.warp, interactWarp.source);
      return;
    }

    const target = this.getFacingTile();
    const map = this.getCurrentMap();

    const npc = map.npcs.find((entry) => {
      const state = this.getNpcRuntimeState(entry);
      return state.position.x === target.x && state.position.y === target.y;
    });
    if (npc) {
      this.startNpcDialogue(npc);
      return;
    }

    const interaction = this.findInteractionAt(target.x, target.y);
    if (interaction) {
      this.startDialogue(interaction.speaker ?? 'Note', interaction.lines, interaction.setFlag);
      return;
    }

    if (tileAt(map, target.x, target.y) === 'D') {
      this.startDialogue('Door', ['It is locked.']);
    }
  }

  private startNpcDialogue(npc: NpcDefinition): void {
    const npcState = this.getNpcRuntimeState(npc);
    npcState.facing = oppositeDirection(this.facing);
    npcState.turnTimerMs = randomTurnDelay();

    if (npc.dialogueLines && npc.dialogueLines.length > 0) {
      this.startDialogue(npc.dialogueSpeaker ?? npc.name, npc.dialogueLines, npc.dialogueSetFlag);
      return;
    }

    const script = DIALOGUES[npc.dialogueId];
    if (!script) {
      this.startDialogue(npc.name, ['...']);
      return;
    }

    this.startDialogue(script.speaker, script.lines, script.setFlag);
  }

  private startDialogue(speaker: string, lines: string[], setFlag?: string): void {
    this.dialogue = {
      speaker,
      lines,
      index: 0,
      setFlag,
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

    this.dialogue = null;
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
    const critter = this.critterLookup[encounterEntry.critterId];
    if (!critter) {
      return;
    }

    this.startWildBattle(map.id, group.id, critter, encounterEntry);
  }

  private startWildBattle(
    mapId: string,
    groupId: string,
    critter: CritterDefinition,
    encounterEntry: EncounterTableDefinition['entries'][number] | null = null,
  ): void {
    const playerTeam = this.buildPlayerBattleTeam();
    if (playerTeam.length === 0) {
      this.showMessage('No squad critter is ready to battle.', 2200);
      return;
    }

    const encounterLevel = this.resolveEncounterLevel(critter, encounterEntry);
    const opponent = this.buildWildBattleCritter(critter, encounterLevel);
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
      opponentActiveIndex: 0,
      pendingForcedSwap: false,
      narrationQueue: [],
      activeNarration: null,
      activeAnimation: null,
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

    if (battle.phase !== 'transition') {
      return;
    }

    battle.transitionRemainingMs = Math.max(0, battle.transitionRemainingMs - deltaMs);
    if (battle.transitionRemainingMs > 0) {
      return;
    }

    battle.phase = 'choose-starter';
    battle.logLine = `${battle.source.label} appeared. Choose your lead critter.`;
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
      const maxHp = Math.max(1, effectiveStats.hp);
      const currentHp = clamp(progress.currentHp, 0, maxHp);
      if (currentHp <= 0) {
        continue;
      }
      team.push({
        slotIndex: index,
        critterId: critter.id,
        name: critter.name,
        element: critter.element,
        spriteUrl: critter.spriteUrl,
        level,
        maxHp,
        currentHp,
        attack: Math.max(1, effectiveStats.attack),
        defense: Math.max(1, effectiveStats.defense),
        speed: Math.max(1, effectiveStats.speed),
        fainted: false,
        knockoutProgressCounted: false,
      });
    }

    return team;
  }

  private resolveEncounterLevel(
    critter: CritterDefinition,
    encounterEntry: EncounterTableDefinition['entries'][number] | null,
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
    };
  }

  private resolvePlayerTurnAction(battle: BattleRuntimeState, action: 'attack' | 'guard'): void {
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
      const guardMessage = `Your ${player.name} took a defensive stance.`;
      narration.push({
        message: guardMessage,
        attacker: null,
      });
      const opponentAttack = this.executeBattleAttack(battle, 'opponent', true);
      if (opponentAttack.narration) {
        narration.push(opponentAttack.narration);
      }
      this.startBattleNarration(battle, narration);
      return;
    }

    const playerActsFirst = player.speed >= opponent.speed;
    if (playerActsFirst) {
      const playerAttack = this.executeBattleAttack(battle, 'player', false);
      if (playerAttack.narration) {
        narration.push(playerAttack.narration);
      }
      if (playerAttack.defenderFainted || battle.result !== 'ongoing' || battle.phase !== 'player-turn') {
        this.startBattleNarration(battle, narration);
        return;
      }

      const opponentAttack = this.executeBattleAttack(battle, 'opponent', false);
      if (opponentAttack.narration) {
        narration.push(opponentAttack.narration);
      }
      this.startBattleNarration(battle, narration);
      return;
    }

    const opponentAttack = this.executeBattleAttack(battle, 'opponent', false);
    if (opponentAttack.narration) {
      narration.push(opponentAttack.narration);
    }
    if (opponentAttack.defenderFainted || battle.result !== 'ongoing' || battle.phase !== 'player-turn') {
      this.startBattleNarration(battle, narration);
      return;
    }

    const playerAttack = this.executeBattleAttack(battle, 'player', false);
    if (playerAttack.narration) {
      narration.push(playerAttack.narration);
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
    const opponentAttack = this.executeBattleAttack(battle, 'opponent', false);
    if (opponentAttack.narration) {
      narration.push(opponentAttack.narration);
    }
    this.startBattleNarration(battle, narration);
  }

  private executeBattleAttack(
    battle: BattleRuntimeState,
    attackingTeam: 'player' | 'opponent',
    defenderGuarded: boolean,
  ): { narration: BattleNarrationEvent | null; defenderFainted: boolean } {
    const attacker = this.getActiveBattleCritter(battle, attackingTeam);
    const defender = this.getActiveBattleCritter(battle, attackingTeam === 'player' ? 'opponent' : 'player');
    if (!attacker || !defender || attacker.fainted) {
      return { narration: null, defenderFainted: false };
    }

    const basePower = Math.max(1, attacker.attack + Math.floor(attacker.level * 0.75));
    const defenseMitigation = Math.max(0, Math.floor(defender.defense * 0.62));
    const scaledPower = Math.max(1, basePower - defenseMitigation);
    const variance = randomNumber(0.85, 1.15);
    const guardedMultiplier = defenderGuarded ? 0.55 : 1;
    const damage = Math.max(1, Math.floor(scaledPower * variance * guardedMultiplier));

    defender.currentHp = Math.max(0, defender.currentHp - damage);
    defender.fainted = defender.currentHp <= 0;

    const guardSuffix = defenderGuarded ? ' Guard reduced the damage.' : '';
    let message = `${this.formatBattleAttackPrefix(battle, attackingTeam, attacker.name, defender.name)} dealt ${damage} damage.${guardSuffix}`;
    if (!defender.fainted) {
      return {
        narration: {
          message,
          attacker: attackingTeam,
        },
        defenderFainted: false,
      };
    }

    if (attackingTeam === 'player') {
      message = `${message} ${this.handleOpponentKnockout(battle)}`.trim();
    } else {
      message = `${message} ${this.handlePlayerKnockout(battle)}`.trim();
    }
    return {
      narration: {
        message,
        attacker: attackingTeam,
      },
      defenderFainted: true,
    };
  }

  private handleOpponentKnockout(battle: BattleRuntimeState): string {
    const defeatedIndex = battle.opponentActiveIndex;
    if (defeatedIndex === null) {
      return 'The opposing critter fainted.';
    }

    const defeated = battle.opponentTeam[defeatedIndex];
    if (!defeated) {
      return 'The opposing critter fainted.';
    }

    if (!defeated.knockoutProgressCounted) {
      this.recordOpposingKnockoutProgress(defeated.critterId);
      defeated.knockoutProgressCounted = true;
    }

    const nextIndex = this.findNextAliveTeamIndex(battle.opponentTeam, defeatedIndex);
    if (nextIndex < 0) {
      this.setBattleResult(battle, 'won', `The wild ${defeated.name} fainted. You won the battle!`);
      return battle.source.type === 'wild'
        ? `The wild ${defeated.name} fainted. You won the battle.`
        : `${battle.source.label}'s ${defeated.name} fainted. You won the battle.`;
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

  private setBattleResult(battle: BattleRuntimeState, result: BattleResult, message: string): void {
    battle.result = result;
    battle.phase = 'result';
    battle.pendingForcedSwap = false;
    battle.logLine = message;
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
      const maxHp = Math.max(1, progress.effectiveStats.hp);
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

  private getBattleSnapshot(): RuntimeBattleSnapshot | null {
    const battle = this.activeBattle;
    if (!battle) {
      return null;
    }

    const narrationActive = Boolean(battle.activeNarration);
    const canUseActions = battle.phase === 'player-turn' && battle.result === 'ongoing' && !narrationActive;
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
      playerTeam: battle.playerTeam.map((entry) => ({
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
      })),
      opponentTeam: battle.opponentTeam.map((entry) => ({
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
      })),
      canAttack: canUseActions,
      canGuard: canUseActions,
      canSwap: canUseActions && this.hasAvailableSwapTarget(battle),
      canRetreat: canUseActions && battle.source.type === 'wild',
      canCancelSwap: battle.phase === 'choose-swap' && !battle.pendingForcedSwap && !narrationActive,
      canAdvanceNarration: narrationActive,
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
    if (this.dialogue) {
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

  private recordOpposingKnockoutProgress(opposingCritterId: number): void {
    const opposingCritter = this.critterLookup[opposingCritterId];
    if (!opposingCritter) {
      return;
    }

    const nowIso = new Date().toISOString();
    let updatedAny = false;
    for (const critter of this.critterDatabase) {
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

      let updatedCritter = false;
      for (const mission of levelRow.missions) {
        if (mission.type !== 'opposing_knockouts') {
          continue;
        }
        if (!this.matchesOpposingKnockoutMission(mission, opposingCritterId, opposingCritter.element)) {
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
        const currentValue = this.getMissionCurrentValue(mission, levelRow.level, progress.missionProgress);
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

  private getCritterSummary(): RuntimeSnapshot['critters'] {
    const collectionById = this.playerCritterProgress.collection.reduce<
      Record<number, PlayerCritterProgress['collection'][number]>
    >((registry, entry) => {
      registry[entry.critterId] = entry;
      return registry;
    }, {});

    const collection = this.critterDatabase.map((critter) => {
      const progress = collectionById[critter.id] ?? null;
      const unlocked = Boolean(progress?.unlocked);
      const level = unlocked ? Math.max(1, progress?.level ?? 1) : 0;
      const derived = computeCritterDerivedProgress(critter, level);
      const maxLevel = Math.max(1, ...critter.levels.map((entry) => entry.level));
      const levelProgress = critter.levels.map((levelRow) => {
        const missions = levelRow.missions.map((mission) => {
          const currentValue = this.getMissionCurrentValue(mission, levelRow.level, progress?.missionProgress ?? {});
          const missionCompleted = currentValue >= mission.targetValue;
          const ascendsFromCritter = mission.ascendsFromCritterId
            ? this.critterLookup[mission.ascendsFromCritterId]
            : undefined;
          const knockoutCritterIds = Array.isArray(mission.knockoutCritterIds) ? mission.knockoutCritterIds : [];
          const knockoutCritterNames = knockoutCritterIds
            .map((critterId) => this.critterLookup[critterId]?.name ?? `#${critterId}`);
          const knockoutElements = Array.isArray(mission.knockoutElements) ? mission.knockoutElements : [];
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

      return {
        critterId: critter.id,
        name: critter.name,
        element: critter.element,
        rarity: critter.rarity,
        spriteUrl: critter.spriteUrl,
        unlocked,
        level,
        maxLevel,
        canAdvance,
        advanceActionLabel,
        missionCompletions: unlocked ? this.getCompletedMissionCount(critter, progress?.missionProgress ?? {}) : null,
        baseStats: { ...critter.baseStats },
        statBonus: progress?.statBonus ?? derived.statBonus,
        effectiveStats: progress?.effectiveStats ?? derived.effectiveStats,
        abilities: critter.abilities.map((ability) => ({
          id: ability.id,
          name: ability.name,
          kind: ability.kind,
          description: ability.description,
          unlocked: availableAbilityIds.has(ability.id),
        })),
        unlockedAbilityIds: progress?.unlockedAbilityIds ?? derived.unlockedAbilityIds,
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

    const squadSlots = this.playerCritterProgress.squad.map((critterId, index) => {
      const unlocked = index < this.playerCritterProgress.unlockedSquadSlots;
      const critter = critterId ? this.critterLookup[critterId] : undefined;
      const progress = critterId ? collectionById[critterId] : undefined;
      const maxHp = unlocked && progress?.unlocked ? Math.max(1, progress.effectiveStats.hp) : null;
      const currentHp =
        unlocked && progress?.unlocked && maxHp !== null
          ? clamp(progress.currentHp, 0, maxHp)
          : null;

      return {
        index,
        unlocked,
        critterId: unlocked ? critterId : null,
        critterName: unlocked && critter ? critter.name : null,
        level: unlocked && progress?.unlocked ? progress.level : null,
        currentHp,
        maxHp,
      };
    });

    return {
      unlockedCount: collection.filter((entry) => entry.unlocked).length,
      totalCount: this.critterDatabase.length,
      unlockedSquadSlots: this.playerCritterProgress.unlockedSquadSlots,
      maxSquadSlots: MAX_SQUAD_SLOTS,
      squadSlots,
      collection,
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
      playerCritterProgress: {
        ...this.playerCritterProgress,
        squad: [...this.playerCritterProgress.squad],
        collection: this.playerCritterProgress.collection.map((entry) => ({
          ...entry,
          missionProgress: { ...entry.missionProgress },
          statBonus: { ...entry.statBonus },
          effectiveStats: { ...entry.effectiveStats },
          unlockedAbilityIds: [...entry.unlockedAbilityIds],
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
        const currentValue = this.getMissionCurrentValue(mission, levelRow.level, progress);
        if (currentValue >= mission.targetValue) {
          completed += 1;
        }
      }
    }
    return completed;
  }

  private getMissionCurrentValue(
    mission: CritterLevelMissionRequirement,
    level: number,
    progress: Record<string, number>,
  ): number {
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
    if (!progress?.unlocked) {
      return false;
    }
    const maxHp = Math.max(1, progress.effectiveStats.hp);
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

  private markDirty(): void {
    this.dirty = true;
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

  private getObjectiveText(): string {
    if (!this.flags.talked_to_brother) {
      return 'Talk to Eli before leaving home.';
    }

    if (!this.flags.met_rival_parent) {
      return 'Visit Kira\'s house to meet Aunt Mara.';
    }

    if (!this.flags.inspected_starter_crate) {
      return 'Inspect the starter basket inside Kira\'s house.';
    }

    return 'Head north when you are ready to begin Route 1.';
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
      const sheet = this.npcSpriteSheets[sprite.url];
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
    const frameIndex = this.getSpriteFrameIndex(this.playerSpriteConfig, facing, isMoving, this.playerAnimationMs);
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
    return this.getSpriteFrameIndex(sprite, facing, isMoving, state.animationMs, {
      idleAnimationName: npc.idleAnimation,
      moveAnimationName: npc.moveAnimation,
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
    },
  ): number {
    const requestedIdleAnimation = options?.idleAnimationName?.trim();
    const requestedMoveAnimation = options?.moveAnimationName?.trim();
    const idleAnimationName = requestedIdleAnimation || sprite.defaultIdleAnimation?.trim() || 'idle';
    const moveAnimationName = requestedMoveAnimation || sprite.defaultMoveAnimation?.trim() || 'walk';

    if (isMoving) {
      const moveFramesFromSet = this.getDirectionalAnimationFrames(sprite.animationSets, moveAnimationName, facing);
      if (moveFramesFromSet.length > 0) {
        const frame = moveFramesFromSet[Math.floor(animationMs / 140) % moveFramesFromSet.length];
        if (Number.isFinite(frame) && frame >= 0) {
          return Math.floor(frame);
        }
      }
    }

    const idleFramesFromSet = this.getDirectionalAnimationFrames(sprite.animationSets, idleAnimationName, facing);
    if (idleFramesFromSet.length > 0) {
      const frame = idleFramesFromSet[0];
      if (Number.isFinite(frame) && frame >= 0) {
        return Math.floor(frame);
      }
    }

    if (isMoving) {
      const walkFrames = sprite.walkFrames?.[facing];
      if (Array.isArray(walkFrames) && walkFrames.length > 0) {
        const frame = walkFrames[Math.floor(animationMs / 140) % walkFrames.length];
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

    const set = animationSets[animationName];
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

function buildTileDefinitionsFromSavedPaintTiles(
  savedPaintTiles: Array<{
    name?: string;
    ySortWithActors?: boolean;
    cells?: Array<{ code?: string; atlasIndex?: number }>;
  }> | null | undefined,
): Record<string, TileDefinition> {
  if (!Array.isArray(savedPaintTiles)) {
    return {};
  }

  const definitions: Record<string, TileDefinition> = {};
  const seenCodes = new Set<string>();

  for (const tile of savedPaintTiles) {
    const tileName = typeof tile?.name === 'string' && tile.name.trim() ? tile.name.trim() : 'Custom Tile';
    const ySortWithActors = typeof tile?.ySortWithActors === 'boolean' ? tile.ySortWithActors : undefined;
    const cells = Array.isArray(tile?.cells) ? tile.cells : [];
    for (const cell of cells) {
      const code = typeof cell?.code === 'string' ? cell.code.trim().slice(0, 1) : '';
      if (!code || code in BASE_TILE_DEFINITIONS || seenCodes.has(code)) {
        continue;
      }
      const atlasIndex =
        typeof cell?.atlasIndex === 'number' && Number.isFinite(cell.atlasIndex) ? Math.max(0, Math.floor(cell.atlasIndex)) : 0;

      seenCodes.add(code);
      definitions[code] = {
        code,
        label: `${tileName} ${code}`.slice(0, 60),
        walkable: true,
        color: colorForCode(code, 0),
        accentColor: colorForCode(code, 1),
        height: 0,
        atlasIndex,
        ySortWithActors,
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeRotationQuarter(value: number): number {
  const intValue = Number.isFinite(value) ? Math.floor(Math.abs(value)) : 0;
  return intValue % 4;
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

function isDirection(value: string): value is Direction {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}

function clampNpcStepInterval(value: number | undefined): number {
  const fallback = 850;
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return clamp(Math.floor(value as number), 180, 4000);
}

function randomTurnDelay(): number {
  return 900 + Math.random() * 2200;
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
