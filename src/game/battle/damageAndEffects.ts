import type { CritterElement } from '@/game/critters/types';
import type { ElementChart } from '@/game/skills/types';
import { getElementChartMultiplier } from '@/game/skills/schema';
import type {
  SkillDefinition,
  SkillEffectAttachment,
  SkillEffectDefinition,
} from '@/game/skills/types';

export const BASE_CRIT_CHANCE = 0.0155;
export const MIN_BATTLE_STAT_MODIFIER = 0.1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Variance for damage: 0.85 to 1.15. Pass rng to allow deterministic tests. */
export function randomNumber(min: number, max: number, rng: () => number = Math.random): number {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  return safeMin + rng() * (safeMax - safeMin);
}

export interface BattleDamageAttacker {
  level: number;
  attack: number;
  attackModifier: number;
  element: string;
}

export interface BattleDamageDefender {
  defense: number;
  defenseModifier: number;
  guardActive: boolean;
  equipmentDefensePositiveBonus?: number;
  element: string;
  currentHp: number;
}

export interface ComputeBattleDamageParams {
  attacker: BattleDamageAttacker;
  defender: BattleDamageDefender;
  skill: Pick<SkillDefinition, 'damage' | 'element'>;
  elementChart: ElementChart;
  rng: () => number;
  /** 0 if not used; otherwise consumed crit bonus (e.g. from crit_buff effect). */
  consumedCritBonus?: number;
  /** When true, guard is treated as successful (0.02 multiplier). */
  defenderGuarded?: boolean;
  guardSucceeded?: boolean;
}

export interface ComputeBattleDamageResult {
  damage: number;
  damageDealt: number;
  isCrit: boolean;
  typeMult: number;
  stab: number;
}

/**
 * RPG battle damage formula: level term, base, type chart, STAB, crit, guard, variance.
 * Caller applies damage to defender.currentHp and handles KO.
 */
export function computeBattleDamage(params: ComputeBattleDamageParams): ComputeBattleDamageResult {
  const {
    attacker,
    defender,
    skill,
    elementChart,
    rng,
    consumedCritBonus = 0,
    defenderGuarded = false,
    guardSucceeded = false,
  } = params;

  const power = typeof skill.damage === 'number' && Number.isFinite(skill.damage)
    ? Math.max(1, Math.floor(skill.damage))
    : 20;

  const A = Math.max(
    1,
    attacker.attack * Math.max(MIN_BATTLE_STAT_MODIFIER, attacker.attackModifier),
  );
  const D = Math.max(
    1,
    defender.defense * Math.max(MIN_BATTLE_STAT_MODIFIER, defender.defenseModifier),
  );
  const levelTerm = (2 * attacker.level) / 5 + 2;
  const base = ((levelTerm * power * A) / D) / 50 + 2;

  const typeMult = getElementChartMultiplier(
    elementChart,
    skill.element as CritterElement,
    defender.element as CritterElement,
  );
  const stab = skill.element === attacker.element ? 1.2 : 1;

  const critChance = clamp(BASE_CRIT_CHANCE + consumedCritBonus, 0, 1);
  const isCrit = rng() < critChance;
  const critMult = isCrit ? 2 : 1;

  const equipmentBonus = Math.max(0, defender.equipmentDefensePositiveBonus ?? 0);
  const defenseWithoutPositiveEquipment = Math.max(1, defender.defense - equipmentBonus);
  const defenseModifierForCrit = Math.max(
    MIN_BATTLE_STAT_MODIFIER,
    Math.min(1, defender.defenseModifier),
  );
  const defenseForCrit = Math.max(1, defenseWithoutPositiveEquipment * defenseModifierForCrit);
  const baseForCrit = isCrit
    ? ((levelTerm * power * A) / defenseForCrit) / 50 + 2
    : base;

  const guardMult =
    defenderGuarded && guardSucceeded ? 0.02 : defenderGuarded && !guardSucceeded ? 1 : 1;
  const variance = randomNumber(0.85, 1.15, rng);
  const damage = Math.max(
    1,
    Math.floor(baseForCrit * typeMult * stab * critMult * guardMult * variance),
  );
  const damageDealt = Math.min(damage, Math.max(0, defender.currentHp));

  return {
    damage,
    damageDealt,
    isCrit,
    typeMult,
    stab,
  };
}

export interface ResolveAppliedSkillAttachmentsResult {
  attackerEffectAttachments: SkillEffectAttachment[];
  defenderEffectAttachments: SkillEffectAttachment[];
  recoilAttachments: SkillEffectAttachment[];
  attackerCritChanceBuffPercent: number;
}

export function resolveAppliedSkillAttachments(
  attachments: SkillEffectAttachment[],
  skillEffectLookupById: Record<string, SkillEffectDefinition>,
): ResolveAppliedSkillAttachmentsResult {
  const attackerEffectAttachments: SkillEffectAttachment[] = [];
  const defenderEffectAttachments: SkillEffectAttachment[] = [];
  const recoilAttachments: SkillEffectAttachment[] = [];
  let attackerCritChanceBuffPercent = 0;

  for (const attachment of attachments) {
    const effect = skillEffectLookupById[attachment.effectId];
    if (!effect) {
      continue;
    }
    if (
      effect.effect_type === 'atk_buff' ||
      effect.effect_type === 'def_buff' ||
      effect.effect_type === 'speed_buff' ||
      effect.effect_type === 'self_atk_debuff' ||
      effect.effect_type === 'self_def_debuff' ||
      effect.effect_type === 'self_speed_debuff'
    ) {
      attackerEffectAttachments.push(attachment);
      continue;
    }
    if (
      effect.effect_type === 'target_atk_debuff' ||
      effect.effect_type === 'target_def_debuff' ||
      effect.effect_type === 'target_speed_debuff'
    ) {
      defenderEffectAttachments.push(attachment);
      continue;
    }
    if (effect.effect_type === 'crit_buff') {
      const defaultBuff = typeof effect.buffPercent === 'number' ? effect.buffPercent : 0.1;
      attackerCritChanceBuffPercent += clamp(attachment.buffPercent ?? defaultBuff, 0, 1);
      continue;
    }
    if (effect.effect_type === 'recoil') {
      recoilAttachments.push(attachment);
    }
  }

  return {
    attackerEffectAttachments,
    defenderEffectAttachments,
    recoilAttachments,
    attackerCritChanceBuffPercent,
  };
}

export function resolveSkillEffectAttachmentsForRuntime(
  skill: Pick<SkillDefinition, 'effectAttachments' | 'effectIds'>,
  skillEffectLookupById: Record<string, SkillEffectDefinition>,
): SkillEffectAttachment[] {
  const normalized: SkillEffectAttachment[] = [];
  const seen = new Set<string>();
  const pushAttachment = (
    effectIdRaw: unknown,
    buffPercentRaw: unknown,
    procChanceRaw: unknown,
    recoilModeRaw: unknown,
    recoilPercentRaw: unknown,
  ): void => {
    if (typeof effectIdRaw !== 'string') {
      return;
    }
    const effectId = effectIdRaw.trim();
    if (!effectId || seen.has(effectId)) {
      return;
    }
    if (!skillEffectLookupById[effectId]) {
      return;
    }
    const effectFallback = skillEffectLookupById[effectId];
    const next: SkillEffectAttachment = {
      effectId,
      procChance: clamp(
        typeof procChanceRaw === 'number' && Number.isFinite(procChanceRaw) ? procChanceRaw : 1,
        0,
        1,
      ),
    };
    if (effectFallback.effect_type === 'recoil') {
      const recoilMode = recoilModeRaw === 'percent_damage_dealt' ? 'percent_damage_dealt' : 'percent_max_hp';
      next.recoilMode = recoilMode;
      next.recoilPercent = clamp(
        typeof recoilPercentRaw === 'number' && Number.isFinite(recoilPercentRaw) ? recoilPercentRaw : 0.1,
        0,
        1,
      );
    } else {
      const buffFallback = typeof effectFallback?.buffPercent === 'number' ? effectFallback.buffPercent : 0.1;
      next.buffPercent = clamp(
        typeof buffPercentRaw === 'number' && Number.isFinite(buffPercentRaw) ? buffPercentRaw : buffFallback,
        0,
        1,
      );
    }
    normalized.push(next);
    seen.add(effectId);
  };

  if (Array.isArray(skill.effectAttachments) && skill.effectAttachments.length > 0) {
    for (const attachment of skill.effectAttachments) {
      if (!attachment || typeof attachment !== 'object') {
        continue;
      }
      pushAttachment(
        attachment.effectId,
        attachment.buffPercent,
        attachment.procChance,
        attachment.recoilMode,
        attachment.recoilPercent,
      );
    }
    return normalized;
  }

  for (const effectId of skill.effectIds ?? []) {
    pushAttachment(effectId, undefined, 1, undefined, undefined);
  }
  return normalized;
}

export function buildSkillEffectBuffPercentById(
  attachments: SkillEffectAttachment[],
): Record<string, number> | undefined {
  if (attachments.length === 0) {
    return undefined;
  }
  const result: Record<string, number> = {};
  for (const attachment of attachments) {
    const buffPercent = clamp(
      typeof attachment.buffPercent === 'number' && Number.isFinite(attachment.buffPercent)
        ? attachment.buffPercent
        : 0,
      0,
      1,
    );
    if (buffPercent <= 0) {
      continue;
    }
    result[attachment.effectId] = (result[attachment.effectId] ?? 0) + buffPercent;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Heal amount from skill (support or damage-skill heal). Same logic as RPG. */
export function resolveRequestedSkillHealAmount(
  skill: Pick<SkillDefinition, 'element' | 'healMode' | 'healValue' | 'type'>,
  attackerMaxHp: number,
  damageDealt = 0,
): number {
  if (
    !skill.healMode ||
    skill.healMode === 'none' ||
    typeof skill.healValue !== 'number' ||
    !Number.isFinite(skill.healValue)
  ) {
    return 0;
  }

  const healMode =
    skill.type !== 'damage' && skill.healMode === 'percent_damage'
      ? 'percent_max_hp'
      : skill.healMode;

  let requestedHeal = 0;
  if (healMode === 'flat') {
    requestedHeal = Math.max(0, Math.floor(skill.healValue));
  } else if (healMode === 'percent_max_hp') {
    requestedHeal = Math.floor(attackerMaxHp * clamp(skill.healValue, 0, 1));
  } else if (healMode === 'percent_damage') {
    const percent = clamp(skill.healValue, 0, 1);
    if (percent > 0 && damageDealt > 0) {
      requestedHeal = Math.max(1, Math.floor(Math.max(0, damageDealt) * percent));
    }
  }

  return Math.max(0, requestedHeal);
}

export function resolveRequestedSkillRecoilAmount(
  attachments: SkillEffectAttachment[],
  attackerMaxHp: number,
  damageDealt: number,
): number {
  let totalRequested = 0;
  for (const attachment of attachments) {
    const recoilPercent = clamp(
      typeof attachment.recoilPercent === 'number' && Number.isFinite(attachment.recoilPercent)
        ? attachment.recoilPercent
        : 0,
      0,
      1,
    );
    if (recoilPercent <= 0) {
      continue;
    }
    if (attachment.recoilMode === 'percent_damage_dealt') {
      if (damageDealt <= 0) {
        continue;
      }
      totalRequested += Math.floor(Math.max(0, damageDealt) * recoilPercent);
      continue;
    }
    totalRequested += Math.max(1, Math.floor(Math.max(1, attackerMaxHp) * recoilPercent));
  }
  return Math.max(0, totalRequested);
}
