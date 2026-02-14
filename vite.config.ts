import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

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
const defaultPlayerSpriteUrl = '/example_assets/character_npc_spritesheets/main_character_spritesheet.png';

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
    animationSets?: unknown;
    defaultIdleAnimation?: unknown;
    defaultMoveAnimation?: unknown;
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

interface AuthRequestPayload {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
}

interface SaveGameRequestPayload {
  save?: unknown;
}

interface PasswordRequestPayload {
  password?: unknown;
}

interface SaveNpcLibraryRequestPayload {
  npcSpriteLibrary?: unknown;
  npcCharacterLibrary?: unknown;
}

interface SupabaseStorageListEntry {
  name?: unknown;
  id?: unknown;
  metadata?: unknown;
  updated_at?: unknown;
}

interface SupabaseStorageSpriteSheet {
  name: string;
  path: string;
  publicUrl: string;
  updatedAt: string | null;
}

interface SupabaseStorageConfig {
  url: string;
  serviceKey: string;
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

function normalizeSupabaseStorageConfig(rawUrl: string, serviceRoleKey: string): SupabaseStorageConfig | null {
  const url = rawUrl.trim().replace(/\/+$/, '');
  const key = serviceRoleKey.trim();
  if (!url || !key) {
    return null;
  }
  return { url, serviceKey: key };
}

function sanitizeStorageBucketName(value: string | null): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return 'character-spritesheets';
  }
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, '');
}

function sanitizeStoragePrefix(value: string | null): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return '';
  }
  return trimmed
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/{2,}/g, '/');
}

function toPublicObjectUrl(baseUrl: string, bucket: string, objectPath: string): string {
  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = objectPath
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${baseUrl}/storage/v1/object/public/${encodedBucket}/${encodedPath}`;
}

async function listSupabasePngSpriteSheets(
  config: SupabaseStorageConfig,
  bucket: string,
  prefix: string,
): Promise<SupabaseStorageSpriteSheet[]> {
  const files: SupabaseStorageSpriteSheet[] = [];
  const queue: string[] = [prefix];
  const visited = new Set<string>();
  const limit = 100;

  while (queue.length > 0) {
    const currentPrefix = queue.shift() ?? '';
    if (visited.has(currentPrefix)) {
      continue;
    }
    visited.add(currentPrefix);

    let offset = 0;
    while (true) {
      const response = await fetch(`${config.url}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
        method: 'POST',
        headers: {
          apikey: config.serviceKey,
          Authorization: `Bearer ${config.serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: currentPrefix,
          limit,
          offset,
          sortBy: {
            column: 'name',
            order: 'asc',
          },
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Unable to list Supabase bucket objects (${response.status}): ${detail || response.statusText}`);
      }

      const payload = (await response.json()) as unknown;
      const entries = Array.isArray(payload) ? (payload as SupabaseStorageListEntry[]) : [];
      for (const entry of entries) {
        const rawName = typeof entry.name === 'string' ? entry.name.trim() : '';
        if (!rawName) {
          continue;
        }
        const fullPath = currentPrefix ? `${currentPrefix}/${rawName}` : rawName;
        const lowerName = rawName.toLowerCase();
        const isFolder =
          entry.id === null &&
          (entry.metadata === null || entry.metadata === undefined || typeof entry.metadata !== 'object') &&
          !lowerName.endsWith('.png');
        if (isFolder) {
          queue.push(fullPath);
          continue;
        }
        if (!lowerName.endsWith('.png')) {
          continue;
        }

        files.push({
          name: rawName,
          path: fullPath,
          publicUrl: toPublicObjectUrl(config.url, bucket, fullPath),
          updatedAt: typeof entry.updated_at === 'string' ? entry.updated_at : null,
        });
      }

      if (entries.length < limit) {
        break;
      }
      offset += entries.length;
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
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

function parseDirectionalAnimationSets(
  value: unknown,
): Partial<Record<string, Partial<Record<'up' | 'down' | 'left' | 'right', number[]>>>> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const sanitized: Partial<Record<string, Partial<Record<'up' | 'down' | 'left' | 'right', number[]>>>> = {};
  for (const [name, rawDirections] of Object.entries(record)) {
    const animationName = name.trim();
    if (!animationName) {
      continue;
    }
    const directionRecord =
      rawDirections && typeof rawDirections === 'object' && !Array.isArray(rawDirections)
        ? (rawDirections as Partial<Record<'up' | 'down' | 'left' | 'right', unknown>>)
        : {};
    const parsedDirections: Partial<Record<'up' | 'down' | 'left' | 'right', number[]>> = {
      up: [],
      down: [],
      left: [],
      right: [],
    };
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      const parsedFrames = parseWalkFrames(directionRecord[direction]);
      parsedDirections[direction] = parsedFrames;
    }
    sanitized[animationName] = parsedDirections;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeLoadedPlayerSpriteConfig(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  if (!url || url.startsWith('blob:')) {
    return null;
  }
  return record;
}

function savePlayerSpriteToProject(payload: SavePlayerSpriteRequestPayload): {
  filePath: string;
  spriteConfig: Record<string, unknown>;
} {
  const sprite = payload.playerSprite;
  if (!sprite || typeof sprite !== 'object') {
    throw new Error('Missing playerSprite payload.');
  }
  if (typeof sprite.url !== 'string' || !sprite.url.trim()) {
    throw new Error('playerSprite.url is required.');
  }
  const spriteUrl = sprite.url.trim();
  if (spriteUrl.startsWith('blob:')) {
    throw new Error('playerSprite.url cannot be a temporary blob URL. Use a file path or data URL.');
  }
  const fileSpriteUrl = spriteUrl.startsWith('data:') ? defaultPlayerSpriteUrl : spriteUrl;

  const frameWidth =
    typeof sprite.frameWidth === 'number' && Number.isFinite(sprite.frameWidth)
      ? Math.max(1, Math.floor(sprite.frameWidth))
      : 64;
  const frameHeight =
    typeof sprite.frameHeight === 'number' && Number.isFinite(sprite.frameHeight)
      ? Math.max(1, Math.floor(sprite.frameHeight))
      : 64;
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
  const animationSets = parseDirectionalAnimationSets(sprite.animationSets);
  const defaultIdleAnimation =
    typeof sprite.defaultIdleAnimation === 'string' && sprite.defaultIdleAnimation.trim()
      ? sprite.defaultIdleAnimation.trim()
      : undefined;
  const defaultMoveAnimation =
    typeof sprite.defaultMoveAnimation === 'string' && sprite.defaultMoveAnimation.trim()
      ? sprite.defaultMoveAnimation.trim()
      : undefined;

  const source = [
    "import type { NpcSpriteConfig } from '@/game/world/types';",
    '',
    `export const PLAYER_SPRITE_CONFIG: NpcSpriteConfig = ${toTsLiteral(
      {
        url: fileSpriteUrl,
        frameWidth,
        frameHeight,
        atlasCellWidth,
        atlasCellHeight,
        frameCellsWide,
        frameCellsTall,
        renderWidthTiles,
        renderHeightTiles,
        animationSets,
        defaultIdleAnimation,
        defaultMoveAnimation,
        facingFrames,
        walkFrames,
      },
      0,
    )};`,
    '',
  ].join('\n');

  fs.writeFileSync(playerSpritePath, source, 'utf8');
  const spriteConfig = {
    url: spriteUrl,
    frameWidth,
    frameHeight,
    atlasCellWidth,
    atlasCellHeight,
    frameCellsWide,
    frameCellsTall,
    renderWidthTiles,
    renderHeightTiles,
    animationSets,
    defaultIdleAnimation,
    defaultMoveAnimation,
    facingFrames,
    walkFrames,
  };
  return {
    filePath: path.relative(repoRoot, playerSpritePath),
    spriteConfig,
  };
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return null;
  }
  return normalized;
}

function sanitizeDisplayName(value: unknown): string {
  if (typeof value !== 'string') {
    return 'Trainer';
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 30) : 'Trainer';
}

function extractBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }
  if (!header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSessionToken(): { token: string; tokenHash: string; expiresAtIso: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAtIso = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  return { token, tokenHash, expiresAtIso };
}

function sanitizeTilesetConfig(raw: SaveMapRequestPayload['tileset']): {
  url: string;
  tilePixelWidth: number;
  tilePixelHeight: number;
} | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  const tilePixelWidth =
    typeof raw.tilePixelWidth === 'number' && Number.isFinite(raw.tilePixelWidth)
      ? Math.max(1, Math.floor(raw.tilePixelWidth))
      : 0;
  const tilePixelHeight =
    typeof raw.tilePixelHeight === 'number' && Number.isFinite(raw.tilePixelHeight)
      ? Math.max(1, Math.floor(raw.tilePixelHeight))
      : 0;

  if (!url || tilePixelWidth <= 0 || tilePixelHeight <= 0) {
    return null;
  }
  return { url, tilePixelWidth, tilePixelHeight };
}

function buildCustomTileDefinitions(savedPaintTiles: SavedPaintTilePayload[]): Record<string, unknown> {
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

  const entries = Array.from(customEntries.entries()).sort(([a], [b]) => a.localeCompare(b));
  const definitions: Record<string, unknown> = {};
  for (const [code, entry] of entries) {
    definitions[code] = {
      code,
      label: entry.label,
      walkable: true,
      color: colorForCode(code, 0),
      accentColor: colorForCode(code, 1),
      height: 0,
      atlasIndex: entry.atlasIndex,
    };
  }
  return definitions;
}

const WORLD_MAP_BASELINE_VERSION = 1;
const SPAWN_MAP_ID = 'spawn';

function createSpawnMapPayload(): EditableMapPayload {
  const width = 11;
  const height = 9;
  const blankRow = '.'.repeat(width);
  const emptyCollisionRow = '0'.repeat(width);

  return {
    id: SPAWN_MAP_ID,
    name: 'Portlock Beach',
    layers: [
      {
        id: 'base',
        name: 'Base',
        tiles: Array.from({ length: height }, () => blankRow),
        rotations: Array.from({ length: height }, () => emptyCollisionRow),
        collisionEdges: Array.from({ length: height }, () => emptyCollisionRow),
        visible: true,
        collision: true,
      },
    ],
    npcs: [],
    warps: [],
    interactions: [],
  };
}

function createAdminMapApiPlugin(dbConnectionString: string, supabaseStorageConfig: SupabaseStorageConfig | null): Plugin {
  const pool =
    dbConnectionString.trim().length > 0
      ? new Pool({
          connectionString: dbConnectionString.trim(),
          connectionTimeoutMillis: 5000,
          idleTimeoutMillis: 10000,
          ssl: {
            rejectUnauthorized: false,
          },
        })
      : null;
  let schemaReady = false;

  const ensureSchema = async () => {
    if (!pool) {
      throw new Error('DB_CONNECTION_STRING is missing. Configure it in .env.');
    }
    if (schemaReady) {
      return;
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_saves (
        user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
        save_data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS world_maps (
        owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        map_id TEXT NOT NULL,
        map_data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (owner_user_id, map_id)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_world_state (
        owner_user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
        map_init_version INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tile_libraries (
        owner_user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
        tileset_config JSONB,
        saved_tiles JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS npc_libraries (
        owner_user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
        sprite_library JSONB NOT NULL DEFAULT '[]'::jsonb,
        character_library JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_sprite_configs (
        owner_user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
        sprite_config JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS critter_libraries (
        owner_user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
        critters JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    schemaReady = true;
  };

  const ensureWorldBaselineForUser = async (userId: string): Promise<void> => {
    await ensureSchema();
    if (!pool) {
      throw new Error('Database unavailable.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const stateResult = await client.query(
        'SELECT map_init_version FROM user_world_state WHERE owner_user_id = $1',
        [userId],
      );
      const mapInitVersion = Number(stateResult.rows[0]?.map_init_version ?? 0);
      const mapCountResult = await client.query('SELECT COUNT(*)::int AS count FROM world_maps WHERE owner_user_id = $1', [
        userId,
      ]);
      const mapCount = Number(mapCountResult.rows[0]?.count ?? 0);

      if (mapInitVersion < WORLD_MAP_BASELINE_VERSION) {
        if (mapCount === 0) {
          const spawnMap = createSpawnMapPayload();
          await client.query(
            `
              INSERT INTO world_maps (owner_user_id, map_id, map_data, updated_at)
              VALUES ($1, $2, $3::jsonb, NOW())
              ON CONFLICT (owner_user_id, map_id)
              DO UPDATE SET map_data = EXCLUDED.map_data, updated_at = NOW()
            `,
            [userId, spawnMap.id, JSON.stringify(spawnMap)],
          );
        }
        await client.query(
          `
            INSERT INTO user_world_state (owner_user_id, map_init_version, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (owner_user_id)
            DO UPDATE SET map_init_version = EXCLUDED.map_init_version, updated_at = NOW()
          `,
          [userId, WORLD_MAP_BASELINE_VERSION],
        );
      } else if (mapCount === 0) {
        const spawnMap = createSpawnMapPayload();
        await client.query(
          `
            INSERT INTO world_maps (owner_user_id, map_id, map_data, updated_at)
            VALUES ($1, $2, $3::jsonb, NOW())
            ON CONFLICT (owner_user_id, map_id)
            DO UPDATE SET map_data = EXCLUDED.map_data, updated_at = NOW()
          `,
          [userId, spawnMap.id, JSON.stringify(spawnMap)],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  const requireAuth = async (req: IncomingMessage, res: ServerResponse) => {
    await ensureSchema();
    if (!pool) {
      sendJson(res, 500, { ok: false, error: 'Database unavailable.' });
      return null;
    }

    const token = extractBearerToken(req);
    if (!token) {
      sendJson(res, 401, { ok: false, error: 'Authentication required.' });
      return null;
    }

    const tokenHash = hashToken(token);
    const sessionResult = await pool.query(
      `
        SELECT u.id, u.email, u.display_name
        FROM app_sessions s
        JOIN app_users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > NOW()
      `,
      [tokenHash],
    );
    const user = sessionResult.rows[0] as { id: string; email: string; display_name: string } | undefined;
    if (!user) {
      sendJson(res, 401, { ok: false, error: 'Session expired. Please sign in again.' });
      return null;
    }

    return {
      token,
      tokenHash,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    };
  };

  const rewriteAdminRoute = (req: IncomingMessage, _res: ServerResponse, next: () => void) => {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      next();
      return;
    }

    const [pathname, query = ''] = (req.url ?? '').split('?');
    const isAdminRoutePath =
      pathname === '/admin' ||
      pathname === '/admin/' ||
      pathname === '/admin.html' ||
      /^\/admin\/[a-z0-9-]+\/?$/i.test(pathname ?? '');

    if (!isAdminRoutePath) {
      next();
      return;
    }

    req.url = query ? `/admin.html?${query}` : '/admin.html';
    next();
  };

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url?.split('?')[0] ?? '';
    const handledRoutes = new Set([
      '/api/auth/signup',
      '/api/auth/login',
      '/api/auth/session',
      '/api/auth/logout',
      '/api/game/save',
      '/api/game/reset',
      '/api/content/bootstrap',
      '/api/admin/maps/save',
      '/api/admin/maps/list',
      '/api/admin/tiles/save',
      '/api/admin/tiles/list',
      '/api/admin/npc/save',
      '/api/admin/npc/list',
      '/api/admin/player-sprite/save',
      '/api/admin/player-sprite/get',
      '/api/admin/spritesheets/list',
      '/api/admin/critters/save',
      '/api/admin/critters/list',
    ]);
    if (!handledRoutes.has(url)) {
      next();
      return;
    }

    try {
      if (url === '/api/auth/signup' && req.method === 'POST') {
        await ensureSchema();
        if (!pool) {
          sendJson(res, 500, { ok: false, error: 'Database unavailable.' });
          return;
        }
        const body = (await readJsonBody(req)) as AuthRequestPayload;
        const email = normalizeEmail(body.email);
        const password = typeof body.password === 'string' ? body.password : '';
        const displayName = sanitizeDisplayName(body.displayName);
        if (!email) {
          sendJson(res, 400, { ok: false, error: 'A valid email is required.' });
          return;
        }
        if (password.length < 8) {
          sendJson(res, 400, { ok: false, error: 'Password must be at least 8 characters.' });
          return;
        }

        const existing = await pool.query('SELECT id FROM app_users WHERE email = $1', [email]);
        if (existing.rowCount && existing.rowCount > 0) {
          sendJson(res, 409, { ok: false, error: 'An account with this email already exists.' });
          return;
        }

        const userId = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(password, 10);
        await pool.query(
          `
            INSERT INTO app_users (id, email, password_hash, display_name, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
          `,
          [userId, email, passwordHash, displayName],
        );

        const session = createSessionToken();
        await pool.query(
          `
            INSERT INTO app_sessions (token_hash, user_id, expires_at, created_at)
            VALUES ($1, $2, $3, NOW())
          `,
          [session.tokenHash, userId, session.expiresAtIso],
        );

        sendJson(res, 200, {
          ok: true,
          session: {
            token: session.token,
            user: {
              id: userId,
              email,
              displayName,
            },
          },
        });
        return;
      }

      if (url === '/api/auth/login' && req.method === 'POST') {
        await ensureSchema();
        if (!pool) {
          sendJson(res, 500, { ok: false, error: 'Database unavailable.' });
          return;
        }
        const body = (await readJsonBody(req)) as AuthRequestPayload;
        const email = normalizeEmail(body.email);
        const password = typeof body.password === 'string' ? body.password : '';
        if (!email || !password) {
          sendJson(res, 400, { ok: false, error: 'Email and password are required.' });
          return;
        }

        const userResult = await pool.query(
          'SELECT id, email, display_name, password_hash FROM app_users WHERE email = $1',
          [email],
        );
        const user = userResult.rows[0] as
          | {
              id: string;
              email: string;
              display_name: string;
              password_hash: string;
            }
          | undefined;
        if (!user) {
          sendJson(res, 401, { ok: false, error: 'Invalid email or password.' });
          return;
        }

        const passwordMatches = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatches) {
          sendJson(res, 401, { ok: false, error: 'Invalid email or password.' });
          return;
        }

        const session = createSessionToken();
        await pool.query('DELETE FROM app_sessions WHERE user_id = $1', [user.id]);
        await pool.query(
          `
            INSERT INTO app_sessions (token_hash, user_id, expires_at, created_at)
            VALUES ($1, $2, $3, NOW())
          `,
          [session.tokenHash, user.id, session.expiresAtIso],
        );

        sendJson(res, 200, {
          ok: true,
          session: {
            token: session.token,
            user: {
              id: user.id,
              email: user.email,
              displayName: user.display_name,
            },
          },
        });
        return;
      }

      if (url === '/api/auth/session' && req.method === 'GET') {
        const auth = await requireAuth(req, res);
        if (!auth) {
          return;
        }
        sendJson(res, 200, {
          ok: true,
          session: {
            token: auth.token,
            user: auth.user,
          },
        });
        return;
      }

      if (url === '/api/auth/logout' && req.method === 'POST') {
        await ensureSchema();
        if (!pool) {
          sendJson(res, 500, { ok: false, error: 'Database unavailable.' });
          return;
        }
        const token = extractBearerToken(req);
        if (!token) {
          sendJson(res, 200, { ok: true });
          return;
        }
        await pool.query('DELETE FROM app_sessions WHERE token_hash = $1', [hashToken(token)]);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url === '/api/game/save' && req.method === 'GET') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        const saveResult = await pool.query('SELECT save_data FROM user_saves WHERE user_id = $1', [auth.user.id]);
        sendJson(res, 200, { ok: true, save: saveResult.rows[0]?.save_data ?? null });
        return;
      }

      if (url === '/api/game/save' && req.method === 'POST') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        const body = (await readJsonBody(req)) as SaveGameRequestPayload;
        if (!body.save || typeof body.save !== 'object') {
          sendJson(res, 400, { ok: false, error: 'Missing save payload.' });
          return;
        }

        await pool.query(
          `
            INSERT INTO user_saves (user_id, save_data, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET save_data = EXCLUDED.save_data, updated_at = NOW()
          `,
          [auth.user.id, JSON.stringify(body.save)],
        );
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url === '/api/game/reset' && req.method === 'POST') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        const body = (await readJsonBody(req)) as PasswordRequestPayload;
        const password = typeof body.password === 'string' ? body.password : '';
        if (!password) {
          sendJson(res, 400, { ok: false, error: 'Password is required.' });
          return;
        }

        const userResult = await pool.query('SELECT password_hash FROM app_users WHERE id = $1', [auth.user.id]);
        const passwordHash = userResult.rows[0]?.password_hash as string | undefined;
        const passwordMatches = passwordHash ? await bcrypt.compare(password, passwordHash) : false;
        if (!passwordMatches) {
          sendJson(res, 403, { ok: false, error: 'Incorrect password.' });
          return;
        }

        await pool.query('DELETE FROM user_saves WHERE user_id = $1', [auth.user.id]);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url === '/api/content/bootstrap' && req.method === 'GET') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        await ensureWorldBaselineForUser(auth.user.id);
        const [mapsResult, tileResult, playerSpriteResult, crittersResult] = await Promise.all([
          pool.query('SELECT map_data FROM world_maps WHERE owner_user_id = $1 ORDER BY updated_at DESC', [auth.user.id]),
          pool.query('SELECT saved_tiles, tileset_config FROM tile_libraries WHERE owner_user_id = $1', [auth.user.id]),
          pool.query('SELECT sprite_config FROM player_sprite_configs WHERE owner_user_id = $1', [auth.user.id]),
          pool.query('SELECT critters FROM critter_libraries WHERE owner_user_id = $1', [auth.user.id]),
        ]);
        const savedTiles = parseSavedPaintTiles(tileResult.rows[0]?.saved_tiles);
        const customTileDefinitions = buildCustomTileDefinitions(savedTiles);
        sendJson(res, 200, {
          ok: true,
          content: {
            maps: mapsResult.rows.map((row) => row.map_data),
            savedPaintTiles: savedTiles,
            customTileDefinitions,
            customTilesetConfig: tileResult.rows[0]?.tileset_config ?? null,
            playerSpriteConfig: sanitizeLoadedPlayerSpriteConfig(playerSpriteResult.rows[0]?.sprite_config),
            critters: crittersResult.rows[0]?.critters ?? [],
          },
        });
        return;
      }

      if (url === '/api/admin/maps/list' && req.method === 'GET') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        await ensureWorldBaselineForUser(auth.user.id);
        const mapsResult = await pool.query(
          'SELECT map_data FROM world_maps WHERE owner_user_id = $1 ORDER BY updated_at DESC',
          [auth.user.id],
        );
        sendJson(res, 200, { ok: true, maps: mapsResult.rows.map((row) => row.map_data) });
        return;
      }

      if (url === '/api/admin/maps/save' && req.method === 'POST') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        await ensureWorldBaselineForUser(auth.user.id);
        const rawBody = (await readJsonBody(req)) as SaveMapRequestPayload;
        const map = parseEditableMapPayload(rawBody);

        let fileResult: ReturnType<typeof saveMapToProject> | null = null;
        try {
          fileResult = saveMapToProject(rawBody);
        } catch {
          fileResult = null;
        }

        await pool.query(
          `
            INSERT INTO world_maps (owner_user_id, map_id, map_data, updated_at)
            VALUES ($1, $2, $3::jsonb, NOW())
            ON CONFLICT (owner_user_id, map_id)
            DO UPDATE SET map_data = EXCLUDED.map_data, updated_at = NOW()
          `,
          [auth.user.id, map.id, JSON.stringify(map)],
        );

        const savedTiles = parseSavedPaintTiles(rawBody.savedPaintTiles);
        const tilesetConfig = sanitizeTilesetConfig(rawBody.tileset ?? null);
        await pool.query(
          `
            INSERT INTO tile_libraries (owner_user_id, saved_tiles, tileset_config, updated_at)
            VALUES ($1, $2::jsonb, $3::jsonb, NOW())
            ON CONFLICT (owner_user_id)
            DO UPDATE SET saved_tiles = EXCLUDED.saved_tiles, tileset_config = EXCLUDED.tileset_config, updated_at = NOW()
          `,
          [auth.user.id, JSON.stringify(savedTiles), JSON.stringify(tilesetConfig)],
        );

        sendJson(res, 200, {
          ok: true,
          mapId: map.id,
          mapFilePath: fileResult?.mapFilePath ?? 'database:world_maps',
          indexFilePath: fileResult?.indexFilePath ?? 'database:world_maps',
          customTilesFilePath: fileResult?.customTilesFilePath ?? 'database:tile_libraries',
          customTileCodes: Object.keys(buildCustomTileDefinitions(savedTiles)),
        });
        return;
      }

      if (url === '/api/admin/tiles/list' && req.method === 'GET') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        const result = await pool.query(
          'SELECT saved_tiles, tileset_config FROM tile_libraries WHERE owner_user_id = $1',
          [auth.user.id],
        );
        sendJson(res, 200, {
          ok: true,
          savedPaintTiles: result.rows[0]?.saved_tiles ?? [],
          tileset: result.rows[0]?.tileset_config ?? null,
        });
        return;
      }

      if (url === '/api/admin/tiles/save' && req.method === 'POST') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        const rawBody = (await readJsonBody(req)) as SaveTilesRequestPayload;
        const parsedTiles = parseSavedPaintTiles(rawBody.savedPaintTiles);
        const tilesetConfig = sanitizeTilesetConfig(rawBody.tileset ?? null);

        let fileResult: ReturnType<typeof saveTileDatabaseToProject> | null = null;
        try {
          fileResult = saveTileDatabaseToProject(rawBody);
        } catch {
          fileResult = null;
        }

        await pool.query(
          `
            INSERT INTO tile_libraries (owner_user_id, saved_tiles, tileset_config, updated_at)
            VALUES ($1, $2::jsonb, $3::jsonb, NOW())
            ON CONFLICT (owner_user_id)
            DO UPDATE SET saved_tiles = EXCLUDED.saved_tiles, tileset_config = EXCLUDED.tileset_config, updated_at = NOW()
          `,
          [auth.user.id, JSON.stringify(parsedTiles), JSON.stringify(tilesetConfig)],
        );

        sendJson(res, 200, {
          ok: true,
          customTilesFilePath: fileResult?.customTilesFilePath ?? 'database:tile_libraries',
          customTileCodes: Object.keys(buildCustomTileDefinitions(parsedTiles)),
        });
        return;
      }

      if (url === '/api/admin/npc/list' && req.method === 'GET') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        const result = await pool.query(
          'SELECT sprite_library, character_library FROM npc_libraries WHERE owner_user_id = $1',
          [auth.user.id],
        );
        sendJson(res, 200, {
          ok: true,
          npcSpriteLibrary: result.rows[0]?.sprite_library ?? [],
          npcCharacterLibrary: result.rows[0]?.character_library ?? [],
        });
        return;
      }

      if (url === '/api/admin/npc/save' && req.method === 'POST') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        const body = (await readJsonBody(req)) as SaveNpcLibraryRequestPayload;
        const spriteLibrary = Array.isArray(body.npcSpriteLibrary) ? body.npcSpriteLibrary : [];
        const characterLibrary = Array.isArray(body.npcCharacterLibrary) ? body.npcCharacterLibrary : [];

        await pool.query(
          `
            INSERT INTO npc_libraries (owner_user_id, sprite_library, character_library, updated_at)
            VALUES ($1, $2::jsonb, $3::jsonb, NOW())
            ON CONFLICT (owner_user_id)
            DO UPDATE SET sprite_library = EXCLUDED.sprite_library, character_library = EXCLUDED.character_library, updated_at = NOW()
          `,
          [auth.user.id, JSON.stringify(spriteLibrary), JSON.stringify(characterLibrary)],
        );
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url === '/api/admin/player-sprite/get' && req.method === 'GET') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        const result = await pool.query(
          'SELECT sprite_config FROM player_sprite_configs WHERE owner_user_id = $1',
          [auth.user.id],
        );
        sendJson(res, 200, { ok: true, playerSprite: sanitizeLoadedPlayerSpriteConfig(result.rows[0]?.sprite_config) });
        return;
      }

      if (url === '/api/admin/spritesheets/list' && req.method === 'GET') {
        const auth = await requireAuth(req, res);
        if (!auth) {
          return;
        }
        if (!supabaseStorageConfig) {
          sendJson(res, 500, {
            ok: false,
            error: 'Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
          });
          return;
        }
        const requestUrl = new URL(req.url ?? '/api/admin/spritesheets/list', 'http://localhost');
        const bucket = sanitizeStorageBucketName(requestUrl.searchParams.get('bucket'));
        const prefix = sanitizeStoragePrefix(requestUrl.searchParams.get('prefix'));
        if (!bucket) {
          sendJson(res, 400, { ok: false, error: 'Bucket name is required.' });
          return;
        }
        const spritesheets = await listSupabasePngSpriteSheets(supabaseStorageConfig, bucket, prefix);
        sendJson(res, 200, {
          ok: true,
          bucket,
          prefix,
          spritesheets,
        });
        return;
      }

      if (url === '/api/admin/player-sprite/save' && req.method === 'POST') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        const rawBody = (await readJsonBody(req)) as SavePlayerSpriteRequestPayload;
        const result = savePlayerSpriteToProject(rawBody);
        await pool.query(
          `
            INSERT INTO player_sprite_configs (owner_user_id, sprite_config, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (owner_user_id)
            DO UPDATE SET sprite_config = EXCLUDED.sprite_config, updated_at = NOW()
          `,
          [auth.user.id, JSON.stringify(result.spriteConfig)],
        );
        sendJson(res, 200, { ok: true, filePath: result.filePath });
        return;
      }

      if (url === '/api/admin/critters/list' && req.method === 'GET') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        const result = await pool.query('SELECT critters FROM critter_libraries WHERE owner_user_id = $1', [auth.user.id]);
        sendJson(res, 200, { ok: true, critters: result.rows[0]?.critters ?? [] });
        return;
      }

      if (url === '/api/admin/critters/save' && req.method === 'POST') {
        const auth = await requireAuth(req, res);
        if (!auth || !pool) {
          return;
        }
        const body = (await readJsonBody(req)) as { critters?: unknown };
        const critters = Array.isArray(body.critters) ? body.critters : [];
        await pool.query(
          `
            INSERT INTO critter_libraries (owner_user_id, critters, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (owner_user_id)
            DO UPDATE SET critters = EXCLUDED.critters, updated_at = NOW()
          `,
          [auth.user.id, JSON.stringify(critters)],
        );
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error while saving map.';
      sendJson(res, 400, { ok: false, error: message });
    }
  };

  return {
    name: 'admin-map-save-api',
    configureServer(server) {
      server.middlewares.use(rewriteAdminRoute);
      server.middlewares.use((req, res, next) => {
        void middleware(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteAdminRoute);
      server.middlewares.use((req, res, next) => {
        void middleware(req, res, next);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const dbConnectionString = (env.DB_CONNECTION_STRING ?? process.env.DB_CONNECTION_STRING ?? '').trim();
  const supabaseUrl = (env.SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
  const supabaseServiceRoleKey = (
    env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  ).trim();
  const supabaseStorageConfig = normalizeSupabaseStorageConfig(supabaseUrl, supabaseServiceRoleKey);

  return {
    plugins: [react(), createAdminMapApiPlugin(dbConnectionString, supabaseStorageConfig)],
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
  };
});
