import {
  CRITTER_ELEMENTS,
  type CritterElement,
} from '@/game/critters/types';
import type {
  ElementChart,
  ElementChartEntry,
  SkillDefinition,
  SkillEffectDefinition,
  SkillEffectType,
  SkillType,
} from '@/game/skills/types';
import { SKILL_EFFECT_TYPES, SKILL_TYPES } from '@/game/skills/types';

const ELEMENT_SET = new Set<CritterElement>(CRITTER_ELEMENTS);
const EFFECT_TYPE_SET = new Set<SkillEffectType>(SKILL_EFFECT_TYPES);
const SKILL_TYPE_SET = new Set<SkillType>(SKILL_TYPES);

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
  const healPercent =
    type === 'support'
      ? clampFloat(record.healPercent ?? record.heal_percent, 0, 1, 0)
      : undefined;

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
    ...(type === 'support' && { healPercent }),
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
