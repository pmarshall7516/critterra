import type { CritterElement } from '@/game/critters/types';

export const SKILL_EFFECT_TYPES = ['atk_buff', 'def_buff', 'speed_buff'] as const;
export type SkillEffectType = (typeof SKILL_EFFECT_TYPES)[number];

export const SKILL_TYPES = ['damage', 'support'] as const;
export type SkillType = (typeof SKILL_TYPES)[number];

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
  /** Present when type === 'support'. 0–1, fraction of user's max HP healed. */
  healPercent?: number;
  /** Optional effect IDs from skill-effects table. */
  effectIds?: string[];
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
