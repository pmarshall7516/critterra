import type { PersistentStatusCondition } from '@/game/battle/statusConditions';

export const CRITTER_ELEMENTS = [
  'bloom',
  'ember',
  'tide',
  'gust',
  'stone',
  'spark',
  'shade',
  'normal',
  'primal',
  'mystic',
] as const;
export type CritterElement = (typeof CRITTER_ELEMENTS)[number];

export const CRITTER_RARITIES = ['common', 'uncommon', 'rare', 'legendary'] as const;
export type CritterRarity = (typeof CRITTER_RARITIES)[number];

export const CRITTER_ABILITY_KINDS = ['passive', 'active'] as const;
export type CritterAbilityKind = (typeof CRITTER_ABILITY_KINDS)[number];

export const CRITTER_MISSION_TYPES = [
  'opposing_knockouts',
  'opposing_knockouts_with_item',
  'pay_item',
  'use_guard',
  'swap_in',
  'swap_out',
  'heal_critter',
  'heal_with_skills',
  'land_critical_hits',
  'use_skill',
  'deal_damage',
  'ascension',
  'story_flag',
  // Legacy: effect_buffed_actions used a single effectTemplateId and
  // applied to both skill and equipment effects. It is now treated as an
  // alias of skill_effect_buffed_actions for backwards compatibility.
  'effect_buffed_actions',
  'skill_effect_buffed_actions',
  'equip_effect_buffed_actions',
  'absorb_damage',
] as const;
export type CritterMissionType = (typeof CRITTER_MISSION_TYPES)[number];
export type CritterKnockoutMissionType = 'opposing_knockouts' | 'opposing_knockouts_with_item';

export function isKnockoutMissionType(type: string): type is CritterKnockoutMissionType {
  return type === 'opposing_knockouts' || type === 'opposing_knockouts_with_item';
}

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

export const USE_SKILL_MODES = ['any', 'element', 'specific'] as const;
export type UseSkillMode = (typeof USE_SKILL_MODES)[number];

export const DEAL_DAMAGE_MODES = ['any', 'element'] as const;
export type DealDamageMode = (typeof DEAL_DAMAGE_MODES)[number];

export const EFFECT_BUFF_MODES = ['knockouts', 'deal_damage', 'damage_absorbed'] as const;
export type EffectBuffMode = (typeof EFFECT_BUFF_MODES)[number];

export const ABSORB_DAMAGE_MODES = ['knockout', 'damage', 'element'] as const;
export type AbsorbDamageMode = (typeof ABSORB_DAMAGE_MODES)[number];

export interface CritterLevelMissionRequirement {
  id: string;
  type: CritterMissionType;
  targetValue: number;
  ascendsFromCritterId?: number;
  knockoutElements?: CritterElement[];
  knockoutCritterIds?: number[];
  requiredEquippedItemCount?: number;
  requiredEquippedItemIds?: string[];
  requiredPaymentItemId?: string;
  requiredHealingItemIds?: string[];
  /** Use Skill mission: any = any skill counts; element = useSkillElements; specific = useSkillIds */
  useSkillMode?: UseSkillMode;
  useSkillElements?: CritterElement[];
  useSkillIds?: string[];
  /** Deal Damage mission: any = any skill damage counts; element = only skill damage of selected element(s). */
  dealDamageMode?: DealDamageMode;
  dealDamageElements?: CritterElement[];
  /** Legacy single-template id for effect_buffed_actions missions. */
  effectTemplateId?: string;
  /**
   * Skill Buffed Actions mission: one or more skill effect templates that
   * must be active on the critter for progress to count.
   */
  skillEffectTemplateIds?: string[];
  /**
   * Equip Buffed Actions mission: one or more equipment effect templates
   * that must be active on the critter for progress to count.
   */
  equipEffectTemplateIds?: string[];
  effectBuffMode?: EffectBuffMode;
  /** Optional custom description shown in the missions UI for buffed-action missions. */
  effectBuffDescription?: string;
  /** Absorb Damage mission: knockout = count self KOs; damage = total damage taken; element = skill damage from selected element(s). */
  absorbMode?: AbsorbDamageMode;
  absorbDamageElements?: CritterElement[];
  storyFlagId?: string;
  label?: string;
}

export interface CritterLevelRequirement {
  level: number;
  missions: CritterLevelMissionRequirement[];
  requiredMissionCount: number;
  statDelta: CritterStatDelta;
  unlockEquipSlots: number;
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

export interface EquippedEquipmentAnchor {
  itemId: string;
  slotIndex: number;
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
  equippedSkillIds: EquippedSkillSlots;
  equippedEquipmentAnchors: EquippedEquipmentAnchor[];
  /** Persistent battle status that carries across RPG battles until healed. */
  persistentStatus?: PersistentStatusCondition | null;
  lastProgressAt: string | null;
}

export interface PlayerCritterProgress {
  version: number;
  unlockedSquadSlots: number;
  squad: Array<number | null>;
  collection: PlayerCritterCollectionEntry[];
  lockedKnockoutTargetCritterId: number | null;
  /** Which locked critter receives deal_damage mission credit (level 1 only). */
  lockedDamageTargetCritterId: number | null;
}

export const PLAYER_CRITTER_PROGRESS_VERSION = 9;
export const MAX_SQUAD_SLOTS = 8;
export const STARTING_UNLOCKED_SQUAD_SLOTS = 2;
