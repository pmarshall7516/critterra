import { STORAGE_KEY } from '@/shared/constants';
import type { SaveProfile } from '@/game/saves/types';
import { apiFetchJson } from '@/shared/apiClient';
import { getAuthToken } from '@/shared/authStorage';

export function createNewSave(playerName: string): SaveProfile {
  return {
    id: 'slot-1',
    version: 2,
    playerName: normalizePlayerName(playerName),
    currentMapId: 'spawn',
    player: {
      x: 5,
      y: 4,
      facing: 'up',
    },
    selectedStarterId: null,
    flags: {},
    updatedAt: new Date().toISOString(),
  };
}

export function loadSave(): SaveProfile | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SaveProfile>;
    if (!parsed.version || !parsed.currentMapId || !parsed.player) {
      return null;
    }

    return {
      id: parsed.id ?? 'slot-1',
      version: parsed.version,
      playerName: normalizePlayerName(parsed.playerName ?? 'Player'),
      currentMapId: parsed.currentMapId,
      player: parsed.player,
      selectedStarterId: parsed.selectedStarterId ?? null,
      flags: parsed.flags ?? {},
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
