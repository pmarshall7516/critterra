import type { SkillEffectAttachment, SkillEffectType } from '@/game/skills/types';
import { sanitizeSkillEffectAttachments } from '@/game/skills/schema';
import type {
  AbilityDamagedBuffTemplateAttachment,
  AbilityDefinition,
  AbilityEffectTriggerFamily,
  AbilityGuardBuffTemplateAttachment,
  AbilityTemplateAttachment,
  AbilityTemplateType,
} from '@/game/abilities/types';
import {
  ABILITY_DAMAGED_BUFF_TRIGGER_TYPES,
  ABILITY_EFFECT_TRIGGER_FAMILIES,
  ABILITY_GUARD_BUFF_MODES,
  ABILITY_GUARD_RECOIL_MODES,
  ABILITY_PROC_TARGETS,
  ABILITY_TEMPLATE_TYPES,
} from '@/game/abilities/types';

const TEMPLATE_TYPE_SET = new Set<AbilityTemplateType>(ABILITY_TEMPLATE_TYPES);
const GUARD_MODE_SET = new Set(ABILITY_GUARD_BUFF_MODES);
const GUARD_RECOIL_MODE_SET = new Set(ABILITY_GUARD_RECOIL_MODES);
const PROC_TARGET_SET = new Set(ABILITY_PROC_TARGETS);
const DAMAGED_TRIGGER_TYPE_SET = new Set(ABILITY_DAMAGED_BUFF_TRIGGER_TYPES);
const EFFECT_TRIGGER_FAMILY_SET = new Set<AbilityEffectTriggerFamily>(ABILITY_EFFECT_TRIGGER_FAMILIES);

export function sanitizeAbilityLibrary(
  raw: unknown,
  knownEffectIds?: Set<string>,
  legacyEffectBuffPercentById?: ReadonlyMap<string, number>,
  effectTypeById?: ReadonlyMap<string, SkillEffectType>,
  allowedElementIds?: string[],
): AbilityDefinition[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed: AbilityDefinition[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < raw.length; index += 1) {
    const ability = sanitizeAbilityDefinition(
      raw[index],
      index,
      knownEffectIds,
      legacyEffectBuffPercentById,
      effectTypeById,
      allowedElementIds,
    );
    if (!ability || seen.has(ability.id)) {
      continue;
    }
    seen.add(ability.id);
    parsed.push(ability);
  }
  return parsed;
}

export function sanitizeAbilityDefinition(
  raw: unknown,
  fallbackIndex = 0,
  knownEffectIds?: Set<string>,
  legacyEffectBuffPercentById?: ReadonlyMap<string, number>,
  effectTypeById?: ReadonlyMap<string, SkillEffectType>,
  allowedElementIds?: string[],
): AbilityDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = sanitizeSlug(record.id ?? record.ability_id, `ability-${fallbackIndex + 1}`);
  const name = sanitizeText(record.name ?? record.ability_name, `Ability ${fallbackIndex + 1}`, 80);
  const element = sanitizeElement(record.element, allowedElementIds);
  const description = sanitizeText(record.description, '', 240);
  const templateAttachments = sanitizeTemplateAttachments(
    record.templateAttachments ?? record.template_attachments,
    knownEffectIds,
    legacyEffectBuffPercentById,
    effectTypeById,
  );
  return {
    id,
    name,
    element,
    description,
    templateAttachments,
  };
}

function sanitizeTemplateAttachments(
  raw: unknown,
  knownEffectIds?: Set<string>,
  legacyEffectBuffPercentById?: ReadonlyMap<string, number>,
  effectTypeById?: ReadonlyMap<string, SkillEffectType>,
): AbilityTemplateAttachment[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed: AbilityTemplateAttachment[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const attachment = sanitizeTemplateAttachment(
      raw[index],
      knownEffectIds,
      legacyEffectBuffPercentById,
      effectTypeById,
    );
    if (!attachment) {
      continue;
    }
    parsed.push(attachment);
  }
  return parsed;
}

function sanitizeTemplateAttachment(
  raw: unknown,
  knownEffectIds?: Set<string>,
  legacyEffectBuffPercentById?: ReadonlyMap<string, number>,
  effectTypeById?: ReadonlyMap<string, SkillEffectType>,
): AbilityTemplateAttachment | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const templateTypeRaw =
    typeof record.templateType === 'string'
      ? record.templateType.trim().toLowerCase()
      : typeof record.template_type === 'string'
        ? record.template_type.trim().toLowerCase()
        : '';
  if (!TEMPLATE_TYPE_SET.has(templateTypeRaw as AbilityTemplateType)) {
    return null;
  }
  if (templateTypeRaw === 'guard-buff') {
    return sanitizeGuardBuffTemplateAttachment(
      record,
      knownEffectIds,
      legacyEffectBuffPercentById,
      effectTypeById,
    );
  }
  return sanitizeDamagedBuffTemplateAttachment(
    record,
    knownEffectIds,
    legacyEffectBuffPercentById,
    effectTypeById,
  );
}

function sanitizeGuardBuffTemplateAttachment(
  record: Record<string, unknown>,
  knownEffectIds?: Set<string>,
  legacyEffectBuffPercentById?: ReadonlyMap<string, number>,
  effectTypeById?: ReadonlyMap<string, SkillEffectType>,
): AbilityGuardBuffTemplateAttachment {
  const modeRaw =
    typeof record.mode === 'string' ? record.mode.trim().toLowerCase() : 'recoil';
  const mode = GUARD_MODE_SET.has(modeRaw as AbilityGuardBuffTemplateAttachment['mode'])
    ? (modeRaw as AbilityGuardBuffTemplateAttachment['mode'])
    : 'recoil';
  const recoilModeRaw =
    typeof record.recoilMode === 'string'
      ? record.recoilMode.trim().toLowerCase()
      : typeof record.recoil_mode === 'string'
        ? record.recoil_mode.trim().toLowerCase()
        : 'flat';
  const recoilMode = GUARD_RECOIL_MODE_SET.has(recoilModeRaw as AbilityGuardBuffTemplateAttachment['recoilMode'])
    ? (recoilModeRaw as AbilityGuardBuffTemplateAttachment['recoilMode'])
    : 'flat';
  const recoilValue =
    recoilMode === 'flat'
      ? clampInt(record.recoilValue ?? record.recoil_value, 0, 9999, 0)
      : clampFloat(record.recoilValue ?? record.recoil_value, 0, 1, 0);
  const procTargetRaw =
    typeof record.procTarget === 'string'
      ? record.procTarget.trim().toLowerCase()
      : typeof record.proc_target === 'string'
        ? record.proc_target.trim().toLowerCase()
        : 'self';
  const procTarget = PROC_TARGET_SET.has(procTargetRaw as 'self' | 'attacker')
    ? (procTargetRaw as 'self' | 'attacker')
    : 'self';
  return {
    templateType: 'guard-buff',
    mode,
    recoilMode,
    recoilValue,
    ...(mode === 'proc' && { procTarget }),
    ...(mode === 'proc' && {
      procEffectAttachment: sanitizeSingleSkillEffectAttachment(
        record.procEffectAttachment ?? record.proc_effect_attachment,
        knownEffectIds,
        legacyEffectBuffPercentById,
        effectTypeById,
      ),
    }),
  };
}

function sanitizeDamagedBuffTemplateAttachment(
  record: Record<string, unknown>,
  knownEffectIds?: Set<string>,
  legacyEffectBuffPercentById?: ReadonlyMap<string, number>,
  effectTypeById?: ReadonlyMap<string, SkillEffectType>,
): AbilityDamagedBuffTemplateAttachment {
  const triggerTypeRaw =
    typeof record.triggerType === 'string'
      ? record.triggerType.trim().toLowerCase()
      : typeof record.trigger_type === 'string'
        ? record.trigger_type.trim().toLowerCase()
        : 'damage';
  const triggerType = DAMAGED_TRIGGER_TYPE_SET.has(triggerTypeRaw as AbilityDamagedBuffTemplateAttachment['triggerType'])
    ? (triggerTypeRaw as AbilityDamagedBuffTemplateAttachment['triggerType'])
    : 'damage';
  const belowPercent = clampFloat(record.belowPercent ?? record.below_percent, 0, 1, 0.5);
  const triggerFamilies = sanitizeTriggerFamilies(
    record.triggerFamilies ?? record.trigger_families,
  );
  return {
    templateType: 'damaged-buff',
    triggerType,
    ...(triggerType === 'damage' && { belowPercent }),
    ...(triggerType === 'effect' && { triggerFamilies }),
    rewardEffectAttachment: sanitizeSingleSkillEffectAttachment(
      record.rewardEffectAttachment ?? record.reward_effect_attachment,
      knownEffectIds,
      legacyEffectBuffPercentById,
      effectTypeById,
    ),
  };
}

function sanitizeTriggerFamilies(raw: unknown): AbilityEffectTriggerFamily[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed: AbilityEffectTriggerFamily[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const normalized = typeof entry === 'string' ? entry.trim().toLowerCase() : '';
    if (!normalized || seen.has(normalized) || !EFFECT_TRIGGER_FAMILY_SET.has(normalized as AbilityEffectTriggerFamily)) {
      continue;
    }
    seen.add(normalized);
    parsed.push(normalized as AbilityEffectTriggerFamily);
  }
  return parsed;
}

function sanitizeSingleSkillEffectAttachment(
  raw: unknown,
  knownEffectIds?: Set<string>,
  legacyEffectBuffPercentById?: ReadonlyMap<string, number>,
  effectTypeById?: ReadonlyMap<string, SkillEffectType>,
): SkillEffectAttachment | null {
  const parsed = sanitizeSkillEffectAttachments(
    raw == null ? [] : [raw],
    knownEffectIds,
    legacyEffectBuffPercentById,
    effectTypeById,
  );
  return parsed?.[0] ?? null;
}

function sanitizeElement(raw: unknown, allowedElementIds?: string[]): string {
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (allowedElementIds?.length) {
    const allowed = new Set(allowedElementIds.map((entry) => entry.trim().toLowerCase()).filter(Boolean));
    if (allowed.has(normalized)) {
      return normalized;
    }
    return allowedElementIds[0]?.trim().toLowerCase() || 'normal';
  }
  return normalized || 'normal';
}

function sanitizeText(raw: unknown, fallback: string, maxLength: number): string {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function sanitizeSlug(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
  return normalized || fallback;
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const parsed =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.floor(raw)
      : typeof raw === 'string' && raw.trim().length > 0
        ? Number.parseInt(raw, 10)
        : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function clampFloat(raw: unknown, min: number, max: number, fallback: number): number {
  const parsed =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : typeof raw === 'string' && raw.trim().length > 0
        ? Number.parseFloat(raw)
        : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}
