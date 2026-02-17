import { BLANK_TILE_CODE, TILE_DEFINITIONS } from '@/game/world/tiles';
import { sanitizeMapEncounterGroups } from '@/game/encounters/schema';
import type { MapEncounterGroupDefinition } from '@/game/encounters/types';
import type {
  InteractionDefinition,
  NpcDefinition,
  WarpDefinition,
  WorldMap,
  WorldMapLayer,
  WorldMapLayerInput,
  WorldMapInput,
} from '@/game/world/types';

export interface EditableMapLayer {
  id: string;
  name: string;
  tiles: string[];
  rotations: string[];
  collisionEdges: string[];
  visible: boolean;
  collision: boolean;
}

export interface EditableMap {
  id: string;
  name: string;
  layers: EditableMapLayer[];
  npcs: NpcDefinition[];
  warps: WarpDefinition[];
  interactions: InteractionDefinition[];
  encounterGroups: MapEncounterGroupDefinition[];
}

const KNOWN_TILE_CODE_SET = new Set(Object.keys(TILE_DEFINITIONS));
export type EditorTileCode = string;

export function worldMapToEditable(map: WorldMap): EditableMap {
  const layers = map.layers?.length
    ? map.layers.map(worldLayerToEditable)
    : [
        {
          id: '1',
          name: 'Base',
          tiles: map.tiles.map((row) => row.join('')),
          rotations: map.tiles.map((row) => '0'.repeat(row.length)),
          collisionEdges: map.tiles.map((row) => '0'.repeat(row.length)),
          visible: true,
          collision: true,
        },
      ];
  const normalizedLayers = normalizeEditableLayerIds(layers);

  return {
    id: map.id,
    name: map.name,
    layers: normalizedLayers,
    npcs: map.npcs.map(cloneNpc),
    warps: map.warps.map(cloneWarp),
    interactions: map.interactions.map((interaction) => ({
      ...interaction,
      position: { ...interaction.position },
      lines: [...interaction.lines],
    })),
    encounterGroups: map.encounterGroups.map(cloneEncounterGroup),
  };
}

export function cloneEditableMap(map: EditableMap): EditableMap {
  return {
    id: map.id,
    name: map.name,
    layers: map.layers.map((layer) => ({
      ...layer,
      tiles: [...layer.tiles],
      rotations: [...layer.rotations],
      collisionEdges: [...layer.collisionEdges],
    })),
    npcs: map.npcs.map(cloneNpc),
    warps: map.warps.map(cloneWarp),
    interactions: map.interactions.map((interaction) => ({
      ...interaction,
      position: { ...interaction.position },
      lines: [...interaction.lines],
    })),
    encounterGroups: map.encounterGroups.map(cloneEncounterGroup),
  };
}

export function createBlankEditableMap(
  id: string,
  name: string,
  width: number,
  height: number,
  fillCode: EditorTileCode,
): EditableMap {
  const safeWidth = clampInt(width, 4, 128);
  const safeHeight = clampInt(height, 4, 128);

  return {
    id,
    name,
    layers: [
      createBlankLayer(safeWidth, safeHeight, {
        id: '1',
        name: 'Base',
        fillCode,
        visible: true,
        collision: true,
      }),
    ],
    npcs: [],
    warps: [],
    interactions: [],
    encounterGroups: [],
  };
}

export function getMapSize(map: EditableMap): { width: number; height: number } {
  const base = map.layers[0];
  const width = base?.tiles[0]?.length ?? 0;
  return {
    width,
    height: base?.tiles.length ?? 0,
  };
}

export function getLayerById(map: EditableMap, layerId: string): EditableMapLayer | null {
  return map.layers.find((layer) => layer.id === layerId) ?? null;
}

export function getTopTileCodeAt(map: EditableMap, x: number, y: number): EditorTileCode | null {
  const sortedLayers = sortEditableLayersById(map.layers);
  for (let index = sortedLayers.length - 1; index >= 0; index -= 1) {
    const layer = sortedLayers[index];
    if (!layer.visible) {
      continue;
    }

    const row = layer.tiles[y];
    if (!row || x < 0 || x >= row.length) {
      continue;
    }

    const code = row[x];
    if (!code || code.length !== 1 || code === BLANK_TILE_CODE) {
      continue;
    }

    return code;
  }

  return BLANK_TILE_CODE;
}

export function composeEditableTiles(map: EditableMap): string[] {
  const { width, height } = getMapSize(map);
  if (width <= 0 || height <= 0) {
    return [];
  }

  const rows = Array.from({ length: height }, () => Array.from({ length: width }, () => BLANK_TILE_CODE));
  for (const layer of sortEditableLayersById(map.layers)) {
    if (!layer.visible) {
      continue;
    }
    for (let y = 0; y < height; y += 1) {
      const layerRow = layer.tiles[y];
      if (!layerRow) {
        continue;
      }
      for (let x = 0; x < width; x += 1) {
        const code = layerRow[x];
        if (!code || code === BLANK_TILE_CODE) {
          continue;
        }
        rows[y][x] = code;
      }
    }
  }

  return rows.map((row) => row.join(''));
}

export function resizeEditableMap(
  map: EditableMap,
  nextWidth: number,
  nextHeight: number,
  fillCode: EditorTileCode,
): EditableMap {
  const current = cloneEditableMap(map);
  const width = clampInt(nextWidth, 4, 128);
  const height = clampInt(nextHeight, 4, 128);
  current.layers = current.layers.map((layer, layerIndex) => {
    const resizedTiles: string[] = [];
    const resizedRotations: string[] = [];
    const resizedCollisionEdges: string[] = [];
    const layerFill = layerIndex === 0 ? fillCode : BLANK_TILE_CODE;
    const fillRotation = '0'.repeat(width);
    const fillCollisionEdges = '0'.repeat(width);

    for (let y = 0; y < height; y += 1) {
      const existingTileRow = layer.tiles[y] ?? '';
      const existingRotationRow = layer.rotations[y] ?? '';
      const existingCollisionEdgeRow = layer.collisionEdges[y] ?? '';
      const tileTruncated = existingTileRow.slice(0, width);
      const tilePadded = tileTruncated + layerFill.repeat(Math.max(0, width - tileTruncated.length));
      const rotationTruncated = existingRotationRow.slice(0, width);
      const rotationPadded = rotationTruncated + fillRotation.slice(rotationTruncated.length);
      const collisionEdgesTruncated = existingCollisionEdgeRow.slice(0, width);
      const collisionEdgesPadded =
        collisionEdgesTruncated + fillCollisionEdges.slice(collisionEdgesTruncated.length);
      resizedTiles.push(tilePadded);
      resizedRotations.push(rotationPadded);
      resizedCollisionEdges.push(collisionEdgesPadded);
    }

    return {
      ...layer,
      tiles: resizedTiles,
      rotations: resizedRotations,
      collisionEdges: resizedCollisionEdges,
    };
  });

  return current;
}

export function updateTile(
  map: EditableMap,
  layerId: string,
  x: number,
  y: number,
  code: EditorTileCode,
  rotationQuarter = 0,
): EditableMap {
  const next = cloneEditableMap(map);
  const layer = next.layers.find((entry) => entry.id === layerId);
  if (!layer) {
    return map;
  }

  const row = layer.tiles[y];
  const rotationRow = layer.rotations[y];
  if (!row || x < 0 || x >= row.length) {
    return map;
  }

  const safeRotation = sanitizeRotationQuarter(rotationQuarter);
  const rotationChar = String(safeRotation);
  const nextRotation = code === BLANK_TILE_CODE ? '0' : rotationChar;
  if (row[x] === code && (rotationRow?.[x] ?? '0') === nextRotation) {
    return map;
  }

  layer.tiles[y] = `${row.slice(0, x)}${code}${row.slice(x + 1)}`;
  const currentRotationRow = rotationRow ?? '0'.repeat(row.length);
  layer.rotations[y] = `${currentRotationRow.slice(0, x)}${nextRotation}${currentRotationRow.slice(x + 1)}`;
  return next;
}

export function floodFill(
  map: EditableMap,
  layerId: string,
  startX: number,
  startY: number,
  code: EditorTileCode,
  rotationQuarter = 0,
): EditableMap {
  const targetCode = getTileCodeAt(map, startX, startY, layerId);
  if (!targetCode || targetCode === code) {
    return map;
  }

  const next = cloneEditableMap(map);
  const layer = next.layers.find((entry) => entry.id === layerId);
  if (!layer) {
    return map;
  }

  const { width, height } = getMapSize(next);
  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  const visited = new Set<string>();
  const nextRotation = String(code === BLANK_TILE_CODE ? 0 : sanitizeRotationQuarter(rotationQuarter));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const key = `${current.x},${current.y}`;
    if (visited.has(key)) {
      continue;
    }
    visited.add(key);

    if (current.x < 0 || current.y < 0 || current.x >= width || current.y >= height) {
      continue;
    }

    const existing = getTileCodeAt(next, current.x, current.y, layerId);
    if (existing !== targetCode) {
      continue;
    }

    const row = layer.tiles[current.y];
    layer.tiles[current.y] = `${row.slice(0, current.x)}${code}${row.slice(current.x + 1)}`;
    const rotationRow = layer.rotations[current.y] ?? '0'.repeat(row.length);
    layer.rotations[current.y] = `${rotationRow.slice(0, current.x)}${nextRotation}${rotationRow.slice(current.x + 1)}`;

    queue.push({ x: current.x + 1, y: current.y });
    queue.push({ x: current.x - 1, y: current.y });
    queue.push({ x: current.x, y: current.y + 1 });
    queue.push({ x: current.x, y: current.y - 1 });
  }

  return next;
}

export function getTileCodeAt(
  map: EditableMap,
  x: number,
  y: number,
  layerId?: string,
): EditorTileCode | null {
  if (!layerId) {
    return getTopTileCodeAt(map, x, y);
  }

  const layer = map.layers.find((entry) => entry.id === layerId);
  if (!layer) {
    return null;
  }

  const row = layer.tiles[y];
  if (!row || x < 0 || x >= row.length) {
    return null;
  }

  const code = row[x];
  if (!code || code.length !== 1) {
    return null;
  }

  return code;
}

export function getTileRotationAt(map: EditableMap, x: number, y: number, layerId: string): number {
  const layer = map.layers.find((entry) => entry.id === layerId);
  if (!layer) {
    return 0;
  }
  const row = layer.rotations[y];
  if (!row || x < 0 || x >= row.length) {
    return 0;
  }

  const value = Number.parseInt(row[x] ?? '0', 10);
  return Number.isFinite(value) ? sanitizeRotationQuarter(value) : 0;
}

export function getCollisionEdgeMaskAt(map: EditableMap, x: number, y: number, layerId: string): number {
  const layer = map.layers.find((entry) => entry.id === layerId);
  if (!layer) {
    return 0;
  }
  const row = layer.collisionEdges[y];
  if (!row || x < 0 || x >= row.length) {
    return 0;
  }

  const value = Number.parseInt(row[x] ?? '0', 16);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return sanitizeCollisionEdgeMask(value);
}

export function updateCollisionEdgeMask(
  map: EditableMap,
  layerId: string,
  x: number,
  y: number,
  nextMask: number,
): EditableMap {
  const next = cloneEditableMap(map);
  const layer = next.layers.find((entry) => entry.id === layerId);
  if (!layer) {
    return map;
  }
  const row = layer.collisionEdges[y];
  if (!row || x < 0 || x >= row.length) {
    return map;
  }

  const safeMask = sanitizeCollisionEdgeMask(nextMask);
  const maskChar = safeMask.toString(16);
  if ((row[x] ?? '0') === maskChar) {
    return map;
  }

  layer.collisionEdges[y] = `${row.slice(0, x)}${maskChar}${row.slice(x + 1)}`;
  return next;
}

export function parseEditableMapJson(raw: string): EditableMap {
  const parsed = JSON.parse(raw) as Partial<WorldMapInput>;

  if (!parsed.id || typeof parsed.id !== 'string') {
    throw new Error('Map JSON must include string field "id"');
  }

  if (!parsed.name || typeof parsed.name !== 'string') {
    throw new Error('Map JSON must include string field "name"');
  }

  const layers = parseMapLayersFromInput(parsed);
  if (layers.length === 0) {
    throw new Error('Map JSON must include "tiles" or non-empty "layers".');
  }

  return {
    id: parsed.id,
    name: parsed.name,
    layers,
    npcs: Array.isArray(parsed.npcs) ? (parsed.npcs as NpcDefinition[]) : [],
    warps: Array.isArray(parsed.warps)
      ? (parsed.warps as WarpDefinition[])
          .map(sanitizeWarpDefinition)
          .filter((warp): warp is WarpDefinition => warp !== null)
      : [],
    interactions: Array.isArray(parsed.interactions)
      ? (parsed.interactions as InteractionDefinition[])
      : [],
    encounterGroups: sanitizeMapEncounterGroups(
      parsed.encounterGroups,
      layers[0]?.tiles[0]?.length ?? 0,
      layers[0]?.tiles.length ?? 0,
    ),
  };
}

export function editableMapToJson(map: EditableMap): string {
  const payload = toWorldMapInput(map);
  return JSON.stringify(payload, null, 2);
}

export function isKnownTileCode(code: string): boolean {
  return KNOWN_TILE_CODE_SET.has(code);
}

export function editableMapToTypeScript(map: EditableMap): string {
  const constName = toConstName(map.id);

  const payload = toWorldMapInput(map);

  return [
    "import { createMap } from '@/game/world/mapBuilder';",
    '',
    `export const ${constName} = createMap(${toTsLiteral(payload, 0)});`,
    '',
  ].join('\n');
}

export function toConstName(mapId: string): string {
  const normalized = mapId
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^[A-Z]/, (char) => char.toLowerCase());

  const base = normalized.length > 0 ? normalized : 'newMap';
  return `${base}Map`;
}

export function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function parseLayerOrderId(value: string | number | null | undefined): number | null {
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
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const normalized = Number.parseInt(trimmed, 10);
  return Number.isFinite(normalized) && normalized >= 1 ? normalized : null;
}

export function sortEditableLayersById(layers: EditableMapLayer[]): EditableMapLayer[] {
  return [...layers].sort((left, right) => {
    const leftOrder = parseLayerOrderId(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = parseLayerOrderId(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  });
}

function toTsLiteral(value: unknown, indent: number): string {
  const pad = ' '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    const entries = value.map((entry) => `${' '.repeat(indent + 2)}${toTsLiteral(entry, indent + 2)}`);
    return `[\n${entries.join(',\n')}\n${pad}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined);
    if (entries.length === 0) {
      return '{}';
    }

    const lines = entries.map(([key, entry]) => {
      const printedKey = /^[$A-Z_][0-9A-Z_$]*$/i.test(key) ? key : `'${escapeString(key)}'`;
      return `${' '.repeat(indent + 2)}${printedKey}: ${toTsLiteral(entry, indent + 2)}`;
    });

    return `{\n${lines.join(',\n')}\n${pad}}`;
  }

  if (typeof value === 'string') {
    return `'${escapeString(value)}'`;
  }

  return JSON.stringify(value);
}

function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

export function createBlankLayer(
  width: number,
  height: number,
  options: {
    id: string;
    name: string;
    fillCode: EditorTileCode;
    visible?: boolean;
    collision?: boolean;
  },
): EditableMapLayer {
  const safeWidth = clampInt(width, 1, 128);
  const safeHeight = clampInt(height, 1, 128);
  const tileRow = options.fillCode.repeat(safeWidth);
  const rotationRow = '0'.repeat(safeWidth);
  const collisionEdgeRow = '0'.repeat(safeWidth);

  return {
    id: options.id,
    name: options.name,
    tiles: Array.from({ length: safeHeight }, () => tileRow),
    rotations: Array.from({ length: safeHeight }, () => rotationRow),
    collisionEdges: Array.from({ length: safeHeight }, () => collisionEdgeRow),
    visible: options.visible !== false,
    collision: options.collision !== false,
  };
}

function worldLayerToEditable(layer: WorldMapLayer): EditableMapLayer {
  const layerOrderId = Number.isFinite(layer.orderId) ? Math.max(1, Math.floor(layer.orderId)) : 1;
  return {
    id: String(layerOrderId),
    name: layer.name?.trim() || (layerOrderId === 1 ? 'Base' : `Layer ${layerOrderId}`),
    tiles: layer.tiles.map((row) => row.join('')),
    rotations: layer.rotations.map((row) => row.map((value) => String(sanitizeRotationQuarter(value))).join('')),
    collisionEdges: layer.collisionEdges.map((row) =>
      row.map((value) => sanitizeCollisionEdgeMask(value).toString(16)).join(''),
    ),
    visible: layer.visible,
    collision: layer.collision,
  };
}

function cloneNpc(npc: NpcDefinition): NpcDefinition {
  return {
    ...npc,
    position: { ...npc.position },
    dialogueLines: npc.dialogueLines ? [...npc.dialogueLines] : undefined,
    battleTeamIds: npc.battleTeamIds ? [...npc.battleTeamIds] : undefined,
    movement: npc.movement
      ? {
          ...npc.movement,
          pattern: npc.movement.pattern ? [...npc.movement.pattern] : undefined,
        }
      : undefined,
    idleAnimation: npc.idleAnimation,
    moveAnimation: npc.moveAnimation,
    sprite: npc.sprite
      ? {
        ...npc.sprite,
        animationSets: npc.sprite.animationSets
          ? Object.fromEntries(
              Object.entries(npc.sprite.animationSets).map(([name, directions]) => [
                name,
                {
                  up: directions?.up ? [...directions.up] : undefined,
                  down: directions?.down ? [...directions.down] : undefined,
                  left: directions?.left ? [...directions.left] : undefined,
                  right: directions?.right ? [...directions.right] : undefined,
                },
              ]),
            )
          : undefined,
        defaultIdleAnimation: npc.sprite.defaultIdleAnimation,
        defaultMoveAnimation: npc.sprite.defaultMoveAnimation,
          facingFrames: { ...npc.sprite.facingFrames },
          walkFrames: npc.sprite.walkFrames
            ? {
                up: npc.sprite.walkFrames.up ? [...npc.sprite.walkFrames.up] : undefined,
                down: npc.sprite.walkFrames.down ? [...npc.sprite.walkFrames.down] : undefined,
                left: npc.sprite.walkFrames.left ? [...npc.sprite.walkFrames.left] : undefined,
                right: npc.sprite.walkFrames.right ? [...npc.sprite.walkFrames.right] : undefined,
              }
            : undefined,
        }
      : undefined,
  };
}

function parseMapLayersFromInput(input: Partial<WorldMapInput>): EditableMapLayer[] {
  if (Array.isArray(input.layers) && input.layers.length > 0) {
    const parsed = normalizeEditableLayerIds(input.layers.map((layer, index) => parseLayerInput(layer, index)));
    const width = parsed[0].tiles[0]?.length ?? 0;
    const height = parsed[0].tiles.length;
    if (width <= 0 || height <= 0) {
      throw new Error('Map layers cannot be empty.');
    }

    for (const layer of parsed) {
      if (layer.tiles.length !== height) {
        throw new Error(`Layer "${layer.id}" height ${layer.tiles.length} does not match expected ${height}.`);
      }
      for (let y = 0; y < height; y += 1) {
        if (layer.tiles[y].length !== width) {
          throw new Error(`Layer "${layer.id}" row ${y} width ${layer.tiles[y].length} does not match expected ${width}.`);
        }
      }
    }

    return parsed;
  }

  if (Array.isArray(input.tiles) && input.tiles.length > 0) {
    const width = input.tiles[0].length;
    if (width <= 0) {
      throw new Error('Map JSON tile rows cannot be empty.');
    }
    for (const [index, row] of input.tiles.entries()) {
      if (typeof row !== 'string') {
        throw new Error(`Map JSON row ${index} must be a string`);
      }
      if (row.length !== width) {
        throw new Error(`Map JSON row ${index} width ${row.length} does not match expected ${width}`);
      }
      for (const code of row) {
        if (!code || code.length !== 1) {
          throw new Error(`Map JSON tile code "${code}" must be a single character`);
        }
      }
    }

    return [
      {
        id: '1',
        name: 'Base',
        tiles: [...input.tiles],
        rotations: input.tiles.map((row) => '0'.repeat(row.length)),
        collisionEdges: input.tiles.map((row) => '0'.repeat(row.length)),
        visible: true,
        collision: true,
      },
    ];
  }

  return [];
}

function parseLayerInput(rawLayer: WorldMapLayerInput, index: number): EditableMapLayer {
  if (!rawLayer || typeof rawLayer !== 'object') {
    throw new Error(`Layer ${index} must be an object.`);
  }
  const parsedOrderId = parseLayerOrderId(rawLayer.id);
  const layerOrderId = parsedOrderId ?? Math.max(1, index + 1);
  const layerId = String(layerOrderId);
  if (!Array.isArray(rawLayer.tiles) || rawLayer.tiles.length === 0) {
    throw new Error(`Layer "${layerId}" must include non-empty tiles.`);
  }

  const width = rawLayer.tiles[0].length;
  if (width <= 0) {
    throw new Error(`Layer "${layerId}" rows cannot be empty.`);
  }

  const tiles = rawLayer.tiles.map((row, rowIndex) => {
    if (typeof row !== 'string') {
      throw new Error(`Layer "${layerId}" row ${rowIndex} must be a string.`);
    }
    if (row.length !== width) {
      throw new Error(`Layer "${layerId}" row ${rowIndex} width ${row.length} does not match expected ${width}.`);
    }
    for (const code of row) {
      if (!code || code.length !== 1) {
        throw new Error(`Layer "${layerId}" has invalid tile code "${code}" at row ${rowIndex}.`);
      }
    }
    return row;
  });

  const rotations = normalizeRotationRows(rawLayer.rotations, width, tiles.length, layerId);
  const collisionEdges = normalizeCollisionEdgeRows(
    rawLayer.collisionEdges,
    width,
    tiles.length,
    layerId,
  );

  return {
    id: layerId,
    name: rawLayer.name?.trim() || (layerOrderId === 1 ? 'Base' : `Layer ${layerOrderId}`),
    tiles,
    rotations,
    collisionEdges,
    visible: rawLayer.visible !== false,
    collision: rawLayer.collision !== false,
  };
}

function normalizeRotationRows(
  rawRotations: string[] | undefined,
  width: number,
  height: number,
  layerId: string,
): string[] {
  if (!Array.isArray(rawRotations) || rawRotations.length === 0) {
    return Array.from({ length: height }, () => '0'.repeat(width));
  }
  if (rawRotations.length !== height) {
    throw new Error(`Layer "${layerId}" rotations height ${rawRotations.length} does not match ${height}.`);
  }

  return rawRotations.map((row, rowIndex) => {
    if (typeof row !== 'string') {
      throw new Error(`Layer "${layerId}" rotations row ${rowIndex} must be a string.`);
    }
    if (row.length !== width) {
      throw new Error(`Layer "${layerId}" rotations row ${rowIndex} width ${row.length} does not match ${width}.`);
    }

    let normalized = '';
    for (let i = 0; i < row.length; i += 1) {
      const value = Number.parseInt(row[i] ?? '0', 10);
      normalized += String(Number.isFinite(value) ? sanitizeRotationQuarter(value) : 0);
    }
    return normalized;
  });
}

function normalizeCollisionEdgeRows(
  rawCollisionEdges: string[] | undefined,
  width: number,
  height: number,
  layerId: string,
): string[] {
  if (!Array.isArray(rawCollisionEdges) || rawCollisionEdges.length === 0) {
    return Array.from({ length: height }, () => '0'.repeat(width));
  }
  if (rawCollisionEdges.length !== height) {
    throw new Error(
      `Layer "${layerId}" collisionEdges height ${rawCollisionEdges.length} does not match ${height}.`,
    );
  }

  return rawCollisionEdges.map((row, rowIndex) => {
    if (typeof row !== 'string') {
      throw new Error(`Layer "${layerId}" collisionEdges row ${rowIndex} must be a string.`);
    }
    if (row.length !== width) {
      throw new Error(
        `Layer "${layerId}" collisionEdges row ${rowIndex} width ${row.length} does not match ${width}.`,
      );
    }

    let normalized = '';
    for (let i = 0; i < row.length; i += 1) {
      const value = Number.parseInt(row[i] ?? '0', 16);
      normalized += sanitizeCollisionEdgeMask(Number.isFinite(value) ? value : 0).toString(16);
    }
    return normalized;
  });
}

function toWorldMapInput(map: EditableMap): WorldMapInput {
  const payload: WorldMapInput = {
    id: map.id,
    name: map.name,
  };

  if (map.npcs.length > 0) {
    payload.npcs = map.npcs;
  }
  if (map.warps.length > 0) {
    payload.warps = map.warps.map(cloneWarp);
  }
  if (map.interactions.length > 0) {
    payload.interactions = map.interactions;
  }
  if (map.encounterGroups.length > 0) {
    payload.encounterGroups = map.encounterGroups.map(cloneEncounterGroup);
  }

  if (shouldSerializeAsLegacyTiles(map)) {
    payload.tiles = map.layers[0].tiles;
    return payload;
  }

  payload.layers = sortEditableLayersById(map.layers).map((layer) => {
    const layerOrderId = parseLayerOrderId(layer.id) ?? 1;
    const layerPayload: WorldMapLayerInput = {
      id: layerOrderId,
      name: layer.name,
      tiles: layer.tiles,
    };
    if (layer.visible === false) {
      layerPayload.visible = false;
    }
    if (layer.collision === false) {
      layerPayload.collision = false;
    }
    if (layer.rotations.some((row) => /[1-3]/.test(row))) {
      layerPayload.rotations = layer.rotations;
    }
    if (layer.collisionEdges.some((row) => /[1-9a-f]/i.test(row))) {
      layerPayload.collisionEdges = layer.collisionEdges;
    }

    return layerPayload;
  });

  return payload;
}

function shouldSerializeAsLegacyTiles(map: EditableMap): boolean {
  const orderedLayers = sortEditableLayersById(map.layers);
  if (orderedLayers.length !== 1) {
    return false;
  }
  const layer = orderedLayers[0];
  if (parseLayerOrderId(layer.id) !== 1 || layer.name !== 'Base' || !layer.visible || !layer.collision) {
    return false;
  }

  return (
    !layer.rotations.some((row) => /[1-3]/.test(row)) &&
    !layer.collisionEdges.some((row) => /[1-9a-f]/i.test(row))
  );
}

function cloneWarp(warp: WarpDefinition): WarpDefinition {
  return {
    ...warp,
    from: { ...warp.from },
    fromPositions: warp.fromPositions?.map((position) => ({ ...position })),
    to: { ...warp.to },
    toPositions: warp.toPositions?.map((position) => ({ ...position })),
  };
}

function cloneEncounterGroup(group: MapEncounterGroupDefinition): MapEncounterGroupDefinition {
  return {
    ...group,
    tilePositions: group.tilePositions.map((position) => ({ ...position })),
    walkEncounterTableId: group.walkEncounterTableId ?? null,
    fishEncounterTableId: group.fishEncounterTableId ?? null,
    walkFrequency: Number.isFinite(group.walkFrequency) ? Math.max(0, Math.min(1, group.walkFrequency)) : 0,
    fishFrequency: Number.isFinite(group.fishFrequency) ? Math.max(0, Math.min(1, group.fishFrequency)) : 0,
  };
}

function sanitizeWarpDefinition(raw: WarpDefinition): WarpDefinition | null {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.toMapId) {
    return null;
  }

  const fallbackFrom =
    raw.from && Number.isFinite(raw.from.x) && Number.isFinite(raw.from.y)
      ? { x: Math.floor(raw.from.x), y: Math.floor(raw.from.y) }
      : { x: 0, y: 0 };
  const fallbackTo =
    raw.to && Number.isFinite(raw.to.x) && Number.isFinite(raw.to.y)
      ? { x: Math.floor(raw.to.x), y: Math.floor(raw.to.y) }
      : { x: 0, y: 0 };

  const fromPositions = Array.isArray(raw.fromPositions)
    ? raw.fromPositions
        .filter(
          (position): position is { x: number; y: number } =>
            Boolean(position) && Number.isFinite(position.x) && Number.isFinite(position.y),
        )
        .map((position) => ({ x: Math.floor(position.x), y: Math.floor(position.y) }))
    : [];
  const toPositions = Array.isArray(raw.toPositions)
    ? raw.toPositions
        .filter(
          (position): position is { x: number; y: number } =>
            Boolean(position) && Number.isFinite(position.x) && Number.isFinite(position.y),
        )
        .map((position) => ({ x: Math.floor(position.x), y: Math.floor(position.y) }))
    : [];

  return {
    ...raw,
    from: fromPositions[0] ? { ...fromPositions[0] } : fallbackFrom,
    fromPositions: fromPositions.length > 0 ? fromPositions : undefined,
    to: toPositions[0] ? { ...toPositions[0] } : fallbackTo,
    toPositions: toPositions.length > 0 ? toPositions : undefined,
  };
}

function sanitizeRotationQuarter(value: number): number {
  const intValue = Math.floor(Math.abs(value));
  return intValue % 4;
}

function sanitizeCollisionEdgeMask(value: number): number {
  const intValue = Number.isFinite(value) ? Math.floor(value) : 0;
  return intValue & 0b1111;
}

function normalizeEditableLayerIds(layers: EditableMapLayer[]): EditableMapLayer[] {
  const usedOrderIds = new Set<number>();
  const normalized = layers.map((layer, index) => {
    const parsedOrderId = parseLayerOrderId(layer.id);
    const start = parsedOrderId ?? Math.max(1, index + 1);
    const orderId = nextAvailableLayerOrderId(start, usedOrderIds);
    usedOrderIds.add(orderId);

    return {
      ...layer,
      id: String(orderId),
      name: layer.name?.trim() || (orderId === 1 ? 'Base' : `Layer ${orderId}`),
    };
  });

  return sortEditableLayersById(normalized);
}

function nextAvailableLayerOrderId(start: number, usedOrderIds: Set<number>): number {
  let candidate = Math.max(1, Math.floor(start));
  while (usedOrderIds.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}
