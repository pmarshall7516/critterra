/**
 * Migrate game_maps.map_data to add the NPC layer (id: 2) after the Base layer.
 * Layers with orderId < 2 are floor; layer 2 is the NPC/character layer.
 * Requires DB_CONNECTION_STRING in .env or process.env.
 *
 * Usage: node scripts/migrate-game-maps-npc-layer.js
 */

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NPC_LAYER_ORDER_ID = 2;

function resolveDbConnectionString() {
  const fromEnv = (process.env.DB_CONNECTION_STRING ?? '').trim();
  if (fromEnv) return fromEnv;
  const envPath = path.resolve(process.cwd(), '.env');
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

function parseLayerOrderId(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const n = Math.floor(value);
    return n >= 1 ? n : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'base') return 1;
  if (trimmed.toLowerCase() === 'npc') return NPC_LAYER_ORDER_ID;
  if (!/^\d+$/.test(trimmed)) return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function hasNpcLayer(layers) {
  if (!Array.isArray(layers)) return false;
  return layers.some((ly) => parseLayerOrderId(ly.id) === NPC_LAYER_ORDER_ID);
}

function createBlankNpcLayer(width, height) {
  const blankRow = '.'.repeat(width);
  const zeroRow = '0'.repeat(width);
  return {
    id: NPC_LAYER_ORDER_ID,
    name: 'NPC',
    tiles: Array.from({ length: height }, () => blankRow),
    rotations: Array.from({ length: height }, () => zeroRow),
    collisionEdges: Array.from({ length: height }, () => zeroRow),
    visible: true,
    collision: false,
  };
}

function migrateMapData(mapData) {
  if (!mapData || typeof mapData !== 'object') return null;

  const layers = Array.isArray(mapData.layers) ? mapData.layers : null;
  const tiles = Array.isArray(mapData.tiles) ? mapData.tiles : null;

  // Legacy map: only tiles, no layers -> add Base + NPC layers
  if (!layers || layers.length === 0) {
    if (!tiles || tiles.length === 0) return null;
    const width = tiles[0]?.length ?? 0;
    const height = tiles.length;
    if (width <= 0 || height <= 0) return null;
    const zeroRow = '0'.repeat(width);
    const baseTiles = tiles.map((row) => (typeof row === 'string' ? row : ''));
    if (baseTiles.length !== height || baseTiles.some((r) => r.length !== width)) return null;
    const baseLayer = {
      id: 1,
      name: 'Base',
      tiles: baseTiles,
      rotations: Array.from({ length: height }, () => zeroRow),
      collisionEdges: Array.from({ length: height }, () => zeroRow),
      visible: true,
      collision: true,
    };
    const npcLayer = createBlankNpcLayer(width, height);
    const next = { ...mapData, layers: [baseLayer, npcLayer] };
    delete next.tiles;
    return next;
  }

  if (hasNpcLayer(layers)) return null; // already has NPC layer

  const width = layers[0]?.tiles?.[0]?.length ?? 0;
  const height = layers[0]?.tiles?.length ?? 0;
  if (width <= 0 || height <= 0) return null;

  // Sort by orderId
  const withOrder = layers.map((ly) => ({
    layer: ly,
    orderId: parseLayerOrderId(ly.id) ?? 9999,
  }));
  withOrder.sort((a, b) => a.orderId - b.orderId);

  const hasExisting2 = withOrder.some((e) => e.orderId === NPC_LAYER_ORDER_ID);
  const npcLayer = createBlankNpcLayer(width, height);
  const newLayers = [];

  if (!hasExisting2) {
    // Insert NPC after first layer (Base)
    newLayers.push(withOrder[0].layer);
    newLayers.push(npcLayer);
    for (let i = 1; i < withOrder.length; i++) {
      newLayers.push(withOrder[i].layer);
    }
  } else {
    // Some layer already has id 2: insert NPC as 2, renumber 2->3, 3->4, ...
    for (const { layer, orderId } of withOrder) {
      if (orderId < NPC_LAYER_ORDER_ID) {
        newLayers.push(layer);
      } else if (orderId === NPC_LAYER_ORDER_ID) {
        newLayers.push(npcLayer);
        newLayers.push({ ...layer, id: 3 });
      } else {
        newLayers.push({ ...layer, id: orderId + 1 });
      }
    }
  }

  return { ...mapData, layers: newLayers };
}

async function main() {
  const conn = resolveDbConnectionString();
  if (!conn) {
    console.error('DB_CONNECTION_STRING is required (set in .env or process.env).');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: conn });
  try {
    const result = await pool.query('SELECT map_id, map_data FROM game_maps');
    let updated = 0;
    for (const row of result.rows) {
      const mapId = row.map_id;
      const migrated = migrateMapData(row.map_data);
      if (!migrated) continue;
      await pool.query(
        `UPDATE game_maps SET map_data = $1::jsonb, updated_at = NOW() WHERE map_id = $2`,
        [JSON.stringify(migrated), mapId],
      );
      updated += 1;
      console.log('Migrated map:', mapId);
    }
    console.log('Done. Updated', updated, 'map(s).');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
