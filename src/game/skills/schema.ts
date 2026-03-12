import {
  CRITTER_ELEMENTS,
  type CritterElement,
} from '@/game/critters/types';
import type {
  DamageSkillHealMode,
  ElementChart,
  ElementChartEntry,
  SkillDefinition,
  SkillEffectAttachment,
  SkillEffectDefinition,
  SkillEffectType,
  SkillHealMode,
  SkillPersistentHealMode,
  SkillRecoilMode,
  SkillTargetKindDamage,
  SkillTargetKindSupport,
  SkillTargetTeamOption,
  SkillType,
  SupportSkillHealMode,
} from '@/game/skills/types';
import {
  DAMAGE_SKILL_HEAL_MODES,
  SKILL_EFFECT_TYPES,
  SKILL_PERSISTENT_HEAL_MODES,
  SKILL_RECOIL_MODES,
  SKILL_TARGET_KIND_DAMAGE,
  SKILL_TARGET_KIND_SUPPORT,
  SKILL_TARGET_TEAM_OPTIONS,
  SKILL_TYPES,
  SUPPORT_SKILL_HEAL_MODES,
} from '@/game/skills/types';

const ELEMENT_SET = new Set<CritterElement>(CRITTER_ELEMENTS);
const EFFECT_TYPE_SET = new Set<SkillEffectType>(SKILL_EFFECT_TYPES);
const PERSISTENT_HEAL_MODE_SET = new Set<SkillPersistentHealMode>(SKILL_PERSISTENT_HEAL_MODES);
const SKILL_TYPE_SET = new Set<SkillType>(SKILL_TYPES);
const DAMAGE_SKILL_HEAL_MODE_SET = new Set<DamageSkillHealMode>(DAMAGE_SKILL_HEAL_MODES);
const SUPPORT_SKILL_HEAL_MODE_SET = new Set<SupportSkillHealMode>(SUPPORT_SKILL_HEAL_MODES);
const SKILL_RECOIL_MODE_SET = new Set<SkillRecoilMode>(SKILL_RECOIL_MODES);
const SKILL_TARGET_KIND_DAMAGE_SET = new Set<SkillTargetKindDamage>(SKILL_TARGET_KIND_DAMAGE);
const SKILL_TARGET_KIND_SUPPORT_SET = new Set<SkillTargetKindSupport>(SKILL_TARGET_KIND_SUPPORT);
const SKILL_TARGET_TEAM_OPTIONS_SET = new Set<SkillTargetTeamOption>(SKILL_TARGET_TEAM_OPTIONS);
const STAT_OR_CRIT_EFFECT_TYPE_SET = new Set<SkillEffectType>([
  'atk_buff',
  'def_buff',
  'speed_buff',
  'self_atk_debuff',
  'self_def_debuff',
  'self_speed_debuff',
  'target_atk_debuff',
  'target_def_debuff',
  'target_speed_debuff',
  'crit_buff',
]);
const PERSISTENT_HEAL_EFFECT_ID_FALLBACK = 'persistent-heal';

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value)
    ? Math.floor(value)
    : typeof value === 'string'
      ? parseInt(value, 10)
      : NaN;
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string'
      ? parseFloat(value)
      : NaN;
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeSlug(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  return value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-') || fallback;
}

function hasProvidedNumberLikeValue(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  return typeof value === 'string' && value.trim().length > 0;
}

function parseBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0;
  }
  return false;
}

function sanitizeSkillHealValue(
  record: Record<string, unknown>,
  healMode: Exclude<SkillHealMode, 'none'>,
  fallbackValue: unknown,
): number {
  const rawValue =
    record.healValue ??
    record.heal_value ??
    record.healAmount ??
    record.heal_amount;
  if (healMode === 'flat') {
    return clampInt(
      hasProvidedNumberLikeValue(rawValue) ? rawValue : fallbackValue,
      0,
      9999,
      0,
    );
  }
  return clampFloat(
    hasProvidedNumberLikeValue(rawValue) ? rawValue : fallbackValue,
    0,
    1,
    0,
  );
}

function normalizePersistentHealMode(raw: unknown): SkillPersistentHealMode {
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return normalized === 'flat' ? 'flat' : 'percent_max_hp';
}

function sanitizePersistentHealAttachment(
  record: Record<string, unknown>,
): Pick<SkillEffectAttachment, 'persistentHealMode' | 'persistentHealValue' | 'persistentHealDurationTurns'> {
  const mode = normalizePersistentHealMode(record.persistentHealMode ?? record.persistent_heal_mode);
  const value =
    mode === 'flat'
      ? clampInt(record.persistentHealValue ?? record.persistent_heal_value, 1, 9999, 1)
      : clampFloat(record.persistentHealValue ?? record.persistent_heal_value, 0, 1, 0.05);
  const durationTurns = clampInt(
    record.persistentHealDurationTurns ?? record.persistent_heal_duration_turns,
    1,
    999,
    1,
  );
  return {
    persistentHealMode: mode,
    persistentHealValue: value,
    persistentHealDurationTurns: durationTurns,
  };
}

function sanitizeToxicAttachment(
  record: Record<string, unknown>,
): Pick<SkillEffectAttachment, 'toxicPotencyBase' | 'toxicPotencyPerTurn'> {
  return {
    toxicPotencyBase: clampFloat(record.toxicPotencyBase ?? record.toxic_potency_base, 0, 1, 0.05),
    toxicPotencyPerTurn: clampFloat(record.toxicPotencyPerTurn ?? record.toxic_potency_per_turn, 0, 1, 0.05),
  };
}

function sanitizeStunAttachment(
  record: Record<string, unknown>,
): Pick<SkillEffectAttachment, 'stunFailChance' | 'stunSlowdown'> {
  return {
    stunFailChance: clampFloat(record.stunFailChance ?? record.stun_fail_chance, 0, 1, 0.25),
    stunSlowdown: clampFloat(record.stunSlowdown ?? record.stun_slowdown, 0, 1, 0.5),
  };
}

function sanitizeFlinchAttachment(
  record: Record<string, unknown>,
): Pick<SkillEffectAttachment, 'flinchFirstUseOnly' | 'flinchFirstOverallOnly'> {
  const firstUse = parseBooleanFlag(record.flinchFirstUseOnly ?? record.flinch_first_use_only);
  const firstOverall = firstUse && parseBooleanFlag(record.flinchFirstOverallOnly ?? record.flinch_first_overall_only);
  return {
    flinchFirstUseOnly: firstUse,
    flinchFirstOverallOnly: firstOverall,
  };
}

function findPersistentHealEffectId(
  knownEffectIds?: Set<string>,
  effectTypeById?: ReadonlyMap<string, SkillEffectType>,
): string | null {
  if (effectTypeById) {
    for (const [effectId, effectType] of effectTypeById.entries()) {
      if (effectType !== 'persistent_heal') {
        continue;
      }
      if (!knownEffectIds || knownEffectIds.has(effectId)) {
        return effectId;
      }
    }
  }
  if (!knownEffectIds || knownEffectIds.has(PERSISTENT_HEAL_EFFECT_ID_FALLBACK)) {
    return PERSISTENT_HEAL_EFFECT_ID_FALLBACK;
  }
  return null;
}

function resolveSkillHealConfig(
  record: Record<string, unknown>,
  type: SkillType,
): { healMode?: SkillHealMode; healValue?: number } {
  const healModeRaw = typeof record.healMode === 'string'
    ? (record.healMode as string).trim().toLowerCase()
    : typeof record.heal_mode === 'string'
      ? (record.heal_mode as string).trim().toLowerCase()
      : '';
  const legacyHealPercentRaw = record.healPercent ?? record.heal_percent;
  const hasLegacyHealPercent = hasProvidedNumberLikeValue(legacyHealPercentRaw);
  const rawHealValue = record.healValue ?? record.heal_value ?? record.healAmount ?? record.heal_amount;
  const hasLegacyFlatHealValue = hasProvidedNumberLikeValue(rawHealValue);

  if (type === 'support') {
    const healMode: SupportSkillHealMode = SUPPORT_SKILL_HEAL_MODE_SET.has(healModeRaw as SupportSkillHealMode)
      ? (healModeRaw as SupportSkillHealMode)
      : healModeRaw === 'percent_damage'
        ? 'percent_max_hp'
        : hasLegacyHealPercent
          ? 'percent_max_hp'
          : hasLegacyFlatHealValue
            ? 'flat'
            : 'none';
    if (healMode === 'none') {
      return {};
    }
    const healValue = sanitizeSkillHealValue(record, healMode, legacyHealPercentRaw);
    return { healMode, healValue };
  }

  const healMode: DamageSkillHealMode = DAMAGE_SKILL_HEAL_MODE_SET.has(healModeRaw as DamageSkillHealMode)
    ? (healModeRaw as DamageSkillHealMode)
    : hasLegacyHealPercent
      ? 'percent_max_hp'
      : 'none';
  if (healMode === 'none') {
    return {};
  }
  const healValue = sanitizeSkillHealValue(record, healMode, legacyHealPercentRaw);
  return { healMode, healValue };
}

function sanitizeSkillEffectIdArray(
  raw: unknown,
  knownEffectIds?: Set<string>,
): string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const deduped = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      continue;
    }
    const id = entry.trim();
    if (!id) {
      continue;
    }
    if (knownEffectIds && !knownEffectIds.has(id)) {
      continue;
    }
    deduped.add(id);
  }
  return deduped.size > 0 ? Array.from(deduped) : undefined;
}

function sanitizeSkillEffectAttachments(
  raw: unknown,
  knownEffectIds?: Set<string>,
  legacyEffectBuffPercentById?: ReadonlyMap<string, number>,
  effectTypeById?: ReadonlyMap<string, SkillEffectType>,
): SkillEffectAttachment[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const parsed: SkillEffectAttachment[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
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
    if (knownEffectIds && !knownEffectIds.has(effectId)) {
      continue;
    }
    const effectType = effectTypeById?.get(effectId);
    const hasRecoilConfig =
      record.recoilMode !== undefined ||
      record.recoil_mode !== undefined ||
      record.recoilPercent !== undefined ||
      record.recoil_percent !== undefined;
    const hasPersistentHealConfig =
      record.persistentHealMode !== undefined ||
      record.persistent_heal_mode !== undefined ||
      record.persistentHealValue !== undefined ||
      record.persistent_heal_value !== undefined ||
      record.persistentHealDurationTurns !== undefined ||
      record.persistent_heal_duration_turns !== undefined;
    const hasToxicConfig =
      record.toxicPotencyBase !== undefined ||
      record.toxic_potency_base !== undefined ||
      record.toxicPotencyPerTurn !== undefined ||
      record.toxic_potency_per_turn !== undefined;
    const hasStunConfig =
      record.stunFailChance !== undefined ||
      record.stun_fail_chance !== undefined ||
      record.stunSlowdown !== undefined ||
      record.stun_slowdown !== undefined;
    const hasFlinchConfig =
      record.flinchFirstUseOnly !== undefined ||
      record.flinch_first_use_only !== undefined ||
      record.flinchFirstOverallOnly !== undefined ||
      record.flinch_first_overall_only !== undefined;
    const legacyBuffFallback = legacyEffectBuffPercentById?.get(effectId);
    const procChance = clampFloat(record.procChance ?? record.proc_chance, 0, 1, 1);
    const normalized: SkillEffectAttachment = {
      effectId,
      procChance,
    };
    if (effectType === 'recoil' || hasRecoilConfig) {
      const recoilModeRaw = typeof record.recoilMode === 'string'
        ? record.recoilMode
        : typeof record.recoil_mode === 'string'
          ? record.recoil_mode
          : '';
      const recoilMode = SKILL_RECOIL_MODE_SET.has(recoilModeRaw as SkillRecoilMode)
        ? (recoilModeRaw as SkillRecoilMode)
        : 'percent_max_hp';
      normalized.recoilMode = recoilMode;
      normalized.recoilPercent = clampFloat(
        record.recoilPercent ?? record.recoil_percent,
        0,
        1,
        0.1,
      );
    }
    if (effectType === 'persistent_heal' || hasPersistentHealConfig) {
      Object.assign(normalized, sanitizePersistentHealAttachment(record));
    }
    if (effectType === 'inflict_toxic' || hasToxicConfig) {
      Object.assign(normalized, sanitizeToxicAttachment(record));
    }
    if (effectType === 'inflict_stun' || hasStunConfig) {
      Object.assign(normalized, sanitizeStunAttachment(record));
    }
    if (effectType === 'flinch_chance' || hasFlinchConfig) {
      Object.assign(normalized, sanitizeFlinchAttachment(record));
    }
    if (
      (effectType == null || STAT_OR_CRIT_EFFECT_TYPE_SET.has(effectType)) &&
      effectType !== 'persistent_heal' &&
      effectType !== 'inflict_toxic' &&
      effectType !== 'inflict_stun' &&
      effectType !== 'flinch_chance' &&
      !hasPersistentHealConfig &&
      !hasToxicConfig &&
      !hasStunConfig
    ) {
      normalized.buffPercent = clampFloat(
        record.buffPercent ?? record.buff_percent,
        0,
        1,
        typeof legacyBuffFallback === 'number' ? legacyBuffFallback : 0.1,
      );
    }
    if (
      effectType === 'recoil' &&
      normalized.recoilMode == null &&
      normalized.recoilPercent == null
    ) {
      normalized.recoilMode = 'percent_max_hp';
      normalized.recoilPercent = 0.1;
    }
    parsed.push(normalized);
    seen.add(effectId);
  }
  return parsed.length > 0 ? parsed : undefined;
}

export function sanitizeSkillEffectDefinition(raw: unknown, fallbackIndex = 0): SkillEffectDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const effect_id = sanitizeSlug(
    record.effect_id ?? record.effectId,
    `effect-${fallbackIndex + 1}`,
  );
  const effect_name =
    typeof record.effect_name === 'string' && record.effect_name.trim()
      ? record.effect_name.trim()
      : typeof record.effectName === 'string' && record.effectName.trim()
        ? record.effectName.trim()
        : effect_id;
  const typeRaw = typeof record.effect_type === 'string'
    ? (record.effect_type as string).trim().toLowerCase()
    : typeof record.effectType === 'string'
      ? (record.effectType as string).trim().toLowerCase()
      : '';
  const effect_type = EFFECT_TYPE_SET.has(typeRaw as SkillEffectType)
    ? (typeRaw as SkillEffectType)
    : 'atk_buff';
  const rawBuffPercent = record.buffPercent ?? record.buff_percent;
  const buffPercent = hasProvidedNumberLikeValue(rawBuffPercent)
    ? clampFloat(rawBuffPercent, 0, 1, 0.1)
    : undefined;
  const description =
    typeof record.description === 'string' ? record.description.trim() : '';
  const iconUrl =
    typeof record.iconUrl === 'string' && record.iconUrl.trim()
      ? record.iconUrl.trim()
      : typeof record.icon_url === 'string' && record.icon_url.trim()
        ? record.icon_url.trim()
        : undefined;

  return {
    effect_id,
    effect_name,
    effect_type,
    ...(typeof buffPercent === 'number' && { buffPercent }),
    description,
    ...(iconUrl && { iconUrl }),
  };
}

export function sanitizeSkillEffectLibrary(raw: unknown): SkillEffectDefinition[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const parsed: SkillEffectDefinition[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const effect = sanitizeSkillEffectDefinition(raw[i], i);
    if (!effect || seen.has(effect.effect_id)) {
      continue;
    }
    seen.add(effect.effect_id);
    parsed.push(effect);
  }
  return parsed;
}

export function sanitizeSkillDefinition(
  raw: unknown,
  fallbackIndex = 0,
  knownEffectIds?: Set<string>,
  legacyEffectBuffPercentById?: ReadonlyMap<string, number>,
  effectTypeById?: ReadonlyMap<string, SkillEffectType>,
  allowedElementIds?: ReadonlySet<string> | string[],
): SkillDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const skill_id = sanitizeSlug(
    record.skill_id ?? record.skillId,
    `skill-${fallbackIndex + 1}`,
  );
  const skill_name =
    typeof record.skill_name === 'string' && record.skill_name.trim()
      ? record.skill_name.trim()
      : typeof record.skillName === 'string' && record.skillName.trim()
        ? record.skillName.trim()
        : skill_id;
  const elementRaw = typeof record.element === 'string'
    ? (record.element as string).trim().toLowerCase()
    : '';
  const allowedSet =
    allowedElementIds == null
      ? null
      : Array.isArray(allowedElementIds)
        ? new Set(allowedElementIds.map((id) => (typeof id === 'string' ? id.trim().toLowerCase() : '')).filter(Boolean))
        : new Set(Array.from(allowedElementIds).map((id) => (typeof id === 'string' ? id.trim().toLowerCase() : '')).filter(Boolean));
  const element = allowedSet
    ? (allowedSet.has(elementRaw)
        ? elementRaw
        : allowedSet.has('normal')
          ? 'normal'
          : Array.from(allowedSet)[0] ?? 'normal')
    : ELEMENT_SET.has(elementRaw as CritterElement)
      ? (elementRaw as CritterElement)
      : 'normal';
  const typeRaw = typeof record.type === 'string'
    ? (record.type as string).trim().toLowerCase()
    : 'damage';
  const type = SKILL_TYPE_SET.has(typeRaw as SkillType)
    ? (typeRaw as SkillType)
    : 'damage';
  const priority = clampInt(record.priority, 1, 999, 1);

  const damage =
    type === 'damage'
      ? clampInt(record.damage, 1, 9999, 10)
      : undefined;
  const { healMode, healValue } = resolveSkillHealConfig(record, type);

  const rawPersistentHealMode = typeof record.persistentHealMode === 'string'
    ? (record.persistentHealMode as string).trim().toLowerCase()
    : typeof record.persistent_heal_mode === 'string'
      ? (record.persistent_heal_mode as string).trim().toLowerCase()
      : '';
  const rawPersistentHealValue = record.persistentHealValue ?? record.persistent_heal_value;
  const rawPersistentHealDuration = record.persistentHealDurationTurns ?? record.persistent_heal_duration_turns;
  const persistentPercentFallbackCandidate =
    typeof rawPersistentHealValue === 'number' && Number.isFinite(rawPersistentHealValue)
      ? rawPersistentHealValue
      : typeof rawPersistentHealValue === 'string'
        ? parseFloat(rawPersistentHealValue)
        : NaN;
  let persistentHealMode: SkillPersistentHealMode | undefined;
  if (PERSISTENT_HEAL_MODE_SET.has(rawPersistentHealMode as SkillPersistentHealMode)) {
    persistentHealMode = rawPersistentHealMode as SkillPersistentHealMode;
  } else if (
    rawPersistentHealMode &&
    !Number.isNaN(persistentPercentFallbackCandidate) &&
    persistentPercentFallbackCandidate >= 0 &&
    persistentPercentFallbackCandidate <= 1
  ) {
    persistentHealMode = 'percent_max_hp';
  }
  let persistentHealValue: number | undefined;
  if (persistentHealMode === 'flat') {
    persistentHealValue = clampInt(rawPersistentHealValue, 1, 9999, 1);
  } else if (persistentHealMode === 'percent_max_hp') {
    persistentHealValue = clampFloat(rawPersistentHealValue, 0, 1, 0);
  }
  const persistentHealDurationTurns =
    persistentHealMode && rawPersistentHealDuration !== undefined
      ? clampInt(rawPersistentHealDuration, 1, 999, 1)
      : undefined;
  if (
    !persistentHealMode ||
    persistentHealValue == null ||
    persistentHealDurationTurns == null
  ) {
    persistentHealMode = undefined;
    persistentHealValue = undefined;
  }

  const effectIdsFromRecord =
    sanitizeSkillEffectIdArray(record.effectIds, knownEffectIds) ??
    sanitizeSkillEffectIdArray(record.effect_ids, knownEffectIds);
  let effectAttachments =
    sanitizeSkillEffectAttachments(
      record.effectAttachments,
      knownEffectIds,
      legacyEffectBuffPercentById,
      effectTypeById,
    ) ??
    sanitizeSkillEffectAttachments(
      record.effect_attachments,
      knownEffectIds,
      legacyEffectBuffPercentById,
      effectTypeById,
    );
  let effectIds = effectIdsFromRecord;

  if (!effectAttachments && effectIdsFromRecord && effectIdsFromRecord.length > 0) {
    effectAttachments = effectIdsFromRecord.map((effectId) => {
      const effectType = effectTypeById?.get(effectId);
      if (effectType === 'recoil') {
        return {
          effectId,
          procChance: 1,
          recoilMode: 'percent_max_hp',
          recoilPercent: 0.1,
        };
      }
      if (effectType === 'persistent_heal') {
        return {
          effectId,
          procChance: 1,
          persistentHealMode: 'percent_max_hp',
          persistentHealValue: 0.05,
          persistentHealDurationTurns: 1,
        };
      }
      if (effectType === 'inflict_toxic') {
        return {
          effectId,
          procChance: 1,
          toxicPotencyBase: 0.05,
          toxicPotencyPerTurn: 0.05,
        };
      }
      if (effectType === 'inflict_stun') {
        return {
          effectId,
          procChance: 1,
          stunFailChance: 0.25,
          stunSlowdown: 0.5,
        };
      }
      if (effectType === 'flinch_chance') {
        return {
          effectId,
          procChance: 1,
          flinchFirstUseOnly: false,
          flinchFirstOverallOnly: false,
        };
      }
      return {
        effectId,
        procChance: 1,
        buffPercent: clampFloat(legacyEffectBuffPercentById?.get(effectId), 0, 1, 0.1),
      };
    });
  }
  if (effectAttachments) {
    effectAttachments = effectAttachments.map((attachment) => {
      const effectType = effectTypeById?.get(attachment.effectId);
      if (effectType === 'recoil') {
        return {
          effectId: attachment.effectId,
          procChance: clampFloat(attachment.procChance, 0, 1, 1),
          recoilMode:
            attachment.recoilMode && SKILL_RECOIL_MODE_SET.has(attachment.recoilMode)
              ? attachment.recoilMode
              : 'percent_max_hp',
          recoilPercent: clampFloat(attachment.recoilPercent, 0, 1, 0.1),
        };
      }
      if (effectType === 'persistent_heal') {
        const persistent = sanitizePersistentHealAttachment({
          persistentHealMode: attachment.persistentHealMode,
          persistentHealValue: attachment.persistentHealValue,
          persistentHealDurationTurns: attachment.persistentHealDurationTurns,
        });
        return {
          effectId: attachment.effectId,
          procChance: clampFloat(attachment.procChance, 0, 1, 1),
          ...persistent,
        };
      }
      if (effectType === 'inflict_toxic') {
        const toxic = sanitizeToxicAttachment({
          toxicPotencyBase: attachment.toxicPotencyBase,
          toxicPotencyPerTurn: attachment.toxicPotencyPerTurn,
        });
        return {
          effectId: attachment.effectId,
          procChance: clampFloat(attachment.procChance, 0, 1, 1),
          ...toxic,
        };
      }
      if (effectType === 'inflict_stun') {
        const stun = sanitizeStunAttachment({
          stunFailChance: attachment.stunFailChance,
          stunSlowdown: attachment.stunSlowdown,
        });
        return {
          effectId: attachment.effectId,
          procChance: clampFloat(attachment.procChance, 0, 1, 1),
          ...stun,
        };
      }
      if (effectType === 'flinch_chance') {
        const flinch = sanitizeFlinchAttachment({
          flinchFirstUseOnly: attachment.flinchFirstUseOnly,
          flinchFirstOverallOnly: attachment.flinchFirstOverallOnly,
        });
        return {
          effectId: attachment.effectId,
          procChance: clampFloat(attachment.procChance, 0, 1, 1),
          ...flinch,
        };
      }
      const fallbackBuff = legacyEffectBuffPercentById?.get(attachment.effectId);
      const shouldDefaultBuff =
        effectType == null || STAT_OR_CRIT_EFFECT_TYPE_SET.has(effectType);
      return {
        effectId: attachment.effectId,
        procChance: clampFloat(attachment.procChance, 0, 1, 1),
        ...(shouldDefaultBuff && {
          buffPercent: clampFloat(
            attachment.buffPercent,
            0,
            1,
            typeof fallbackBuff === 'number' ? fallbackBuff : 0.1,
          ),
        }),
      };
    });
  }

  if (persistentHealMode && persistentHealValue != null && persistentHealDurationTurns != null) {
    const persistentHealEffectId = findPersistentHealEffectId(knownEffectIds, effectTypeById);
    if (persistentHealEffectId) {
      const nextAttachments = effectAttachments ? [...effectAttachments] : [];
      const existingIndex = nextAttachments.findIndex((entry) => {
        if (entry.effectId !== persistentHealEffectId) {
          return false;
        }
        const effectType = effectTypeById?.get(entry.effectId);
        return effectType === 'persistent_heal' || persistentHealEffectId === PERSISTENT_HEAL_EFFECT_ID_FALLBACK;
      });
      const persistentAttachment: SkillEffectAttachment = {
        effectId: persistentHealEffectId,
        procChance: 1,
        persistentHealMode,
        persistentHealValue,
        persistentHealDurationTurns,
      };
      if (existingIndex >= 0) {
        nextAttachments[existingIndex] = {
          ...nextAttachments[existingIndex],
          ...persistentAttachment,
        };
      } else {
        nextAttachments.push(persistentAttachment);
      }
      effectAttachments = nextAttachments;
    }
  }
  if (!effectIds && effectAttachments && effectAttachments.length > 0) {
    effectIds = effectAttachments.map((entry) => entry.effectId);
  }

  const rawTargetKind = typeof record.targetKind === 'string'
    ? (record.targetKind as string).trim().toLowerCase()
    : typeof record.target_kind === 'string'
      ? (record.target_kind as string).trim().toLowerCase()
      : '';
  const rawTargetTeamOption = typeof record.targetTeamOption === 'string'
    ? (record.targetTeamOption as string).trim().toLowerCase()
    : typeof record.target_team_option === 'string'
      ? (record.target_team_option as string).trim().toLowerCase()
      : '';
  const rawTargetSelectCount = record.targetSelectCount ?? record.target_select_count;

  let targetKind: SkillTargetKindDamage | SkillTargetKindSupport | undefined;
  let targetTeamOption: SkillTargetTeamOption | undefined;
  let targetSelectCount: number | undefined;

  if (type === 'damage') {
    targetKind = SKILL_TARGET_KIND_DAMAGE_SET.has(rawTargetKind as SkillTargetKindDamage)
      ? (rawTargetKind as SkillTargetKindDamage)
      : 'select_enemies';
    targetSelectCount = clampInt(rawTargetSelectCount, 1, 3, targetKind === 'select_enemies' ? 1 : 1);
    if (targetKind !== 'select_enemies') {
      targetSelectCount = undefined;
    }
  } else {
    targetKind = SKILL_TARGET_KIND_SUPPORT_SET.has(rawTargetKind as SkillTargetKindSupport)
      ? (rawTargetKind as SkillTargetKindSupport)
      : 'select_allies';
    if (targetKind === 'target_team') {
      targetTeamOption = SKILL_TARGET_TEAM_OPTIONS_SET.has(rawTargetTeamOption as SkillTargetTeamOption)
        ? (rawTargetTeamOption as SkillTargetTeamOption)
        : 'user_only';
    }
    targetSelectCount = clampInt(rawTargetSelectCount, 1, 3, targetKind === 'select_allies' ? 1 : 1);
    if (targetKind !== 'select_allies') {
      targetSelectCount = undefined;
    }
  }

  return {
    skill_id,
    skill_name,
    element,
    type,
    priority,
    ...(type === 'damage' && { damage }),
    ...(healMode && { healMode }),
    ...(typeof healValue === 'number' && { healValue }),
    ...(effectAttachments && effectAttachments.length > 0 && { effectAttachments }),
    ...(effectIds && effectIds.length > 0 && { effectIds }),
    ...(targetKind && { targetKind }),
    ...(targetTeamOption && { targetTeamOption }),
    ...(targetSelectCount != null && { targetSelectCount }),
  };
}

export function sanitizeSkillLibrary(
  raw: unknown,
  knownEffectIds?: Set<string>,
  legacyEffectBuffPercentById?: ReadonlyMap<string, number>,
  effectTypeById?: ReadonlyMap<string, SkillEffectType>,
  allowedElementIds?: ReadonlySet<string> | string[],
): SkillDefinition[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const parsed: SkillDefinition[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const skill = sanitizeSkillDefinition(
      raw[i],
      i,
      knownEffectIds,
      legacyEffectBuffPercentById,
      effectTypeById,
      allowedElementIds,
    );
    if (!skill || seen.has(skill.skill_id)) {
      continue;
    }
    seen.add(skill.skill_id);
    parsed.push(skill);
  }
  return parsed;
}

function sanitizeElementChartEntry(raw: unknown): ElementChartEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const attackerRaw = typeof record.attacker === 'string' ? (record.attacker as string).trim().toLowerCase() : '';
  const defenderRaw = typeof record.defender === 'string' ? (record.defender as string).trim().toLowerCase() : '';
  const attacker = ELEMENT_SET.has(attackerRaw as CritterElement) ? (attackerRaw as CritterElement) : null;
  const defender = ELEMENT_SET.has(defenderRaw as CritterElement) ? (defenderRaw as CritterElement) : null;
  if (!attacker || !defender) {
    return null;
  }
  const multiplier = clampFloat(record.multiplier, 0, 4, 1);
  return { attacker, defender, multiplier };
}

export function sanitizeElementChart(raw: unknown): ElementChart {
  if (!Array.isArray(raw)) {
    return buildDefaultElementChart();
  }
  const byKey = new Map<string, ElementChartEntry>();
  for (const entry of raw) {
    const parsed = sanitizeElementChartEntry(entry);
    if (!parsed) {
      continue;
    }
    byKey.set(`${parsed.attacker}:${parsed.defender}`, parsed);
  }
  const result: ElementChartEntry[] = [];
  for (const attacker of CRITTER_ELEMENTS) {
    for (const defender of CRITTER_ELEMENTS) {
      const key = `${attacker}:${defender}`;
      const existing = byKey.get(key);
      result.push(existing ?? { attacker, defender, multiplier: 1 });
    }
  }
  return result;
}

export function sanitizeElementChartWithElements(raw: unknown, elements: string[]): ElementChart {
  const normalizedElements = elements
    .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
    .map((e) => e.trim().toLowerCase());
  const unique = Array.from(new Set(normalizedElements));
  if (unique.length === 0) {
    return sanitizeElementChart(raw);
  }
  const set = new Set<string>(unique);
  const byKey = new Map<string, ElementChartEntry>();
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const record = entry as Record<string, unknown>;
      const attacker = typeof record.attacker === 'string' ? record.attacker.trim().toLowerCase() : '';
      const defender = typeof record.defender === 'string' ? record.defender.trim().toLowerCase() : '';
      if (!set.has(attacker) || !set.has(defender)) continue;
      const multiplier = clampFloat(record.multiplier, 0, 4, 1);
      byKey.set(`${attacker}:${defender}`, { attacker, defender, multiplier });
    }
  }
  const result: ElementChartEntry[] = [];
  for (const attacker of unique) {
    for (const defender of unique) {
      const key = `${attacker}:${defender}`;
      const existing = byKey.get(key);
      result.push(existing ?? { attacker, defender, multiplier: 1 });
    }
  }
  return result;
}

export function buildDefaultElementChart(): ElementChart {
  const result: ElementChartEntry[] = [];
  for (const attacker of CRITTER_ELEMENTS) {
    for (const defender of CRITTER_ELEMENTS) {
      result.push({ attacker, defender, multiplier: 1 });
    }
  }
  return result;
}

export function getElementChartMultiplier(
  chart: ElementChart,
  attackerElement: string,
  defenderElement: string,
): number {
  const entry = chart.find(
    (e) => e.attacker === attackerElement && e.defender === defenderElement,
  );
  return entry?.multiplier ?? 1;
}
