import type {
  EquipmentEffectAttachment,
  EquipmentEffectDefinition,
  EquipmentEffectMode,
  EquipmentEffectStat,
  EquipmentEffectType,
  EquipmentPersistentHealMode,
} from '@/game/equipmentEffects/types';
import {
  EQUIPMENT_EFFECT_MODES,
  EQUIPMENT_PERSISTENT_HEAL_MODES,
} from '@/game/equipmentEffects/types';
import type { GameItemDefinition } from '@/game/items/types';

const EFFECT_MODE_SET = new Set<EquipmentEffectMode>(EQUIPMENT_EFFECT_MODES);
const PERSISTENT_HEAL_MODE_SET = new Set<EquipmentPersistentHealMode>(EQUIPMENT_PERSISTENT_HEAL_MODES);

const STAT_BY_EFFECT_TYPE: Partial<Record<EquipmentEffectType, EquipmentEffectStat>> = {
  atk_buff: 'attack',
  def_buff: 'defense',
  speed_buff: 'speed',
  hp_buff: 'hp',
};

export interface EquipmentEffectInstance {
  effectId: string;
  effectType: EquipmentEffectType;
  procChance?: number;
  mode?: EquipmentEffectMode;
  value?: number;
  critChanceBonus?: number;
  persistentHealMode?: EquipmentPersistentHealMode;
  persistentHealValue?: number;
  toxicPotencyBase?: number;
  toxicPotencyPerTurn?: number;
  stunFailChance?: number;
  stunSlowdown?: number;
  flinchFirstUseOnly?: boolean;
  flinchFirstOverallOnly?: boolean;
}

export type EquipmentEffectLookup =
  | Record<string, EquipmentEffectDefinition>
  | ReadonlyMap<string, EquipmentEffectDefinition>;

export function resolveEquipmentEffectInstancesForItem(
  item: Pick<GameItemDefinition, 'category' | 'effectType' | 'effectConfig'>,
  effectLookupById: EquipmentEffectLookup,
): EquipmentEffectInstance[] {
  if (item.category !== 'equipment') {
    return [];
  }
  if (item.effectType !== 'equip_effect' && item.effectType !== 'equip_stub') {
    return [];
  }
  const config =
    item.effectConfig && typeof item.effectConfig === 'object' && !Array.isArray(item.effectConfig)
      ? (item.effectConfig as Record<string, unknown>)
      : {};

  const fromAttachments = resolveFromConfiguredAttachments(config.equipmentEffectAttachments, effectLookupById);
  if (fromAttachments.length > 0) {
    return fromAttachments;
  }

  const fallbackIds = sanitizeEquipmentEffectIdArray(config.equipmentEffectIds ?? config.equipment_effect_ids);
  const synthesized: EquipmentEffectInstance[] = [];
  for (const effectId of fallbackIds) {
    const effect = getEquipmentEffectById(effectLookupById, effectId);
    if (!effect) {
      continue;
    }
    synthesized.push(resolveInstanceForTemplate(effectId, effect, null));
  }
  return synthesized;
}

export function resolveEquipmentEffectIdsForItem(
  item: Pick<GameItemDefinition, 'category' | 'effectType' | 'effectConfig'>,
  effectLookupById: EquipmentEffectLookup,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const instance of resolveEquipmentEffectInstancesForItem(item, effectLookupById)) {
    if (seen.has(instance.effectId)) {
      continue;
    }
    seen.add(instance.effectId);
    ids.push(instance.effectId);
  }
  return ids;
}

export function summarizeEquipmentEffectInstanceValues(
  effectType: EquipmentEffectType,
  instances: EquipmentEffectInstance[],
): string {
  if (instances.length <= 0) {
    return '';
  }

  if (effectType === 'crit_buff') {
    const critBonus = instances.reduce((sum, entry) => sum + clamp(entry.critChanceBonus ?? 0, 0, 1), 0);
    const percent = Math.round(critBonus * 100);
    return `${percent >= 0 ? '+' : ''}${percent}% crit chance`;
  }

  if (effectType === 'persistent_heal') {
    const flat = instances
      .filter((entry) => entry.persistentHealMode === 'flat')
      .reduce((sum, entry) => sum + Math.max(1, Math.floor(entry.persistentHealValue ?? 1)), 0);
    const percent = instances
      .filter((entry) => entry.persistentHealMode !== 'flat')
      .reduce((sum, entry) => sum + clamp(entry.persistentHealValue ?? 0, 0, 1), 0);
    const lines: string[] = [];
    if (flat > 0) {
      lines.push(`End turn heal +${flat} HP while equipped`);
    }
    if (percent > 0) {
      lines.push(`End turn heal +${Math.round(percent * 100)}% max HP while equipped`);
    }
    return lines.join(', ');
  }

  if (effectType === 'apply_toxic') {
    const chance = instances.reduce((sum, entry) => sum + clamp(entry.procChance ?? 0, 0, 1), 0);
    const base = instances.reduce((sum, entry) => sum + clamp(entry.toxicPotencyBase ?? 0, 0, 1), 0);
    const ramp = instances.reduce((sum, entry) => sum + clamp(entry.toxicPotencyPerTurn ?? 0, 0, 1), 0);
    return `On hit: ${Math.round(chance * 100)}% Toxic (${Math.round(base * 100)}% +${Math.round(ramp * 100)}%/turn)`;
  }

  if (effectType === 'apply_stun') {
    const chance = instances.reduce((sum, entry) => sum + clamp(entry.procChance ?? 0, 0, 1), 0);
    const fail = instances.reduce((sum, entry) => sum + clamp(entry.stunFailChance ?? 0, 0, 1), 0);
    const slow = instances.reduce((sum, entry) => sum + clamp(entry.stunSlowdown ?? 0, 0, 1), 0);
    return `On hit: ${Math.round(chance * 100)}% Stun (${Math.round(fail * 100)}% fail, -${Math.round(slow * 100)}% SPD)`;
  }

  if (effectType === 'flinch_chance') {
    const chance = instances.reduce((sum, entry) => sum + clamp(entry.procChance ?? 0, 0, 1), 0);
    const firstUseOnly = instances.some((entry) => entry.flinchFirstUseOnly);
    const firstOverallOnly = instances.some((entry) => entry.flinchFirstUseOnly && entry.flinchFirstOverallOnly);
    const qualifiers: string[] = [];
    if (firstUseOnly) {
      qualifiers.push(firstOverallOnly ? 'first use on switch-in turn only' : 'first use only');
    }
    const suffix = qualifiers.length > 0 ? ` (${qualifiers.join(', ')})` : '';
    return `On hit: ${Math.round(chance * 100)}% Flinch chance${suffix}`;
  }

  const stat = STAT_BY_EFFECT_TYPE[effectType];
  if (!stat) {
    return '';
  }

  const statLabel =
    stat === 'attack'
      ? 'ATK'
      : stat === 'defense'
        ? 'DEF'
        : stat === 'speed'
          ? 'SPD'
          : 'HP';
  const flat = instances
    .filter((entry) => entry.mode === 'flat')
    .reduce((sum, entry) => sum + Math.round(entry.value ?? 0), 0);
  const percent = instances
    .filter((entry) => entry.mode !== 'flat')
    .reduce((sum, entry) => sum + (entry.value ?? 0), 0);
  const parts: string[] = [];
  if (flat !== 0) {
    parts.push(`${flat >= 0 ? '+' : ''}${Math.round(flat)} ${statLabel}`);
  }
  if (percent !== 0) {
    parts.push(`${percent >= 0 ? '+' : ''}${Math.round(percent * 100)}% ${statLabel}`);
  }
  return parts.join(', ');
}

export function groupEquipmentEffectInstancesById(
  instances: EquipmentEffectInstance[],
): Map<string, EquipmentEffectInstance[]> {
  const grouped = new Map<string, EquipmentEffectInstance[]>();
  for (const instance of instances) {
    const next = grouped.get(instance.effectId) ?? [];
    next.push(instance);
    grouped.set(instance.effectId, next);
  }
  return grouped;
}

function resolveFromConfiguredAttachments(
  rawAttachments: unknown,
  effectLookupById: EquipmentEffectLookup,
): EquipmentEffectInstance[] {
  if (!Array.isArray(rawAttachments)) {
    return [];
  }
  const parsed: EquipmentEffectInstance[] = [];
  const seen = new Set<string>();

  for (const entry of rawAttachments) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const effectIdRaw = record.effectId ?? record.effect_id;
    if (typeof effectIdRaw !== 'string') {
      continue;
    }
    const effectId = effectIdRaw.trim();
    if (!effectId || seen.has(effectId)) {
      continue;
    }
    const effect = getEquipmentEffectById(effectLookupById, effectId);
    if (!effect) {
      continue;
    }
    parsed.push(resolveInstanceForTemplate(effectId, effect, record));
    seen.add(effectId);
  }

  return parsed;
}

function resolveInstanceForTemplate(
  effectId: string,
  template: EquipmentEffectDefinition,
  attachmentRecord: Record<string, unknown> | null,
): EquipmentEffectInstance {
  if (template.effect_type === 'crit_buff') {
    return {
      effectId,
      effectType: template.effect_type,
      critChanceBonus: resolveCritChanceBonus(template, attachmentRecord),
    };
  }

  if (template.effect_type === 'persistent_heal') {
    const { mode, value } = resolvePersistentHealConfig(template, attachmentRecord);
    return {
      effectId,
      effectType: template.effect_type,
      persistentHealMode: mode,
      persistentHealValue: value,
    };
  }

  if (template.effect_type === 'apply_toxic') {
    const procChance = resolveStatusProcChance(attachmentRecord);
    const toxicPotencyBase = clamp(parseNumeric(
      attachmentRecord?.toxicPotencyBase ??
      attachmentRecord?.toxic_potency_base,
      0.05,
    ), 0, 1);
    const toxicPotencyPerTurn = clamp(parseNumeric(
      attachmentRecord?.toxicPotencyPerTurn ??
      attachmentRecord?.toxic_potency_per_turn,
      0.05,
    ), 0, 1);
    return {
      effectId,
      effectType: template.effect_type,
      procChance,
      toxicPotencyBase,
      toxicPotencyPerTurn,
    };
  }

  if (template.effect_type === 'apply_stun') {
    const procChance = resolveStatusProcChance(attachmentRecord);
    const stunFailChance = clamp(parseNumeric(
      attachmentRecord?.stunFailChance ??
      attachmentRecord?.stun_fail_chance,
      0.25,
    ), 0, 1);
    const stunSlowdown = clamp(parseNumeric(
      attachmentRecord?.stunSlowdown ??
      attachmentRecord?.stun_slowdown,
      0.5,
    ), 0, 1);
    return {
      effectId,
      effectType: template.effect_type,
      procChance,
      stunFailChance,
      stunSlowdown,
    };
  }

  if (template.effect_type === 'flinch_chance') {
    const flinchFirstUseOnly = parseBooleanFlag(
      attachmentRecord?.flinchFirstUseOnly ??
      attachmentRecord?.flinch_first_use_only,
    );
    const flinchFirstOverallOnly = flinchFirstUseOnly && parseBooleanFlag(
      attachmentRecord?.flinchFirstOverallOnly ??
      attachmentRecord?.flinch_first_overall_only,
    );
    return {
      effectId,
      effectType: template.effect_type,
      procChance: resolveStatusProcChance(attachmentRecord),
      flinchFirstUseOnly,
      flinchFirstOverallOnly,
    };
  }

  const { mode, value } = resolveStatConfig(template, attachmentRecord);
  return {
    effectId,
    effectType: template.effect_type,
    mode,
    value,
  };
}

function resolveStatusProcChance(
  attachmentRecord: Record<string, unknown> | null,
): number {
  return clamp(parseNumeric(
    attachmentRecord?.procChance ??
    attachmentRecord?.proc_chance,
    0.2,
  ), 0, 1);
}

function resolveCritChanceBonus(
  template: EquipmentEffectDefinition,
  attachmentRecord: Record<string, unknown> | null,
): number {
  const templateRecord = template as unknown as {
    critChanceBonus?: unknown;
    crit_chance_bonus?: unknown;
  };
  const rawFromAttachment =
    attachmentRecord?.critChanceBonus ??
    attachmentRecord?.crit_chance_bonus ??
    attachmentRecord?.value;
  const rawFromTemplate =
    templateRecord.critChanceBonus ??
    templateRecord.crit_chance_bonus;
  const parsed = parseNumeric(rawFromAttachment);
  if (Number.isFinite(parsed)) {
    return clamp(parsed, 0, 1);
  }
  const fallback = parseNumeric(rawFromTemplate);
  if (Number.isFinite(fallback)) {
    return clamp(fallback, 0, 1);
  }
  return 0.05;
}

function resolvePersistentHealConfig(
  template: EquipmentEffectDefinition,
  attachmentRecord: Record<string, unknown> | null,
): { mode: EquipmentPersistentHealMode; value: number } {
  const modeRaw =
    attachmentRecord?.persistentHealMode ??
    attachmentRecord?.persistent_heal_mode ??
    template.persistentHeal?.mode;
  const mode =
    typeof modeRaw === 'string' && PERSISTENT_HEAL_MODE_SET.has(modeRaw.trim().toLowerCase() as EquipmentPersistentHealMode)
      ? (modeRaw.trim().toLowerCase() as EquipmentPersistentHealMode)
      : template.persistentHeal?.mode === 'flat'
        ? 'flat'
        : 'percent_max_hp';

  const rawValue =
    attachmentRecord?.persistentHealValue ??
    attachmentRecord?.persistent_heal_value ??
    template.persistentHeal?.value;
  if (mode === 'flat') {
    return {
      mode,
      value: Math.max(1, Math.floor(clamp(parseNumeric(rawValue, 1), 1, 9999))),
    };
  }
  return {
    mode,
    value: clamp(parseNumeric(rawValue, 0.05), 0, 1),
  };
}

function resolveStatConfig(
  template: EquipmentEffectDefinition,
  attachmentRecord: Record<string, unknown> | null,
): { mode: EquipmentEffectMode; value: number } {
  const legacyModifier = findLegacyTemplateModifier(template);
  const modeRaw = attachmentRecord?.mode ?? legacyModifier?.mode;
  const mode =
    typeof modeRaw === 'string' && EFFECT_MODE_SET.has(modeRaw.trim().toLowerCase() as EquipmentEffectMode)
      ? (modeRaw.trim().toLowerCase() as EquipmentEffectMode)
      : typeof legacyModifier?.mode === 'string' && EFFECT_MODE_SET.has(legacyModifier.mode)
        ? legacyModifier.mode
        : 'percent';

  const rawValue = attachmentRecord?.value ?? legacyModifier?.value;
  if (mode === 'flat') {
    return {
      mode,
      value: Math.floor(clamp(parseNumeric(rawValue, 1), -999, 999)),
    };
  }
  return {
    mode,
    value: clamp(parseNumeric(rawValue, 0.1), -5, 5),
  };
}

function findLegacyTemplateModifier(template: EquipmentEffectDefinition): EquipmentEffectAttachment | null {
  const stat = STAT_BY_EFFECT_TYPE[template.effect_type];
  if (!stat) {
    return null;
  }
  const match = (template.modifiers ?? []).find((modifier) => modifier.stat === stat);
  if (!match) {
    return null;
  }
  return {
    effectId: template.effect_id,
    mode: match.mode,
    value: match.value,
  };
}

function sanitizeEquipmentEffectIdArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const parsed: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      continue;
    }
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    parsed.push(normalized);
  }
  return parsed;
}

function getEquipmentEffectById(
  lookup: EquipmentEffectLookup,
  effectId: string,
): EquipmentEffectDefinition | undefined {
  if (lookup instanceof Map) {
    return lookup.get(effectId);
  }
  const recordLookup = lookup as Record<string, EquipmentEffectDefinition>;
  return recordLookup[effectId];
}

function parseNumeric(raw: unknown, fallback = Number.NaN): number {
  const parsed =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : typeof raw === 'string' && raw.trim().length > 0
        ? Number.parseFloat(raw)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBooleanFlag(raw: unknown): boolean {
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw !== 0;
  }
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }
  return false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
