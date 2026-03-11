import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { fetchDuelCatalogContent, fetchDuelSquads, createDuelSquad, updateDuelSquad, deleteDuelSquad } from '@/duel/api';
import { createDuelBattleController, getRequiredLeadCount, getViableTargetsForSkill, getSkillTargetCount, buildElementMultiplierIndex, type DuelBattleController } from '@/duel/battleCore';
import {
  buildDuelCatalogIndexes,
  toDuelDraftFromSavedSquad,
  toSavedSquadPayload,
  type DuelSquadDraft,
} from '@/duel/squadSchema';
import { BattleTeamEditor } from '@/duel/components/BattleTeamEditor';
import type { DuelAction, DuelBattleFormat, DuelCatalogContent, DuelControlMode, DuelPhase, DuelSideId, DuelSquad } from '@/duel/types';
import type { DuelBattleCritterState } from '@/duel/types';
import type { CritterDefinition } from '@/game/critters/types';
import type { GameItemDefinition } from '@/game/items/types';
import type { EquipmentEffectDefinition } from '@/game/equipmentEffects/types';
import type { SkillDefinition, SkillEffectDefinition } from '@/game/skills/types';
import { ELEMENT_SKILL_COLORS, getSkillValueDisplayNumber } from '@/game/skills/types';
import type { CritterElement } from '@/game/critters/types';
import { MIN_BATTLE_STAT_MODIFIER } from '@/game/battle/damageAndEffects';
import { apiFetchJson } from '@/shared/apiClient';
import { setAuthToken } from '@/shared/authStorage';

type DuelRoute = 'menu' | 'edit-squads' | 'duel' | 'battle';

type AuthState = 'checking' | 'ok' | 'blocked';

type DraftActionKind = 'skill' | 'guard' | 'swap' | 'forfeit';

interface ActionDraft {
  kind: DraftActionKind;
  skillSlotIndex: number;
  targetMemberIndex: number;
  /** When present and non-empty, submission uses this; otherwise targetMemberIndex. */
  targetMemberIndices?: number[];
  benchMemberIndex: number;
}

interface DuelSessionResponse {
  ok: boolean;
  session?: {
    token: string;
    user: {
      id: string;
      email: string;
      displayName: string;
    };
  };
  error?: string;
}

function getDraftTargetIndices(
  draft: Pick<ActionDraft, 'targetMemberIndex' | 'targetMemberIndices'> | null | undefined,
): number[] {
  if (!draft) return [];
  if (Array.isArray(draft.targetMemberIndices)) {
    // Explicit array (including empty) is authoritative for in-progress targeting.
    return draft.targetMemberIndices;
  }
  return draft.targetMemberIndex !== undefined ? [draft.targetMemberIndex] : [];
}

const ACTION_KIND_LABELS: Record<DraftActionKind, string> = {
  skill: 'Skill',
  guard: 'Guard',
  swap: 'Swap',
  forfeit: 'Forfeit',
};

const BATTLE_HP_ANIMATION_MIN_MS = 120;
const BATTLE_HP_ANIMATION_MAX_MS = 1400;
const BATTLE_HP_ANIMATION_MS_PER_PERCENT = 16;

function calcDuelHpPercent(critter: { currentHp: number; maxHp: number } | null): number {
  if (!critter) return 0;
  const safeMax = Math.max(1, critter.maxHp);
  const safeCurrent = Math.max(0, Math.min(critter.currentHp, safeMax));
  return Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100));
}

function calcDuelHpAnimationMs(deltaPercent: number): number {
  const safeDelta = Math.max(0, deltaPercent);
  if (safeDelta <= 0) return 0;
  const rawDuration = Math.round(BATTLE_HP_ANIMATION_MIN_MS + safeDelta * BATTLE_HP_ANIMATION_MS_PER_PERCENT);
  return Math.max(BATTLE_HP_ANIMATION_MIN_MS, Math.min(BATTLE_HP_ANIMATION_MAX_MS, rawDuration));
}
const BATTLE_PHASE_LABELS: Record<DuelPhase, string> = {
  'choose-leads': 'Choose Leads',
  'choose-actions': 'Choose Actions',
  'resolving-turn': 'Resolving Turn',
  'choose-replacements': 'Choose Replacements',
  finished: 'Battle Complete',
};

function getContrastTextForColor(input: string): '#102131' | '#f4fbff' {
  const value = input.trim().replace('#', '');
  const normalized = value.length === 3 ? value.split('').map((entry) => `${entry}${entry}`).join('') : value;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return '#102131';
  }
  const parsed = Number.parseInt(normalized, 16);
  const red = (parsed >> 16) & 0xff;
  const green = (parsed >> 8) & 0xff;
  const blue = parsed & 0xff;
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness >= 150 ? '#102131' : '#f4fbff';
}

/** Build icons bucket root from any Supabase storage URL (same as GameView) – element logos live in "icons" bucket. */
function buildIconsBucketRootFromSupabaseUrl(supabaseAssetUrl: string): string | null {
  try {
    const url = new URL(supabaseAssetUrl);
    const marker = '/storage/v1/object/public/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex >= 0) {
      url.pathname = url.pathname.substring(0, markerIndex) + marker + 'icons';
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    // ignore
  }
  return null;
}

function buildElementLogoUrlFromIconsBucket(element: string, iconsBucketRoot: string | null): string | null {
  if (!iconsBucketRoot) return null;
  const el = (element ?? '').toString().trim().toLowerCase();
  if (!el) return null;
  return `${iconsBucketRoot}/${encodeURIComponent(`${el}-element.png`)}`;
}

function getDuelIconsBucketRoot(catalogs: DuelCatalogContent): string | null {
  for (const c of catalogs.critters) {
    if (c.spriteUrl && c.spriteUrl.startsWith('http')) {
      const root = buildIconsBucketRootFromSupabaseUrl(c.spriteUrl);
      if (root) return root;
    }
  }
  for (const e of catalogs.skillEffects) {
    if (e.iconUrl && e.iconUrl.startsWith('http')) {
      const root = buildIconsBucketRootFromSupabaseUrl(e.iconUrl);
      if (root) return root;
    }
  }
  try {
    const envUrl = (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_SUPABASE_URL?: string } }).env?.VITE_SUPABASE_URL) as string | undefined;
    const base = typeof envUrl === 'string' && envUrl.trim() ? envUrl.trim().replace(/\/+$/, '') : null;
    if (base && base.startsWith('http')) {
      return `${base}/storage/v1/object/public/icons`;
    }
  } catch {
    // ignore
  }
  return null;
}

function getSkillEffectIconUrlsForDuel(skill: SkillDefinition, catalogs: DuelCatalogContent): string[] {
  const effectById = new Map(
    catalogs.skillEffects.map((e) => [e.effect_id.trim().toLowerCase(), e] as const),
  );
  const attachments =
    Array.isArray(skill.effectAttachments) && skill.effectAttachments.length > 0
      ? skill.effectAttachments
      : (skill.effectIds ?? []).map((effectId) => ({ effectId, procChance: 1, buffPercent: 0.1 }));
  return attachments
    .map((a) => {
      const id = (a.effectId ?? '').toString().trim().toLowerCase();
      return effectById.get(id)?.iconUrl;
    })
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
}

function formatDuelSkillHealImmediate(skill: Pick<SkillDefinition, 'healMode' | 'healValue'>): string | null {
  if (!skill.healMode || skill.healValue == null) return null;
  if (skill.healMode === 'flat') return `Heals: ${Math.max(1, Math.floor(skill.healValue))} HP after use`;
  if (skill.healMode === 'percent_damage') return `Heals: ${Math.round(skill.healValue * 100)}% of damage dealt`;
  return `Heals: ${Math.round(skill.healValue * 100)}% HP after use`;
}

function formatDuelSkillHealPersistent(
  skill: Pick<SkillDefinition, 'persistentHealMode' | 'persistentHealValue' | 'persistentHealDurationTurns'>,
): string | null {
  if (!skill.persistentHealMode || skill.persistentHealValue == null || skill.persistentHealDurationTurns == null) return null;
  if (skill.persistentHealMode === 'flat') {
    return `End of turn: ${Math.max(1, Math.floor(skill.persistentHealValue))} HP for ${Math.max(1, Math.floor(skill.persistentHealDurationTurns))} turns`;
  }
  return `End of turn: ${Math.round(skill.persistentHealValue * 100)}% HP for ${Math.max(1, Math.floor(skill.persistentHealDurationTurns))} turns`;
}

function buildDuelSkillTooltip(skill: SkillDefinition, catalogs: DuelCatalogContent): string {
  const lines = [
    skill.skill_name,
    `${skill.type === 'damage' ? 'Damage' : 'Support'} • ${skill.element} • Priority ${Math.max(1, Math.floor(skill.priority ?? 1))}`,
  ];
  if (skill.type === 'damage' && skill.damage != null) {
    lines.push(`Power: ${skill.damage}`);
  }
  const immediate = formatDuelSkillHealImmediate(skill);
  if (immediate) lines.push(immediate);
  const persistent = formatDuelSkillHealPersistent(skill);
  if (persistent) lines.push(persistent);
  const effectById = new Map(catalogs.skillEffects.map((e) => [e.effect_id, e] as const));
  const attachments =
    Array.isArray(skill.effectAttachments) && skill.effectAttachments.length > 0
      ? skill.effectAttachments
      : (skill.effectIds ?? []).map((effectId) => ({
          effectId,
          procChance: 1,
          buffPercent: 0.1,
          recoilPercent: 0.1,
          recoilMode: 'percent_max_hp' as const,
        }));
  for (const attachment of attachments) {
    const effect = effectById.get(attachment.effectId);
    const procLabel = Math.round((attachment.procChance ?? 1) * 100);
    if (!effect) {
      lines.push(`Effect: ${attachment.effectId} (${procLabel}% chance)`);
      continue;
    }
    const desc = typeof effect.description === 'string' ? effect.description.trim() : '';
    if (desc) {
      const buffLabel = Math.round(((attachment.buffPercent ?? effect.buffPercent ?? 0.1) ?? 0) * 100);
      const recoilLabel = Math.round(((attachment as { recoilPercent?: number }).recoilPercent ?? 0.1) * 100);
      const recoilModeLabel = (attachment as { recoilMode?: string }).recoilMode === 'percent_damage_dealt' ? 'damage dealt' : 'max HP';
      const text = desc
        .replace(/<buff>/g, String(buffLabel))
        .replace(/<recoil>/g, String(recoilLabel))
        .replace(/<mode>/g, recoilModeLabel);
      lines.push(`Effect: ${text} (${procLabel}% chance)`);
    } else {
      lines.push(`Effect: ${effect.effect_name} (${procLabel}% chance)`);
    }
  }
  return lines.join('\n');
}

function summarizeDuelEquipmentEffect(effect: EquipmentEffectDefinition): string {
  const description = typeof effect.description === 'string' ? effect.description.trim() : '';
  if (description) {
    return description;
  }
  const modifiers = Array.isArray(effect.modifiers) ? effect.modifiers : [];
  if (modifiers.length <= 0) {
    return effect.effect_name || effect.effect_id;
  }
  return modifiers
    .map((modifier) => {
      const statLabel = modifier.stat === 'attack'
        ? 'ATK'
        : modifier.stat === 'defense'
          ? 'DEF'
          : modifier.stat === 'speed'
            ? 'SPD'
            : 'HP';
      if (modifier.mode === 'percent') {
        const value = Math.round(modifier.value * 100);
        return `${value >= 0 ? '+' : ''}${value}% ${statLabel}`;
      }
      const value = Math.round(modifier.value);
      return `${value >= 0 ? '+' : ''}${value} ${statLabel}`;
    })
    .join(', ');
}

function getItemEquipmentTooltip(
  item: GameItemDefinition | undefined,
  fallbackItemId: string,
  equipmentEffectById: Map<string, EquipmentEffectDefinition>,
): string {
  if (!item) {
    return fallbackItemId;
  }
  const lines = [item.name];
  const effectConfig = item.effectConfig as { equipmentEffectIds?: string[] } | null | undefined;
  const equipmentEffectIds = Array.isArray(effectConfig?.equipmentEffectIds)
    ? effectConfig.equipmentEffectIds
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];
  if (equipmentEffectIds.length <= 0) {
    lines.push('Effect: None');
    return lines.join('\n');
  }
  const seen = new Set<string>();
  equipmentEffectIds.forEach((effectId) => {
    const normalized = effectId.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    const effect = equipmentEffectById.get(normalized);
    if (!effect) {
      lines.push(`Effect: ${normalized}`);
      return;
    }
    const effectName = effect.effect_name?.trim() || normalized;
    const summary = summarizeDuelEquipmentEffect(effect);
    if (summary && summary !== effectName) {
      lines.push(`Effect: ${effectName} - ${summary}`);
      return;
    }
    lines.push(`Effect: ${effectName}`);
  });
  return lines.join('\n');
}

function getDuelCritterEquippedItemsForDisplay(
  critter: DuelBattleCritterState,
  itemById: Map<string, GameItemDefinition>,
  equipmentItemByName: Map<string, GameItemDefinition>,
): GameItemDefinition[] {
  const resolved: GameItemDefinition[] = [];
  const seen = new Set<string>();

  (critter.equippedItemIds ?? []).forEach((itemId) => {
    const item = itemById.get(itemId);
    if (!item || item.category !== 'equipment' || seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    resolved.push(item);
  });

  // Back-compat fallback: derive items from effect source names when item IDs are not present.
  if (resolved.length <= 0) {
    Object.values(critter.equipmentEffectSourceById ?? {}).forEach((sourceName) => {
      const normalizedName = (typeof sourceName === 'string' ? sourceName : '').trim().toLowerCase();
      if (!normalizedName) {
        return;
      }
      const item = equipmentItemByName.get(normalizedName);
      if (!item || seen.has(item.id)) {
        return;
      }
      seen.add(item.id);
      resolved.push(item);
    });
  }

  return resolved;
}

function formatBattleStatDisplay(value: number): string {
  if (!Number.isFinite(value)) {
    return '1';
  }
  const rounded = Math.round(Math.max(1, value) * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.000_01) {
    return String(Math.round(rounded));
  }
  return String(rounded);
}

function summarizeStackedSkillEffectTotal(
  effect: Pick<SkillEffectDefinition, 'effect_type'>,
  stackedValue: number,
): string | null {
  if (!Number.isFinite(stackedValue) || Math.abs(stackedValue) <= 0) {
    return null;
  }
  const statLabel = effect.effect_type.includes('atk')
    ? 'ATK'
    : effect.effect_type.includes('def')
      ? 'DEF'
      : effect.effect_type.includes('speed')
        ? 'SPD'
        : null;
  const isDebuff = effect.effect_type.includes('debuff');
  const magnitude = Math.round(Math.abs(stackedValue) * 100);
  if (magnitude <= 0) {
    return null;
  }
  if (statLabel) {
    return `Total stacked: ${isDebuff ? '-' : '+'}${magnitude}% ${statLabel}`;
  }
  return `Total stacked: ${isDebuff ? '-' : '+'}${magnitude}%`;
}

/** Build parallel arrays of effect icon URLs and tooltips for a duel critter (buffs/debuffs + equipment). */
function getDuelCritterEffectIconsAndTooltips(
  critter: DuelBattleCritterState | null,
  catalogs: DuelCatalogContent,
): { iconUrls: string[]; tooltips: string[] } {
  const iconUrls: string[] = [];
  const tooltips: string[] = [];
  if (!critter) return { iconUrls, tooltips };
  const skillEffectById = new Map(catalogs.skillEffects.map((e) => [e.effect_id, e] as const));
  const equipmentEffectById = new Map(catalogs.equipmentEffects.map((e) => [e.effect_id, e] as const));
  const equipmentIds = critter.equipmentEffectIds ?? [];
  const activeIds = critter.activeEffectIds ?? [];
  const seen = new Set<string>();
  const sourceById = { ...(critter.equipmentEffectSourceById ?? {}), ...(critter.activeEffectSourceById ?? {}) };
  const valueById = critter.activeEffectValueById ?? {};
  for (const id of [...equipmentIds, ...activeIds]) {
    const normalized = id?.trim?.();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    const sourceName = sourceById[normalized] ?? 'Unknown';
    const skillEffect = skillEffectById.get(normalized);
    if (skillEffect) {
      const url = skillEffect.iconUrl?.trim();
      if (url) {
        iconUrls.push(url);
        const buffPercent = typeof valueById[normalized] === 'number' ? valueById[normalized] : (skillEffect.buffPercent ?? 0.1);
        const desc = typeof skillEffect.description === 'string' ? skillEffect.description.trim() : '';
        const label = desc
          ? desc.replace(/<buff>/g, String(Math.round(buffPercent * 100)))
            .replace(/<recoil>/g, String(Math.round((buffPercent) * 100)))
            .replace(/<mode>/g, 'max HP')
          : skillEffect.effect_name;
        const stackSummary = summarizeStackedSkillEffectTotal(skillEffect, buffPercent);
        tooltips.push(stackSummary ? `${label} (${sourceName})\n${stackSummary}` : `${label} (${sourceName})`);
      }
      continue;
    }
    const equipmentEffect = equipmentEffectById.get(normalized);
    if (equipmentEffect) {
      const url = equipmentEffect.iconUrl?.trim();
      if (url) {
        iconUrls.push(url);
        const summary = equipmentEffect.description?.trim() || equipmentEffect.effect_name || normalized;
        tooltips.push(`${summary} (${sourceName})`);
      }
    }
  }
  return { iconUrls, tooltips };
}

function toDuelPath(route: DuelRoute): string {
  if (route === 'menu') return '/simulation';
  if (route === 'edit-squads') return '/simulation/edit-squads';
  if (route === 'duel') return '/simulation/duel';
  return '/simulation/battle';
}

function parseDuelRoute(pathname: string): DuelRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/simulation';
  if (
    normalized === '/simulation' ||
    normalized === '/simulation.html' ||
    normalized === '/duel' ||
    normalized === '/duel.html'
  ) {
    return 'menu';
  }
  if (normalized === '/simulation/edit-squads' || normalized === '/duel/edit-squads') {
    return 'edit-squads';
  }
  if (normalized === '/simulation/duel' || normalized === '/duel/duel') {
    return 'duel';
  }
  if (normalized === '/simulation/battle' || normalized === '/duel/battle') {
    return 'battle';
  }
  return 'menu';
}

function toControlMode(value: string): DuelControlMode {
  return value === 'random-agent' ? 'random-agent' : 'human';
}

function pickRandomAction<T>(values: T[]): T | null {
  if (values.length <= 0) {
    return null;
  }
  const index = Math.max(0, Math.min(values.length - 1, Math.floor(Math.random() * values.length)));
  return values[index] ?? null;
}

export function DuelApp() {
  const [route, setRoute] = useState<DuelRoute>(() => parseDuelRoute(window.location.pathname));
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [email, setEmail] = useState('playwrite@crittera.com');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [catalogs, setCatalogs] = useState<DuelCatalogContent | null>(null);
  const [squads, setSquads] = useState<DuelSquad[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(null);
  const [squadSearchInput, setSquadSearchInput] = useState('');
  const [draft, setDraft] = useState<DuelSquadDraft | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);
  const [isReorderingSquads, setIsReorderingSquads] = useState(false);

  const [duelFormat, setDuelFormat] = useState<DuelBattleFormat>('singles');
  const [sideControlMode, setSideControlMode] = useState<Record<DuelSideId, DuelControlMode>>({
    player: 'human',
    opponent: 'random-agent',
  });
  const [playerSquadId, setPlayerSquadId] = useState<string>('');
  const [opponentSquadId, setOpponentSquadId] = useState<string>('');

  const [battleController, setBattleController] = useState<DuelBattleController | null>(null);
  const [battleTick, setBattleTick] = useState(0);
  const [leadDraftBySide, setLeadDraftBySide] = useState<Record<DuelSideId, number[]>>({ player: [], opponent: [] });
  const [replacementDraftBySide, setReplacementDraftBySide] = useState<Record<DuelSideId, number[]>>({ player: [], opponent: [] });
  const [actionDraftBySide, setActionDraftBySide] = useState<Record<DuelSideId, Record<number, ActionDraft>>>({
    player: {},
    opponent: {},
  });
  const [battleErrorMessage, setBattleErrorMessage] = useState<string | null>(null);
  const [battleNarrationQueue, setBattleNarrationQueue] = useState<string[]>([]);
  const [turnNarrationActive, setTurnNarrationActive] = useState(false);
  const [animatingAttack, setAnimatingAttack] = useState<{
    actorSide: DuelSideId;
    actorMemberIndex: number;
    targetSide: DuelSideId;
    targetMemberIndex: number;
    targetMemberIndices?: number[];
  } | null>(null);
  const [animatingKnockout, setAnimatingKnockout] = useState<{ side: DuelSideId; memberIndex: number } | null>(null);
  const [animatingEntry, setAnimatingEntry] = useState<Array<{ side: DuelSideId; memberIndex: number }>>([]);
  /** When set, replacement is not applied yet; show "sending in" then apply on next click. */
  const [pendingReplacementSubmission, setPendingReplacementSubmission] = useState<{
    player: number[] | null;
    opponent: number[] | null;
  }>({ player: null, opponent: null });
  const battleNarrationLogCursorRef = useRef(0);
  const animatingAttackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narrationHoldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvingTurnInitialAdvanceRef = useRef(false);
  const knockoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPhaseRef = useRef<DuelPhase | null>(null);
  /** When true, defer pushing new narration lines by one frame so the board (e.g. swap sprites) paints first. */
  const deferNarrationUntilAfterPaintRef = useRef(false);
  /** Opponent replacement picks for auto-apply timeout (no click required). */
  const opponentReplacementAutoApplyRef = useRef<number[] | null>(null);
  const opponentReplacementAutoApplyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const catalogIndexes = useMemo(() => (catalogs ? buildDuelCatalogIndexes(catalogs) : null), [catalogs]);

  const resolveContext = useMemo(() => {
    if (!catalogs) return null;
    const indexes = buildDuelCatalogIndexes(catalogs);
    return {
      indexes,
      elementChart: catalogs.elementChart,
      elementMultiplierByPair: buildElementMultiplierIndex(catalogs.elementChart),
      rng: () => Math.random(),
    };
  }, [catalogs]);

  const [pendingTargetSelection, setPendingTargetSelection] = useState<{
    side: DuelSideId;
    actorMemberIndex: number;
    skillSlotIndex: number;
  } | null>(null);
  const [boardTargetSelectionContext, setBoardTargetSelectionContext] = useState<{
    side: DuelSideId;
    actorMemberIndex: number;
    skillSlotIndex: number;
  } | null>(null);

  const filteredSquads = useMemo(() => {
    const query = squadSearchInput.trim().toLowerCase();
    if (!query) {
      return squads;
    }
    return squads.filter((squad) => squad.name.toLowerCase().includes(query));
  }, [squadSearchInput, squads]);
  const squadOrderById = useMemo(() => {
    const index = new Map<string, number>();
    sortDuelSquads([...squads]).forEach((entry, orderIndex) => {
      index.set(entry.id, orderIndex);
    });
    return index;
  }, [squads]);

  const selectedSquad = useMemo(
    () => (selectedSquadId ? squads.find((entry) => entry.id === selectedSquadId) ?? null : null),
    [selectedSquadId, squads],
  );

  const draftValidation = useMemo(() => {
    if (!draft || !catalogIndexes) {
      return null;
    }
    return toSavedSquadPayload(draft, catalogIndexes);
  }, [draft, catalogIndexes]);
  const validationIssuesByPath = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!draftValidation || draftValidation.ok) {
      return map;
    }
    draftValidation.issues.forEach((issue) => {
      const existing = map.get(issue.path) ?? [];
      existing.push(issue.message);
      map.set(issue.path, existing);
    });
    return map;
  }, [draftValidation]);

  const selectedPlayerSquad = useMemo(
    () => squads.find((entry) => entry.id === playerSquadId) ?? null,
    [playerSquadId, squads],
  );
  const selectedOpponentSquad = useMemo(
    () => squads.find((entry) => entry.id === opponentSquadId) ?? null,
    [opponentSquadId, squads],
  );

  const minRequiredMembers = getRequiredLeadCount(duelFormat);
  const duelReady =
    Boolean(selectedPlayerSquad) &&
    Boolean(selectedOpponentSquad) &&
    (selectedPlayerSquad?.members.length ?? 0) >= minRequiredMembers &&
    (selectedOpponentSquad?.members.length ?? 0) >= minRequiredMembers;

  const battleState = battleController?.state ?? null;
  const battleNarrationVisible = Boolean(
    battleState && (battleState.phase === 'resolving-turn' || turnNarrationActive || battleNarrationQueue.length > 0),
  );
  const latestBattleLogText =
    battleState && battleState.logs.length > 0 ? battleState.logs[battleState.logs.length - 1]?.text ?? '' : '';
  const battleNarrationText =
    battleNarrationQueue[0] ??
    (battleState?.phase === 'resolving-turn'
      ? latestBattleLogText
      : battleState?.phase === 'choose-replacements' && pendingReplacementSubmission.player !== null
        ? 'Click to send in.'
        : '');
  /** Only allow click-through when there is real text to show or advance to (no "…" or blank fillers). */
  const narrationPlaybackActive =
    Boolean(battleState?.phase === 'resolving-turn') ||
    Boolean(
      battleState?.phase === 'choose-replacements' &&
        (battleNarrationQueue.length > 0 || pendingReplacementSubmission.player !== null),
    );

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseDuelRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    const canonicalPath = toDuelPath(route);
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({}, '', canonicalPath);
    }
  }, [route]);

  useEffect(() => {
    let mounted = true;
    const verify = async () => {
      try {
        const result = await apiFetchJson<DuelSessionResponse>('/api/auth/session');
        if (!mounted) {
          return;
        }
        if (result.ok && result.data?.session?.token) {
          setAuthState('ok');
        } else {
          setAuthState('blocked');
        }
      } catch {
        if (!mounted) return;
        setAuthState('blocked');
      }
    };
    void verify();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (authState !== 'ok') {
      return;
    }
    let mounted = true;
    const load = async () => {
      setIsLoadingData(true);
      setDataError(null);
      try {
        const [loadedCatalogs, loadedSquads] = await Promise.all([fetchDuelCatalogContent(), fetchDuelSquads()]);
        if (!mounted) {
          return;
        }
        setCatalogs(loadedCatalogs);
        setSquads(sortDuelSquads(loadedSquads));
        if (loadedSquads.length > 0) {
          setSelectedSquadId((current) => current ?? loadedSquads[0].id);
          setPlayerSquadId((current) => current || loadedSquads[0].id);
          setOpponentSquadId((current) => current || loadedSquads[Math.min(1, loadedSquads.length - 1)].id);
        } else {
          setSelectedSquadId(null);
          setPlayerSquadId('');
          setOpponentSquadId('');
        }
      } catch (error) {
        if (!mounted) {
          return;
        }
        setDataError(error instanceof Error ? error.message : 'Unable to load Duel Simulator data.');
      } finally {
        if (mounted) {
          setIsLoadingData(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [authState]);

  useEffect(() => {
    if (!selectedSquad) {
      return;
    }
    setDraft((current) => {
      if (current?.id === selectedSquad.id) {
        return current;
      }
      return toDuelDraftFromSavedSquad(selectedSquad);
    });
    setSaveMessage(null);
  }, [selectedSquad]);

  useEffect(() => {
    if (!battleState || !battleController) {
      return;
    }
    const randomSides = (['player', 'opponent'] as const).filter((side) => sideControlMode[side] === 'random-agent');
    if (randomSides.length <= 0) {
      return;
    }

    let didUpdate = false;

    if (battleState.phase === 'choose-leads') {
      for (const side of randomSides) {
        const sideState = side === 'player' ? battleState.player : battleState.opponent;
        if (sideState.pendingLeadSelection !== null) {
          continue;
        }
        const pick = battleController.chooseRandomLeadSelection(side);
        const result = battleController.submitLeadSelection(side, pick);
        if (!result.ok) {
          continue;
        }
        didUpdate = true;
      }
    } else if (battleState.phase === 'choose-actions') {
      for (const side of randomSides) {
        const sideState = side === 'player' ? battleState.player : battleState.opponent;
        if (sideState.pendingActions !== null) {
          continue;
        }
        const required = getRequiredLeadCount(battleState.format);
        const requiredActors = sideState.activeMemberIndices
          .filter((memberIndex) => {
            const critter = sideState.team[memberIndex];
            return Boolean(critter && !critter.fainted && critter.currentHp > 0);
          })
          .slice(0, required);
        const actions: DuelAction[] = [];
        for (const actorMemberIndex of requiredActors) {
          const legalActions = battleController.listLegalActionsForActor(side, actorMemberIndex, true);
          const skillActions = legalActions.filter(
            (action): action is Extract<DuelAction, { kind: 'skill' }> => action.kind === 'skill',
          );
          const selectedSkill = pickRandomAction(skillActions);
          if (selectedSkill) {
            actions.push(selectedSkill);
            continue;
          }
          const fallbackForfeit = legalActions.find(
            (action): action is Extract<DuelAction, { kind: 'forfeit' }> => action.kind === 'forfeit',
          );
          if (fallbackForfeit) {
            actions.push(fallbackForfeit);
          }
        }
        const result = battleController.submitActions({ side, actions });
        if (!result.ok) {
          continue;
        }
        didUpdate = true;
      }
    } else if (battleState.phase === 'choose-replacements') {
      for (const side of randomSides) {
        const sideState = side === 'player' ? battleState.player : battleState.opponent;
        if (sideState.pendingReplacements !== null) {
          continue;
        }
        if (pendingReplacementSubmission[side] !== null) {
          continue;
        }
        const replacements = battleController.chooseRandomReplacements(side);
        const result = battleController.submitReplacementSelection(side, replacements);
        if (!result.ok) {
          continue;
        }
        didUpdate = true;
        if (replacements.length > 0) {
          const entries = replacements.map((memberIndex) => ({ side, memberIndex }));
          setAnimatingEntry((prev) => [...prev, ...entries]);
          if (entryTimeoutRef.current !== null) {
            clearTimeout(entryTimeoutRef.current);
          }
          entryTimeoutRef.current = setTimeout(() => {
            entryTimeoutRef.current = null;
            setAnimatingEntry((prev) =>
              prev.filter((p) => !entries.some((entry) => entry.side === p.side && entry.memberIndex === p.memberIndex)),
            );
          }, 340);
        }
      }
    }

    if (didUpdate) {
      setBattleErrorMessage(null);
      setBattleTick((value) => value + 1);
    }
  }, [
    battleController,
    battleState,
    battleTick,
    pendingReplacementSubmission.player,
    pendingReplacementSubmission.opponent,
    sideControlMode.player,
    sideControlMode.opponent,
  ]);

  useEffect(() => {
    if (!battleState) {
      if (battleNarrationQueue.length > 0) {
        setBattleNarrationQueue([]);
      }
      if (turnNarrationActive) {
        setTurnNarrationActive(false);
      }
      battleNarrationLogCursorRef.current = 0;
      return;
    }
    if (battleState.phase !== 'choose-replacements' && (pendingReplacementSubmission.player !== null || pendingReplacementSubmission.opponent !== null)) {
      setPendingReplacementSubmission({ player: null, opponent: null });
    }
    if (battleState?.phase !== 'choose-replacements') {
      if (opponentReplacementAutoApplyTimeoutRef.current !== null) {
        clearTimeout(opponentReplacementAutoApplyTimeoutRef.current);
        opponentReplacementAutoApplyTimeoutRef.current = null;
        opponentReplacementAutoApplyRef.current = null;
      }
    }
    if (battleState.phase === 'resolving-turn' && !turnNarrationActive) {
      setTurnNarrationActive(true);
    }
  }, [
    battleState?.phase,
    turnNarrationActive,
    battleNarrationQueue.length,
    pendingReplacementSubmission.player,
    pendingReplacementSubmission.opponent,
    battleTick,
  ]);

  useEffect(() => {
    if (battleState?.phase !== 'resolving-turn') {
      if (animatingAttackTimeoutRef.current !== null) {
        clearTimeout(animatingAttackTimeoutRef.current);
        animatingAttackTimeoutRef.current = null;
      }
      setAnimatingAttack(null);
      if (battleState?.phase !== 'choose-replacements') {
        setTurnNarrationActive(false);
      }
      if (knockoutTimeoutRef.current !== null) {
        clearTimeout(knockoutTimeoutRef.current);
        knockoutTimeoutRef.current = null;
      }
      setAnimatingKnockout(null);
    }
  }, [battleState?.phase]);

  useEffect(() => {
    if (!battleState) return;
    const phase = battleState.phase;
    if (phase === 'choose-actions' && previousPhaseRef.current === 'choose-leads') {
      const entries: Array<{ side: DuelSideId; memberIndex: number }> = [];
      battleState.player.activeMemberIndices.forEach((memberIndex) => entries.push({ side: 'player', memberIndex }));
      battleState.opponent.activeMemberIndices.forEach((memberIndex) => entries.push({ side: 'opponent', memberIndex }));
      if (entries.length > 0) {
        setAnimatingEntry((prev) => [...prev, ...entries]);
        if (entryTimeoutRef.current !== null) clearTimeout(entryTimeoutRef.current);
        entryTimeoutRef.current = setTimeout(() => {
          entryTimeoutRef.current = null;
          setAnimatingEntry((prev) => prev.filter((p) => !entries.some((e) => e.side === p.side && e.memberIndex === p.memberIndex)));
        }, 340);
      }
    }
    previousPhaseRef.current = phase;
  }, [battleState?.phase, battleState?.player?.activeMemberIndices, battleState?.opponent?.activeMemberIndices]);

  useEffect(() => {
    if (battleState?.phase !== 'choose-actions') {
      setPendingTargetSelection(null);
      setBoardTargetSelectionContext(null);
    }
  }, [battleState?.phase]);

  useEffect(() => {
    if (battleState?.phase !== 'resolving-turn') {
      resolvingTurnInitialAdvanceRef.current = false;
      return;
    }
    if (!battleController || !battleState.turnResolution) return;
    const { nextActionIndex, queue } = battleState.turnResolution;
    if (nextActionIndex !== 0 || queue.length === 0) return;
    if (resolvingTurnInitialAdvanceRef.current) return;
    resolvingTurnInitialAdvanceRef.current = true;
    const result = battleController.advanceTurnResolution();
    if (!result.ok) {
      resolvingTurnInitialAdvanceRef.current = false;
      setBattleErrorMessage(result.error ?? 'Unable to resolve the next action.');
      return;
    }
    setBattleErrorMessage(null);
    setBattleTick((value) => value + 1);
    const entry = result.executedEntry;
    if (entry && entry.action.kind === 'skill') {
      const targetSide: DuelSideId = entry.side === 'player' ? 'opponent' : 'player';
      const targetIndices = entry.action.targetMemberIndices?.length ? entry.action.targetMemberIndices : [entry.action.targetMemberIndex];
      setAnimatingAttack({
        actorSide: entry.side,
        actorMemberIndex: entry.action.actorMemberIndex,
        targetSide,
        targetMemberIndex: targetIndices[0] ?? entry.action.targetMemberIndex,
        targetMemberIndices: targetIndices.length > 1 ? targetIndices : undefined,
      });
      if (animatingAttackTimeoutRef.current !== null) clearTimeout(animatingAttackTimeoutRef.current);
      animatingAttackTimeoutRef.current = setTimeout(() => {
        animatingAttackTimeoutRef.current = null;
        setAnimatingAttack(null);
      }, 400);
    }
    if (result.knockout) {
      if (knockoutTimeoutRef.current !== null) clearTimeout(knockoutTimeoutRef.current);
      setAnimatingKnockout(result.knockout);
      knockoutTimeoutRef.current = setTimeout(() => {
        knockoutTimeoutRef.current = null;
        setAnimatingKnockout(null);
      }, 520);
    }
    if (result.swapOccurred) {
      deferNarrationUntilAfterPaintRef.current = true;
      if (entryTimeoutRef.current !== null) clearTimeout(entryTimeoutRef.current);
      setAnimatingEntry((prev) => [...prev, result.swapOccurred!]);
      entryTimeoutRef.current = setTimeout(() => {
        entryTimeoutRef.current = null;
        setAnimatingEntry((prev) => prev.filter((e) => e.side !== result.swapOccurred!.side || e.memberIndex !== result.swapOccurred!.memberIndex));
      }, 340);
    }
  }, [battleState?.phase, battleState?.turnResolution?.nextActionIndex, battleState?.turnResolution?.queue?.length, battleController]);

  useEffect(() => {
    return () => {
      if (animatingAttackTimeoutRef.current !== null) {
        clearTimeout(animatingAttackTimeoutRef.current);
        animatingAttackTimeoutRef.current = null;
      }
      if (narrationHoldTimeoutRef.current !== null) {
        clearTimeout(narrationHoldTimeoutRef.current);
        narrationHoldTimeoutRef.current = null;
      }
      if (knockoutTimeoutRef.current !== null) {
        clearTimeout(knockoutTimeoutRef.current);
        knockoutTimeoutRef.current = null;
      }
      if (entryTimeoutRef.current !== null) {
        clearTimeout(entryTimeoutRef.current);
        entryTimeoutRef.current = null;
      }
      if (opponentReplacementAutoApplyTimeoutRef.current !== null) {
        clearTimeout(opponentReplacementAutoApplyTimeoutRef.current);
        opponentReplacementAutoApplyTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!battleState) {
      return;
    }
    const shouldCaptureNarration = battleState.phase === 'resolving-turn' || turnNarrationActive;
    if (!shouldCaptureNarration) {
      battleNarrationLogCursorRef.current = battleState.logs.length;
      return;
    }
    const cursor = Math.max(0, Math.min(battleNarrationLogCursorRef.current, battleState.logs.length));
    if (battleState.logs.length <= cursor) {
      return;
    }
    const newNarrationLines = battleState.logs.slice(cursor).map((entry) => entry.text);
    if (newNarrationLines.length === 0) {
      return;
    }
    if (deferNarrationUntilAfterPaintRef.current) {
      deferNarrationUntilAfterPaintRef.current = false;
      const nextCursor = battleState.logs.length;
      requestAnimationFrame(() => {
        battleNarrationLogCursorRef.current = nextCursor;
        setBattleNarrationQueue((current) => [...current, ...newNarrationLines]);
      });
      return;
    }
    battleNarrationLogCursorRef.current = battleState.logs.length;
    setBattleNarrationQueue((current) => [...current, ...newNarrationLines]);
  }, [battleState, battleTick, turnNarrationActive]);

  useEffect(() => {
    if (!battleState) {
      return;
    }
    if (battleState.phase === 'resolving-turn') {
      return;
    }
    if (turnNarrationActive && battleNarrationQueue.length === 0) {
      setTurnNarrationActive(false);
    }
  }, [battleState?.phase, turnNarrationActive, battleNarrationQueue.length, battleTick]);

  useEffect(() => {
    if (!battleState || battleState.phase !== 'choose-actions') return;
    setBattleNarrationQueue([]);
    setTurnNarrationActive(false);
    battleNarrationLogCursorRef.current = battleState.logs.length;
  }, [battleState?.phase, battleState?.logs.length]);

  const pendingInputSide: DuelSideId | null = (() => {
    if (!battleState) {
      return null;
    }
    if (battleState.phase === 'choose-leads') {
      if (!battleState.player.pendingLeadSelection) return 'player';
      if (!battleState.opponent.pendingLeadSelection) return 'opponent';
      return null;
    }
    if (battleState.phase === 'choose-actions') {
      if (!battleState.player.pendingActions) return 'player';
      if (!battleState.opponent.pendingActions) return 'opponent';
      return null;
    }
    if (battleState.phase === 'choose-replacements') {
      if (battleState.player.pendingReplacements === null) return 'player';
      if (battleState.opponent.pendingReplacements === null) return 'opponent';
      return null;
    }
    return null;
  })();

  const pendingInputSideControlMode = pendingInputSide ? sideControlMode[pendingInputSide] : null;

  useEffect(() => {
    if (!battleState) {
      return;
    }
    if (battleState.phase !== 'choose-actions') {
      return;
    }
    setActionDraftBySide((current) => {
      let changed = false;
      const next: Record<DuelSideId, Record<number, ActionDraft>> = {
        player: battleState.player.pendingActions === null ? {} : { ...(current.player ?? {}) },
        opponent: battleState.opponent.pendingActions === null ? {} : { ...(current.opponent ?? {}) },
      };

      (['player', 'opponent'] as const).forEach((side) => {
        const sideState = side === 'player' ? battleState.player : battleState.opponent;
        const requiredActors = sideState.activeMemberIndices.filter((memberIndex) => {
          const critter = sideState.team[memberIndex];
          return Boolean(critter && !critter.fainted && critter.currentHp > 0);
        });
        const allowed = new Set(requiredActors);
        const existing = next[side];
        Object.keys(existing).forEach((key) => {
          const actorMemberIndex = Number.parseInt(key, 10);
          if (!allowed.has(actorMemberIndex)) {
            delete existing[actorMemberIndex];
          }
        });

        const previousKeys = Object.keys(current[side] ?? {}).sort().join(',');
        const nextKeys = Object.keys(existing).sort().join(',');
        if (previousKeys !== nextKeys) {
          changed = true;
        }
      });

      if (
        battleState.player.pendingActions === null &&
        Object.keys(current.player ?? {}).length > 0
      ) {
        changed = true;
      }
      if (
        battleState.opponent.pendingActions === null &&
        Object.keys(current.opponent ?? {}).length > 0
      ) {
        changed = true;
      }

      return changed ? next : current;
    });
  }, [battleState, battleTick]);

  const onNavigate = (nextRoute: DuelRoute) => {
    const nextPath = toDuelPath(nextRoute);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setRoute(nextRoute);
  };

  const onSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setStatusMessage('Email and password are required.');
      return;
    }

    setIsSigningIn(true);
    setStatusMessage(null);
    try {
      const result = await apiFetchJson<DuelSessionResponse>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });
      if (!result.ok || !result.data?.session) {
        setStatusMessage(result.error ?? 'Unable to sign in.');
        return;
      }
      setAuthToken(result.data.session.token);
      setAuthState('ok');
      setStatusMessage('Signed in. Loading Duel Simulator...');
    } catch {
      setStatusMessage('Unable to sign in right now.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const createNewDraft = () => {
    if (!catalogs || catalogs.critters.length === 0) {
      return;
    }
    const firstCritter = catalogs.critters[0];
    const newDraft: DuelSquadDraft = {
      name: `New Squad ${squads.length + 1}`,
      sortIndex: squads.length,
      members: [
        {
          critterId: firstCritter.id,
          level: 1,
          equippedSkillIds: [null, null, null, null],
          equippedItems: [],
        },
      ],
    };
    setSelectedSquadId(null);
    setDraft(newDraft);
    setSaveMessage(null);
  };

  const saveDraft = async () => {
    if (!draft || !catalogIndexes || !draftValidation) {
      return;
    }
    if (!draftValidation.ok || !draftValidation.squad) {
      setSaveMessage('Fix validation errors before saving.');
      return;
    }

    setIsSavingDraft(true);
    setSaveMessage(null);
    try {
      if (draft.id) {
        const updated = await updateDuelSquad({
          id: draft.id,
          name: draftValidation.squad.name,
          sortIndex:
            typeof draftValidation.squad.sortIndex === 'number' && Number.isFinite(draftValidation.squad.sortIndex)
              ? draftValidation.squad.sortIndex
              : selectedSquad?.sortIndex,
          members: draftValidation.squad.members,
        });
        setSquads((current) =>
          sortDuelSquads(current.map((entry) => (entry.id === updated.id ? updated : entry))),
        );
        setSelectedSquadId(updated.id);
        setDraft(toDuelDraftFromSavedSquad(updated));
        setSaveMessage('Squad updated.');
      } else {
        const created = await createDuelSquad({
          name: draftValidation.squad.name,
          sortIndex:
            typeof draftValidation.squad.sortIndex === 'number' && Number.isFinite(draftValidation.squad.sortIndex)
              ? draftValidation.squad.sortIndex
              : squads.length,
          members: draftValidation.squad.members,
        });
        setSquads((current) => sortDuelSquads([...current, created]));
        setSelectedSquadId(created.id);
        setDraft(toDuelDraftFromSavedSquad(created));
        setSaveMessage('Squad created.');
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Unable to save squad.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const removeDraft = async () => {
    if (!draft?.id) {
      return;
    }
    setIsDeletingDraft(true);
    setSaveMessage(null);
    try {
      await deleteDuelSquad(draft.id);
      setSquads((current) => sortDuelSquads(current.filter((entry) => entry.id !== draft.id)));
      setDraft(null);
      setSelectedSquadId((current) => {
        if (current !== draft.id) {
          return current;
        }
        const remaining = squads.filter((entry) => entry.id !== draft.id);
        return remaining[0]?.id ?? null;
      });
      setSaveMessage('Squad deleted.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Unable to delete squad.');
    } finally {
      setIsDeletingDraft(false);
    }
  };

  const reorderSquad = async (squadId: string, direction: -1 | 1) => {
    if (isReorderingSquads) {
      return;
    }
    const ordered = sortDuelSquads([...squads]);
    const fromIndex = ordered.findIndex((entry) => entry.id === squadId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= ordered.length) {
      return;
    }
    const from = ordered[fromIndex];
    const to = ordered[toIndex];
    setIsReorderingSquads(true);
    setSaveMessage(null);
    try {
      const [updatedFrom, updatedTo] = await Promise.all([
        updateDuelSquad({
          id: from.id,
          name: from.name,
          sortIndex: to.sortIndex,
          members: from.members,
        }),
        updateDuelSquad({
          id: to.id,
          name: to.name,
          sortIndex: from.sortIndex,
          members: to.members,
        }),
      ]);
      setSquads((current) =>
        sortDuelSquads(
          current.map((entry) => {
            if (entry.id === updatedFrom.id) {
              return updatedFrom;
            }
            if (entry.id === updatedTo.id) {
              return updatedTo;
            }
            return entry;
          }),
        ),
      );
      setSaveMessage('Squad order updated.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Unable to reorder squads.');
    } finally {
      setIsReorderingSquads(false);
    }
  };

  const startBattle = () => {
    if (!catalogs || !selectedPlayerSquad || !selectedOpponentSquad) {
      return;
    }
    try {
      const controller = createDuelBattleController({
        format: duelFormat,
        playerLabel: 'Player 1',
        opponentLabel: 'Player 2',
        playerSquad: selectedPlayerSquad,
        opponentSquad: selectedOpponentSquad,
        catalogs,
      });
      setBattleController(controller);
      setBattleTick(0);
      setBattleErrorMessage(null);
      setLeadDraftBySide({ player: [], opponent: [] });
      setReplacementDraftBySide({ player: [], opponent: [] });
      setActionDraftBySide({ player: {}, opponent: {} });
      setPendingTargetSelection(null);
      setBoardTargetSelectionContext(null);
      setBattleNarrationQueue([]);
      setTurnNarrationActive(false);
      battleNarrationLogCursorRef.current = controller.state.logs.length;
      onNavigate('battle');
    } catch (error) {
      setBattleErrorMessage(error instanceof Error ? error.message : 'Unable to start duel.');
    }
  };

  const backToSetup = () => {
    setBattleController(null);
    setBattleTick(0);
    setBattleErrorMessage(null);
    setPendingTargetSelection(null);
    setBoardTargetSelectionContext(null);
    setBattleNarrationQueue([]);
    setTurnNarrationActive(false);
    battleNarrationLogCursorRef.current = 0;
    onNavigate('duel');
  };

  const rematch = () => {
    if (!selectedPlayerSquad || !selectedOpponentSquad || !catalogs) {
      return;
    }
    startBattle();
  };

  const submitLeadForSide = (side: DuelSideId) => {
    if (!battleController || !battleState) {
      return;
    }
    const required = getRequiredLeadCount(duelFormat);
    const picks = leadDraftBySide[side];
    if (picks.length !== required) {
      setBattleErrorMessage(`Select exactly ${required} lead critter(s).`);
      return;
    }
    const result = battleController.submitLeadSelection(side, picks);
    if (!result.ok) {
      setBattleErrorMessage(result.error ?? 'Unable to lock lead selection.');
      return;
    }
    setBattleErrorMessage(null);
    setBattleTick((value) => value + 1);
  };

  const submitActionsForSide = (side: DuelSideId) => {
    if (!battleController || !battleState) {
      return;
    }
    const sideState = side === 'player' ? battleState.player : battleState.opponent;
    const requiredActors = sideState.activeMemberIndices.filter((memberIndex) => {
      const critter = sideState.team[memberIndex];
      return Boolean(critter && !critter.fainted && critter.currentHp > 0);
    });
    const drafts = actionDraftBySide[side] ?? {};
    const actions: DuelAction[] = [];

    for (const actorMemberIndex of requiredActors) {
      const draftAction = drafts[actorMemberIndex];
      if (!draftAction) {
        setBattleErrorMessage('Every active critter must have an action selected.');
        return;
      }
      if (draftAction.kind === 'guard') {
        actions.push({ kind: 'guard', actorMemberIndex });
        continue;
      }
      if (draftAction.kind === 'forfeit') {
        actions.push({ kind: 'forfeit', actorMemberIndex });
        continue;
      }
      if (draftAction.kind === 'swap') {
        actions.push({
          kind: 'swap',
          actorMemberIndex,
          benchMemberIndex: draftAction.benchMemberIndex,
        });
        continue;
      }
      if (draftAction.kind === 'skill') {
        const useMulti = draftAction.targetMemberIndices && draftAction.targetMemberIndices.length > 0;
        actions.push({
          kind: 'skill',
          actorMemberIndex,
          skillSlotIndex: draftAction.skillSlotIndex,
          ...(useMulti
            ? { targetMemberIndex: draftAction.targetMemberIndices![0]!, targetMemberIndices: draftAction.targetMemberIndices }
            : { targetMemberIndex: draftAction.targetMemberIndex }),
        });
        continue;
      }
    }

    const result = battleController.submitActions({ side, actions });
    if (!result.ok) {
      setBattleErrorMessage(result.error ?? 'Unable to lock actions.');
      return;
    }
    setPendingTargetSelection(null);
    setBoardTargetSelectionContext(null);
    setBattleErrorMessage(null);
    setBattleTick((value) => value + 1);
  };

  const activeBoardTargetSelection = pendingTargetSelection ?? boardTargetSelectionContext;

  const battleViableTargets = useMemo(() => {
    if (!activeBoardTargetSelection || !battleState || !resolveContext) return [];
    return getViableTargetsForSkill(
      battleState,
      activeBoardTargetSelection.side,
      activeBoardTargetSelection.actorMemberIndex,
      activeBoardTargetSelection.skillSlotIndex,
      resolveContext,
    );
  }, [activeBoardTargetSelection, battleState, resolveContext]);

  const battleSelectedTargets = useMemo(() => {
    if (!activeBoardTargetSelection) return [];
    const draft = actionDraftBySide[activeBoardTargetSelection.side]?.[activeBoardTargetSelection.actorMemberIndex];
    return getDraftTargetIndices(draft);
  }, [activeBoardTargetSelection, actionDraftBySide]);

  const battleTargetSide = battleViableTargets[0]?.side ?? null;

  const battleTargetExpectedCount = useMemo(() => {
    if (!activeBoardTargetSelection || !battleState || !resolveContext) return 0;
    const sideState = activeBoardTargetSelection.side === 'player' ? battleState.player : battleState.opponent;
    const actor = sideState.team[activeBoardTargetSelection.actorMemberIndex];
    const skillId = actor?.equippedSkillIds[activeBoardTargetSelection.skillSlotIndex];
    const skill = skillId ? resolveContext.indexes.skillById.get(skillId) : null;
    return skill ? getSkillTargetCount(skill, battleState.format) : 0;
  }, [activeBoardTargetSelection, battleState, resolveContext]);

  const handleBoardTargetClick = useCallback(
    (side: DuelSideId, memberIndex: number) => {
      const targetSelection = pendingTargetSelection ?? boardTargetSelectionContext;
      if (!targetSelection || !battleState || !resolveContext) return;
      const draft = actionDraftBySide[targetSelection.side]?.[targetSelection.actorMemberIndex];
      const sideState = targetSelection.side === 'player' ? battleState.player : battleState.opponent;
      const actor = sideState.team[targetSelection.actorMemberIndex];
      const skillId = actor?.equippedSkillIds[targetSelection.skillSlotIndex];
      const skill = skillId ? resolveContext.indexes.skillById.get(skillId) : null;
      if (!skill) return;
      const expectedCount = getSkillTargetCount(skill, battleState.format);
      const current = draft?.targetMemberIndices ?? (draft?.targetMemberIndex !== undefined ? [draft.targetMemberIndex] : []);
      let next: number[];
      if (current.includes(memberIndex)) {
        next = current.filter((i) => i !== memberIndex);
      } else if (current.length < expectedCount) {
        next = [...current, memberIndex];
      } else {
        next = [...current.slice(0, -1), memberIndex];
      }
      updateActionDraft(targetSelection.side, targetSelection.actorMemberIndex, {
        targetMemberIndices: next,
        targetMemberIndex: next[0] ?? 0,
      });
      setBoardTargetSelectionContext(targetSelection);
      if (next.length === expectedCount) {
        setPendingTargetSelection(null);
      } else {
        setPendingTargetSelection(targetSelection);
      }
    },
    [pendingTargetSelection, boardTargetSelectionContext, battleState, resolveContext, actionDraftBySide, updateActionDraft],
  );

  const submitReplacementsForSide = (side: DuelSideId) => {
    if (!battleController || !battleState) {
      return;
    }
    const sideState = side === 'player' ? battleState.player : battleState.opponent;
    const needed = getReplacementNeededCount(duelFormat, sideState);
    const picks = replacementDraftBySide[side] ?? [];
    if (picks.length !== needed) {
      setBattleErrorMessage(`Select exactly ${needed} replacement critter(s).`);
      return;
    }
    setBattleErrorMessage(null);
    setPendingReplacementSubmission((prev) => ({ ...prev, [side]: picks }));
    const names = picks.map((memberIndex) => sideState.team[memberIndex]?.name ?? 'a critter').join(' and ');
    const message = `${sideState.label} is sending in ${names}.`;
    setBattleNarrationQueue((current) => [...current, message]);
    if (side === 'opponent' && getReplacementNeededCount(duelFormat, battleState.player) === 0) {
      opponentReplacementAutoApplyRef.current = picks;
      if (opponentReplacementAutoApplyTimeoutRef.current !== null) clearTimeout(opponentReplacementAutoApplyTimeoutRef.current);
      opponentReplacementAutoApplyTimeoutRef.current = setTimeout(() => {
        opponentReplacementAutoApplyTimeoutRef.current = null;
        const toApply = opponentReplacementAutoApplyRef.current ?? [];
        opponentReplacementAutoApplyRef.current = null;
        const rPlayer = battleController.submitReplacementSelection('player', []);
        const rOpponent = battleController.submitReplacementSelection('opponent', toApply);
        if (rPlayer.ok && rOpponent.ok) {
          setPendingReplacementSubmission({ player: null, opponent: null });
          setBattleNarrationQueue([]);
          battleNarrationLogCursorRef.current = battleController.state.logs.length;
          setBattleTick((v) => v + 1);
          const entries = toApply.map((memberIndex) => ({ side: 'opponent' as DuelSideId, memberIndex }));
          setAnimatingEntry((prev) => [...prev, ...entries]);
          if (entryTimeoutRef.current !== null) clearTimeout(entryTimeoutRef.current);
          entryTimeoutRef.current = setTimeout(() => {
            entryTimeoutRef.current = null;
            setAnimatingEntry((prev) => prev.filter((p) => !(p.side === 'opponent' && toApply.includes(p.memberIndex))));
          }, 340);
        }
      }, 1600);
    }
  };

  const advanceBattleNarration = useCallback(() => {
    if (!battleController || !battleState) {
      return;
    }
    if (battleNarrationQueue.length > 0) {
      setBattleNarrationQueue((current) => current.slice(1));
      return;
    }
    if (pendingReplacementSubmission.player !== null || pendingReplacementSubmission.opponent !== null) {
      const playerPicks = pendingReplacementSubmission.player ?? [];
      const opponentPicks = pendingReplacementSubmission.opponent ?? [];
      const resultPlayer = battleController.submitReplacementSelection('player', playerPicks);
      const resultOpponent = battleController.submitReplacementSelection('opponent', opponentPicks);
      if (!resultPlayer.ok || !resultOpponent.ok) {
        setBattleErrorMessage(resultPlayer.error ?? resultOpponent.error ?? 'Unable to apply replacements.');
        return;
      }
      setPendingReplacementSubmission({ player: null, opponent: null });
      setBattleErrorMessage(null);
      setBattleTick((value) => value + 1);
      const entries: Array<{ side: DuelSideId; memberIndex: number }> = [
        ...playerPicks.map((memberIndex) => ({ side: 'player' as DuelSideId, memberIndex })),
        ...opponentPicks.map((memberIndex) => ({ side: 'opponent' as DuelSideId, memberIndex })),
      ];
      if (entries.length > 0) {
        setAnimatingEntry((prev) => [...prev, ...entries]);
        if (entryTimeoutRef.current !== null) clearTimeout(entryTimeoutRef.current);
        entryTimeoutRef.current = setTimeout(() => {
          entryTimeoutRef.current = null;
          setAnimatingEntry((prev) => prev.filter((p) => !entries.some((e) => e.side === p.side && e.memberIndex === p.memberIndex)));
        }, 340);
      }
      return;
    }
    if (battleState.phase !== 'resolving-turn') {
      return;
    }
    if (animatingAttackTimeoutRef.current !== null) {
      clearTimeout(animatingAttackTimeoutRef.current);
      animatingAttackTimeoutRef.current = null;
    }
    const result = battleController.advanceTurnResolution();
    if (!result.ok) {
      setBattleErrorMessage(result.error ?? 'Unable to resolve the next action.');
      return;
    }
    setBattleErrorMessage(null);
    setBattleTick((value) => value + 1);
    const entry = result.executedEntry;
    if (entry && entry.action.kind === 'skill') {
      const targetSide: DuelSideId = entry.side === 'player' ? 'opponent' : 'player';
      const targetIndices = entry.action.targetMemberIndices?.length ? entry.action.targetMemberIndices : [entry.action.targetMemberIndex];
      setAnimatingAttack({
        actorSide: entry.side,
        actorMemberIndex: entry.action.actorMemberIndex,
        targetSide,
        targetMemberIndex: targetIndices[0] ?? entry.action.targetMemberIndex,
        targetMemberIndices: targetIndices.length > 1 ? targetIndices : undefined,
      });
      animatingAttackTimeoutRef.current = setTimeout(() => {
        animatingAttackTimeoutRef.current = null;
        setAnimatingAttack(null);
      }, 400);
    }
    if (result.knockout) {
      if (knockoutTimeoutRef.current !== null) clearTimeout(knockoutTimeoutRef.current);
      setAnimatingKnockout(result.knockout);
      knockoutTimeoutRef.current = setTimeout(() => {
        knockoutTimeoutRef.current = null;
        setAnimatingKnockout(null);
      }, 520);
    }
    if (result.swapOccurred) {
      deferNarrationUntilAfterPaintRef.current = true;
      if (entryTimeoutRef.current !== null) clearTimeout(entryTimeoutRef.current);
      setAnimatingEntry((prev) => [...prev, result.swapOccurred!]);
      entryTimeoutRef.current = setTimeout(() => {
        entryTimeoutRef.current = null;
        setAnimatingEntry((prev) => prev.filter((e) => e.side !== result.swapOccurred!.side || e.memberIndex !== result.swapOccurred!.memberIndex));
      }, 340);
    }
  }, [battleController, battleState, battleNarrationQueue.length, pendingReplacementSubmission.player, pendingReplacementSubmission.opponent]);

  const skipBattleNarration = useCallback(() => {
    if (!battleController || !battleState) {
      return;
    }
    if (animatingAttackTimeoutRef.current !== null) {
      clearTimeout(animatingAttackTimeoutRef.current);
      animatingAttackTimeoutRef.current = null;
    }
    setAnimatingAttack(null);
    if (battleState.phase === 'resolving-turn') {
      const result = battleController.resolveTurnImmediately();
      if (!result.ok) {
        setBattleErrorMessage(result.error ?? 'Unable to skip turn resolution.');
        return;
      }
      setBattleErrorMessage(null);
      setBattleNarrationQueue([]);
      setTurnNarrationActive(false);
      battleNarrationLogCursorRef.current = battleController.state.logs.length;
      setBattleTick((value) => value + 1);
      return;
    }
    setBattleNarrationQueue([]);
    setTurnNarrationActive(false);
    battleNarrationLogCursorRef.current = battleState.logs.length;
  }, [battleController, battleState]);

  useEffect(() => {
    if (route !== 'battle') {
      return;
    }
    if (!battleNarrationVisible) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      if (event.code !== 'Space' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      advanceBattleNarration();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [route, battleNarrationVisible, advanceBattleNarration]);

  const toggleLeadPick = (side: DuelSideId, memberIndex: number) => {
    const required = getRequiredLeadCount(duelFormat);
    setLeadDraftBySide((current) => {
      const next = [...(current[side] ?? [])];
      const existingIndex = next.indexOf(memberIndex);
      if (existingIndex >= 0) {
        next.splice(existingIndex, 1);
      } else if (next.length < required) {
        next.push(memberIndex);
      } else {
        next.splice(0, 1);
        next.push(memberIndex);
      }
      return {
        ...current,
        [side]: next,
      };
    });
  };

  const toggleReplacementPick = (side: DuelSideId, memberIndex: number, needed: number) => {
    setReplacementDraftBySide((current) => {
      const next = [...(current[side] ?? [])];
      const existingIndex = next.indexOf(memberIndex);
      if (existingIndex >= 0) {
        next.splice(existingIndex, 1);
      } else if (next.length < needed) {
        next.push(memberIndex);
      } else {
        next.splice(0, 1);
        next.push(memberIndex);
      }
      return {
        ...current,
        [side]: next,
      };
    });
  };

  function updateActionDraft(side: DuelSideId, actorMemberIndex: number, patch: Partial<ActionDraft>): void {
    setActionDraftBySide((current) => {
      const existing = current[side]?.[actorMemberIndex] ?? {
        kind: 'skill',
        skillSlotIndex: 0,
        targetMemberIndex: 0,
        benchMemberIndex: 0,
      };
      return {
        ...current,
        [side]: {
          ...(current[side] ?? {}),
          [actorMemberIndex]: {
            ...existing,
            ...patch,
          },
        },
      };
    });
  }

  if (authState === 'checking') {
    return (
      <section className="admin-screen">
        <section className="admin-placeholder">
          <h2>Checking Session</h2>
          <p>Validating your account before loading Duel Simulator.</p>
        </section>
      </section>
    );
  }

  if (authState === 'blocked') {
    return (
      <section className="admin-screen">
        <section className="admin-placeholder">
          <h2>Sign In Required</h2>
          <p>Duel Simulator requires a logged-in account.</p>
          <form className="admin-inline-auth" onSubmit={onSignIn}>
            <label htmlFor="duel-auth-email">Email</label>
            <input
              id="duel-auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
            <label htmlFor="duel-auth-password">Password</label>
            <input
              id="duel-auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="submit" className="primary" disabled={isSigningIn}>
              {isSigningIn ? 'Signing In...' : 'Sign In'}
            </button>
            {statusMessage ? <p className="admin-inline-auth__status">{statusMessage}</p> : null}
          </form>
          <a className="admin-screen__back" href="/">
            Back To Game
          </a>
        </section>
      </section>
    );
  }

  return (
    <section className="admin-screen duel-screen">
      <header className="admin-screen__header">
        <div>
          <p className="admin-screen__kicker">Duel Simulator</p>
          <h1>Critterra Duel Lab</h1>
          <p>Build squads and run sandbox duels.</p>
        </div>
        <a className="admin-screen__back" href="/">
          Back To Game
        </a>
      </header>

      <div className="admin-shell duel-shell">
        <aside className="admin-shell__nav duel-shell__nav">
          <button type="button" className={`secondary ${route === 'menu' ? 'is-selected' : ''}`} onClick={() => onNavigate('menu')}>
            Menu
          </button>
          <button
            type="button"
            className={`secondary ${route === 'edit-squads' ? 'is-selected' : ''}`}
            onClick={() => onNavigate('edit-squads')}
          >
            Edit Squads
          </button>
          <button type="button" className={`secondary ${route === 'duel' ? 'is-selected' : ''}`} onClick={() => onNavigate('duel')}>
            Duel
          </button>
        </aside>

        <main className="admin-shell__content duel-shell__content">
          {isLoadingData && (
            <section className="admin-placeholder">
              <h2>Loading Duel Data</h2>
              <p>Hydrating critter, skill, and item catalogs.</p>
            </section>
          )}

          {!isLoadingData && dataError && (
            <section className="admin-placeholder">
              <h2>Unable To Load Data</h2>
              <p>{dataError}</p>
            </section>
          )}

          {!isLoadingData && !dataError && route === 'menu' && (
            <section className="duel-panel">
              <h2>Duel Menu</h2>
              <p>Choose one of the options below.</p>
              <div className="title-screen__actions">
                <button type="button" className="primary" onClick={() => onNavigate('edit-squads')}>
                  Edit Squads
                </button>
                <button type="button" className="secondary" onClick={() => onNavigate('duel')}>
                  Duel
                </button>
              </div>
            </section>
          )}

          {!isLoadingData && !dataError && route === 'edit-squads' && catalogs && catalogIndexes && (
            <section className="duel-panel duel-panel--editor">
              <div className="duel-editor__sidebar">
                <div className="duel-editor__toolbar">
                  <h2>Saved Squads</h2>
                  <button type="button" className="primary" onClick={createNewDraft} disabled={squads.length >= 30}>
                    {squads.length >= 30 ? '30 / 30 Reached' : 'New Squad'}
                  </button>
                </div>
                <input
                  type="search"
                  placeholder="Search squads"
                  value={squadSearchInput}
                  onChange={(event) => setSquadSearchInput(event.target.value)}
                />
                <div className="duel-editor__squad-list">
                  {filteredSquads.length === 0 && <p className="admin-note">No squads found.</p>}
                  {filteredSquads.map((squad) => {
                    const orderIndex = squadOrderById.get(squad.id) ?? -1;
                    const canMoveUp = orderIndex > 0;
                    const canMoveDown = orderIndex >= 0 && orderIndex < squads.length - 1;
                    return (
                      <div key={squad.id} className="duel-squad-list-row">
                        <button
                          type="button"
                          className={`secondary duel-squad-list-row__select ${selectedSquadId === squad.id ? 'is-selected' : ''}`}
                          onClick={() => {
                            setSelectedSquadId(squad.id);
                            setDraft(toDuelDraftFromSavedSquad(squad));
                          }}
                        >
                          <span className="duel-squad-list-row__name">{squad.name}</span>
                          <span className="duel-squad-list-row__sprites" aria-label={`${squad.name} critter sprites`}>
                            {squad.members.map((member, memberIndex) => {
                              const critter = catalogIndexes.critterById.get(member.critterId);
                              const label = critter?.name ?? `Critter ${member.critterId}`;
                              if (critter?.spriteUrl) {
                                return (
                                  <img
                                    key={`saved-squad-${squad.id}-member-${memberIndex}`}
                                    src={critter.spriteUrl}
                                    alt={label}
                                    title={label}
                                    loading="lazy"
                                    decoding="async"
                                  />
                                );
                              }
                              return (
                                <span
                                  key={`saved-squad-${squad.id}-member-${memberIndex}`}
                                  className="duel-squad-list-row__sprite-fallback"
                                  title={label}
                                >
                                  #{member.critterId}
                                </span>
                              );
                            })}
                          </span>
                        </button>
                        <div className="duel-squad-list-row__controls">
                          <button
                            type="button"
                            className="secondary"
                            disabled={!canMoveUp || isReorderingSquads}
                            onClick={() => {
                              void reorderSquad(squad.id, -1);
                            }}
                            title="Move Up"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            disabled={!canMoveDown || isReorderingSquads}
                            onClick={() => {
                              void reorderSquad(squad.id, 1);
                            }}
                            title="Move Down"
                          >
                            Down
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="duel-editor__content">
                {!draft && (
                  <section className="admin-placeholder">
                    <h2>No Squad Selected</h2>
                    <p>Create or select a squad to start editing.</p>
                  </section>
                )}

                {draft && (
                  <section className="duel-editor__form">
                    <div className="duel-editor__header-row">
                      <label>
                        Squad Name
                        <input
                          type="text"
                          maxLength={40}
                          value={draft.name}
                          onChange={(event) => setDraft((current) => (current ? { ...current, name: event.target.value } : current))}
                        />
                      </label>
                      <div className="title-screen__actions">
                        <button
                          type="button"
                          className="primary"
                          onClick={saveDraft}
                          disabled={isSavingDraft || !draftValidation?.ok}
                        >
                          {isSavingDraft ? 'Saving...' : 'Save Squad'}
                        </button>
                        {draft.id && (
                          <button type="button" className="secondary" onClick={removeDraft} disabled={isDeletingDraft}>
                            {isDeletingDraft ? 'Deleting...' : 'Delete Squad'}
                          </button>
                        )}
                      </div>
                    </div>

                    {saveMessage && <p className="admin-note">{saveMessage}</p>}

                    {draftValidation && !draftValidation.ok && (
                      <div className="duel-validation">
                        <h3>Validation</h3>
                        {draftValidation.issues.map((issue, index) => (
                          <p key={`${issue.path}-${index}`} className="admin-note" style={{ color: '#f7b9b9' }}>
                            {issue.path}: {issue.message}
                          </p>
                        ))}
                      </div>
                    )}

                    <BattleTeamEditor
                      catalogs={catalogs}
                      catalogIndexes={catalogIndexes}
                      members={draft.members}
                      onChange={(members) => {
                        setDraft((current) => (current ? { ...current, members } : current));
                      }}
                      validationIssuesByPath={validationIssuesByPath}
                    />
                  </section>
                )}
              </div>
            </section>
          )}

          {!isLoadingData && !dataError && catalogs && route === 'duel' && (
            <section className="duel-panel duel-panel--setup">
              <div className="duel-setup-layout">
                <form
                  className="duel-setup-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!duelReady) {
                      return;
                    }
                    startBattle();
                  }}
                >
                  <h2>Duel Setup</h2>
                  <p className="admin-note">Configure format, control mode, and squads before entering the arena.</p>
                  <div className="duel-setup__controls">
                    <label>
                      Format
                      <select
                        value={duelFormat}
                        onChange={(event) => {
                          const v = event.target.value;
                          const next: DuelBattleFormat = v === 'triples' ? 'triples' : v === 'doubles' ? 'doubles' : 'singles';
                          setDuelFormat(next);
                        }}
                      >
                        <option value="singles">1v1 Singles</option>
                        <option value="doubles">2v2 Doubles</option>
                        <option value="triples">3v3 Triples</option>
                      </select>
                    </label>

                    <label>
                      Player 1 Control
                      <select
                        value={sideControlMode.player}
                        onChange={(event) => {
                          const next = toControlMode(event.target.value);
                          setSideControlMode((current) => ({ ...current, player: next }));
                        }}
                      >
                        <option value="human">Human</option>
                        <option value="random-agent">Random Agent</option>
                      </select>
                    </label>

                    <label>
                      Player 2 Control
                      <select
                        value={sideControlMode.opponent}
                        onChange={(event) => {
                          const next = toControlMode(event.target.value);
                          setSideControlMode((current) => ({ ...current, opponent: next }));
                        }}
                      >
                        <option value="human">Human</option>
                        <option value="random-agent">Random Agent</option>
                      </select>
                    </label>

                    <label>
                      Player 1 Squad
                      <select value={playerSquadId} onChange={(event) => setPlayerSquadId(event.target.value)}>
                        <option value="">Select squad</option>
                        {squads.map((squad) => (
                          <option key={`setup-player-squad-${squad.id}`} value={squad.id}>
                            {squad.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Player 2 Squad
                      <select value={opponentSquadId} onChange={(event) => setOpponentSquadId(event.target.value)}>
                        <option value="">Select squad</option>
                        {squads.map((squad) => (
                          <option key={`setup-opponent-squad-${squad.id}`} value={squad.id}>
                            {squad.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {battleErrorMessage && <p className="duel-field-error">{battleErrorMessage}</p>}
                  {!duelReady && (
                    <p className="admin-note">
                      {`Both squads need at least ${getRequiredLeadCount(duelFormat)} critter(s) for ${duelFormat === 'triples' ? 'triples' : duelFormat === 'doubles' ? 'doubles' : 'singles'}.`}
                    </p>
                  )}
                  <button type="submit" className="primary duel-setup-form__submit" disabled={!duelReady}>
                    Start Duel
                  </button>
                </form>

                <section className="duel-setup-board">
                  <header className="duel-setup-board__header">
                    <h3>Battle Simulation Board</h3>
                    <p className="admin-note">
                      {duelFormat === 'triples'
                        ? 'Triples board: 3x2 active card grid.'
                        : duelFormat === 'doubles'
                          ? 'Doubles board: 2x2 active card grid.'
                          : 'Singles board: 1x2 active card grid.'}
                    </p>
                  </header>

                  <SetupBattleBoard
                    format={duelFormat}
                    playerLabel="Player 1"
                    opponentLabel="Player 2"
                    playerSquad={selectedPlayerSquad}
                    opponentSquad={selectedOpponentSquad}
                    catalogs={catalogs}
                  />
                </section>
              </div>
            </section>
          )}

          {!isLoadingData && !dataError && route === 'battle' && !battleState && catalogs && (
            <section className="duel-panel duel-panel--battle duel-panel--battle-empty">
              <header className="duel-battle__header">
                <h2>Battle Simulator</h2>
                <p>No active battle</p>
              </header>
              <div className="duel-battle-empty__body">
                <p>Start a duel from the setup screen to run a battle simulation.</p>
                <button type="button" className="primary" onClick={() => onNavigate('duel')}>
                  Go to Duel Setup
                </button>
              </div>
            </section>
          )}

          {!isLoadingData && !dataError && route === 'battle' && battleState && battleController && catalogs && (
            <section className="duel-panel duel-panel--battle">
              <header className="duel-battle__header">
                <div className="duel-battle__header-main">
                  <h2>Battle Simulator</h2>
                  <span className="duel-battle__phase-badge">{BATTLE_PHASE_LABELS[battleState.phase]}</span>
                </div>
                <div className="duel-battle__header-meta">
                  <span>Turn {battleState.turnNumber}</span>
                  <span className="duel-battle__format">
                    {battleState.format === 'triples' ? '3v3 Triples' : battleState.format === 'doubles' ? '2v2 Doubles' : '1v1 Singles'}
                  </span>
                  {battleState.phase === 'finished' && battleState.winner !== null && (
                    <span className="duel-battle__result">
                      {battleState.winner === 'draw'
                        ? 'Draw'
                        : battleState.winner === 'player'
                          ? `${battleState.player.label} wins`
                          : `${battleState.opponent.label} wins`}
                    </span>
                  )}
                </div>
              </header>

              <div className="duel-battle__layout">
                {/* Panel 1: Simulation Canvas */}
                <section className="duel-battle__canvas" aria-label="Arena">
                  <BattleBoard
                    state={battleState}
                    format={duelFormat}
                    catalogs={catalogs}
                    phase={battleState.phase}
                    boardTick={battleTick}
                    animatingAttack={animatingAttack}
                    animatingKnockout={animatingKnockout}
                    animatingEntry={animatingEntry}
                    leadDraftBySide={leadDraftBySide}
                    replacementDraftBySide={replacementDraftBySide}
                    pendingInputSide={pendingInputSide}
                    viableTargets={battleViableTargets}
                    selectedTargets={battleSelectedTargets}
                    targetSide={battleTargetSide}
                    targetExpectedCount={battleTargetExpectedCount}
                    onBoardTargetClick={handleBoardTargetClick}
                  />
                </section>

                {/* Panel 2: Action / result text */}
                <section
                  className={`duel-battle__narration ${narrationPlaybackActive ? 'duel-battle__narration--clickable' : ''}`}
                  aria-live="polite"
                  role={narrationPlaybackActive ? 'button' : undefined}
                  tabIndex={narrationPlaybackActive ? 0 : undefined}
                  onMouseDown={
                    narrationPlaybackActive
                      ? () => {
                          if (narrationHoldTimeoutRef.current !== null) clearTimeout(narrationHoldTimeoutRef.current);
                          narrationHoldTimeoutRef.current = setTimeout(() => {
                            narrationHoldTimeoutRef.current = null;
                            skipBattleNarration();
                          }, 600);
                        }
                      : undefined
                  }
                  onMouseUp={
                    narrationPlaybackActive
                      ? () => {
                          if (narrationHoldTimeoutRef.current !== null) {
                            clearTimeout(narrationHoldTimeoutRef.current);
                            narrationHoldTimeoutRef.current = null;
                            advanceBattleNarration();
                          }
                        }
                      : undefined
                  }
                  onMouseLeave={
                    narrationPlaybackActive
                      ? () => {
                          if (narrationHoldTimeoutRef.current !== null) {
                            clearTimeout(narrationHoldTimeoutRef.current);
                            narrationHoldTimeoutRef.current = null;
                            advanceBattleNarration();
                          }
                        }
                      : undefined
                  }
                  onKeyDown={
                    narrationPlaybackActive
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            advanceBattleNarration();
                          }
                        }
                      : undefined
                  }
                >
                  {narrationPlaybackActive ? (
                    <>
                      <p>{battleNarrationText}</p>
                      <p className="duel-battle__narration-hint">Click or Space: next · Hold click: skip turn</p>
                    </>
                  ) : battleState.phase === 'choose-actions' && pendingInputSide ? (
                    <p>{getActionNarrationText(pendingInputSide, battleState, actionDraftBySide, duelFormat, catalogs) || (battleState.logs.length > 0 ? battleState.logs[battleState.logs.length - 1]?.text : null) || BATTLE_PHASE_LABELS[battleState.phase]}</p>
                  ) : battleState.logs.length > 0 ? (
                    <p>{battleState.logs[battleState.logs.length - 1]?.text ?? BATTLE_PHASE_LABELS[battleState.phase]}</p>
                  ) : (
                    <p>{BATTLE_PHASE_LABELS[battleState.phase]}</p>
                  )}
                </section>

                {/* Panel 3: Control panel */}
                <section className="duel-battle__control" aria-label="Controls">
                  {battleErrorMessage && <p className="duel-field-error">{battleErrorMessage}</p>}

                  {battleState.phase === 'finished' ? (
                    <section className="duel-result">
                      <h3>Battle Complete</h3>
                      <p>
                        {battleState.winner === 'draw'
                          ? 'The duel ended in a draw.'
                          : battleState.winner === 'player'
                            ? `${battleState.player.label} wins the duel.`
                            : `${battleState.opponent.label} wins the duel.`}
                      </p>
                      <div className="title-screen__actions">
                        <button type="button" className="primary" onClick={rematch}>
                          Rematch
                        </button>
                        <button type="button" className="secondary" onClick={backToSetup}>
                          Back To Setup
                        </button>
                      </div>
                    </section>
                  ) : pendingInputSide ? (
                    <>
                      <h3 className="duel-battle__control-title">
                        {pendingInputSide === 'player' ? battleState.player.label : battleState.opponent.label} — {BATTLE_PHASE_LABELS[battleState.phase]}
                      </h3>
                      {pendingInputSideControlMode === 'human' ? (
                        <>
                          {battleState.phase === 'choose-leads' && (
                            <LeadSelectionPanel
                              side={pendingInputSide}
                              sideState={pendingInputSide === 'player' ? battleState.player : battleState.opponent}
                              catalogs={catalogs}
                              required={getRequiredLeadCount(duelFormat)}
                              selected={leadDraftBySide[pendingInputSide] ?? []}
                              onToggle={(memberIndex) => toggleLeadPick(pendingInputSide, memberIndex)}
                              onSubmit={() => submitLeadForSide(pendingInputSide)}
                            />
                          )}

                          {battleState.phase === 'choose-actions' && (
                            <BattleActionPanel
                              side={pendingInputSide}
                              format={duelFormat}
                              sideState={pendingInputSide === 'player' ? battleState.player : battleState.opponent}
                              opposingState={pendingInputSide === 'player' ? battleState.opponent : battleState.player}
                              actionDrafts={actionDraftBySide[pendingInputSide] ?? {}}
                              catalogs={catalogs}
                              onChangeDraft={(actorMemberIndex, patch) => updateActionDraft(pendingInputSide, actorMemberIndex, patch)}
                              onSkillRequiresTargetSelection={(actorMemberIndex, skillSlotIndex) => {
                                const selection = { side: pendingInputSide, actorMemberIndex, skillSlotIndex };
                                setPendingTargetSelection(selection);
                                setBoardTargetSelectionContext(selection);
                              }}
                              onClearTargetSelection={() => {
                                setPendingTargetSelection(null);
                                setBoardTargetSelectionContext(null);
                              }}
                              boardTargetingActive={pendingTargetSelection !== null}
                              onSubmitTurn={() => submitActionsForSide(pendingInputSide)}
                              turnNumber={battleState.turnNumber}
                            />
                          )}

                          {battleState.phase === 'choose-replacements' && (
                            <ReplacementSelectionPanel
                              side={pendingInputSide}
                              sideState={pendingInputSide === 'player' ? battleState.player : battleState.opponent}
                              catalogs={catalogs}
                              needed={
                                getReplacementNeededCount(
                                  duelFormat,
                                  pendingInputSide === 'player' ? battleState.player : battleState.opponent,
                                )
                              }
                              selected={replacementDraftBySide[pendingInputSide] ?? []}
                              onToggle={(memberIndex, needed) => toggleReplacementPick(pendingInputSide, memberIndex, needed)}
                              onSubmit={() => submitReplacementsForSide(pendingInputSide)}
                            />
                          )}
                        </>
                      ) : (
                        <p className="admin-note">
                          {pendingInputSide === 'player' ? battleState.player.label : battleState.opponent.label} is set to
                          {' '}Random Agent. Waiting for auto selection.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="duel-battle__waiting">
                      <h3>Preparing next step</h3>
                      <p>Waiting for both sides to submit.</p>
                    </div>
                  )}
                </section>
              </div>
            </section>
          )}
        </main>
      </div>
    </section>
  );
}

function SquadPreviewGrid({
  squad,
  catalogs,
  side,
}: {
  squad: DuelSquad | null;
  catalogs: DuelCatalogContent;
  side: 'player' | 'opponent';
}) {
  if (!squad) {
    return <p className="admin-note">No squad selected.</p>;
  }

  const critterById = new Map(catalogs.critters.map((entry) => [entry.id, entry] as const));
  const itemById = new Map(catalogs.items.map((entry) => [entry.id, entry] as const));
  const equipmentEffectById = new Map(catalogs.equipmentEffects.map((entry) => [entry.effect_id, entry] as const));
  const slots = Array.from({ length: 8 }, (_, index) => squad.members[index] ?? null);

  return (
    <div className={`duel-preview-grid duel-preview-grid--${side}`}>
      {slots.map((member, slotIndex) => {
        if (!member) {
          return (
            <div key={`preview-empty-${slotIndex}`} className="duel-preview-cell duel-preview-cell--empty">
              Empty
            </div>
          );
        }
        const critter = critterById.get(member.critterId);
        return (
          <div key={`preview-member-${slotIndex}`} className="duel-preview-cell">
            {critter?.spriteUrl ? <img src={critter.spriteUrl} alt={critter.name} loading="lazy" decoding="async" /> : <span>{critter?.name ?? member.critterId}</span>}
            <div className="duel-preview-cell__items">
              {member.equippedItems.slice(0, 3).map((equippedItem, itemIndex) => {
                const item = itemById.get(equippedItem.itemId);
                const itemTooltip = getItemEquipmentTooltip(item, equippedItem.itemId, equipmentEffectById);
                return item?.imageUrl ? (
                  <img
                    key={`preview-slot-item-${slotIndex}-${itemIndex}`}
                    src={item.imageUrl}
                    alt={item.name}
                    title={itemTooltip}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span key={`preview-slot-item-${slotIndex}-${itemIndex}`} title={itemTooltip}>
                    •
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SetupBattleBoard({
  format,
  playerLabel,
  opponentLabel,
  playerSquad,
  opponentSquad,
  catalogs,
}: {
  format: DuelBattleFormat;
  playerLabel: string;
  opponentLabel: string;
  playerSquad: DuelSquad | null;
  opponentSquad: DuelSquad | null;
  catalogs: DuelCatalogContent;
}) {
  const required = getRequiredLeadCount(format);
  const critterById = new Map(catalogs.critters.map((entry) => [entry.id, entry] as const));
  const playerSlots = Array.from({ length: required }, (_, index) => playerSquad?.members[index] ?? null);
  const opponentSlots = Array.from({ length: required }, (_, index) => opponentSquad?.members[index] ?? null);

  const renderSideHalf = (
    side: DuelSideId,
    label: string,
    slots: Array<DuelSquad['members'][number] | null>,
    squad: DuelSquad | null,
  ) => {
    const sideClass = side === 'player' ? 'player' : 'opponent';
    return (
      <section className={`duel-setup-side duel-setup-side--${sideClass}`}>
        <div className={`duel-setup-side__slots duel-setup-side__slots--${format}`}>
          {slots.map((slot, rowIndex) => (
            <article
              key={`setup-${side}-slot-${rowIndex}`}
              className={`duel-board-card duel-board-card--preview duel-board-card--${sideClass}`}
            >
              <p className="duel-board-card__side">
                {label}{required > 1 ? ` Slot ${rowIndex + 1}` : ''}
              </p>
              {slot ? (
                <>
                  {critterById.get(slot.critterId)?.spriteUrl ? (
                    <img
                      src={critterById.get(slot.critterId)?.spriteUrl}
                      alt={critterById.get(slot.critterId)?.name ?? 'Critter'}
                      className="duel-board-card__sprite"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="duel-board-card__sprite-fallback">No Sprite</div>
                  )}
                  <p className="duel-board-card__name">{critterById.get(slot.critterId)?.name ?? 'Critter'}</p>
                  <p className="duel-board-card__meta">Lv {slot.level}</p>
                </>
              ) : (
                <p className="duel-board-card__empty">No critter selected</p>
              )}
            </article>
          ))}
        </div>

        <div className="duel-setup-side__squad">
          <p className="duel-setup-side__squad-title">{label} Squad</p>
          <SquadPreviewGrid squad={squad} catalogs={catalogs} side={side} />
        </div>
      </section>
    );
  };

  return (
    <div className="duel-setup-halves">
      {renderSideHalf('player', playerLabel, playerSlots, playerSquad)}
      {renderSideHalf('opponent', opponentLabel, opponentSlots, opponentSquad)}
    </div>
  );
}

function BattleBoard({
  state,
  format,
  catalogs,
  phase,
  boardTick,
  animatingAttack,
  animatingKnockout,
  animatingEntry,
  leadDraftBySide,
  replacementDraftBySide,
  pendingInputSide,
  viableTargets = [],
  selectedTargets = [],
  targetSide = null,
  targetExpectedCount = 0,
  onBoardTargetClick,
}: {
  state: DuelBattleController['state'];
  format: DuelBattleFormat;
  catalogs: DuelCatalogContent;
  phase: DuelPhase;
  boardTick?: number;
  animatingAttack?: {
    actorSide: DuelSideId;
    actorMemberIndex: number;
    targetSide: DuelSideId;
    targetMemberIndex: number;
    targetMemberIndices?: number[];
  } | null;
  animatingKnockout?: { side: DuelSideId; memberIndex: number } | null;
  animatingEntry?: Array<{ side: DuelSideId; memberIndex: number }>;
  leadDraftBySide?: Record<DuelSideId, number[]>;
  replacementDraftBySide?: Record<DuelSideId, number[]>;
  pendingInputSide?: DuelSideId | null;
  viableTargets?: Array<{ side: DuelSideId; memberIndex: number }>;
  selectedTargets?: number[];
  targetSide?: DuelSideId | null;
  targetExpectedCount?: number;
  onBoardTargetClick?: (side: DuelSideId, memberIndex: number) => void;
}) {
  const required = getRequiredLeadCount(format);
  const critterById = new Map(catalogs.critters.map((entry) => [entry.id, entry] as const));

  const playerSlots = useMemo(() => {
    const base = getActiveBoardSlots(state.player, format);
    if (phase === 'choose-leads' && pendingInputSide === 'player' && leadDraftBySide?.player) {
      const draft = leadDraftBySide.player;
      return Array.from({ length: required }, (_, i) => {
        const memberIndex = draft[i];
        return memberIndex != null ? state.player.team[memberIndex] ?? null : null;
      });
    }
    if (phase === 'choose-replacements' && pendingInputSide === 'player' && state.player.pendingReplacements !== null && replacementDraftBySide?.player) {
      const selected = replacementDraftBySide.player;
      let j = 0;
      return base.map((slot) => slot ?? (selected[j] != null ? state.player.team[selected[j++]] ?? null : null));
    }
    return base;
  }, [state.player, format, phase, pendingInputSide, leadDraftBySide, replacementDraftBySide, required, boardTick]);

  const opponentSlots = useMemo(() => {
    const base = getActiveBoardSlots(state.opponent, format);
    if (phase === 'choose-leads' && pendingInputSide === 'opponent' && leadDraftBySide?.opponent) {
      const draft = leadDraftBySide.opponent;
      return Array.from({ length: required }, (_, i) => {
        const memberIndex = draft[i];
        return memberIndex != null ? state.opponent.team[memberIndex] ?? null : null;
      });
    }
    if (phase === 'choose-replacements' && pendingInputSide === 'opponent' && state.opponent.pendingReplacements !== null && replacementDraftBySide?.opponent) {
      const selected = replacementDraftBySide.opponent;
      let j = 0;
      return base.map((slot) => slot ?? (selected[j] != null ? state.opponent.team[selected[j++]] ?? null : null));
    }
    return base;
  }, [state.opponent, format, phase, pendingInputSide, leadDraftBySide, replacementDraftBySide, required, boardTick]);

  return (
    <div className={`duel-board-grid duel-board-grid--${format}`}>
      {Array.from({ length: required }, (_, rowIndex) => (
        <Fragment key={`battle-board-row-${rowIndex}`}>
          <BattleBoardCard
            critter={playerSlots[rowIndex]}
            sideClass="player"
            sideLabel={state.player.label}
            slotIndex={rowIndex}
            critterById={critterById}
            catalogs={catalogs}
            phase={phase}
            isAttacking={animatingAttack?.actorSide === 'player' && playerSlots[rowIndex]?.memberIndex === animatingAttack.actorMemberIndex}
            isTarget={
              Boolean(animatingAttack?.targetSide === 'player' && playerSlots[rowIndex] && (animatingAttack.targetMemberIndex === playerSlots[rowIndex]?.memberIndex || animatingAttack.targetMemberIndices?.includes(playerSlots[rowIndex]!.memberIndex)))
            }
            isKnockedOut={Boolean(animatingKnockout?.side === 'player' && playerSlots[rowIndex] && animatingKnockout.memberIndex === playerSlots[rowIndex]?.memberIndex)}
            isEntering={Boolean(animatingEntry?.some((e) => e.side === 'player' && playerSlots[rowIndex] && e.memberIndex === playerSlots[rowIndex]?.memberIndex))}
            isViableTarget={viableTargets.some((v) => v.side === 'player' && v.memberIndex === playerSlots[rowIndex]?.memberIndex)}
            isSelectedTarget={targetSide === 'player' && playerSlots[rowIndex] != null && selectedTargets.includes(playerSlots[rowIndex]!.memberIndex)}
            isTargetDisabled={
              targetExpectedCount > 0 &&
              selectedTargets.length >= targetExpectedCount &&
              viableTargets.some((v) => v.side === 'player' && v.memberIndex === playerSlots[rowIndex]?.memberIndex) &&
              !selectedTargets.includes(playerSlots[rowIndex]?.memberIndex ?? -1)
            }
            onTargetClick={
              onBoardTargetClick && playerSlots[rowIndex] != null
                ? () => onBoardTargetClick('player', playerSlots[rowIndex]!.memberIndex)
                : undefined
            }
          />
          <BattleBoardCard
            critter={opponentSlots[rowIndex]}
            sideClass="opponent"
            sideLabel={state.opponent.label}
            slotIndex={rowIndex}
            critterById={critterById}
            catalogs={catalogs}
            phase={phase}
            isAttacking={animatingAttack?.actorSide === 'opponent' && opponentSlots[rowIndex]?.memberIndex === animatingAttack.actorMemberIndex}
            isTarget={
              Boolean(animatingAttack?.targetSide === 'opponent' && opponentSlots[rowIndex] && (animatingAttack.targetMemberIndex === opponentSlots[rowIndex]?.memberIndex || animatingAttack.targetMemberIndices?.includes(opponentSlots[rowIndex]!.memberIndex)))
            }
            isKnockedOut={Boolean(animatingKnockout?.side === 'opponent' && opponentSlots[rowIndex] && animatingKnockout.memberIndex === opponentSlots[rowIndex]?.memberIndex)}
            isEntering={Boolean(animatingEntry?.some((e) => e.side === 'opponent' && opponentSlots[rowIndex] && e.memberIndex === opponentSlots[rowIndex]?.memberIndex))}
            isViableTarget={viableTargets.some((v) => v.side === 'opponent' && v.memberIndex === opponentSlots[rowIndex]?.memberIndex)}
            isSelectedTarget={targetSide === 'opponent' && opponentSlots[rowIndex] != null && selectedTargets.includes(opponentSlots[rowIndex]!.memberIndex)}
            isTargetDisabled={
              targetExpectedCount > 0 &&
              selectedTargets.length >= targetExpectedCount &&
              viableTargets.some((v) => v.side === 'opponent' && v.memberIndex === opponentSlots[rowIndex]?.memberIndex) &&
              !selectedTargets.includes(opponentSlots[rowIndex]?.memberIndex ?? -1)
            }
            onTargetClick={
              onBoardTargetClick && opponentSlots[rowIndex] != null
                ? () => onBoardTargetClick('opponent', opponentSlots[rowIndex]!.memberIndex)
                : undefined
            }
          />
        </Fragment>
      ))}
    </div>
  );
}

function BattleBoardCard({
  critter,
  sideClass,
  sideLabel,
  slotIndex,
  critterById,
  catalogs,
  phase,
  isAttacking,
  isTarget,
  isKnockedOut,
  isEntering,
  isViableTarget = false,
  isSelectedTarget = false,
  isTargetDisabled = false,
  onTargetClick,
}: {
  critter: DuelBattleController['state']['player']['team'][number] | null;
  sideClass: 'player' | 'opponent';
  sideLabel: string;
  slotIndex: number;
  critterById: Map<number, CritterDefinition>;
  catalogs: DuelCatalogContent;
  phase: DuelPhase;
  isAttacking?: boolean;
  isTarget?: boolean;
  isKnockedOut?: boolean;
  isEntering?: boolean;
  isViableTarget?: boolean;
  isSelectedTarget?: boolean;
  isTargetDisabled?: boolean;
  onTargetClick?: () => void;
}) {
  const [displayedHpPercent, setDisplayedHpPercent] = useState<number>(() => calcDuelHpPercent(critter));
  const [hpBarTransitionMs, setHpBarTransitionMs] = useState(0);
  const previousHpIdentityRef = useRef<{ critterId: number; memberIndex: number; maxHp: number } | null>(
    critter ? { critterId: critter.critterId, memberIndex: critter.memberIndex, maxHp: critter.maxHp } : null,
  );
  const previousAnimatedHpRef = useRef<number>(calcDuelHpPercent(critter));

  useEffect(() => {
    if (!critter) {
      previousHpIdentityRef.current = null;
      previousAnimatedHpRef.current = 0;
      setHpBarTransitionMs(0);
      setDisplayedHpPercent(0);
      return;
    }
    const nextPercent = calcDuelHpPercent(critter);
    const previousHpIdentity = previousHpIdentityRef.current;
    const isNewCritter =
      !previousHpIdentity ||
      previousHpIdentity.critterId !== critter.critterId ||
      previousHpIdentity.memberIndex !== critter.memberIndex ||
      previousHpIdentity.maxHp !== critter.maxHp;

    if (isNewCritter) {
      previousHpIdentityRef.current = { critterId: critter.critterId, memberIndex: critter.memberIndex, maxHp: critter.maxHp };
      setHpBarTransitionMs(0);
      setDisplayedHpPercent(100);
      const targetPercent = nextPercent;
      previousAnimatedHpRef.current = targetPercent;
      const animMs = calcDuelHpAnimationMs(100 - targetPercent);
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHpBarTransitionMs(animMs);
          setDisplayedHpPercent(targetPercent);
        });
      });
      return () => cancelAnimationFrame(rafId);
    }
    const deltaPercent = Math.abs(nextPercent - previousAnimatedHpRef.current);
    previousAnimatedHpRef.current = nextPercent;
    setHpBarTransitionMs(calcDuelHpAnimationMs(deltaPercent));
    setDisplayedHpPercent(nextPercent);
    previousHpIdentityRef.current = { critterId: critter.critterId, memberIndex: critter.memberIndex, maxHp: critter.maxHp };
  }, [critter?.critterId, critter?.memberIndex, critter?.currentHp, critter?.maxHp]);

  const effectDisplay = critter && catalogs
    ? getDuelCritterEffectIconsAndTooltips(critter, catalogs)
    : { iconUrls: [], tooltips: [] };

  if (!critter) {
    const isBlankLeadSlot = phase === 'choose-leads';
    return (
      <article className={`duel-board-card duel-board-card--${sideClass} duel-board-card--empty`}>
        <p className="duel-board-card__side">
          {sideLabel} Slot {slotIndex + 1}
        </p>
        {isBlankLeadSlot ? (
          <div className="duel-board-card__sprite-fallback duel-board-card__sprite-fallback--blank" aria-hidden />
        ) : (
          <p className="duel-board-card__empty">Awaiting critter</p>
        )}
      </article>
    );
  }

  const critterDef = critterById.get(critter.critterId);
  const effectiveAttack = Math.max(1, critter.attack * Math.max(MIN_BATTLE_STAT_MODIFIER, critter.attackModifier));
  const effectiveDefense = Math.max(1, critter.defense * Math.max(MIN_BATTLE_STAT_MODIFIER, critter.defenseModifier));
  const effectiveSpeed = Math.max(1, critter.speed * Math.max(MIN_BATTLE_STAT_MODIFIER, critter.speedModifier));
  const hpFillStyle: CSSProperties = {
    width: `${displayedHpPercent}%`,
    transitionProperty: 'width',
    transitionDuration: `${hpBarTransitionMs}ms`,
    transitionTimingFunction: 'linear',
  };

  return (
    <article
      className={`duel-board-card duel-board-card--${sideClass} ${critter.fainted ? 'is-fainted' : ''} ${isViableTarget && !isTargetDisabled ? 'duel-board-card--viable-target' : ''} ${isSelectedTarget ? 'duel-board-card--selected-target' : ''} ${isTargetDisabled ? 'duel-board-card--target-disabled' : ''}`}
      role={onTargetClick && !isTargetDisabled ? 'button' : undefined}
      tabIndex={onTargetClick && !isTargetDisabled ? 0 : undefined}
      onClick={onTargetClick && !isTargetDisabled ? onTargetClick : undefined}
      onKeyDown={
        onTargetClick && !isTargetDisabled
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTargetClick();
              }
            }
          : undefined
      }
    >
      <p className="duel-board-card__side">
        {sideLabel} Slot {slotIndex + 1}
      </p>
      {critterDef?.spriteUrl ? (
        <img
          src={critterDef.spriteUrl}
          alt={critter.name}
          className={`duel-board-card__sprite ${isAttacking ? 'is-attacking' : ''} ${isTarget ? 'is-target' : ''} ${isKnockedOut ? 'is-knocked-out' : ''} ${isEntering ? 'is-entering' : ''}`}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className={`duel-board-card__sprite-fallback ${isAttacking ? 'is-attacking' : ''} ${isTarget ? 'is-target' : ''} ${isKnockedOut ? 'is-knocked-out' : ''} ${isEntering ? 'is-entering' : ''}`}>No Sprite</div>
      )}
      <p className="duel-board-card__name">{critter.name}</p>
      <p className="duel-board-card__meta">Lv {critter.level}</p>
      <div className="duel-hp-bar duel-board-card__hp-bar--narrow">
        <span className="duel-hp-bar__fill" style={hpFillStyle} />
      </div>
      <p className="duel-board-card__meta">
        HP {critter.currentHp}/{critter.maxHp}
      </p>
      <p className="duel-board-card__meta">
        ATK {formatBattleStatDisplay(effectiveAttack)} | DEF {formatBattleStatDisplay(effectiveDefense)} | SPD{' '}
        {formatBattleStatDisplay(effectiveSpeed)}
      </p>
      <div
        className="duel-board-card__effect-bubbles duel-board-card__effect-bubbles--below-stats"
        aria-label={effectDisplay.iconUrls.length > 0 ? 'Active effects' : 'No active effects'}
      >
        {effectDisplay.iconUrls.map((url, i) => (
          <span
            key={`${url}-${i}`}
            className="duel-board-card__effect-bubble"
            title={effectDisplay.tooltips[i]?.trim() || undefined}
          >
            <img src={url} alt="" className="duel-board-card__effect-icon" loading="lazy" decoding="async" />
          </span>
        ))}
      </div>
    </article>
  );
}

function BattleActionPanel({
  side,
  format,
  sideState,
  opposingState,
  actionDrafts,
  catalogs,
  onChangeDraft,
  onSkillRequiresTargetSelection,
  onClearTargetSelection,
  boardTargetingActive = false,
  onSubmitTurn,
  turnNumber,
}: {
  side: DuelSideId;
  format: DuelBattleFormat;
  sideState: DuelBattleController['state']['player'];
  opposingState: DuelBattleController['state']['player'];
  actionDrafts: Record<number, ActionDraft>;
  catalogs: DuelCatalogContent;
  onChangeDraft: (actorMemberIndex: number, patch: Partial<ActionDraft>) => void;
  onSkillRequiresTargetSelection?: (actorMemberIndex: number, skillSlotIndex: number) => void;
  onClearTargetSelection?: () => void;
  boardTargetingActive?: boolean;
  onSubmitTurn: () => void;
  turnNumber: number;
}) {
  const skillById = new Map(catalogs.skills.map((s) => [s.skill_id, s] as const));
  const itemById = new Map(catalogs.items.map((entry) => [entry.id, entry] as const));
  const equipmentEffectById = new Map(catalogs.equipmentEffects.map((entry) => [entry.effect_id, entry] as const));
  const equipmentItemByName = new Map(
    catalogs.items
      .filter((entry) => entry.category === 'equipment')
      .map((entry) => [entry.name.trim().toLowerCase(), entry] as const),
  );
  const iconsBucketRoot = useMemo(() => getDuelIconsBucketRoot(catalogs), [catalogs]);
  const activeActors = getAliveActiveMemberIndices(sideState);
  const aliveOpponents = getAliveActiveMemberIndices(opposingState);
  const aliveAllies = getAliveActiveMemberIndices(sideState);
  const aliveBench = sideState.team.filter(
    (c) => !c.fainted && c.currentHp > 0 && !sideState.activeMemberIndices.includes(c.memberIndex),
  );

  const [controlView, setControlView] = useState<'main' | 'skill' | 'squad'>('main');
  const [actorCursor, setActorCursor] = useState(0);
  const [pendingSkillSlot, setPendingSkillSlot] = useState<number | null>(null);

  useEffect(() => {
    setActorCursor(0);
    setControlView('main');
    setPendingSkillSlot(null);
  }, [turnNumber, sideState.id]);

  const clampedActorCursor =
    activeActors.length <= 0
      ? 0
      : Math.max(0, Math.min(actorCursor, activeActors.length - 1));
  const currentActorMemberIndex = activeActors[clampedActorCursor] ?? null;
  const currentActor = currentActorMemberIndex !== null ? sideState.team[currentActorMemberIndex] ?? null : null;
  const currentDraft = currentActorMemberIndex !== null ? actionDrafts[currentActorMemberIndex] : null;
  const previousActorMemberIndex = clampedActorCursor > 0 ? activeActors[clampedActorCursor - 1] ?? null : null;
  const canStepBackActor = previousActorMemberIndex !== null && isDraftComplete(previousActorMemberIndex);

  function isDraftComplete(actorMemberIndex: number): boolean {
    const draft = actionDrafts[actorMemberIndex];
    const actor = sideState.team[actorMemberIndex];
    if (!draft || !actor || actor.fainted) return false;
    if (draft.kind === 'guard' || draft.kind === 'forfeit') return true;
    if (draft.kind === 'swap') {
      return aliveBench.some((c) => c.memberIndex === draft.benchMemberIndex);
    }
    const skillId = actor.equippedSkillIds[draft.skillSlotIndex];
    const skill = skillId ? skillById.get(skillId) : null;
    if (!skill) return false;
    if (format === 'singles') return true;
    const expectedCount = getSkillTargetCount(skill, format);
    const targets = draft.targetMemberIndices ?? (draft.targetMemberIndex !== undefined ? [draft.targetMemberIndex] : []);
    if (targets.length !== expectedCount) return false;
    if (skill.type === 'damage') return targets.every((t) => aliveOpponents.includes(t));
    return targets.every((t) => aliveAllies.includes(t));
  }

  const swapTargets = activeActors.map((i) => actionDrafts[i]?.kind === 'swap' && actionDrafts[i]?.benchMemberIndex).filter((x): x is number => typeof x === 'number');
  const hasDuplicateSwap = new Set(swapTargets).size !== swapTargets.length;
  const allActorsHaveDrafts = activeActors.length > 0 && activeActors.every((i) => isDraftComplete(i)) && !hasDuplicateSwap;

  const resolveFallbackTarget = (group: 'enemy' | 'ally') => {
    if (group === 'enemy') return aliveOpponents[0] ?? 0;
    return aliveAllies[0] ?? 0;
  };

  const handleSubmitTurn = () => {
    if (!allActorsHaveDrafts) return;
    onSubmitTurn();
  };

  const handlePrimarySubmitClick = () => {
    if (allActorsHaveDrafts) {
      handleSubmitTurn();
      return;
    }
    if (currentActorMemberIndex === null || !isDraftComplete(currentActorMemberIndex)) {
      return;
    }
    const nextUnreadyIndex = activeActors.findIndex((memberIndex) => !isDraftComplete(memberIndex));
    if (nextUnreadyIndex < 0) {
      onSubmitTurn();
      return;
    }
    setActorCursor(nextUnreadyIndex);
    setControlView('main');
    setPendingSkillSlot(null);
    onClearTargetSelection?.();
  };

  const handleRetreat = () => {
    if (currentActorMemberIndex === null) return;
    onChangeDraft(currentActorMemberIndex, { kind: 'forfeit', skillSlotIndex: 0, targetMemberIndex: 0, benchMemberIndex: 0 });
  };

  const handleGuard = () => {
    if (currentActorMemberIndex === null) return;
    onChangeDraft(currentActorMemberIndex, { kind: 'guard', skillSlotIndex: 0, targetMemberIndex: 0, benchMemberIndex: 0 });
  };

  if (activeActors.length === 0) {
    return <p>No active critters.</p>;
  }

  const currentActorCanSwap = aliveBench.length > 0;
  const locked = currentActorMemberIndex === null;

  return (
    <div className="duel-battle__control-inner">
      {currentActor && (
        <p className="duel-battle__control-actor">
          Selecting for: <strong>{currentActor.name}</strong>
        </p>
      )}
      {activeActors.length > 1 && <p className="admin-note">Critter {clampedActorCursor + 1}/{activeActors.length}</p>}

      {controlView === 'main' && (
        <>
          <div className="duel-battle__control-strip">
            <button type="button" className="secondary" disabled={locked} onClick={() => setControlView('skill')}>
              Skill
            </button>
            <button type="button" className="secondary" disabled={locked || !currentActorCanSwap} onClick={() => setControlView('squad')}>
              Squad
            </button>
            <button type="button" className="secondary" disabled={locked} onClick={handleGuard}>
              Guard
            </button>
            <button type="button" className="secondary" disabled={locked} onClick={handleRetreat}>
              Retreat
            </button>
          </div>
          <button
            type="button"
            className="duel-battle__back-btn"
            disabled={!canStepBackActor}
            onClick={() => {
              if (!canStepBackActor) return;
              setActorCursor((current) => Math.max(0, current - 1));
              setControlView('main');
              setPendingSkillSlot(null);
              onClearTargetSelection?.();
            }}
          >
            Back
          </button>
        </>
      )}

      {controlView === 'skill' && currentActor && (
        <>
          <div className="duel-battle__control-strip">
            {[0, 1, 2, 3].map((slotIndex) => {
              const skillId = currentActor.equippedSkillIds[slotIndex];
              const skill = skillId ? skillById.get(skillId) : null;
              const isSelected = currentDraft?.kind === 'skill' && currentDraft.skillSlotIndex === slotIndex;
              const elementKey = skill ? (skill.element ?? '').toString().trim().toLowerCase() : '';
              const elementColor =
                elementKey && elementKey in ELEMENT_SKILL_COLORS
                  ? ELEMENT_SKILL_COLORS[elementKey as CritterElement]
                  : undefined;
              const elementLogoUrl = skill ? buildElementLogoUrlFromIconsBucket(skill.element, iconsBucketRoot) : null;
              const value = skill ? getSkillValueDisplayNumber(skill) : null;
              const effectIconUrls = skill ? getSkillEffectIconUrlsForDuel(skill, catalogs) : [];
              const typeLabel = skill?.type === 'damage' ? 'D' : 'S';
              const tileStyle: CSSProperties | undefined = elementColor
                ? {
                    background: elementColor,
                    color: getContrastTextForColor(elementColor),
                    borderColor: 'rgba(0,0,0,0.25)',
                    boxShadow: 'none',
                  }
                : undefined;
              return (
                <button
                  key={`skill-${slotIndex}`}
                  type="button"
                  className={`duel-skill-slot ${elementColor ? 'duel-skill-slot--element' : ''} ${isSelected ? 'is-selected' : ''} ${!skill ? 'secondary' : ''}`}
                  style={tileStyle}
                  disabled={!skill}
                  title={skill ? buildDuelSkillTooltip(skill, catalogs) : undefined}
                  onClick={() => {
                    if (!skill) return;
                    if (format === 'singles') {
                      const target = skill.type === 'damage' ? resolveFallbackTarget('enemy') : resolveFallbackTarget('ally');
                      onChangeDraft(currentActorMemberIndex!, { kind: 'skill', skillSlotIndex: slotIndex, targetMemberIndex: target, benchMemberIndex: 0 });
                    } else {
                      setPendingSkillSlot(slotIndex);
                      onSkillRequiresTargetSelection?.(currentActorMemberIndex!, slotIndex);
                    }
                  }}
                >
                  {skill ? (
                    <>
                      {elementLogoUrl && (
                        <img src={elementLogoUrl} alt={skill.element} className="skill-cell__element-logo" loading="lazy" decoding="async" />
                      )}
                      <span className="skill-cell__name">{skill.skill_name}</span>
                      <span className="skill-cell__spacer"> </span>
                      <span className="skill-cell__type">{typeLabel}</span>
                      {value != null && <span className="skill-cell__value">{value}</span>}
                      {effectIconUrls.map((url, i) => (
                        <img key={`effect-${slotIndex}-${i}`} src={url} alt="" className="skill-cell__effect-icon" loading="lazy" decoding="async" />
                      ))}
                    </>
                  ) : (
                    <span>Slot {slotIndex + 1}</span>
                  )}
                </button>
              );
            })}
          </div>
          {(format === 'doubles' || format === 'triples') && pendingSkillSlot !== null && currentActor && boardTargetingActive && (
            <p className="admin-note">Click a glowing card on the board to select target(s).</p>
          )}
          <button type="button" className="secondary" onClick={() => setControlView('main')}>
            Back
          </button>
        </>
      )}

      {controlView === 'squad' && (
        <>
          <div className={`duel-battle__squad-grid ${side === 'player' ? 'duel-battle__squad-grid--player' : ''}`}>
            {aliveBench.map((critter) => {
              const isSelected = currentDraft?.kind === 'swap' && currentDraft.benchMemberIndex === critter.memberIndex;
              const equippedItems = getDuelCritterEquippedItemsForDisplay(critter, itemById, equipmentItemByName).slice(0, 3);
              return (
                <button
                  key={`bench-${critter.memberIndex}`}
                  type="button"
                  className={`duel-battle__squad-tile ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    if (currentActorMemberIndex === null) return;
                    onChangeDraft(currentActorMemberIndex, { kind: 'swap', skillSlotIndex: 0, targetMemberIndex: 0, benchMemberIndex: critter.memberIndex });
                  }}
                >
                  {critter.spriteUrl ? <img src={critter.spriteUrl} alt={critter.name} className="duel-battle__squad-tile-sprite" /> : <span>?</span>}
                  <span>{critter.name}</span>
                  {equippedItems.length > 0 && (
                    <span className="duel-battle__squad-items">
                      {equippedItems.map((item, index) => {
                        const tooltip = getItemEquipmentTooltip(item, item.id, equipmentEffectById);
                        return item.imageUrl ? (
                          <img
                            key={`swap-item-${critter.memberIndex}-${item.id}-${index}`}
                            src={item.imageUrl}
                            alt={item.name}
                            title={tooltip}
                            className="duel-battle__squad-item-icon"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span key={`swap-item-${critter.memberIndex}-${item.id}-${index}`} title={tooltip} className="duel-battle__squad-item-dot">
                            •
                          </span>
                        );
                      })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button type="button" className="secondary" onClick={() => setControlView('main')}>
            Back
          </button>
        </>
      )}

      {hasDuplicateSwap && <p className="duel-field-error">Two critters cannot swap into the same bench target.</p>}

      <div className="duel-battle__control-submit">
        <button
          type="button"
          className="primary"
          disabled={
            allActorsHaveDrafts
              ? false
              : currentActorMemberIndex === null || !isDraftComplete(currentActorMemberIndex!) || hasDuplicateSwap
          }
          onClick={handlePrimarySubmitClick}
        >
          {allActorsHaveDrafts ? 'Submit Actions' : 'Submit Action'}
        </button>
      </div>
    </div>
  );
}

function LeadSelectionPanel({
  side,
  sideState,
  catalogs,
  required,
  selected,
  onToggle,
  onSubmit,
}: {
  side: DuelSideId;
  sideState: DuelBattleController['state']['player'];
  catalogs: DuelCatalogContent;
  required: number;
  selected: number[];
  onToggle: (memberIndex: number) => void;
  onSubmit: () => void;
}) {
  const itemById = new Map(catalogs.items.map((entry) => [entry.id, entry] as const));
  const equipmentEffectById = new Map(catalogs.equipmentEffects.map((entry) => [entry.effect_id, entry] as const));
  const equipmentItemByName = new Map(
    catalogs.items
      .filter((entry) => entry.category === 'equipment')
      .map((entry) => [entry.name.trim().toLowerCase(), entry] as const),
  );

  return (
    <div className="duel-lead-panel">
      <p>Select {required} lead critter(s) for {sideState.label}.</p>
      <div
        className={`duel-critter-option-grid duel-critter-option-grid--square ${
          side === 'player' ? 'duel-critter-option-grid--player' : ''
        }`}
      >
        {sideState.team.map((critter) => {
          const disabled = critter.fainted || critter.currentHp <= 0;
          const isSelected = selected.includes(critter.memberIndex);
          const equippedItems = getDuelCritterEquippedItemsForDisplay(critter, itemById, equipmentItemByName).slice(0, 3);
          return (
            <button
              key={`lead-${side}-${critter.memberIndex}`}
              type="button"
              className={`secondary duel-critter-option duel-critter-option--square ${isSelected ? 'is-selected' : ''}`}
              disabled={disabled}
              onClick={() => onToggle(critter.memberIndex)}
            >
              {critter.spriteUrl ? (
                <img src={critter.spriteUrl} alt={critter.name} className="duel-critter-option__sprite" loading="lazy" decoding="async" />
              ) : (
                <div className="duel-critter-option__sprite-fallback">No Sprite</div>
              )}
              <span className="duel-critter-option__name">{critter.name}</span>
              {equippedItems.length > 0 && (
                <span className="duel-critter-option__items">
                  {equippedItems.map((item, index) => {
                    const tooltip = getItemEquipmentTooltip(item, item.id, equipmentEffectById);
                    return item.imageUrl ? (
                      <img
                        key={`lead-item-${side}-${critter.memberIndex}-${item.id}-${index}`}
                        src={item.imageUrl}
                        alt={item.name}
                        title={tooltip}
                        className="duel-critter-option__item-icon"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span key={`lead-item-${side}-${critter.memberIndex}-${item.id}-${index}`} title={tooltip} className="duel-critter-option__item-dot">
                        •
                      </span>
                    );
                  })}
                </span>
              )}
              <span className="duel-critter-option__meta">
                Lv {critter.level} | HP {critter.currentHp}/{critter.maxHp}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className="primary" onClick={onSubmit}>
        Lock Leads
      </button>
    </div>
  );
}

function ActionSelectionPanel({
  side,
  format,
  sideState,
  opposingState,
  actionDrafts,
  catalogs,
  onChangeDraft,
  onSubmit,
}: {
  side: DuelSideId;
  format: DuelBattleFormat;
  sideState: DuelBattleController['state']['player'];
  opposingState: DuelBattleController['state']['player'];
  actionDrafts: Record<number, ActionDraft>;
  catalogs: DuelCatalogContent;
  onChangeDraft: (actorMemberIndex: number, patch: Partial<ActionDraft>) => void;
  onSubmit: () => void;
}) {
  const skillById = new Map(catalogs.skills.map((entry) => [entry.skill_id, entry] as const));
  const activeActors = sideState.activeMemberIndices.filter((memberIndex) => {
    const critter = sideState.team[memberIndex];
    return Boolean(critter && !critter.fainted && critter.currentHp > 0);
  });
  const aliveOpponents = getAliveActiveMemberIndices(opposingState);
  const aliveAllies = getAliveActiveMemberIndices(sideState);
  const aliveBench = sideState.team.filter(
    (entry) => !entry.fainted && entry.currentHp > 0 && !sideState.activeMemberIndices.includes(entry.memberIndex),
  );
  const [actorCursor, setActorCursor] = useState(0);
  const [step, setStep] = useState<'skills' | 'commands' | 'target' | 'swap'>('skills');
  const [pendingSkillSlotIndex, setPendingSkillSlotIndex] = useState<number | null>(null);
  const [pendingTargetGroup, setPendingTargetGroup] = useState<'enemy' | 'ally'>('enemy');
  const [optionPage, setOptionPage] = useState(0);

  const actorKey = activeActors.join(',');
  useEffect(() => {
    setActorCursor((current) => {
      if (activeActors.length <= 0) {
        return 0;
      }
      return Math.max(0, Math.min(current, activeActors.length - 1));
    });
    setStep('skills');
    setPendingSkillSlotIndex(null);
    setPendingTargetGroup('enemy');
    setOptionPage(0);
  }, [side, actorKey]);

  const currentActorMemberIndex = activeActors[actorCursor] ?? null;
  const currentActor = currentActorMemberIndex === null ? null : sideState.team[currentActorMemberIndex] ?? null;
  const currentDraft = currentActorMemberIndex === null ? null : actionDrafts[currentActorMemberIndex] ?? null;

  const resetStep = () => {
    setStep('skills');
    setPendingSkillSlotIndex(null);
    setPendingTargetGroup('enemy');
    setOptionPage(0);
  };

  const moveToActor = (nextCursor: number) => {
    if (activeActors.length <= 0) {
      setActorCursor(0);
      resetStep();
      return;
    }
    setActorCursor(Math.max(0, Math.min(activeActors.length - 1, nextCursor)));
    resetStep();
  };

  const resolveFallbackTarget = (actorMemberIndex: number, group: 'enemy' | 'ally'): number => {
    if (group === 'enemy') {
      return aliveOpponents[0] ?? actorMemberIndex;
    }
    return aliveAllies[0] ?? actorMemberIndex;
  };

  const buildNextDraft = (actorMemberIndex: number, patch: Partial<ActionDraft>): ActionDraft => {
    const current = actionDrafts[actorMemberIndex];
    const nextKind = patch.kind ?? current?.kind ?? 'skill';
    return {
      kind: nextKind,
      skillSlotIndex: patch.skillSlotIndex ?? current?.skillSlotIndex ?? 0,
      targetMemberIndex: patch.targetMemberIndex ?? current?.targetMemberIndex ?? resolveFallbackTarget(actorMemberIndex, 'enemy'),
      targetMemberIndices: nextKind !== 'skill' ? undefined : (patch.targetMemberIndices !== undefined ? patch.targetMemberIndices : current?.targetMemberIndices),
      benchMemberIndex: patch.benchMemberIndex ?? current?.benchMemberIndex ?? aliveBench[0]?.memberIndex ?? 0,
      ...patch,
    };
  };

  const commitActorDraft = (actorMemberIndex: number, patch: Partial<ActionDraft>) => {
    onChangeDraft(actorMemberIndex, buildNextDraft(actorMemberIndex, patch));
    if (activeActors.length > 1) {
      setActorCursor((current) => Math.max(0, Math.min(activeActors.length - 1, current + 1)));
    }
    resetStep();
  };

  const describeActionForActor = (actorMemberIndex: number): string => {
    const draft = actionDrafts[actorMemberIndex];
    if (!draft) {
      return 'Action not selected';
    }
    if (draft.kind === 'guard') {
      return 'Guard';
    }
    if (draft.kind === 'forfeit') {
      return 'Forfeit';
    }
    if (draft.kind === 'swap') {
      const target = sideState.team[draft.benchMemberIndex];
      return target ? `Swap -> ${target.name}` : 'Swap';
    }
    const actor = sideState.team[actorMemberIndex];
    if (!actor) {
      return 'Skill';
    }
    const skillId = actor.equippedSkillIds[draft.skillSlotIndex] ?? null;
    const skill = skillId ? skillById.get(skillId) ?? null : null;
    if (!skill) {
      return `Skill Slot ${draft.skillSlotIndex + 1}`;
    }
    const targetPool = skill.type === 'damage' ? opposingState.team : sideState.team;
    const target = targetPool[draft.targetMemberIndex];
    return target ? `${skill.skill_name} -> ${target.name}` : skill.skill_name;
  };

  const isActorActionReady = (actorMemberIndex: number): boolean => {
    const draft = actionDrafts[actorMemberIndex];
    const actor = sideState.team[actorMemberIndex];
    if (!draft || !actor || actor.fainted || actor.currentHp <= 0) {
      return false;
    }
    if (draft.kind === 'guard' || draft.kind === 'forfeit') {
      return true;
    }
    if (draft.kind === 'swap') {
      return aliveBench.some((entry) => entry.memberIndex === draft.benchMemberIndex);
    }
    const skillId = actor.equippedSkillIds[draft.skillSlotIndex] ?? null;
    const skill = skillId ? skillById.get(skillId) ?? null : null;
    if (!skill) {
      return false;
    }
    if (format === 'singles') {
      return true;
    }
    if (skill.type === 'damage') {
      return aliveOpponents.includes(draft.targetMemberIndex);
    }
    return aliveAllies.includes(draft.targetMemberIndex);
  };

  const swapTargets: number[] = [];
  activeActors.forEach((actorMemberIndex) => {
    const draft = actionDrafts[actorMemberIndex];
    if (draft?.kind === 'swap') {
      swapTargets.push(draft.benchMemberIndex);
    }
  });
  const hasDuplicateSwapTargets = new Set(swapTargets).size !== swapTargets.length;
  const allActorsReady =
    activeActors.length > 0 &&
    activeActors.every((actorMemberIndex) => isActorActionReady(actorMemberIndex)) &&
    !hasDuplicateSwapTargets;

  const currentActorCanSwap = aliveBench.length > 0;
  const pendingTargetOptions = pendingTargetGroup === 'enemy' ? aliveOpponents : aliveAllies;
  const targetTeam = pendingTargetGroup === 'enemy' ? opposingState.team : sideState.team;
  const PAGE_SIZE = 4;
  const pageCount =
    step === 'swap'
      ? Math.max(1, Math.ceil(aliveBench.length / PAGE_SIZE))
      : step === 'target'
        ? Math.max(1, Math.ceil(pendingTargetOptions.length / PAGE_SIZE))
        : 1;
  const pageStart = optionPage * PAGE_SIZE;

  useEffect(() => {
    setOptionPage((current) => Math.max(0, Math.min(current, pageCount - 1)));
  }, [pageCount]);

  if (!currentActor || currentActorMemberIndex === null) {
    return (
      <div>
        <p>No active critters are available for action selection.</p>
      </div>
    );
  }

  return (
    <div className="duel-action-sequential">
      <p>Select one critter action at a time. Use Previous/Next to review and edit before locking the turn.</p>
      <article className="duel-action-sequential__actor-card">
        <div className="duel-action-sequential__actor-head">
          <h4>{currentActor.name}</h4>
          <p>
            Critter {actorCursor + 1} / {activeActors.length}
          </p>
        </div>
        <p className="admin-note">
          HP {currentActor.currentHp}/{currentActor.maxHp} | Lv {currentActor.level}
        </p>
        <div className="duel-hp-bar">
          <span style={{ width: `${Math.max(0, Math.min(100, (currentActor.currentHp / Math.max(1, currentActor.maxHp)) * 100))}%` }} />
        </div>
      </article>

      <div className="duel-action-sequential__nav">
        <button
          type="button"
          className="secondary"
          onClick={() => moveToActor(actorCursor - 1)}
          disabled={actorCursor <= 0}
        >
          Previous Critter
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => moveToActor(actorCursor + 1)}
          disabled={actorCursor >= activeActors.length - 1}
        >
          Next Critter
        </button>
      </div>

      <section className="duel-action-sequential__step duel-action-sequential__step--deck">
        {(() => {
          const draftedSkillSlot = currentDraft?.kind === 'skill' ? currentDraft.skillSlotIndex : null;
          const draftedSkillId = draftedSkillSlot === null ? null : currentActor.equippedSkillIds[draftedSkillSlot] ?? null;
          const draftedSkill = draftedSkillId ? skillById.get(draftedSkillId) ?? null : null;
          const canOpenTargetTab = (format === 'doubles' || format === 'triples') && Boolean(draftedSkill);
          const isTargetingEnemy = pendingTargetGroup === 'enemy';

          return (
            <div className="duel-control-deck">
              <div className="duel-control-deck__tabs">
                <button
                  type="button"
                  className={`secondary ${step === 'skills' ? 'is-selected' : ''}`}
                  onClick={() => {
                    setStep('skills');
                    setOptionPage(0);
                  }}
                >
                  Skills
                </button>
                <button
                  type="button"
                  className={`secondary ${step === 'commands' ? 'is-selected' : ''}`}
                  onClick={() => {
                    setStep('commands');
                    setOptionPage(0);
                  }}
                >
                  Commands
                </button>
                <button
                  type="button"
                  className={`secondary ${step === 'swap' ? 'is-selected' : ''}`}
                  disabled={!currentActorCanSwap}
                  onClick={() => {
                    setStep('swap');
                    setOptionPage(0);
                  }}
                >
                  Party
                </button>
                <button
                  type="button"
                  className={`secondary ${step === 'target' ? 'is-selected' : ''}`}
                  disabled={!canOpenTargetTab}
                  onClick={() => {
                    if (draftedSkillSlot === null || !draftedSkill) {
                      return;
                    }
                    setPendingSkillSlotIndex(draftedSkillSlot);
                    setPendingTargetGroup(draftedSkill.type === 'damage' ? 'enemy' : 'ally');
                    setStep('target');
                    setOptionPage(0);
                  }}
                >
                  Target
                </button>
              </div>

              <div className="duel-control-grid">
                {step === 'skills' &&
                  [0, 1, 2, 3].map((slotIndex) => {
                    const skillId = currentActor.equippedSkillIds[slotIndex] ?? null;
                    const skill = skillId ? skillById.get(skillId) ?? null : null;
                    const skillValueText =
                      skill?.type === 'damage'
                        ? `Damage ${typeof skill.damage === 'number' ? Math.max(1, Math.floor(skill.damage)) : '--'}`
                        : 'Support';
                    const elementColor = skill ? ELEMENT_SKILL_COLORS[skill.element as keyof typeof ELEMENT_SKILL_COLORS] : undefined;
                    const tileStyle: CSSProperties | undefined = elementColor
                      ? ({
                          ['--duel-skill-bg' as string]: elementColor,
                          ['--duel-skill-fg' as string]: getContrastTextForColor(elementColor),
                        } as CSSProperties)
                      : undefined;
                    return (
                      <button
                        key={`action-${side}-${currentActorMemberIndex}-skill-slot-${slotIndex}`}
                        type="button"
                        className={`secondary duel-control-tile duel-control-tile--skill ${
                          currentDraft?.kind === 'skill' && currentDraft.skillSlotIndex === slotIndex ? 'is-selected' : ''
                        } ${elementColor ? 'duel-control-tile--element' : ''}`}
                        style={tileStyle}
                        disabled={!skill}
                        onClick={() => {
                          if (!skill) {
                            return;
                          }
                          if (format === 'singles') {
                            commitActorDraft(currentActorMemberIndex, {
                              kind: 'skill',
                              skillSlotIndex: slotIndex,
                              targetMemberIndex:
                                skill.type === 'damage'
                                  ? resolveFallbackTarget(currentActorMemberIndex, 'enemy')
                                  : resolveFallbackTarget(currentActorMemberIndex, 'ally'),
                            });
                            return;
                          }
                          setPendingSkillSlotIndex(slotIndex);
                          setPendingTargetGroup(skill.type === 'damage' ? 'enemy' : 'ally');
                          setStep('target');
                          setOptionPage(0);
                        }}
                      >
                        <span className="duel-control-tile__name">{skill ? skill.skill_name : `Slot ${slotIndex + 1} Empty`}</span>
                        <span className="duel-control-tile__meta">{skill ? `${skillValueText} | Pri ${skill.priority}` : 'Unavailable'}</span>
                        <span className="duel-control-tile__meta">{skill ? skill.element : 'No Skill Equipped'}</span>
                      </button>
                    );
                  })}

                {step === 'commands' && (
                  <>
                    <button
                      type="button"
                      className={`secondary duel-control-tile ${currentDraft?.kind === 'guard' ? 'is-selected' : ''}`}
                      onClick={() => {
                        commitActorDraft(currentActorMemberIndex, { kind: 'guard' });
                      }}
                    >
                      <span className="duel-control-tile__name">{ACTION_KIND_LABELS.guard}</span>
                      <span className="duel-control-tile__meta">Reduce incoming damage this turn.</span>
                    </button>
                    <button
                      type="button"
                      className={`secondary duel-control-tile ${currentDraft?.kind === 'swap' ? 'is-selected' : ''}`}
                      disabled={!currentActorCanSwap}
                      onClick={() => {
                        setStep('swap');
                        setOptionPage(0);
                      }}
                    >
                      <span className="duel-control-tile__name">{ACTION_KIND_LABELS.swap}</span>
                      <span className="duel-control-tile__meta">
                        {currentActorCanSwap ? 'Open party picks to choose a swap.' : 'No bench critter is available.'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`secondary duel-control-tile ${currentDraft?.kind === 'forfeit' ? 'is-selected' : ''}`}
                      onClick={() => {
                        commitActorDraft(currentActorMemberIndex, { kind: 'forfeit' });
                      }}
                    >
                      <span className="duel-control-tile__name">{ACTION_KIND_LABELS.forfeit}</span>
                      <span className="duel-control-tile__meta">Concede the duel immediately.</span>
                    </button>
                    <button
                      type="button"
                      className="secondary duel-control-tile"
                      onClick={() => {
                        setStep('skills');
                        setOptionPage(0);
                      }}
                    >
                      <span className="duel-control-tile__name">Back To Skills</span>
                      <span className="duel-control-tile__meta">Return to move selection.</span>
                    </button>
                  </>
                )}

                {step === 'swap' &&
                  Array.from({ length: PAGE_SIZE }, (_, pageIndex) => {
                    const entry = aliveBench[pageStart + pageIndex] ?? null;
                    if (!entry) {
                      return (
                        <button
                          key={`swap-empty-${pageIndex}`}
                          type="button"
                          className="secondary duel-control-tile duel-control-tile--empty"
                          disabled
                        >
                          <span className="duel-control-tile__name">Empty</span>
                          <span className="duel-control-tile__meta">No critter in this slot.</span>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={`swap-${entry.memberIndex}`}
                        type="button"
                        className={`secondary duel-control-tile duel-control-tile--critter ${
                          currentDraft?.kind === 'swap' && currentDraft.benchMemberIndex === entry.memberIndex ? 'is-selected' : ''
                        }`}
                        onClick={() =>
                          commitActorDraft(currentActorMemberIndex, {
                            kind: 'swap',
                            benchMemberIndex: entry.memberIndex,
                          })
                        }
                      >
                        {entry.spriteUrl ? (
                          <img src={entry.spriteUrl} alt={entry.name} className="duel-control-tile__sprite" loading="lazy" decoding="async" />
                        ) : (
                          <span className="duel-control-tile__sprite-fallback">No Sprite</span>
                        )}
                        <span className="duel-control-tile__name">{entry.name}</span>
                        <span className="duel-control-tile__meta">
                          Lv {entry.level} | HP {entry.currentHp}/{entry.maxHp}
                        </span>
                      </button>
                    );
                  })}

                {step === 'target' &&
                  Array.from({ length: PAGE_SIZE }, (_, pageIndex) => {
                    const targetMemberIndex = pendingTargetOptions[pageStart + pageIndex] ?? null;
                    const targetCritter = targetMemberIndex === null ? null : targetTeam[targetMemberIndex] ?? null;
                    if (targetCritter === null || targetMemberIndex === null) {
                      return (
                        <button
                          key={`target-empty-${pageIndex}`}
                          type="button"
                          className="secondary duel-control-tile duel-control-tile--empty"
                          disabled
                        >
                          <span className="duel-control-tile__name">Empty</span>
                          <span className="duel-control-tile__meta">No legal target in this slot.</span>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={`target-${targetMemberIndex}`}
                        type="button"
                        className={`secondary duel-control-tile duel-control-tile--critter ${
                          currentDraft?.kind === 'skill' && currentDraft.targetMemberIndex === targetMemberIndex ? 'is-selected' : ''
                        }`}
                        onClick={() => {
                          if (pendingSkillSlotIndex === null) {
                            return;
                          }
                          commitActorDraft(currentActorMemberIndex, {
                            kind: 'skill',
                            skillSlotIndex: pendingSkillSlotIndex,
                            targetMemberIndex,
                          });
                        }}
                      >
                        {targetCritter.spriteUrl ? (
                          <img
                            src={targetCritter.spriteUrl}
                            alt={targetCritter.name}
                            className="duel-control-tile__sprite"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="duel-control-tile__sprite-fallback">No Sprite</span>
                        )}
                        <span className="duel-control-tile__name">{targetCritter.name}</span>
                        <span className="duel-control-tile__meta">
                          Lv {targetCritter.level} | HP {targetCritter.currentHp}/{targetCritter.maxHp}
                        </span>
                      </button>
                    );
                  })}
              </div>

              {(step === 'target' || step === 'swap') && (
                <div className="duel-control-deck__footer">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      if (step === 'target') {
                        setStep('skills');
                        setPendingSkillSlotIndex(null);
                        setOptionPage(0);
                        return;
                      }
                      setStep('commands');
                      setOptionPage(0);
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setOptionPage((current) => Math.max(0, current - 1))}
                    disabled={optionPage <= 0}
                  >
                    Prev
                  </button>
                  <p className="duel-control-deck__page-indicator">
                    {step === 'target' ? (isTargetingEnemy ? 'Enemy Targets' : 'Ally Targets') : 'Party Slots'} • Page {optionPage + 1}/
                    {pageCount}
                  </p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setOptionPage((current) => Math.min(pageCount - 1, current + 1))}
                    disabled={optionPage >= pageCount - 1}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      <section className="duel-action-sequential__summary">
        {activeActors.map((actorMemberIndex, index) => {
          const actor = sideState.team[actorMemberIndex];
          const isReady = isActorActionReady(actorMemberIndex);
          return (
            <button
              key={`action-summary-${side}-${actorMemberIndex}`}
              type="button"
              className={`secondary ${index === actorCursor ? 'is-selected' : ''} ${isReady ? 'is-ready' : ''}`}
              onClick={() => moveToActor(index)}
            >
              <span>{actor?.name ?? `Critter ${actorMemberIndex + 1}`}</span>
              <small>{describeActionForActor(actorMemberIndex)}</small>
            </button>
          );
        })}
      </section>

      {hasDuplicateSwapTargets && <p className="duel-field-error">Two active critters cannot swap into the same bench target.</p>}
      {(format === 'doubles' || format === 'triples') && <p className="admin-note">Doubles and Triples require manual target selection for each selected skill.</p>}

      <div className="duel-action-sequential__lock">
        <button type="button" className="primary" onClick={onSubmit} disabled={!allActorsReady}>
          Lock Actions
        </button>
        {!allActorsReady && <p className="admin-note">Select a valid action for every active critter before locking.</p>}
      </div>
    </div>
  );
}

function ReplacementSelectionPanel({
  side,
  sideState,
  catalogs,
  needed,
  selected,
  onToggle,
  onSubmit,
}: {
  side: DuelSideId;
  sideState: DuelBattleController['state']['player'];
  catalogs: DuelCatalogContent;
  needed: number;
  selected: number[];
  onToggle: (memberIndex: number, needed: number) => void;
  onSubmit: () => void;
}) {
  const activeSet = new Set(sideState.activeMemberIndices);
  const options = sideState.team.filter((entry) => !entry.fainted && entry.currentHp > 0 && !activeSet.has(entry.memberIndex));
  const itemById = new Map(catalogs.items.map((entry) => [entry.id, entry] as const));
  const equipmentEffectById = new Map(catalogs.equipmentEffects.map((entry) => [entry.effect_id, entry] as const));
  const equipmentItemByName = new Map(
    catalogs.items
      .filter((entry) => entry.category === 'equipment')
      .map((entry) => [entry.name.trim().toLowerCase(), entry] as const),
  );

  return (
    <div className="duel-replacement-panel">
      <p>Select {needed} replacement critter(s).</p>
      <div
        className={`duel-critter-option-grid duel-critter-option-grid--compact ${
          side === 'player' ? 'duel-critter-option-grid--player' : ''
        }`}
      >
        {options.map((entry) => {
          const isSelected = selected.includes(entry.memberIndex);
          const equippedItems = getDuelCritterEquippedItemsForDisplay(entry, itemById, equipmentItemByName).slice(0, 3);
          return (
            <button
              key={`replacement-${sideState.id}-${entry.memberIndex}`}
              type="button"
              className={`secondary duel-critter-option duel-critter-option--compact ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onToggle(entry.memberIndex, needed)}
            >
              {entry.spriteUrl ? (
                <img src={entry.spriteUrl} alt={entry.name} className="duel-critter-option__sprite" loading="lazy" decoding="async" />
              ) : (
                <div className="duel-critter-option__sprite-fallback">No Sprite</div>
              )}
              <span className="duel-critter-option__name">{entry.name}</span>
              {equippedItems.length > 0 && (
                <span className="duel-critter-option__items">
                  {equippedItems.map((item, index) => {
                    const tooltip = getItemEquipmentTooltip(item, item.id, equipmentEffectById);
                    return item.imageUrl ? (
                      <img
                        key={`replacement-item-${side}-${entry.memberIndex}-${item.id}-${index}`}
                        src={item.imageUrl}
                        alt={item.name}
                        title={tooltip}
                        className="duel-critter-option__item-icon"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span key={`replacement-item-${side}-${entry.memberIndex}-${item.id}-${index}`} title={tooltip} className="duel-critter-option__item-dot">
                        •
                      </span>
                    );
                  })}
                </span>
              )}
              <span className="duel-critter-option__meta">
                Lv {entry.level} | HP {entry.currentHp}/{entry.maxHp}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className="primary" onClick={onSubmit}>
        Confirm Replacements
      </button>
    </div>
  );
}

function getReplacementNeededCount(format: DuelBattleFormat, sideState: DuelBattleController['state']['player']): number {
  const required = getRequiredLeadCount(format);
  const aliveActive = sideState.activeMemberIndices.filter((memberIndex) => {
    const critter = sideState.team[memberIndex];
    return Boolean(critter && !critter.fainted && critter.currentHp > 0);
  });
  return Math.max(0, required - aliveActive.length);
}

function getAliveActiveMemberIndices(sideState: DuelBattleController['state']['player']): number[] {
  return sideState.activeMemberIndices.filter((memberIndex) => {
    const critter = sideState.team[memberIndex];
    return Boolean(critter && !critter.fainted && critter.currentHp > 0);
  });
}

function getActionNarrationText(
  side: DuelSideId,
  battleState: DuelBattleController['state'],
  actionDraftBySide: Record<DuelSideId, Record<number, ActionDraft>>,
  format: DuelBattleFormat,
  catalogs: DuelCatalogContent,
): string {
  const sideState = side === 'player' ? battleState.player : battleState.opponent;
  const opposingState = side === 'player' ? battleState.opponent : battleState.player;
  const actionDrafts = actionDraftBySide[side] ?? {};
  const activeActors = getAliveActiveMemberIndices(sideState);
  const skillById = new Map(catalogs.skills.map((s) => [s.skill_id, s] as const));
  const aliveOpponents = getAliveActiveMemberIndices(opposingState);
  const aliveAllies = getAliveActiveMemberIndices(sideState);
  const parts: string[] = [];
  for (const actorMemberIndex of activeActors) {
    const draft = actionDrafts[actorMemberIndex];
    const actor = sideState.team[actorMemberIndex];
    if (!actor) continue;
    if (!draft) {
      parts.push(`${actor.name}: (selecting...)`);
      continue;
    }
    if (draft.kind === 'guard') {
      parts.push(`${actor.name}: Guard`);
      continue;
    }
    if (draft.kind === 'forfeit') {
      parts.push(`${actor.name}: Retreat`);
      continue;
    }
    if (draft.kind === 'swap') {
      const target = sideState.team[draft.benchMemberIndex];
      parts.push(`${actor.name}: Swap → ${target?.name ?? '?'}`);
      continue;
    }
    const skill = skillById.get(actor.equippedSkillIds[draft.skillSlotIndex] ?? '') ?? null;
    const skillName = skill?.skill_name ?? `Skill ${draft.skillSlotIndex + 1}`;
    if (format === 'singles') {
      parts.push(`${actor.name}: ${skillName}`);
    } else {
      const targetIndices = getDraftTargetIndices(draft);
      if (targetIndices.length <= 0) {
        parts.push(`${actor.name}: ${skillName} → (select target)`);
        continue;
      }
      const team = skill?.type === 'damage' ? opposingState.team : sideState.team;
      const targetNames = targetIndices.map((i) => team[i]?.name ?? '?').join(', ');
      parts.push(`${actor.name}: ${skillName} → ${targetNames}`);
    }
  }
  return parts.length > 0 ? parts.join(' | ') : 'Select an action.';
}

function getActiveBoardSlots(
  sideState: DuelBattleController['state']['player'],
  format: DuelBattleFormat,
): Array<DuelBattleController['state']['player']['team'][number] | null> {
  const required = getRequiredLeadCount(format);
  const slots: Array<DuelBattleController['state']['player']['team'][number] | null> = [];
  for (let index = 0; index < required; index += 1) {
    const memberIndex = sideState.activeMemberIndices[index];
    slots.push(memberIndex != null ? sideState.team[memberIndex] ?? null : null);
  }
  return slots;
}

function sortDuelSquads(squads: DuelSquad[]): DuelSquad[] {
  return [...squads].sort((left, right) => {
    if (left.sortIndex !== right.sortIndex) {
      return left.sortIndex - right.sortIndex;
    }
    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt.localeCompare(left.updatedAt);
    }
    return left.id.localeCompare(right.id);
  });
}
