import { useEffect, useMemo, useState } from 'react';
import { loadAdminGameElements } from '@/admin/elementsApi';
import { sanitizeAbilityDefinition, sanitizeAbilityLibrary } from '@/game/abilities/schema';
import {
  ABILITY_DAMAGED_BUFF_TRIGGER_TYPES,
  ABILITY_EFFECT_TRIGGER_FAMILIES,
  ABILITY_GUARD_BUFF_MODES,
  ABILITY_GUARD_RECOIL_MODES,
  ABILITY_PROC_TARGETS,
  ABILITY_TEMPLATE_TYPES,
  type AbilityDefinition,
} from '@/game/abilities/types';
import { sanitizeSkillEffectLibrary } from '@/game/skills/schema';
import {
  SKILL_PERSISTENT_HEAL_MODES,
  SKILL_RECOIL_MODES,
  type SkillEffectAttachment,
  type SkillEffectType,
} from '@/game/skills/types';
import { apiFetchJson } from '@/shared/apiClient';

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

function buildElementLogoUrlFromIconsBucket(element: string, iconsBucketRoot: string | null): string | null {
  if (!iconsBucketRoot) {
    return null;
  }
  return `${iconsBucketRoot}/${encodeURIComponent(`${element}-element.png`)}`;
}

function formatTemplateTypeLabel(templateType: AbilityTemplateDraft['templateType']): string {
  return templateType
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function templateTypeSearchKeywords(templateType: AbilityTemplateDraft['templateType']): string {
  if (templateType === 'guard-buff') {
    return 'guard recoil proc defender trigger';
  }
  return 'damaged threshold effect family reward';
}

interface AbilitiesListResponse {
  ok: boolean;
  abilities?: unknown;
  error?: string;
}

interface AbilitiesSaveResponse {
  ok: boolean;
  error?: string;
}

interface SkillsListResponse {
  ok: boolean;
  skillEffects?: unknown;
  error?: string;
}

interface SkillEffectOption {
  id: string;
  name: string;
  effectType: SkillEffectType;
  description?: string;
  buffPercent?: number;
  iconUrl?: string;
}

interface SkillEffectAttachmentDraft {
  effectId: string;
  procChance: string;
  buffPercent: string;
  recoilMode: 'percent_max_hp' | 'percent_damage_dealt';
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

interface AbilityTemplateDraft {
  templateType: AbilityDefinition['templateAttachments'][number]['templateType'];
  mode: 'recoil' | 'proc';
  recoilMode: 'flat' | 'percent_attacker_max_hp' | 'percent_incoming_damage';
  recoilValue: string;
  procTarget: 'self' | 'attacker';
  procEffectAttachment: SkillEffectAttachmentDraft;
  triggerType: 'damage' | 'effect';
  belowPercent: string;
  triggerFamilies: string[];
  rewardEffectAttachment: SkillEffectAttachmentDraft;
}

interface AbilityDraft {
  id: string;
  name: string;
  element: string;
  description: string;
  templateAttachments: AbilityTemplateDraft[];
}

const DEFAULT_EFFECT_ATTACHMENT_DRAFT: SkillEffectAttachmentDraft = {
  effectId: '',
  procChance: '1',
  buffPercent: '0.1',
  recoilMode: 'percent_max_hp',
  recoilPercent: '0.1',
  persistentHealMode: 'percent_max_hp',
  persistentHealValue: '0.05',
  persistentHealDurationTurns: '1',
  toxicPotencyBase: '0.05',
  toxicPotencyPerTurn: '0.05',
  stunFailChance: '0.25',
  stunSlowdown: '0.5',
  flinchFirstUseOnly: false,
  flinchFirstOverallOnly: false,
};

function effectUsesBuffPercent(effectType: SkillEffectType | undefined): boolean {
  return (
    effectType === 'atk_buff' ||
    effectType === 'def_buff' ||
    effectType === 'speed_buff' ||
    effectType === 'self_atk_debuff' ||
    effectType === 'self_def_debuff' ||
    effectType === 'self_speed_debuff' ||
    effectType === 'target_atk_debuff' ||
    effectType === 'target_def_debuff' ||
    effectType === 'target_speed_debuff' ||
    effectType === 'crit_buff'
  );
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

function clampNumberInput(raw: string, fallback: string): string {
  return raw.trim().length > 0 ? raw : fallback;
}

function createEmptyDraft(existing: AbilityDefinition[], elementIds: string[]): AbilityDraft {
  return {
    id: `ability-${existing.length + 1}`,
    name: `Ability ${existing.length + 1}`,
    element: elementIds[0] ?? 'normal',
    description: '',
    templateAttachments: [],
  };
}

function createTemplateDraft(templateType: AbilityTemplateDraft['templateType']): AbilityTemplateDraft {
  return {
    templateType,
    mode: 'recoil',
    recoilMode: 'flat',
    recoilValue: '0',
    procTarget: 'self',
    procEffectAttachment: { ...DEFAULT_EFFECT_ATTACHMENT_DRAFT },
    triggerType: 'damage',
    belowPercent: '0.5',
    triggerFamilies: [],
    rewardEffectAttachment: { ...DEFAULT_EFFECT_ATTACHMENT_DRAFT },
  };
}

function attachmentToDraft(attachment: SkillEffectAttachment | null | undefined): SkillEffectAttachmentDraft {
  return {
    effectId: attachment?.effectId ?? '',
    procChance: String(attachment?.procChance ?? 1),
    buffPercent: String(attachment?.buffPercent ?? 0.1),
    recoilMode: attachment?.recoilMode === 'percent_damage_dealt' ? 'percent_damage_dealt' : 'percent_max_hp',
    recoilPercent: String(attachment?.recoilPercent ?? 0.1),
    persistentHealMode: attachment?.persistentHealMode === 'flat' ? 'flat' : 'percent_max_hp',
    persistentHealValue: String(attachment?.persistentHealValue ?? 0.05),
    persistentHealDurationTurns: String(attachment?.persistentHealDurationTurns ?? 1),
    toxicPotencyBase: String(attachment?.toxicPotencyBase ?? 0.05),
    toxicPotencyPerTurn: String(attachment?.toxicPotencyPerTurn ?? 0.05),
    stunFailChance: String(attachment?.stunFailChance ?? 0.25),
    stunSlowdown: String(attachment?.stunSlowdown ?? 0.5),
    flinchFirstUseOnly: attachment?.flinchFirstUseOnly === true,
    flinchFirstOverallOnly: attachment?.flinchFirstUseOnly === true && attachment?.flinchFirstOverallOnly === true,
  };
}

function abilityToDraft(ability: AbilityDefinition): AbilityDraft {
  return {
    id: ability.id,
    name: ability.name,
    element: ability.element,
    description: ability.description,
    templateAttachments: ability.templateAttachments.map((attachment) => {
      if (attachment.templateType === 'guard-buff') {
        return {
          templateType: 'guard-buff',
          mode: attachment.mode,
          recoilMode: attachment.recoilMode,
          recoilValue: String(attachment.recoilValue),
          procTarget: attachment.procTarget === 'attacker' ? 'attacker' : 'self',
          procEffectAttachment: attachmentToDraft(attachment.procEffectAttachment),
          triggerType: 'damage',
          belowPercent: '0.5',
          triggerFamilies: [],
          rewardEffectAttachment: { ...DEFAULT_EFFECT_ATTACHMENT_DRAFT },
        };
      }
      return {
        templateType: 'damaged-buff',
        mode: 'recoil',
        recoilMode: 'flat',
        recoilValue: '0',
        procTarget: 'self',
        procEffectAttachment: { ...DEFAULT_EFFECT_ATTACHMENT_DRAFT },
        triggerType: attachment.triggerType,
        belowPercent: String(attachment.belowPercent ?? 0.5),
        triggerFamilies: [...(attachment.triggerFamilies ?? [])],
        rewardEffectAttachment: attachmentToDraft(attachment.rewardEffectAttachment),
      };
    }),
  };
}

function skillEffectAttachmentDraftToRaw(draft: SkillEffectAttachmentDraft): Record<string, unknown> | null {
  const effectId = draft.effectId.trim();
  if (!effectId) {
    return null;
  }
  return {
    effectId,
    procChance: Number.parseFloat(clampNumberInput(draft.procChance, '1')),
    buffPercent: Number.parseFloat(clampNumberInput(draft.buffPercent, '0.1')),
    recoilMode: draft.recoilMode,
    recoilPercent: Number.parseFloat(clampNumberInput(draft.recoilPercent, '0.1')),
    persistentHealMode: draft.persistentHealMode,
    persistentHealValue:
      draft.persistentHealMode === 'flat'
        ? Number.parseInt(clampNumberInput(draft.persistentHealValue, '1'), 10)
        : Number.parseFloat(clampNumberInput(draft.persistentHealValue, '0.05')),
    persistentHealDurationTurns: Number.parseInt(clampNumberInput(draft.persistentHealDurationTurns, '1'), 10),
    toxicPotencyBase: Number.parseFloat(clampNumberInput(draft.toxicPotencyBase, '0.05')),
    toxicPotencyPerTurn: Number.parseFloat(clampNumberInput(draft.toxicPotencyPerTurn, '0.05')),
    stunFailChance: Number.parseFloat(clampNumberInput(draft.stunFailChance, '0.25')),
    stunSlowdown: Number.parseFloat(clampNumberInput(draft.stunSlowdown, '0.5')),
    flinchFirstUseOnly: draft.flinchFirstUseOnly,
    flinchFirstOverallOnly: draft.flinchFirstUseOnly && draft.flinchFirstOverallOnly,
  };
}

function draftToRawAbility(draft: AbilityDraft): Record<string, unknown> {
  return {
    id: draft.id.trim(),
    name: draft.name.trim(),
    element: draft.element,
    description: draft.description.trim(),
    templateAttachments: draft.templateAttachments.map((attachment) => {
      if (attachment.templateType === 'guard-buff') {
        return {
          templateType: 'guard-buff',
          mode: attachment.mode,
          recoilMode: attachment.recoilMode,
          recoilValue:
            attachment.recoilMode === 'flat'
              ? Number.parseInt(clampNumberInput(attachment.recoilValue, '0'), 10)
              : Number.parseFloat(clampNumberInput(attachment.recoilValue, '0')),
          procTarget: attachment.procTarget,
          procEffectAttachment: skillEffectAttachmentDraftToRaw(attachment.procEffectAttachment),
        };
      }
      return {
        templateType: 'damaged-buff',
        triggerType: attachment.triggerType,
        belowPercent: Number.parseFloat(clampNumberInput(attachment.belowPercent, '0.5')),
        triggerFamilies: [...attachment.triggerFamilies],
        rewardEffectAttachment: skillEffectAttachmentDraftToRaw(attachment.rewardEffectAttachment),
      };
    }),
  };
}

function buildAbilityTooltip(ability: AbilityDefinition, effectById: Map<string, SkillEffectOption>): string {
  const lines = [ability.name, `${ability.element} ability`];
  if (ability.description.trim()) {
    lines.push(ability.description.trim());
  }
  for (const attachment of ability.templateAttachments) {
    if (attachment.templateType === 'guard-buff') {
      if (attachment.mode === 'recoil') {
        const value =
          attachment.recoilMode === 'flat'
            ? `${Math.max(0, Math.floor(attachment.recoilValue))}`
            : `${Math.round(Math.max(0, Math.min(1, attachment.recoilValue)) * 100)}%`;
        lines.push(`Guard Buff: recoil ${value} (${attachment.recoilMode})`);
      } else {
        const effectName = attachment.procEffectAttachment?.effectId
          ? effectById.get(attachment.procEffectAttachment.effectId)?.name ?? attachment.procEffectAttachment.effectId
          : 'no effect';
        const procChance = Math.round((attachment.procEffectAttachment?.procChance ?? 1) * 100);
        lines.push(`Guard Buff: ${procChance}% proc to ${attachment.procTarget ?? 'self'} (${effectName})`);
      }
      continue;
    }
    if (attachment.triggerType === 'damage') {
      lines.push(`Damaged Buff: below ${Math.round((attachment.belowPercent ?? 0.5) * 100)}% HP`);
    } else {
      lines.push(`Damaged Buff: families ${attachment.triggerFamilies?.join(', ') || 'none'}`);
    }
    const rewardEffectId = attachment.rewardEffectAttachment?.effectId;
    if (rewardEffectId) {
      const rewardName = effectById.get(rewardEffectId)?.name ?? rewardEffectId;
      lines.push(`Reward: ${rewardName}`);
    }
  }
  return lines.join('\n');
}

function collectAbilityEffectIconUrls(ability: AbilityDefinition, effectById: Map<string, SkillEffectOption>): string[] {
  const urls: string[] = [];
  for (const attachment of ability.templateAttachments) {
    const effectId =
      attachment.templateType === 'guard-buff'
        ? attachment.procEffectAttachment?.effectId
        : attachment.rewardEffectAttachment?.effectId;
    const iconUrl = effectId ? effectById.get(effectId)?.iconUrl : null;
    if (iconUrl && !urls.includes(iconUrl)) {
      urls.push(iconUrl);
    }
  }
  return urls;
}

export function AbilitiesTool() {
  const [abilities, setAbilities] = useState<AbilityDefinition[]>([]);
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AbilityDraft>({
    id: 'ability-1',
    name: 'Ability 1',
    element: 'normal',
    description: '',
    templateAttachments: [],
  });
  const [skillEffects, setSkillEffects] = useState<SkillEffectOption[]>([]);
  const [elementIds, setElementIds] = useState<string[]>(['normal']);
  const [elementColorById, setElementColorById] = useState<Record<string, string>>({});
  const [searchInput, setSearchInput] = useState('');
  const [templateSearchInput, setTemplateSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const effectById = useMemo(() => new Map(skillEffects.map((effect) => [effect.id, effect] as const)), [skillEffects]);
  const iconsBucketRoot = useMemo(() => {
    for (const effect of skillEffects) {
      if (effect.iconUrl) {
        const root = extractSupabasePublicBucketRoot(effect.iconUrl);
        if (root) {
          return root;
        }
      }
    }
    return null;
  }, [skillEffects]);
  const selectedAbility = useMemo(
    () => abilities.find((entry) => entry.id === selectedAbilityId) ?? null,
    [abilities, selectedAbilityId],
  );
  const filteredAbilities = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    const sorted = [...abilities].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
    if (!query) {
      return sorted;
    }
    return sorted.filter((ability) =>
      [ability.id, ability.name, ability.description, ability.element].join(' ').toLowerCase().includes(query),
    );
  }, [abilities, searchInput]);
  const hasDraftChanges = useMemo(() => {
    if (!selectedAbility) {
      return true;
    }
    return JSON.stringify(abilityToDraft(selectedAbility)) !== JSON.stringify(draft);
  }, [draft, selectedAbility]);
  const filteredTemplateTypes = useMemo(() => {
    const query = templateSearchInput.trim().toLowerCase();
    if (!query) {
      return [...ABILITY_TEMPLATE_TYPES];
    }
    return ABILITY_TEMPLATE_TYPES.filter((templateType) =>
      [templateType, formatTemplateTypeLabel(templateType), templateTypeSearchKeywords(templateType)]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [templateSearchInput]);

  const loadSkillEffectOptions = async (): Promise<SkillEffectOption[]> => {
    const result = await apiFetchJson<SkillsListResponse>('/api/admin/skills/list');
    if (!result.ok) {
      throw new Error(result.error ?? result.data?.error ?? 'Unable to load skill effects.');
    }
    const parsed = sanitizeSkillEffectLibrary(result.data?.skillEffects);
    return parsed.map((effect) => ({
      id: effect.effect_id,
      name: effect.effect_name ?? effect.effect_id,
      effectType: effect.effect_type,
      description: effect.description,
      buffPercent: effect.buffPercent,
      iconUrl: effect.iconUrl,
    }));
  };

  const loadAbilities = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const [result, loadedSkillEffects, loadedElements] = await Promise.all([
        apiFetchJson<AbilitiesListResponse>('/api/admin/abilities/list'),
        loadSkillEffectOptions(),
        loadAdminGameElements(),
      ]);
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load abilities.');
      }
      const nextElementIds =
        loadedElements.length > 0 ? loadedElements.map((entry) => entry.element_id) : ['normal'];
      setElementIds(nextElementIds);
      setElementColorById(
        Object.fromEntries(
          loadedElements
            .filter((entry) => entry.color_hex.trim().length > 0)
            .map((entry) => [entry.element_id, entry.color_hex.trim()] as const),
        ),
      );
      setSkillEffects(loadedSkillEffects);
      const knownEffectIds = new Set(loadedSkillEffects.map((effect) => effect.id));
      const effectTypeById = new Map(loadedSkillEffects.map((effect) => [effect.id, effect.effectType] as const));
      const legacyBuffById = new Map(
        loadedSkillEffects
          .filter((effect) => typeof effect.buffPercent === 'number' && Number.isFinite(effect.buffPercent))
          .map((effect) => [effect.id, effect.buffPercent as number] as const),
      );
      const loadedAbilities = sanitizeAbilityLibrary(
        result.data?.abilities,
        knownEffectIds,
        legacyBuffById,
        effectTypeById,
        nextElementIds,
      );
      setAbilities(loadedAbilities);
      if (loadedAbilities.length > 0) {
        setSelectedAbilityId(loadedAbilities[0].id);
        setDraft(abilityToDraft(loadedAbilities[0]));
      } else {
        setSelectedAbilityId(null);
        setDraft(createEmptyDraft([], nextElementIds));
      }
      setStatus(`Loaded ${loadedAbilities.length} ability definition(s).`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load abilities.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAbilities();
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectAbility = (ability: AbilityDefinition) => {
    setSelectedAbilityId(ability.id);
    setDraft(abilityToDraft(ability));
    setError('');
    setStatus(`Loaded ability "${ability.name}".`);
  };

  const startNewDraft = () => {
    setSelectedAbilityId(null);
    setDraft(createEmptyDraft(abilities, elementIds));
    setError('');
    setStatus('Drafting a new ability.');
  };

  const applyDraft = () => {
    setError('');
    setStatus('');
    const knownEffectIds = new Set(skillEffects.map((effect) => effect.id));
    const effectTypeById = new Map(skillEffects.map((effect) => [effect.id, effect.effectType] as const));
    const legacyBuffById = new Map(
      skillEffects
        .filter((effect) => typeof effect.buffPercent === 'number' && Number.isFinite(effect.buffPercent))
        .map((effect) => [effect.id, effect.buffPercent as number] as const),
    );
    const parsed = sanitizeAbilityDefinition(
      draftToRawAbility(draft),
      0,
      knownEffectIds,
      legacyBuffById,
      effectTypeById,
      elementIds,
    );
    if (!parsed) {
      setError('Ability draft is invalid.');
      return;
    }
    const next = abilities.some((entry) => entry.id === parsed.id)
      ? abilities.map((entry) => (entry.id === parsed.id ? parsed : entry))
      : [...abilities, parsed];
    setAbilities(next);
    setSelectedAbilityId(parsed.id);
    setDraft(abilityToDraft(parsed));
    setStatus(abilities.some((entry) => entry.id === parsed.id) ? 'Updated ability draft.' : 'Added ability draft.');
  };

  const removeSelected = () => {
    if (!selectedAbilityId) {
      return;
    }
    const next = abilities.filter((entry) => entry.id !== selectedAbilityId);
    setAbilities(next);
    if (next.length > 0) {
      setSelectedAbilityId(next[0].id);
      setDraft(abilityToDraft(next[0]));
    } else {
      setSelectedAbilityId(null);
      setDraft(createEmptyDraft([], elementIds));
    }
    setStatus('Removed ability draft.');
    setError('');
  };

  const saveAbilities = async () => {
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const payload = abilities.map((ability) => draftToRawAbility(abilityToDraft(ability)));
      const result = await apiFetchJson<AbilitiesSaveResponse>('/api/admin/abilities/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abilities: payload }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save abilities.');
      }
      setStatus(`Saved ${abilities.length} ability definition(s).`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save abilities.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateTemplateDraft = (
    templateIndex: number,
    updater: (current: AbilityTemplateDraft) => AbilityTemplateDraft,
  ) => {
    setDraft((current) => ({
      ...current,
      templateAttachments: current.templateAttachments.map((entry, index) =>
        index === templateIndex ? updater(entry) : entry,
      ),
    }));
  };

  const addTemplate = (templateType: AbilityTemplateDraft['templateType']) => {
    setDraft((current) => ({
      ...current,
      templateAttachments: [...current.templateAttachments, createTemplateDraft(templateType)],
    }));
  };

  const renderEffectAttachmentEditor = (
    label: string,
    attachmentDraft: SkillEffectAttachmentDraft,
    onChange: (next: SkillEffectAttachmentDraft) => void,
  ) => {
    const effect = effectById.get(attachmentDraft.effectId);
    const availableOptions = skillEffects
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
    return (
      <div className="admin-grid-2">
        <label>
          {label}
          <select
            value={attachmentDraft.effectId}
            onChange={(event) => onChange({ ...attachmentDraft, effectId: event.target.value })}
          >
            <option value="">Select effect</option>
            {availableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.effectType})
              </option>
            ))}
          </select>
        </label>
        <label>
          Proc Chance (0-1)
          <input
            type="number"
            min={0}
            max={1}
            step="0.01"
            value={attachmentDraft.procChance}
            onChange={(event) => onChange({ ...attachmentDraft, procChance: event.target.value })}
          />
        </label>
        {effectUsesBuffPercent(effect?.effectType) && (
          <label>
            Buff / Debuff Value (0-1)
            <input
              type="number"
              min={0}
              max={1}
              step="0.01"
              value={attachmentDraft.buffPercent}
              onChange={(event) => onChange({ ...attachmentDraft, buffPercent: event.target.value })}
            />
          </label>
        )}
        {effectUsesRecoilConfig(effect?.effectType) && (
          <>
            <label>
              Recoil Mode
              <select
                value={attachmentDraft.recoilMode}
                onChange={(event) =>
                  onChange({
                    ...attachmentDraft,
                    recoilMode: event.target.value === 'percent_damage_dealt' ? 'percent_damage_dealt' : 'percent_max_hp',
                  })
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
              Recoil Value (0-1)
              <input
                type="number"
                min={0}
                max={1}
                step="0.01"
                value={attachmentDraft.recoilPercent}
                onChange={(event) => onChange({ ...attachmentDraft, recoilPercent: event.target.value })}
              />
            </label>
          </>
        )}
        {effectUsesPersistentHealConfig(effect?.effectType) && (
          <>
            <label>
              Heal Mode
              <select
                value={attachmentDraft.persistentHealMode}
                onChange={(event) =>
                  onChange({
                    ...attachmentDraft,
                    persistentHealMode: event.target.value === 'flat' ? 'flat' : 'percent_max_hp',
                  })
                }
              >
                {SKILL_PERSISTENT_HEAL_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Heal Value
              <input
                type="number"
                min={0}
                step="0.01"
                value={attachmentDraft.persistentHealValue}
                onChange={(event) => onChange({ ...attachmentDraft, persistentHealValue: event.target.value })}
              />
            </label>
            <label>
              Duration (turns)
              <input
                type="number"
                min={1}
                step={1}
                value={attachmentDraft.persistentHealDurationTurns}
                onChange={(event) => onChange({ ...attachmentDraft, persistentHealDurationTurns: event.target.value })}
              />
            </label>
          </>
        )}
        {effectUsesToxicConfig(effect?.effectType) && (
          <>
            <label>
              Toxic Base (0-1)
              <input
                type="number"
                min={0}
                max={1}
                step="0.01"
                value={attachmentDraft.toxicPotencyBase}
                onChange={(event) => onChange({ ...attachmentDraft, toxicPotencyBase: event.target.value })}
              />
            </label>
            <label>
              Toxic Ramp (0-1)
              <input
                type="number"
                min={0}
                max={1}
                step="0.01"
                value={attachmentDraft.toxicPotencyPerTurn}
                onChange={(event) => onChange({ ...attachmentDraft, toxicPotencyPerTurn: event.target.value })}
              />
            </label>
          </>
        )}
        {effectUsesStunConfig(effect?.effectType) && (
          <>
            <label>
              Stun Fail Chance (0-1)
              <input
                type="number"
                min={0}
                max={1}
                step="0.01"
                value={attachmentDraft.stunFailChance}
                onChange={(event) => onChange({ ...attachmentDraft, stunFailChance: event.target.value })}
              />
            </label>
            <label>
              Stun Slowdown (0-1)
              <input
                type="number"
                min={0}
                max={1}
                step="0.01"
                value={attachmentDraft.stunSlowdown}
                onChange={(event) => onChange({ ...attachmentDraft, stunSlowdown: event.target.value })}
              />
            </label>
          </>
        )}
        {effectUsesFlinchConfig(effect?.effectType) && (
          <>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={attachmentDraft.flinchFirstUseOnly}
                onChange={(event) =>
                  onChange({
                    ...attachmentDraft,
                    flinchFirstUseOnly: event.target.checked,
                    flinchFirstOverallOnly: event.target.checked ? attachmentDraft.flinchFirstOverallOnly : false,
                  })
                }
              />
              First use only
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={attachmentDraft.flinchFirstOverallOnly}
                disabled={!attachmentDraft.flinchFirstUseOnly}
                onChange={(event) =>
                  onChange({
                    ...attachmentDraft,
                    flinchFirstOverallOnly: attachmentDraft.flinchFirstUseOnly && event.target.checked,
                  })
                }
              />
              First overall only
            </label>
          </>
        )}
      </div>
    );
  };

  return (
    <section className="admin-layout admin-layout--single">
      <section className="admin-layout__left">
        <section className="admin-panel">
          <h3>Abilities</h3>
          <div className="admin-row">
            <button type="button" className="secondary" onClick={() => void loadAbilities()} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Reload'}
            </button>
            <button type="button" className="secondary" onClick={startNewDraft}>
              New Ability
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => selectedAbility && setDraft(abilityToDraft(selectedAbility))}
              disabled={!selectedAbility}
            >
              Reset to selected
            </button>
            <button type="button" className="secondary" onClick={removeSelected} disabled={!selectedAbilityId}>
              Remove
            </button>
            <button type="button" className="primary" onClick={applyDraft}>
              {selectedAbility ? 'Apply Changes' : 'Add Draft'}
            </button>
            <button type="button" className="primary" onClick={() => void saveAbilities()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Abilities'}
            </button>
          </div>
          <label className="admin-search-field">
            Search
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Ability name, id, or template"
            />
          </label>
          {status && <p className="admin-note">{status}</p>}
          {error && <p className="admin-note" style={{ color: '#f7b9b9' }}>{error}</p>}
          <div className="admin-item-grid admin-item-grid--catalog">
            {filteredAbilities.map((ability) => {
              const color = elementColorById[ability.element];
              const iconUrls = collectAbilityEffectIconUrls(ability, effectById);
              const elementLogoUrl = buildElementLogoUrlFromIconsBucket(ability.element, iconsBucketRoot);
              const style = color ? { ['--admin-skill-bg' as string]: color } : undefined;
              return (
                <button
                  key={ability.id}
                  type="button"
                  className={`secondary admin-skill-list-item ability-tool__saved-button ${
                    color ? 'admin-skill-list-item--colored' : ''
                  } ${selectedAbilityId === ability.id ? 'is-selected' : ''}`}
                  style={style}
                  title={buildAbilityTooltip(ability, effectById)}
                  onClick={() => selectAbility(ability)}
                >
                  {elementLogoUrl ? (
                    <img
                      src={elementLogoUrl}
                      alt={ability.element}
                      className="skill-cell__element-logo"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                  <span className="ability-tool__saved-name">{ability.name}</span>
                  <div className="ability-tool__saved-meta">
                    {iconUrls.map((url, index) => (
                      <img
                        key={`${ability.id}-${url}-${index}`}
                        src={url}
                        alt=""
                        className="skill-cell__effect-icon"
                        loading="lazy"
                        decoding="async"
                      />
                    ))}
                  </div>
                </button>
              );
            })}
            {filteredAbilities.length === 0 && <p className="admin-note">No saved abilities match that search.</p>}
          </div>
        </section>

        <section className="admin-panel">
          <h3>Ability Editor</h3>
          <div className="admin-grid-2 ability-tool__identity-row">
            <label>
              Ability ID
              <input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
            </label>
            <label>
              Ability Name
              <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Element
              <select
                value={draft.element}
                onChange={(event) => setDraft((current) => ({ ...current, element: event.target.value }))}
              >
                {elementIds.map((elementId) => (
                  <option key={elementId} value={elementId}>
                    {elementId}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="ability-tool__description-row">
            <label>
              Description
              <textarea
                rows={2}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Short passive description"
              />
            </label>
          </div>

          <section className="critter-editor-group">
            <h4>Template Attachments</h4>
            <label className="admin-search-field ability-tool__template-search">
              Search templates
              <input
                value={templateSearchInput}
                onChange={(event) => setTemplateSearchInput(event.target.value)}
                placeholder="Search guard, damaged, proc, recoil..."
              />
            </label>
            <div className="ability-tool__template-picker">
              {filteredTemplateTypes.map((templateType) => (
                <button
                  key={templateType}
                  type="button"
                  className="secondary ability-tool__template-button"
                  onClick={() => addTemplate(templateType)}
                >
                  <span>{formatTemplateTypeLabel(templateType)}</span>
                  <span className="ability-tool__template-button-count">
                    Added {draft.templateAttachments.filter((entry) => entry.templateType === templateType).length}
                  </span>
                </button>
              ))}
            </div>
            {filteredTemplateTypes.length === 0 && (
              <p className="admin-note">No template types match that search.</p>
            )}
            {draft.templateAttachments.length === 0 && (
              <p className="admin-note">Add one or both v1 passive templates for this ability.</p>
            )}
            {draft.templateAttachments.map((template, templateIndex) => (
              <section key={`template-${template.templateType}-${templateIndex}`} className="admin-panel">
                <div className="admin-row">
                  <h4>
                    {formatTemplateTypeLabel(template.templateType)} #
                    {draft.templateAttachments
                      .slice(0, templateIndex + 1)
                      .filter((entry) => entry.templateType === template.templateType).length}
                  </h4>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        templateAttachments: current.templateAttachments.filter((_, index) => index !== templateIndex),
                      }))
                    }
                  >
                    Remove Template
                  </button>
                </div>

                {template.templateType === 'guard-buff' ? (
                  <>
                    <div className="admin-grid-2">
                      <label>
                        Branch
                        <select
                          value={template.mode}
                          onChange={(event) =>
                            updateTemplateDraft(templateIndex, (current) => ({
                              ...current,
                              mode: event.target.value === 'proc' ? 'proc' : 'recoil',
                            }))
                          }
                        >
                          {ABILITY_GUARD_BUFF_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Recoil Mode
                        <select
                          value={template.recoilMode}
                          onChange={(event) =>
                            updateTemplateDraft(templateIndex, (current) => ({
                              ...current,
                              recoilMode:
                                event.target.value === 'percent_attacker_max_hp'
                                  ? 'percent_attacker_max_hp'
                                  : event.target.value === 'percent_incoming_damage'
                                    ? 'percent_incoming_damage'
                                    : 'flat',
                            }))
                          }
                        >
                          {ABILITY_GUARD_RECOIL_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Recoil Value
                        <input
                          type="number"
                          min={0}
                          step={template.recoilMode === 'flat' ? 1 : 0.01}
                          max={template.recoilMode === 'flat' ? undefined : 1}
                          value={template.recoilValue}
                          onChange={(event) =>
                            updateTemplateDraft(templateIndex, (current) => ({
                              ...current,
                              recoilValue: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    {template.mode === 'proc' && (
                      <>
                        <label>
                          Proc Target
                          <select
                            value={template.procTarget}
                            onChange={(event) =>
                              updateTemplateDraft(templateIndex, (current) => ({
                                ...current,
                                procTarget: event.target.value === 'attacker' ? 'attacker' : 'self',
                              }))
                            }
                          >
                            {ABILITY_PROC_TARGETS.map((target) => (
                              <option key={target} value={target}>
                                {target}
                              </option>
                            ))}
                          </select>
                        </label>
                        {renderEffectAttachmentEditor('Proc Effect', template.procEffectAttachment, (nextAttachment) =>
                          updateTemplateDraft(templateIndex, (current) => ({
                            ...current,
                            procEffectAttachment: nextAttachment,
                          })),
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="admin-grid-2">
                      <label>
                        Trigger Type
                        <select
                          value={template.triggerType}
                          onChange={(event) =>
                            updateTemplateDraft(templateIndex, (current) => ({
                              ...current,
                              triggerType: event.target.value === 'effect' ? 'effect' : 'damage',
                            }))
                          }
                        >
                          {ABILITY_DAMAGED_BUFF_TRIGGER_TYPES.map((triggerType) => (
                            <option key={triggerType} value={triggerType}>
                              {triggerType}
                            </option>
                          ))}
                        </select>
                      </label>
                      {template.triggerType === 'damage' && (
                        <label>
                          Below Percent (0-1)
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step="0.01"
                            value={template.belowPercent}
                            onChange={(event) =>
                              updateTemplateDraft(templateIndex, (current) => ({
                                ...current,
                                belowPercent: event.target.value,
                              }))
                            }
                          />
                        </label>
                      )}
                    </div>
                    {template.triggerType === 'effect' && (
                      <div className="admin-row" style={{ flexWrap: 'wrap' }}>
                        {ABILITY_EFFECT_TRIGGER_FAMILIES.map((family) => {
                          const selected = template.triggerFamilies.includes(family);
                          return (
                            <button
                              key={family}
                              type="button"
                              className={`secondary ${selected ? 'is-selected' : ''}`}
                              onClick={() =>
                                updateTemplateDraft(templateIndex, (current) => ({
                                  ...current,
                                  triggerFamilies: selected
                                    ? current.triggerFamilies.filter((entry) => entry !== family)
                                    : [...current.triggerFamilies, family],
                                }))
                              }
                            >
                              {family}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {renderEffectAttachmentEditor('Reward Proc', template.rewardEffectAttachment, (nextAttachment) =>
                      updateTemplateDraft(templateIndex, (current) => ({
                        ...current,
                        rewardEffectAttachment: nextAttachment,
                      })),
                    )}
                  </>
                )}
              </section>
            ))}
          </section>
          {!hasDraftChanges && selectedAbility && (
            <p className="admin-note">Draft matches the selected saved ability.</p>
          )}
        </section>
      </section>
    </section>
  );
}
