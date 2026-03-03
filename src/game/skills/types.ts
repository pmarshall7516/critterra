import type { CritterElement } from '@/game/critters/types';

export const SKILL_EFFECT_TYPES = ['atk_buff', 'def_buff', 'speed_buff'] as const;
export type SkillEffectType = (typeof SKILL_EFFECT_TYPES)[number];

export const SKILL_TYPES = ['damage', 'support'] as const;
export type SkillType = (typeof SKILL_TYPES)[number];

export const DAMAGE_SKILL_HEAL_MODES = ['none', 'flat', 'percent_max_hp', 'percent_damage'] as const;
export type DamageSkillHealMode = (typeof DAMAGE_SKILL_HEAL_MODES)[number];

export const SUPPORT_SKILL_HEAL_MODES = ['flat', 'percent_max_hp'] as const;
export type SupportSkillHealMode = (typeof SUPPORT_SKILL_HEAL_MODES)[number];

export type SkillHealMode = DamageSkillHealMode;

export interface SkillEffectDefinition {
  effect_id: string;
  effect_name: string;
  effect_type: SkillEffectType;
  buffPercent: number;
  description: string;
  /** Optional icon URL (e.g. from Supabase storage) for display on afflicted critter. */
  iconUrl?: string;
}

export interface SkillDefinition {
  skill_id: string;
  skill_name: string;
  element: CritterElement;
  type: SkillType;
  /** Present when type === 'damage'. Integer power (e.g. 10, 20, 40). */
  damage?: number;
  /** Optional heal behavior. Damage skills may omit this when no healing is attached. */
  healMode?: SkillHealMode;
  /** Flat HP for `flat`, otherwise 0–1 for percentage-based modes. */
  healValue?: number;
  /** Optional effect IDs from skill-effects table. */
  effectIds?: string[];
}

export function getSkillHealDisplayNumber(
  healMode: SkillHealMode | undefined,
  healValue: number | undefined,
): number | null {
  if (!healMode || healMode === 'none' || typeof healValue !== 'number' || !Number.isFinite(healValue)) {
    return null;
  }
  if (healMode === 'flat') {
    return Math.max(0, Math.floor(healValue));
  }
  return Math.max(0, Math.round(healValue * 100));
}

export function describeSkillHealForTooltip(
  healMode: SkillHealMode | undefined,
  healValue: number | undefined,
): string | null {
  const displayValue = getSkillHealDisplayNumber(healMode, healValue);
  if (displayValue == null || !healMode || healMode === 'none') {
    return null;
  }
  if (healMode === 'flat') {
    return `${displayValue} HP`;
  }
  if (healMode === 'percent_damage') {
    return `${displayValue}% of damage dealt`;
  }
  return `${displayValue}% max HP`;
}

export function getSkillValueDisplayNumber(
  skill: Pick<SkillDefinition, 'type' | 'damage' | 'healMode' | 'healValue'>,
): number | null {
  if (skill.type === 'damage') {
    return typeof skill.damage === 'number' && Number.isFinite(skill.damage)
      ? Math.max(1, Math.floor(skill.damage))
      : null;
  }
  return getSkillHealDisplayNumber(skill.healMode, skill.healValue);
}

export interface ElementChartEntry {
  attacker: CritterElement;
  defender: CritterElement;
  multiplier: number;
}

export type ElementChart = ElementChartEntry[];

/** Element display colors for skills (CSS-ready). */
export const ELEMENT_SKILL_COLORS: Record<CritterElement, string> = {
  normal: '#f5f0e1',
  tide: '#b3e5fc',
  ember: '#ffb74d',
  bloom: '#81c784',
  spark: '#fff176',
  shade: '#b8a0e0',
  gust: '#b0bec5',
  stone: '#d7ccc8',
};

/** Built-in skill used by opponent/wild when no movepool. */
export const DEFAULT_TACKLE_SKILL: SkillDefinition = {
  skill_id: 'tackle',
  skill_name: 'Tackle',
  element: 'normal',
  type: 'damage',
  damage: 20,
};
