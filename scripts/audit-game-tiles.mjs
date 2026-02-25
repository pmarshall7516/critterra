#!/usr/bin/env node
/**
 * Read-only audit for game_tiles.
 *
 * Usage:
 *   node scripts/audit-game-tiles.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function resolveDbConnectionString() {
  const fromEnv = (process.env.DB_CONNECTION_STRING ?? '').trim();
  if (fromEnv) return fromEnv;

  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return '';

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
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

async function main() {
  const conn = resolveDbConnectionString();
  if (!conn) {
    throw new Error('DB_CONNECTION_STRING not found in environment or .env');
  }

  const pool = new pg.Pool({ connectionString: conn });
  const client = await pool.connect();
  try {
    const report = {};

    const totalResult = await client.query('SELECT COUNT(*)::int AS count FROM game_tiles');
    report.totalTiles = Number(totalResult.rows[0]?.count ?? 0);

    const urlResult = await client.query(`
      SELECT
        COALESCE(NULLIF(TRIM(tileset_url), ''), '__NULL__') AS tileset_url,
        COUNT(*)::int AS count
      FROM game_tiles
      GROUP BY 1
      ORDER BY count DESC, tileset_url ASC
    `);
    report.tilesByTilesetUrl = urlResult.rows;

    const dimResult = await client.query(`
      SELECT
        COALESCE(tile_pixel_width, -1) AS tile_pixel_width,
        COALESCE(tile_pixel_height, -1) AS tile_pixel_height,
        COUNT(*)::int AS count
      FROM game_tiles
      GROUP BY 1, 2
      ORDER BY count DESC, tile_pixel_width ASC, tile_pixel_height ASC
    `);
    report.tilesByDimensions = dimResult.rows;

    const cellsShapeResult = await client.query(`
      SELECT
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (WHERE jsonb_typeof(cells) = 'array')::int AS array_rows,
        COUNT(*) FILTER (WHERE jsonb_typeof(cells) <> 'array')::int AS non_array_rows,
        COUNT(*) FILTER (WHERE jsonb_typeof(cells) = 'array' AND jsonb_array_length(cells) = 0)::int AS empty_array_rows,
        MIN(CASE WHEN jsonb_typeof(cells) = 'array' THEN jsonb_array_length(cells) END)::int AS min_cells,
        MAX(CASE WHEN jsonb_typeof(cells) = 'array' THEN jsonb_array_length(cells) END)::int AS max_cells,
        AVG(CASE WHEN jsonb_typeof(cells) = 'array' THEN jsonb_array_length(cells)::numeric END)::numeric(10,2) AS avg_cells
      FROM game_tiles
    `);
    report.cellsShape = cellsShapeResult.rows[0] ?? {};

    const duplicateIdResult = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT id
        FROM game_tiles
        GROUP BY id
        HAVING COUNT(*) > 1
      ) dup
    `);
    report.duplicateTileIds = Number(duplicateIdResult.rows[0]?.count ?? 0);

    const duplicateCodeResult = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT primary_code
        FROM game_tiles
        GROUP BY primary_code
        HAVING COUNT(*) > 1
      ) dup
    `);
    report.duplicatePrimaryCodes = Number(duplicateCodeResult.rows[0]?.count ?? 0);

    const atlasResult = await client.query(`
      SELECT
        COALESCE(NULLIF(TRIM(gt.tileset_url), ''), '__NULL__') AS tileset_url,
        COUNT(*)::int AS cells_count,
        MIN((cell->>'atlasIndex')::int)::int AS min_atlas_index,
        MAX((cell->>'atlasIndex')::int)::int AS max_atlas_index,
        COUNT(*) FILTER (WHERE (cell->>'atlasIndex')::int < 0)::int AS negative_atlas_index_count
      FROM game_tiles gt
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(gt.cells) = 'array' THEN gt.cells ELSE '[]'::jsonb END
      ) cell
      WHERE (cell->>'atlasIndex') ~ '^-?[0-9]+$'
      GROUP BY 1
      ORDER BY cells_count DESC, tileset_url ASC
    `);
    report.atlasByTilesetUrl = atlasResult.rows;

    const atlasFrequencyResult = await client.query(`
      SELECT
        (cell->>'atlasIndex')::int AS atlas_index,
        COUNT(*)::int AS count
      FROM game_tiles gt
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(gt.cells) = 'array' THEN gt.cells ELSE '[]'::jsonb END
      ) cell
      WHERE (cell->>'atlasIndex') ~ '^-?[0-9]+$'
      GROUP BY 1
      ORDER BY count DESC, atlas_index ASC
      LIMIT 25
    `);
    report.topAtlasIndexFrequency = atlasFrequencyResult.rows;

    const atlas35Result = await client.query(`
      SELECT
        COUNT(*)::int AS total_cells,
        COUNT(*) FILTER (WHERE (cell->>'atlasIndex')::int = 35)::int AS atlas_35_cells
      FROM game_tiles gt
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(gt.cells) = 'array' THEN gt.cells ELSE '[]'::jsonb END
      ) cell
      WHERE (cell->>'atlasIndex') ~ '^-?[0-9]+$'
    `);
    report.atlas35Summary = atlas35Result.rows[0] ?? {};

    const suspectAtlas35TilesResult = await client.query(`
      SELECT
        gt.id,
        gt.name,
        gt.primary_code,
        COUNT(*)::int AS cell_count,
        COUNT(*) FILTER (WHERE (cell->>'atlasIndex')::int = 35)::int AS atlas_35_cell_count,
        COUNT(DISTINCT (cell->>'atlasIndex')::int)::int AS distinct_atlas_indexes,
        MIN((cell->>'atlasIndex')::int)::int AS min_atlas_index,
        MAX((cell->>'atlasIndex')::int)::int AS max_atlas_index
      FROM game_tiles gt
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(gt.cells) = 'array' THEN gt.cells ELSE '[]'::jsonb END
      ) cell
      WHERE (cell->>'atlasIndex') ~ '^-?[0-9]+$'
      GROUP BY gt.id, gt.name, gt.primary_code
      HAVING COUNT(*) FILTER (WHERE (cell->>'atlasIndex')::int = 35) > 0
      ORDER BY atlas_35_cell_count DESC, gt.id ASC
      LIMIT 100
    `);
    report.tilesContainingAtlas35 = suspectAtlas35TilesResult.rows;

    const mapRowsResult = await client.query(`
      SELECT map_id, map_data
      FROM game_maps
    `);
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
          if (typeof tileRow !== 'string' || !tileRow.length) {
            continue;
          }
          for (const ch of tileRow) {
            tileUsageByCode.set(ch, (tileUsageByCode.get(ch) ?? 0) + 1);
          }
        }
      }
    }
    report.atlas35TileUsageInMaps = suspectAtlas35TilesResult.rows
      .map((tile) => ({
        id: tile.id,
        name: tile.name,
        primary_code: tile.primary_code,
        atlas_35_cell_count: tile.atlas_35_cell_count,
        map_usage_count: tileUsageByCode.get(tile.primary_code) ?? 0,
      }))
      .sort((a, b) => b.map_usage_count - a.map_usage_count || b.atlas_35_cell_count - a.atlas_35_cell_count);

    const topTilesResult = await client.query(`
      SELECT
        id,
        name,
        primary_code,
        tileset_url,
        tile_pixel_width,
        tile_pixel_height,
        jsonb_array_length(cells)::int AS cell_count
      FROM game_tiles
      ORDER BY updated_at DESC NULLS LAST, id ASC
      LIMIT 20
    `);
    report.sampleRecentTiles = topTilesResult.rows;

    const legacyExistsResult = await client.query(`
      SELECT to_regclass('public.tile_libraries')::text AS regclass_name
    `);
    const legacyTableExists = Boolean(legacyExistsResult.rows[0]?.regclass_name);
    report.legacyTileLibrariesTableExists = legacyTableExists;

    if (legacyTableExists) {
      const legacyLatestResult = await client.query(`
        SELECT
          updated_at,
          saved_tiles,
          tileset_config
        FROM tile_libraries
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1
      `);
      const latest = legacyLatestResult.rows[0];
      const savedTiles = Array.isArray(latest?.saved_tiles) ? latest.saved_tiles : [];
      const allCells = savedTiles.flatMap((tile) =>
        Array.isArray(tile?.cells)
          ? tile.cells
          : tile?.code && typeof tile.atlasIndex === 'number'
            ? [{ code: tile.code, atlasIndex: tile.atlasIndex }]
            : [],
      );
      const atlas35Cells = allCells.filter((cell) => cell && cell.atlasIndex === 35).length;
      report.legacyTileLibrariesLatest = {
        updatedAt: latest?.updated_at ?? null,
        savedTileCount: savedTiles.length,
        totalCellCount: allCells.length,
        atlas35CellCount: atlas35Cells,
        tilesetConfig: latest?.tileset_config ?? null,
      };
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Audit failed:', error);
  process.exit(1);
});
