import type { EquipmentEffectDefinition, EquipmentEffectModifier, EquipmentEffectMode, EquipmentEffectStat } from '@/game/equipmentEffects/types';
import { EQUIPMENT_EFFECT_MODES, EQUIPMENT_EFFECT_STATS } from '@/game/equipmentEffects/types';

const EFFECT_MODE_SET = new Set<EquipmentEffectMode>(EQUIPMENT_EFFECT_MODES);
const EFFECT_STAT_SET = new Set<EquipmentEffectStat>(EQUIPMENT_EFFECT_STATS);

export function sanitizeEquipmentEffectDefinition(raw: unknown, fallbackIndex = 0): EquipmentEffectDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const effect_id = sanitizeSlug(record.effect_id ?? record.effectId, `equipment-effect-${fallbackIndex + 1}`);
  const effect_name =
    typeof record.effect_name === 'string' && record.effect_name.trim()
      ? record.effect_name.trim().slice(0, 80)
      : typeof record.effectName === 'string' && record.effectName.trim()
        ? record.effectName.trim().slice(0, 80)
        : effect_id;
  const description = typeof record.description === 'string' ? record.description.trim().slice(0, 240) : '';
  const iconUrl =
    typeof record.iconUrl === 'string' && record.iconUrl.trim()
      ? record.iconUrl.trim()
      : typeof record.icon_url === 'string' && record.icon_url.trim()
        ? record.icon_url.trim()
        : undefined;
  const modifiers = sanitizeEquipmentEffectModifiers(record.modifiers);

  return {
    effect_id,
    effect_name,
    description,
    ...(iconUrl && { iconUrl }),
    modifiers,
  };
}

export function sanitizeEquipmentEffectLibrary(raw: unknown): EquipmentEffectDefinition[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed: EquipmentEffectDefinition[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i += 1) {
    const effect = sanitizeEquipmentEffectDefinition(raw[i], i);
    if (!effect || seen.has(effect.effect_id)) {
      continue;
    }
    seen.add(effect.effect_id);
    parsed.push(effect);
  }
  return parsed;
}

function sanitizeEquipmentEffectModifiers(raw: unknown): EquipmentEffectModifier[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed: EquipmentEffectModifier[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const statRaw = typeof record.stat === 'string' ? record.stat.trim().toLowerCase() : '';
    const modeRaw = typeof record.mode === 'string' ? record.mode.trim().toLowerCase() : '';
    if (!EFFECT_STAT_SET.has(statRaw as EquipmentEffectStat) || !EFFECT_MODE_SET.has(modeRaw as EquipmentEffectMode)) {
      continue;
    }
    const value = sanitizeModifierValue(modeRaw as EquipmentEffectMode, record.value);
    parsed.push({
      stat: statRaw as EquipmentEffectStat,
      mode: modeRaw as EquipmentEffectMode,
      value,
    });
    if (parsed.length >= 24) {
      break;
    }
  }
  return parsed;
}

function sanitizeModifierValue(mode: EquipmentEffectMode, raw: unknown): number {
  const parsed = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
  if (mode === 'percent') {
    return clamp(parsed, -5, 5);
  }
  return Math.floor(clamp(parsed, -999, 999));
}

function sanitizeSlug(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/g, '')
      .replace(/-+$/g, '') || fallback
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
