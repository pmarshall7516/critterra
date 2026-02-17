import { STORAGE_KEY } from '@/shared/constants';
import type { SaveProfile, SaveProgressTracking } from '@/game/saves/types';
import { apiFetchJson } from '@/shared/apiClient';
import { getAuthToken } from '@/shared/authStorage';
import { createDefaultPlayerCritterProgress } from '@/game/critters/schema';

export const SAVE_VERSION = 6;

type LegacySaveProfile = Partial<SaveProfile> & {
  flags?: unknown;
  progressTracking?: unknown;
};

export function createNewSave(playerName: string): SaveProfile {
  return {
    id: 'slot-1',
    version: SAVE_VERSION,
    playerName: normalizePlayerName(playerName),
    currentMapId: 'spawn',
    player: {
      x: 5,
      y: 4,
      facing: 'up',
    },
    selectedStarterId: null,
    playerCritterProgress: createDefaultPlayerCritterProgress(),
    progressTracking: createDefaultProgressTracking(),
    updatedAt: new Date().toISOString(),
  };
}

export function loadSave(): SaveProfile | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as LegacySaveProfile;
    if (!parsed.version || !parsed.currentMapId || !parsed.player) {
      return null;
    }

    const normalizedProgressTracking = normalizeProgressTracking(parsed.progressTracking, parsed.flags);

    return {
      id: parsed.id ?? 'slot-1',
      version: typeof parsed.version === 'number' && Number.isFinite(parsed.version) ? Math.floor(parsed.version) : 2,
      playerName: normalizePlayerName(parsed.playerName ?? 'Player'),
      currentMapId: parsed.currentMapId,
      player: parsed.player,
      selectedStarterId: parsed.selectedStarterId ?? null,
      // Preserve raw critter progress here; runtime sanitizes against the hydrated critter database.
      playerCritterProgress:
        parsed.playerCritterProgress && typeof parsed.playerCritterProgress === 'object'
          ? (parsed.playerCritterProgress as SaveProfile['playerCritterProgress'])
          : createDefaultPlayerCritterProgress(),
      progressTracking: normalizedProgressTracking,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function persistSave(save: SaveProfile): void {
  const next: SaveProfile = {
    ...save,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  queueRemoteSaveSync(next);
}

export function clearSave(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface SaveResponse {
  ok: boolean;
  save?: SaveProfile | null;
  error?: string;
}

let queuedSave: SaveProfile | null = null;
let activeSaveSync: Promise<void> | null = null;

function queueRemoteSaveSync(save: SaveProfile): void {
  if (!getAuthToken()) {
    return;
  }
  queuedSave = save;
  if (activeSaveSync) {
    return;
  }

  activeSaveSync = flushQueuedSaveSync().finally(() => {
    activeSaveSync = null;
  });
}

async function flushQueuedSaveSync(): Promise<void> {
  while (queuedSave) {
    const next = queuedSave;
    queuedSave = null;
    await apiFetchJson<SaveResponse>('/api/game/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        save: next,
      }),
    });
  }
}

export async function hydrateLocalSaveFromServer(): Promise<SaveProfile | null> {
  const localSave = loadSave();
  const result = await apiFetchJson<SaveResponse>('/api/game/save');
  if (!result.ok) {
    return localSave;
  }

  if (!result.data?.save) {
    if (localSave) {
      persistSave(localSave);
      return localSave;
    }
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  const save = result.data.save;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  return save;
}

export async function resetRemoteSaveWithPassword(password: string): Promise<void> {
  const result = await apiFetchJson<SaveResponse>('/api/game/reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      password,
    }),
  });

  if (!result.ok) {
    throw new Error(result.error ?? result.data?.error ?? 'Unable to reset save.');
  }
}

function normalizePlayerName(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 20) : 'Player';
}

function createDefaultProgressTracking(): SaveProgressTracking {
  return {
    mainStory: {
      stageId: null,
      flags: {},
    },
    sideStory: {
      stageId: null,
      flags: {},
      missions: {},
    },
  };
}

function normalizeProgressTracking(raw: unknown, legacyFlags: unknown): SaveProgressTracking {
  const defaults = createDefaultProgressTracking();
  const root = isObjectRecord(raw) ? raw : {};
  const mainStory = isObjectRecord(root.mainStory) ? root.mainStory : {};
  const sideStory = isObjectRecord(root.sideStory) ? root.sideStory : {};

  return {
    mainStory: {
      stageId: asOptionalString(mainStory.stageId),
      flags: normalizeFlagRecord(mainStory.flags ?? legacyFlags),
    },
    sideStory: {
      stageId: asOptionalString(sideStory.stageId),
      flags: normalizeFlagRecord(sideStory.flags),
      missions: normalizeSideMissionTracking(sideStory.missions),
    },
  };
}

function normalizeFlagRecord(value: unknown): Record<string, boolean> {
  if (!isObjectRecord(value)) {
    return {};
  }

  const normalized: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      continue;
    }
    normalized[key] = Boolean(raw);
  }
  return normalized;
}

function normalizeSideMissionTracking(
  value: unknown,
): SaveProgressTracking['sideStory']['missions'] {
  if (!isObjectRecord(value)) {
    return {};
  }

  const normalized: SaveProgressTracking['sideStory']['missions'] = {};
  for (const [missionId, rawEntry] of Object.entries(value)) {
    if (!missionId.trim() || !isObjectRecord(rawEntry)) {
      continue;
    }

    const progress =
      typeof rawEntry.progress === 'number' && Number.isFinite(rawEntry.progress)
        ? Math.max(0, Math.floor(rawEntry.progress))
        : 0;
    const target =
      typeof rawEntry.target === 'number' && Number.isFinite(rawEntry.target)
        ? Math.max(0, Math.floor(rawEntry.target))
        : 0;
    const completed = typeof rawEntry.completed === 'boolean' ? rawEntry.completed : target > 0 && progress >= target;
    const updatedAt =
      typeof rawEntry.updatedAt === 'string' && rawEntry.updatedAt.trim().length > 0
        ? rawEntry.updatedAt
        : new Date().toISOString();

    normalized[missionId] = {
      progress,
      target,
      completed,
      updatedAt,
    };
  }
  return normalized;
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
