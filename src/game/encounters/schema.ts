import type { Vector2 } from '@/shared/types';
import type { EncounterTableDefinition, MapEncounterGroupDefinition } from '@/game/encounters/types';

const ENCOUNTER_ID_FALLBACK = 'encounter-table';
const ENCOUNTER_ID_REGEX = /[^a-z0-9-]/g;
const WEIGHT_PRECISION = 1000000;

export function sanitizeEncounterTableLibrary(raw: unknown): EncounterTableDefinition[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seen = new Set<string>();
  const parsed: EncounterTableDefinition[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const table = sanitizeEncounterTable(raw[index], index);
    if (!table || seen.has(table.id)) {
      continue;
    }
    seen.add(table.id);
    parsed.push(table);
  }
  return parsed;
}

export function sanitizeEncounterTable(raw: unknown, fallbackIndex = 0): EncounterTableDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = sanitizeEncounterId(record.id, `${ENCOUNTER_ID_FALLBACK}-${fallbackIndex + 1}`);
  const entries = sanitizeEncounterEntries(record.entries);
  return {
    id,
    entries,
  };
}

export function sanitizeEncounterEntries(raw: unknown): EncounterTableDefinition['entries'] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed: EncounterTableDefinition['entries'] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const kindRaw = typeof record.kind === 'string' ? record.kind.trim().toLowerCase() : '';
    const isItemEntry = kindRaw === 'item' || (kindRaw === '' && typeof record.itemId === 'string');
    if (isItemEntry) {
      const itemId = sanitizeEncounterItemId(record.itemId);
      if (!itemId) {
        continue;
      }
      const [minAmount, maxAmount] = sanitizeEncounterAmountRange(
        record.minAmount ?? record.minQty ?? record.minQuantity ?? record.minLevel,
        record.maxAmount ?? record.maxQty ?? record.maxQuantity ?? record.maxLevel,
      );
      parsed.push({
        kind: 'item',
        itemId,
        weight: sanitizeEncounterWeight(record.weight),
        minAmount,
        maxAmount,
      });
      continue;
    }

    const critterId = clampInt(record.critterId, 1, 999999, -1);
    if (critterId < 0) {
      continue;
    }
    const [minLevel, maxLevel] = sanitizeEncounterLevelRange(record.minLevel, record.maxLevel);
    parsed.push({
      kind: 'critter',
      critterId,
      weight: sanitizeEncounterWeight(record.weight),
      minLevel,
      maxLevel,
    });
  }
  return parsed;
}

export function sanitizeMapEncounterGroups(
  raw: unknown,
  mapWidth: number,
  mapHeight: number,
): MapEncounterGroupDefinition[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seenGroupIds = new Set<string>();
  const parsed: MapEncounterGroupDefinition[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const entry = raw[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const id = sanitizeEncounterId(record.id, `encounter-group-${index + 1}`);
    if (seenGroupIds.has(id)) {
      continue;
    }
    seenGroupIds.add(id);

    const tilePositions = sanitizeTilePositions(record.tilePositions, mapWidth, mapHeight);
    if (tilePositions.length === 0) {
      continue;
    }

    const walkEncounterTableId = sanitizeEncounterTableRef(record.walkEncounterTableId);
    const fishEncounterTableId = sanitizeEncounterTableRef(record.fishEncounterTableId);

    parsed.push({
      id,
      tilePositions,
      walkEncounterTableId,
      fishEncounterTableId,
      walkFrequency: sanitizeEncounterFrequency(record.walkFrequency),
      fishFrequency: sanitizeEncounterFrequency(record.fishFrequency),
    });
  }

  return parsed;
}

export function sanitizeEncounterId(raw: unknown, fallback: string): string {
  const value =
    typeof raw === 'string'
      ? raw.trim().toLowerCase().replace(ENCOUNTER_ID_REGEX, '-').replace(/-+/g, '-')
      : '';
  return value || fallback;
}

export function sanitizeEncounterWeight(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }
  const normalized = Math.max(0, Math.min(1, raw));
  return Math.round(normalized * WEIGHT_PRECISION) / WEIGHT_PRECISION;
}

export function sanitizeEncounterFrequency(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(1, raw));
  return Math.round(clamped * 1000) / 1000;
}

function sanitizeEncounterTableRef(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const normalized = sanitizeEncounterId(raw, '');
  return normalized || null;
}

function sanitizeEncounterLevelRange(minRaw: unknown, maxRaw: unknown): [number | null, number | null] {
  const minLevel = sanitizeEncounterLevelValue(minRaw);
  const maxLevel = sanitizeEncounterLevelValue(maxRaw);
  if (minLevel !== null && maxLevel !== null && minLevel > maxLevel) {
    return [maxLevel, minLevel];
  }
  return [minLevel, maxLevel];
}

function sanitizeEncounterLevelValue(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return null;
  }
  return clampInt(raw, 1, 99, 1);
}

function sanitizeEncounterAmountRange(minRaw: unknown, maxRaw: unknown): [number | null, number | null] {
  const minAmount = sanitizeEncounterAmountValue(minRaw);
  const maxAmount = sanitizeEncounterAmountValue(maxRaw);
  if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
    return [maxAmount, minAmount];
  }
  return [minAmount, maxAmount];
}

function sanitizeEncounterAmountValue(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return null;
  }
  return clampInt(raw, 1, 9999, 1);
}

function sanitizeEncounterItemId(raw: unknown): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function sanitizeTilePositions(raw: unknown, mapWidth: number, mapHeight: number): Vector2[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const positions: Vector2[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const x = clampInt(record.x, 0, Math.max(0, mapWidth - 1), -1);
    const y = clampInt(record.y, 0, Math.max(0, mapHeight - 1), -1);
    if (x < 0 || y < 0) {
      continue;
    }
    const key = `${x},${y}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    positions.push({ x, y });
  }
  return positions;
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(raw)));
}
