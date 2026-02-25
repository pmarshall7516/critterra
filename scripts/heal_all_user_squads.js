import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const options = {
    apply: false,
    userId: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--user-id') {
      const next = argv[index + 1];
      if (typeof next === 'string' && next.trim()) {
        options.userId = next.trim();
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--user-id=')) {
      const value = arg.slice('--user-id='.length).trim();
      if (value) {
        options.userId = value;
      }
      continue;
    }
  }

  return options;
}

function printHelp() {
  console.log(
    [
      'Heal all user squad critters to full HP.',
      '',
      'Usage:',
      '  node scripts/heal_all_user_squads.js [--apply] [--user-id <id>]',
      '',
      'Options:',
      '  --apply         Persist changes to database. Without this, script runs as dry-run.',
      '  --user-id <id>  Only process a single user.',
      '  --help          Show this help.',
      '',
      'Connection string resolution order:',
      '  1) process.env.DB_CONNECTION_STRING',
      '  2) .env file in current working directory',
    ].join('\n'),
  );
}

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
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
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

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function toInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.trunc(parsed);
}

function getMaxHpFromEntry(entry) {
  const effectiveStats = asObject(entry.effectiveStats);
  const hp = effectiveStats ? toInteger(effectiveStats.hp) : null;
  if (hp === null) {
    return 1;
  }
  return Math.max(1, hp);
}

function healSquadCrittersToFull(saveData) {
  const root = asObject(saveData);
  if (!root) {
    return { changed: false, healedEntries: 0, nextSaveData: saveData };
  }

  const progress = asObject(root.playerCritterProgress);
  if (!progress) {
    return { changed: false, healedEntries: 0, nextSaveData: saveData };
  }

  const squad = Array.isArray(progress.squad) ? progress.squad : [];
  const squadCritterIds = new Set();
  for (const rawId of squad) {
    const critterId = toInteger(rawId);
    if (critterId !== null && critterId > 0) {
      squadCritterIds.add(critterId);
    }
  }

  if (squadCritterIds.size === 0) {
    return { changed: false, healedEntries: 0, nextSaveData: saveData };
  }

  const collection = Array.isArray(progress.collection) ? progress.collection : [];
  let healedEntries = 0;
  let changed = false;

  const nextCollection = collection.map((rawEntry) => {
    const entry = asObject(rawEntry);
    if (!entry) {
      return rawEntry;
    }

    const critterId = toInteger(entry.critterId);
    if (critterId === null || !squadCritterIds.has(critterId)) {
      return rawEntry;
    }

    if (!entry.unlocked) {
      return rawEntry;
    }

    const maxHp = getMaxHpFromEntry(entry);
    const currentHp = toInteger(entry.currentHp);
    if (currentHp !== null && currentHp === maxHp) {
      return rawEntry;
    }

    healedEntries += 1;
    changed = true;
    return {
      ...entry,
      currentHp: maxHp,
      lastProgressAt: new Date().toISOString(),
    };
  });

  if (!changed) {
    return { changed: false, healedEntries: 0, nextSaveData: saveData };
  }

  return {
    changed: true,
    healedEntries,
    nextSaveData: {
      ...root,
      playerCritterProgress: {
        ...progress,
        collection: nextCollection,
      },
    },
  };
}

function normalizeSaveData(rawSaveData) {
  if (typeof rawSaveData === 'string') {
    try {
      return JSON.parse(rawSaveData);
    } catch {
      return null;
    }
  }
  return rawSaveData;
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    printHelp();
    return;
  }

  const connectionString = resolveDbConnectionString();
  if (!connectionString) {
    throw new Error('DB_CONNECTION_STRING is required (env var or .env file).');
  }

  const { Client } = pg;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const result = options.userId
      ? await client.query('SELECT user_id, save_data FROM user_saves WHERE user_id = $1', [options.userId])
      : await client.query('SELECT user_id, save_data FROM user_saves');

    let scannedUsers = 0;
    let changedUsers = 0;
    let healedEntries = 0;

    const updates = [];
    for (const row of result.rows) {
      scannedUsers += 1;
      const saveData = normalizeSaveData(row.save_data);
      if (!saveData) {
        continue;
      }

      const patch = healSquadCrittersToFull(saveData);
      if (!patch.changed) {
        continue;
      }

      changedUsers += 1;
      healedEntries += patch.healedEntries;
      updates.push({
        userId: row.user_id,
        saveData: patch.nextSaveData,
      });
    }

    if (options.apply && updates.length > 0) {
      await client.query('BEGIN');
      try {
        for (const update of updates) {
          await client.query(
            `
              UPDATE user_saves
              SET save_data = $2::jsonb,
                  updated_at = NOW()
              WHERE user_id = $1
            `,
            [update.userId, JSON.stringify(update.saveData)],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log(`mode=${options.apply ? 'apply' : 'dry-run'}`);
    console.log(`scanned_users=${scannedUsers}`);
    console.log(`changed_users=${changedUsers}`);
    console.log(`healed_squad_entries=${healedEntries}`);
    if (!options.apply && changedUsers > 0) {
      console.log('Re-run with --apply to persist these updates.');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
