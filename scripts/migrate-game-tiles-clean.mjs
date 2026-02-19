#!/usr/bin/env node
/**
 * Reconcile game_tiles with project source-of-truth tile catalog.
 *
 * This script loads SAVED_PAINT_TILE_DATABASE from src/game/world/customTiles.ts,
 * compares it to the current game_tiles table, and (optionally) upserts rows in a
 * transaction to repair atlas/cell corruption.
 *
 * Usage:
 *   node scripts/migrate-game-tiles-clean.mjs --dry-run
 *   node scripts/migrate-game-tiles-clean.mjs --apply
 *   node scripts/migrate-game-tiles-clean.mjs --apply --prune
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const CUSTOM_TILES_PATH = path.join(ROOT, 'src', 'game', 'world', 'customTiles.ts');

const DEFAULT_TILESET_URL =
  'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png';
const DEFAULT_TILE_WIDTH = 16;
const DEFAULT_TILE_HEIGHT = 16;

function resolveDbConnectionString() {
  const fromEnv = (process.env.DB_CONNECTION_STRING ?? '').trim();
  if (fromEnv) return fromEnv;

  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return '';
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eqIndex = normalized.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = normalized.slice(0, eqIndex).trim();
    if (key !== 'DB_CONNECTION_STRING') continue;
    let value = normalized.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value.trim();
  }
  return '';
}

function loadProjectTileCatalog() {
  const source = fs.readFileSync(CUSTOM_TILES_PATH, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const sandbox = {
    module: { exports: {} },
    exports: {},
  };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, {
    filename: CUSTOM_TILES_PATH,
  });

  const moduleExports = sandbox.module.exports;
  const projectTiles = Array.isArray(moduleExports.SAVED_PAINT_TILE_DATABASE)
    ? moduleExports.SAVED_PAINT_TILE_DATABASE
    : [];

  const projectTileset = moduleExports.CUSTOM_TILESET_CONFIG ?? null;
  return { projectTiles, projectTileset };
}

function sanitizeTile(entry, fallbackTileset) {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry;

  const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : '';
  if (!id) return null;

  const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'Saved Tile';
  const primaryCode =
    typeof record.primaryCode === 'string' && record.primaryCode.trim()
      ? record.primaryCode.trim().slice(0, 1)
      : ' ';
  const width =
    typeof record.width === 'number' && Number.isFinite(record.width) ? Math.max(1, Math.floor(record.width)) : 1;
  const height =
    typeof record.height === 'number' && Number.isFinite(record.height)
      ? Math.max(1, Math.floor(record.height))
      : 1;
  const ySortWithActors = typeof record.ySortWithActors === 'boolean' ? record.ySortWithActors : false;

  const rawCells = Array.isArray(record.cells) ? record.cells : [];
  const cells = rawCells
    .filter((cell) => cell && typeof cell === 'object')
    .map((cell) => ({
      code:
        typeof cell.code === 'string' && cell.code.trim() ? cell.code.trim().slice(0, 1) : '',
      atlasIndex:
        typeof cell.atlasIndex === 'number' && Number.isFinite(cell.atlasIndex)
          ? Math.max(0, Math.floor(cell.atlasIndex))
          : 0,
      dx: typeof cell.dx === 'number' && Number.isFinite(cell.dx) ? Math.floor(cell.dx) : 0,
      dy: typeof cell.dy === 'number' && Number.isFinite(cell.dy) ? Math.floor(cell.dy) : 0,
    }))
    .filter((cell) => cell.code);

  if (cells.length === 0) return null;

  const tileUrl =
    typeof record.tilesetUrl === 'string' && record.tilesetUrl.trim() ? record.tilesetUrl.trim() : fallbackTileset.url;
  const tilePixelWidth =
    typeof record.tilePixelWidth === 'number' && Number.isFinite(record.tilePixelWidth)
      ? Math.max(1, Math.floor(record.tilePixelWidth))
      : fallbackTileset.tilePixelWidth;
  const tilePixelHeight =
    typeof record.tilePixelHeight === 'number' && Number.isFinite(record.tilePixelHeight)
      ? Math.max(1, Math.floor(record.tilePixelHeight))
      : fallbackTileset.tilePixelHeight;

  return {
    id,
    name,
    primaryCode,
    width,
    height,
    ySortWithActors,
    tilesetUrl: tileUrl,
    tilePixelWidth,
    tilePixelHeight,
    cells,
  };
}

function normalizeTileset(projectTileset) {
  const projectUrl =
    projectTileset &&
    typeof projectTileset.url === 'string' &&
    projectTileset.url.trim() &&
    /^https?:\/\//i.test(projectTileset.url.trim())
      ? projectTileset.url.trim()
      : '';
  const projectW =
    projectTileset && typeof projectTileset.tileWidth === 'number' && Number.isFinite(projectTileset.tileWidth)
      ? Math.max(1, Math.floor(projectTileset.tileWidth))
      : DEFAULT_TILE_WIDTH;
  const projectH =
    projectTileset && typeof projectTileset.tileHeight === 'number' && Number.isFinite(projectTileset.tileHeight)
      ? Math.max(1, Math.floor(projectTileset.tileHeight))
      : DEFAULT_TILE_HEIGHT;

  const urlFromEnv = (process.env.CRITTERRA_DEFAULT_TILESET_URL ?? '').trim();
  const widthFromEnv = Number(process.env.CRITTERRA_DEFAULT_TILESET_TILE_WIDTH ?? projectW);
  const heightFromEnv = Number(process.env.CRITTERRA_DEFAULT_TILESET_TILE_HEIGHT ?? projectH);
  const envW = Number.isFinite(widthFromEnv) ? Math.max(1, Math.floor(widthFromEnv)) : projectW;
  const envH = Number.isFinite(heightFromEnv) ? Math.max(1, Math.floor(heightFromEnv)) : projectH;

  const url = urlFromEnv || DEFAULT_TILESET_URL || projectUrl;
  return {
    url,
    tilePixelWidth: envW,
    tilePixelHeight: envH,
  };
}

function stableCellsJson(cells) {
  return JSON.stringify(
    Array.isArray(cells)
      ? cells.map((cell) => ({
          code: cell.code,
          atlasIndex: cell.atlasIndex,
          dx: cell.dx ?? 0,
          dy: cell.dy ?? 0,
        }))
      : [],
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');
  const prune = process.argv.includes('--prune');
  const purgeUnrecoverable = process.argv.includes('--purge-unrecoverable');

  if (!dryRun && !apply) {
    console.log('Usage: node scripts/migrate-game-tiles-clean.mjs [--dry-run] [--apply] [--prune]');
    process.exit(1);
  }

  const conn = resolveDbConnectionString();
  if (!conn) {
    throw new Error('DB_CONNECTION_STRING is required (set in .env or process.env).');
  }

  const { projectTiles, projectTileset } = loadProjectTileCatalog();
  const fallbackTileset = normalizeTileset(projectTileset);
  const desiredTiles = projectTiles
    .map((entry) => sanitizeTile(entry, fallbackTileset))
    .filter((entry) => entry !== null);

  if (desiredTiles.length === 0) {
    throw new Error('No valid tiles found in SAVED_PAINT_TILE_DATABASE.');
  }

  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  const pool = new pg.Pool({ connectionString: conn });
  const client = await pool.connect();
  try {
    const timestamp = Date.now();
    const currentResult = await client.query(
      'SELECT id, name, primary_code, width, height, y_sort_with_actors, tileset_url, tile_pixel_width, tile_pixel_height, cells, updated_at FROM game_tiles ORDER BY id',
    );
    const currentTiles = currentResult.rows;
    const backupPath = path.join(DOCS_DIR, `game-tiles-backup-${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(currentTiles, null, 2), 'utf8');

    const currentById = new Map(currentTiles.map((row) => [row.id, row]));
    const desiredById = new Map(desiredTiles.map((row) => [row.id, row]));

    const changedIds = [];
    const unchangedIds = [];
    let insertsNeeded = 0;
    for (const desired of desiredTiles) {
      const existing = currentById.get(desired.id);
      if (!existing) {
        insertsNeeded += 1;
        continue;
      }
      const same =
        existing.name === desired.name &&
        existing.primary_code === desired.primaryCode &&
        Number(existing.width) === desired.width &&
        Number(existing.height) === desired.height &&
        Boolean(existing.y_sort_with_actors) === desired.ySortWithActors &&
        (existing.tileset_url ?? null) === desired.tilesetUrl &&
        Number(existing.tile_pixel_width ?? 0) === desired.tilePixelWidth &&
        Number(existing.tile_pixel_height ?? 0) === desired.tilePixelHeight &&
        stableCellsJson(existing.cells) === stableCellsJson(desired.cells);
      if (same) {
        unchangedIds.push(desired.id);
      } else {
        changedIds.push(desired.id);
      }
    }
    const changedRows = changedIds.length;
    const unchangedRows = unchangedIds.length;

    const idsOnlyInDb = currentTiles.map((row) => row.id).filter((id) => !desiredById.has(id));
    const idsOnlyInProject = desiredTiles.map((row) => row.id).filter((id) => !currentById.has(id));
    const hasOnlyAtlas35 = (cells) =>
      Array.isArray(cells) &&
      cells.length > 0 &&
      cells.every((cell) => cell && Number.isFinite(Number(cell.atlasIndex)) && Number(cell.atlasIndex) === 35);
    const unresolvedAtlas35Rows = currentTiles.filter(
      (row) => !desiredById.has(row.id) && hasOnlyAtlas35(row.cells),
    );

    const mapRowsResult = await client.query('SELECT map_data FROM game_maps');
    const tileUsageByCode = new Map();
    for (const row of mapRowsResult.rows) {
      const mapData = row.map_data;
      if (!mapData || typeof mapData !== 'object') {
        continue;
      }
      const layers = Array.isArray(mapData.layers) ? mapData.layers : [];
      for (const layer of layers) {
        const tiles = Array.isArray(layer?.tiles) ? layer.tiles : [];
        for (const tileRow of tiles) {
          if (typeof tileRow !== 'string') {
            continue;
          }
          for (const ch of tileRow) {
            tileUsageByCode.set(ch, (tileUsageByCode.get(ch) ?? 0) + 1);
          }
        }
      }
    }
    const purgeCandidates = unresolvedAtlas35Rows.filter(
      (row) => (tileUsageByCode.get(row.primary_code) ?? 0) <= 0,
    );

    console.log('Current DB rows:', currentTiles.length);
    console.log('Project catalog rows:', desiredTiles.length);
    console.log('Rows requiring update:', changedRows);
    console.log('Rows requiring insert:', insertsNeeded);
    console.log('Rows already matching:', unchangedRows);
    console.log('Rows only in DB:', idsOnlyInDb.length);
    console.log('Rows only in project:', idsOnlyInProject.length);
    console.log('Unrecoverable atlas35 rows not in project:', unresolvedAtlas35Rows.length);
    console.log('Unused unrecoverable atlas35 purge candidates:', purgeCandidates.length);
    if (changedIds.length > 0) {
      console.log('Changed IDs (project -> DB):', changedIds.join(', '));
    }
    if (purgeCandidates.length > 0) {
      console.log('Purge candidate IDs:', purgeCandidates.map((row) => row.id).join(', '));
    }
    console.log('Tileset to enforce:', fallbackTileset.url);
    console.log('Tile dimensions to enforce:', `${fallbackTileset.tilePixelWidth}x${fallbackTileset.tilePixelHeight}`);
    console.log('Backup:', backupPath);

    if (dryRun) {
      const dryRunReportPath = path.join(DOCS_DIR, `game-tiles-dry-run-report-${timestamp}.json`);
      fs.writeFileSync(
        dryRunReportPath,
        JSON.stringify(
          {
            dbCount: currentTiles.length,
            projectCount: desiredTiles.length,
            changedRows,
            insertsNeeded,
            unchangedRows,
            changedIds,
            idsOnlyInDb,
            idsOnlyInProject,
            unresolvedAtlas35Rows: unresolvedAtlas35Rows.map((row) => ({
              id: row.id,
              name: row.name,
              primaryCode: row.primary_code,
              cellCount: Array.isArray(row.cells) ? row.cells.length : 0,
              mapUsageCount: tileUsageByCode.get(row.primary_code) ?? 0,
            })),
            purgeCandidates: purgeCandidates.map((row) => row.id),
            tileset: fallbackTileset,
            backupPath,
          },
          null,
          2,
        ),
        'utf8',
      );
      console.log('Dry-run report:', dryRunReportPath);
      console.log('--dry-run mode: no DB changes were applied.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const tile of desiredTiles) {
        await client.query(
          `
            INSERT INTO game_tiles (
              id, name, primary_code, width, height, y_sort_with_actors,
              tileset_url, tile_pixel_width, tile_pixel_height, cells, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              primary_code = EXCLUDED.primary_code,
              width = EXCLUDED.width,
              height = EXCLUDED.height,
              y_sort_with_actors = EXCLUDED.y_sort_with_actors,
              tileset_url = EXCLUDED.tileset_url,
              tile_pixel_width = EXCLUDED.tile_pixel_width,
              tile_pixel_height = EXCLUDED.tile_pixel_height,
              cells = EXCLUDED.cells,
              updated_at = NOW()
          `,
          [
            tile.id,
            tile.name,
            tile.primaryCode,
            tile.width,
            tile.height,
            tile.ySortWithActors,
            tile.tilesetUrl,
            tile.tilePixelWidth,
            tile.tilePixelHeight,
            JSON.stringify(tile.cells),
          ],
        );
      }

      let prunedCount = 0;
      if (prune && idsOnlyInDb.length > 0) {
        const pruneResult = await client.query(
          'DELETE FROM game_tiles WHERE id = ANY($1::text[])',
          [idsOnlyInDb],
        );
        prunedCount = pruneResult.rowCount ?? 0;
      }
      let purgedUnrecoverableCount = 0;
      if (purgeUnrecoverable && purgeCandidates.length > 0) {
        const purgeResult = await client.query(
          'DELETE FROM game_tiles WHERE id = ANY($1::text[])',
          [purgeCandidates.map((row) => row.id)],
        );
        purgedUnrecoverableCount = purgeResult.rowCount ?? 0;
      }

      await client.query('COMMIT');
      console.log('Migration applied successfully.');
      if (prune) {
        console.log('Pruned rows not in project:', prunedCount);
      } else if (idsOnlyInDb.length > 0) {
        console.log('Rows only in DB were left untouched (use --prune to remove).');
      }
      if (purgeUnrecoverable) {
        console.log('Purged unrecoverable unused atlas35 rows:', purgedUnrecoverableCount);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const cleanResult = await client.query(
      'SELECT id, name, primary_code, width, height, y_sort_with_actors, tileset_url, tile_pixel_width, tile_pixel_height, cells, updated_at FROM game_tiles ORDER BY id',
    );
    const cleanPath = path.join(DOCS_DIR, `game-tiles-clean-state-${timestamp}.json`);
    fs.writeFileSync(cleanPath, JSON.stringify(cleanResult.rows, null, 2), 'utf8');
    console.log('Clean-state snapshot:', cleanPath);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
