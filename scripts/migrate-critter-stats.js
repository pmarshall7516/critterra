/**
 * Migrate critter base stats and level structure to match the stat balance plan.
 * Preserves skillUnlockIds, abilityUnlockIds, and existing story/ascension missions.
 * Each critter gets exactly 5 levels with 1 knockout mission (any, target 5) per level.
 *
 * Usage:
 *   node scripts/migrate-critter-stats.js [--dry-run] [--apply] [--from-db]
 *   --dry-run: output migration plan to docs/migration-plan-detailed.json only
 *   --apply: write migrated critters to database (creates backup first)
 *   --from-db: read current critters from DB instead of docs/current-critters-export.json
 */

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXPORT_PATH = path.join(ROOT, 'docs', 'current-critters-export.json');
const PLAN_OUTPUT_PATH = path.join(ROOT, 'docs', 'migration-plan-detailed.json');
const DOCS_DIR = path.join(ROOT, 'docs');

const KNOCKOUT_MISSION_TARGET = 5;

const TARGET_STATS = {
  buddo: {
    baseStats: { hp: 20, attack: 10, defense: 12, speed: 7 },
    levelDeltas: [
      { hp: 2, attack: 1, defense: 2, speed: 1 },
      { hp: 2, attack: 1, defense: 2, speed: 1 },
      { hp: 3, attack: 2, defense: 3, speed: 1 },
      { hp: 3, attack: 2, defense: 3, speed: 1 },
      { hp: 4, attack: 2, defense: 4, speed: 1 },
    ],
  },
  mothwick: {
    baseStats: { hp: 14, attack: 13, defense: 8, speed: 12 },
    levelDeltas: [
      { hp: 1, attack: 2, defense: 1, speed: 2 },
      { hp: 1, attack: 2, defense: 1, speed: 2 },
      { hp: 2, attack: 3, defense: 1, speed: 3 },
      { hp: 2, attack: 3, defense: 1, speed: 3 },
      { hp: 2, attack: 4, defense: 2, speed: 4 },
    ],
  },
  driplotl: {
    baseStats: { hp: 16, attack: 11, defense: 10, speed: 6 },
    levelDeltas: [
      { hp: 2, attack: 1, defense: 1, speed: 0 },
      { hp: 2, attack: 1, defense: 1, speed: 0 },
      { hp: 2, attack: 2, defense: 2, speed: 1 },
      { hp: 2, attack: 2, defense: 2, speed: 1 },
      { hp: 3, attack: 2, defense: 3, speed: 1 },
    ],
  },
  dripotl: {
    baseStats: { hp: 16, attack: 11, defense: 10, speed: 6 },
    levelDeltas: [
      { hp: 2, attack: 1, defense: 1, speed: 0 },
      { hp: 2, attack: 1, defense: 1, speed: 0 },
      { hp: 2, attack: 2, defense: 2, speed: 1 },
      { hp: 2, attack: 2, defense: 2, speed: 1 },
      { hp: 3, attack: 2, defense: 3, speed: 1 },
    ],
  },
  moolnir: {
    baseStats: { hp: 18, attack: 8, defense: 11, speed: 8 },
    levelDeltas: [
      { hp: 2, attack: 0, defense: 2, speed: 1 },
      { hp: 2, attack: 1, defense: 2, speed: 1 },
      { hp: 3, attack: 1, defense: 3, speed: 1 },
      { hp: 3, attack: 1, defense: 3, speed: 1 },
      { hp: 4, attack: 1, defense: 4, speed: 1 },
    ],
  },
  ragnir: {
    baseStats: { hp: 19, attack: 12, defense: 11, speed: 10 },
    levelDeltas: [
      { hp: 2, attack: 2, defense: 2, speed: 2 },
      { hp: 2, attack: 2, defense: 2, speed: 2 },
      { hp: 3, attack: 3, defense: 3, speed: 3 },
      { hp: 3, attack: 3, defense: 3, speed: 3 },
      { hp: 4, attack: 4, defense: 4, speed: 4 },
    ],
  },
  glimcap: {
    baseStats: { hp: 15, attack: 10, defense: 9, speed: 9 },
    levelDeltas: [
      { hp: 1, attack: 1, defense: 1, speed: 1 },
      { hp: 1, attack: 1, defense: 1, speed: 1 },
      { hp: 2, attack: 2, defense: 1, speed: 2 },
      { hp: 2, attack: 2, defense: 1, speed: 2 },
      { hp: 2, attack: 2, defense: 2, speed: 2 },
    ],
  },
};

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value.trim();
  }
  return '';
}

function getTargetForName(name) {
  const key = (name || '').trim().toLowerCase();
  return TARGET_STATS[key] || TARGET_STATS.buddo;
}

function hasKnockoutAnyMission(missions) {
  return (missions || []).some(
    (m) =>
      m && m.type === 'opposing_knockouts' && (!m.knockoutElements || m.knockoutElements.length === 0) && (!m.knockoutCritterIds || m.knockoutCritterIds.length === 0)
  );
}

function ensureKnockoutMission(levelNum, missions) {
  const list = Array.isArray(missions) ? missions.filter(Boolean) : [];
  if (hasKnockoutAnyMission(list)) return list;
  const knockoutId = `level-${levelNum}-knockout-any`;
  return [
    ...list,
    {
      id: knockoutId,
      type: 'opposing_knockouts',
      targetValue: KNOCKOUT_MISSION_TARGET,
      knockoutElements: [],
      knockoutCritterIds: [],
    },
  ];
}

function migrateCritter(critter) {
  const name = critter.name || 'Unknown';
  const target = getTargetForName(name);
  const existingLevels = Array.isArray(critter.levels) ? critter.levels : [];
  const levelMap = new Map(existingLevels.map((l) => [Number(l.level), l]));

  const levels = [];
  for (let L = 1; L <= 5; L++) {
    const existing = levelMap.get(L);
    const statDelta = target.levelDeltas[L - 1];
    const skillUnlockIds = existing && Array.isArray(existing.skillUnlockIds) ? [...existing.skillUnlockIds] : [];
    const abilityUnlockIds = existing && Array.isArray(existing.abilityUnlockIds) ? [...existing.abilityUnlockIds] : [];

    let missions = existing && Array.isArray(existing.missions) ? existing.missions.filter(Boolean) : [];
    missions = ensureKnockoutMission(L, missions);
    const requiredMissionCount = Math.max(1, missions.length);

    levels.push({
      level: L,
      missions,
      requiredMissionCount,
      statDelta: { ...statDelta },
      abilityUnlockIds,
      skillUnlockIds,
    });
  }

  return {
    ...critter,
    baseStats: { ...target.baseStats },
    levels,
  };
}

function validateMigratedCritter(critter) {
  const errors = [];
  if (!critter.levels || critter.levels.length !== 5) {
    errors.push(`${critter.name}: expected 5 levels, got ${critter.levels?.length ?? 0}`);
  }
  for (let i = 0; i < 5; i++) {
    const row = critter.levels[i];
    if (row.level !== i + 1) errors.push(`${critter.name} level ${i + 1}: level number should be ${i + 1}`);
    if (row.requiredMissionCount < 1) errors.push(`${critter.name} level ${row.level}: requiredMissionCount should be >= 1`);
    if (!hasKnockoutAnyMission(row.missions)) errors.push(`${critter.name} level ${row.level}: missing knockout-any mission`);
  }
  return errors;
}

function buildMigrationPlan(current, migrated) {
  const plan = { critters: [], summary: { total: current.length } };
  for (let i = 0; i < current.length; i++) {
    const c = current[i];
    const m = migrated[i];
    plan.critters.push({
      id: c.id,
      name: c.name,
      baseStatsBefore: c.baseStats,
      baseStatsAfter: m.baseStats,
      levelsBefore: (c.levels || []).length,
      levelsAfter: (m.levels || []).length,
      skillUnlockIdsPreserved: (c.levels || []).every((l, idx) => {
        const ml = m.levels && m.levels[idx];
        if (!ml) return false;
        const cs = (l.skillUnlockIds || []).slice().sort().join(',');
        const ms = (ml.skillUnlockIds || []).slice().sort().join(',');
        return cs === ms;
      }),
      abilityUnlockIdsPreserved: (c.levels || []).every((l, idx) => {
        const ml = m.levels && m.levels[idx];
        if (!ml) return true;
        const cs = (l.abilityUnlockIds || []).slice().sort().join(',');
        const ms = (ml.abilityUnlockIds || []).slice().sort().join(',');
        return cs === ms;
      }),
    });
  }
  return plan;
}

async function readFromDb(pool) {
  const result = await pool.query(
    'SELECT critter_data FROM game_critter_catalog ORDER BY critter_id ASC, name ASC'
  );
  return result.rows.map((r) => r.critter_data);
}

async function writeToDb(pool, critters) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM game_critter_catalog');
    for (const critter of critters) {
      const name = String(critter.name ?? '').trim();
      const id = Math.max(1, Math.min(999999, Number(critter.id) || 1));
      if (!name) continue;
      await client.query(
        `INSERT INTO game_critter_catalog (name, critter_id, critter_data, updated_at) VALUES ($1, $2, $3::jsonb, NOW())`,
        [name, id, JSON.stringify(critter)]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');
  const fromDb = process.argv.includes('--from-db');

  let current;
  if (fromDb) {
    const conn = resolveDbConnectionString();
    if (!conn) {
      console.error('DB_CONNECTION_STRING required for --from-db');
      process.exit(1);
    }
    const pool = new pg.Pool({ connectionString: conn });
    try {
      current = await readFromDb(pool);
    } finally {
      await pool.end();
    }
  } else {
    if (!fs.existsSync(EXPORT_PATH)) {
      console.error('Run node scripts/export-critters.js first, or use --from-db');
      process.exit(1);
    }
    current = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));
  }

  const migrated = current.map(migrateCritter);

  const allErrors = [];
  migrated.forEach((c) => allErrors.push(...validateMigratedCritter(c)));
  if (allErrors.length > 0) {
    console.error('Validation failed:');
    allErrors.forEach((e) => console.error('  ', e));
    process.exit(1);
  }

  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

  const plan = buildMigrationPlan(current, migrated);
  fs.writeFileSync(PLAN_OUTPUT_PATH, JSON.stringify(plan, null, 2), 'utf8');
  console.log('Wrote migration plan to', PLAN_OUTPUT_PATH);

  if (dryRun) {
    console.log('Dry run. Migrated critters not written. Use --apply to write to database.');
    return;
  }

  if (!apply) {
    console.log('Use --apply to write migrated critters to the database.');
    return;
  }

  const backupPath = path.join(DOCS_DIR, `critters-backup-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(current, null, 2), 'utf8');
  console.log('Backup written to', backupPath);

  const conn = resolveDbConnectionString();
  if (!conn) {
    console.error('DB_CONNECTION_STRING required for --apply');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: conn });
  try {
    await writeToDb(pool, migrated);
    console.log('Migrated', migrated.length, 'critters written to database.');

    const reread = await readFromDb(pool);
    const postErrors = [];
    reread.forEach((c) => postErrors.push(...validateMigratedCritter(c)));
    if (postErrors.length > 0) {
      console.error('Post-migration verification failed:');
      postErrors.forEach((e) => console.error('  ', e));
      process.exit(1);
    }
    console.log('Post-migration verification passed: all critters have 5 levels and required missions.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
