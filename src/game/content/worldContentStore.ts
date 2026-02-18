import type { WorldMapInput } from '@/game/world/types';
import type { TileDefinition, NpcSpriteConfig } from '@/game/world/types';
import type { CustomTilesetConfig } from '@/game/world/customTiles';
import type { NpcCharacterTemplateEntry, NpcSpriteLibraryEntry } from '@/game/world/npcCatalog';
import { apiFetchJson } from '@/shared/apiClient';
import type { CritterDefinition } from '@/game/critters/types';
import { sanitizeCritterDatabase } from '@/game/critters/schema';
import { sanitizeEncounterTableLibrary } from '@/game/encounters/schema';
import type { EncounterTableDefinition } from '@/game/encounters/types';
import type { SkillDefinition, SkillEffectDefinition, ElementChart } from '@/game/skills/types';
import {
  sanitizeSkillLibrary,
  sanitizeSkillEffectLibrary,
  sanitizeElementChart,
  buildDefaultElementChart,
} from '@/game/skills/schema';

const WORLD_CONTENT_STORAGE_KEY = 'critterra.world.content.v1';

export interface StoredWorldContent {
  maps: WorldMapInput[];
  savedPaintTiles: Array<{
    id: string;
    name: string;
    primaryCode: string;
    width: number;
    height: number;
    cells: Array<{
      code: string;
      atlasIndex: number;
      dx: number;
      dy: number;
    }>;
  }>;
  customTileDefinitions: Record<string, TileDefinition>;
  customTilesetConfig: CustomTilesetConfig | null;
  playerSpriteConfig: NpcSpriteConfig | null;
  npcSpriteLibrary: NpcSpriteLibraryEntry[];
  npcCharacterLibrary: NpcCharacterTemplateEntry[];
  critters: CritterDefinition[];
  encounterTables: EncounterTableDefinition[];
  critterSkills: SkillDefinition[];
  skillEffects: SkillEffectDefinition[];
  elementChart: ElementChart;
}

interface BootstrapResponse {
  ok: boolean;
  content?: {
    maps?: unknown;
    savedPaintTiles?: unknown;
    customTileDefinitions?: unknown;
    customTilesetConfig?: unknown;
    playerSpriteConfig?: unknown;
    npcSpriteLibrary?: unknown;
    npcCharacterLibrary?: unknown;
    critters?: unknown;
    encounterTables?: unknown;
    critterSkills?: unknown;
    skillEffects?: unknown;
    elementChart?: unknown;
  };
}

function sanitizePlayerSpriteConfig(raw: unknown): NpcSpriteConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  if (!url || url.startsWith('blob:')) {
    return null;
  }
  return record as unknown as NpcSpriteConfig;
}

function sanitizeCustomTilesetConfig(raw: unknown): CustomTilesetConfig | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  const tileWidthRaw =
    typeof record.tileWidth === 'number'
      ? record.tileWidth
      : typeof record.tilePixelWidth === 'number'
        ? record.tilePixelWidth
        : 0;
  const tileHeightRaw =
    typeof record.tileHeight === 'number'
      ? record.tileHeight
      : typeof record.tilePixelHeight === 'number'
        ? record.tilePixelHeight
        : 0;
  const tileWidth = Number.isFinite(tileWidthRaw) ? Math.max(1, Math.floor(tileWidthRaw)) : 0;
  const tileHeight = Number.isFinite(tileHeightRaw) ? Math.max(1, Math.floor(tileHeightRaw)) : 0;
  if (!url || tileWidth <= 0 || tileHeight <= 0) {
    return null;
  }
  return {
    url,
    tileWidth,
    tileHeight,
  };
}

export function readStoredWorldContent(): StoredWorldContent | null {
  const raw = localStorage.getItem(WORLD_CONTENT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredWorldContent>;
    return {
      maps: Array.isArray(parsed.maps) ? (parsed.maps as WorldMapInput[]) : [],
      savedPaintTiles: Array.isArray(parsed.savedPaintTiles)
        ? (parsed.savedPaintTiles as StoredWorldContent['savedPaintTiles'])
        : [],
      customTileDefinitions:
        parsed.customTileDefinitions && typeof parsed.customTileDefinitions === 'object'
          ? (parsed.customTileDefinitions as Record<string, TileDefinition>)
          : {},
      customTilesetConfig: sanitizeCustomTilesetConfig(parsed.customTilesetConfig),
      playerSpriteConfig: sanitizePlayerSpriteConfig(parsed.playerSpriteConfig),
      npcSpriteLibrary: Array.isArray(parsed.npcSpriteLibrary)
        ? (parsed.npcSpriteLibrary as NpcSpriteLibraryEntry[])
        : [],
      npcCharacterLibrary: Array.isArray(parsed.npcCharacterLibrary)
        ? (parsed.npcCharacterLibrary as NpcCharacterTemplateEntry[])
        : [],
      critters: sanitizeCritterDatabase(parsed.critters),
      encounterTables: sanitizeEncounterTableLibrary(parsed.encounterTables),
      critterSkills: sanitizeStoredSkills(parsed.critterSkills, parsed.skillEffects),
      skillEffects: sanitizeSkillEffectLibrary(parsed.skillEffects),
      elementChart: sanitizeElementChart(parsed.elementChart),
    };
  } catch {
    return null;
  }
}

function sanitizeStoredSkills(
  rawSkills: unknown,
  rawEffects: unknown,
): SkillDefinition[] {
  const effects = sanitizeSkillEffectLibrary(rawEffects);
  const knownEffectIds = new Set(effects.map((e) => e.effect_id));
  return sanitizeSkillLibrary(rawSkills, knownEffectIds);
}

export function persistWorldContent(content: StoredWorldContent): void {
  try {
    localStorage.setItem(WORLD_CONTENT_STORAGE_KEY, JSON.stringify(content));
  } catch {
    const fallback: StoredWorldContent = {
      ...content,
      playerSpriteConfig: null,
    };
    try {
      localStorage.setItem(WORLD_CONTENT_STORAGE_KEY, JSON.stringify(fallback));
    } catch {
      // Ignore quota errors; runtime falls back to static bundled content when cache write fails.
    }
  }
}

export function clearStoredWorldContent(): void {
  localStorage.removeItem(WORLD_CONTENT_STORAGE_KEY);
}

export async function hydrateWorldContentFromServer(): Promise<void> {
  const result = await apiFetchJson<BootstrapResponse>('/api/content/bootstrap');
  if (!result.ok || !result.data?.content) {
    return;
  }

  const content = result.data.content;
  const skillEffects = sanitizeSkillEffectLibrary(content.skillEffects);
  const knownEffectIds = new Set(skillEffects.map((e) => e.effect_id));
  const next: StoredWorldContent = {
    maps: Array.isArray(content.maps) ? (content.maps as WorldMapInput[]) : [],
    savedPaintTiles: Array.isArray(content.savedPaintTiles)
      ? (content.savedPaintTiles as StoredWorldContent['savedPaintTiles'])
      : [],
    customTileDefinitions:
      content.customTileDefinitions && typeof content.customTileDefinitions === 'object'
        ? (content.customTileDefinitions as Record<string, TileDefinition>)
        : {},
    customTilesetConfig: sanitizeCustomTilesetConfig(content.customTilesetConfig),
    playerSpriteConfig: sanitizePlayerSpriteConfig(content.playerSpriteConfig),
    npcSpriteLibrary: Array.isArray(content.npcSpriteLibrary)
      ? (content.npcSpriteLibrary as NpcSpriteLibraryEntry[])
      : [],
    npcCharacterLibrary: Array.isArray(content.npcCharacterLibrary)
      ? (content.npcCharacterLibrary as NpcCharacterTemplateEntry[])
      : [],
    critters: sanitizeCritterDatabase(content.critters),
    encounterTables: sanitizeEncounterTableLibrary(content.encounterTables),
    critterSkills: sanitizeSkillLibrary(content.critterSkills, knownEffectIds),
    skillEffects,
    elementChart: sanitizeElementChart(content.elementChart),
  };

  persistWorldContent(next);
}
