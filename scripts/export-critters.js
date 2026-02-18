/**
 * Export current critter catalog from the database to docs/current-critters-export.json.
 * Use for migration planning and backup. Requires DB_CONNECTION_STRING in .env or process.env.
 *
 * Usage: node scripts/export-critters.js
 */

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'current-critters-export.json');

function resolveDbConnectionString() {
  const fromEnv = (process.env.DB_CONNECTION_STRING ?? '').trim();
  if (fromEnv) {
    return fromEnv;
  }
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return '';
  }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eqIndex = normalized.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }
    const key = normalized.slice(0, eqIndex).trim();
    if (key !== 'DB_CONNECTION_STRING') {
      continue;
    }
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
    console.error('DB_CONNECTION_STRING is required (set in .env or process.env).');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: conn });
  try {
    const result = await pool.query(
      'SELECT critter_data FROM game_critter_catalog ORDER BY critter_id ASC, name ASC',
    );
    const critters = result.rows.map((row) => row.critter_data);

    const docsDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(critters, null, 2), 'utf8');
    console.log('Exported', critters.length, 'critter(s) to', OUTPUT_PATH);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
