export const CRITTER_ELEMENTS = ['bloom', 'ember', 'tide', 'gust', 'stone', 'spark', 'shade', 'normal'] as const;
export type CritterElement = (typeof CRITTER_ELEMENTS)[number];

export const CRITTER_RARITIES = ['common', 'uncommon', 'rare', 'legendary'] as const;
export type CritterRarity = (typeof CRITTER_RARITIES)[number];

export const CRITTER_ABILITY_KINDS = ['passive', 'active'] as const;
export type CritterAbilityKind = (typeof CRITTER_ABILITY_KINDS)[number];

export const CRITTER_MISSION_TYPES = ['opposing_knockouts', 'ascension', 'story_flag'] as const;
export type CritterMissionType = (typeof CRITTER_MISSION_TYPES)[number];

export interface CritterStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface CritterStatDelta {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface CritterAbilityDefinition {
  id: string;
  name: string;
  kind: CritterAbilityKind;
  description: string;
}

export interface CritterLevelMissionRequirement {
  id: string;
  type: CritterMissionType;
  targetValue: number;
  ascendsFromCritterId?: number;
  knockoutElements?: CritterElement[];
  knockoutCritterIds?: number[];
  storyFlagId?: string;
  label?: string;
}

export interface CritterLevelRequirement {
  level: number;
  missions: CritterLevelMissionRequirement[];
  requiredMissionCount: number;
  statDelta: CritterStatDelta;
  abilityUnlockIds: string[];
  skillUnlockIds: string[];
}

export interface CritterDefinition {
  id: number;
  name: string;
  element: CritterElement;
  rarity: CritterRarity;
  description: string;
  spriteUrl: string;
  baseStats: CritterStats;
  abilities: CritterAbilityDefinition[];
  levels: CritterLevelRequirement[];
}

/** Four skill slots; null = empty. Same order as battle 2x2 button layout. */
export type EquippedSkillSlots = [string | null, string | null, string | null, string | null];

export interface PlayerCritterCollectionEntry {
  critterId: number;
  unlocked: boolean;
  unlockedAt: string | null;
  unlockSource: string | null;
  level: number;
  currentHp: number;
  missionProgress: Record<string, number>;
  statBonus: CritterStatDelta;
  effectiveStats: CritterStats;
  unlockedAbilityIds: string[];
  equippedSkillIds: EquippedSkillSlots;
  lastProgressAt: string | null;
}

export interface PlayerCritterProgress {
  version: number;
  unlockedSquadSlots: number;
  squad: Array<number | null>;
  collection: PlayerCritterCollectionEntry[];
}

export const PLAYER_CRITTER_PROGRESS_VERSION = 6;
export const MAX_SQUAD_SLOTS = 8;
export const STARTING_UNLOCKED_SQUAD_SLOTS = 2;
