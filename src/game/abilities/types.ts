import type { SkillEffectAttachment } from '@/game/skills/types';

export const ABILITY_TEMPLATE_TYPES = ['guard-buff', 'damaged-buff'] as const;
export type AbilityTemplateType = (typeof ABILITY_TEMPLATE_TYPES)[number];

export const ABILITY_GUARD_BUFF_MODES = ['recoil', 'proc'] as const;
export type AbilityGuardBuffMode = (typeof ABILITY_GUARD_BUFF_MODES)[number];

export const ABILITY_GUARD_RECOIL_MODES = [
  'flat',
  'percent_attacker_max_hp',
  'percent_incoming_damage',
] as const;
export type AbilityGuardRecoilMode = (typeof ABILITY_GUARD_RECOIL_MODES)[number];

export const ABILITY_PROC_TARGETS = ['self', 'attacker'] as const;
export type AbilityProcTarget = (typeof ABILITY_PROC_TARGETS)[number];

export const ABILITY_DAMAGED_BUFF_TRIGGER_TYPES = ['damage', 'effect'] as const;
export type AbilityDamagedBuffTriggerType = (typeof ABILITY_DAMAGED_BUFF_TRIGGER_TYPES)[number];

export const ABILITY_EFFECT_TRIGGER_FAMILIES = [
  'atk_buff',
  'def_buff',
  'speed_buff',
  'atk_debuff',
  'def_debuff',
  'speed_debuff',
  'crit_buff',
  'persistent_heal',
  'toxic',
  'stun',
  'flinch',
] as const;
export type AbilityEffectTriggerFamily = (typeof ABILITY_EFFECT_TRIGGER_FAMILIES)[number];

export interface AbilityGuardBuffTemplateAttachment {
  templateType: 'guard-buff';
  mode: AbilityGuardBuffMode;
  recoilMode: AbilityGuardRecoilMode;
  recoilValue: number;
  procTarget?: AbilityProcTarget;
  procEffectAttachment?: SkillEffectAttachment | null;
}

export interface AbilityDamagedBuffTemplateAttachment {
  templateType: 'damaged-buff';
  triggerType: AbilityDamagedBuffTriggerType;
  belowPercent?: number;
  triggerFamilies?: AbilityEffectTriggerFamily[];
  rewardEffectAttachment?: SkillEffectAttachment | null;
}

export type AbilityTemplateAttachment =
  | AbilityGuardBuffTemplateAttachment
  | AbilityDamagedBuffTemplateAttachment;

export interface AbilityDefinition {
  id: string;
  name: string;
  element: string;
  description: string;
  templateAttachments: AbilityTemplateAttachment[];
}
