import { useEffect, useMemo, useRef, useState } from 'react';
import { CRITTER_ELEMENTS } from '@/game/critters/types';
import type {
  SkillDefinition,
  SkillEffectAttachment,
  SkillEffectType,
  SkillHealMode,
  SkillRecoilMode,
  SkillTargetKindDamage,
  SkillTargetKindSupport,
  SkillTargetTeamOption,
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
  getSkillElementColor,
} from '@/game/skills/types';
import { sanitizeSkillLibrary } from '@/game/skills/schema';
import { apiFetchJson } from '@/shared/apiClient';
import { loadAdminGameElements } from '@/admin/elementsApi';
import { AdminSkillCellContent, buildAdminSkillTooltip, type AdminSkillEffectOption } from '@/admin/adminSkillPresentation';

type SkillDraftType = SkillDefinition['type'];
type EffectOption = AdminSkillEffectOption;

function extractSupabasePublicBucketRoot(assetUrl: string): string | null {
  try {
    const url = new URL(assetUrl);
    const marker = '/storage/v1/object/public/';
    const suffix = url.pathname.split(marker)[1];
    if (!suffix) {
      return null;
    }
    const bucket = suffix.split('/')[0];
    if (!bucket) {
      return null;
    }
    const parsed = new URL(url);
    parsed.pathname = `${marker}${bucket}`;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

type SkillDraftHealMode = SkillHealMode | 'none';
const STAT_OR_CRIT_EFFECT_TYPES = new Set<SkillEffectType>([
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

const DAMAGE_HEAL_MODE_OPTIONS: Array<{ value: SkillDraftHealMode; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'flat', label: 'Flat HP' },
  { value: 'percent_max_hp', label: '% Max HP' },
  { value: 'percent_damage', label: '% Damage Dealt' },
];

const SUPPORT_HEAL_MODE_OPTIONS: Array<{ value: SkillDraftHealMode; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'flat', label: 'Flat HP' },
  { value: 'percent_max_hp', label: '% Max HP' },
];

const PERSISTENT_HEAL_MODE_OPTIONS = SKILL_PERSISTENT_HEAL_MODES.map((mode) => ({
  value: mode,
  label: mode === 'flat' ? 'Flat HP' : '% Max HP',
}));

function effectUsesBuffPercent(effectType: SkillEffectType | undefined): boolean {
  return effectType == null || STAT_OR_CRIT_EFFECT_TYPES.has(effectType);
}

function effectUsesRecoilConfig(effectType: SkillEffectType | undefined): boolean {
  return effectType === 'recoil';
}

function effectUsesPersistentHealConfig(effectType: SkillEffectType | undefined): boolean {
  return effectType === 'persistent_heal';
}

function effectUsesToxicConfig(effectType: SkillEffectType | undefined): boolean {
  return effectType === 'inflict_toxic';
}

function effectUsesStunConfig(effectType: SkillEffectType | undefined): boolean {
  return effectType === 'inflict_stun';
}

function effectUsesFlinchConfig(effectType: SkillEffectType | undefined): boolean {
  return effectType === 'flinch_chance';
}

function formatImmediateHealTooltip(skill: Pick<SkillDefinition, 'healMode' | 'healValue'>): string | null {
  if (!skill.healMode || skill.healValue == null) {
    return null;
  }
  if (skill.healMode === 'flat') {
    return `Heals: ${Math.max(1, Math.floor(skill.healValue))} HP after use`;
  }
  if (skill.healMode === 'percent_damage') {
    return `Heals: ${Math.round(skill.healValue * 100)}% of damage dealt`;
  }
  return `Heals: ${Math.round(skill.healValue * 100)}% HP after use`;
}

function formatPersistentHealAttachmentTooltip(
  attachment: Pick<SkillEffectAttachment, 'persistentHealMode' | 'persistentHealValue' | 'persistentHealDurationTurns'>,
): string {
  const mode = attachment.persistentHealMode === 'flat' ? 'flat' : 'percent_max_hp';
  const value = mode === 'flat'
    ? Math.max(1, Math.floor(attachment.persistentHealValue ?? 1))
    : Math.max(0, Math.round((attachment.persistentHealValue ?? 0.05) * 100));
  const turns = Math.max(1, Math.floor(attachment.persistentHealDurationTurns ?? 1));
  if (mode === 'flat') {
    return `End of turn: ${value} HP for ${turns} turns`;
  }
  return `End of turn: ${value}% max HP for ${turns} turns`;
}

function formatAttachmentDescription(
  effect: EffectOption,
  attachment: SkillEffectAttachment,
): string {
  const effectDescription = typeof effect.description === 'string' ? effect.description.trim() : '';
  if (!effectDescription) {
    return effect.name;
  }
  const buffLabel = Math.round(((attachment.buffPercent ?? effect.buffPercent ?? 0.1) ?? 0) * 100);
  const recoilLabel = Math.round(((attachment.recoilPercent ?? 0.1) ?? 0) * 100);
  const recoilModeLabel = attachment.recoilMode === 'percent_damage_dealt' ? 'damage dealt' : 'max HP';
  const persistentMode = attachment.persistentHealMode === 'flat' ? 'HP' : 'max HP';
  const persistentValue = attachment.persistentHealMode === 'flat'
    ? Math.max(1, Math.floor(attachment.persistentHealValue ?? 1))
    : Math.round((attachment.persistentHealValue ?? 0.05) * 100);
  const persistentTurns = Math.max(1, Math.floor(attachment.persistentHealDurationTurns ?? 1));
  const toxicBase = Math.round((attachment.toxicPotencyBase ?? 0.05) * 100);
  const toxicRamp = Math.round((attachment.toxicPotencyPerTurn ?? 0.05) * 100);
  const stunFail = Math.round((attachment.stunFailChance ?? 0.25) * 100);
  const stunSlow = Math.round((attachment.stunSlowdown ?? 0.5) * 100);
  return effectDescription
    .replace(/<buff>/g, String(buffLabel))
    .replace(/<recoil>/g, String(recoilLabel))
    .replace(/<mode>/g, recoilModeLabel)
    .replace(/<heal>/g, String(persistentValue))
    .replace(/<heal_value>/g, String(persistentValue))
    .replace(/<heal_mode>/g, persistentMode)
    .replace(/<turns>/g, String(persistentTurns))
    .replace(/<duration>/g, String(persistentTurns))
    .replace(/<toxic_base>/g, String(toxicBase))
    .replace(/<toxic_ramp>/g, String(toxicRamp))
    .replace(/<stun>/g, String(stunFail))
    .replace(/<stun_fail>/g, String(stunFail))
    .replace(/<stun_slow>/g, String(stunSlow))
    .replace(/<stun_slowdown>/g, String(stunSlow));
}

interface SkillsListResponse {
  ok: boolean;
  critterSkills?: unknown;
  skillEffects?: unknown;
  error?: string;
}

interface SkillsSaveResponse {
  ok: boolean;
  error?: string;
}

interface SkillDraft {
  skill_id: string;
  skill_name: string;
  element: string;
  type: SkillDraftType;
  priority: string;
  damage: string;
  healMode: SkillHealMode;
  healValue: string;
  effectAttachments: SkillEffectAttachmentDraft[];
  targetKind: string;
  targetTeamOption: string;
  targetSelectCount: string;
}

interface SkillEffectAttachmentDraft {
  effectId: string;
  buffPercent: string;
  procChance: string;
  recoilMode: SkillRecoilMode;
  recoilPercent: string;
  persistentHealMode: 'flat' | 'percent_max_hp';
  persistentHealValue: string;
  persistentHealDurationTurns: string;
  toxicPotencyBase: string;
  toxicPotencyPerTurn: string;
  stunFailChance: string;
  stunSlowdown: string;
  flinchFirstUseOnly: boolean;
  flinchFirstOverallOnly: boolean;
}

const emptyDraft: SkillDraft = {
  skill_id: '',
  skill_name: '',
  element: 'normal',
  type: 'damage',
  priority: '1',
  damage: '20',
  healMode: 'none',
  healValue: '0',
  effectAttachments: [],
  targetKind: 'select_enemies',
  targetTeamOption: 'user_only',
  targetSelectCount: '1',
};

function normalizeDraftHealMode(type: SkillDraftType, healMode: string): SkillHealMode {
  if (type === 'support') {
    return SUPPORT_SKILL_HEAL_MODES.includes(healMode as (typeof SUPPORT_SKILL_HEAL_MODES)[number])
      ? (healMode as SkillHealMode)
      : 'none';
  }
  return DAMAGE_SKILL_HEAL_MODES.includes(healMode as (typeof DAMAGE_SKILL_HEAL_MODES)[number])
    ? (healMode as SkillHealMode)
    : 'none';
}

function parseDraftHealValue(healMode: SkillHealMode, rawValue: string): number {
  if (healMode === 'flat') {
    return Math.max(0, parseInt(rawValue, 10) || 0);
  }
  return Math.max(0, Math.min(1, parseFloat(rawValue) || 0));
}

function getHealValueLabel(type: SkillDraftType, healMode: SkillHealMode): string {
  if (healMode === 'flat') {
    return type === 'damage' ? 'Heal amount (HP)' : 'Support heal amount (HP)';
  }
  if (healMode === 'percent_damage') {
    return 'Heal % of damage (0-1)';
  }
  return 'Heal % of max HP (0-1)';
}

function sanitizeAttachmentNumber(rawValue: string, fallback: number): number {
  const parsed = parseFloat(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function sanitizePersistentHealValue(
  mode: SkillEffectAttachmentDraft['persistentHealMode'],
  rawValue: string,
): number {
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) {
    return mode === 'flat' ? 1 : 0.05;
  }
  if (mode === 'flat') {
    return Math.max(1, Math.floor(parsed));
  }
  return Math.max(0, Math.min(1, parsed));
}

function sanitizePersistentHealDuration(rawValue: string): number {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(1, Math.min(999, Math.floor(parsed)));
}

function sanitizeToxicValue(rawValue: string, fallback: number): number {
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function normalizeSkillAttachmentDrafts(
  skill: SkillDefinition,
  effectList: EffectOption[],
): SkillEffectAttachmentDraft[] {
  const effectById = new Map(effectList.map((effect) => [effect.id, effect]));
  const normalized = new Map<string, SkillEffectAttachmentDraft>();
  const skillAttachments = Array.isArray(skill.effectAttachments) ? skill.effectAttachments : [];
  if (skillAttachments.length > 0) {
    for (const attachment of skillAttachments) {
      const id = typeof attachment.effectId === 'string' ? attachment.effectId.trim() : '';
      if (!id || normalized.has(id)) {
        continue;
      }
      const fallbackBuff = typeof effectById.get(id)?.buffPercent === 'number' ? effectById.get(id)!.buffPercent! : 0.1;
      const effectType = effectById.get(id)?.effectType;
      const persistentHealMode =
        attachment.persistentHealMode === 'flat' ? 'flat' : 'percent_max_hp';
      normalized.set(id, {
        effectId: id,
        buffPercent: String(Math.max(0, Math.min(1, attachment.buffPercent ?? fallbackBuff))),
        procChance: String(Math.max(0, Math.min(1, attachment.procChance ?? 1))),
        recoilMode:
          attachment.recoilMode && SKILL_RECOIL_MODES.includes(attachment.recoilMode)
            ? attachment.recoilMode
            : 'percent_max_hp',
        recoilPercent: String(Math.max(0, Math.min(1, attachment.recoilPercent ?? 0.1))),
        persistentHealMode,
        persistentHealValue: String(
          attachment.persistentHealValue ?? (persistentHealMode === 'flat' ? 1 : 0.05),
        ),
        persistentHealDurationTurns: String(Math.max(1, Math.floor(attachment.persistentHealDurationTurns ?? 1))),
        toxicPotencyBase: String(Math.max(0, Math.min(1, attachment.toxicPotencyBase ?? 0.05))),
        toxicPotencyPerTurn: String(Math.max(0, Math.min(1, attachment.toxicPotencyPerTurn ?? 0.05))),
        stunFailChance: String(Math.max(0, Math.min(1, attachment.stunFailChance ?? 0.25))),
        stunSlowdown: String(Math.max(0, Math.min(1, attachment.stunSlowdown ?? 0.5))),
        flinchFirstUseOnly: attachment.flinchFirstUseOnly === true,
        flinchFirstOverallOnly: attachment.flinchFirstUseOnly === true && attachment.flinchFirstOverallOnly === true,
      });
      if (effectType === 'recoil') {
        const existing = normalized.get(id);
        if (existing) {
          existing.buffPercent = String(fallbackBuff);
        }
      } else if (effectType === 'persistent_heal') {
        const existing = normalized.get(id);
        if (existing) {
          existing.buffPercent = String(fallbackBuff);
          existing.recoilPercent = '0.1';
          existing.recoilMode = 'percent_max_hp';
        }
      } else if (effectType === 'inflict_toxic') {
        const existing = normalized.get(id);
        if (existing) {
          existing.buffPercent = String(fallbackBuff);
          existing.recoilPercent = '0.1';
          existing.recoilMode = 'percent_max_hp';
          existing.persistentHealMode = 'percent_max_hp';
          existing.persistentHealValue = '0.05';
          existing.persistentHealDurationTurns = '1';
          existing.stunFailChance = '0.25';
          existing.stunSlowdown = '0.5';
        }
      } else if (effectType === 'inflict_stun') {
        const existing = normalized.get(id);
        if (existing) {
          existing.buffPercent = String(fallbackBuff);
          existing.recoilPercent = '0.1';
          existing.recoilMode = 'percent_max_hp';
          existing.persistentHealMode = 'percent_max_hp';
          existing.persistentHealValue = '0.05';
          existing.persistentHealDurationTurns = '1';
          existing.toxicPotencyBase = '0.05';
          existing.toxicPotencyPerTurn = '0.05';
          existing.flinchFirstUseOnly = false;
          existing.flinchFirstOverallOnly = false;
        }
      } else if (effectType === 'flinch_chance') {
        const existing = normalized.get(id);
        if (existing) {
          existing.buffPercent = String(fallbackBuff);
          existing.recoilPercent = '0.1';
          existing.recoilMode = 'percent_max_hp';
          existing.persistentHealMode = 'percent_max_hp';
          existing.persistentHealValue = '0.05';
          existing.persistentHealDurationTurns = '1';
          existing.toxicPotencyBase = '0.05';
          existing.toxicPotencyPerTurn = '0.05';
          existing.stunFailChance = '0.25';
          existing.stunSlowdown = '0.5';
        }
      }
    }
  }
  if (normalized.size === 0) {
    for (const effectId of skill.effectIds ?? []) {
      const id = effectId.trim();
      if (!id || normalized.has(id)) {
        continue;
      }
      const fallbackBuff = typeof effectById.get(id)?.buffPercent === 'number' ? effectById.get(id)!.buffPercent! : 0.1;
      const effectType = effectById.get(id)?.effectType;
      normalized.set(id, {
        effectId: id,
        buffPercent: String(Math.max(0, Math.min(1, fallbackBuff))),
        procChance: '1',
        recoilMode: 'percent_max_hp',
        recoilPercent: effectType === 'recoil' ? '0.1' : '0',
        persistentHealMode: 'percent_max_hp',
        persistentHealValue: '0.05',
        persistentHealDurationTurns: '1',
        toxicPotencyBase: effectType === 'inflict_toxic' ? '0.05' : '0',
        toxicPotencyPerTurn: effectType === 'inflict_toxic' ? '0.05' : '0',
        stunFailChance: effectType === 'inflict_stun' ? '0.25' : '0',
        stunSlowdown: effectType === 'inflict_stun' ? '0.5' : '0',
        flinchFirstUseOnly: false,
        flinchFirstOverallOnly: false,
      });
    }
  }
  return Array.from(normalized.values());
}

function skillToDraft(skill: SkillDefinition, effectList: EffectOption[]): SkillDraft {
  const healMode = normalizeDraftHealMode(skill.type, skill.healMode ?? 'none');
  const targetKind =
    skill.type === 'damage'
      ? (SKILL_TARGET_KIND_DAMAGE.includes((skill.targetKind ?? 'select_enemies') as SkillTargetKindDamage)
          ? skill.targetKind
          : 'select_enemies')
      : (SKILL_TARGET_KIND_SUPPORT.includes((skill.targetKind ?? 'select_allies') as SkillTargetKindSupport)
          ? skill.targetKind
          : 'select_allies');
  const targetTeamOption = SKILL_TARGET_TEAM_OPTIONS.includes((skill.targetTeamOption ?? 'user_only') as SkillTargetTeamOption)
    ? skill.targetTeamOption
    : 'user_only';
  return {
    skill_id: skill.skill_id,
    skill_name: skill.skill_name,
    element: skill.element,
    type: skill.type,
    priority: String(Math.max(1, Math.floor(skill.priority ?? 1))),
    damage: skill.type === 'damage' && skill.damage != null ? String(skill.damage) : '20',
    healMode,
    healValue: typeof skill.healValue === 'number' ? String(skill.healValue) : '0',
    effectAttachments: normalizeSkillAttachmentDrafts(skill, effectList),
    targetKind: targetKind ?? (skill.type === 'damage' ? 'select_enemies' : 'select_allies'),
    targetTeamOption: targetTeamOption ?? 'user_only',
    targetSelectCount: skill.targetSelectCount != null ? String(skill.targetSelectCount) : '1',
  };
}

function buildSkillEffectAttachmentsFromDraft(
  draftAttachments: SkillEffectAttachmentDraft[],
  effectById: Map<string, EffectOption>,
): SkillEffectAttachment[] {
  const deduped = new Map<string, SkillEffectAttachment>();
  for (const entry of draftAttachments) {
    const effectId = entry.effectId.trim();
    if (!effectId) {
      continue;
    }
    const effectType = effectById.get(effectId)?.effectType;
    const normalized: SkillEffectAttachment = {
      effectId,
      procChance: sanitizeAttachmentNumber(entry.procChance, 1),
    };
    if (effectType === 'recoil') {
      normalized.recoilMode = SKILL_RECOIL_MODES.includes(entry.recoilMode)
        ? entry.recoilMode
        : 'percent_max_hp';
      normalized.recoilPercent = sanitizeAttachmentNumber(entry.recoilPercent, 0.1);
    } else if (effectType === 'persistent_heal') {
      normalized.persistentHealMode = entry.persistentHealMode === 'flat' ? 'flat' : 'percent_max_hp';
      normalized.persistentHealValue = sanitizePersistentHealValue(
        normalized.persistentHealMode,
        entry.persistentHealValue,
      );
      normalized.persistentHealDurationTurns = sanitizePersistentHealDuration(entry.persistentHealDurationTurns);
    } else if (effectType === 'inflict_toxic') {
      normalized.toxicPotencyBase = sanitizeToxicValue(entry.toxicPotencyBase, 0.05);
      normalized.toxicPotencyPerTurn = sanitizeToxicValue(entry.toxicPotencyPerTurn, 0.05);
    } else if (effectType === 'inflict_stun') {
      normalized.stunFailChance = sanitizeToxicValue(entry.stunFailChance, 0.25);
      normalized.stunSlowdown = sanitizeToxicValue(entry.stunSlowdown, 0.5);
    } else if (effectType === 'flinch_chance') {
      const firstUse = entry.flinchFirstUseOnly === true;
      normalized.flinchFirstUseOnly = firstUse;
      normalized.flinchFirstOverallOnly = firstUse && entry.flinchFirstOverallOnly === true;
    } else {
      normalized.buffPercent = sanitizeAttachmentNumber(entry.buffPercent, 0.1);
    }
    deduped.set(effectId, normalized);
  }
  return Array.from(deduped.values());
}

function buildAttachmentDraftFromEffectOption(effect: EffectOption): SkillEffectAttachmentDraft {
  const defaultBuff = typeof effect.buffPercent === 'number' && Number.isFinite(effect.buffPercent)
    ? Math.max(0, Math.min(1, effect.buffPercent))
    : 0.1;
  return {
    effectId: effect.id,
    buffPercent: String(defaultBuff),
    procChance: '1',
    recoilMode: 'percent_max_hp',
    recoilPercent: effect.effectType === 'recoil' ? '0.1' : '0',
    persistentHealMode: 'percent_max_hp',
    persistentHealValue: '0.05',
    persistentHealDurationTurns: '1',
    toxicPotencyBase: effect.effectType === 'inflict_toxic' ? '0.05' : '0',
    toxicPotencyPerTurn: effect.effectType === 'inflict_toxic' ? '0.05' : '0',
    stunFailChance: effect.effectType === 'inflict_stun' ? '0.25' : '0',
    stunSlowdown: effect.effectType === 'inflict_stun' ? '0.5' : '0',
    flinchFirstUseOnly: false,
    flinchFirstOverallOnly: false,
  };
}

export function MoveTool() {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [effectList, setEffectList] = useState<EffectOption[]>([]);
  const [gameElements, setGameElements] = useState<string[]>(() => [...CRITTER_ELEMENTS]);
  const [elementColorById, setElementColorById] = useState<Record<string, string>>({});
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SkillDraft>(emptyDraft);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [effectSearchInput, setEffectSearchInput] = useState('');
  const [effectDropdownOpen, setEffectDropdownOpen] = useState(false);
  const effectSearchInputRef = useRef<HTMLInputElement>(null);

  const selectedSkill = useMemo(
    () => skills.find((s) => s.skill_id === selectedSkillId) ?? null,
    [skills, selectedSkillId],
  );
  const activeHealMode = normalizeDraftHealMode(draft.type, draft.healMode);
  const showHealValueInput = activeHealMode !== 'none';
  const usesPercentHealValue = activeHealMode === 'percent_damage' || activeHealMode === 'percent_max_hp';

  const filteredSkills = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    const sorted = [...skills].sort((a, b) => a.skill_id.localeCompare(b.skill_id));
    if (!query) return sorted;
    return sorted.filter(
      (s) => s.skill_id.toLowerCase().includes(query) || s.skill_name.toLowerCase().includes(query),
    );
  }, [skills, searchInput]);

  const filteredEffectOptions = useMemo(() => {
    const query = effectSearchInput.trim().toLowerCase();
    const selected = new Set(draft.effectAttachments.map((attachment) => attachment.effectId));
    return effectList
      .filter((e) => !selected.has(e.id))
      .filter(
        (e) =>
          !query || e.id.toLowerCase().includes(query) || e.name.toLowerCase().includes(query),
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 12);
  }, [effectList, draft.effectAttachments, effectSearchInput]);

  const iconsBucketRoot = useMemo(() => {
    // Get icons bucket root from any effect icon URL
    for (const effect of effectList) {
      if (effect.iconUrl) {
        const root = extractSupabasePublicBucketRoot(effect.iconUrl);
        if (root) return root;
      }
    }
    return null;
  }, [effectList]);

  const loadAll = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<SkillsListResponse>('/api/admin/skills/list');
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load skills.');
      }
      const rawEffects = result.data?.skillEffects;
      const effects = Array.isArray(rawEffects) ? rawEffects : [];
      const effectIdList = effects
        .map((e: { effect_id?: string }) => e?.effect_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      const list: EffectOption[] = effects
        .map(
          (e: {
            effect_id?: string;
            effect_name?: string;
            effect_type?: string;
            effectType?: string;
            description?: string;
            effect_description?: string;
            buffPercent?: number;
            buff_percent?: number;
            iconUrl?: string;
            icon_url?: string;
          }) => {
          const effectTypeRaw =
            typeof e?.effect_type === 'string'
              ? e.effect_type
              : typeof e?.effectType === 'string'
                ? e.effectType
                : '';
          const effectType = SKILL_EFFECT_TYPES.includes(effectTypeRaw as SkillEffectType)
            ? (effectTypeRaw as SkillEffectType)
            : 'atk_buff';
          return ({
          id: typeof e?.effect_id === 'string' ? e.effect_id : '',
          name: typeof e?.effect_name === 'string' ? e.effect_name : String(e?.effect_id ?? ''),
          effectType,
          description:
            typeof e?.description === 'string' && e.description.trim()
              ? e.description.trim()
              : typeof e?.effect_description === 'string' && e.effect_description.trim()
                ? e.effect_description.trim()
                : undefined,
          buffPercent:
            typeof e?.buffPercent === 'number' && Number.isFinite(e.buffPercent)
              ? e.buffPercent
              : typeof e?.buff_percent === 'number' && Number.isFinite(e.buff_percent)
                ? e.buff_percent
                : undefined,
          iconUrl:
            typeof e?.iconUrl === 'string' && e.iconUrl.trim()
              ? e.iconUrl.trim()
              : typeof e?.icon_url === 'string' && e.icon_url.trim()
                ? e.icon_url.trim()
                : undefined,
        });
        },
        )
        .filter((x) => x.id.length > 0);
      setEffectList(list);
      const rawSkills = result.data?.critterSkills;
      const knownEffectIds = new Set(effectIdList);
      const effectTypeById = new Map(list.map((effect) => [effect.id, effect.effectType] as const));
      const legacyEffectBuffPercentById = new Map(
        list
          .filter((effect) => typeof effect.buffPercent === 'number' && Number.isFinite(effect.buffPercent))
          .map((effect) => [effect.id, effect.buffPercent as number]),
      );
      const elements = await loadAdminGameElements();
      const allowedElementIds = elements.length > 0 ? elements.map((e) => e.element_id) : undefined;
      if (elements.length > 0) {
        setGameElements(elements.map((e) => e.element_id));
        setElementColorById(
          Object.fromEntries(
            elements
              .filter((entry) => entry.color_hex.trim().length > 0)
              .map((entry) => [entry.element_id, entry.color_hex.trim()] as const),
          ),
        );
      }
      const loaded = sanitizeSkillLibrary(rawSkills, knownEffectIds, legacyEffectBuffPercentById, effectTypeById, allowedElementIds);
      setSkills(loaded);
      if (loaded.length > 0 && !selectedSkillId) {
        setSelectedSkillId(loaded[0].skill_id);
        setDraft(skillToDraft(loaded[0], list));
      } else if (selectedSkillId && loaded.find((s) => s.skill_id === selectedSkillId)) {
        const sel = loaded.find((s) => s.skill_id === selectedSkillId)!;
        setDraft(skillToDraft(sel, list));
      } else {
        setSelectedSkillId(null);
        setDraft(emptyDraft);
      }
      setStatus(`Loaded ${loaded.length} skill(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load skills.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const applyDraft = () => {
    if (selectedSkill) {
      setDraft(skillToDraft(selectedSkill, effectList));
    } else {
      setDraft(emptyDraft);
    }
  };

  const saveSkills = async () => {
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const payload = skills.map((s) => ({
        skill_id: s.skill_id,
        skill_name: s.skill_name,
        element: s.element,
        type: s.type,
        priority: s.priority,
        damage: s.type === 'damage' ? s.damage : undefined,
        healMode: s.healMode,
        healValue: s.healMode ? s.healValue : undefined,
        targetKind: s.targetKind,
        targetTeamOption: s.targetTeamOption,
        targetSelectCount: s.targetSelectCount,
        effectAttachments: s.effectAttachments?.length ? s.effectAttachments : undefined,
        effectIds: s.effectAttachments?.length
          ? s.effectAttachments.map((attachment) => attachment.effectId)
          : s.effectIds?.length
            ? s.effectIds
            : undefined,
      }));
      const result = await apiFetchJson<SkillsSaveResponse>('/api/admin/skills/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ critterSkills: payload }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save skills.');
      }
      setStatus(`Saved ${skills.length} skill(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save skills.');
    } finally {
      setIsSaving(false);
    }
  };

  const addNew = () => {
    const nextId = `skill-${skills.length + 1}`;
    setSelectedSkillId(null);
    setDraft({
      ...emptyDraft,
      skill_id: nextId,
      skill_name: nextId,
    });
  };

  const createOrUpdateFromDraft = () => {
    const id = draft.skill_id.trim();
    const name = draft.skill_name.trim();
    if (!id || !name) {
      setError('Skill ID and name are required.');
      return;
    }
    const effectById = new Map(effectList.map((effect) => [effect.id, effect]));
    const priority = Math.max(1, Math.min(999, parseInt(draft.priority, 10) || 1));
    const damageNum = draft.type === 'damage' ? Math.max(1, parseInt(draft.damage, 10) || 20) : undefined;
    const healValue = parseDraftHealValue(activeHealMode, draft.healValue);
    const effectAttachments = buildSkillEffectAttachmentsFromDraft(draft.effectAttachments, effectById);
    const effectIds = effectAttachments.map((attachment) => attachment.effectId);
    const newSkill: SkillDefinition = {
      skill_id: id,
      skill_name: name,
      element: draft.element,
      type: draft.type,
      priority,
      ...(draft.type === 'damage' && { damage: damageNum }),
      ...(draft.type === 'support' && activeHealMode !== 'none' && { healMode: activeHealMode, healValue }),
      ...(draft.type === 'damage' && activeHealMode !== 'none' && { healMode: activeHealMode, healValue }),
      ...(effectAttachments.length > 0 && { effectAttachments }),
      ...(effectIds.length > 0 && { effectIds }),
      targetKind: (draft.targetKind as SkillTargetKindDamage | SkillTargetKindSupport) || (draft.type === 'damage' ? 'select_enemies' : 'select_allies'),
      ...(draft.targetKind === 'target_team' && { targetTeamOption: draft.targetTeamOption as SkillTargetTeamOption }),
      ...((draft.targetKind === 'select_enemies' || draft.targetKind === 'select_allies') && {
        targetSelectCount: Math.max(1, Math.min(3, parseInt(draft.targetSelectCount, 10) || 1)),
      }),
    };
    const existingIndex = skills.findIndex((s) => s.skill_id === id);
    let next: SkillDefinition[];
    if (existingIndex >= 0) {
      next = skills.map((s, i) => (i === existingIndex ? newSkill : s));
    } else {
      next = [...skills, newSkill];
    }
    setSkills(next);
    setSelectedSkillId(id);
    setDraft(skillToDraft(newSkill, effectList));
    setStatus(existingIndex >= 0 ? 'Updated skill.' : 'Added skill.');
  };

  const removeSelected = () => {
    if (!selectedSkillId) return;
    setSkills(skills.filter((s) => s.skill_id !== selectedSkillId));
    const next = skills.filter((s) => s.skill_id !== selectedSkillId);
    if (next.length > 0) {
      setSelectedSkillId(next[0].skill_id);
      setDraft(skillToDraft(next[0], effectList));
    } else {
      setSelectedSkillId(null);
      setDraft(emptyDraft);
    }
    setStatus('Removed skill.');
  };

  return (
    <section className="admin-layout admin-layout--single">
      <section className="admin-layout__left">
        <section className="admin-panel">
          <h3>Skills</h3>
          <div className="admin-row">
            <button type="button" className="secondary" onClick={() => void loadAll()} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Reload'}
            </button>
            <button type="button" className="secondary" onClick={addNew}>
              New Skill
            </button>
            <button type="button" className="secondary" onClick={applyDraft}>
              Reset to selected
            </button>
            <button type="button" className="secondary" onClick={removeSelected} disabled={!selectedSkillId}>
              Remove
            </button>
            <button type="button" className="primary" onClick={() => void saveSkills()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Skills'}
            </button>
          </div>
          <label className="admin-row">
            Search
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ID or name"
            />
          </label>
          {status && <p className="admin-note">{status}</p>}
          {error && <p className="admin-note" style={{ color: '#f7b9b9' }}>{error}</p>}
          <div className="admin-item-grid">
            {filteredSkills.map((skill) => {
              const elementColor = getSkillElementColor(skill.element, elementColorById[skill.element]);
              const style = { ['--admin-skill-bg' as string]: elementColor };
              return (
                <button
                  key={skill.skill_id}
                  type="button"
                  className={`secondary admin-skill-list-item ${elementColor ? 'admin-skill-list-item--colored' : ''} ${selectedSkillId === skill.skill_id ? 'is-selected' : ''}`}
                  style={style}
                  title={buildAdminSkillTooltip(skill, effectList)}
                  onClick={() => {
                    setSelectedSkillId(skill.skill_id);
                    setDraft(skillToDraft(skill, effectList));
                  }}
                >
                  <AdminSkillCellContent skill={skill} effectList={effectList} iconsBucketRoot={iconsBucketRoot} />
                </button>
              );
            })}
            {skills.length === 0 && <p className="admin-note">No skills yet. Create one and save.</p>}
          </div>
        </section>
      </section>
      <section className="admin-layout__right">
        <section className="admin-panel">
          <h4>Skill details</h4>
          <div className="admin-grid-2">
            <label>
              Skill ID
              <input
                value={draft.skill_id}
                onChange={(e) => setDraft((d) => ({ ...d, skill_id: e.target.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') }))}
                placeholder="tackle"
              />
            </label>
            <label>
              Skill name
              <input
                value={draft.skill_name}
                onChange={(e) => setDraft((d) => ({ ...d, skill_name: e.target.value }))}
                placeholder="Tackle"
              />
            </label>
            <label>
              Element
              <select
                value={draft.element}
                onChange={(e) => setDraft((d) => ({ ...d, element: e.target.value }))}
              >
                {gameElements.map((el) => (
                  <option key={el} value={el}>{el}</option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select
                value={draft.type}
                onChange={(e) =>
                  setDraft((d) => {
                    const nextType = e.target.value as SkillDraftType;
                    return {
                      ...d,
                      type: nextType,
                      healMode: normalizeDraftHealMode(nextType, d.healMode),
                      targetKind: nextType === 'damage' ? 'select_enemies' : 'select_allies',
                      targetTeamOption: 'user_only',
                      targetSelectCount: '1',
                    };
                  })
                }
              >
                {SKILL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <input
                type="number"
                min={1}
                max={999}
                step={1}
                value={draft.priority}
                onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
              />
            </label>
          </div>
          <div className="admin-grid-2">
            <label>
              Target
              <select
                value={draft.targetKind}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    targetKind: e.target.value,
                    targetTeamOption: e.target.value === 'target_team' ? d.targetTeamOption : 'user_only',
                    targetSelectCount: e.target.value === 'select_enemies' || e.target.value === 'select_allies' ? d.targetSelectCount : '1',
                  }))
                }
              >
                {draft.type === 'damage'
                  ? [
                      { value: 'target_all', label: 'Target All' },
                      { value: 'target_all_enemies', label: 'Target All Enemies' },
                      { value: 'select_enemies', label: 'Select Enemies' },
                    ].map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))
                  : [
                      { value: 'target_self', label: 'Target Self' },
                      { value: 'target_team', label: 'Target Team' },
                      { value: 'select_allies', label: 'Select Allies' },
                    ].map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
              </select>
            </label>
            {draft.targetKind === 'target_team' && (
              <label>
                Target team
                <select
                  value={draft.targetTeamOption}
                  onChange={(e) => setDraft((d) => ({ ...d, targetTeamOption: e.target.value }))}
                >
                  {[
                    { value: 'user_only', label: 'User only' },
                    { value: 'user_and_partner', label: 'User and partner' },
                    { value: 'partner_only', label: 'Partner only' },
                  ].map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            )}
            {(draft.targetKind === 'select_enemies' || draft.targetKind === 'select_allies') && (
              <label>
                Select count (1–3)
                <input
                  type="number"
                  min={1}
                  max={3}
                  step={1}
                  value={draft.targetSelectCount}
                  onChange={(e) => setDraft((d) => ({ ...d, targetSelectCount: e.target.value }))}
                />
              </label>
            )}
          </div>
          {draft.type === 'damage' && (
            <label>
              Damage (power)
              <input
                type="number"
                min={1}
                value={draft.damage}
                onChange={(e) => setDraft((d) => ({ ...d, damage: e.target.value }))}
              />
            </label>
          )}
          <label>
            {draft.type === 'damage' ? 'Damage heal mode' : 'Support heal mode'}
            <select
              value={activeHealMode}
              onChange={(e) => setDraft((d) => ({ ...d, healMode: normalizeDraftHealMode(d.type, e.target.value) }))}
            >
              {(draft.type === 'damage' ? DAMAGE_HEAL_MODE_OPTIONS : SUPPORT_HEAL_MODE_OPTIONS).map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          {showHealValueInput && (
            <label>
              {getHealValueLabel(draft.type, activeHealMode)}
              <input
                type="number"
                min={0}
                max={usesPercentHealValue ? 1 : undefined}
                step={usesPercentHealValue ? 0.01 : 1}
                value={draft.healValue}
                onChange={(e) => setDraft((d) => ({ ...d, healValue: e.target.value }))}
              />
            </label>
          )}
          {showHealValueInput && usesPercentHealValue && (
            <p className="admin-note">Percent heal values use 0-1 decimals. Example: 0.25 = 25%.</p>
          )}
          {effectList.length > 0 && (
            <label className="admin-effect-picker-wrap">
              <span>Skill Effects</span>
              <div
                className="admin-effect-picker"
                onClick={() => effectSearchInputRef.current?.focus()}
              >
                {draft.effectAttachments.map((attachment) => {
                  const opt = effectList.find((e) => e.id === attachment.effectId);
                  const id = attachment.effectId;
                  const usesRecoil = effectUsesRecoilConfig(opt?.effectType);
                  const usesBuff = effectUsesBuffPercent(opt?.effectType);
                  const usesPersistentHeal = effectUsesPersistentHealConfig(opt?.effectType);
                  const usesToxic = effectUsesToxicConfig(opt?.effectType);
                  const usesStun = effectUsesStunConfig(opt?.effectType);
                  const usesFlinch = effectUsesFlinchConfig(opt?.effectType);
                  const valueLabel = usesRecoil
                    ? `recoil ${Math.round(sanitizeAttachmentNumber(attachment.recoilPercent, 0.1) * 100)}% (${attachment.recoilMode})`
                    : usesPersistentHeal
                      ? formatPersistentHealAttachmentTooltip({
                        persistentHealMode: attachment.persistentHealMode,
                        persistentHealValue: sanitizePersistentHealValue(
                          attachment.persistentHealMode,
                          attachment.persistentHealValue,
                        ),
                        persistentHealDurationTurns: sanitizePersistentHealDuration(
                          attachment.persistentHealDurationTurns,
                        ),
                      })
                    : usesToxic
                      ? `toxic ${Math.round(sanitizeToxicValue(attachment.toxicPotencyBase, 0.05) * 100)}% +${Math.round(sanitizeToxicValue(attachment.toxicPotencyPerTurn, 0.05) * 100)}%/turn`
                    : usesStun
                      ? `stun ${Math.round(sanitizeToxicValue(attachment.stunFailChance, 0.25) * 100)}% fail, -${Math.round(sanitizeToxicValue(attachment.stunSlowdown, 0.5) * 100)}% SPD`
                    : usesFlinch
                      ? `flinch chance${attachment.flinchFirstUseOnly ? ` (${attachment.flinchFirstOverallOnly ? 'first overall' : 'first use'})` : ''}`
                    : usesBuff
                      ? `buff ${Math.round(sanitizeAttachmentNumber(attachment.buffPercent, 0.1) * 100)}%`
                      : 'config';
                  return (
                    <span key={id} className="admin-effect-picker__chip" title={`${id}: ${valueLabel}, proc ${Math.round(sanitizeAttachmentNumber(attachment.procChance, 1) * 100)}%`}>
                      {opt ? `${opt.id} – ${opt.name}` : id}
                      <button
                        type="button"
                        className="admin-effect-picker__chip-remove"
                        aria-label={`Remove ${id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraft((d) => ({
                            ...d,
                            effectAttachments: d.effectAttachments.filter((entry) => entry.effectId !== id),
                          }));
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                <input
                  ref={effectSearchInputRef}
                  type="text"
                  className="admin-effect-picker__input"
                  value={effectSearchInput}
                  onChange={(e) => setEffectSearchInput(e.target.value)}
                  onFocus={() => setEffectDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setEffectDropdownOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === ',' || e.key === 'Enter') {
                      e.preventDefault();
                      const q = effectSearchInput.trim().toLowerCase();
                      if (q) {
                        const exact = effectList.find(
                          (x) => x.id.toLowerCase() === q || x.name.toLowerCase() === q,
                        );
                        if (exact && !draft.effectAttachments.some((entry) => entry.effectId === exact.id)) {
                          setDraft((d) => ({
                            ...d,
                            effectAttachments: [...d.effectAttachments, buildAttachmentDraftFromEffectOption(exact)],
                          }));
                        }
                        setEffectSearchInput('');
                      }
                    } else if (e.key === 'Backspace' && !effectSearchInput && draft.effectAttachments.length > 0) {
                      setDraft((d) => ({
                        ...d,
                        effectAttachments: d.effectAttachments.slice(0, -1),
                      }));
                    }
                  }}
                  placeholder={draft.effectAttachments.length === 0 ? 'Search effects…' : 'Add another (type or comma)'}
                />
                {effectDropdownOpen && (
                  <div
                    className="admin-effect-picker__dropdown"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {filteredEffectOptions.length === 0 ? (
                      <div className="admin-effect-picker__dropdown-empty">
                        {effectSearchInput.trim() ? 'No matching effects' : 'All selected or no effects'}
                      </div>
                    ) : (
                      filteredEffectOptions.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className="admin-effect-picker__dropdown-item"
                          onMouseDown={() => {
                            setDraft((d) => ({
                              ...d,
                              effectAttachments: d.effectAttachments.some((entry) => entry.effectId === opt.id)
                                ? d.effectAttachments
                                : [...d.effectAttachments, buildAttachmentDraftFromEffectOption(opt)],
                            }));
                            setEffectSearchInput('');
                            setEffectDropdownOpen(false);
                          }}
                        >
                          {opt.id} – {opt.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </label>
          )}
          {draft.effectAttachments.length > 0 && (
            <section className="admin-panel" style={{ marginTop: '0.5rem' }}>
              <h4>Effect Values</h4>
              <p className="admin-note" style={{ marginBottom: '0.5rem' }}>
                Configure each attached effect per skill. `0.1 = 10%`.
              </p>
              <div className="admin-grid-2">
                {draft.effectAttachments.map((attachment) => {
                  const effect = effectList.find((entry) => entry.id === attachment.effectId);
                  const usesRecoil = effectUsesRecoilConfig(effect?.effectType);
                  const usesBuff = effectUsesBuffPercent(effect?.effectType);
                  const usesPersistentHeal = effectUsesPersistentHealConfig(effect?.effectType);
                  const usesToxic = effectUsesToxicConfig(effect?.effectType);
                  const usesStun = effectUsesStunConfig(effect?.effectType);
                  const usesFlinch = effectUsesFlinchConfig(effect?.effectType);
                  return (
                    <div key={attachment.effectId} className="admin-panel" style={{ margin: 0 }}>
                      <h5 style={{ marginTop: 0, marginBottom: '0.4rem' }}>
                        {effect ? `${effect.id} – ${effect.name}` : attachment.effectId}
                      </h5>
                      {usesBuff && (
                        <label>
                          Buff % (0–1)
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={attachment.buffPercent}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                effectAttachments: d.effectAttachments.map((entry) =>
                                  entry.effectId === attachment.effectId
                                    ? { ...entry, buffPercent: e.target.value }
                                    : entry,
                                ),
                              }))
                            }
                          />
                        </label>
                      )}
                      {usesRecoil && (
                        <>
                          <label>
                            Recoil Mode
                            <select
                              value={attachment.recoilMode}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  effectAttachments: d.effectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? { ...entry, recoilMode: e.target.value as SkillRecoilMode }
                                      : entry,
                                  ),
                                }))
                              }
                            >
                              {SKILL_RECOIL_MODES.map((mode) => (
                                <option key={mode} value={mode}>
                                  {mode}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Recoil % (0–1)
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={attachment.recoilPercent}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  effectAttachments: d.effectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? { ...entry, recoilPercent: e.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                          </label>
                        </>
                      )}
                      {usesPersistentHeal && (
                        <>
                          <label>
                            Persistent Heal Mode
                            <select
                              value={attachment.persistentHealMode}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  effectAttachments: d.effectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? { ...entry, persistentHealMode: e.target.value as 'flat' | 'percent_max_hp' }
                                      : entry,
                                  ),
                                }))
                              }
                            >
                              {PERSISTENT_HEAL_MODE_OPTIONS.map((mode) => (
                                <option key={mode.value} value={mode.value}>
                                  {mode.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {attachment.persistentHealMode === 'flat' ? 'Heal HP each turn' : 'Heal % max HP each turn (0–1)'}
                            <input
                              type="number"
                              min={attachment.persistentHealMode === 'flat' ? 1 : 0}
                              max={attachment.persistentHealMode === 'flat' ? undefined : 1}
                              step={attachment.persistentHealMode === 'flat' ? 1 : 0.01}
                              value={attachment.persistentHealValue}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  effectAttachments: d.effectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? { ...entry, persistentHealValue: e.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label>
                            Duration (turns)
                            <input
                              type="number"
                              min={1}
                              max={999}
                              step={1}
                              value={attachment.persistentHealDurationTurns}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  effectAttachments: d.effectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? { ...entry, persistentHealDurationTurns: e.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                          </label>
                        </>
                      )}
                      {usesToxic && (
                        <>
                          <label>
                            Toxic Base (0-1)
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={attachment.toxicPotencyBase}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  effectAttachments: d.effectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? { ...entry, toxicPotencyBase: e.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label>
                            Toxic Ramp / Turn (0-1)
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={attachment.toxicPotencyPerTurn}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  effectAttachments: d.effectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? { ...entry, toxicPotencyPerTurn: e.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                          </label>
                        </>
                      )}
                      {usesStun && (
                        <>
                          <label>
                            Stun Fail Chance (0-1)
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={attachment.stunFailChance}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  effectAttachments: d.effectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? { ...entry, stunFailChance: e.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label>
                            Stun Slowdown (0-1)
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={attachment.stunSlowdown}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  effectAttachments: d.effectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? { ...entry, stunSlowdown: e.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                          </label>
                        </>
                      )}
                      {usesFlinch && (
                        <>
                          <label className="admin-inline-toggle">
                            <input
                              type="checkbox"
                              checked={attachment.flinchFirstUseOnly}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  effectAttachments: d.effectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? {
                                        ...entry,
                                        flinchFirstUseOnly: e.target.checked,
                                        flinchFirstOverallOnly: e.target.checked ? entry.flinchFirstOverallOnly : false,
                                      }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                            First Use
                          </label>
                          <label className="admin-inline-toggle">
                            <input
                              type="checkbox"
                              checked={attachment.flinchFirstUseOnly && attachment.flinchFirstOverallOnly}
                              disabled={!attachment.flinchFirstUseOnly}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  effectAttachments: d.effectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? {
                                        ...entry,
                                        flinchFirstOverallOnly: entry.flinchFirstUseOnly ? e.target.checked : false,
                                      }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                            First Overall
                          </label>
                        </>
                      )}
                      <label>
                        Proc Chance (0–1)
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={attachment.procChance}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              effectAttachments: d.effectAttachments.map((entry) =>
                                entry.effectId === attachment.effectId
                                  ? { ...entry, procChance: e.target.value }
                                  : entry,
                              ),
                            }))
                          }
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          <div className="admin-row">
            <button type="button" className="primary" onClick={createOrUpdateFromDraft}>
              {skills.some((s) => s.skill_id === draft.skill_id.trim()) ? 'Update' : 'Add'} skill
            </button>
          </div>
        </section>
      </section>
    </section>
  );
}
