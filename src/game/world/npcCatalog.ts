import type { NpcMovementDefinition, NpcSpriteConfig } from '@/game/world/types';

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
  dialogueId: string;
  dialogueSpeaker?: string;
  dialogueLines?: string[];
  dialogueSetFlag?: string;
  battleTeamIds?: string[];
  movement?: NpcMovementDefinition;
  spriteId?: string;
}

const teenBoySprite: NpcSpriteConfig = {
  url: '/example_assets/character_npc_spritesheets/ow1.png',
  frameWidth: 32,
  frameHeight: 32,
  atlasCellWidth: 32,
  atlasCellHeight: 32,
  frameCellsWide: 1,
  frameCellsTall: 1,
  renderWidthTiles: 1,
  renderHeightTiles: 2,
  facingFrames: {
    down: 0,
    left: 4,
    right: 8,
    up: 12,
  },
  walkFrames: {
    down: [1, 2, 3],
    left: [5, 6, 7],
    right: [9, 10, 11],
    up: [13, 14, 15],
  },
};

export const DEFAULT_NPC_SPRITE_LIBRARY: NpcSpriteLibraryEntry[] = [
  {
    id: 'teen-boy',
    label: 'Teen Boy',
    sprite: teenBoySprite,
  },
];

export const DEFAULT_NPC_CHARACTER_LIBRARY: NpcCharacterTemplateEntry[] = [
  {
    id: 'eli',
    label: 'Eli',
    npcName: 'Eli',
    color: '#4d80c8',
    dialogueId: 'brother_intro',
    spriteId: 'teen-boy',
    movement: {
      type: 'static',
    },
  },
];
