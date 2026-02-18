import { BLANK_TILE_CODE, FALLBACK_TILE_CODE, TILE_DEFINITIONS } from '@/game/world/tiles';
import { sanitizeMapEncounterGroups } from '@/game/encounters/schema';
import { NPC_LAYER_ORDER_ID } from '@/game/world/types';
import type {
  TileCode,
  TileDefinition,
  WorldMap,
  WorldMapInput,
  WorldMapLayer,
  WorldMapLayerInput,
} from '@/game/world/types';

interface CreateMapOptions {
  tileDefinitions?: Record<string, TileDefinition>;
}

interface LayerIdentity {
  id: string;
  orderId: number;
}

export function createMap(input: WorldMapInput, options?: CreateMapOptions): WorldMap {
  const tileDefinitions = options?.tileDefinitions ?? TILE_DEFINITIONS;
  const layerInputs = normalizeLayerInputs(input);
  if (layerInputs.length === 0) {
    throw new Error(`Map ${input.id} has no layers or tiles`);
  }

  const width = layerInputs[0].tiles[0]?.length ?? 0;
  if (width === 0) {
    throw new Error(`Map ${input.id} has empty tile rows`);
  }
  const height = layerInputs[0].tiles.length;

  const layerIdentities = resolveLayerIdentities(input.id, layerInputs);
  const layers = layerInputs
    .map((layerInput, index) =>
      parseLayer(input.id, layerInput, layerIdentities[index], width, height, tileDefinitions),
    )
    .sort((left, right) => left.orderId - right.orderId);
  const compositeTiles = composeVisibleTiles(layers, width, height);

  const cameraSize = sanitizeCameraSize(input.cameraSize);
  const cameraPoint = sanitizeCameraPoint(input.cameraPoint, width, height);

  return {
    id: input.id,
    name: input.name,
    width,
    height,
    layers,
    tiles: compositeTiles,
    npcs: input.npcs ?? [],
    warps: input.warps ?? [],
    interactions: input.interactions ?? [],
    encounterGroups: sanitizeMapEncounterGroups(input.encounterGroups, width, height),
    cameraSize,
    cameraPoint,
  };
}

function sanitizeCameraSize(raw: WorldMapInput['cameraSize']): { widthTiles: number; heightTiles: number } {
  if (raw && typeof raw.widthTiles === 'number' && typeof raw.heightTiles === 'number') {
    const w = Math.max(1, Math.min(64, Math.floor(raw.widthTiles)));
    const h = Math.max(1, Math.min(64, Math.floor(raw.heightTiles)));
    return { widthTiles: w, heightTiles: h };
  }
  return { widthTiles: 19, heightTiles: 15 };
}

function sanitizeCameraPoint(
  raw: WorldMapInput['cameraPoint'],
  mapWidth: number,
  mapHeight: number,
): { x: number; y: number } | null {
  if (!raw || typeof raw !== 'object' || typeof raw.x !== 'number' || typeof raw.y !== 'number') {
    return null;
  }
  const x = Math.max(0, Math.min(mapWidth - 1, Math.floor(raw.x)));
  const y = Math.max(0, Math.min(mapHeight - 1, Math.floor(raw.y)));
  return { x, y };
}

function normalizeLayerInputs(input: WorldMapInput): WorldMapLayerInput[] {
  if (Array.isArray(input.layers) && input.layers.length > 0) {
    return input.layers;
  }

  if (!Array.isArray(input.tiles) || input.tiles.length === 0) {
    return [];
  }

  const width = input.tiles[0].length;
  const height = input.tiles.length;
  const blankRow = BLANK_TILE_CODE.repeat(width);
  return [
    {
      id: 1,
      name: 'Base',
      tiles: input.tiles,
      visible: true,
      collision: true,
    },
    {
      id: NPC_LAYER_ORDER_ID,
      name: 'NPC',
      tiles: Array.from({ length: height }, () => blankRow),
      visible: true,
      collision: false,
    },
  ];
}

function parseLayer(
  mapId: string,
  layerInput: WorldMapLayerInput,
  layerIdentity: LayerIdentity,
  expectedWidth: number,
  expectedHeight: number,
  tileDefinitions: Record<string, TileDefinition>,
): WorldMapLayer {
  const layerId = layerIdentity.id;

  if (!Array.isArray(layerInput.tiles) || layerInput.tiles.length === 0) {
    throw new Error(`Map ${mapId} layer ${layerId} has no tiles`);
  }
  if (layerInput.tiles.length !== expectedHeight) {
    throw new Error(
      `Map ${mapId} layer ${layerId} has height ${layerInput.tiles.length}, expected ${expectedHeight}`,
    );
  }

  const unknownTileCodes = new Set<string>();
  const parsedTiles = layerInput.tiles.map((row, rowIndex) => {
    if (typeof row !== 'string') {
      throw new Error(`Map ${mapId} layer ${layerId} row ${rowIndex} must be a string`);
    }
    if (row.length !== expectedWidth) {
      throw new Error(
        `Map ${mapId} layer ${layerId} row ${rowIndex} has width ${row.length}, expected ${expectedWidth}`,
      );
    }

    return row.split('').map((code) => {
      if (!(code in tileDefinitions)) {
        unknownTileCodes.add(code);
        return FALLBACK_TILE_CODE as TileCode;
      }

      return code as TileCode;
    });
  });

  if (unknownTileCodes.size > 0) {
    const list = Array.from(unknownTileCodes).join(', ');
    console.warn(
      `Map ${mapId} layer ${layerId} uses unknown tile code(s): ${list}. Replaced with ${FALLBACK_TILE_CODE}.`,
    );
  }

  const parsedRotations = parseRotations(mapId, layerInput, expectedWidth, expectedHeight);
  const parsedCollisionEdges = parseCollisionEdges(mapId, layerInput, expectedWidth, expectedHeight);
  const fallbackName = layerIdentity.orderId === 1 ? 'Base' : `Layer ${layerIdentity.orderId}`;

  return {
    id: layerId,
    orderId: layerIdentity.orderId,
    name: layerInput.name?.trim() || fallbackName,
    tiles: parsedTiles,
    rotations: parsedRotations,
    collisionEdges: parsedCollisionEdges,
    visible: layerInput.visible !== false,
    collision: layerInput.collision !== false,
  };
}

function parseRotations(
  mapId: string,
  layerInput: WorldMapLayerInput,
  expectedWidth: number,
  expectedHeight: number,
): number[][] {
  if (!layerInput.rotations) {
    return Array.from({ length: expectedHeight }, () => Array.from({ length: expectedWidth }, () => 0));
  }
  if (!Array.isArray(layerInput.rotations)) {
    throw new Error(`Map ${mapId} layer ${layerInput.id} rotations must be string array`);
  }
  if (layerInput.rotations.length !== expectedHeight) {
    throw new Error(
      `Map ${mapId} layer ${layerInput.id} rotations height ${layerInput.rotations.length}, expected ${expectedHeight}`,
    );
  }

  return layerInput.rotations.map((row, rowIndex) => {
    if (typeof row !== 'string') {
      throw new Error(`Map ${mapId} layer ${layerInput.id} rotations row ${rowIndex} must be string`);
    }
    if (row.length !== expectedWidth) {
      throw new Error(
        `Map ${mapId} layer ${layerInput.id} rotations row ${rowIndex} width ${row.length}, expected ${expectedWidth}`,
      );
    }

    return row.split('').map((char, columnIndex) => {
      const value = Number.parseInt(char, 10);
      if (!Number.isFinite(value) || value < 0 || value > 3) {
        throw new Error(
          `Map ${mapId} layer ${layerInput.id} rotation at (${columnIndex}, ${rowIndex}) must be 0-3`,
        );
      }
      return value;
    });
  });
}

function parseCollisionEdges(
  mapId: string,
  layerInput: WorldMapLayerInput,
  expectedWidth: number,
  expectedHeight: number,
): number[][] {
  if (!layerInput.collisionEdges) {
    return Array.from({ length: expectedHeight }, () => Array.from({ length: expectedWidth }, () => 0));
  }
  if (!Array.isArray(layerInput.collisionEdges)) {
    throw new Error(`Map ${mapId} layer ${layerInput.id} collisionEdges must be string array`);
  }
  if (layerInput.collisionEdges.length !== expectedHeight) {
    throw new Error(
      `Map ${mapId} layer ${layerInput.id} collisionEdges height ${layerInput.collisionEdges.length}, expected ${expectedHeight}`,
    );
  }

  return layerInput.collisionEdges.map((row, rowIndex) => {
    if (typeof row !== 'string') {
      throw new Error(`Map ${mapId} layer ${layerInput.id} collisionEdges row ${rowIndex} must be string`);
    }
    if (row.length !== expectedWidth) {
      throw new Error(
        `Map ${mapId} layer ${layerInput.id} collisionEdges row ${rowIndex} width ${row.length}, expected ${expectedWidth}`,
      );
    }

    return row.split('').map((char, columnIndex) => {
      const value = Number.parseInt(char, 16);
      if (!Number.isFinite(value) || value < 0 || value > 15) {
        throw new Error(
          `Map ${mapId} layer ${layerInput.id} collision edge at (${columnIndex}, ${rowIndex}) must be hex 0-f`,
        );
      }
      return value;
    });
  });
}

function composeVisibleTiles(layers: WorldMapLayer[], width: number, height: number): TileCode[][] {
  const composed: TileCode[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => BLANK_TILE_CODE as TileCode),
  );

  for (const layer of layers) {
    if (!layer.visible) {
      continue;
    }

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const code = layer.tiles[y][x];
        if (code === BLANK_TILE_CODE) {
          continue;
        }

        composed[y][x] = code;
      }
    }
  }

  return composed;
}

export function isInsideMap(map: WorldMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function tileAt(map: WorldMap, x: number, y: number): string | null {
  if (!isInsideMap(map, x, y)) {
    return null;
  }

  for (let index = map.layers.length - 1; index >= 0; index -= 1) {
    const layer = map.layers[index];
    if (!layer.visible) {
      continue;
    }

    const code = layer.tiles[y][x];
    if (code === BLANK_TILE_CODE) {
      continue;
    }
    return code;
  }

  return BLANK_TILE_CODE;
}

export function collisionEdgeMaskAt(map: WorldMap, x: number, y: number): number {
  if (!isInsideMap(map, x, y)) {
    return 0;
  }

  let mask = 0;
  for (const layer of map.layers) {
    if (!layer.collision) {
      continue;
    }
    const row = layer.collisionEdges[y];
    if (!row || x < 0 || x >= row.length) {
      continue;
    }
    mask |= row[x] ?? 0;
  }

  return mask & 0b1111;
}

function resolveLayerIdentities(mapId: string, layerInputs: WorldMapLayerInput[]): LayerIdentity[] {
  const usedOrderIds = new Set<number>();

  return layerInputs.map((layerInput, index) => {
    const parsedOrderId = parseLayerOrderId(layerInput.id);
    const fallbackStart = Math.max(1, index + 1);
    let orderId = parsedOrderId ?? nextAvailableLayerOrderId(fallbackStart, usedOrderIds);

    if (usedOrderIds.has(orderId)) {
      const nextAvailable = nextAvailableLayerOrderId(orderId, usedOrderIds);
      console.warn(
        `Map ${mapId} has duplicate layer id ${orderId}. Reassigned to ${nextAvailable} to keep ordering stable.`,
      );
      orderId = nextAvailable;
    } else if (parsedOrderId === null && layerInput.id !== undefined && layerInput.id !== null) {
      const rawId = String(layerInput.id).trim();
      if (rawId && rawId.toLowerCase() !== 'base') {
        console.warn(`Map ${mapId} layer "${rawId}" is not numeric. Normalized to layer id ${orderId}.`);
      }
    }

    usedOrderIds.add(orderId);
    return {
      id: String(orderId),
      orderId,
    };
  });
}

function parseLayerOrderId(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    const normalized = Math.floor(value);
    return normalized >= 1 ? normalized : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.toLowerCase() === 'base') {
    return 1;
  }
  if (trimmed.toLowerCase() === 'npc') {
    return NPC_LAYER_ORDER_ID;
  }
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const normalized = Number.parseInt(trimmed, 10);
  return Number.isFinite(normalized) && normalized >= 1 ? normalized : null;
}

function nextAvailableLayerOrderId(start: number, used: Set<number>): number {
  let candidate = Math.max(1, Math.floor(start));
  while (used.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}
