import type { SkillEffectDefinition, SkillEffectType } from '@/game/skills/types';

interface ActiveEffectCarrier {
  activeEffectIds?: string[];
  activeEffectSourceById?: Record<string, string>;
  activeEffectValueById?: Record<string, number>;
  pendingCritChanceBonus?: number;
}

type SkillEffectLookup =
  | Record<string, Pick<SkillEffectDefinition, 'effect_type'> | undefined>
  | Map<string, Pick<SkillEffectDefinition, 'effect_type'>>;

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function getSkillEffectType(
  skillEffectLookup: SkillEffectLookup,
  effectId: string,
): SkillEffectType | null {
  if (skillEffectLookup instanceof Map) {
    return skillEffectLookup.get(effectId)?.effect_type ?? null;
  }
  return skillEffectLookup[effectId]?.effect_type ?? null;
}

function ensureActiveEffectState(target: ActiveEffectCarrier): void {
  if (!Array.isArray(target.activeEffectIds)) {
    target.activeEffectIds = [];
  }
  if (!target.activeEffectSourceById || typeof target.activeEffectSourceById !== 'object') {
    target.activeEffectSourceById = {};
  }
  if (!target.activeEffectValueById || typeof target.activeEffectValueById !== 'object') {
    target.activeEffectValueById = {};
  }
  if (typeof target.pendingCritChanceBonus !== 'number' || !Number.isFinite(target.pendingCritChanceBonus)) {
    target.pendingCritChanceBonus = 0;
  }
}

export function recordActiveEffect(
  target: ActiveEffectCarrier,
  effectId: string,
  sourceName: string,
  value: number,
): void {
  const normalizedEffectId = typeof effectId === 'string' ? effectId.trim() : '';
  if (!normalizedEffectId) {
    return;
  }
  ensureActiveEffectState(target);
  if (!target.activeEffectIds!.includes(normalizedEffectId)) {
    target.activeEffectIds!.push(normalizedEffectId);
  }
  target.activeEffectSourceById![normalizedEffectId] = sourceName;
  target.activeEffectValueById![normalizedEffectId] =
    (target.activeEffectValueById![normalizedEffectId] ?? 0) + value;
}

export function clearActiveEffect(target: ActiveEffectCarrier, effectId: string): void {
  const normalizedEffectId = typeof effectId === 'string' ? effectId.trim() : '';
  if (!normalizedEffectId) {
    return;
  }
  ensureActiveEffectState(target);
  target.activeEffectIds = target.activeEffectIds!.filter((entry) => entry !== normalizedEffectId);
  delete target.activeEffectSourceById![normalizedEffectId];
  delete target.activeEffectValueById![normalizedEffectId];
}

export function clearActiveEffectsByType(
  target: ActiveEffectCarrier,
  effectType: SkillEffectType,
  skillEffectLookup: SkillEffectLookup,
): void {
  ensureActiveEffectState(target);
  const idsToClear = target.activeEffectIds!.filter((effectId) => getSkillEffectType(skillEffectLookup, effectId) === effectType);
  idsToClear.forEach((effectId) => clearActiveEffect(target, effectId));
}

export function applyPendingCritChanceBuff(
  target: ActiveEffectCarrier,
  effectId: string,
  sourceName: string,
  value: number,
): void {
  const normalizedValue = clampUnitInterval(value);
  if (normalizedValue <= 0) {
    return;
  }
  ensureActiveEffectState(target);
  target.pendingCritChanceBonus = clampUnitInterval((target.pendingCritChanceBonus ?? 0) + normalizedValue);
  recordActiveEffect(target, effectId, sourceName, normalizedValue);
}

export function consumePendingCritChanceBonus(
  target: ActiveEffectCarrier,
  skillEffectLookup: SkillEffectLookup,
): number {
  ensureActiveEffectState(target);
  const consumed = clampUnitInterval(target.pendingCritChanceBonus ?? 0);
  if (consumed <= 0) {
    return 0;
  }
  target.pendingCritChanceBonus = 0;
  clearActiveEffectsByType(target, 'crit_buff', skillEffectLookup);
  return consumed;
}
