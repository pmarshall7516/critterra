import { BLANK_TILE_CODE, FALLBACK_TILE_CODE, TILE_DEFINITIONS } from '@/game/world/tiles';
import type {
  TileCode,
  WorldMap,
  WorldMapInput,
  WorldMapLayer,
  WorldMapLayerInput,
} from '@/game/world/types';

export function createMap(input: WorldMapInput): WorldMap {
  const layerInputs = normalizeLayerInputs(input);
  if (layerInputs.length === 0) {
    throw new Error(`Map ${input.id} has no layers or tiles`);
  }

  const width = layerInputs[0].tiles[0]?.length ?? 0;
  if (width === 0) {
    throw new Error(`Map ${input.id} has empty tile rows`);
  }
  const height = layerInputs[0].tiles.length;

  const layers = layerInputs.map((layerInput, index) =>
    parseLayer(input.id, layerInput, index, width, height),
  );
  const compositeTiles = composeVisibleTiles(layers, width, height);

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
  };
}

function normalizeLayerInputs(input: WorldMapInput): WorldMapLayerInput[] {
  if (Array.isArray(input.layers) && input.layers.length > 0) {
    return input.layers;
  }

  if (!Array.isArray(input.tiles) || input.tiles.length === 0) {
    return [];
  }

  return [
    {
      id: 'base',
      name: 'Base',
      tiles: input.tiles,
      visible: true,
      collision: true,
    },
  ];
}

function parseLayer(
  mapId: string,
  layerInput: WorldMapLayerInput,
  index: number,
  expectedWidth: number,
  expectedHeight: number,
): WorldMapLayer {
  if (!layerInput.id || typeof layerInput.id !== 'string') {
    throw new Error(`Map ${mapId} layer ${index} is missing string id`);
  }
  if (!Array.isArray(layerInput.tiles) || layerInput.tiles.length === 0) {
    throw new Error(`Map ${mapId} layer ${layerInput.id} has no tiles`);
  }
  if (layerInput.tiles.length !== expectedHeight) {
    throw new Error(
      `Map ${mapId} layer ${layerInput.id} has height ${layerInput.tiles.length}, expected ${expectedHeight}`,
    );
  }

  const unknownTileCodes = new Set<string>();
  const parsedTiles = layerInput.tiles.map((row, rowIndex) => {
    if (typeof row !== 'string') {
      throw new Error(`Map ${mapId} layer ${layerInput.id} row ${rowIndex} must be a string`);
    }
    if (row.length !== expectedWidth) {
      throw new Error(
        `Map ${mapId} layer ${layerInput.id} row ${rowIndex} has width ${row.length}, expected ${expectedWidth}`,
      );
    }

    return row.split('').map((code) => {
      if (!(code in TILE_DEFINITIONS)) {
        unknownTileCodes.add(code);
        return FALLBACK_TILE_CODE as TileCode;
      }

      return code as TileCode;
    });
  });

  if (unknownTileCodes.size > 0) {
    const list = Array.from(unknownTileCodes).join(', ');
    console.warn(
      `Map ${mapId} layer ${layerInput.id} uses unknown tile code(s): ${list}. Replaced with ${FALLBACK_TILE_CODE}.`,
    );
  }

  const parsedRotations = parseRotations(mapId, layerInput, expectedWidth, expectedHeight);
  const parsedCollisionEdges = parseCollisionEdges(mapId, layerInput, expectedWidth, expectedHeight);

  return {
    id: layerInput.id,
    name: layerInput.name?.trim() || layerInput.id,
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
