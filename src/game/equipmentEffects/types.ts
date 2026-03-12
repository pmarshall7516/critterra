export const EQUIPMENT_EFFECT_STATS = ['hp', 'attack', 'defense', 'speed'] as const;
export type EquipmentEffectStat = (typeof EQUIPMENT_EFFECT_STATS)[number];

export const EQUIPMENT_EFFECT_MODES = ['flat', 'percent'] as const;
export type EquipmentEffectMode = (typeof EQUIPMENT_EFFECT_MODES)[number];

export const EQUIPMENT_PERSISTENT_HEAL_MODES = ['flat', 'percent_max_hp'] as const;
export type EquipmentPersistentHealMode = (typeof EQUIPMENT_PERSISTENT_HEAL_MODES)[number];

export interface EquipmentEffectModifier {
  stat: EquipmentEffectStat;
  mode: EquipmentEffectMode;
  value: number;
}

export interface EquipmentPersistentHealConfig {
  mode: EquipmentPersistentHealMode;
  value: number;
}

export interface EquipmentEffectDefinition {
  effect_id: string;
  effect_name: string;
  description: string;
  iconUrl?: string;
  modifiers: EquipmentEffectModifier[];
  persistentHeal?: EquipmentPersistentHealConfig;
}
