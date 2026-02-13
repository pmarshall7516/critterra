import { DIALOGUES } from '@/game/data/dialogues';
import { WORLD_MAP_REGISTRY } from '@/game/data/maps';
import { AUTOSAVE_INTERVAL_MS, MOVE_DURATION_MS, TILE_SIZE, WARP_COOLDOWN_MS } from '@/shared/constants';
import type { Direction, Vector2 } from '@/shared/types';
import { createNewSave, loadSave, persistSave } from '@/game/saves/saveManager';
import type { SaveProfile } from '@/game/saves/types';
import { collisionEdgeMaskAt, tileAt } from '@/game/world/mapBuilder';
import { CUSTOM_TILESET_CONFIG } from '@/game/world/customTiles';
import { PLAYER_SPRITE_CONFIG } from '@/game/world/playerSprite';
import { BLANK_TILE_CODE, FALLBACK_TILE_CODE, TILE_DEFINITIONS } from '@/game/world/tiles';
import type {
  InteractionDefinition,
  NpcDefinition,
  NpcSpriteConfig,
  TileDefinition,
  WarpDefinition,
  WorldMap,
} from '@/game/world/types';

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

export interface RuntimeSnapshot {
  playerName: string;
  mapName: string;
  mapId: string;
  objective: string;
  dialogue: {
    speaker: string;
    text: string;
    lineIndex: number;
    totalLines: number;
  } | null;
  saveStatus: 'Saved' | 'Unsaved';
  lastSavedAt: string | null;
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

export interface RuntimeInitOptions {
  forceNewGame?: boolean;
  playerName?: string;
}

export class GameRuntime {
  private currentMapId: string;
  private playerPosition: Vector2;
  private facing: Direction;
  private moveStep: MoveStep | null = null;
  private heldDirections: Direction[] = [];
  private dialogue: DialogueState | null = null;
  private flags: Record<string, boolean>;
  private playerName: string;
  private selectedStarterId: string | null;
  private playerAnimationMs = 0;
  private warpCooldownMs = 0;
  private autosaveMs = AUTOSAVE_INTERVAL_MS;
  private dirty = false;
  private lastSavedAt: string | null = null;
  private transientMessage: TransientMessage | null = null;
  private npcRuntimeStates: Record<string, NpcRuntimeState> = {};
  private npcSpriteSheets: Record<string, NpcSpriteSheetState> = {};
  private playerSpriteSheet: NpcSpriteSheetState = {
    status: 'error',
    image: null,
    columns: 0,
  };
  private tilesetImage: HTMLImageElement | null = null;
  private tilesetColumns = 0;
  private tilesetLoadAttempted = false;

  constructor(options?: RuntimeInitOptions) {
    const save = !options?.forceNewGame ? loadSave() : null;
    const state = save && this.isValidSave(save) ? save : createNewSave(options?.playerName ?? 'Player');

    this.currentMapId = state.currentMapId;
    this.playerPosition = { x: state.player.x, y: state.player.y };
    this.facing = state.player.facing;
    this.flags = { ...state.flags };
    this.playerName = state.playerName;
    this.selectedStarterId = state.selectedStarterId;
    this.lastSavedAt = state.updatedAt;
    this.ensureNpcRuntimeState();
    this.ensurePlayerSpriteLoaded();
    this.ensureTilesetLoaded();

    if (!save || options?.forceNewGame) {
      this.dirty = true;
      this.persistNow();
    }
  }

  public hasSave(): boolean {
    return loadSave() !== null;
  }

  public keyDown(key: string): void {
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
    this.updateNpcs(deltaMs);

    if (this.warpCooldownMs > 0) {
      this.warpCooldownMs = Math.max(0, this.warpCooldownMs - deltaMs);
    }

    if (this.moveStep) {
      this.moveStep.elapsed += deltaMs;
      if (this.moveStep.elapsed >= this.moveStep.duration) {
        this.playerPosition = { ...this.moveStep.to };
        this.moveStep = null;
        this.checkAutomaticWarp();
        this.markDirty();
      }
    } else if (!this.dialogue) {
      this.tryMovementFromInput();
    }

    this.tickAutosave(deltaMs);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const map = this.getCurrentMap();
    const playerRenderPos = this.getPlayerRenderPosition();

    const viewTilesX = width / TILE_SIZE;
    const viewTilesY = height / TILE_SIZE;
    const maxCamX = Math.max(0, map.width - viewTilesX);
    const maxCamY = Math.max(0, map.height - viewTilesY);

    const cameraX =
      map.width <= viewTilesX
        ? -(viewTilesX - map.width) / 2
        : clamp(playerRenderPos.x - viewTilesX / 2, 0, maxCamX);
    const cameraY =
      map.height <= viewTilesY
        ? -(viewTilesY - map.height) / 2
        : clamp(playerRenderPos.y - viewTilesY / 2, 0, maxCamY);

    ctx.fillStyle = '#101419';
    ctx.fillRect(0, 0, width, height);

    const startX = Math.floor(cameraX) - 1;
    const endX = Math.ceil(cameraX + viewTilesX) + 1;
    const startY = Math.floor(cameraY) - 1;
    const endY = Math.ceil(cameraY + viewTilesY) + 1;
    const cameraPixelX = Math.round(cameraX * TILE_SIZE);
    const cameraPixelY = Math.round(cameraY * TILE_SIZE);

    const visibleLayers = map.layers.filter((layer) => layer.visible);
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

          const drewFromTileset = this.drawTileFromTileset(ctx, tile, screenX, screenY, rotationQuarter);
          if (!drewFromTileset) {
            this.drawTile(ctx, tile.color, tile.accentColor ?? tile.color, screenX, screenY, tile.height);
          }
        }
      }
    }

    const actorDraws: Array<{ y: number; draw: () => void }> = [];

    for (const npc of map.npcs) {
      const npcState = this.getNpcRuntimeState(npc);
      const npcRenderPosition = this.getNpcRenderPosition(npc);
      actorDraws.push({
        y: npcRenderPosition.y,
        draw: () => {
          this.drawNpc(ctx, npc, npcRenderPosition, cameraX, cameraY, npcState.facing, npcState.moveStep !== null);
        },
      });
    }

    actorDraws.push({
      y: playerRenderPos.y,
      draw: () => {
        this.drawPlayer(ctx, playerRenderPos, cameraX, cameraY, this.facing, this.moveStep !== null);
      },
    });

    actorDraws.sort((a, b) => a.y - b.y);
    for (const entry of actorDraws) {
      entry.draw();
    }

    if (this.transientMessage) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(16, 16, 260, 38);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px sans-serif';
      ctx.fillText(this.transientMessage.text, 28, 40);
    }
  }

  public getSnapshot(): RuntimeSnapshot {
    const map = this.getCurrentMap();

    return {
      playerName: this.playerName,
      mapName: map.name,
      mapId: map.id,
      objective: this.getObjectiveText(),
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
    };
  }

  public renderGameToText(): string {
    const map = this.getCurrentMap();
    const playerRenderPosition = this.getPlayerRenderPosition();
    const facingTile = this.getFacingTile();
    const facingTileCode = tileAt(map, facingTile.x, facingTile.y);

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
      dialogue: this.dialogue
        ? {
            speaker: this.dialogue.speaker,
            text: this.dialogue.lines[this.dialogue.index],
            lineIndex: this.dialogue.index + 1,
            totalLines: this.dialogue.lines.length,
          }
        : null,
      message: this.transientMessage?.text ?? null,
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
    };

    return JSON.stringify(payload);
  }

  public saveNow(): void {
    this.persistNow();
    this.showMessage('Progress Saved');
  }

  private isValidSave(save: SaveProfile): boolean {
    return save.currentMapId in WORLD_MAP_REGISTRY;
  }

  private getCurrentMap(): WorldMap {
    const map = WORLD_MAP_REGISTRY[this.currentMapId];
    if (!map) {
      throw new Error(`Missing map ${this.currentMapId}`);
    }

    return map;
  }

  private getTileDefinition(code: string): TileDefinition {
    return TILE_DEFINITIONS[code] ?? TILE_DEFINITIONS[FALLBACK_TILE_CODE];
  }

  private ensureTilesetLoaded(): void {
    if (this.tilesetLoadAttempted) {
      return;
    }

    this.tilesetLoadAttempted = true;
    const config = CUSTOM_TILESET_CONFIG;
    if (!config || !config.url) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      const columns = Math.floor(image.width / config.tileWidth);
      if (columns <= 0) {
        return;
      }

      this.tilesetImage = image;
      this.tilesetColumns = columns;
    };
    image.onerror = () => {
      this.tilesetImage = null;
      this.tilesetColumns = 0;
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
    if (!this.tilesetImage || !CUSTOM_TILESET_CONFIG) {
      return false;
    }
    const config = CUSTOM_TILESET_CONFIG;
    if (typeof tile.atlasIndex !== 'number' || tile.atlasIndex < 0 || this.tilesetColumns <= 0) {
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
    const sprite = PLAYER_SPRITE_CONFIG;
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

      if (this.dialogue || state.moveStep) {
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
      this.markDirty();
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

  private persistNow(): void {
    const save: SaveProfile = {
      id: 'slot-1',
      version: 2,
      playerName: this.playerName,
      currentMapId: this.currentMapId,
      player: {
        x: this.playerPosition.x,
        y: this.playerPosition.y,
        facing: this.facing,
      },
      selectedStarterId: this.selectedStarterId,
      flags: { ...this.flags },
      updatedAt: new Date().toISOString(),
    };

    persistSave(save);
    this.dirty = false;
    this.lastSavedAt = save.updatedAt;
  }

  private markDirty(): void {
    this.dirty = true;
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

  private showMessage(text: string): void {
    this.transientMessage = {
      text,
      remainingMs: 1200,
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
    const frameIndex = this.getSpriteFrameIndex(PLAYER_SPRITE_CONFIG, facing, isMoving, this.playerAnimationMs);
    if (
      this.playerSpriteSheet.status === 'ready' &&
      this.playerSpriteSheet.image &&
      this.playerSpriteSheet.columns > 0 &&
      frameIndex >= 0 &&
      this.drawSpriteFrame(
        ctx,
        PLAYER_SPRITE_CONFIG,
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
    return this.getSpriteFrameIndex(sprite, facing, isMoving, state.animationMs);
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
    sprite: { facingFrames: Record<Direction, number>; walkFrames?: Partial<Record<Direction, number[]>> },
    facing: Direction,
    isMoving: boolean,
    animationMs: number,
  ): number {
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
