import type {
  NpcInteractionActionDefinition,
  NpcMovementGuardDefinition,
  NpcMovementDefinition,
  NpcSpriteConfig,
  NpcStoryStateDefinition,
} from '@/game/world/types';

export interface NpcSpriteLibraryEntry {
  id: string;
  label: string;
  sprite: NpcSpriteConfig;
}

export interface NpcCharacterTemplateEntry {
  id: string;
  label: string;
  npcName: string;
  color: string;
  facing?: 'up' | 'down' | 'left' | 'right';
  dialogueId: string;
  dialogueSpeaker?: string;
  dialogueLines?: string[];
  dialogueSetFlag?: string;
  firstInteractionSetFlag?: string;
  firstInteractBattle?: boolean;
  healer?: boolean;
  battleTeamIds?: string[];
  movement?: NpcMovementDefinition;
  spriteId?: string;
  cacheVersion?: number;
  idleAnimation?: string;
  moveAnimation?: string;
  movementGuards?: NpcMovementGuardDefinition[];
  storyStates?: NpcStoryStateDefinition[];
  interactionScript?: NpcInteractionActionDefinition[];
}

export const DEFAULT_NPC_SPRITE_LIBRARY: NpcSpriteLibraryEntry[] = [];

export const DEFAULT_NPC_CHARACTER_LIBRARY: NpcCharacterTemplateEntry[] = [];

const UNCLE_HANK_SPRITE_URL = '/example_assets/character_npc_spritesheets/uncle_hank.png';
const JACOB_SPRITE_URL = '/example_assets/character_npc_spritesheets/jacob_spritesheet.png';
const CORE_UNCLE_HANK_ID = 'uncle-hank-story';
const CORE_JACOB_ID = 'jacob-story';
const CORE_BEN_ID = 'ben-story';
const FLAG_DEMO_START = 'demo-start';
const FLAG_SELECTED_STARTER = 'selected-starter-critter';
const FLAG_STARTER_SELECTION_DONE = 'starter-selection-done';
const FLAG_DEMO_DONE = 'demo-done';
const FLAG_BEN_DEFEATED = 'ben-defeated';

function createDefaultStorySprite(url: string): NpcSpriteConfig {
  return {
    url,
    frameWidth: 64,
    frameHeight: 64,
    atlasCellWidth: 64,
    atlasCellHeight: 64,
    frameCellsWide: 1,
    frameCellsTall: 1,
    renderWidthTiles: 1,
    renderHeightTiles: 2,
    defaultIdleAnimation: 'idle',
    defaultMoveAnimation: 'walk',
    facingFrames: {
      down: 0,
      left: 4,
      right: 8,
      up: 12,
    },
    walkFrames: {
      down: [0, 1, 2, 3],
      left: [4, 5, 6, 7],
      right: [8, 9, 10, 11],
      up: [12, 13, 14, 15],
    },
    animationSets: {
      idle: {
        down: [0],
        left: [4],
        right: [8],
        up: [12],
      },
      walk: {
        down: [0, 1, 2, 3],
        left: [4, 5, 6, 7],
        right: [8, 9, 10, 11],
        up: [12, 13, 14, 15],
      },
    },
  };
}

export const DEFAULT_STORY_NPC_SPRITE_LIBRARY: NpcSpriteLibraryEntry[] = [
  {
    id: 'uncle-hank-sprite',
    label: 'Uncle Hank',
    sprite: createDefaultStorySprite(UNCLE_HANK_SPRITE_URL),
  },
  {
    id: 'jacob-sprite-1',
    label: 'Jacob',
    sprite: createDefaultStorySprite(JACOB_SPRITE_URL),
  },
];

export const DEFAULT_STORY_NPC_CHARACTER_LIBRARY: NpcCharacterTemplateEntry[] = [
  {
    id: CORE_UNCLE_HANK_ID,
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
        firstInteractionSetFlag: FLAG_DEMO_START,
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
        requiresFlag: FLAG_SELECTED_STARTER,
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
    id: CORE_JACOB_ID,
    label: 'Jacob',
    npcName: 'Jacob',
    color: '#5c82d8',
    facing: 'up',
    dialogueId: 'custom_npc_dialogue',
    dialogueLines: ['<player-name>! You\'ve got a Critter?!'],
    battleTeamIds: ['moolnir@1'],
    movement: { type: 'static' },
    spriteId: 'jacob-sprite-1',
    storyStates: [
      {
        id: 'instance-1',
        requiresFlag: FLAG_STARTER_SELECTION_DONE,
        mapId: 'uncle-s-house',
        position: { x: 6, y: 12 },
        facing: 'up',
        dialogueLines: ['<player-name>! You\'ve got a Critter?!'],
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
    id: CORE_BEN_ID,
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
            defeatedFlag: FLAG_BEN_DEFEATED,
            postDuelDialogueSpeaker: 'Ben',
            postDuelDialogueLines: ["I can't believe I lost... You're really strong. Go ahead, the path is clear."],
          },
          {
            id: 'battle-ben-tile',
            requiresFlag: FLAG_DEMO_DONE,
            x: 11,
            y: 1,
            defeatedFlag: FLAG_BEN_DEFEATED,
            postDuelDialogueSpeaker: 'Ben',
            postDuelDialogueLines: ["I can't believe I lost... You're really strong. Go ahead, the path is clear."],
          },
        ],
      },
    ],
  },
];

function isNpcName(value: string | undefined, expected: string): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === expected.toLowerCase();
}

function isUncleHankCharacter(character: NpcCharacterTemplateEntry): boolean {
  return character.id === CORE_UNCLE_HANK_ID || isNpcName(character.npcName, 'Uncle Hank');
}

function isJacobCharacter(character: NpcCharacterTemplateEntry): boolean {
  return character.id === CORE_JACOB_ID || isNpcName(character.npcName, 'Jacob');
}

function isBenCharacter(character: NpcCharacterTemplateEntry): boolean {
  return character.id === CORE_BEN_ID || isNpcName(character.npcName, 'Ben');
}

function cloneStoryStates(states: NpcStoryStateDefinition[] | undefined): NpcStoryStateDefinition[] {
  if (!Array.isArray(states)) {
    return [];
  }
  return states.map((state) => ({
    ...state,
    position: state.position ? { ...state.position } : undefined,
    dialogueLines: state.dialogueLines ? [...state.dialogueLines] : undefined,
    battleTeamIds: state.battleTeamIds ? [...state.battleTeamIds] : undefined,
    movement: state.movement
      ? {
          ...state.movement,
          pattern: state.movement.pattern ? [...state.movement.pattern] : undefined,
        }
      : undefined,
    movementGuards: state.movementGuards
      ? state.movementGuards.map((guard) => ({
          ...guard,
          dialogueLines: guard.dialogueLines ? [...guard.dialogueLines] : undefined,
        }))
      : undefined,
    interactionScript: state.interactionScript ? state.interactionScript.map((entry) => ({ ...entry })) : undefined,
  }));
}

function cloneNpcCharacterTemplate(character: NpcCharacterTemplateEntry): NpcCharacterTemplateEntry {
  return {
    ...character,
    dialogueLines: character.dialogueLines ? [...character.dialogueLines] : undefined,
    battleTeamIds: character.battleTeamIds ? [...character.battleTeamIds] : undefined,
    movement: character.movement
      ? {
          ...character.movement,
          pattern: character.movement.pattern ? [...character.movement.pattern] : undefined,
        }
      : undefined,
    movementGuards: character.movementGuards
      ? character.movementGuards.map((guard) => ({
          ...guard,
          dialogueLines: guard.dialogueLines ? [...guard.dialogueLines] : undefined,
        }))
      : undefined,
    storyStates: cloneStoryStates(character.storyStates),
    interactionScript: character.interactionScript ? character.interactionScript.map((entry) => ({ ...entry })) : undefined,
  };
}

function pickLatestCharacter(
  candidates: NpcCharacterTemplateEntry[],
): NpcCharacterTemplateEntry | null {
  if (candidates.length === 0) {
    return null;
  }
  let selected = candidates[0];
  for (let index = 1; index < candidates.length; index += 1) {
    const current = candidates[index];
    const selectedVersion = Number.isFinite(selected.cacheVersion ?? NaN) ? (selected.cacheVersion as number) : -1;
    const currentVersion = Number.isFinite(current.cacheVersion ?? NaN) ? (current.cacheVersion as number) : -1;
    if (currentVersion >= selectedVersion) {
      selected = current;
    }
  }
  return selected;
}

function hasStateForFlag(states: NpcStoryStateDefinition[] | undefined, flag: string): boolean {
  return Boolean(states?.some((state) => state?.requiresFlag === flag));
}

function hasDefaultState(states: NpcStoryStateDefinition[] | undefined): boolean {
  return Boolean(states?.some((state) => !state?.requiresFlag));
}

function shouldKeepUncleStoryStates(states: NpcStoryStateDefinition[] | undefined): boolean {
  return (
    hasDefaultState(states) &&
    hasStateForFlag(states, FLAG_SELECTED_STARTER) &&
    hasStateForFlag(states, FLAG_DEMO_DONE)
  );
}

function shouldKeepJacobStoryStates(states: NpcStoryStateDefinition[] | undefined): boolean {
  return (
    hasStateForFlag(states, FLAG_STARTER_SELECTION_DONE) &&
    hasStateForFlag(states, FLAG_DEMO_DONE)
  );
}

function shouldKeepBenStoryStates(states: NpcStoryStateDefinition[] | undefined): boolean {
  return hasDefaultState(states);
}

export function normalizeCoreStoryNpcCharacters(
  rawCharacters: NpcCharacterTemplateEntry[],
): NpcCharacterTemplateEntry[] {
  const characters = rawCharacters.map((character) => cloneNpcCharacterTemplate(character));
  const uncleCandidates = characters.filter((character) => isUncleHankCharacter(character));
  const jacobCandidates = characters.filter((character) => isJacobCharacter(character));
  const benCandidates = characters.filter((character) => isBenCharacter(character));
  const baseUncle = pickLatestCharacter(uncleCandidates);
  const baseJacob = pickLatestCharacter(jacobCandidates);
  const baseBen = pickLatestCharacter(benCandidates);
  const uncleDefault = cloneNpcCharacterTemplate(DEFAULT_STORY_NPC_CHARACTER_LIBRARY[0]);
  const jacobDefault = cloneNpcCharacterTemplate(DEFAULT_STORY_NPC_CHARACTER_LIBRARY[1]);
  const benDefault = cloneNpcCharacterTemplate(DEFAULT_STORY_NPC_CHARACTER_LIBRARY[2]);

  const normalizedUncle: NpcCharacterTemplateEntry = {
    ...uncleDefault,
    ...baseUncle,
    id: CORE_UNCLE_HANK_ID,
    label: baseUncle?.label?.trim() || uncleDefault.label,
    npcName: 'Uncle Hank',
    spriteId: baseUncle?.spriteId || uncleDefault.spriteId,
    storyStates: shouldKeepUncleStoryStates(baseUncle?.storyStates)
      ? cloneStoryStates(baseUncle?.storyStates)
      : cloneStoryStates(uncleDefault.storyStates),
  };
  const normalizedJacob: NpcCharacterTemplateEntry = {
    ...jacobDefault,
    ...baseJacob,
    id: CORE_JACOB_ID,
    label: baseJacob?.label?.trim() || jacobDefault.label,
    npcName: 'Jacob',
    spriteId: baseJacob?.spriteId || jacobDefault.spriteId,
    storyStates: shouldKeepJacobStoryStates(baseJacob?.storyStates)
      ? cloneStoryStates(baseJacob?.storyStates)
      : cloneStoryStates(jacobDefault.storyStates),
  };
  const normalizedBen: NpcCharacterTemplateEntry = {
    ...benDefault,
    ...baseBen,
    id: CORE_BEN_ID,
    label: baseBen?.label?.trim() || benDefault.label,
    npcName: 'Ben',
    spriteId: baseBen?.spriteId || benDefault.spriteId,
    storyStates: shouldKeepBenStoryStates(baseBen?.storyStates)
      ? cloneStoryStates(baseBen?.storyStates)
      : cloneStoryStates(benDefault.storyStates),
  };

  const others = characters.filter(
    (character) => !isUncleHankCharacter(character) && !isJacobCharacter(character) && !isBenCharacter(character),
  );
  return [...others, normalizedUncle, normalizedJacob, normalizedBen];
}
