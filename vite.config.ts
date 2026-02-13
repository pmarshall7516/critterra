import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

interface EditableMapPayload {
  id: string;
  name: string;
  tiles?: string[];
  layers?: EditableMapLayerPayload[];
  npcs: unknown[];
  warps: unknown[];
  interactions: unknown[];
}

interface EditableMapLayerPayload {
  id: string;
  name: string;
  tiles: string[];
  rotations: string[];
  collisionEdges: string[];
  visible: boolean;
  collision: boolean;
}

interface SavedPaintTilePayload {
  id?: unknown;
  name?: unknown;
  primaryCode?: unknown;
  width?: unknown;
  height?: unknown;
  cells?: Array<{
    code?: unknown;
    atlasIndex?: unknown;
    dx?: unknown;
    dy?: unknown;
  }>;
}

interface SaveMapRequestPayload {
  map?: Partial<EditableMapPayload>;
  existingMapId?: unknown;
  savedPaintTiles?: unknown;
  tileset?: {
    url?: unknown;
    tilePixelWidth?: unknown;
    tilePixelHeight?: unknown;
  } | null;
}

interface SaveTilesRequestPayload {
  map?: Partial<EditableMapPayload>;
  savedPaintTiles?: unknown;
  tileset?: SaveMapRequestPayload['tileset'];
}

interface MapFileMeta {
  id: string;
  constName: string;
  fileName: string;
  fileBase: string;
  absolutePath: string;
}

const BASE_TILE_CODES = new Set(['.', 'X', 'G', 'T', 'P', 'H', 'Q', 'U', 'D', 'W', 'F', 'R', 'B', 'C']);

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const mapsDir = path.join(repoRoot, 'src', 'game', 'data', 'maps');
const mapsIndexPath = path.join(mapsDir, 'index.ts');
const customTilesPath = path.join(repoRoot, 'src', 'game', 'world', 'customTiles.ts');
const playerSpritePath = path.join(repoRoot, 'src', 'game', 'world', 'playerSprite.ts');

interface SavePlayerSpriteRequestPayload {
  playerSprite?: {
    url?: unknown;
    frameWidth?: unknown;
    frameHeight?: unknown;
    atlasCellWidth?: unknown;
    atlasCellHeight?: unknown;
    frameCellsWide?: unknown;
    frameCellsTall?: unknown;
    renderWidthTiles?: unknown;
    renderHeightTiles?: unknown;
    facingFrames?: {
      up?: unknown;
      down?: unknown;
      left?: unknown;
      right?: unknown;
    };
    walkFrames?: {
      up?: unknown;
      down?: unknown;
      left?: unknown;
      right?: unknown;
    };
  };
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      total += chunk.length;
      if (total > 8 * 1024 * 1024) {
        reject(new Error('Request body too large.'));
      }
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sanitizeIdentifier(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
}

function toMapConstName(mapId: string): string {
  const normalized = mapId
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^[A-Z]/, (char) => char.toLowerCase());

  const base = normalized.length > 0 ? normalized : 'newMap';
  return `${base}Map`;
}

function toMapFileBaseName(mapId: string): string {
  const normalized = mapId
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^[A-Z]/, (char) => char.toLowerCase());

  return normalized.length > 0 ? normalized : 'newMap';
}

function parseEditableMapPayload(raw: SaveMapRequestPayload): EditableMapPayload {
  const map = raw.map;
  if (!map || typeof map !== 'object') {
    throw new Error('Missing map payload.');
  }

  const id = sanitizeIdentifier(typeof map.id === 'string' ? map.id : '', 'new-map');
  const name = typeof map.name === 'string' && map.name.trim() ? map.name : 'New Map';
  const layers = parseMapLayers(map.layers);
  const tiles = parseMapTiles(map.tiles);
  if (!layers && !tiles) {
    throw new Error('Map must include "layers" or "tiles".');
  }

  const width = layers ? layers[0].tiles[0]?.length ?? 0 : tiles?.[0]?.length ?? 0;
  const height = layers ? layers[0].tiles.length : tiles?.length ?? 0;
  if (width <= 0 || height <= 0) {
    throw new Error('Map rows cannot be empty.');
  }

  if (layers) {
    for (const layer of layers) {
      if (layer.tiles.length !== height) {
        throw new Error(`Layer "${layer.id}" height ${layer.tiles.length} does not match expected ${height}.`);
      }
      for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
        if (layer.tiles[rowIndex].length !== width) {
          throw new Error(
            `Layer "${layer.id}" row ${rowIndex} width ${layer.tiles[rowIndex].length} does not match expected ${width}.`,
          );
        }
        if (layer.rotations[rowIndex].length !== width) {
          throw new Error(
            `Layer "${layer.id}" rotations row ${rowIndex} width ${layer.rotations[rowIndex].length} does not match expected ${width}.`,
          );
        }
        if (layer.collisionEdges[rowIndex].length !== width) {
          throw new Error(
            `Layer "${layer.id}" collisionEdges row ${rowIndex} width ${layer.collisionEdges[rowIndex].length} does not match expected ${width}.`,
          );
        }
      }
    }
  }

  return {
    id,
    name,
    tiles: layers ? undefined : tiles ?? undefined,
    layers: layers ?? undefined,
    npcs: Array.isArray(map.npcs) ? map.npcs : [],
    warps: Array.isArray(map.warps) ? map.warps : [],
    interactions: Array.isArray(map.interactions) ? map.interactions : [],
  };
}

function parseMapTiles(rawTiles: unknown): string[] | null {
  if (!Array.isArray(rawTiles) || rawTiles.length === 0) {
    return null;
  }

  const tiles = rawTiles.map((row) => {
    if (typeof row !== 'string') {
      throw new Error('Map tiles must be a string array.');
    }
    return row;
  });
  validateTileRows(tiles, 'Map');
  return tiles;
}

function parseMapLayers(rawLayers: unknown): EditableMapLayerPayload[] | null {
  if (!Array.isArray(rawLayers) || rawLayers.length === 0) {
    return null;
  }

  return rawLayers.map((rawLayer, index) => {
    if (!rawLayer || typeof rawLayer !== 'object') {
      throw new Error(`Layer ${index} must be an object.`);
    }

    const layer = rawLayer as {
      id?: unknown;
      name?: unknown;
      tiles?: unknown;
      rotations?: unknown;
      collisionEdges?: unknown;
      visible?: unknown;
      collision?: unknown;
    };

    const id = sanitizeIdentifier(typeof layer.id === 'string' ? layer.id : '', `layer-${index + 1}`);
    const name = typeof layer.name === 'string' && layer.name.trim() ? layer.name : id;
    const tiles = parseMapTiles(layer.tiles);
    if (!tiles) {
      throw new Error(`Layer "${id}" must include non-empty tiles.`);
    }

    let rotations: string[] = [];
    if (Array.isArray(layer.rotations) && layer.rotations.length > 0) {
      rotations = layer.rotations.map((row, rowIndex) => {
        if (typeof row !== 'string') {
          throw new Error(`Layer "${id}" rotations row ${rowIndex} must be a string.`);
        }
        return row;
      });
      if (rotations.length !== tiles.length) {
        throw new Error(`Layer "${id}" rotations height ${rotations.length} does not match tiles height ${tiles.length}.`);
      }
      rotations = rotations.map((row, rowIndex) => normalizeRotationRow(row, tiles[rowIndex].length, id, rowIndex));
    } else {
      rotations = tiles.map((row) => '0'.repeat(row.length));
    }

    let collisionEdges: string[] = [];
    if (Array.isArray(layer.collisionEdges) && layer.collisionEdges.length > 0) {
      collisionEdges = layer.collisionEdges.map((row, rowIndex) => {
        if (typeof row !== 'string') {
          throw new Error(`Layer "${id}" collisionEdges row ${rowIndex} must be a string.`);
        }
        return row;
      });
      if (collisionEdges.length !== tiles.length) {
        throw new Error(
          `Layer "${id}" collisionEdges height ${collisionEdges.length} does not match tiles height ${tiles.length}.`,
        );
      }
      collisionEdges = collisionEdges.map((row, rowIndex) =>
        normalizeCollisionEdgeRow(row, tiles[rowIndex].length, id, rowIndex),
      );
    } else {
      collisionEdges = tiles.map((row) => '0'.repeat(row.length));
    }

    return {
      id,
      name,
      tiles,
      rotations,
      collisionEdges,
      visible: layer.visible !== false,
      collision: layer.collision !== false,
    };
  });
}

function validateTileRows(rows: string[], scope: string): void {
  const width = rows[0]?.length ?? 0;
  if (width <= 0) {
    throw new Error(`${scope} rows cannot be empty.`);
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.length !== width) {
      throw new Error(`${scope} row ${index} width must match row 0 width (${width}).`);
    }
    for (const code of row) {
      if (!code || code.length !== 1) {
        throw new Error(`Invalid tile code "${code}" at ${scope.toLowerCase()} row ${index}.`);
      }
    }
  }
}

function normalizeRotationRow(rawRow: string, width: number, layerId: string, rowIndex: number): string {
  if (rawRow.length !== width) {
    throw new Error(
      `Layer "${layerId}" rotations row ${rowIndex} width ${rawRow.length} does not match expected ${width}.`,
    );
  }
  let normalized = '';
  for (const char of rawRow) {
    const parsed = Number.parseInt(char, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 3) {
      throw new Error(`Layer "${layerId}" rotation "${char}" at row ${rowIndex} must be 0-3.`);
    }
    normalized += String(parsed);
  }
  return normalized;
}

function normalizeCollisionEdgeRow(rawRow: string, width: number, layerId: string, rowIndex: number): string {
  if (rawRow.length !== width) {
    throw new Error(
      `Layer "${layerId}" collisionEdges row ${rowIndex} width ${rawRow.length} does not match expected ${width}.`,
    );
  }

  let normalized = '';
  for (const char of rawRow) {
    const parsed = Number.parseInt(char, 16);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 15) {
      throw new Error(`Layer "${layerId}" collision edge "${char}" at row ${rowIndex} must be hex 0-f.`);
    }
    normalized += parsed.toString(16);
  }

  return normalized;
}

function scanMapFiles(): MapFileMeta[] {
  if (!fs.existsSync(mapsDir)) {
    return [];
  }

  const entries = fs
    .readdirSync(mapsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'index.ts');

  const metas: MapFileMeta[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(mapsDir, entry.name);
    const source = fs.readFileSync(absolutePath, 'utf8');
    const exportMatch = source.match(/export const\s+([A-Za-z0-9_]+)\s*=\s*createMap\(/);
    const idMatch = source.match(/id:\s*'([^']+)'/);
    if (!exportMatch || !idMatch) {
      continue;
    }

    const fileBase = entry.name.replace(/\.ts$/, '');
    metas.push({
      id: idMatch[1],
      constName: exportMatch[1],
      fileName: entry.name,
      fileBase,
      absolutePath,
    });
  }

  return metas;
}

function readExistingIndexOrder(): string[] {
  if (!fs.existsSync(mapsIndexPath)) {
    return [];
  }

  const source = fs.readFileSync(mapsIndexPath, 'utf8');
  const match = source.match(/WORLD_MAPS:\s*WorldMap\[\]\s*=\s*\[([\s\S]*?)\]/);
  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(entry));
}

function toTsLiteral(value: unknown, indent: number): string {
  const pad = ' '.repeat(indent);

  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const entries = value.map((entry) => `${' '.repeat(indent + 2)}${toTsLiteral(entry, indent + 2)}`);
    return `[\n${entries.join(',\n')}\n${pad}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return '{}';
    }

    const lines = entries.map(([key, entryValue]) => {
      const keyLiteral = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : `'${key}'`;
      return `${' '.repeat(indent + 2)}${keyLiteral}: ${toTsLiteral(entryValue, indent + 2)}`;
    });
    return `{\n${lines.join(',\n')}\n${pad}}`;
  }

  return 'undefined';
}

function buildMapFileSource(map: EditableMapPayload): { source: string; constName: string } {
  const constName = toMapConstName(map.id);
  const payload: Record<string, unknown> = {
    id: map.id,
    name: map.name,
  };

  if (shouldSerializeAsLegacyTiles(map)) {
    payload.tiles = map.layers?.[0].tiles ?? map.tiles ?? [];
  } else if (Array.isArray(map.layers) && map.layers.length > 0) {
    payload.layers = map.layers.map((layer) => {
      const layerPayload: Record<string, unknown> = {
        id: layer.id,
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
  } else {
    payload.tiles = map.tiles ?? [];
  }

  if (map.npcs.length > 0) {
    payload.npcs = map.npcs;
  }
  if (map.warps.length > 0) {
    payload.warps = map.warps;
  }
  if (map.interactions.length > 0) {
    payload.interactions = map.interactions;
  }

  const source = [
    "import { createMap } from '@/game/world/mapBuilder';",
    '',
    `export const ${constName} = createMap(${toTsLiteral(payload, 0)});`,
    '',
  ].join('\n');

  return { source, constName };
}

function shouldSerializeAsLegacyTiles(map: EditableMapPayload): boolean {
  if (!Array.isArray(map.layers) || map.layers.length !== 1) {
    return false;
  }
  const layer = map.layers[0];
  if (layer.id !== 'base' || layer.name !== 'Base' || layer.visible === false || layer.collision === false) {
    return false;
  }
  return (
    !layer.rotations.some((row) => /[1-3]/.test(row)) &&
    !layer.collisionEdges.some((row) => /[1-9a-f]/i.test(row))
  );
}

function writeMapsIndex(metas: MapFileMeta[]): void {
  const orderFromExisting = readExistingIndexOrder();
  const byConst = new Map(metas.map((meta) => [meta.constName, meta]));
  const ordered: MapFileMeta[] = [];
  const seen = new Set<string>();

  for (const constName of orderFromExisting) {
    const meta = byConst.get(constName);
    if (!meta) {
      continue;
    }
    ordered.push(meta);
    seen.add(meta.absolutePath);
  }

  const rest = metas
    .filter((meta) => !seen.has(meta.absolutePath))
    .sort((a, b) => a.id.localeCompare(b.id));
  ordered.push(...rest);

  const imports = ordered.map(
    (meta) => `import { ${meta.constName} } from '@/game/data/maps/${meta.fileBase}';`,
  );
  const worldMaps = ordered.map((meta) => meta.constName).join(', ');

  const source = [
    "import type { WorldMap } from '@/game/world/types';",
    ...imports,
    '',
    `export const WORLD_MAPS: WorldMap[] = [${worldMaps}];`,
    '',
    'export const WORLD_MAP_REGISTRY = WORLD_MAPS.reduce<Record<string, WorldMap>>(',
    '  (registry, map) => {',
    '    registry[map.id] = map;',
    '    return registry;',
    '  },',
    '  {},',
    ');',
    '',
  ].join('\n');

  fs.writeFileSync(mapsIndexPath, source, 'utf8');
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function colorForCode(code: string, offset: number): string {
  let hash = 0;
  for (const char of code) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const hue = (hash + offset * 31) % 360;
  return hslToHex(hue, 45, offset === 0 ? 42 : 58);
}

function parseSavedPaintTiles(raw: unknown): SavedPaintTilePayload[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed: SavedPaintTilePayload[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as SavedPaintTilePayload;
    const cells = Array.isArray(record.cells)
      ? record.cells
          .filter((cell) => cell && typeof cell === 'object')
          .map((cell) => ({
            code: typeof cell.code === 'string' ? cell.code.slice(0, 1) : '',
            atlasIndex: typeof cell.atlasIndex === 'number' ? Math.max(0, Math.floor(cell.atlasIndex)) : 0,
            dx: typeof cell.dx === 'number' ? Math.floor(cell.dx) : 0,
            dy: typeof cell.dy === 'number' ? Math.floor(cell.dy) : 0,
          }))
      : [];

    if (cells.length === 0) {
      continue;
    }

    parsed.push({
      id: typeof record.id === 'string' ? record.id : `tile-${Date.now()}-${parsed.length}`,
      name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'Saved Tile',
      primaryCode:
        typeof record.primaryCode === 'string' && record.primaryCode.trim()
          ? record.primaryCode.slice(0, 1)
          : cells[0].code,
      width: typeof record.width === 'number' ? Math.max(1, Math.floor(record.width)) : 1,
      height: typeof record.height === 'number' ? Math.max(1, Math.floor(record.height)) : 1,
      cells,
    });
  }

  return parsed;
}

function getMapTileRows(map: EditableMapPayload): string[] {
  if (Array.isArray(map.layers) && map.layers.length > 0) {
    return map.layers.flatMap((layer) => layer.tiles);
  }
  return Array.isArray(map.tiles) ? map.tiles : [];
}

function writeCustomTiles(
  savedPaintTiles: SavedPaintTilePayload[],
  map: EditableMapPayload,
  tileset: SaveMapRequestPayload['tileset'],
): string[] {
  const savedTileDatabase = savedPaintTiles.map((tile) => {
    const cells = Array.isArray(tile.cells)
      ? tile.cells.map((cell) => ({
          code: typeof cell.code === 'string' ? cell.code.slice(0, 1) : '',
          atlasIndex: typeof cell.atlasIndex === 'number' ? Math.max(0, Math.floor(cell.atlasIndex)) : 0,
          dx: typeof cell.dx === 'number' ? Math.floor(cell.dx) : 0,
          dy: typeof cell.dy === 'number' ? Math.floor(cell.dy) : 0,
        }))
      : [];

    return {
      id: typeof tile.id === 'string' ? tile.id : '',
      name: typeof tile.name === 'string' ? tile.name : 'Saved Tile',
      primaryCode:
        typeof tile.primaryCode === 'string' && tile.primaryCode
          ? tile.primaryCode.slice(0, 1)
          : (cells[0]?.code ?? ''),
      width: typeof tile.width === 'number' ? Math.max(1, Math.floor(tile.width)) : 1,
      height: typeof tile.height === 'number' ? Math.max(1, Math.floor(tile.height)) : 1,
      cells,
    };
  });

  const customEntries = new Map<string, { label: string; atlasIndex: number }>();
  for (const tile of savedPaintTiles) {
    const tileName =
      typeof tile.name === 'string' && tile.name.trim() ? tile.name.trim() : 'Custom Tile';
    const cells = Array.isArray(tile.cells) ? tile.cells : [];
    for (const cell of cells) {
      const code = typeof cell.code === 'string' ? cell.code.trim().slice(0, 1) : '';
      const atlasIndex = typeof cell.atlasIndex === 'number' ? Math.max(0, Math.floor(cell.atlasIndex)) : 0;
      if (!code || BASE_TILE_CODES.has(code) || customEntries.has(code)) {
        continue;
      }
      customEntries.set(code, {
        label: `${tileName} ${code}`.slice(0, 60),
        atlasIndex,
      });
    }
  }
  for (const row of getMapTileRows(map)) {
    for (const rawCode of row) {
      const code = rawCode.slice(0, 1);
      if (!code || BASE_TILE_CODES.has(code) || customEntries.has(code)) {
        continue;
      }
      customEntries.set(code, {
        label: `Map Tile ${code}`,
        atlasIndex: 0,
      });
    }
  }

  const safeTileset =
    tileset &&
    typeof tileset.url === 'string' &&
    tileset.url &&
    !tileset.url.startsWith('blob:') &&
    typeof tileset.tilePixelWidth === 'number' &&
    Number.isFinite(tileset.tilePixelWidth) &&
    tileset.tilePixelWidth > 0 &&
    typeof tileset.tilePixelHeight === 'number' &&
    Number.isFinite(tileset.tilePixelHeight) &&
    tileset.tilePixelHeight > 0
      ? {
          url: tileset.url,
          tileWidth: Math.floor(tileset.tilePixelWidth),
          tileHeight: Math.floor(tileset.tilePixelHeight),
        }
      : null;

  const entries = Array.from(customEntries.entries()).sort(([a], [b]) => a.localeCompare(b));
  const customDefinitions: Record<string, unknown> = {};
  for (const [code, entry] of entries) {
    customDefinitions[code] = {
      code,
      label: entry.label,
      walkable: true,
      color: colorForCode(code, 0),
      accentColor: colorForCode(code, 1),
      height: 0,
      atlasIndex: entry.atlasIndex,
    };
  }

  const source = [
    "import type { TileDefinition } from '@/game/world/types';",
    '',
    'export interface CustomTilesetConfig {',
    '  url: string;',
    '  tileWidth: number;',
    '  tileHeight: number;',
    '}',
    '',
    `export const CUSTOM_TILESET_CONFIG: CustomTilesetConfig | null = ${toTsLiteral(safeTileset, 0)};`,
    '',
    `export const CUSTOM_TILE_DEFINITIONS: Record<string, TileDefinition> = ${toTsLiteral(customDefinitions, 0)};`,
    '',
    'export interface SavedPaintTileDatabaseCell {',
    '  code: string;',
    '  atlasIndex: number;',
    '  dx: number;',
    '  dy: number;',
    '}',
    '',
    'export interface SavedPaintTileDatabaseEntry {',
    '  id: string;',
    '  name: string;',
    '  primaryCode: string;',
    '  width: number;',
    '  height: number;',
    '  cells: SavedPaintTileDatabaseCell[];',
    '}',
    '',
    `export const SAVED_PAINT_TILE_DATABASE: SavedPaintTileDatabaseEntry[] = ${toTsLiteral(savedTileDatabase, 0)};`,
    '',
  ].join('\n');

  fs.writeFileSync(customTilesPath, source, 'utf8');
  return entries.map(([code]) => code);
}

function saveMapToProject(payload: SaveMapRequestPayload): {
  mapId: string;
  mapFilePath: string;
  indexFilePath: string;
  customTilesFilePath: string;
  customTileCodes: string[];
} {
  const map = parseEditableMapPayload(payload);
  const existingMapId =
    typeof payload.existingMapId === 'string' && payload.existingMapId.trim()
      ? payload.existingMapId.trim()
      : null;

  const metasBefore = scanMapFiles();
  const byId = new Map(metasBefore.map((meta) => [meta.id, meta]));
  const targetMeta = existingMapId ? byId.get(existingMapId) : byId.get(map.id);

  const fileBase = targetMeta?.fileBase ?? toMapFileBaseName(map.id);
  const fileName = `${fileBase}.ts`;
  const absoluteMapPath = targetMeta?.absolutePath ?? path.join(mapsDir, fileName);
  const mapSource = buildMapFileSource(map);

  fs.mkdirSync(mapsDir, { recursive: true });
  fs.writeFileSync(absoluteMapPath, mapSource.source, 'utf8');

  const customTileCodes = writeCustomTiles(
    parseSavedPaintTiles(payload.savedPaintTiles),
    map,
    payload.tileset ?? null,
  );
  const metasAfter = scanMapFiles();
  writeMapsIndex(metasAfter);

  return {
    mapId: map.id,
    mapFilePath: path.relative(repoRoot, absoluteMapPath),
    indexFilePath: path.relative(repoRoot, mapsIndexPath),
    customTilesFilePath: path.relative(repoRoot, customTilesPath),
    customTileCodes,
  };
}

function saveTileDatabaseToProject(payload: SaveTilesRequestPayload): {
  customTilesFilePath: string;
  customTileCodes: string[];
} {
  const fallbackMap: EditableMapPayload = {
    id: 'tile-database',
    name: 'Tile Database',
    tiles: ['.'],
    npcs: [],
    warps: [],
    interactions: [],
  };

  const mapPayload = payload.map ? parseEditableMapPayload({ map: payload.map }) : fallbackMap;
  const customTileCodes = writeCustomTiles(
    parseSavedPaintTiles(payload.savedPaintTiles),
    mapPayload,
    payload.tileset ?? null,
  );

  return {
    customTilesFilePath: path.relative(repoRoot, customTilesPath),
    customTileCodes,
  };
}

function parseSpriteFrame(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function parseWalkFrames(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry))
    .map((entry) => Math.max(0, Math.floor(entry)));
}

function savePlayerSpriteToProject(payload: SavePlayerSpriteRequestPayload): { filePath: string } {
  const sprite = payload.playerSprite;
  if (!sprite || typeof sprite !== 'object') {
    throw new Error('Missing playerSprite payload.');
  }
  if (typeof sprite.url !== 'string' || !sprite.url.trim()) {
    throw new Error('playerSprite.url is required.');
  }

  const frameWidth =
    typeof sprite.frameWidth === 'number' && Number.isFinite(sprite.frameWidth)
      ? Math.max(1, Math.floor(sprite.frameWidth))
      : 32;
  const frameHeight =
    typeof sprite.frameHeight === 'number' && Number.isFinite(sprite.frameHeight)
      ? Math.max(1, Math.floor(sprite.frameHeight))
      : 32;
  const atlasCellWidth =
    typeof sprite.atlasCellWidth === 'number' && Number.isFinite(sprite.atlasCellWidth)
      ? Math.max(1, Math.floor(sprite.atlasCellWidth))
      : frameWidth;
  const atlasCellHeight =
    typeof sprite.atlasCellHeight === 'number' && Number.isFinite(sprite.atlasCellHeight)
      ? Math.max(1, Math.floor(sprite.atlasCellHeight))
      : frameHeight;
  const frameCellsWide =
    typeof sprite.frameCellsWide === 'number' && Number.isFinite(sprite.frameCellsWide)
      ? Math.max(1, Math.floor(sprite.frameCellsWide))
      : 1;
  const frameCellsTall =
    typeof sprite.frameCellsTall === 'number' && Number.isFinite(sprite.frameCellsTall)
      ? Math.max(1, Math.floor(sprite.frameCellsTall))
      : 2;
  const renderWidthTiles =
    typeof sprite.renderWidthTiles === 'number' && Number.isFinite(sprite.renderWidthTiles)
      ? Math.max(1, Math.floor(sprite.renderWidthTiles))
      : 1;
  const renderHeightTiles =
    typeof sprite.renderHeightTiles === 'number' && Number.isFinite(sprite.renderHeightTiles)
      ? Math.max(1, Math.floor(sprite.renderHeightTiles))
      : 2;

  const facingFrames = {
    down: parseSpriteFrame(sprite.facingFrames?.down),
    left: parseSpriteFrame(sprite.facingFrames?.left),
    right: parseSpriteFrame(sprite.facingFrames?.right),
    up: parseSpriteFrame(sprite.facingFrames?.up),
  };
  const walkFrames = {
    down: parseWalkFrames(sprite.walkFrames?.down),
    left: parseWalkFrames(sprite.walkFrames?.left),
    right: parseWalkFrames(sprite.walkFrames?.right),
    up: parseWalkFrames(sprite.walkFrames?.up),
  };

  const source = [
    "import type { NpcSpriteConfig } from '@/game/world/types';",
    '',
    `export const PLAYER_SPRITE_CONFIG: NpcSpriteConfig = ${toTsLiteral(
      {
        url: sprite.url.trim(),
        frameWidth,
        frameHeight,
        atlasCellWidth,
        atlasCellHeight,
        frameCellsWide,
        frameCellsTall,
        renderWidthTiles,
        renderHeightTiles,
        facingFrames,
        walkFrames,
      },
      0,
    )};`,
    '',
  ].join('\n');

  fs.writeFileSync(playerSpritePath, source, 'utf8');
  return {
    filePath: path.relative(repoRoot, playerSpritePath),
  };
}

function createAdminMapApiPlugin(): Plugin {
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url?.split('?')[0] ?? '';
    if (url !== '/api/admin/maps/save' && url !== '/api/admin/tiles/save' && url !== '/api/admin/player-sprite/save') {
      next();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    try {
      const rawBody = await readJsonBody(req);
      if (url === '/api/admin/maps/save') {
        const result = saveMapToProject(rawBody as SaveMapRequestPayload);
        sendJson(res, 200, { ok: true, ...result });
        return;
      }
      if (url === '/api/admin/player-sprite/save') {
        const result = savePlayerSpriteToProject(rawBody as SavePlayerSpriteRequestPayload);
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      const result = saveTileDatabaseToProject(rawBody as SaveTilesRequestPayload);
      sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error while saving map.';
      sendJson(res, 400, { ok: false, error: message });
    }
  };

  return {
    name: 'admin-map-save-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void middleware(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void middleware(req, res, next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), createAdminMapApiPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        game: resolve(fileURLToPath(new URL('.', import.meta.url)), 'index.html'),
        admin: resolve(fileURLToPath(new URL('.', import.meta.url)), 'admin.html'),
      },
    },
  },
});
