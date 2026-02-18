/**
 * Push the canonical story NPC character library (Uncle Hank, Jacob, Ben) to the
 * game_npc_libraries table. Use this so the admin tool and bootstrap see the
 * latest definitions (e.g. Ben's battle guard instance-2 with postDuelDialogue).
 *
 * Usage: node scripts/push_story_npc_library.js [--apply]
 * Connection: DB_CONNECTION_STRING from .env or process.env.
 */

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOBAL_CATALOG_KEY = 'main';

const FLAG_DEMO_DONE = 'demo-done';
const FLAG_BEN_DEFEATED = 'ben-defeated';

const DEFAULT_STORY_NPC_CHARACTER_LIBRARY = [
  {
    id: 'uncle-hank-story',
    label: 'Uncle Hank',
    npcName: 'Uncle Hank',
    color: '#b67d43',
    facing: 'down',
    dialogueId: 'custom_npc_dialogue',
    dialogueLines: [
      'Hey <username>! How are you doing?',
      "Here for Critter pickup? I've got three right here that need a new home.",
    ],
    movement: { type: 'static' },
    spriteId: 'uncle-hank-sprite',
    storyStates: [
      {
        id: 'instance-1',
        firstInteractionSetFlag: 'demo-start',
        mapId: 'uncle-s-house',
        position: { x: 6, y: 4 },
        facing: 'down',
        dialogueLines: [
          'Hey <username>! How are you doing?',
          "Here for Critter pickup? I've got three right here that need a new home.",
        ],
        movement: { type: 'static' },
      },
      {
        id: 'instance-2',
        requiresFlag: 'selected-starter-critter',
        mapId: 'uncle-s-house',
        position: { x: 6, y: 4 },
        facing: 'down',
        dialogueLines: ['Try Unlocking your new Critter in your Collection.'],
        movement: { type: 'static' },
      },
      {
        id: 'instance-3',
        requiresFlag: FLAG_DEMO_DONE,
        mapId: 'uncle-s-house',
        position: { x: 6, y: 4 },
        facing: 'down',
        dialogueLines: ['What a nice duel! Have fun now <player-name>.'],
        movement: { type: 'static' },
      },
    ],
  },
  {
    id: 'jacob-story',
    label: 'Jacob',
    npcName: 'Jacob',
    color: '#5c82d8',
    facing: 'up',
    dialogueId: 'custom_npc_dialogue',
    dialogueLines: ["<player-name>! You've got a Critter?!"],
    battleTeamIds: ['moolnir@1'],
    movement: { type: 'static' },
    spriteId: 'jacob-sprite-1',
    storyStates: [
      {
        id: 'instance-1',
        requiresFlag: 'starter-selection-done',
        mapId: 'uncle-s-house',
        position: { x: 6, y: 12 },
        facing: 'up',
        dialogueLines: ["<player-name>! You've got a Critter?!"],
        battleTeamIds: ['moolnir@1'],
        movement: { type: 'static' },
      },
      {
        id: 'instance-2',
        requiresFlag: FLAG_DEMO_DONE,
        mapId: 'portlock',
        position: { x: 8, y: 6 },
        facing: 'down',
        dialogueLines: ['You and <player-starter-critter-name> make a great pair!'],
        movement: { type: 'wander', stepIntervalMs: 2000 },
      },
    ],
  },
  {
    id: 'ben-story',
    label: 'Ben',
    npcName: 'Ben',
    color: '#5f95c8',
    facing: 'down',
    dialogueId: 'custom_npc_dialogue',
    dialogueSpeaker: 'Ben',
    dialogueLines: ['You do not have a Critter yet, please turn around it is not safe beyond here.'],
    movement: { type: 'static' },
    spriteId: 'boy-1-sprite',
    storyStates: [
      {
        id: 'instance-1',
        mapId: 'portlock',
        position: { x: 11, y: 1 },
        facing: 'down',
        dialogueSpeaker: 'Ben',
        dialogueLines: ['You do not have a Critter yet, please turn around it is not safe beyond here.'],
        movement: { type: 'static' },
        movementGuards: [
          {
            id: 'block-north-boundary',
            hideIfFlag: FLAG_DEMO_DONE,
            maxY: 0,
            dialogueSpeaker: 'Ben',
            dialogueLines: ['You do not have a Critter yet, please turn around it is not safe beyond here.'],
          },
          {
            id: 'block-ben-tile',
            hideIfFlag: FLAG_DEMO_DONE,
            x: 11,
            y: 1,
            dialogueSpeaker: 'Ben',
            dialogueLines: ['You do not have a Critter yet, please turn around it is not safe beyond here.'],
          },
        ],
      },
      {
        id: 'instance-2',
        requiresFlag: FLAG_DEMO_DONE,
        mapId: 'portlock',
        position: { x: 11, y: 1 },
        facing: 'down',
        dialogueSpeaker: 'Ben',
        dialogueLines: ["I'm guarding this path. Beat me in a battle if you want to pass!"],
        movement: { type: 'static' },
        battleTeamIds: ['buddo@1'],
        movementGuards: [
          {
            id: 'battle-north-boundary',
            requiresFlag: FLAG_DEMO_DONE,
            maxY: 0,
            battleTeamIds: ['buddo@1'],
            defeatedFlag: FLAG_BEN_DEFEATED,
            postDuelDialogueSpeaker: 'Ben',
            postDuelDialogueLines: ["I can't believe I lost... You're really strong. Go ahead, the path is clear."],
          },
          {
            id: 'battle-ben-tile',
            requiresFlag: FLAG_DEMO_DONE,
            x: 11,
            y: 1,
            battleTeamIds: ['buddo@1'],
            defeatedFlag: FLAG_BEN_DEFEATED,
            postDuelDialogueSpeaker: 'Ben',
            postDuelDialogueLines: ["I can't believe I lost... You're really strong. Go ahead, the path is clear."],
          },
        ],
      },
    ],
  },
];

const STORY_CHARACTER_IDS = new Set(DEFAULT_STORY_NPC_CHARACTER_LIBRARY.map((c) => c.id));

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
  const apply = process.argv.includes('--apply');
  const conn = resolveDbConnectionString();
  if (!conn) {
    console.error('DB_CONNECTION_STRING is required (set in .env or process.env).');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: conn });
  try {
    const result = await pool.query(
      'SELECT sprite_library, character_library FROM game_npc_libraries WHERE catalog_key = $1',
      [GLOBAL_CATALOG_KEY],
    );

    const existingSpriteLibrary = Array.isArray(result.rows[0]?.sprite_library)
      ? result.rows[0].sprite_library
      : [];
    const existingCharacterLibrary = Array.isArray(result.rows[0]?.character_library)
      ? result.rows[0].character_library
      : [];

    const mergedCharacterLibrary = [
      ...existingCharacterLibrary.filter((c) => c && !STORY_CHARACTER_IDS.has(c.id)),
      ...DEFAULT_STORY_NPC_CHARACTER_LIBRARY,
    ];

    if (!apply) {
      console.log('Dry run. Character library would have', mergedCharacterLibrary.length, 'entries.');
      console.log('Story characters pushed:', DEFAULT_STORY_NPC_CHARACTER_LIBRARY.map((c) => c.id).join(', '));
      console.log('Ben instance-2 movementGuards:', JSON.stringify(
        DEFAULT_STORY_NPC_CHARACTER_LIBRARY.find((c) => c.id === 'ben-story').storyStates.find((s) => s.id === 'instance-2').movementGuards,
        null,
        2,
      ));
      console.log('Run with --apply to write to the database.');
      return;
    }

    await pool.query(
      `
      INSERT INTO game_npc_libraries (catalog_key, sprite_library, character_library, updated_at)
      VALUES ($1, $2::jsonb, $3::jsonb, NOW())
      ON CONFLICT (catalog_key)
      DO UPDATE SET
        sprite_library = EXCLUDED.sprite_library,
        character_library = EXCLUDED.character_library,
        updated_at = NOW()
      `,
      [GLOBAL_CATALOG_KEY, JSON.stringify(existingSpriteLibrary), JSON.stringify(mergedCharacterLibrary)],
    );
    console.log('Pushed story NPC character library to game_npc_libraries.');
    console.log('Characters:', mergedCharacterLibrary.length, '(Ben includes instance-2 battle guard with postDuelDialogue).');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
