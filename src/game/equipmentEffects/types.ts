export const EQUIPMENT_EFFECT_STATS = ['hp', 'attack', 'defense', 'speed'] as const;
export type EquipmentEffectStat = (typeof EQUIPMENT_EFFECT_STATS)[number];

export const EQUIPMENT_EFFECT_MODES = ['flat', 'percent'] as const;
export type EquipmentEffectMode = (typeof EQUIPMENT_EFFECT_MODES)[number];

export const EQUIPMENT_PERSISTENT_HEAL_MODES = ['flat', 'percent_max_hp'] as const;
export type EquipmentPersistentHealMode = (typeof EQUIPMENT_PERSISTENT_HEAL_MODES)[number];

export const EQUIPMENT_EFFECT_TYPES = [
  'atk_buff',
  'def_buff',
  'speed_buff',
  'crit_buff',
  'persistent_heal',
  'apply_toxic',
  'apply_stun',
  'flinch_chance',
  // Compatibility-only legacy type inferred from old HP modifier templates.
  'hp_buff',
] as const;
export type EquipmentEffectType = (typeof EQUIPMENT_EFFECT_TYPES)[number];

export const EQUIPMENT_EFFECT_TYPES_EDITOR = [
  'atk_buff',
  'def_buff',
  'speed_buff',
  'crit_buff',
  'persistent_heal',
  'apply_toxic',
  'apply_stun',
  'flinch_chance',
] as const;

export interface EquipmentEffectModifier {
  stat: EquipmentEffectStat;
  mode: EquipmentEffectMode;
  value: number;
}

export interface EquipmentPersistentHealConfig {
  mode: EquipmentPersistentHealMode;
  value: number;
}

export interface EquipmentEffectAttachment {
  effectId: string;
  /** On-hit proc chance in 0..1 (status on-hit templates). */
  procChance?: number;
  /** Stat buff mode (atk/def/speed/hp compatibility templates only). */
  mode?: EquipmentEffectMode;
  /** Stat buff value (atk/def/speed/hp compatibility templates only). */
  value?: number;
  /** Absolute crit chance bonus in 0..1 (crit buff templates only). */
  critChanceBonus?: number;
  /** Persistent heal mode (persistent heal templates only). */
  persistentHealMode?: EquipmentPersistentHealMode;
  /** Persistent heal value (persistent heal templates only). */
  persistentHealValue?: number;
  /** Base toxic potency in 0..1 (apply_toxic templates only). */
  toxicPotencyBase?: number;
  /** Per-turn toxic ramp in 0..1 (apply_toxic templates only). */
  toxicPotencyPerTurn?: number;
  /** Stun fail chance in 0..1 (apply_stun templates only). */
  stunFailChance?: number;
  /** Stun speed slowdown in 0..1 (apply_stun templates only). */
  stunSlowdown?: number;
  /** Flinch only attempts on first damage-skill use after switch-in (flinch_chance templates only). */
  flinchFirstUseOnly?: boolean;
  /** Requires first-use and first actionable turn after switch-in (Fake Out-style). */
  flinchFirstOverallOnly?: boolean;
}

export interface EquipmentEffectDefinition {
  effect_id: string;
  effect_name: string;
  effect_type: EquipmentEffectType;
  description: string;
  iconUrl?: string;
  /** Legacy fallback values only; primary values are per-item attachments. */
  modifiers: EquipmentEffectModifier[];
  /** Legacy fallback value only; primary values are per-item attachments. */
  persistentHeal?: EquipmentPersistentHealConfig;
}
