import {
  CRITTER_ELEMENTS,
  type CritterElement,
} from '@/game/critters/types';
import type {
  DamageSkillHealMode,
  ElementChart,
  ElementChartEntry,
  SkillDefinition,
  SkillEffectDefinition,
  SkillEffectType,
  SkillHealMode,
  SkillPersistentHealMode,
  SkillType,
  SupportSkillHealMode,
} from '@/game/skills/types';
import {
  DAMAGE_SKILL_HEAL_MODES,
  SKILL_EFFECT_TYPES,
  SKILL_HEAL_MODES,
  SKILL_PERSISTENT_HEAL_MODES,
  SKILL_TYPES,
  SUPPORT_SKILL_HEAL_MODES,
} from '@/game/skills/types';

const ELEMENT_SET = new Set<CritterElement>(CRITTER_ELEMENTS);
const EFFECT_TYPE_SET = new Set<SkillEffectType>(SKILL_EFFECT_TYPES);
const HEAL_MODE_SET = new Set<SkillHealMode>(SKILL_HEAL_MODES);
const PERSISTENT_HEAL_MODE_SET = new Set<SkillPersistentHealMode>(SKILL_PERSISTENT_HEAL_MODES);
const SKILL_TYPE_SET = new Set<SkillType>(SKILL_TYPES);
const DAMAGE_SKILL_HEAL_MODE_SET = new Set<DamageSkillHealMode>(DAMAGE_SKILL_HEAL_MODES);
const SUPPORT_SKILL_HEAL_MODE_SET = new Set<SupportSkillHealMode>(SUPPORT_SKILL_HEAL_MODES);

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

  if (type === 'support') {
    const healMode: SupportSkillHealMode = SUPPORT_SKILL_HEAL_MODE_SET.has(healModeRaw as SupportSkillHealMode)
      ? (healModeRaw as SupportSkillHealMode)
      : healModeRaw === 'percent_damage'
        ? 'percent_max_hp'
        : hasLegacyHealPercent
          ? 'percent_max_hp'
          : 'flat';
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
  const buffPercent = clampFloat(
    record.buffPercent ?? record.buff_percent,
    0,
    1,
    0.1,
  );
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
    buffPercent,
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
  const element = ELEMENT_SET.has(elementRaw as CritterElement)
    ? (elementRaw as CritterElement)
    : 'normal';
  const typeRaw = typeof record.type === 'string'
    ? (record.type as string).trim().toLowerCase()
    : 'damage';
  const type = SKILL_TYPE_SET.has(typeRaw as SkillType)
    ? (typeRaw as SkillType)
    : 'damage';

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

  let effectIds: string[] | undefined;
  if (Array.isArray(record.effectIds)) {
    effectIds = (record.effectIds as unknown[])
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .map((id) => id.trim());
    if (knownEffectIds && effectIds.length > 0) {
      effectIds = effectIds.filter((id) => knownEffectIds.has(id));
    }
  } else if (Array.isArray(record.effect_ids)) {
    effectIds = (record.effect_ids as unknown[])
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .map((id) => id.trim());
    if (knownEffectIds && effectIds.length > 0) {
      effectIds = effectIds.filter((id) => knownEffectIds.has(id));
    }
  }
  if (effectIds?.length === 0) {
    effectIds = undefined;
  }

  return {
    skill_id,
    skill_name,
    element,
    type,
    ...(type === 'damage' && { damage }),
    ...(healMode && { healMode }),
    ...(typeof healValue === 'number' && { healValue }),
    ...(persistentHealMode && { persistentHealMode }),
    ...(persistentHealValue != null && { persistentHealValue }),
    ...(persistentHealDurationTurns != null && { persistentHealDurationTurns }),
    ...(effectIds && effectIds.length > 0 && { effectIds }),
  };
}

export function sanitizeSkillLibrary(
  raw: unknown,
  knownEffectIds?: Set<string>,
): SkillDefinition[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const parsed: SkillDefinition[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const skill = sanitizeSkillDefinition(raw[i], i, knownEffectIds);
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
  attackerElement: CritterElement,
  defenderElement: CritterElement,
): number {
  const entry = chart.find(
    (e) => e.attacker === attackerElement && e.defender === defenderElement,
  );
  return entry?.multiplier ?? 1;
}
