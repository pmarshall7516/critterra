export const CRITTER_ELEMENTS = ['bloom', 'ember', 'tide', 'gust', 'stone', 'spark', 'shade'] as const;
export type CritterElement = (typeof CRITTER_ELEMENTS)[number];

export const CRITTER_RARITIES = ['common', 'uncommon', 'rare', 'legendary'] as const;
export type CritterRarity = (typeof CRITTER_RARITIES)[number];

export const CRITTER_ABILITY_KINDS = ['passive', 'active'] as const;
export type CritterAbilityKind = (typeof CRITTER_ABILITY_KINDS)[number];

export const CRITTER_MISSION_TYPES = ['opposing_knockouts', 'ascension'] as const;
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
}

export interface CritterLevelRequirement {
  level: number;
  missions: CritterLevelMissionRequirement[];
  requiredMissionCount: number;
  statDelta: CritterStatDelta;
  abilityUnlockIds: string[];
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
  lastProgressAt: string | null;
}

export interface PlayerCritterProgress {
  version: number;
  unlockedSquadSlots: number;
  squad: Array<number | null>;
  collection: PlayerCritterCollectionEntry[];
}

export const PLAYER_CRITTER_PROGRESS_VERSION = 5;
export const MAX_SQUAD_SLOTS = 8;
export const STARTING_UNLOCKED_SQUAD_SLOTS = 2;
