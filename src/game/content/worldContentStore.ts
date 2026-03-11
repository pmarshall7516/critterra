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
import type { GameElementDefinition } from '@/game/elements/types';
import { sanitizeGameElements } from '@/game/elements/schema';
import {
  sanitizeSkillLibrary,
  sanitizeSkillEffectLibrary,
  sanitizeElementChart,
  sanitizeElementChartWithElements,
  buildDefaultElementChart,
} from '@/game/skills/schema';
import type { GameItemDefinition } from '@/game/items/types';
import { sanitizeItemCatalog } from '@/game/items/schema';
import type { ShopDefinition } from '@/game/shops/types';
import { sanitizeShopCatalog } from '@/game/shops/schema';
import type { EquipmentEffectDefinition } from '@/game/equipmentEffects/types';
import { sanitizeEquipmentEffectLibrary } from '@/game/equipmentEffects/schema';

const WORLD_CONTENT_STORAGE_KEY = 'critterra.world.content.v1';

export interface StoredWorldContent {
  maps: WorldMapInput[];
  savedPaintTiles: Array<{
    id: string;
    name: string;
    primaryCode: string;
    width: number;
    height: number;
    ySortWithActors?: boolean;
    /** Per-tile tileset from DB: use this image and dimensions for atlas coordinates. */
    tilesetUrl?: string;
    tilePixelWidth?: number;
    tilePixelHeight?: number;
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
  gameElements: GameElementDefinition[];
  items: GameItemDefinition[];
  shops: ShopDefinition[];
  equipmentEffects: EquipmentEffectDefinition[];
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
    items?: unknown;
    shops?: unknown;
    equipmentEffects?: unknown;
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
    const rawTiles = Array.isArray(parsed.savedPaintTiles) ? parsed.savedPaintTiles : [];
    const savedPaintTiles = rawTiles.map((t) => {
      const entry = t as Record<string, unknown>;
      return {
        id: typeof entry.id === 'string' ? entry.id : '',
        name: typeof entry.name === 'string' ? entry.name : '',
        primaryCode: typeof entry.primaryCode === 'string' ? entry.primaryCode : '',
        width: typeof entry.width === 'number' ? entry.width : 1,
        height: typeof entry.height === 'number' ? entry.height : 1,
        ...(typeof entry.ySortWithActors === 'boolean' && { ySortWithActors: entry.ySortWithActors }),
        ...(typeof entry.tilesetUrl === 'string' && entry.tilesetUrl.trim() && { tilesetUrl: entry.tilesetUrl.trim() }),
        ...(typeof entry.tilePixelWidth === 'number' && Number.isFinite(entry.tilePixelWidth) && { tilePixelWidth: Math.max(1, Math.floor(entry.tilePixelWidth)) }),
        ...(typeof entry.tilePixelHeight === 'number' && Number.isFinite(entry.tilePixelHeight) && { tilePixelHeight: Math.max(1, Math.floor(entry.tilePixelHeight)) }),
        cells: Array.isArray(entry.cells) ? (entry.cells as StoredWorldContent['savedPaintTiles'][0]['cells']) : [],
      };
    });
    const gameElements = sanitizeGameElements((parsed as Partial<StoredWorldContent>).gameElements);
    return {
      maps: Array.isArray(parsed.maps) ? (parsed.maps as WorldMapInput[]) : [],
      savedPaintTiles,
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
      gameElements,
      elementChart: sanitizeElementChartWithElements(parsed.elementChart, gameElements.map((e) => e.id)),
      items: sanitizeItemCatalog(parsed.items),
      shops: sanitizeShopCatalog(parsed.shops),
      equipmentEffects: sanitizeEquipmentEffectLibrary(parsed.equipmentEffects),
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
  const effectTypeById = new Map(effects.map((effect) => [effect.effect_id, effect.effect_type] as const));
  const legacyEffectBuffPercentById = new Map(
    effects
      .filter((effect) => typeof effect.buffPercent === 'number' && Number.isFinite(effect.buffPercent))
      .map((effect) => [effect.effect_id, effect.buffPercent as number]),
  );
  return sanitizeSkillLibrary(rawSkills, knownEffectIds, legacyEffectBuffPercentById, effectTypeById);
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
  const gameElements = sanitizeGameElements((content as Record<string, unknown>).gameElements);
  const knownEffectIds = new Set(skillEffects.map((e) => e.effect_id));
  const effectTypeById = new Map(skillEffects.map((effect) => [effect.effect_id, effect.effect_type] as const));
  const legacyEffectBuffPercentById = new Map(
    skillEffects
      .filter((effect) => typeof effect.buffPercent === 'number' && Number.isFinite(effect.buffPercent))
      .map((effect) => [effect.effect_id, effect.buffPercent as number]),
  );
  const rawTiles = Array.isArray(content.savedPaintTiles) ? content.savedPaintTiles : [];
  const savedPaintTiles = rawTiles.map((t) => {
    const entry = t as Record<string, unknown>;
    return {
      id: typeof entry.id === 'string' ? entry.id : '',
      name: typeof entry.name === 'string' ? entry.name : '',
      primaryCode: typeof entry.primaryCode === 'string' ? entry.primaryCode : '',
      width: typeof entry.width === 'number' ? entry.width : 1,
      height: typeof entry.height === 'number' ? entry.height : 1,
      ...(typeof entry.ySortWithActors === 'boolean' && { ySortWithActors: entry.ySortWithActors }),
      ...(typeof entry.tilesetUrl === 'string' && entry.tilesetUrl.trim() && { tilesetUrl: entry.tilesetUrl.trim() }),
      ...(typeof entry.tilePixelWidth === 'number' && Number.isFinite(entry.tilePixelWidth) && { tilePixelWidth: Math.max(1, Math.floor(entry.tilePixelWidth)) }),
      ...(typeof entry.tilePixelHeight === 'number' && Number.isFinite(entry.tilePixelHeight) && { tilePixelHeight: Math.max(1, Math.floor(entry.tilePixelHeight)) }),
      cells: Array.isArray(entry.cells)
        ? (entry.cells as Array<{ code: string; atlasIndex: number; dx: number; dy: number }>)
        : [],
    };
  }) as StoredWorldContent['savedPaintTiles'];
  const next: StoredWorldContent = {
    maps: Array.isArray(content.maps) ? (content.maps as WorldMapInput[]) : [],
    savedPaintTiles,
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
    critterSkills: sanitizeSkillLibrary(
      content.critterSkills,
      knownEffectIds,
      legacyEffectBuffPercentById,
      effectTypeById,
    ),
    skillEffects,
    gameElements,
    elementChart: sanitizeElementChartWithElements(content.elementChart, gameElements.map((e) => e.id)),
    items: sanitizeItemCatalog(content.items),
    shops: sanitizeShopCatalog(content.shops),
    equipmentEffects: sanitizeEquipmentEffectLibrary(content.equipmentEffects),
  };

  persistWorldContent(next);
}
