import { STORAGE_KEY } from '@/shared/constants';
import type { SaveProfile } from '@/game/saves/types';

export function createNewSave(playerName: string): SaveProfile {
  return {
    id: 'slot-1',
    version: 2,
    playerName: normalizePlayerName(playerName),
    currentMapId: 'player-house',
    player: {
      x: 6,
      y: 9,
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
}

export function clearSave(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function normalizePlayerName(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 20) : 'Player';
}
