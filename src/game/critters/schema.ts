import { BASE_CRITTER_DATABASE } from '@/game/critters/baseDatabase';
import {
  CRITTER_ABILITY_KINDS,
  CRITTER_ELEMENTS,
  CRITTER_MISSION_TYPES,
  CRITTER_RARITIES,
  MAX_SQUAD_SLOTS,
  PLAYER_CRITTER_PROGRESS_VERSION,
  STARTING_UNLOCKED_SQUAD_SLOTS,
  type CritterAbilityDefinition,
  type CritterAbilityKind,
  type CritterDefinition,
  type CritterElement,
  type CritterLevelMissionRequirement,
  type CritterLevelRequirement,
  type CritterMissionType,
  type CritterRarity,
  type CritterStats,
  type PlayerCritterCollectionEntry,
  type PlayerCritterProgress,
} from '@/game/critters/types';

const DEFAULT_CRITTER_STATS: CritterStats = {
  hp: 12,
  attack: 8,
  defense: 8,
  speed: 8,
};

const EMPTY_STAT_DELTA = {
  hp: 0,
  attack: 0,
  defense: 0,
  speed: 0,
};

const ELEMENT_SET = new Set<CritterElement>(CRITTER_ELEMENTS);
const RARITY_SET = new Set<CritterRarity>(CRITTER_RARITIES);
const ABILITY_KIND_SET = new Set<CritterAbilityKind>(CRITTER_ABILITY_KINDS);
const MISSION_TYPE_SET = new Set<CritterMissionType>(CRITTER_MISSION_TYPES);

export function missionProgressKey(level: number, missionId: string): string {
  return `L${Math.max(1, Math.floor(level))}:M${missionId}`;
}

export interface CritterDerivedProgress {
  statBonus: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  };
  effectiveStats: CritterStats;
  unlockedAbilityIds: string[];
}

export function computeCritterDerivedProgress(critter: CritterDefinition, level: number): CritterDerivedProgress {
  const safeLevel = Math.max(0, Math.floor(level));
  const statBonus = {
    hp: 0,
    attack: 0,
    defense: 0,
    speed: 0,
  };
  const abilityIds = new Set<string>();

  for (const levelRow of critter.levels) {
    // Level row N is earned when the critter reaches level N.
    if (levelRow.level > safeLevel) {
      continue;
    }
    statBonus.hp += levelRow.statDelta.hp;
    statBonus.attack += levelRow.statDelta.attack;
    statBonus.defense += levelRow.statDelta.defense;
    statBonus.speed += levelRow.statDelta.speed;
    for (const abilityId of levelRow.abilityUnlockIds) {
      abilityIds.add(abilityId);
    }
  }

  return {
    statBonus,
    effectiveStats: {
      hp: Math.max(1, critter.baseStats.hp + statBonus.hp),
      attack: Math.max(1, critter.baseStats.attack + statBonus.attack),
      defense: Math.max(1, critter.baseStats.defense + statBonus.defense),
      speed: Math.max(1, critter.baseStats.speed + statBonus.speed),
    },
    unlockedAbilityIds: [...abilityIds],
  };
}

export function buildCritterLookup(database: CritterDefinition[]): Record<number, CritterDefinition> {
  const lookup: Record<number, CritterDefinition> = {};
  for (const critter of database) {
    lookup[critter.id] = critter;
  }
  return lookup;
}

export function sanitizeCritterDatabase(raw: unknown): CritterDefinition[] {
  if (!Array.isArray(raw)) {
    return [...BASE_CRITTER_DATABASE];
  }

  const parsed: CritterDefinition[] = [];
  const seenIds = new Set<number>();
  for (let index = 0; index < raw.length; index += 1) {
    const critter = sanitizeCritterDefinition(raw[index], index);
    if (!critter || seenIds.has(critter.id)) {
      continue;
    }
    seenIds.add(critter.id);
    parsed.push(critter);
  }

  return parsed.length > 0 ? parsed : [...BASE_CRITTER_DATABASE];
}

export function sanitizeCritterDefinition(raw: unknown, index = 0): CritterDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = sanitizeCritterId(record.id, index + 1);
  const name = sanitizeName(record.name, `Critter ${id}`);
  const element = sanitizeElement(record.element);
  const rarity = sanitizeRarity(record.rarity);
  const description =
    typeof record.description === 'string' && record.description.trim()
      ? record.description.trim()
      : `${name} is ready for training.`;
  const spriteRecord =
    record.sprite && typeof record.sprite === 'object' && !Array.isArray(record.sprite)
      ? (record.sprite as Record<string, unknown>)
      : null;
  const spriteUrl = sanitizeCritterSpriteUrl(record.spriteUrl ?? spriteRecord?.url);
  const baseStats = sanitizeCritterStats(record.baseStats);
  const abilities = sanitizeAbilityDefinitions(record.abilities);
  const levels = sanitizeLevelRequirements(record.levels, abilities);

  return {
    id,
    name,
    element,
    rarity,
    description,
    spriteUrl,
    baseStats,
    abilities,
    levels,
  };
}

export function createDefaultPlayerCritterProgress(database: CritterDefinition[] = BASE_CRITTER_DATABASE): PlayerCritterProgress {
  return {
    version: PLAYER_CRITTER_PROGRESS_VERSION,
    unlockedSquadSlots: STARTING_UNLOCKED_SQUAD_SLOTS,
    squad: Array.from({ length: MAX_SQUAD_SLOTS }, () => null),
    collection: database.map((critter) => createDefaultCollectionEntry(critter)),
  };
}

export function sanitizePlayerCritterProgress(
  raw: unknown,
  database: CritterDefinition[] = BASE_CRITTER_DATABASE,
): PlayerCritterProgress {
  const defaults = createDefaultPlayerCritterProgress(database);
  const critterById = buildCritterLookup(database);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults;
  }

  const record = raw as Record<string, unknown>;
  const unlockedSquadSlots = clampInt(
    record.unlockedSquadSlots,
    STARTING_UNLOCKED_SQUAD_SLOTS,
    MAX_SQUAD_SLOTS,
    STARTING_UNLOCKED_SQUAD_SLOTS,
  );

  const rawCollection = Array.isArray(record.collection) ? record.collection : [];
  const collectionById = new Map<number, PlayerCritterCollectionEntry>();
  for (const rawEntry of rawCollection) {
    const parsedEntry = sanitizeCollectionEntry(rawEntry, critterById);
    if (!parsedEntry || collectionById.has(parsedEntry.critterId)) {
      continue;
    }
    collectionById.set(parsedEntry.critterId, parsedEntry);
  }

  const collection: PlayerCritterCollectionEntry[] = database.map((critter) => {
    const existing = collectionById.get(critter.id);
    if (!existing) {
      return createDefaultCollectionEntry(critter);
    }

    const progressTemplate = buildMissionProgressTemplate(critter);
    const mergedProgress: Record<string, number> = {};
    for (const [key, value] of Object.entries(progressTemplate)) {
      mergedProgress[key] = clampInt(existing.missionProgress[key], 0, 999999, 0);
    }

    const maxKnownLevel = getMaxConfiguredLevel(critter.levels);
    const safeUnlocked = existing.unlocked && existing.level > 0;
    const level = safeUnlocked
      ? clampInt(existing.level, 1, maxKnownLevel, 1)
      : clampInt(existing.level, 0, maxKnownLevel, 0);
    const unlocked = safeUnlocked && level > 0;
    const derived = computeCritterDerivedProgress(critter, level);
    const maxHp = Math.max(1, derived.effectiveStats.hp);
    const currentHp = unlocked ? clampInt(existing.currentHp, 0, maxHp, maxHp) : 0;
    return {
      critterId: critter.id,
      unlocked,
      unlockedAt: existing.unlockedAt,
      unlockSource: existing.unlockSource,
      level,
      currentHp,
      missionProgress: mergedProgress,
      statBonus: derived.statBonus,
      effectiveStats: derived.effectiveStats,
      unlockedAbilityIds: derived.unlockedAbilityIds,
      lastProgressAt: existing.lastProgressAt,
    };
  });

  const unlockedCritterIds = new Set(collection.filter((entry) => entry.unlocked).map((entry) => entry.critterId));
  const rawSquad = Array.isArray(record.squad) ? record.squad : [];
  const squad = Array.from({ length: MAX_SQUAD_SLOTS }, (_, index) => {
    if (index >= unlockedSquadSlots) {
      return null;
    }
    const rawId = rawSquad[index];
    const critterId = parseNumberish(rawId);
    if (critterId === null || !critterById[critterId] || !unlockedCritterIds.has(critterId)) {
      return null;
    }
    return critterId;
  });

  return {
    version: PLAYER_CRITTER_PROGRESS_VERSION,
    unlockedSquadSlots,
    squad,
    collection,
  };
}

function createDefaultCollectionEntry(critter: CritterDefinition): PlayerCritterCollectionEntry {
  const derived = computeCritterDerivedProgress(critter, 0);
  return {
    critterId: critter.id,
    unlocked: false,
    unlockedAt: null,
    unlockSource: null,
    level: 0,
    currentHp: 0,
    missionProgress: buildMissionProgressTemplate(critter),
    statBonus: derived.statBonus,
    effectiveStats: derived.effectiveStats,
    unlockedAbilityIds: derived.unlockedAbilityIds,
    lastProgressAt: null,
  };
}

function buildMissionProgressTemplate(critter: CritterDefinition): Record<string, number> {
  const template: Record<string, number> = {};
  for (const levelRow of critter.levels) {
    for (const mission of levelRow.missions) {
      template[missionProgressKey(levelRow.level, mission.id)] = 0;
    }
  }
  return template;
}

function sanitizeCollectionEntry(
  raw: unknown,
  critterById: Record<number, CritterDefinition>,
): PlayerCritterCollectionEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const critterId = parseNumberish(record.critterId);
  if (critterId === null || !critterById[critterId]) {
    return null;
  }

  const missionProgressRecord =
    record.missionProgress && typeof record.missionProgress === 'object' && !Array.isArray(record.missionProgress)
      ? (record.missionProgress as Record<string, unknown>)
      : {};
  const missionProgress: Record<string, number> = {};
  for (const [key, value] of Object.entries(missionProgressRecord)) {
    const safeKey = key.trim();
    if (!safeKey) {
      continue;
    }
    missionProgress[safeKey] = clampInt(value, 0, 999999, 0);
  }

  return {
    critterId,
    unlocked: Boolean(record.unlocked),
    unlockedAt: sanitizeIsoTimestamp(record.unlockedAt),
    unlockSource:
      typeof record.unlockSource === 'string' && record.unlockSource.trim() ? record.unlockSource.trim() : null,
    level: clampInt(record.level, 0, 99, 0),
    currentHp: clampInt(record.currentHp, 0, 999999, 0),
    missionProgress,
    statBonus: {
      hp: 0,
      attack: 0,
      defense: 0,
      speed: 0,
    },
    effectiveStats: {
      hp: 1,
      attack: 1,
      defense: 1,
      speed: 1,
    },
    unlockedAbilityIds: [],
    lastProgressAt: sanitizeIsoTimestamp(record.lastProgressAt),
  };
}

function sanitizeAbilityDefinitions(raw: unknown): CritterAbilityDefinition[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed: CritterAbilityDefinition[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < raw.length; index += 1) {
    const ability = sanitizeAbilityDefinition(raw[index], index);
    if (!ability || seen.has(ability.id)) {
      continue;
    }
    seen.add(ability.id);
    parsed.push(ability);
  }
  return parsed;
}

function sanitizeAbilityDefinition(raw: unknown, index: number): CritterAbilityDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = sanitizeSlug(record.id, `ability-${index + 1}`);
  const name = sanitizeName(record.name, `Ability ${index + 1}`);
  const kindRaw = typeof record.kind === 'string' ? record.kind.trim().toLowerCase() : 'passive';
  const kind = ABILITY_KIND_SET.has(kindRaw as CritterAbilityKind) ? (kindRaw as CritterAbilityKind) : 'passive';
  const description =
    typeof record.description === 'string' && record.description.trim() ? record.description.trim() : '';

  return {
    id,
    name,
    kind,
    description,
  };
}

function sanitizeLevelRequirements(
  raw: unknown,
  abilities: CritterAbilityDefinition[],
): CritterLevelRequirement[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const abilityIdSet = new Set(abilities.map((ability) => ability.id));
  const parsed: CritterLevelRequirement[] = [];
  const seenLevels = new Set<number>();
  for (let index = 0; index < raw.length; index += 1) {
    const levelRequirement = sanitizeLevelRequirement(raw[index], index, abilityIdSet);
    if (!levelRequirement || seenLevels.has(levelRequirement.level)) {
      continue;
    }
    seenLevels.add(levelRequirement.level);
    parsed.push(levelRequirement);
  }
  parsed.sort((a, b) => a.level - b.level);
  return parsed;
}

function sanitizeLevelRequirement(
  raw: unknown,
  index: number,
  abilityIdSet: Set<string>,
): CritterLevelRequirement | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const level = clampInt(record.level, 1, 99, index + 1);
  const missions = sanitizeLevelMissions(record.missions, level);
  const statDeltaRecord =
    record.statDelta && typeof record.statDelta === 'object' && !Array.isArray(record.statDelta)
      ? (record.statDelta as Record<string, unknown>)
      : {};
  const requiredMissionCount = clampInt(record.requiredMissionCount, 0, missions.length, missions.length);
  const abilityUnlockIds = sanitizeStringArray(record.abilityUnlockIds, 30).filter((id) => abilityIdSet.has(id));

  return {
    level,
    missions,
    requiredMissionCount,
    statDelta: {
      hp: clampInt(statDeltaRecord.hp, -999, 999, EMPTY_STAT_DELTA.hp),
      attack: clampInt(statDeltaRecord.attack, -999, 999, EMPTY_STAT_DELTA.attack),
      defense: clampInt(statDeltaRecord.defense, -999, 999, EMPTY_STAT_DELTA.defense),
      speed: clampInt(statDeltaRecord.speed, -999, 999, EMPTY_STAT_DELTA.speed),
    },
    abilityUnlockIds,
  };
}

function sanitizeLevelMissions(raw: unknown, level: number): CritterLevelMissionRequirement[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed: CritterLevelMissionRequirement[] = [];
  const seenIds = new Set<string>();
  for (let index = 0; index < raw.length; index += 1) {
    const mission = sanitizeLevelMission(raw[index], index, level);
    if (!mission || seenIds.has(mission.id)) {
      continue;
    }
    seenIds.add(mission.id);
    parsed.push(mission);
  }
  return parsed;
}

function sanitizeLevelMission(raw: unknown, index: number, level: number): CritterLevelMissionRequirement | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = sanitizeSlug(record.id, `level-${level}-mission-${index + 1}`);
  const typeRaw = typeof record.type === 'string' ? record.type.trim().toLowerCase() : 'opposing_knockouts';
  const type = MISSION_TYPE_SET.has(typeRaw as CritterMissionType)
    ? (typeRaw as CritterMissionType)
    : 'opposing_knockouts';
  const targetValue = clampInt(record.targetValue, 1, 999999, 1);
  const ascendsFromCritterId =
    type === 'ascension'
      ? clampInt(record.ascendsFromCritterId, 1, 999999, 1)
      : undefined;
  const knockoutElements =
    type === 'opposing_knockouts'
      ? sanitizeStringArray(record.knockoutElements, CRITTER_ELEMENTS.length)
          .map((entry) => entry.toLowerCase())
          .filter((entry): entry is CritterElement => ELEMENT_SET.has(entry as CritterElement))
      : [];
  const knockoutCritterIds =
    type === 'opposing_knockouts'
      ? [
          ...new Set(
            sanitizeNumberArray(record.knockoutCritterIds, 60).map((entry) => clampInt(entry, 1, 999999, 1)),
          ),
        ]
      : [];
  const allowKnockoutElements = knockoutCritterIds.length === 0;

  return {
    id,
    type,
    targetValue,
    ascendsFromCritterId,
    knockoutElements: allowKnockoutElements ? knockoutElements : [],
    knockoutCritterIds,
  };
}

function sanitizeCritterId(raw: unknown, fallback: number): number {
  const parsed = parseNumberish(raw);
  if (parsed === null) {
    return fallback;
  }
  return Math.max(1, Math.min(999999, parsed));
}

function sanitizeName(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, 40) : fallback;
}

function sanitizeElement(raw: unknown): CritterElement {
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase() as CritterElement;
    if (ELEMENT_SET.has(normalized)) {
      return normalized;
    }
  }
  return 'bloom';
}

function sanitizeRarity(raw: unknown): CritterRarity {
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase() as CritterRarity;
    if (RARITY_SET.has(normalized)) {
      return normalized;
    }
  }
  return 'common';
}

function sanitizeCritterStats(raw: unknown): CritterStats {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CRITTER_STATS };
  }
  const record = raw as Record<string, unknown>;
  return {
    hp: clampInt(record.hp, 1, 999, DEFAULT_CRITTER_STATS.hp),
    attack: clampInt(record.attack, 1, 999, DEFAULT_CRITTER_STATS.attack),
    defense: clampInt(record.defense, 1, 999, DEFAULT_CRITTER_STATS.defense),
    speed: clampInt(record.speed, 1, 999, DEFAULT_CRITTER_STATS.speed),
  };
}

function sanitizeCritterSpriteUrl(raw: unknown): string {
  if (typeof raw !== 'string') {
    return '';
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.slice(0, 1000);
}

function sanitizeStringArray(raw: unknown, maxItems: number): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const unique = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    unique.add(trimmed);
    if (unique.size >= maxItems) {
      break;
    }
  }
  return [...unique];
}

function sanitizeNumberArray(raw: unknown, maxItems: number): number[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const unique = new Set<number>();
  for (const value of raw) {
    const parsed = parseNumberish(value);
    if (parsed === null) {
      continue;
    }
    unique.add(parsed);
    if (unique.size >= maxItems) {
      break;
    }
  }
  return [...unique];
}

function sanitizeSlug(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
  return slug || fallback;
}

function sanitizeIsoTimestamp(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

function parseNumberish(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.floor(raw);
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const parsed = parseNumberish(raw);
  if (parsed === null) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function getMaxConfiguredLevel(levels: CritterLevelRequirement[]): number {
  if (levels.length === 0) {
    return 1;
  }
  return Math.max(1, ...levels.map((entry) => entry.level));
}
