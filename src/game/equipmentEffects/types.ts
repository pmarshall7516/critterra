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
