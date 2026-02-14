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
  idleAnimation?: string;
  moveAnimation?: string;
}

export const DEFAULT_NPC_SPRITE_LIBRARY: NpcSpriteLibraryEntry[] = [];

export const DEFAULT_NPC_CHARACTER_LIBRARY: NpcCharacterTemplateEntry[] = [];
