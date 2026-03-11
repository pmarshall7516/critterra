import { sanitizeCritterDatabase } from '@/game/critters/schema';
import { sanitizeEquipmentEffectLibrary } from '@/game/equipmentEffects/schema';
import { sanitizeItemCatalog } from '@/game/items/schema';
import {
  buildDefaultElementChart,
  sanitizeElementChart,
  sanitizeSkillEffectLibrary,
  sanitizeSkillLibrary,
} from '@/game/skills/schema';
import { apiFetchJson } from '@/shared/apiClient';
import type { DuelCatalogContent, DuelSquad } from '@/duel/types';

interface ContentBootstrapResponse {
  ok: boolean;
  content?: {
    critters?: unknown;
    critterSkills?: unknown;
    skillEffects?: unknown;
    equipmentEffects?: unknown;
    elementChart?: unknown;
    items?: unknown;
  };
  error?: string;
}

interface DuelSquadsResponse {
  ok: boolean;
  squads?: unknown;
  squad?: unknown;
  deletedId?: string;
  error?: string;
}

interface DuelSquadMemberWire {
  critterId?: unknown;
  level?: unknown;
  equippedSkillIds?: unknown;
  equippedItems?: unknown;
}

interface DuelSquadWire {
  id?: unknown;
  name?: unknown;
  sortIndex?: unknown;
  members?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function fetchDuelCatalogContent(): Promise<DuelCatalogContent> {
  const result = await apiFetchJson<ContentBootstrapResponse>('/api/content/bootstrap');
  if (!result.ok || !result.data?.content) {
    throw new Error(result.error ?? result.data?.error ?? 'Unable to load duel content.');
  }
  const content = result.data.content;
  const skillEffects = sanitizeSkillEffectLibrary(content.skillEffects);
  const knownEffectIds = new Set(skillEffects.map((effect) => effect.effect_id));
  const effectTypeById = new Map(skillEffects.map((effect) => [effect.effect_id, effect.effect_type] as const));
  const legacyBuffById = new Map(
    skillEffects
      .filter((effect) => typeof effect.buffPercent === 'number' && Number.isFinite(effect.buffPercent))
      .map((effect) => [effect.effect_id, effect.buffPercent as number]),
  );

  return {
    critters: sanitizeCritterDatabase(content.critters),
    skills: sanitizeSkillLibrary(content.critterSkills, knownEffectIds, legacyBuffById, effectTypeById),
    skillEffects,
    equipmentEffects: sanitizeEquipmentEffectLibrary(content.equipmentEffects),
    elementChart: sanitizeElementChart(content.elementChart ?? buildDefaultElementChart()),
    items: sanitizeItemCatalog(content.items),
  };
}

export async function fetchDuelSquads(): Promise<DuelSquad[]> {
  const result = await apiFetchJson<DuelSquadsResponse>('/api/duel/squads');
  if (!result.ok) {
    throw new Error(result.error ?? result.data?.error ?? 'Unable to load duel squads.');
  }
  const squads = Array.isArray(result.data?.squads) ? result.data?.squads : [];
  return squads
    .map((entry) => sanitizeDuelSquadWire(entry))
    .filter((entry): entry is DuelSquad => entry !== null)
    .sort((left, right) => left.sortIndex - right.sortIndex || left.updatedAt.localeCompare(right.updatedAt));
}

export async function createDuelSquad(payload: {
  name: string;
  sortIndex?: number;
  members: DuelSquad['members'];
}): Promise<DuelSquad> {
  const result = await apiFetchJson<DuelSquadsResponse>('/api/duel/squads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!result.ok || !result.data?.squad) {
    throw new Error(result.error ?? result.data?.error ?? 'Unable to create duel squad.');
  }
  const squad = sanitizeDuelSquadWire(result.data.squad);
  if (!squad) {
    throw new Error('Server returned invalid squad data.');
  }
  return squad;
}

export async function updateDuelSquad(payload: {
  id: string;
  name: string;
  sortIndex?: number;
  members: DuelSquad['members'];
}): Promise<DuelSquad> {
  const encodedId = encodeURIComponent(payload.id);
  const result = await apiFetchJson<DuelSquadsResponse>(`/api/duel/squads/${encodedId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: payload.name,
      sortIndex: payload.sortIndex,
      members: payload.members,
    }),
  });
  if (!result.ok || !result.data?.squad) {
    throw new Error(result.error ?? result.data?.error ?? 'Unable to update duel squad.');
  }
  const squad = sanitizeDuelSquadWire(result.data.squad);
  if (!squad) {
    throw new Error('Server returned invalid squad data.');
  }
  return squad;
}

export async function deleteDuelSquad(id: string): Promise<void> {
  const encodedId = encodeURIComponent(id);
  const result = await apiFetchJson<DuelSquadsResponse>(`/api/duel/squads/${encodedId}`, {
    method: 'DELETE',
  });
  if (!result.ok) {
    throw new Error(result.error ?? result.data?.error ?? 'Unable to delete duel squad.');
  }
}

function sanitizeDuelSquadWire(raw: unknown): DuelSquad | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as DuelSquadWire;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!id || !name) {
    return null;
  }
  const membersRaw = Array.isArray(record.members) ? record.members : [];
  const members = membersRaw
    .map((entry) => sanitizeDuelMemberWire(entry))
    .filter((entry): entry is DuelSquad['members'][number] => entry !== null);
  if (members.length < 1 || members.length > 8) {
    return null;
  }
  const sortIndex =
    typeof record.sortIndex === 'number' && Number.isFinite(record.sortIndex) ? Math.max(0, Math.floor(record.sortIndex)) : 0;
  return {
    id,
    name: name.slice(0, 40),
    sortIndex,
    members,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
  };
}

function sanitizeDuelMemberWire(raw: unknown): DuelSquad['members'][number] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as DuelSquadMemberWire;
  const critterId =
    typeof record.critterId === 'number' && Number.isFinite(record.critterId) ? Math.floor(record.critterId) : Number.NaN;
  const level = typeof record.level === 'number' && Number.isFinite(record.level) ? Math.floor(record.level) : Number.NaN;
  if (!Number.isFinite(critterId) || !Number.isFinite(level)) {
    return null;
  }
  const rawSkillSlots = Array.isArray(record.equippedSkillIds) ? record.equippedSkillIds : [];
  const equippedSkillIds: [string | null, string | null, string | null, string | null] = [null, null, null, null];
  for (let i = 0; i < 4; i += 1) {
    const entry = rawSkillSlots[i];
    if (typeof entry === 'string' && entry.trim()) {
      equippedSkillIds[i] = entry.trim();
    } else {
      equippedSkillIds[i] = null;
    }
  }

  const rawItems = Array.isArray(record.equippedItems) ? record.equippedItems : [];
  const equippedItems = rawItems
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }
      const itemRecord = entry as { itemId?: unknown; slotIndex?: unknown };
      const itemId = typeof itemRecord.itemId === 'string' ? itemRecord.itemId.trim() : '';
      const slotIndex =
        typeof itemRecord.slotIndex === 'number' && Number.isFinite(itemRecord.slotIndex)
          ? Math.floor(itemRecord.slotIndex)
          : Number.NaN;
      if (!itemId || !Number.isFinite(slotIndex)) {
        return null;
      }
      return {
        itemId,
        slotIndex,
      };
    })
    .filter((entry): entry is DuelSquad['members'][number]['equippedItems'][number] => entry !== null);

  return {
    critterId,
    level,
    equippedSkillIds,
    equippedItems,
  };
}
