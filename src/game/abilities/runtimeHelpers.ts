import type { SkillEffectDefinition, SkillEffectType } from '@/game/skills/types';
import type {
  AbilityDefinition,
  AbilityEffectTriggerFamily,
  AbilityDamagedBuffTemplateAttachment,
  AbilityGuardRecoilMode,
} from '@/game/abilities/types';

export function resolveGuardBuffRecoilDamage(
  recoilMode: AbilityGuardRecoilMode,
  recoilValue: number,
  attackerMaxHp: number,
  attemptedDamage: number,
): number {
  const safeValue = Number.isFinite(recoilValue) ? Math.max(0, recoilValue) : 0;
  if (safeValue <= 0) {
    return 0;
  }
  if (recoilMode === 'flat') {
    return Math.max(0, Math.floor(safeValue));
  }
  if (recoilMode === 'percent_attacker_max_hp') {
    return Math.max(0, Math.floor(Math.max(1, attackerMaxHp) * Math.min(1, safeValue)));
  }
  return Math.max(0, Math.floor(Math.max(0, attemptedDamage) * Math.min(1, safeValue)));
}

export function didDamagedBuffCrossThreshold(
  previousHp: number,
  nextHp: number,
  maxHp: number,
  belowPercent: number,
): boolean {
  const threshold = Math.floor(Math.max(1, maxHp) * clampUnitInterval(belowPercent));
  return previousHp > threshold && nextHp <= threshold;
}

export function isDamagedBuffThresholdSatisfied(
  currentHp: number,
  maxHp: number,
  belowPercent: number,
): boolean {
  const threshold = Math.floor(Math.max(1, maxHp) * clampUnitInterval(belowPercent));
  return currentHp <= threshold;
}

export function resolveEffectTriggerFamiliesForTarget(
  target: {
    activeEffectIds?: string[];
    persistentStatus?: { kind: 'toxic' | 'stun'; effectId?: string | null } | null;
    flinch?: { effectId?: string | null } | null;
  },
  skillEffectLookup: Record<string, Pick<SkillEffectDefinition, 'effect_type'> | undefined>,
): Set<AbilityEffectTriggerFamily> {
  const families = new Set<AbilityEffectTriggerFamily>();
  for (const effectId of target.activeEffectIds ?? []) {
    const effectType = skillEffectLookup[effectId]?.effect_type ?? null;
    const family = mapSkillEffectTypeToTriggerFamily(effectType);
    if (family) {
      families.add(family);
    }
  }
  if (target.persistentStatus?.kind === 'toxic') {
    families.add('toxic');
  }
  if (target.persistentStatus?.kind === 'stun') {
    families.add('stun');
  }
  if (target.flinch) {
    families.add('flinch');
  }
  return families;
}

export function abilityDefinitionHasTemplate(
  ability: AbilityDefinition | null | undefined,
  templateType: AbilityDefinition['templateAttachments'][number]['templateType'],
): boolean {
  return Boolean(ability?.templateAttachments.some((attachment) => attachment.templateType === templateType));
}

export function getDamagedBuffTemplateAttachment(
  ability: AbilityDefinition | null | undefined,
): AbilityDamagedBuffTemplateAttachment | null {
  const attachment = ability?.templateAttachments.find((entry) => entry.templateType === 'damaged-buff');
  return attachment?.templateType === 'damaged-buff' ? attachment : null;
}

export function getAbilityBattleStateDefaults(
  ability: AbilityDefinition | null | undefined,
  currentHp: number,
  maxHp: number,
): { damageTriggerReady: boolean; effectTriggerReady: boolean } {
  const damagedAttachment = getDamagedBuffTemplateAttachment(ability);
  if (!damagedAttachment) {
    return {
      damageTriggerReady: false,
      effectTriggerReady: false,
    };
  }
  return {
    damageTriggerReady:
      damagedAttachment.triggerType === 'damage'
        ? !isDamagedBuffThresholdSatisfied(currentHp, maxHp, damagedAttachment.belowPercent ?? 0.5)
        : false,
    effectTriggerReady: damagedAttachment.triggerType === 'effect',
  };
}

export function didDamagedBuffGainConfiguredFamily(
  previousFamilies: Set<AbilityEffectTriggerFamily>,
  nextFamilies: Set<AbilityEffectTriggerFamily>,
  configuredFamilies: AbilityEffectTriggerFamily[],
): boolean {
  return configuredFamilies.some((family) => !previousFamilies.has(family) && nextFamilies.has(family));
}

export function hasAnyConfiguredEffectTriggerFamily(
  families: Set<AbilityEffectTriggerFamily>,
  configuredFamilies: AbilityEffectTriggerFamily[],
): boolean {
  return configuredFamilies.some((family) => families.has(family));
}

export function mapSkillEffectTypeToTriggerFamily(
  effectType: SkillEffectType | null | undefined,
): AbilityEffectTriggerFamily | null {
  if (effectType === 'atk_buff') return 'atk_buff';
  if (effectType === 'def_buff') return 'def_buff';
  if (effectType === 'speed_buff') return 'speed_buff';
  if (effectType === 'self_atk_debuff' || effectType === 'target_atk_debuff') return 'atk_debuff';
  if (effectType === 'self_def_debuff' || effectType === 'target_def_debuff') return 'def_debuff';
  if (effectType === 'self_speed_debuff' || effectType === 'target_speed_debuff') return 'speed_debuff';
  if (effectType === 'crit_buff') return 'crit_buff';
  if (effectType === 'persistent_heal') return 'persistent_heal';
  return null;
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
