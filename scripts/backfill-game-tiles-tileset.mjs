#!/usr/bin/env node
/**
 * Standalone migration: set tileset_url, tile_pixel_width, tile_pixel_height
 * on all game_tiles rows where tileset_url IS NULL.
 *
 * Uses .env: DB_CONNECTION_STRING, CRITTERRA_DEFAULT_TILESET_URL,
 * optional CRITTERRA_DEFAULT_TILESET_TILE_WIDTH / _HEIGHT (default 16).
 *
 * Run: node scripts/backfill-game-tiles-tileset.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch {
    // no .env
  }
}

loadEnv();

const connectionString = process.env.DB_CONNECTION_STRING;
const url = (process.env.CRITTERRA_DEFAULT_TILESET_URL ?? '').trim();
const w = Math.max(1, Math.floor(Number(process.env.CRITTERRA_DEFAULT_TILESET_TILE_WIDTH ?? 16)));
const h = Math.max(1, Math.floor(Number(process.env.CRITTERRA_DEFAULT_TILESET_TILE_HEIGHT ?? 16)));

if (!connectionString) {
  console.error('Missing DB_CONNECTION_STRING in .env');
  process.exit(1);
}
if (!url || url.startsWith('blob:')) {
  console.error('Set CRITTERRA_DEFAULT_TILESET_URL in .env to a valid tileset image URL');
  process.exit(1);
}

async function main() {
  const pool = new pg.Pool({ connectionString });
  try {
    const result = await pool.query(
      `
      UPDATE game_tiles
      SET tileset_url = $1, tile_pixel_width = $2, tile_pixel_height = $3, updated_at = NOW()
      WHERE tileset_url IS NULL
      RETURNING id
      `,
      [url, w, h],
    );
    const count = result.rowCount ?? 0;
    console.log(`Backfilled ${count} row(s) in game_tiles with tileset_url=${url.slice(0, 50)}...`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
