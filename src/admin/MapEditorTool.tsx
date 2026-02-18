import { CSSProperties, ChangeEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { SAVED_PAINT_TILE_DATABASE } from '@/game/world/customTiles';
import {
  normalizeCoreStoryNpcCharacters,
  type NpcCharacterTemplateEntry,
  type NpcSpriteLibraryEntry,
} from '@/game/world/npcCatalog';
import { BLANK_TILE_CODE, TILE_DEFINITIONS } from '@/game/world/tiles';
import { sanitizeCritterDatabase } from '@/game/critters/schema';
import { getAdminDbValue, setAdminDbValue } from '@/admin/indexedDbStore';
import { sanitizeEncounterTableLibrary } from '@/game/encounters/schema';
import type { EncounterTableDefinition, MapEncounterGroupDefinition } from '@/game/encounters/types';
import { apiFetchJson } from '@/shared/apiClient';
import { loadAdminFlags, type AdminFlagEntry } from '@/admin/flagsApi';
import type { CritterDefinition } from '@/game/critters/types';
import type {
  InteractionDefinition,
  NpcInteractionActionDefinition,
  NpcMovementGuardDefinition,
  NpcMovementDefinition,
  NpcSpriteConfig,
  NpcStoryStateDefinition,
  NpcDefinition,
  WarpDefinition,
} from '@/game/world/types';
import type { Direction, Vector2 } from '@/shared/types';
import {
  EditableMap,
  EditableMapLayer,
  EditorTileCode,
  clampInt,
  cloneEditableMap,
  composeEditableTiles,
  createBlankEditableMap,
  createBlankLayer,
  editableMapToJson,
  editableMapToTypeScript,
  floodFill,
  getCollisionEdgeMaskAt,
  getLayerById,
  getMapSize,
  getTileCodeAt,
  isKnownTileCode,
  parseEditableMapJson,
  parseLayerOrderId,
  resizeEditableMap,
  sortEditableLayersById,
  updateCollisionEdgeMask,
  updateTile,
} from '@/admin/mapEditorUtils';

type PaintTool =
  | 'select'
  | 'encounter-select'
  | 'paint'
  | 'paint-rotated'
  | 'erase'
  | 'fill'
  | 'fill-rotated'
  | 'pick'
  | 'npc-paint'
  | 'npc-erase'
  | 'collision-edge'
  | 'rotate-left'
  | 'rotate-right'
  | 'mirror-horizontal'
  | 'mirror-vertical'
  | 'warp-from'
  | 'warp-to'
  | 'camera-preview'
  | 'camera-point';
type EditorNpcMovementType = 'static' | 'static-turning' | 'wander' | 'path';
type EdgeSide = 'top' | 'right' | 'bottom' | 'left';
type CollisionPaintMode = 'add' | 'remove';

interface TileAtlasMeta {
  loaded: boolean;
  width: number;
  height: number;
  columns: number;
  rows: number;
  error: string | null;
}

interface AtlasSelectionRect {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  width: number;
  height: number;
}

interface SavedPaintTile {
  id: string;
  name: string;
  primaryCode: EditorTileCode;
  width: number;
  height: number;
  ySortWithActors: boolean;
  cells: SavedPaintTileCell[];
}

interface SavedPaintTileCell {
  code: EditorTileCode;
  atlasIndex: number;
  dx: number;
  dy: number;
}

interface SaveMapResponse {
  ok: boolean;
  error?: string;
  mapId?: string;
  mapFilePath?: string;
  indexFilePath?: string;
  customTilesFilePath?: string;
  customTileCodes?: string[];
}

interface SaveTileDatabaseResponse {
  ok: boolean;
  error?: string;
}

interface LoadTileLibraryResponse {
  ok: boolean;
  savedPaintTiles?: unknown;
  tileset?: {
    url?: unknown;
    tilePixelWidth?: unknown;
    tilePixelHeight?: unknown;
  } | null;
  error?: string;
}

interface LoadNpcLibraryResponse {
  ok: boolean;
  npcSpriteLibrary?: unknown;
  npcCharacterLibrary?: unknown;
  error?: string;
}

interface SaveNpcLibraryResponse {
  ok: boolean;
  error?: string;
}

interface SupabaseSpriteSheetListItem {
  name: string;
  path: string;
  publicUrl: string;
  updatedAt: string | null;
}

interface LoadSupabaseSpriteSheetsResponse {
  ok: boolean;
  bucket?: string;
  prefix?: string;
  spritesheets?: SupabaseSpriteSheetListItem[];
  error?: string;
}

interface LoadMapsResponse {
  ok: boolean;
  maps?: unknown[];
  error?: string;
}

interface LoadEncounterLibraryResponse {
  ok: boolean;
  encounterTables?: unknown;
  error?: string;
}

interface LoadCritterLibraryResponse {
  ok: boolean;
  critters?: unknown;
  error?: string;
}

interface NpcCharacterInstanceMarker {
  type: 'character-instance';
  key: string;
  characterId: string;
  characterLabel: string;
  name: string;
  order: number;
  mapId: string;
  position: Vector2;
  requiresFlag?: string;
  color: string;
  movementType: string;
  facing?: Direction;
}

type BaseTileCode = keyof typeof TILE_DEFINITIONS;
const TILE_CODES = Object.keys(TILE_DEFINITIONS) as BaseTileCode[];
const SAVED_PAINT_TILES_DB_KEY = 'map-editor-saved-paint-tiles-v3';
const NPC_SPRITE_LIBRARY_DB_KEY = 'map-editor-npc-sprite-library-v3';
const NPC_CHARACTER_LIBRARY_DB_KEY = 'map-editor-npc-character-library-v3';
const MIN_CELL_SIZE = 14;
const MAX_CELL_SIZE = 52;
const ATLAS_PREVIEW_SIZE = 28;
const MAX_ATLAS_PREVIEW_CELLS = 4096;
const DEFAULT_TILESET_SUPABASE_BUCKET = 'tilesets';
const DEFAULT_NPC_SUPABASE_BUCKET = 'character-spritesheets';
const TILE_CODE_GENERATION_RANGES: Array<[number, number]> = [
  [0xe000, 0xf8ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xcfff],
];
const COLLISION_EDGE_BIT: Record<EdgeSide, number> = {
  top: 1,
  right: 2,
  bottom: 4,
  left: 8,
};

const DEFAULT_TILESET_INDEX: Record<BaseTileCode, number> = {
  [BLANK_TILE_CODE]: 0,
  X: 0,
  G: 1,
  T: 2,
  P: 3,
  H: 4,
  Q: 5,
  U: 6,
  D: 7,
  W: 8,
  F: 9,
  R: 10,
  B: 11,
  C: 12,
};

const MAX_EDITOR_DIMENSION = 128;
const DEFAULT_CAMERA_TILES = { widthTiles: 19, heightTiles: 15 };
const EMPTY_EDITABLE_MAP: EditableMap = {
  id: '',
  name: '',
  layers: [],
  npcs: [],
  warps: [],
  interactions: [],
  encounterGroups: [],
  cameraSize: DEFAULT_CAMERA_TILES,
  cameraPoint: null,
};

export type MapEditorSection = 'full' | 'map' | 'tiles' | 'npcs' | 'npc-sprites' | 'npc-characters';

interface MapEditorToolProps {
  section?: MapEditorSection;
  embedded?: boolean;
}

export function MapEditorTool({ section = 'full', embedded = false }: MapEditorToolProps) {
  const [sourceMaps, setSourceMaps] = useState<EditableMap[]>([]);
  const sourceMapIds = useMemo(() => sourceMaps.map((map) => map.id), [sourceMaps]);
  const [selectedSourceMapId, setSelectedSourceMapId] = useState('');
  const [loadedSourceMapIdForSave, setLoadedSourceMapIdForSave] = useState<string | null>(null);
  const [editableMap, setEditableMap] = useState<EditableMap>(EMPTY_EDITABLE_MAP);

  const [tool, setTool] = useState<PaintTool>('select');
  const [selectedTileCode, setSelectedTileCode] = useState<EditorTileCode>('');
  const [selectedPaintTileId, setSelectedPaintTileId] = useState('');
  const [brushRotationQuarter, setBrushRotationQuarter] = useState(0);
  const [brushMirrorHorizontal, setBrushMirrorHorizontal] = useState(false);
  const [brushMirrorVertical, setBrushMirrorVertical] = useState(false);
  const [activeLayerId, setActiveLayerId] = useState('');
  const [newLayerName, setNewLayerName] = useState('');
  const [cellSize, setCellSize] = useState(24);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<Vector2 | null>(null);
  const [selectedCellKeys, setSelectedCellKeys] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingMapFile, setIsSavingMapFile] = useState(false);

  const [tilesetUrlInput, setTilesetUrlInput] = useState('');
  const [tilesetUrl, setTilesetUrl] = useState('');
  const [tilePixelWidthInput, setTilePixelWidthInput] = useState(section === 'tiles' ? '16' : '');
  const [tilePixelHeightInput, setTilePixelHeightInput] = useState(section === 'tiles' ? '16' : '');
  const [tilesetBucketInput, setTilesetBucketInput] = useState(DEFAULT_TILESET_SUPABASE_BUCKET);
  const [tilesetPrefixInput, setTilesetPrefixInput] = useState('');
  const [tilesetSearchInput, setTilesetSearchInput] = useState('');
  const [tilesetSupabaseAssets, setTilesetSupabaseAssets] = useState<SupabaseSpriteSheetListItem[]>([]);
  const [isLoadingTilesetSupabaseAssets, setIsLoadingTilesetSupabaseAssets] = useState(false);
  const [selectedTilesetSupabasePath, setSelectedTilesetSupabasePath] = useState('');
  const [atlasMeta, setAtlasMeta] = useState<TileAtlasMeta>({
    loaded: false,
    width: 0,
    height: 0,
    columns: 0,
    rows: 0,
    error: null,
  });
  const [selectedAtlasStartIndex, setSelectedAtlasStartIndex] = useState<number | null>(null);
  const [selectedAtlasEndIndex, setSelectedAtlasEndIndex] = useState<number | null>(null);
  const [isSelectingAtlas, setIsSelectingAtlas] = useState(false);

  const [savedPaintTiles, setSavedPaintTiles] = useState<SavedPaintTile[]>([]);
  const [manualPaintTileName, setManualPaintTileName] = useState('');
  const [npcSpriteLibrary, setNpcSpriteLibrary] = useState<NpcSpriteLibraryEntry[]>([]);
  const [selectedNpcSpriteId, setSelectedNpcSpriteId] = useState('');
  const [npcSpriteLabelInput, setNpcSpriteLabelInput] = useState('');
  const [npcCharacterLibrary, setNpcCharacterLibrary] = useState<NpcCharacterTemplateEntry[]>([]);
  const [flagEntries, setFlagEntries] = useState<AdminFlagEntry[]>([]);
  const [selectedNpcCharacterId, setSelectedNpcCharacterId] = useState('');
  const [selectedMapNpcId, setSelectedMapNpcId] = useState('');
  const [selectedCharacterInstanceKey, setSelectedCharacterInstanceKey] = useState('');
  const [npcCharacterLabelInput, setNpcCharacterLabelInput] = useState('');
  const [npcCharacterNameInput, setNpcCharacterNameInput] = useState('');
  const [npcCharacterColorInput, setNpcCharacterColorInput] = useState('#9b73b8');
  const [npcFacingInput, setNpcFacingInput] = useState<Direction>('down');
  const [npcDialogueIdInput, setNpcDialogueIdInput] = useState('');
  const [npcDialogueSpeakerInput, setNpcDialogueSpeakerInput] = useState('');
  const [npcDialogueLinesInput, setNpcDialogueLinesInput] = useState('');
  const [npcDialogueSetFlagInput, setNpcDialogueSetFlagInput] = useState('');
  const [npcFirstInteractionSetFlagInput, setNpcFirstInteractionSetFlagInput] = useState('');
  const [npcFirstInteractBattleInput, setNpcFirstInteractBattleInput] = useState(false);
  const [npcHealerInput, setNpcHealerInput] = useState(false);
  const [npcBattleTeamsInput, setNpcBattleTeamsInput] = useState('');
  const [npcStoryStatesInput, setNpcStoryStatesInput] = useState('[]');
  const [npcMovementGuardsInput, setNpcMovementGuardsInput] = useState('[]');
  const [npcInteractionScriptInput, setNpcInteractionScriptInput] = useState('[]');
  const [npcMovementTypeInput, setNpcMovementTypeInput] = useState<EditorNpcMovementType>('static');
  const [npcMovementPatternInput, setNpcMovementPatternInput] = useState('');
  const [npcStepIntervalInput, setNpcStepIntervalInput] = useState('850');
  const [npcMovementPathModeInput, setNpcMovementPathModeInput] = useState<'loop' | 'pingpong'>('loop');
  const [npcWanderLeashRadiusInput, setNpcWanderLeashRadiusInput] = useState('');
  const [npcSpriteUrl, setNpcSpriteUrl] = useState('');
  const [npcSpriteBucketInput, setNpcSpriteBucketInput] = useState(DEFAULT_NPC_SUPABASE_BUCKET);
  const [npcSpritePrefixInput, setNpcSpritePrefixInput] = useState('');
  const [npcSpriteSearchInput, setNpcSpriteSearchInput] = useState('');
  const [npcSupabaseSpriteSheets, setNpcSupabaseSpriteSheets] = useState<SupabaseSpriteSheetListItem[]>([]);
  const [isLoadingNpcSupabaseSpriteSheets, setIsLoadingNpcSupabaseSpriteSheets] = useState(false);
  const [selectedNpcSupabaseSheetPath, setSelectedNpcSupabaseSheetPath] = useState('');
  const [npcFrameWidthInput, setNpcFrameWidthInput] = useState('64');
  const [npcFrameHeightInput, setNpcFrameHeightInput] = useState('64');
  const [npcFrameCellsWideInput, setNpcFrameCellsWideInput] = useState('1');
  const [npcFrameCellsTallInput, setNpcFrameCellsTallInput] = useState('2');
  const [npcRenderWidthTilesInput, setNpcRenderWidthTilesInput] = useState('1');
  const [npcRenderHeightTilesInput, setNpcRenderHeightTilesInput] = useState('2');
  const [npcSpriteMeta, setNpcSpriteMeta] = useState<TileAtlasMeta>({
    loaded: false,
    width: 0,
    height: 0,
    columns: 0,
    rows: 0,
    error: null,
  });
  const [selectedNpcAtlasStartIndex, setSelectedNpcAtlasStartIndex] = useState<number | null>(null);
  const [selectedNpcAtlasEndIndex, setSelectedNpcAtlasEndIndex] = useState<number | null>(null);
  const [isSelectingNpcAtlas, setIsSelectingNpcAtlas] = useState(false);
  const [npcAssignDirection, setNpcAssignDirection] = useState<Direction>('down');
  const [npcFacingFrames, setNpcFacingFrames] = useState<Record<Direction, number>>({
    up: 0,
    down: 0,
    left: 0,
    right: 0,
  });
  const [npcWalkFrames, setNpcWalkFrames] = useState<Record<Direction, number[]>>({
    up: [],
    down: [],
    left: [],
    right: [],
  });
  const [npcDefaultIdleAnimationInput, setNpcDefaultIdleAnimationInput] = useState('idle');
  const [npcDefaultMoveAnimationInput, setNpcDefaultMoveAnimationInput] = useState('walk');
  const [npcAnimationSetsInput, setNpcAnimationSetsInput] = useState(
    JSON.stringify(buildDirectionalAnimationSetsFromLegacyFrames(
      {
        up: 0,
        down: 0,
        left: 0,
        right: 0,
      },
      {
        up: [],
        down: [],
        left: [],
        right: [],
      },
    ), null, 2),
  );
  const [npcCharacterIdleAnimationInput, setNpcCharacterIdleAnimationInput] = useState('');
  const [npcCharacterMoveAnimationInput, setNpcCharacterMoveAnimationInput] = useState('');
  const [selectedNpcAnimationName, setSelectedNpcAnimationName] = useState('walk');
  const [newNpcAnimationNameInput, setNewNpcAnimationNameInput] = useState('');
  const [renameNpcAnimationNameInput, setRenameNpcAnimationNameInput] = useState('');

  const [newMapId, setNewMapId] = useState('');
  const [newMapName, setNewMapName] = useState('');
  const [newMapWidthInput, setNewMapWidthInput] = useState('');
  const [newMapHeightInput, setNewMapHeightInput] = useState('');
  const [newMapFill, setNewMapFill] = useState('');

  const [resizeWidthInput, setResizeWidthInput] = useState('');
  const [resizeHeightInput, setResizeHeightInput] = useState('');
  const [resizeFill, setResizeFill] = useState('');

  const [selectedWarpId, setSelectedWarpId] = useState('');
  const [edgeSide, setEdgeSide] = useState<EdgeSide>('top');
  const [edgeOffset, setEdgeOffset] = useState(0);
  const [warpFromXListInput, setWarpFromXListInput] = useState('');
  const [warpFromYListInput, setWarpFromYListInput] = useState('');
  const [warpToXListInput, setWarpToXListInput] = useState('');
  const [warpToYListInput, setWarpToYListInput] = useState('');
  const [collisionPaintMode, setCollisionPaintMode] = useState<CollisionPaintMode>('add');
  const [collisionEdgeSelection, setCollisionEdgeSelection] = useState<Record<EdgeSide, boolean>>({
    top: true,
    right: false,
    bottom: false,
    left: false,
  });

  const [npcJsonDraft, setNpcJsonDraft] = useState('');
  const [interactionJsonDraft, setInteractionJsonDraft] = useState('');
  const [importJsonDraft, setImportJsonDraft] = useState('');
  const [encounterTables, setEncounterTables] = useState<EncounterTableDefinition[]>([]);
  const [isLoadingEncounterTables, setIsLoadingEncounterTables] = useState(false);
  const [encounterCritters, setEncounterCritters] = useState<CritterDefinition[]>([]);
  const [selectedEncounterGroupId, setSelectedEncounterGroupId] = useState('');
  const [encounterGroupIdInput, setEncounterGroupIdInput] = useState('');
  const [encounterWalkTableIdInput, setEncounterWalkTableIdInput] = useState('');
  const [encounterFishTableIdInput, setEncounterFishTableIdInput] = useState('');
  const [encounterWalkFrequencyPercent, setEncounterWalkFrequencyPercent] = useState(0);
  const [encounterFishFrequencyPercent, setEncounterFishFrequencyPercent] = useState(0);
  const [encounterManualTileXInput, setEncounterManualTileXInput] = useState('');
  const [encounterManualTileYInput, setEncounterManualTileYInput] = useState('');

  const uploadedObjectUrlRef = useRef<string | null>(null);
  const hasAutoLoadedLibrariesRef = useRef(false);

  const isMapSection = section === 'map';
  const isTilesSection = section === 'tiles';
  const isNpcsSection = section === 'npcs';
  const isNpcSpritesSection = section === 'npc-sprites';
  const isNpcCharactersSection = section === 'npc-characters';
  const showMapEditing = section === 'full' || isMapSection || isNpcsSection;
  const showTilesLibrary = section === 'full' || isTilesSection;
  const showNpcStudio = section === 'full' || isNpcsSection || isNpcSpritesSection || isNpcCharactersSection;
  const showNpcSpriteStudio = section === 'full' || isNpcSpritesSection;
  const showNpcCharacterStudio = section === 'full' || isNpcsSection || isNpcCharactersSection;
  const showTwoColumnLayout = showMapEditing;

  const mapSize = useMemo(() => getMapSize(editableMap), [editableMap]);
  const orderedLayers = useMemo(() => sortEditableLayersById(editableMap.layers), [editableMap.layers]);
  const hasMapLoaded = mapSize.width > 0 && mapSize.height > 0;
  const composedTiles = useMemo(() => composeEditableTiles(editableMap), [editableMap]);
  const activeLayer = useMemo(
    () => (activeLayerId ? getLayerById(editableMap, activeLayerId) : orderedLayers[0] ?? null),
    [activeLayerId, editableMap, orderedLayers],
  );
  const exportTypeScript = useMemo(
    () => (hasMapLoaded ? editableMapToTypeScript(editableMap) : ''),
    [editableMap, hasMapLoaded],
  );
  const exportJson = useMemo(() => (hasMapLoaded ? editableMapToJson(editableMap) : ''), [editableMap, hasMapLoaded]);

  const selectedWarp = useMemo(
    () => editableMap.warps.find((warp) => warp.id === selectedWarpId) ?? null,
    [editableMap.warps, selectedWarpId],
  );
  const selectedEncounterGroup = useMemo(
    () => editableMap.encounterGroups.find((group) => group.id === selectedEncounterGroupId) ?? null,
    [editableMap.encounterGroups, selectedEncounterGroupId],
  );
  const encounterTablesById = useMemo(() => {
    const lookup = new Map<string, EncounterTableDefinition>();
    for (const table of encounterTables) {
      lookup.set(table.id, table);
    }
    return lookup;
  }, [encounterTables]);
  const selectedCellSet = useMemo(() => new Set(selectedCellKeys), [selectedCellKeys]);
  const encounterGroupTileLookup = useMemo(() => {
    const lookup = new Map<string, string[]>();
    for (const group of editableMap.encounterGroups) {
      for (const position of group.tilePositions) {
        const key = `${position.x},${position.y}`;
        const next = lookup.get(key) ?? [];
        next.push(group.id);
        lookup.set(key, next);
      }
    }
    return lookup;
  }, [editableMap.encounterGroups]);
  const selectableWarpMapIds = useMemo(() => {
    const ids: string[] = [];
    const pushUnique = (value: string | null | undefined) => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return;
      }
      if (!ids.includes(trimmed)) {
        ids.push(trimmed);
      }
    };

    for (const mapId of sourceMapIds) {
      pushUnique(mapId);
    }
    pushUnique(editableMap.id);
    for (const warp of editableMap.warps) {
      pushUnique(warp.toMapId);
    }
    pushUnique(selectedWarp?.toMapId);

    return ids;
  }, [editableMap.id, editableMap.warps, selectedWarp?.toMapId, sourceMapIds]);

  const selectedPaintTile = useMemo(
    () => savedPaintTiles.find((tile) => tile.id === selectedPaintTileId) ?? null,
    [savedPaintTiles, selectedPaintTileId],
  );
  const selectedNpcCharacter = useMemo(
    () => npcCharacterLibrary.find((template) => template.id === selectedNpcCharacterId) ?? null,
    [npcCharacterLibrary, selectedNpcCharacterId],
  );
  const selectedMapNpc = useMemo(
    () => editableMap.npcs.find((npc) => npc.id === selectedMapNpcId) ?? null,
    [editableMap.npcs, selectedMapNpcId],
  );
  const characterInstanceMarkers = useMemo(() => {
    const markers: NpcCharacterInstanceMarker[] = [];
    for (const character of npcCharacterLibrary) {
      const placements = getCharacterPlacementInstances(character);
      for (let index = 0; index < placements.length; index += 1) {
        const placement = placements[index];
        if (!placement.mapId || !placement.position) {
          continue;
        }
        markers.push({
          type: 'character-instance',
          key: `${character.id}:${index}`,
          characterId: character.id,
          characterLabel: character.label,
          name: character.npcName,
          order: index + 1,
          mapId: placement.mapId,
          position: { ...placement.position },
          requiresFlag: placement.requiresFlag,
          color: character.color || '#9b73b8',
          movementType: placement.movement?.type ?? character.movement?.type ?? 'static',
          facing: placement.facing ?? character.facing,
        });
      }
    }
    return markers;
  }, [npcCharacterLibrary]);
  const characterMarkersOnActiveMap = useMemo(
    () => characterInstanceMarkers.filter((entry) => entry.mapId === editableMap.id),
    [characterInstanceMarkers, editableMap.id],
  );
  const mapNpcCards = useMemo(() => {
    const cards = [
      ...editableMap.npcs.map((npc) => ({
        type: 'map-npc' as const,
        id: npc.id,
        name: npc.name,
        position: npc.position,
        movementType: npc.movement?.type ?? 'static',
        facing: npc.facing,
      })),
      ...characterMarkersOnActiveMap.map((marker) => ({
        type: 'character-instance' as const,
        id: marker.key,
        name: marker.name,
        position: marker.position,
        movementType: marker.movementType,
        facing: marker.facing,
        requiresFlag: marker.requiresFlag,
        order: marker.order,
        characterId: marker.characterId,
      })),
    ];
    return cards.sort((left, right) => {
      if (left.position.y !== right.position.y) {
        return left.position.y - right.position.y;
      }
      if (left.position.x !== right.position.x) {
        return left.position.x - right.position.x;
      }
      return left.id.localeCompare(right.id);
    });
  }, [characterMarkersOnActiveMap, editableMap.npcs]);
  const selectedCharacterInstance = useMemo(() => {
    if (!selectedCharacterInstanceKey) {
      return null;
    }
    const [characterId, indexText] = selectedCharacterInstanceKey.split(':');
    const index = Number.parseInt(indexText, 10);
    if (!characterId || !Number.isFinite(index)) {
      return null;
    }
    const character = npcCharacterLibrary.find((entry) => entry.id === characterId);
    if (!character) {
      return null;
    }
    const placements = getCharacterPlacementInstances(character);
    const placement = placements[index];
    if (!placement) {
      return null;
    }
    return {
      character,
      placement,
      index,
      key: selectedCharacterInstanceKey,
    };
  }, [npcCharacterLibrary, selectedCharacterInstanceKey]);
  const selectedCharacterForInstanceList = selectedCharacterInstance?.character ?? selectedNpcCharacter;
  const selectedCharacterInstances = useMemo(
    () => (selectedCharacterForInstanceList ? getCharacterPlacementInstances(selectedCharacterForInstanceList) : []),
    [selectedCharacterForInstanceList],
  );
  const selectedNpcSprite = useMemo(
    () => npcSpriteLibrary.find((sprite) => sprite.id === selectedNpcSpriteId) ?? null,
    [npcSpriteLibrary, selectedNpcSpriteId],
  );
  const charactersUsingSelectedNpcSprite = useMemo(() => {
    if (!selectedNpcSpriteId) {
      return [];
    }
    return npcCharacterLibrary.filter((entry) => entry.spriteId === selectedNpcSpriteId);
  }, [npcCharacterLibrary, selectedNpcSpriteId]);
  const filteredNpcSupabaseSpriteSheets = useMemo(() => {
    const query = npcSpriteSearchInput.trim().toLowerCase();
    const sorted = [...npcSupabaseSpriteSheets].sort((left, right) =>
      left.path.localeCompare(right.path, undefined, { sensitivity: 'base' }),
    );
    if (!query) {
      return sorted;
    }
    return sorted.filter(
      (entry) => entry.name.toLowerCase().includes(query) || entry.path.toLowerCase().includes(query),
    );
  }, [npcSupabaseSpriteSheets, npcSpriteSearchInput]);
  const knownFlagIds = useMemo(
    () =>
      [...new Set(flagEntries.map((entry) => entry.flagId.trim()).filter((entry) => entry.length > 0))].sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: 'base' }),
      ),
    [flagEntries],
  );
  const filteredTilesetSupabaseAssets = useMemo(() => {
    const query = tilesetSearchInput.trim().toLowerCase();
    const sorted = [...tilesetSupabaseAssets].sort((left, right) =>
      left.path.localeCompare(right.path, undefined, { sensitivity: 'base' }),
    );
    if (!query) {
      return sorted;
    }
    return sorted.filter(
      (entry) => entry.name.toLowerCase().includes(query) || entry.path.toLowerCase().includes(query),
    );
  }, [tilesetSupabaseAssets, tilesetSearchInput]);

  const atlasCellCount = useMemo(() => Math.max(0, atlasMeta.columns * atlasMeta.rows), [atlasMeta]);
  const npcAtlasCellCount = useMemo(() => Math.max(0, npcSpriteMeta.columns * npcSpriteMeta.rows), [npcSpriteMeta]);
  const npcPreviewCellCount = useMemo(
    () => Math.min(npcAtlasCellCount, MAX_ATLAS_PREVIEW_CELLS),
    [npcAtlasCellCount],
  );
  const isNpcPreviewTruncated = npcAtlasCellCount > npcPreviewCellCount;
  const selectedNpcAtlasRect = useMemo(
    () =>
      buildAtlasSelectionRect(
        selectedNpcAtlasStartIndex,
        selectedNpcAtlasEndIndex,
        npcSpriteMeta.columns,
        npcSpriteMeta.rows,
      ),
    [selectedNpcAtlasEndIndex, selectedNpcAtlasStartIndex, npcSpriteMeta.columns, npcSpriteMeta.rows],
  );
  const parsedNpcAnimationSets = useMemo(() => {
    const parsed = parseDirectionalAnimationSetsInput(npcAnimationSetsInput, npcFacingFrames, npcWalkFrames);
    if (parsed.ok) {
      return parsed.animationSets;
    }
    return sanitizeDirectionalAnimationSets(buildDirectionalAnimationSetsFromLegacyFrames(npcFacingFrames, npcWalkFrames));
  }, [npcAnimationSetsInput, npcFacingFrames, npcWalkFrames]);
  const npcAnimationNames = useMemo(() => Object.keys(parsedNpcAnimationSets), [parsedNpcAnimationSets]);
  const selectedNpcAnimationFramesForDirection = useMemo(() => {
    const frames = parsedNpcAnimationSets[selectedNpcAnimationName]?.[npcAssignDirection];
    return Array.isArray(frames) ? frames : [];
  }, [parsedNpcAnimationSets, selectedNpcAnimationName, npcAssignDirection]);
  const selectedAtlasRect = useMemo(
    () => buildAtlasSelectionRect(selectedAtlasStartIndex, selectedAtlasEndIndex, atlasMeta.columns, atlasMeta.rows),
    [selectedAtlasEndIndex, selectedAtlasStartIndex, atlasMeta.columns, atlasMeta.rows],
  );

  const atlasIndexByCode = useMemo(() => {
    const lookup = new Map<string, number>();
    for (const tile of savedPaintTiles) {
      for (const cell of tile.cells) {
        lookup.set(cell.code, cell.atlasIndex);
      }
    }
    return lookup;
  }, [savedPaintTiles]);

  const warpMarkersByCell = useMemo(() => {
    const markers = new Map<string, string[]>();
    for (const warp of editableMap.warps) {
      for (const from of getWarpFromPositions(warp)) {
        const key = `${from.x},${from.y}`;
        const existing = markers.get(key) ?? [];
        existing.push(warp.id);
        markers.set(key, existing);
      }
    }
    return markers;
  }, [editableMap.warps]);
  const npcByCell = useMemo(() => {
    const lookup = new Map<string, NpcDefinition>();
    for (const npc of editableMap.npcs) {
      lookup.set(`${npc.position.x},${npc.position.y}`, npc);
    }
    return lookup;
  }, [editableMap.npcs]);
  const npcMarkerByCell = useMemo(() => {
    const lookup = new Map<
      string,
      | { source: 'map'; npc: NpcDefinition }
      | { source: 'character'; marker: NpcCharacterInstanceMarker }
    >();
    for (const npc of editableMap.npcs) {
      lookup.set(`${npc.position.x},${npc.position.y}`, { source: 'map', npc });
    }
    for (const marker of characterMarkersOnActiveMap) {
      lookup.set(`${marker.position.x},${marker.position.y}`, { source: 'character', marker });
    }
    return lookup;
  }, [characterMarkersOnActiveMap, editableMap.npcs]);

  const savedCustomTileCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const tile of savedPaintTiles) {
      for (const cell of tile.cells) {
        if (cell.code) {
          codes.add(cell.code);
        }
      }
    }
    return codes;
  }, [savedPaintTiles]);
  const mapWarnings = useMemo(
    () => buildWarnings(editableMap, savedCustomTileCodes, sourceMapIds),
    [editableMap, savedCustomTileCodes, sourceMapIds],
  );
  const selectedCollisionEdgeMask = useMemo(() => {
    let mask = 0;
    for (const side of Object.keys(collisionEdgeSelection) as EdgeSide[]) {
      if (collisionEdgeSelection[side]) {
        mask |= COLLISION_EDGE_BIT[side];
      }
    }
    return mask & 0b1111;
  }, [collisionEdgeSelection]);
  const activeLayerCollisionMasksByPosition = useMemo(() => {
    const lookup = new Map<string, number>();
    if (!activeLayer || !hasMapLoaded) {
      return lookup;
    }

    for (let y = 0; y < mapSize.height; y += 1) {
      const row = activeLayer.collisionEdges[y] ?? '';
      for (let x = 0; x < mapSize.width; x += 1) {
        const mask = Number.parseInt(row[x] ?? '0', 16);
        if (Number.isFinite(mask) && mask > 0) {
          lookup.set(`${x},${y}`, mask & 0b1111);
        }
      }
    }

    return lookup;
  }, [activeLayer, hasMapLoaded, mapSize.height, mapSize.width]);
  const visibleLayerCellsByPosition = useMemo(() => {
    const lookup = new Map<string, Array<{ layerId: string; code: EditorTileCode; rotation: number }>>();
    if (!hasMapLoaded) {
      return lookup;
    }

    for (const layer of orderedLayers) {
      if (!layer.visible) {
        continue;
      }
      for (let y = 0; y < mapSize.height; y += 1) {
        const row = layer.tiles[y];
        if (!row) {
          continue;
        }
        const rotations = layer.rotations[y] ?? '';
        for (let x = 0; x < mapSize.width; x += 1) {
          const code = row[x];
          if (!code || code === BLANK_TILE_CODE) {
            continue;
          }
          const key = `${x},${y}`;
          const stack = lookup.get(key) ?? [];
          const parsedRotation = Number.parseInt(rotations[x] ?? '0', 10);
          stack.push({
            layerId: layer.id,
            code,
            rotation: Number.isFinite(parsedRotation) ? parsedRotation % 4 : 0,
          });
          lookup.set(key, stack);
        }
      }
    }

    return lookup;
  }, [hasMapLoaded, mapSize.height, mapSize.width, orderedLayers]);
  const hoverStampCells = useMemo(() => {
    if (
      !hasMapLoaded ||
      (tool !== 'paint' && tool !== 'paint-rotated') ||
      !selectedPaintTile ||
      !hoveredCell
    ) {
      return new Set<string>();
    }
    if (selectedPaintTile.width <= 1 && selectedPaintTile.height <= 1) {
      return new Set<string>();
    }

    const previewRotationOffset = tool === 'paint-rotated' ? pseudoRandomQuarter(hoveredCell.x, hoveredCell.y) : 0;
    const transformedCells = transformStampCells(
      selectedPaintTile,
      brushRotationQuarter + previewRotationOffset,
      brushMirrorHorizontal,
      brushMirrorVertical,
    );
    const cells = new Set<string>();
    for (const cell of transformedCells) {
      const x = hoveredCell.x + cell.dx;
      const y = hoveredCell.y + cell.dy;
      if (x < 0 || y < 0 || x >= mapSize.width || y >= mapSize.height) {
        continue;
      }
      cells.add(`${x},${y}`);
    }

    return cells;
  }, [
    brushMirrorHorizontal,
    brushMirrorVertical,
    brushRotationQuarter,
    hasMapLoaded,
    hoveredCell,
    mapSize.height,
    mapSize.width,
    selectedPaintTile,
    tool,
  ]);
  const hoverCollisionEdgeMask = useMemo(() => {
    if (!hoveredCell || tool !== 'collision-edge') {
      return 0;
    }
    return selectedCollisionEdgeMask;
  }, [hoveredCell, selectedCollisionEdgeMask, tool]);

  useEffect(() => {
    if (!hasMapLoaded) {
      setResizeWidthInput('');
      setResizeHeightInput('');
      setSelectedCellKeys([]);
      return;
    }

    setResizeWidthInput(String(mapSize.width));
    setResizeHeightInput(String(mapSize.height));
  }, [hasMapLoaded, mapSize.height, mapSize.width]);

  useEffect(() => {
    setSelectedCellKeys((current) =>
      current.filter((key) => {
        const parsed = parseCellKey(key);
        if (!parsed) {
          return false;
        }
        return parsed.x >= 0 && parsed.y >= 0 && parsed.x < mapSize.width && parsed.y < mapSize.height;
      }),
    );
  }, [mapSize.height, mapSize.width]);

  useEffect(() => {
    if (!hasMapLoaded) {
      setNpcJsonDraft('');
      return;
    }

    setNpcJsonDraft(JSON.stringify(editableMap.npcs, null, 2));
  }, [editableMap.npcs, hasMapLoaded]);

  useEffect(() => {
    if (!hasMapLoaded) {
      setInteractionJsonDraft('');
      return;
    }

    setInteractionJsonDraft(JSON.stringify(editableMap.interactions, null, 2));
  }, [editableMap.interactions, hasMapLoaded]);

  useEffect(() => {
    if (selectedWarpId && editableMap.warps.some((warp) => warp.id === selectedWarpId)) {
      return;
    }

    setSelectedWarpId(editableMap.warps[0]?.id ?? '');
  }, [editableMap.warps, selectedWarpId]);

  useEffect(() => {
    if (!selectedEncounterGroupId) {
      return;
    }
    if (editableMap.encounterGroups.some((group) => group.id === selectedEncounterGroupId)) {
      return;
    }
    setSelectedEncounterGroupId(editableMap.encounterGroups[0]?.id ?? '');
  }, [editableMap.encounterGroups, selectedEncounterGroupId]);

  useEffect(() => {
    if (!selectedEncounterGroup) {
      return;
    }

    setEncounterGroupIdInput(selectedEncounterGroup.id);
    setEncounterWalkTableIdInput(selectedEncounterGroup.walkEncounterTableId ?? '');
    setEncounterFishTableIdInput(selectedEncounterGroup.fishEncounterTableId ?? '');
    setEncounterWalkFrequencyPercent(Math.round((selectedEncounterGroup.walkFrequency ?? 0) * 100));
    setEncounterFishFrequencyPercent(Math.round((selectedEncounterGroup.fishFrequency ?? 0) * 100));
    setSelectedCellKeys(selectedEncounterGroup.tilePositions.map((position) => `${position.x},${position.y}`));
  }, [selectedEncounterGroup]);

  useEffect(() => {
    if (selectedEncounterGroupId) {
      return;
    }
    if (encounterGroupIdInput.trim()) {
      return;
    }
    setEncounterGroupIdInput(suggestEncounterGroupId(editableMap.encounterGroups));
  }, [editableMap.encounterGroups, encounterGroupIdInput, selectedEncounterGroupId]);

  useEffect(() => {
    if (!selectedWarp) {
      setWarpFromXListInput('');
      setWarpFromYListInput('');
      setWarpToXListInput('');
      setWarpToYListInput('');
      return;
    }

    const fromPositions = getWarpFromPositions(selectedWarp);
    const toPositions = getWarpToPositions(selectedWarp);
    setWarpFromXListInput(formatCoordinateAxisList(fromPositions.map((position) => position.x)));
    setWarpFromYListInput(formatCoordinateAxisList(fromPositions.map((position) => position.y)));
    setWarpToXListInput(formatCoordinateAxisList(toPositions.map((position) => position.x)));
    setWarpToYListInput(formatCoordinateAxisList(toPositions.map((position) => position.y)));
  }, [selectedWarp]);

  useEffect(() => {
    if (!hasMapLoaded) {
      setActiveLayerId('');
      return;
    }

    if (activeLayerId && editableMap.layers.some((layer) => layer.id === activeLayerId)) {
      return;
    }

    setActiveLayerId(orderedLayers[0]?.id ?? '');
  }, [activeLayerId, editableMap.layers, hasMapLoaded, orderedLayers]);

  useEffect(() => {
    if (!selectedPaintTileId) {
      const fallback = savedPaintTiles[0];
      if (fallback) {
        setSelectedPaintTileId(fallback.id);
        setSelectedTileCode(fallback.primaryCode);
      }
      return;
    }

    if (savedPaintTiles.some((tile) => tile.id === selectedPaintTileId)) {
      return;
    }

    const fallback = savedPaintTiles[0];
    setSelectedPaintTileId(fallback?.id ?? '');
    setSelectedTileCode(fallback?.primaryCode ?? '');
  }, [savedPaintTiles, selectedPaintTileId]);

  useEffect(() => {
    if (!selectedNpcCharacterId) {
      const fallback = npcCharacterLibrary[0];
      if (fallback) {
        setSelectedNpcCharacterId(fallback.id);
      }
      return;
    }

    if (npcCharacterLibrary.some((template) => template.id === selectedNpcCharacterId)) {
      return;
    }
    setSelectedNpcCharacterId(npcCharacterLibrary[0]?.id ?? '');
  }, [npcCharacterLibrary, selectedNpcCharacterId]);

  useEffect(() => {
    if (!selectedNpcSpriteId) {
      const fallback = npcSpriteLibrary[0];
      if (fallback) {
        setSelectedNpcSpriteId(fallback.id);
      }
      return;
    }

    if (npcSpriteLibrary.some((sprite) => sprite.id === selectedNpcSpriteId)) {
      return;
    }
    setSelectedNpcSpriteId(npcSpriteLibrary[0]?.id ?? '');
  }, [npcSpriteLibrary, selectedNpcSpriteId]);

  useEffect(() => {
    if (!selectedMapNpcId) {
      return;
    }
    if (editableMap.npcs.some((entry) => entry.id === selectedMapNpcId)) {
      return;
    }
    setSelectedMapNpcId('');
  }, [editableMap.npcs, selectedMapNpcId]);

  useEffect(() => {
    if (!selectedCharacterInstanceKey) {
      return;
    }
    const [characterId, indexText] = selectedCharacterInstanceKey.split(':');
    const index = Number.parseInt(indexText, 10);
    if (!characterId || !Number.isFinite(index)) {
      setSelectedCharacterInstanceKey('');
      return;
    }
    const character = npcCharacterLibrary.find((entry) => entry.id === characterId);
    if (!character) {
      setSelectedCharacterInstanceKey('');
      return;
    }
    const placements = getCharacterPlacementInstances(character);
    if (index < 0 || index >= placements.length) {
      setSelectedCharacterInstanceKey('');
    }
  }, [npcCharacterLibrary, selectedCharacterInstanceKey]);

  useEffect(() => {
    if (npcAnimationNames.length === 0) {
      setSelectedNpcAnimationName('');
      return;
    }
    if (!selectedNpcAnimationName || !npcAnimationNames.includes(selectedNpcAnimationName)) {
      setSelectedNpcAnimationName(npcAnimationNames.includes('walk') ? 'walk' : npcAnimationNames[0]);
    }
  }, [npcAnimationNames, selectedNpcAnimationName]);

  useEffect(() => {
    if (!selectedNpcAnimationName) {
      setRenameNpcAnimationNameInput('');
      return;
    }
    setRenameNpcAnimationNameInput(selectedNpcAnimationName);
  }, [selectedNpcAnimationName]);

  useEffect(() => {
    const onMouseUp = () => {
      setIsDrawing(false);
      setIsSelectingAtlas(false);
      setIsSelectingNpcAtlas(false);
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tilePixelWidth = parseInteger(tilePixelWidthInput);
    const tilePixelHeight = parseInteger(tilePixelHeightInput);

    if (!tilesetUrl) {
      setAtlasMeta({
        loaded: false,
        width: 0,
        height: 0,
        columns: 0,
        rows: 0,
        error: null,
      });
      return () => {
        cancelled = true;
      };
    }
    if (!tilePixelWidth || !tilePixelHeight) {
      setAtlasMeta({
        loaded: false,
        width: 0,
        height: 0,
        columns: 0,
        rows: 0,
        error: 'Set tile pixel width and height before loading atlas grid.',
      });
      return () => {
        cancelled = true;
      };
    }

    const image = new Image();
    image.onload = () => {
      if (cancelled) {
        return;
      }

      const columns = Math.floor(image.width / tilePixelWidth);
      const rows = Math.floor(image.height / tilePixelHeight);
      if (columns <= 0 || rows <= 0) {
        setAtlasMeta({
          loaded: false,
          width: image.width,
          height: image.height,
          columns: 0,
          rows: 0,
          error: `Tileset image is smaller than one tile (${tilePixelWidth}x${tilePixelHeight}).`,
        });
        return;
      }

      setAtlasMeta({
        loaded: true,
        width: image.width,
        height: image.height,
        columns,
        rows,
        error: null,
      });
    };

    image.onerror = () => {
      if (cancelled) {
        return;
      }

      setAtlasMeta((current) => ({
        ...current,
        loaded: false,
        error: `Unable to load tileset from ${tilesetUrl}`,
      }));
    };

    image.src = tilesetUrl;

    return () => {
      cancelled = true;
    };
  }, [tilePixelHeightInput, tilePixelWidthInput, tilesetUrl]);

  useEffect(() => {
    let cancelled = false;
    const frameWidth = parseInteger(npcFrameWidthInput);
    const frameHeight = parseInteger(npcFrameHeightInput);

    if (!npcSpriteUrl) {
      setNpcSpriteMeta({
        loaded: false,
        width: 0,
        height: 0,
        columns: 0,
        rows: 0,
        error: null,
      });
      return () => {
        cancelled = true;
      };
    }
    if (!frameWidth || !frameHeight) {
      setNpcSpriteMeta({
        loaded: false,
        width: 0,
        height: 0,
        columns: 0,
        rows: 0,
        error: 'Set NPC frame width and height before loading sheet grid.',
      });
      return () => {
        cancelled = true;
      };
    }

    const image = new Image();
    image.onload = () => {
      if (cancelled) {
        return;
      }
      const columns = Math.floor(image.width / frameWidth);
      const rows = Math.floor(image.height / frameHeight);
      if (columns <= 0 || rows <= 0) {
        setNpcSpriteMeta({
          loaded: false,
          width: image.width,
          height: image.height,
          columns: 0,
          rows: 0,
          error: `NPC sheet image is smaller than one frame (${frameWidth}x${frameHeight}).`,
        });
        return;
      }

      setNpcSpriteMeta({
        loaded: true,
        width: image.width,
        height: image.height,
        columns,
        rows,
        error: null,
      });
    };
    image.onerror = () => {
      if (cancelled) {
        return;
      }
      setNpcSpriteMeta((current) => ({
        ...current,
        loaded: false,
        error: `Unable to load NPC sheet from ${npcSpriteUrl}`,
      }));
    };
    image.src = npcSpriteUrl;

    return () => {
      cancelled = true;
    };
  }, [npcFrameHeightInput, npcFrameWidthInput, npcSpriteUrl]);

  useEffect(() => {
    if (atlasCellCount <= 0) {
      setSelectedAtlasStartIndex(null);
      setSelectedAtlasEndIndex(null);
      return;
    }

    setSelectedAtlasStartIndex((current) =>
      current === null ? current : clampInt(current, 0, atlasCellCount - 1),
    );
    setSelectedAtlasEndIndex((current) => (current === null ? current : clampInt(current, 0, atlasCellCount - 1)));
    setSavedPaintTiles((current) => {
      let changed = false;
      const next = current.map((tile) => {
        const nextCells = tile.cells.map((cell) => ({
          ...cell,
          atlasIndex: clampInt(cell.atlasIndex, 0, atlasCellCount - 1),
        }));
        const cellChanged = nextCells.some((cell, index) => cell.atlasIndex !== tile.cells[index].atlasIndex);
        if (cellChanged) {
          changed = true;
          return {
            ...tile,
            cells: nextCells,
          };
        }

        return tile;
      });

      if (changed) {
        void persistSavedPaintTiles(next);
      }
      return changed ? next : current;
    });
  }, [atlasCellCount]);

  useEffect(() => {
    if (npcAtlasCellCount <= 0) {
      setSelectedNpcAtlasStartIndex(null);
      setSelectedNpcAtlasEndIndex(null);
      return;
    }

    const maxIndex = Math.max(0, npcAtlasCellCount - 1);
    setNpcFacingFrames((current) => ({
      up: clampInt(current.up, 0, maxIndex),
      down: clampInt(current.down, 0, maxIndex),
      left: clampInt(current.left, 0, maxIndex),
      right: clampInt(current.right, 0, maxIndex),
    }));
    setNpcWalkFrames((current) => ({
      up: current.up.map((value) => clampInt(value, 0, maxIndex)),
      down: current.down.map((value) => clampInt(value, 0, maxIndex)),
      left: current.left.map((value) => clampInt(value, 0, maxIndex)),
      right: current.right.map((value) => clampInt(value, 0, maxIndex)),
    }));
    setSelectedNpcAtlasStartIndex((current) => (current === null ? null : clampInt(current, 0, maxIndex)));
    setSelectedNpcAtlasEndIndex((current) => (current === null ? null : clampInt(current, 0, maxIndex)));
  }, [npcAtlasCellCount]);

  useEffect(() => {
    return () => {
      if (uploadedObjectUrlRef.current) {
        URL.revokeObjectURL(uploadedObjectUrlRef.current);
      }
    };
  }, []);

  const setStatus = (message: string) => {
    setStatusMessage(message);
    setErrorMessage(null);
  };

  const setError = (message: string) => {
    setErrorMessage(message);
    setStatusMessage(null);
  };

  const toggleTool = (nextTool: PaintTool) => {
    setTool((current) => {
      if (isNpcsSection) {
        if (nextTool === 'npc-paint' || nextTool === 'npc-erase') {
          return nextTool;
        }
        return current;
      }
      if (nextTool === 'select' || nextTool === 'encounter-select') {
        return nextTool;
      }
      return current === nextTool ? 'select' : nextTool;
    });
  };

  const persistSavedPaintTiles = async (nextTiles: SavedPaintTile[]) => {
    try {
      await setAdminDbValue(SAVED_PAINT_TILES_DB_KEY, nextTiles);
      const tilePixelWidth = parseInteger(tilePixelWidthInput);
      const tilePixelHeight = parseInteger(tilePixelHeightInput);

      const result = await apiFetchJson<SaveTileDatabaseResponse>('/api/admin/tiles/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          map: editableMap,
          savedPaintTiles: nextTiles,
          tileset:
            tilesetUrl && tilePixelWidth && tilePixelHeight
              ? {
                  url: tilesetUrl,
                  tilePixelWidth,
                  tilePixelHeight,
                }
              : null,
        }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to sync tile database.');
      }
    } catch {
      setError('Unable to save paint tiles to database/project tile catalog.');
    }
  };

  const persistNpcLibraries = async (
    nextSprites: NpcSpriteLibraryEntry[],
    nextCharacters: NpcCharacterTemplateEntry[],
  ) => {
    const result = await apiFetchJson<SaveNpcLibraryResponse>('/api/admin/npc/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        npcSpriteLibrary: nextSprites,
        npcCharacterLibrary: nextCharacters,
      }),
    });

    if (!result.ok) {
      throw new Error(result.error ?? result.data?.error ?? 'Unable to save NPC libraries.');
    }
  };

  const persistNpcSpriteLibrary = async (nextSprites: NpcSpriteLibraryEntry[]) => {
    try {
      await setAdminDbValue(NPC_SPRITE_LIBRARY_DB_KEY, nextSprites);
      await persistNpcLibraries(nextSprites, npcCharacterLibrary);
    } catch {
      setError('Unable to save NPC sprites.');
    }
  };

  const persistNpcCharacterLibrary = async (nextCharacters: NpcCharacterTemplateEntry[]) => {
    try {
      await setAdminDbValue(NPC_CHARACTER_LIBRARY_DB_KEY, nextCharacters);
      await persistNpcLibraries(npcSpriteLibrary, nextCharacters);
    } catch {
      setError('Unable to save NPC characters.');
    }
  };

  const loadSourceMapsFromDatabase = async () => {
    try {
      const result = await apiFetchJson<LoadMapsResponse>('/api/admin/maps/list');
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load maps.');
      }

      const loadedMaps = Array.isArray(result.data?.maps)
        ? result.data.maps
            .map((entry) => {
              try {
                return parseEditableMapJson(JSON.stringify(entry));
              } catch {
                return null;
              }
            })
            .filter((entry): entry is EditableMap => entry !== null)
        : [];
      setSourceMaps(loadedMaps);
    } catch {
      setError('Unable to load maps from database.');
    }
  };

  const loadSavedPaintTilesFromDatabase = async () => {
    try {
      const raw = await getAdminDbValue<unknown>(SAVED_PAINT_TILES_DB_KEY);
      const loadedFromIndexedDb = sanitizeSavedPaintTiles(raw);
      const loadedFromProjectDb = sanitizeSavedPaintTiles(SAVED_PAINT_TILE_DATABASE as unknown);
      const tilesResponse = await apiFetchJson<LoadTileLibraryResponse>('/api/admin/tiles/list');
      const loadedFromServer = sanitizeSavedPaintTiles(tilesResponse.data?.savedPaintTiles as unknown);
      const mergedById = new Map<string, SavedPaintTile>();
      for (const tile of loadedFromProjectDb) {
        mergedById.set(tile.id, tile);
      }
      for (const tile of loadedFromServer) {
        mergedById.set(tile.id, tile);
      }
      for (const tile of loadedFromIndexedDb) {
        mergedById.set(tile.id, tile);
      }
      const loaded = Array.from(mergedById.values());
      setSavedPaintTiles(loaded);
      await setAdminDbValue(SAVED_PAINT_TILES_DB_KEY, loaded);
      const first = loaded[0];
      setSelectedPaintTileId(first?.id ?? '');
      setSelectedTileCode(first?.primaryCode ?? '');
      const serverTileset = tilesResponse.data?.tileset;
      if (serverTileset?.url && typeof serverTileset.url === 'string') {
        setTilesetUrlInput(serverTileset.url);
        setTilesetUrl(serverTileset.url);
      }
      if (typeof serverTileset?.tilePixelWidth === 'number' && serverTileset.tilePixelWidth > 0) {
        setTilePixelWidthInput(String(serverTileset.tilePixelWidth));
      }
      if (typeof serverTileset?.tilePixelHeight === 'number' && serverTileset.tilePixelHeight > 0) {
        setTilePixelHeightInput(String(serverTileset.tilePixelHeight));
      }
      if (loaded.length > loadedFromServer.length) {
        void persistSavedPaintTiles(loaded);
      }
      setStatus(
        loaded.length > 0
          ? `Loaded ${loaded.length} saved paint tile(s) from tile database.`
          : 'No saved paint tiles found in tile database.',
      );
    } catch {
      setError('Unable to load saved paint tiles from tile database.');
    }
  };

  const loadNpcTemplatesFromDatabase = async () => {
    try {
      const rawSpriteLibrary = await getAdminDbValue<unknown>(NPC_SPRITE_LIBRARY_DB_KEY);
      const rawCharacterLibrary = await getAdminDbValue<unknown>(NPC_CHARACTER_LIBRARY_DB_KEY);
      const serverResult = await apiFetchJson<LoadNpcLibraryResponse>('/api/admin/npc/list');
      const serverSprites = sanitizeNpcSpriteLibrary(serverResult.data?.npcSpriteLibrary as unknown);
      const serverCharacters = sanitizeNpcCharacterLibrary(serverResult.data?.npcCharacterLibrary as unknown);

      const loadedSprites = sanitizeNpcSpriteLibrary(rawSpriteLibrary);
      const loadedCharacters = sanitizeNpcCharacterLibrary(rawCharacterLibrary);
      const mergedSpriteById = new Map<string, NpcSpriteLibraryEntry>();
      for (const sprite of loadedSprites) {
        mergedSpriteById.set(sprite.id, sprite);
      }
      for (const sprite of serverSprites) {
        mergedSpriteById.set(sprite.id, sprite);
      }
      const mergedCharacterById = new Map<string, NpcCharacterTemplateEntry>();
      for (const character of loadedCharacters) {
        mergedCharacterById.set(character.id, character);
      }
      for (const character of serverCharacters) {
        mergedCharacterById.set(character.id, character);
      }
      const mergedSprites = Array.from(mergedSpriteById.values());
      const mergedCharacters = normalizeCoreStoryNpcCharacters(Array.from(mergedCharacterById.values()));

      setNpcSpriteLibrary(mergedSprites);
      setNpcCharacterLibrary(mergedCharacters);
      setSelectedNpcSpriteId(mergedSprites[0]?.id ?? '');
      setSelectedNpcCharacterId(mergedCharacters[0]?.id ?? '');
      await setAdminDbValue(NPC_SPRITE_LIBRARY_DB_KEY, mergedSprites);
      await setAdminDbValue(NPC_CHARACTER_LIBRARY_DB_KEY, mergedCharacters);
      void persistNpcLibraries(mergedSprites, mergedCharacters);
      setStatus(
        mergedCharacters.length > 0 || mergedSprites.length > 0
          ? `Loaded ${mergedSprites.length} NPC sprite(s) and ${mergedCharacters.length} NPC character(s).`
          : 'No NPC sprites/characters found in database.',
      );
    } catch {
      setError('Unable to load NPC sprites/characters from database.');
    }
  };

  const loadFlagsFromDatabase = async () => {
    try {
      const loaded = await loadAdminFlags();
      setFlagEntries(loaded);
    } catch {
      setFlagEntries([]);
    }
  };

  const loadEncounterDataFromDatabase = async () => {
    setIsLoadingEncounterTables(true);
    try {
      const [encounterResult, critterResult] = await Promise.all([
        apiFetchJson<LoadEncounterLibraryResponse>('/api/admin/encounters/list'),
        apiFetchJson<LoadCritterLibraryResponse>('/api/admin/critters/list'),
      ]);
      if (!encounterResult.ok) {
        throw new Error(encounterResult.error ?? encounterResult.data?.error ?? 'Unable to load encounter tables.');
      }
      if (!critterResult.ok) {
        throw new Error(critterResult.error ?? critterResult.data?.error ?? 'Unable to load critter list.');
      }

      const loadedTables = sanitizeEncounterTableLibrary(encounterResult.data?.encounterTables);
      const loadedCritters = sanitizeCritterDatabase(critterResult.data?.critters);
      setEncounterTables(loadedTables);
      setEncounterCritters(loadedCritters);
      setStatus(`Loaded ${loadedTables.length} encounter table(s).`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to load encounter tables.';
      setError(message);
    } finally {
      setIsLoadingEncounterTables(false);
    }
  };

  useEffect(() => {
    if (section === 'full' || hasAutoLoadedLibrariesRef.current) {
      return;
    }

    if (isMapSection || isNpcsSection || isNpcCharactersSection) {
      void loadSourceMapsFromDatabase();
    }
    if (isMapSection || isTilesSection || isNpcsSection) {
      void loadSavedPaintTilesFromDatabase();
    }
    if (isMapSection || isNpcsSection || isNpcSpritesSection || isNpcCharactersSection) {
      void loadNpcTemplatesFromDatabase();
    }
    if (isMapSection || isNpcsSection || isNpcCharactersSection) {
      void loadFlagsFromDatabase();
    }
    if (isMapSection) {
      void loadEncounterDataFromDatabase();
    }
    hasAutoLoadedLibrariesRef.current = true;
  }, [isMapSection, isNpcsSection, isNpcSpritesSection, isNpcCharactersSection, isTilesSection, section]);

  useEffect(() => {
    if (!isNpcsSection) {
      return;
    }
    if (tool !== 'npc-paint' && tool !== 'npc-erase') {
      setTool('npc-paint');
    }
  }, [isNpcsSection, tool]);

  const applyPaintTileStamp = (
    map: EditableMap,
    layerId: string,
    originX: number,
    originY: number,
    tile: SavedPaintTile,
    rotationQuarter: number,
    mirrorHorizontal: boolean,
    mirrorVertical: boolean,
  ): EditableMap => {
    const next = cloneEditableMap(map);
    const layer = getLayerById(next, layerId);
    if (!layer) {
      return map;
    }
    const { width, height } = getMapSize(next);
    if (width <= 0 || height <= 0) {
      return map;
    }

    const transformedCells = transformStampCells(tile, rotationQuarter, mirrorHorizontal, mirrorVertical);
    let changed = false;
    for (const cell of transformedCells) {
      const x = originX + cell.dx;
      const y = originY + cell.dy;
      if (x < 0 || y < 0 || x >= width || y >= height) {
        continue;
      }

      const row = layer.tiles[y];
      const rotationRow = layer.rotations[y] ?? '0'.repeat(row.length);
      const rotationChar = String(cell.rotationQuarter);
      if (row[x] === cell.code && (rotationRow[x] ?? '0') === rotationChar) {
        continue;
      }

      layer.tiles[y] = `${row.slice(0, x)}${cell.code}${row.slice(x + 1)}`;
      layer.rotations[y] = `${rotationRow.slice(0, x)}${rotationChar}${rotationRow.slice(x + 1)}`;
      changed = true;
    }

    return changed ? next : map;
  };

  const fillWithRotatedPattern = (
    map: EditableMap,
    layerId: string,
    startX: number,
    startY: number,
    code: EditorTileCode,
    baseRotationQuarter: number,
  ): EditableMap => {
    const targetCode = getTileCodeAt(map, startX, startY, layerId);
    if (!targetCode) {
      return map;
    }

    const next = cloneEditableMap(map);
    const layer = getLayerById(next, layerId);
    if (!layer) {
      return map;
    }

    const { width, height } = getMapSize(next);
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    const visited = new Set<string>();
    let changed = false;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      const key = `${current.x},${current.y}`;
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      if (current.x < 0 || current.y < 0 || current.x >= width || current.y >= height) {
        continue;
      }

      const existing = getTileCodeAt(next, current.x, current.y, layerId);
      if (existing !== targetCode) {
        continue;
      }

      const row = layer.tiles[current.y];
      const rotationRow = layer.rotations[current.y] ?? '0'.repeat(row.length);
      const delta = Math.abs(current.x - startX) + Math.abs(current.y - startY);
      const rotationQuarter = normalizeQuarter(baseRotationQuarter + (delta % 4));
      const rotationChar = String(code === BLANK_TILE_CODE ? 0 : rotationQuarter);
      if (row[current.x] !== code || (rotationRow[current.x] ?? '0') !== rotationChar) {
        layer.tiles[current.y] = `${row.slice(0, current.x)}${code}${row.slice(current.x + 1)}`;
        layer.rotations[current.y] = `${rotationRow.slice(0, current.x)}${rotationChar}${rotationRow.slice(current.x + 1)}`;
        changed = true;
      }

      queue.push({ x: current.x + 1, y: current.y });
      queue.push({ x: current.x - 1, y: current.y });
      queue.push({ x: current.x, y: current.y + 1 });
      queue.push({ x: current.x, y: current.y - 1 });
    }

    return changed ? next : map;
  };

  const applyPaintTool = (
    x: number,
    y: number,
    source: 'drag' | 'click',
    options?: { appendSelection?: boolean; removeSelection?: boolean },
  ) => {
    if (!hasMapLoaded) {
      return;
    }

    if (tool === 'camera-point') {
      setEditableMap((current) => ({ ...cloneEditableMap(current), cameraPoint: { x, y } }));
      setStatus(`Camera point set to (${x}, ${y}).`);
      return;
    }
    if (tool === 'camera-preview') {
      return;
    }

    if (tool === 'encounter-select') {
      const cellCode = getTileCodeAt(editableMap, x, y);
      if (!cellCode || cellCode === BLANK_TILE_CODE) {
        if (source === 'click') {
          setError('Encounter selection only targets non-empty map cells.');
        }
        return;
      }
      const key = `${x},${y}`;
      setSelectedCellKeys((current) => {
        if (options?.removeSelection) {
          return current.filter((entry) => entry !== key);
        }
        if (source === 'drag' || options?.appendSelection) {
          if (current.includes(key)) {
            return current;
          }
          return [...current, key];
        }
        return [key];
      });
      return;
    }

    if (tool === 'select') {
      return;
    }

    if (
      tool === 'rotate-left' ||
      tool === 'rotate-right' ||
      tool === 'mirror-horizontal' ||
      tool === 'mirror-vertical'
    ) {
      setEditableMap((current) => {
        const next = cloneEditableMap(current);
        const activeCandidate = activeLayer ? getLayerById(next, activeLayer.id) : null;
        const activeHasTile =
          Boolean(activeCandidate?.tiles[y]) &&
          Boolean(activeCandidate?.tiles[y]?.[x]) &&
          activeCandidate?.tiles[y]?.[x] !== BLANK_TILE_CODE;
        const targetLayer =
          (activeHasTile ? activeCandidate : null) ??
          [...next.layers]
            .reverse()
            .find((layer) => layer.visible && layer.tiles[y] && layer.tiles[y][x] && layer.tiles[y][x] !== BLANK_TILE_CODE) ??
          null;
        if (!targetLayer) {
          if (source === 'click') {
            setError('Rotate/Mirror tools require clicking a cell with a tile.');
          }
          return current;
        }

        const row = targetLayer.tiles[y];
        const existingCode = row?.[x] ?? BLANK_TILE_CODE;
        if (!row || existingCode === BLANK_TILE_CODE) {
          if (source === 'click') {
            setError('Rotate/Mirror tools require clicking a cell with a tile.');
          }
          return current;
        }
        const rotationRow = targetLayer.rotations[y] ?? '0'.repeat(row.length);
        const currentRotation = normalizeQuarter(Number.parseInt(rotationRow[x] ?? '0', 10) || 0);
        let nextRotation = currentRotation;
        if (tool === 'rotate-left') {
          nextRotation = normalizeQuarter(currentRotation - 1);
        } else if (tool === 'rotate-right') {
          nextRotation = normalizeQuarter(currentRotation + 1);
        } else if (tool === 'mirror-horizontal') {
          nextRotation = currentRotation === 1 ? 3 : currentRotation === 3 ? 1 : currentRotation;
        } else if (tool === 'mirror-vertical') {
          nextRotation = currentRotation === 0 ? 2 : currentRotation === 2 ? 0 : currentRotation;
        }
        if (nextRotation === currentRotation) {
          return current;
        }
        targetLayer.rotations[y] = `${rotationRow.slice(0, x)}${nextRotation}${rotationRow.slice(x + 1)}`;
        return next;
      });
      return;
    }

    if (tool === 'npc-paint') {
      if (source === 'drag') {
        return;
      }
      if (!selectedNpcCharacter) {
        setError('Select an NPC character before painting NPCs.');
        return;
      }
      if (isNpcsSection) {
        appendCharacterPlacementInstance(x, y);
        return;
      }
      const resolvedSprite =
        selectedNpcCharacter.spriteId
          ? npcSpriteLibrary.find((entry) => entry.id === selectedNpcCharacter.spriteId)?.sprite
          : undefined;
      if (selectedNpcCharacter.spriteId && !resolvedSprite) {
        setError('Selected NPC character references a missing sprite.');
        return;
      }
      setEditableMap((current) =>
        placeNpcFromTemplate(current, x, y, selectedNpcCharacter, resolvedSprite),
      );
      return;
    }

    if (tool === 'npc-erase') {
      if (source === 'drag') {
        return;
      }
      if (isNpcsSection) {
        const marker = npcMarkerByCell.get(`${x},${y}`);
        if (marker?.source === 'character') {
          const [characterId, placementIndexText] = marker.marker.key.split(':');
          const placementIndex = Number.parseInt(placementIndexText, 10);
          if (characterId && Number.isFinite(placementIndex)) {
            removeCharacterPlacementInstance(characterId, placementIndex);
            setStatus(`Removed ${marker.marker.name} instance #${placementIndex + 1}.`);
            return;
          }
        }
      }
      setEditableMap((current) => removeNpcAtPosition(current, x, y));
      return;
    }

    if (tool === 'pick') {
      if (source === 'click') {
        const code = getTileCodeAt(editableMap, x, y);
        if (code) {
          setSelectedTileCode(code);
          const matching = findMostRecentPaintTileForCode(savedPaintTiles, code);
          if (matching) {
            setSelectedPaintTileId(matching.id);
          }
          setStatus(`Selected tile ${code}`);
        }
      }
      return;
    }

    if (tool === 'fill' || tool === 'fill-rotated') {
      if (source === 'click') {
        if (!selectedTileCode) {
          setError('Select a paint tile or map cell first.');
          return;
        }
        if (!activeLayer) {
          setError('Select an active layer before using fill.');
          return;
        }
        if (tool === 'fill-rotated') {
          setEditableMap((current) =>
            fillWithRotatedPattern(current, activeLayer.id, x, y, selectedTileCode, brushRotationQuarter),
          );
        } else {
          setEditableMap((current) => floodFill(current, activeLayer.id, x, y, selectedTileCode, brushRotationQuarter));
        }
      }
      return;
    }

    if (tool === 'collision-edge') {
      if (!activeLayer) {
        if (source === 'click') {
          setError('Select an active layer before editing collision edges.');
        }
        return;
      }

      if (selectedCollisionEdgeMask === 0) {
        if (source === 'click') {
          setError('Select at least one collision edge side.');
        }
        return;
      }

      setEditableMap((current) => {
        const existingMask = getCollisionEdgeMaskAt(current, x, y, activeLayer.id);
        const nextMask =
          collisionPaintMode === 'add'
            ? existingMask | selectedCollisionEdgeMask
            : existingMask & ~selectedCollisionEdgeMask;
        return updateCollisionEdgeMask(current, activeLayer.id, x, y, nextMask);
      });
      return;
    }

    if (tool === 'warp-from' || tool === 'warp-to') {
      if (source === 'drag') {
        return;
      }

      if (!selectedWarp) {
        setError('Select a warp before placing warp coordinates.');
        return;
      }

      setEditableMap((current) => {
        const next = cloneEditableMap(current);
        const index = next.warps.findIndex((warp) => warp.id === selectedWarp.id);
        if (index < 0) {
          return current;
        }

        if (tool === 'warp-from') {
          next.warps[index].from = { x, y };
          next.warps[index].fromPositions = [{ x, y }];
        } else {
          next.warps[index].to = { x, y };
          next.warps[index].toPositions = [{ x, y }];
        }

        return next;
      });
      return;
    }

    if (tool === 'erase') {
      if (!activeLayer) {
        setError('Select an active layer before erasing.');
        return;
      }
      setEditableMap((current) => updateTile(current, activeLayer.id, x, y, BLANK_TILE_CODE, 0));
      return;
    }

    if (!selectedPaintTile) {
      if (source === 'click') {
        setError('Select a saved paint tile before painting.');
      }
      return;
    }
    if (!activeLayer) {
      if (source === 'click') {
        setError('Select an active layer before painting.');
      }
      return;
    }

    const randomRotationQuarter = tool === 'paint-rotated' ? Math.floor(Math.random() * 4) : 0;
    const rotationQuarter = normalizeQuarter(brushRotationQuarter + randomRotationQuarter);
    setEditableMap((current) =>
      applyPaintTileStamp(
        current,
        activeLayer.id,
        x,
        y,
        selectedPaintTile,
        rotationQuarter,
        brushMirrorHorizontal,
        brushMirrorVertical,
      ),
    );
  };

  const selectPaintTile = (tileId: string) => {
    const entry = savedPaintTiles.find((tile) => tile.id === tileId);
    if (!entry) {
      return;
    }

    setSelectedPaintTileId(tileId);
    setSelectedTileCode(entry.primaryCode);
  };

  const loadSelectedSourceMap = () => {
    if (!selectedSourceMapId) {
      setError('Select a map id to load.');
      return;
    }

    const source = sourceMaps.find((map) => map.id === selectedSourceMapId);
    if (!source) {
      setError(`Map ${selectedSourceMapId} not found in current registry.`);
      return;
    }

    setEditableMap(cloneEditableMap(source));
    setActiveLayerId(sortEditableLayersById(source.layers)[0]?.id ?? '');
    setLoadedSourceMapIdForSave(source.id);
    setSelectedCellKeys([]);
    setSelectedEncounterGroupId(source.encounterGroups[0]?.id ?? '');
    setStatus(`Loaded map ${source.id}`);
  };

  const createNewMap = () => {
    const width = parseInteger(newMapWidthInput);
    const height = parseInteger(newMapHeightInput);
    if (!width || !height) {
      setError('New map width and height are required.');
      return;
    }
    if (!newMapFill || !isKnownTileCode(newMapFill)) {
      setError('Choose a valid fill tile code for the new map.');
      return;
    }

    const next = createBlankEditableMap(
      sanitizeIdentifier(newMapId, 'new-map'),
      newMapName.trim() || 'New Map',
      width,
      height,
      newMapFill,
    );

    setEditableMap(next);
    setActiveLayerId(sortEditableLayersById(next.layers)[0]?.id ?? '');
    setSelectedWarpId('');
    setSelectedCellKeys([]);
    setSelectedEncounterGroupId('');
    setLoadedSourceMapIdForSave(null);
    setResizeFill(newMapFill);
    setStatus(`Created blank map ${next.id}`);
  };

  const applyResize = () => {
    if (!hasMapLoaded) {
      setError('Load or create a map before resizing.');
      return;
    }

    const width = parseInteger(resizeWidthInput);
    const height = parseInteger(resizeHeightInput);
    if (!width || !height) {
      setError('Resize width and height are required.');
      return;
    }
    if (!resizeFill || !isKnownTileCode(resizeFill)) {
      setError('Choose a valid fill tile code for resize operations.');
      return;
    }

    setEditableMap((current) => resizeEditableMap(current, width, height, resizeFill));
    setStatus(`Resized map to ${width}x${height}`);
  };

  const addLayer = () => {
    if (!hasMapLoaded) {
      setError('Load or create a map before adding layers.');
      return;
    }
    if (editableMap.layers.length >= 16) {
      setError('Layer limit reached (16).');
      return;
    }

    const nextId = nextLayerId(editableMap.layers);
    const layerName = newLayerName.trim() || `Layer ${nextId}`;
    const nextLayer = createBlankLayer(mapSize.width, mapSize.height, {
      id: nextId,
      name: layerName,
      fillCode: BLANK_TILE_CODE,
      visible: true,
      collision: false,
    });

    setEditableMap((current) => {
      const next = cloneEditableMap(current);
      next.layers = sortEditableLayersById([...next.layers, nextLayer]);
      return next;
    });
    setActiveLayerId(nextId);
    setNewLayerName('');
    setStatus(`Added layer "${layerName}" (${nextId}).`);
  };

  const removeActiveLayer = () => {
    if (!activeLayer) {
      setError('Select a layer to remove.');
      return;
    }
    if (editableMap.layers.length <= 1) {
      setError('At least one layer is required.');
      return;
    }

    const targetLayerId = activeLayer.id;
    setEditableMap((current) => {
      const next = cloneEditableMap(current);
      next.layers = sortEditableLayersById(next.layers.filter((layer) => layer.id !== targetLayerId));
      return next;
    });
    setStatus(`Removed layer ${targetLayerId}.`);
  };

  const updateActiveLayer = (updater: (layer: EditableMapLayer) => EditableMapLayer) => {
    if (!activeLayer) {
      return;
    }

    const targetLayerId = activeLayer.id;
    setEditableMap((current) => {
      const next = cloneEditableMap(current);
      const index = next.layers.findIndex((layer) => layer.id === targetLayerId);
      if (index < 0) {
        return current;
      }

      next.layers[index] = updater(next.layers[index]);
      next.layers = sortEditableLayersById(next.layers);
      return next;
    });
  };

  const addWarp = () => {
    if (!hasMapLoaded) {
      setError('Load or create a map before adding warps.');
      return;
    }

    let createdWarpId = '';

    setEditableMap((current) => {
      const next = cloneEditableMap(current);
      createdWarpId = makeUniqueWarpId(next.warps, current.id);
      next.warps.push({
        id: createdWarpId,
        from: { x: 0, y: 0 },
        fromPositions: [{ x: 0, y: 0 }],
        toMapId: sourceMapIds[0] ?? current.id,
        to: { x: 0, y: 0 },
        toPositions: [{ x: 0, y: 0 }],
        requireInteract: true,
        requiredFacing: undefined,
        label: 'Warp',
      });
      return next;
    });

    setSelectedWarpId(createdWarpId);
    setStatus(`Added warp ${createdWarpId}`);
  };

  const removeSelectedWarp = () => {
    if (!selectedWarp) {
      return;
    }

    setEditableMap((current) => {
      const next = cloneEditableMap(current);
      next.warps = next.warps.filter((warp) => warp.id !== selectedWarp.id);
      return next;
    });
    setStatus(`Removed warp ${selectedWarp.id}`);
  };

  const updateSelectedWarp = (updater: (warp: WarpDefinition) => WarpDefinition) => {
    if (!selectedWarp) {
      return;
    }

    setEditableMap((current) => {
      const next = cloneEditableMap(current);
      const index = next.warps.findIndex((warp) => warp.id === selectedWarp.id);
      if (index < 0) {
        return current;
      }

      next.warps[index] = updater(next.warps[index]);
      return next;
    });
  };

  const addEncounterSelectionCell = (x: number, y: number, append: boolean) => {
    if (!hasMapLoaded) {
      return;
    }
    const code = getTileCodeAt(editableMap, x, y);
    if (!code || code === BLANK_TILE_CODE) {
      setError('Encounter tiles must reference non-empty map cells.');
      return;
    }
    const key = `${x},${y}`;
    setSelectedCellKeys((current) => {
      if (append) {
        if (current.includes(key)) {
          return current;
        }
        return [...current, key];
      }
      return [key];
    });
  };

  const removeEncounterSelectionCell = (x: number, y: number) => {
    const key = `${x},${y}`;
    setSelectedCellKeys((current) => current.filter((entry) => entry !== key));
  };

  const addManualEncounterTileIndex = () => {
    const x = parseInteger(encounterManualTileXInput);
    const y = parseInteger(encounterManualTileYInput);
    if (x === null || y === null) {
      setError('Enter valid numeric X/Y tile indexes to add.');
      return;
    }
    addEncounterSelectionCell(x, y, true);
    setEncounterManualTileXInput('');
    setEncounterManualTileYInput('');
  };

  const clearEncounterSelection = () => {
    setSelectedCellKeys([]);
  };

  const startEncounterGroupDraft = () => {
    setSelectedEncounterGroupId('');
    setEncounterGroupIdInput(suggestEncounterGroupId(editableMap.encounterGroups));
    setEncounterWalkTableIdInput('');
    setEncounterFishTableIdInput('');
    setEncounterWalkFrequencyPercent(0);
    setEncounterFishFrequencyPercent(0);
    setSelectedCellKeys([]);
    setTool('encounter-select');
  };

  const removeSelectedEncounterGroup = () => {
    if (!selectedEncounterGroup) {
      setError('Select an encounter group to remove.');
      return;
    }
    const removedId = selectedEncounterGroup.id;
    setEditableMap((current) => {
      const next = cloneEditableMap(current);
      next.encounterGroups = next.encounterGroups.filter((group) => group.id !== removedId);
      return next;
    });
    setSelectedEncounterGroupId('');
    setSelectedCellKeys([]);
    setStatus(`Removed encounter group "${removedId}".`);
  };

  const applyEncounterGroupToMap = () => {
    const groupId = sanitizeIdentifier(encounterGroupIdInput, '');
    if (!groupId) {
      setError('Encounter group ID is required.');
      return;
    }

    const walkEncounterTableId = encounterWalkTableIdInput.trim() ? sanitizeIdentifier(encounterWalkTableIdInput, '') : '';
    const fishEncounterTableId = encounterFishTableIdInput.trim() ? sanitizeIdentifier(encounterFishTableIdInput, '') : '';
    if (walkEncounterTableId && !encounterTablesById.has(walkEncounterTableId)) {
      setError(`Walk encounter table "${walkEncounterTableId}" does not exist.`);
      return;
    }
    if (fishEncounterTableId && !encounterTablesById.has(fishEncounterTableId)) {
      setError(`Fish encounter table "${fishEncounterTableId}" does not exist.`);
      return;
    }

    const tilePositions = selectedCellKeys
      .map((key) => parseCellKey(key))
      .filter((position): position is Vector2 => position !== null)
      .filter((position) => {
        const code = getTileCodeAt(editableMap, position.x, position.y);
        return Boolean(code && code !== BLANK_TILE_CODE);
      });
    if (tilePositions.length === 0) {
      setError('Select one or more non-empty map cells before setting encounter group.');
      return;
    }

    const nextGroup: MapEncounterGroupDefinition = {
      id: groupId,
      tilePositions,
      walkEncounterTableId: walkEncounterTableId || null,
      fishEncounterTableId: fishEncounterTableId || null,
      walkFrequency: clampEncounterFrequency(encounterWalkFrequencyPercent / 100),
      fishFrequency: clampEncounterFrequency(encounterFishFrequencyPercent / 100),
    };

    setEditableMap((current) => {
      const next = cloneEditableMap(current);
      const existingIndex = next.encounterGroups.findIndex((group) => group.id === groupId);
      if (existingIndex >= 0) {
        next.encounterGroups[existingIndex] = nextGroup;
      } else {
        next.encounterGroups.push(nextGroup);
      }
      next.encounterGroups.sort((left, right) => left.id.localeCompare(right.id));
      return next;
    });
    setSelectedEncounterGroupId(groupId);
    setStatus(`Set encounter group "${groupId}" on ${tilePositions.length} tile(s).`);
  };

  const applyNpcJson = () => {
    if (!hasMapLoaded) {
      setError('Load or create a map before applying NPC JSON.');
      return;
    }

    try {
      const parsed = JSON.parse(npcJsonDraft) as NpcDefinition[];
      if (!Array.isArray(parsed)) {
        throw new Error('NPC JSON must be an array');
      }

      setEditableMap((current) => ({
        ...cloneEditableMap(current),
        npcs: parsed,
      }));
      setStatus('NPC list updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid NPC JSON';
      setError(message);
    }
  };

  const applyInteractionJson = () => {
    if (!hasMapLoaded) {
      setError('Load or create a map before applying interaction JSON.');
      return;
    }

    try {
      const parsed = JSON.parse(interactionJsonDraft) as InteractionDefinition[];
      if (!Array.isArray(parsed)) {
        throw new Error('Interaction JSON must be an array');
      }

      setEditableMap((current) => ({
        ...cloneEditableMap(current),
        interactions: parsed,
      }));
      setStatus('Interaction list updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid interaction JSON';
      setError(message);
    }
  };

  const applyImportedJson = () => {
    try {
      const parsed = parseEditableMapJson(importJsonDraft);
      setEditableMap(parsed);
      setActiveLayerId(sortEditableLayersById(parsed.layers)[0]?.id ?? '');
      setSelectedSourceMapId(parsed.id);
      setSelectedCellKeys([]);
      setSelectedEncounterGroupId(parsed.encounterGroups[0]?.id ?? '');
      setLoadedSourceMapIdForSave(null);
      setStatus(`Imported map ${parsed.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid map JSON';
      setError(message);
    }
  };

  const copyExport = async (value: string, label: string) => {
    if (!navigator.clipboard) {
      setError('Clipboard API is unavailable in this browser context.');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copied to clipboard.`);
    } catch {
      setError(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  const saveMapToProjectFile = async () => {
    if (!hasMapLoaded) {
      setError('Load, create, or import a map before saving to file.');
      return;
    }

    setIsSavingMapFile(true);
    try {
      const tilePixelWidth = parseInteger(tilePixelWidthInput);
      const tilePixelHeight = parseInteger(tilePixelHeightInput);
      const tilesetPayload =
        tilesetUrl && tilePixelWidth && tilePixelHeight
          ? {
              url: tilesetUrl,
              tilePixelWidth,
              tilePixelHeight,
            }
          : undefined;

      const result = await apiFetchJson<SaveMapResponse>('/api/admin/maps/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          existingMapId: loadedSourceMapIdForSave,
          map: editableMap,
          savedPaintTiles,
          ...(tilesetPayload ? { tileset: tilesetPayload } : {}),
        }),
      });

      if (!result.ok || !result.data) {
        throw new Error(result.error ?? 'Map save failed.');
      }
      const payload = result.data;

      const nextMapId = payload.mapId ?? editableMap.id;
      if (nextMapId !== editableMap.id) {
        setEditableMap((current) => ({
          ...cloneEditableMap(current),
          id: nextMapId,
        }));
      }
      setLoadedSourceMapIdForSave(nextMapId);
      setSelectedSourceMapId(nextMapId);
      void loadSourceMapsFromDatabase();

      const customCount = payload.customTileCodes?.length ?? 0;
      const blobTilesetWarning =
        tilesetUrl.startsWith('blob:') && customCount > 0
          ? ' Tileset URL is blob-based, so game runtime falls back to color rendering until you save with a persistent tileset URL.'
          : '';
      setStatus(
        `Saved map file (${payload.mapFilePath ?? 'unknown'}) and synced ${customCount} custom tile code(s) (${payload.customTilesFilePath ?? 'unknown'}).${blobTilesetWarning}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save map file.';
      setError(message);
    } finally {
      setIsSavingMapFile(false);
    }
  };

  const downloadExport = (value: string, fileName: string) => {
    if (!value) {
      setError('Nothing to export yet. Load/create/import a map first.');
      return;
    }

    const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);

    setStatus(`Downloaded ${fileName}`);
  };

  const applyTilesetUrl = () => {
    if (!tilesetUrlInput.trim()) {
      setError('Tileset URL cannot be empty.');
      return;
    }
    if (!parseInteger(tilePixelWidthInput) || !parseInteger(tilePixelHeightInput)) {
      setError('Set tile pixel width and height before applying tileset URL.');
      return;
    }

    setTilesetUrl(tilesetUrlInput.trim());
    setStatus('Tileset URL applied.');
  };

  const loadExampleTileset = () => {
    setError('No bundled example tileset is available. Upload a tileset file instead.');
  };

  const onTilesetFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    void (async () => {
      try {
        const dataUrl = await fileToDataUrl(file);
        if (uploadedObjectUrlRef.current) {
          URL.revokeObjectURL(uploadedObjectUrlRef.current);
          uploadedObjectUrlRef.current = null;
        }
        setTilesetUrlInput(dataUrl);
        setTilesetUrl(dataUrl);
        setStatus(`Loaded and applied tileset file ${file.name} (persisted URL).`);
      } catch {
        setError(`Unable to load tileset file ${file.name}.`);
      }
    })();
  };

  const autoGeneratePaintTiles = () => {
    if (atlasCellCount <= 0) {
      setError('Load a tileset and configure tile size before auto-generating paint tiles.');
      return;
    }

    const maxIndex = Math.max(0, atlasCellCount - 1);
    const generated = createAutoPaintTiles(maxIndex);
    setSavedPaintTiles(generated);
    void persistSavedPaintTiles(generated);

    const first = generated[0];
    setSelectedPaintTileId(first?.id ?? '');
    setSelectedTileCode(first?.primaryCode ?? '');
    setStatus('Auto-generated paint tile selections.');
  };

  const saveManualPaintTileFromAtlas = () => {
    if (atlasCellCount <= 0) {
      setError('Tileset grid must load before saving manual paint tiles.');
      return;
    }
    if (!selectedAtlasRect) {
      setError('Select a tileset rectangle by click-dragging on the atlas grid first.');
      return;
    }

    const usedCodes = new Set<string>();
    for (const code of Object.keys(TILE_DEFINITIONS)) {
      usedCodes.add(code);
    }
    for (const tile of savedPaintTiles) {
      for (const cell of tile.cells) {
        usedCodes.add(cell.code);
      }
    }
    for (const layer of editableMap.layers) {
      for (const row of layer.tiles) {
        for (const code of row) {
          usedCodes.add(code);
        }
      }
    }

    const cells: SavedPaintTileCell[] = [];
    for (let dy = 0; dy < selectedAtlasRect.height; dy += 1) {
      for (let dx = 0; dx < selectedAtlasRect.width; dx += 1) {
        const generatedCode = generateNextTileCode(usedCodes);
        if (!generatedCode) {
          setError('No available generated tile codes remain in the configured code ranges.');
          return;
        }

        usedCodes.add(generatedCode);
        const atlasIndex = selectedAtlasRect.minRow * atlasMeta.columns + selectedAtlasRect.minCol + (dy * atlasMeta.columns) + dx;
        cells.push({
          code: generatedCode,
          atlasIndex: clampInt(atlasIndex, 0, atlasCellCount - 1),
          dx,
          dy,
        });
      }
    }

    if (cells.length === 0) {
      setError('No atlas cells were selected.');
      return;
    }

    const safeName =
      manualPaintTileName.trim() || `Custom Tile ${selectedAtlasRect.width}x${selectedAtlasRect.height}`;
    const next: SavedPaintTile = {
      id: makeSavedPaintTileId(safeName, savedPaintTiles),
      name: safeName,
      primaryCode: cells[0].code,
      width: selectedAtlasRect.width,
      height: selectedAtlasRect.height,
      ySortWithActors: inferTileYSortWithActors(safeName, selectedAtlasRect.width, selectedAtlasRect.height),
      cells,
    };

    const updatedSavedTiles = [...savedPaintTiles, next];
    setSavedPaintTiles(updatedSavedTiles);
    void persistSavedPaintTiles(updatedSavedTiles);
    setSelectedPaintTileId(next.id);
    setSelectedTileCode(next.primaryCode);
    setStatus(
      `Saved paint tile "${next.name}" (${next.width}x${next.height}) using ${next.cells.length} generated code(s).`,
    );
  };

  const updateSavedPaintTile = (tileId: string, updater: (tile: SavedPaintTile) => SavedPaintTile) => {
    setSavedPaintTiles((current) => {
      const index = current.findIndex((tile) => tile.id === tileId);
      if (index < 0) {
        return current;
      }

      const next = [...current];
      next[index] = updater(next[index]);
      void persistSavedPaintTiles(next);
      return next;
    });
  };

  const removePaintTile = (tileId: string) => {
    setSavedPaintTiles((current) => {
      const next = current.filter((tile) => tile.id !== tileId);
      void persistSavedPaintTiles(next);
      return next;
    });
    if (selectedPaintTileId === tileId) {
      setSelectedPaintTileId('');
      setSelectedTileCode('');
    }
    setStatus('Removed saved paint tile selection.');
  };

  const removeSelectedPaintTile = () => {
    if (!selectedPaintTile) {
      setError('Select a saved paint tile to remove.');
      return;
    }

    removePaintTile(selectedPaintTile.id);
  };

  const clearSavedPaintTiles = async () => {
    setSavedPaintTiles([]);
    setSelectedPaintTileId('');
    setSelectedTileCode('');
    await persistSavedPaintTiles([]);
    setStatus('Cleared saved paint tiles in memory and IndexedDB.');
  };

  const setNpcAnimationSetsDraft = (nextSets: DirectionalAnimationSets) => {
    const sanitized = sanitizeDirectionalAnimationSets(nextSets);
    const safeSets =
      Object.keys(sanitized).length > 0
        ? sanitized
        : sanitizeDirectionalAnimationSets(buildDirectionalAnimationSetsFromLegacyFrames(npcFacingFrames, npcWalkFrames));
    setNpcAnimationSetsInput(stringifyDirectionalAnimationSetsForEditor(safeSets));
  };

  const loadTilesetSupabaseAssets = async () => {
    const bucket = tilesetBucketInput.trim() || DEFAULT_TILESET_SUPABASE_BUCKET;
    const prefix = tilesetPrefixInput.trim();
    const params = new URLSearchParams();
    params.set('bucket', bucket);
    if (prefix) {
      params.set('prefix', prefix);
    }
    setIsLoadingTilesetSupabaseAssets(true);
    try {
      const result = await apiFetchJson<LoadSupabaseSpriteSheetsResponse>(
        `/api/admin/spritesheets/list?${params.toString()}`,
      );
      if (!result.ok || !result.data?.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load tilesets from Supabase.');
      }
      const loadedAssets = Array.isArray(result.data.spritesheets) ? result.data.spritesheets : [];
      setTilesetSupabaseAssets(loadedAssets);
      setStatus(`Loaded ${loadedAssets.length} tileset image(s) from bucket "${bucket}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load tilesets from Supabase.';
      setError(message);
    } finally {
      setIsLoadingTilesetSupabaseAssets(false);
    }
  };

  const loadNpcSupabaseSpriteSheets = async () => {
    const bucket = npcSpriteBucketInput.trim() || DEFAULT_NPC_SUPABASE_BUCKET;
    const prefix = npcSpritePrefixInput.trim();
    const params = new URLSearchParams();
    params.set('bucket', bucket);
    if (prefix) {
      params.set('prefix', prefix);
    }
    setIsLoadingNpcSupabaseSpriteSheets(true);
    try {
      const result = await apiFetchJson<LoadSupabaseSpriteSheetsResponse>(
        `/api/admin/spritesheets/list?${params.toString()}`,
      );
      if (!result.ok || !result.data?.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load NPC spritesheets from Supabase.');
      }
      const loadedSheets = Array.isArray(result.data.spritesheets) ? result.data.spritesheets : [];
      setNpcSupabaseSpriteSheets(loadedSheets);
      setStatus(`Loaded ${loadedSheets.length} spritesheet(s) from bucket "${bucket}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load NPC spritesheets from Supabase.';
      setError(message);
    } finally {
      setIsLoadingNpcSupabaseSpriteSheets(false);
    }
  };

  useEffect(() => {
    void loadTilesetSupabaseAssets();
    void loadNpcSupabaseSpriteSheets();
    // Run once on mount with default buckets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNpcSpriteFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    event.target.value = '';
    try {
      const dataUrl = await fileToDataUrl(file);
      setNpcSpriteUrl(dataUrl);
      setStatus(`Loaded and applied NPC sheet file ${file.name}`);
    } catch {
      setError(`Unable to read NPC sheet file ${file.name}.`);
    }
  };

  const addNpcAnimation = () => {
    const animationName = newNpcAnimationNameInput.trim();
    if (!animationName) {
      setError('Animation name is required.');
      return;
    }
    if (parsedNpcAnimationSets[animationName]) {
      setError(`Animation "${animationName}" already exists.`);
      return;
    }

    setNpcAnimationSetsDraft({
      ...parsedNpcAnimationSets,
      [animationName]: {
        up: [],
        down: [],
        left: [],
        right: [],
      },
    });
    setSelectedNpcAnimationName(animationName);
    setNewNpcAnimationNameInput('');
    setStatus(`Added animation "${animationName}".`);
  };

  const renameSelectedNpcAnimation = () => {
    if (!selectedNpcAnimationName) {
      setError('Select an animation to rename.');
      return;
    }
    const nextName = renameNpcAnimationNameInput.trim();
    if (!nextName) {
      setError('New animation name is required.');
      return;
    }
    if (nextName !== selectedNpcAnimationName && parsedNpcAnimationSets[nextName]) {
      setError(`Animation "${nextName}" already exists.`);
      return;
    }

    const currentSet = parsedNpcAnimationSets[selectedNpcAnimationName];
    if (!currentSet) {
      setError('Selected animation no longer exists.');
      return;
    }
    const nextSets: DirectionalAnimationSets = {};
    for (const [name, set] of Object.entries(parsedNpcAnimationSets)) {
      if (name === selectedNpcAnimationName) {
        nextSets[nextName] = set;
      } else {
        nextSets[name] = set;
      }
    }
    setNpcAnimationSetsDraft(nextSets);
    setSelectedNpcAnimationName(nextName);
    if (npcDefaultIdleAnimationInput.trim() === selectedNpcAnimationName) {
      setNpcDefaultIdleAnimationInput(nextName);
    }
    if (npcDefaultMoveAnimationInput.trim() === selectedNpcAnimationName) {
      setNpcDefaultMoveAnimationInput(nextName);
    }
    setStatus(`Renamed animation "${selectedNpcAnimationName}" to "${nextName}".`);
  };

  const deleteSelectedNpcAnimation = () => {
    if (!selectedNpcAnimationName) {
      setError('Select an animation to delete.');
      return;
    }
    const names = Object.keys(parsedNpcAnimationSets);
    if (names.length <= 1) {
      setError('At least one animation must remain.');
      return;
    }

    const nextSets: DirectionalAnimationSets = {};
    for (const [name, set] of Object.entries(parsedNpcAnimationSets)) {
      if (name === selectedNpcAnimationName) {
        continue;
      }
      nextSets[name] = set;
    }
    const nextNames = Object.keys(nextSets);
    const fallbackName = nextNames.includes('walk') ? 'walk' : nextNames[0];
    setNpcAnimationSetsDraft(nextSets);
    setSelectedNpcAnimationName(fallbackName ?? '');
    if (npcDefaultIdleAnimationInput.trim() === selectedNpcAnimationName) {
      setNpcDefaultIdleAnimationInput(fallbackName ?? 'idle');
    }
    if (npcDefaultMoveAnimationInput.trim() === selectedNpcAnimationName) {
      setNpcDefaultMoveAnimationInput(fallbackName ?? 'walk');
    }
    setStatus(`Deleted animation "${selectedNpcAnimationName}".`);
  };

  const addSelectedNpcFrameToAnimation = () => {
    if (!selectedNpcAtlasRect || npcSpriteMeta.columns <= 0) {
      setError('Select a rectangle on the NPC sheet first.');
      return;
    }
    if (!selectedNpcAnimationName) {
      setError('Select an animation before adding frames.');
      return;
    }

    const frameIndex = selectedNpcAtlasRect.minRow * npcSpriteMeta.columns + selectedNpcAtlasRect.minCol;
    setNpcFrameCellsWideInput(String(selectedNpcAtlasRect.width));
    setNpcFrameCellsTallInput(String(selectedNpcAtlasRect.height));
    const currentSet = parsedNpcAnimationSets[selectedNpcAnimationName] ?? {};
    const currentFrames = currentSet[npcAssignDirection] ? [...currentSet[npcAssignDirection]!] : [];
    if (!currentFrames.includes(frameIndex)) {
      currentFrames.push(frameIndex);
    }
    setNpcAnimationSetsDraft({
      ...parsedNpcAnimationSets,
      [selectedNpcAnimationName]: {
        ...currentSet,
        [npcAssignDirection]: currentFrames,
      },
    });
    setStatus(
      `Added frame ${frameIndex} to "${selectedNpcAnimationName}" ${npcAssignDirection} (${selectedNpcAtlasRect.width}x${selectedNpcAtlasRect.height} cells).`,
    );
  };

  const removeNpcFrameFromAnimation = (frameIndex: number) => {
    if (!selectedNpcAnimationName) {
      return;
    }
    const currentSet = parsedNpcAnimationSets[selectedNpcAnimationName] ?? {};
    const currentFrames = currentSet[npcAssignDirection] ? [...currentSet[npcAssignDirection]!] : [];
    const nextFrames = currentFrames.filter((entry) => entry !== frameIndex);
    setNpcAnimationSetsDraft({
      ...parsedNpcAnimationSets,
      [selectedNpcAnimationName]: {
        ...currentSet,
        [npcAssignDirection]: nextFrames,
      },
    });
    setStatus(`Removed frame ${frameIndex} from "${selectedNpcAnimationName}" ${npcAssignDirection}.`);
  };

  const clearNpcDirectionFrames = () => {
    if (!selectedNpcAnimationName) {
      return;
    }
    const currentSet = parsedNpcAnimationSets[selectedNpcAnimationName] ?? {};
    setNpcAnimationSetsDraft({
      ...parsedNpcAnimationSets,
      [selectedNpcAnimationName]: {
        ...currentSet,
        [npcAssignDirection]: [],
      },
    });
    setStatus(`Cleared frames for "${selectedNpcAnimationName}" ${npcAssignDirection}.`);
  };

  const saveNpcSprite = () => {
    const label = npcSpriteLabelInput.trim();
    const atlasCellWidth = parseInteger(npcFrameWidthInput);
    const atlasCellHeight = parseInteger(npcFrameHeightInput);
    const frameCellsWide = parseInteger(npcFrameCellsWideInput);
    const frameCellsTall = parseInteger(npcFrameCellsTallInput);
    const renderWidthTiles = parseInteger(npcRenderWidthTilesInput);
    const renderHeightTiles = parseInteger(npcRenderHeightTilesInput);
    if (!label) {
      setError('Sprite label is required.');
      return;
    }
    if (!npcSpriteUrl.trim()) {
      setError('NPC sprite URL is required.');
      return;
    }
    if (
      !atlasCellWidth ||
      !atlasCellHeight ||
      !frameCellsWide ||
      !frameCellsTall ||
      !renderWidthTiles ||
      !renderHeightTiles
    ) {
      setError('NPC atlas cell size, frame span, and render tile size are required.');
      return;
    }
    const frameWidth = atlasCellWidth * frameCellsWide;
    const frameHeight = atlasCellHeight * frameCellsTall;
    const animationSets = sanitizeDirectionalAnimationSets(parsedNpcAnimationSets);
    const defaultIdleAnimation = npcDefaultIdleAnimationInput.trim() || 'idle';
    const defaultMoveAnimation = npcDefaultMoveAnimationInput.trim() || 'walk';
    if (!animationSets[defaultIdleAnimation]) {
      setError(`Default idle animation "${defaultIdleAnimation}" is not defined in animation sets.`);
      return;
    }
    if (!animationSets[defaultMoveAnimation]) {
      setError(`Default move animation "${defaultMoveAnimation}" is not defined in animation sets.`);
      return;
    }
    const legacyFrames = deriveLegacyFramesFromAnimationSets(
      animationSets,
      defaultIdleAnimation,
      defaultMoveAnimation,
    );

    const spriteEntry: NpcSpriteLibraryEntry = {
      id:
        selectedNpcSpriteId && npcSpriteLibrary.some((entry) => entry.id === selectedNpcSpriteId)
          ? selectedNpcSpriteId
          : makeNpcSpriteId(label, npcSpriteLibrary),
      label,
      sprite: {
        url: withCacheBusterTag(npcSpriteUrl.trim()),
        frameWidth,
        frameHeight,
        atlasCellWidth,
        atlasCellHeight,
        frameCellsWide,
        frameCellsTall,
        renderWidthTiles,
        renderHeightTiles,
        animationSets,
        defaultIdleAnimation,
        defaultMoveAnimation,
        facingFrames: legacyFrames.facingFrames,
        walkFrames: legacyFrames.walkFrames,
      },
    };

    const existingIndex = npcSpriteLibrary.findIndex((entry) => entry.id === spriteEntry.id);
    const next =
      existingIndex >= 0
        ? npcSpriteLibrary.map((entry, index) => (index === existingIndex ? spriteEntry : entry))
        : [...npcSpriteLibrary, spriteEntry];
    setNpcSpriteLibrary(next);
    setSelectedNpcSpriteId(spriteEntry.id);
    void persistNpcSpriteLibrary(next);
    setStatus(
      existingIndex >= 0
        ? `Updated NPC sprite "${spriteEntry.label}" without reloading atlas.`
        : `Saved NPC sprite "${spriteEntry.label}".`,
    );
  };

  const removeNpcSprite = (spriteId: string) => {
    const next = npcSpriteLibrary.filter((sprite) => sprite.id !== spriteId);
    setNpcSpriteLibrary(next);
    if (selectedNpcSpriteId === spriteId) {
      setSelectedNpcSpriteId(next[0]?.id ?? '');
    }
    void persistNpcSpriteLibrary(next);
    setStatus('Removed NPC sprite.');
  };

  const buildNpcMovementFromEditorInputs = (): NpcMovementDefinition | null => {
    const pattern = parseDirectionPattern(npcMovementPatternInput);
    if ((npcMovementTypeInput === 'path' || npcMovementTypeInput === 'static-turning') && pattern.length === 0) {
      setError('Path and static-turning movement require at least one direction in pattern.');
      return null;
    }

    if (npcMovementTypeInput === 'static') {
      return { type: 'static' };
    }

    return {
      type: npcMovementTypeInput,
      pattern: npcMovementTypeInput === 'path' || npcMovementTypeInput === 'static-turning' ? pattern : undefined,
      stepIntervalMs: parseInteger(npcStepIntervalInput) ?? 850,
      pathMode: npcMovementTypeInput === 'path' ? npcMovementPathModeInput : undefined,
      leashRadius:
        npcMovementTypeInput === 'wander'
          ? (() => {
              const parsed = parseInteger(npcWanderLeashRadiusInput);
              return parsed && parsed > 0 ? clampInt(parsed, 1, 64) : undefined;
            })()
          : undefined,
    };
  };

  const saveNpcTemplate = () => {
    const label = npcCharacterLabelInput.trim();
    const npcName = npcCharacterNameInput.trim();
    if (!label || !npcName) {
      setError('NPC character label and NPC name are required.');
      return;
    }
    if (!selectedNpcSpriteId) {
      setError('Select an NPC sprite to attach to this character.');
      return;
    }
    const selectedSpriteEntry = npcSpriteLibrary.find((entry) => entry.id === selectedNpcSpriteId);
    if (!selectedSpriteEntry) {
      setError('Selected NPC sprite does not exist in the sprite library.');
      return;
    }

    const dialogueLines = npcDialogueLinesInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const movement = buildNpcMovementFromEditorInputs();
    if (!movement) {
      return;
    }
    const storyStatesResult = parseNpcStoryStatesInput(npcStoryStatesInput);
    if (!storyStatesResult.ok) {
      setError(storyStatesResult.error);
      return;
    }
    const movementGuardsResult = parseNpcMovementGuardsInput(npcMovementGuardsInput);
    if (!movementGuardsResult.ok) {
      setError(movementGuardsResult.error);
      return;
    }
    const interactionScriptResult = parseNpcInteractionScriptInput(npcInteractionScriptInput);
    if (!interactionScriptResult.ok) {
      setError(interactionScriptResult.error);
      return;
    }

    const idleAnimation = npcCharacterIdleAnimationInput.trim() || undefined;
    const moveAnimation = npcCharacterMoveAnimationInput.trim() || undefined;
    const availableAnimations = sanitizeDirectionalAnimationSets(
      selectedSpriteEntry.sprite.animationSets && Object.keys(selectedSpriteEntry.sprite.animationSets).length > 0
        ? selectedSpriteEntry.sprite.animationSets
        : buildDirectionalAnimationSetsFromLegacyFrames(
            selectedSpriteEntry.sprite.facingFrames,
            {
              up: [...(selectedSpriteEntry.sprite.walkFrames?.up ?? [])],
              down: [...(selectedSpriteEntry.sprite.walkFrames?.down ?? [])],
              left: [...(selectedSpriteEntry.sprite.walkFrames?.left ?? [])],
              right: [...(selectedSpriteEntry.sprite.walkFrames?.right ?? [])],
            },
          ),
    );
    if (idleAnimation && !availableAnimations[idleAnimation]) {
      setError(`Idle animation "${idleAnimation}" does not exist on the selected sprite.`);
      return;
    }
    if (moveAnimation && !availableAnimations[moveAnimation]) {
      setError(`Move animation "${moveAnimation}" does not exist on the selected sprite.`);
      return;
    }

    const isUpdatingExisting =
      selectedNpcCharacterId && npcCharacterLibrary.some((entry) => entry.id === selectedNpcCharacterId);
    const resolvedId = isUpdatingExisting ? selectedNpcCharacterId : makeNpcCharacterId(label, npcCharacterLibrary);

    const characterTemplate: NpcCharacterTemplateEntry = {
      id: resolvedId,
      label,
      npcName,
      color: npcCharacterColorInput || '#9b73b8',
      facing: npcFacingInput,
      dialogueId: sanitizeIdentifier(npcDialogueIdInput, 'custom_npc_dialogue'),
      dialogueSpeaker: npcDialogueSpeakerInput.trim() || undefined,
      dialogueLines: dialogueLines.length > 0 ? dialogueLines : undefined,
      dialogueSetFlag: npcDialogueSetFlagInput.trim() || undefined,
      firstInteractionSetFlag: npcFirstInteractionSetFlagInput.trim() || undefined,
      firstInteractBattle: npcFirstInteractBattleInput,
      healer: npcHealerInput,
      battleTeamIds: parseStringList(npcBattleTeamsInput),
      storyStates:
        storyStatesResult.states.length > 0 ? compactCharacterPlacementOrder(storyStatesResult.states) : undefined,
      movementGuards:
        movementGuardsResult.guards.length > 0 ? movementGuardsResult.guards : undefined,
      interactionScript:
        interactionScriptResult.actions.length > 0 ? interactionScriptResult.actions : undefined,
      movement,
      spriteId: selectedNpcSpriteId,
      cacheVersion: Date.now(),
      idleAnimation,
      moveAnimation,
    };

    const next = isUpdatingExisting
      ? normalizeCoreStoryNpcCharacters(
          npcCharacterLibrary.map((entry) => (entry.id === resolvedId ? characterTemplate : entry)),
        )
      : normalizeCoreStoryNpcCharacters([...npcCharacterLibrary, characterTemplate]);
    setNpcCharacterLibrary(next);
    setSelectedNpcCharacterId(resolvedId);
    void persistNpcCharacterLibrary(next);
    setStatus(`Saved NPC character "${characterTemplate.label}".`);
  };

  const addNewBlankNpcCharacter = () => {
    const blank: NpcCharacterTemplateEntry = {
      id: makeNpcCharacterId('', npcCharacterLibrary),
      label: '',
      npcName: '',
      color: '#9b73b8',
      dialogueId: '',
      storyStates: [
        {
          id: 'instance-1',
          mapId: '',
          position: { x: 0, y: 0 },
        },
      ],
    };
    const next = normalizeCoreStoryNpcCharacters([...npcCharacterLibrary, blank]);
    setNpcCharacterLibrary(next);
    setSelectedNpcCharacterId(blank.id);
    setSelectedCharacterInstanceKey(`${blank.id}:0`);
    loadNpcCharacterTemplateIntoEditor(blank, { keepSelectedInstance: true, statusMessage: 'Created new blank character.' });
    void persistNpcCharacterLibrary(next);
    setStatus('Created new blank character.');
  };

  const removeNpcTemplate = (templateId: string) => {
    const next = normalizeCoreStoryNpcCharacters(
      npcCharacterLibrary.filter((template) => template.id !== templateId),
    );
    setNpcCharacterLibrary(next);
    if (selectedNpcCharacterId === templateId) {
      setSelectedNpcCharacterId(next[0]?.id ?? '');
    }
    if (selectedCharacterInstanceKey.startsWith(`${templateId}:`)) {
      setSelectedCharacterInstanceKey('');
    }
    void persistNpcCharacterLibrary(next);
    setStatus('Removed NPC character.');
  };

  const updateCharacterTemplateById = (
    characterId: string,
    updater: (template: NpcCharacterTemplateEntry) => NpcCharacterTemplateEntry,
  ) => {
    const next = normalizeCoreStoryNpcCharacters(
      npcCharacterLibrary.map((template) => (template.id === characterId ? updater(template) : template)),
    );
    const updatedTemplate = next.find((template) => template.id === characterId);
    setNpcCharacterLibrary(next);
    if (updatedTemplate) {
      setNpcStoryStatesInput(JSON.stringify(updatedTemplate.storyStates ?? [], null, 2));
      setNpcMovementGuardsInput(JSON.stringify(updatedTemplate.movementGuards ?? [], null, 2));
    }
    void persistNpcCharacterLibrary(next);
  };

  const loadNpcCharacterTemplateIntoEditor = (
    template: NpcCharacterTemplateEntry,
    options?: {
      keepSelectedInstance?: boolean;
      statusMessage?: string;
    },
  ) => {
    setSelectedNpcCharacterId(template.id);
    setSelectedMapNpcId('');
    if (!options?.keepSelectedInstance) {
      setSelectedCharacterInstanceKey('');
    }
    setNpcCharacterLabelInput(template.label);
    setNpcCharacterNameInput(template.npcName);
    setNpcCharacterColorInput(template.color);
    setNpcFacingInput(template.facing ?? 'down');
    setNpcDialogueIdInput(template.dialogueId);
    setNpcDialogueSpeakerInput(template.dialogueSpeaker ?? '');
    setNpcDialogueLinesInput((template.dialogueLines ?? []).join('\n'));
    setNpcDialogueSetFlagInput(template.dialogueSetFlag ?? '');
    setNpcFirstInteractionSetFlagInput(template.firstInteractionSetFlag ?? '');
    setNpcFirstInteractBattleInput(Boolean(template.firstInteractBattle));
    setNpcHealerInput(Boolean(template.healer));
    setNpcMovementTypeInput(toEditorNpcMovementType(template.movement?.type));
    setNpcMovementPatternInput((template.movement?.pattern ?? []).join(', '));
    setNpcStepIntervalInput(String(template.movement?.stepIntervalMs ?? 850));
    setNpcMovementPathModeInput(template.movement?.pathMode === 'pingpong' ? 'pingpong' : 'loop');
    setNpcWanderLeashRadiusInput(
      Number.isFinite(template.movement?.leashRadius)
        ? String(Math.max(1, Math.floor(template.movement?.leashRadius ?? 0)))
        : '',
    );
    setNpcBattleTeamsInput((template.battleTeamIds ?? []).join(', '));
    setNpcStoryStatesInput(JSON.stringify(template.storyStates ?? [], null, 2));
    setNpcMovementGuardsInput(JSON.stringify(template.movementGuards ?? [], null, 2));
    setNpcInteractionScriptInput(JSON.stringify(template.interactionScript ?? [], null, 2));
    setNpcCharacterIdleAnimationInput(template.idleAnimation ?? '');
    setNpcCharacterMoveAnimationInput(template.moveAnimation ?? '');
    setSelectedNpcSpriteId(template.spriteId ?? '');
    if (options?.statusMessage) {
      setStatus(options.statusMessage);
    }
  };

  const addCharacterPlacementInstance = (
    characterId: string,
    mapId: string,
    position: Vector2,
  ) => {
    const character = npcCharacterLibrary.find((entry) => entry.id === characterId);
    if (!character) {
      setError('Select an NPC character before adding an instance.');
      return;
    }
    if (!mapId.trim()) {
      setError('Map ID is required for a character instance.');
      return;
    }
    const existingCount = getCharacterPlacementInstances(character).length;
    const nextInstanceIndex = existingCount + 1;
    updateCharacterTemplateById(character.id, (template) => {
      const placements = getCharacterPlacementInstances(template);
      const nextPlacements = compactCharacterPlacementOrder([
        ...placements,
        {
          id: `instance-${placements.length + 1}`,
          mapId: mapId.trim(),
          position: { x: Math.max(0, Math.floor(position.x)), y: Math.max(0, Math.floor(position.y)) },
          facing: template.facing,
          dialogueId: template.dialogueId,
          dialogueSpeaker: template.dialogueSpeaker,
          dialogueLines: template.dialogueLines ? [...template.dialogueLines] : undefined,
          dialogueSetFlag: template.dialogueSetFlag,
          firstInteractionSetFlag: template.firstInteractionSetFlag,
          firstInteractBattle: template.firstInteractBattle,
          healer: template.healer,
          battleTeamIds: template.battleTeamIds ? [...template.battleTeamIds] : undefined,
          movement: template.movement
            ? {
                ...template.movement,
                pattern: template.movement.pattern ? [...template.movement.pattern] : undefined,
              }
            : undefined,
          movementGuards: template.movementGuards
            ? template.movementGuards.map((guard) => ({
                ...guard,
                dialogueLines: guard.dialogueLines ? [...guard.dialogueLines] : undefined,
              }))
            : undefined,
          idleAnimation: template.idleAnimation,
          moveAnimation: template.moveAnimation,
          interactionScript: template.interactionScript ? template.interactionScript.map((entry) => ({ ...entry })) : undefined,
        },
      ]);
      return {
        ...template,
        storyStates: nextPlacements,
      };
    });
    setSelectedNpcCharacterId(character.id);
    setSelectedCharacterInstanceKey(`${character.id}:${nextInstanceIndex - 1}`);
    setStatus(`Added ${character.npcName} instance #${nextInstanceIndex}.`);
  };

  const appendCharacterPlacementInstance = (x: number, y: number) => {
    if (!selectedNpcCharacter) {
      setError('Select an NPC character before painting NPC placements.');
      return;
    }
    if (!editableMap.id) {
      setError('Load an existing map before painting NPC placements.');
      return;
    }
    addCharacterPlacementInstance(selectedNpcCharacter.id, editableMap.id, { x, y });
  };

  const removeCharacterPlacementInstance = (characterId: string, placementIndex: number) => {
    updateCharacterTemplateById(characterId, (template) => {
      const placements = getCharacterPlacementInstances(template).filter((_, index) => index !== placementIndex);
      return {
        ...template,
        storyStates: compactCharacterPlacementOrder(placements),
      };
    });
    if (selectedCharacterInstanceKey.startsWith(`${characterId}:`)) {
      const selectedIndex = Number.parseInt(selectedCharacterInstanceKey.split(':')[1] ?? '', 10);
      if (Number.isFinite(selectedIndex)) {
        if (selectedIndex === placementIndex) {
          setSelectedCharacterInstanceKey('');
        } else if (selectedIndex > placementIndex) {
          setSelectedCharacterInstanceKey(`${characterId}:${selectedIndex - 1}`);
        }
      }
    }
  };

  const moveCharacterPlacementInstance = (characterId: string, placementIndex: number, direction: 'up' | 'down') => {
    updateCharacterTemplateById(characterId, (template) => {
      const placements = [...getCharacterPlacementInstances(template)];
      const nextIndex = direction === 'up' ? placementIndex - 1 : placementIndex + 1;
      if (placementIndex < 0 || placementIndex >= placements.length || nextIndex < 0 || nextIndex >= placements.length) {
        return template;
      }
      const current = placements[placementIndex];
      placements[placementIndex] = placements[nextIndex];
      placements[nextIndex] = current;
      return {
        ...template,
        storyStates: compactCharacterPlacementOrder(placements),
      };
    });
    const nextIndex = direction === 'up' ? placementIndex - 1 : placementIndex + 1;
    setSelectedCharacterInstanceKey(`${characterId}:${Math.max(0, nextIndex)}`);
  };

  const loadCharacterPlacementIntoEditor = (characterId: string, placementIndex: number) => {
    const character = npcCharacterLibrary.find((entry) => entry.id === characterId);
    if (!character) {
      return;
    }
    const placements = getCharacterPlacementInstances(character);
    const placement = placements[placementIndex];
    if (!placement) {
      return;
    }
    loadNpcCharacterTemplateIntoEditor(character, { keepSelectedInstance: true });
    setSelectedCharacterInstanceKey(`${character.id}:${placementIndex}`);
    setNpcFacingInput(placement.facing ?? character.facing ?? 'down');
    setNpcDialogueIdInput(placement.dialogueId ?? character.dialogueId ?? 'custom_npc_dialogue');
    setNpcDialogueSpeakerInput(placement.dialogueSpeaker ?? character.dialogueSpeaker ?? '');
    setNpcDialogueLinesInput((placement.dialogueLines ?? character.dialogueLines ?? []).join('\n'));
    setNpcDialogueSetFlagInput(placement.dialogueSetFlag ?? character.dialogueSetFlag ?? '');
    setNpcFirstInteractionSetFlagInput(
      placement.firstInteractionSetFlag ?? character.firstInteractionSetFlag ?? '',
    );
    setNpcFirstInteractBattleInput(
      typeof placement.firstInteractBattle === 'boolean'
        ? placement.firstInteractBattle
        : Boolean(character.firstInteractBattle),
    );
    setNpcHealerInput(
      typeof placement.healer === 'boolean' ? placement.healer : Boolean(character.healer),
    );
    setNpcBattleTeamsInput((placement.battleTeamIds ?? character.battleTeamIds ?? []).join(', '));
    setNpcMovementTypeInput(toEditorNpcMovementType(placement.movement?.type ?? character.movement?.type));
    setNpcMovementPatternInput((placement.movement?.pattern ?? character.movement?.pattern ?? []).join(', '));
    setNpcStepIntervalInput(String(placement.movement?.stepIntervalMs ?? character.movement?.stepIntervalMs ?? 850));
    setNpcMovementPathModeInput(
      placement.movement?.pathMode === 'pingpong' || character.movement?.pathMode === 'pingpong' ? 'pingpong' : 'loop',
    );
    setNpcWanderLeashRadiusInput(
      Number.isFinite(placement.movement?.leashRadius)
        ? String(Math.max(1, Math.floor(placement.movement?.leashRadius ?? 0)))
        : Number.isFinite(character.movement?.leashRadius)
          ? String(Math.max(1, Math.floor(character.movement?.leashRadius ?? 0)))
          : '',
    );
    setNpcInteractionScriptInput(
      JSON.stringify(placement.interactionScript ?? character.interactionScript ?? [], null, 2),
    );
    setNpcMovementGuardsInput(
      JSON.stringify(placement.movementGuards ?? character.movementGuards ?? [], null, 2),
    );
    setNpcStoryStatesInput(JSON.stringify(placements, null, 2));
    setNpcCharacterIdleAnimationInput(placement.idleAnimation ?? character.idleAnimation ?? '');
    setNpcCharacterMoveAnimationInput(placement.moveAnimation ?? character.moveAnimation ?? '');
    setStatus(`Loaded ${character.npcName} instance #${placementIndex + 1} for editing.`);
  };

  const updateCharacterPlacementInstance = (
    characterId: string,
    placementIndex: number,
    updater: (placement: NpcStoryStateDefinition) => NpcStoryStateDefinition,
  ) => {
    updateCharacterTemplateById(characterId, (template) => {
      const placements = [...getCharacterPlacementInstances(template)];
      if (placementIndex < 0 || placementIndex >= placements.length) {
        return template;
      }
      placements[placementIndex] = updater(placements[placementIndex]);
      return {
        ...template,
        storyStates: compactCharacterPlacementOrder(placements),
      };
    });
  };

  const buildPlacementMovement = (
    currentMovement: NpcMovementDefinition | undefined,
    movementType: EditorNpcMovementType,
    overrides?: {
      pattern?: Direction[];
      stepIntervalMs?: number;
      pathMode?: 'loop' | 'pingpong';
      leashRadius?: number;
    },
  ): NpcMovementDefinition => {
    if (movementType === 'static') {
      return { type: 'static' };
    }

    const rawStepInterval =
      typeof overrides?.stepIntervalMs === 'number'
        ? overrides.stepIntervalMs
        : typeof currentMovement?.stepIntervalMs === 'number'
          ? currentMovement.stepIntervalMs
          : 850;
    const stepIntervalMs = Number.isFinite(rawStepInterval) ? Math.floor(rawStepInterval) : 850;
    const nextPattern = overrides?.pattern ?? currentMovement?.pattern ?? [];
    const nextPathMode = overrides?.pathMode ?? currentMovement?.pathMode;
    const nextLeashRadius =
      typeof overrides?.leashRadius === 'number'
        ? overrides.leashRadius
        : typeof currentMovement?.leashRadius === 'number'
          ? currentMovement.leashRadius
          : undefined;

    return {
      type: movementType,
      pattern:
        movementType === 'path' || movementType === 'static-turning'
          ? (nextPattern.length > 0 ? [...nextPattern] : ['down'])
          : undefined,
      stepIntervalMs,
      pathMode: movementType === 'path' ? (nextPathMode === 'pingpong' ? 'pingpong' : 'loop') : undefined,
      leashRadius:
        movementType === 'wander' && typeof nextLeashRadius === 'number'
          ? clampInt(Math.max(1, Math.floor(nextLeashRadius)), 1, 64)
          : undefined,
    };
  };

  const editMapNpc = (npc: NpcDefinition) => {
    setSelectedMapNpcId(npc.id);
    setSelectedCharacterInstanceKey('');
    setSelectedNpcCharacterId('');
    setNpcCharacterLabelInput(npc.id);
    setNpcCharacterNameInput(npc.name);
    setNpcCharacterColorInput(npc.color || '#9b73b8');
    setNpcFacingInput(npc.facing ?? 'down');
    setNpcDialogueIdInput(npc.dialogueId || 'custom_npc_dialogue');
    setNpcDialogueSpeakerInput(npc.dialogueSpeaker ?? '');
    setNpcDialogueLinesInput((npc.dialogueLines ?? []).join('\n'));
    setNpcDialogueSetFlagInput(npc.dialogueSetFlag ?? '');
    setNpcFirstInteractionSetFlagInput(npc.firstInteractionSetFlag ?? '');
    setNpcFirstInteractBattleInput(Boolean(npc.firstInteractBattle));
    setNpcHealerInput(Boolean(npc.healer));
    setNpcBattleTeamsInput((npc.battleTeamIds ?? []).join(', '));
    setNpcStoryStatesInput(JSON.stringify(npc.storyStates ?? [], null, 2));
    setNpcMovementGuardsInput(JSON.stringify(npc.movementGuards ?? [], null, 2));
    setNpcInteractionScriptInput(JSON.stringify(npc.interactionScript ?? [], null, 2));
    setNpcMovementTypeInput(toEditorNpcMovementType(npc.movement?.type));
    setNpcMovementPatternInput((npc.movement?.pattern ?? []).join(', '));
    setNpcStepIntervalInput(String(npc.movement?.stepIntervalMs ?? 850));
    setNpcMovementPathModeInput(npc.movement?.pathMode === 'pingpong' ? 'pingpong' : 'loop');
    setNpcWanderLeashRadiusInput(
      Number.isFinite(npc.movement?.leashRadius)
        ? String(Math.max(1, Math.floor(npc.movement?.leashRadius ?? 0)))
        : '',
    );
    setNpcCharacterIdleAnimationInput(npc.idleAnimation ?? '');
    setNpcCharacterMoveAnimationInput(npc.moveAnimation ?? '');

    const matchedSprite = npc.sprite
      ? npcSpriteLibrary.find(
          (entry) => normalizeAssetUrlForCompare(entry.sprite.url) === normalizeAssetUrlForCompare(npc.sprite?.url ?? ''),
        ) ?? null
      : null;
    setSelectedNpcSpriteId(matchedSprite?.id ?? '');
    setStatus(`Loaded map NPC "${npc.name}" for editing.`);
  };

  const removeMapNpcById = (npcId: string) => {
    setEditableMap((current) => ({
      ...cloneEditableMap(current),
      npcs: current.npcs.filter((entry) => entry.id !== npcId),
    }));
    if (selectedMapNpcId === npcId) {
      setSelectedMapNpcId('');
    }
    setStatus(`Removed NPC ${npcId} from map.`);
  };

  const applyNpcEditorToSelectedMapNpc = () => {
    const npcName = npcCharacterNameInput.trim();
    if (!npcName) {
      setError('NPC name is required.');
      return;
    }
    const movement = buildNpcMovementFromEditorInputs();
    if (!movement) {
      return;
    }
    const interactionScriptResult = parseNpcInteractionScriptInput(npcInteractionScriptInput);
    if (!interactionScriptResult.ok) {
      setError(interactionScriptResult.error);
      return;
    }
    const movementGuardsResult = parseNpcMovementGuardsInput(npcMovementGuardsInput);
    if (!movementGuardsResult.ok) {
      setError(movementGuardsResult.error);
      return;
    }

    const idleAnimation = npcCharacterIdleAnimationInput.trim() || undefined;
    const moveAnimation = npcCharacterMoveAnimationInput.trim() || undefined;

    const selectedSpriteEntry = selectedNpcSpriteId
      ? npcSpriteLibrary.find((entry) => entry.id === selectedNpcSpriteId) ?? null
      : null;
    const nextSprite = selectedSpriteEntry
      ? {
          ...selectedSpriteEntry.sprite,
          url: withCacheBusterTag(selectedSpriteEntry.sprite.url),
          facingFrames: { ...selectedSpriteEntry.sprite.facingFrames },
          walkFrames: selectedSpriteEntry.sprite.walkFrames
            ? {
                up: selectedSpriteEntry.sprite.walkFrames.up ? [...selectedSpriteEntry.sprite.walkFrames.up] : undefined,
                down: selectedSpriteEntry.sprite.walkFrames.down ? [...selectedSpriteEntry.sprite.walkFrames.down] : undefined,
                left: selectedSpriteEntry.sprite.walkFrames.left ? [...selectedSpriteEntry.sprite.walkFrames.left] : undefined,
                right: selectedSpriteEntry.sprite.walkFrames.right ? [...selectedSpriteEntry.sprite.walkFrames.right] : undefined,
              }
            : undefined,
          animationSets: selectedSpriteEntry.sprite.animationSets
            ? Object.fromEntries(
                Object.entries(selectedSpriteEntry.sprite.animationSets).map(([name, directions]) => [
                  name,
                  {
                    up: directions?.up ? [...directions.up] : undefined,
                    down: directions?.down ? [...directions.down] : undefined,
                    left: directions?.left ? [...directions.left] : undefined,
                    right: directions?.right ? [...directions.right] : undefined,
                  },
                ]),
              )
            : undefined,
        }
      : selectedMapNpc?.sprite;

    if (selectedCharacterInstance) {
      const { character, index } = selectedCharacterInstance;
      updateCharacterTemplateById(character.id, (template) => {
        const placements = [...getCharacterPlacementInstances(template)];
        const currentPlacement = placements[index];
        if (!currentPlacement) {
          return template;
        }
        placements[index] = {
          ...currentPlacement,
          facing: npcFacingInput,
          dialogueId: sanitizeIdentifier(npcDialogueIdInput, 'custom_npc_dialogue'),
          dialogueSpeaker: npcDialogueSpeakerInput.trim() || undefined,
          dialogueLines: npcDialogueLinesInput
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
          dialogueSetFlag: npcDialogueSetFlagInput.trim() || undefined,
          firstInteractionSetFlag: npcFirstInteractionSetFlagInput.trim() || undefined,
          firstInteractBattle: npcFirstInteractBattleInput,
          healer: npcHealerInput,
          battleTeamIds: parseStringList(npcBattleTeamsInput),
          movement,
          movementGuards:
            movementGuardsResult.guards.length > 0 ? movementGuardsResult.guards : undefined,
          interactionScript: interactionScriptResult.actions.length > 0 ? interactionScriptResult.actions : undefined,
          idleAnimation,
          moveAnimation,
          // Keep map + position + requiresFlag from this timeline entry unless edited via instance controls.
          mapId: currentPlacement.mapId,
          position: currentPlacement.position ? { ...currentPlacement.position } : undefined,
          requiresFlag: currentPlacement.requiresFlag,
        };
        return {
          ...template,
          label: npcCharacterLabelInput.trim() || template.label,
          npcName,
          color: npcCharacterColorInput || '#9b73b8',
          facing: npcFacingInput,
          dialogueId: sanitizeIdentifier(npcDialogueIdInput, 'custom_npc_dialogue'),
          dialogueSpeaker: npcDialogueSpeakerInput.trim() || undefined,
          dialogueLines: npcDialogueLinesInput
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
          dialogueSetFlag: npcDialogueSetFlagInput.trim() || undefined,
          firstInteractionSetFlag: npcFirstInteractionSetFlagInput.trim() || undefined,
          firstInteractBattle: npcFirstInteractBattleInput,
          healer: npcHealerInput,
          battleTeamIds: parseStringList(npcBattleTeamsInput),
          movement,
          movementGuards:
            movementGuardsResult.guards.length > 0 ? movementGuardsResult.guards : undefined,
          interactionScript: interactionScriptResult.actions.length > 0 ? interactionScriptResult.actions : undefined,
          idleAnimation,
          moveAnimation,
          storyStates: compactCharacterPlacementOrder(placements),
          spriteId: selectedNpcSpriteId || template.spriteId,
          cacheVersion: Date.now(),
        };
      });
      setStatus(`Updated ${character.npcName} instance #${index + 1}.`);
      return;
    }

    if (!selectedMapNpc) {
      setError('Select an NPC from the map list first.');
      return;
    }
    const storyStatesResult = parseNpcStoryStatesInput(npcStoryStatesInput);
    if (!storyStatesResult.ok) {
      setError(storyStatesResult.error);
      return;
    }

    setEditableMap((current) => {
      const next = cloneEditableMap(current);
      const index = next.npcs.findIndex((entry) => entry.id === selectedMapNpc.id);
      if (index < 0) {
        return current;
      }
      next.npcs[index] = {
        ...next.npcs[index],
        name: npcName,
        color: npcCharacterColorInput || '#9b73b8',
        facing: npcFacingInput,
        dialogueId: sanitizeIdentifier(npcDialogueIdInput, 'custom_npc_dialogue'),
        dialogueSpeaker: npcDialogueSpeakerInput.trim() || undefined,
        dialogueLines: npcDialogueLinesInput
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
        dialogueSetFlag: npcDialogueSetFlagInput.trim() || undefined,
        firstInteractionSetFlag: npcFirstInteractionSetFlagInput.trim() || undefined,
        firstInteractBattle: npcFirstInteractBattleInput,
        healer: npcHealerInput,
        battleTeamIds: parseStringList(npcBattleTeamsInput),
        movement,
        movementGuards:
          movementGuardsResult.guards.length > 0 ? movementGuardsResult.guards : undefined,
        storyStates:
          storyStatesResult.states.length > 0 ? compactCharacterPlacementOrder(storyStatesResult.states) : undefined,
        interactionScript: interactionScriptResult.actions.length > 0 ? interactionScriptResult.actions : undefined,
        idleAnimation,
        moveAnimation,
        sprite: nextSprite,
      };
      return next;
    });

    setStatus(`Updated map NPC "${npcName}".`);
  };

  const onAtlasCellMouseDown = (atlasIndex: number) => {
    setIsSelectingAtlas(true);
    setSelectedAtlasStartIndex(atlasIndex);
    setSelectedAtlasEndIndex(atlasIndex);
    setStatus(`Started atlas selection at index ${atlasIndex}.`);
  };

  const onAtlasCellMouseEnter = (atlasIndex: number) => {
    if (!isSelectingAtlas) {
      return;
    }
    setSelectedAtlasEndIndex(atlasIndex);
  };

  const setWarpCoordinateFromEdge = (target: 'from' | 'to') => {
    if (!selectedWarp) {
      setError('Select a warp before using edge helper.');
      return;
    }

    const coordinate = coordinateForEdge(edgeSide, edgeOffset, mapSize.width, mapSize.height);
    updateSelectedWarp((warp) =>
      target === 'from'
        ? {
            ...warp,
            from: coordinate,
            fromPositions: [coordinate],
          }
        : {
            ...warp,
            to: coordinate,
            toPositions: [coordinate],
          },
    );
    setStatus(`Updated warp ${target} coordinate using ${edgeSide} edge.`);
  };

  const applySelectedWarpCoordinateLists = () => {
    if (!selectedWarp) {
      setError('Select a warp before applying coordinate lists.');
      return;
    }

    const fromXs = parseCommaSeparatedIntegers(warpFromXListInput);
    const fromYs = parseCommaSeparatedIntegers(warpFromYListInput);
    const toXs = parseCommaSeparatedIntegers(warpToXListInput);
    const toYs = parseCommaSeparatedIntegers(warpToYListInput);

    if (!fromXs || !fromYs || !toXs || !toYs) {
      setError('Warp coordinate lists must be comma-separated integers.');
      return;
    }

    const fromPositions = buildWarpPositionsFromAxisLists(fromXs, fromYs, 'From');
    if (!fromPositions) {
      setError(
        'From X/Y list lengths must match, or one side must contain a single value for broadcasting.',
      );
      return;
    }
    const toPositions = buildWarpPositionsFromAxisLists(toXs, toYs, 'To');
    if (!toPositions) {
      setError(
        'To X/Y list lengths must match, or one side must contain a single value for broadcasting.',
      );
      return;
    }

    updateSelectedWarp((warp) => ({
      ...warp,
      from: { ...fromPositions[0] },
      fromPositions,
      to: { ...toPositions[0] },
      toPositions,
    }));
    setStatus(`Updated warp ${selectedWarp.id} coordinate lists.`);
  };

  const atlasCellStyle = (atlasIndex: number, size: number): CSSProperties => {
    if (!tilesetUrl || !atlasMeta.loaded || atlasMeta.columns <= 0 || atlasMeta.rows <= 0) {
      return {
        backgroundColor: '#1d2731',
        boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
      };
    }

    const safeIndex = clampInt(atlasIndex, 0, Math.max(0, atlasCellCount - 1));
    const column = safeIndex % atlasMeta.columns;
    const row = Math.floor(safeIndex / atlasMeta.columns);

    return {
      backgroundImage: `url(${tilesetUrl})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${atlasMeta.columns * size}px ${atlasMeta.rows * size}px`,
      backgroundPosition: `-${column * size}px -${row * size}px`,
      imageRendering: 'pixelated',
    };
  };

  const npcAtlasCellStyle = (atlasIndex: number, size: number): CSSProperties => {
    if (!npcSpriteUrl || !npcSpriteMeta.loaded || npcSpriteMeta.columns <= 0 || npcSpriteMeta.rows <= 0) {
      return {
        backgroundColor: '#1d2731',
        boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
      };
    }

    const safeIndex = clampInt(atlasIndex, 0, Math.max(0, npcAtlasCellCount - 1));
    const column = safeIndex % npcSpriteMeta.columns;
    const row = Math.floor(safeIndex / npcSpriteMeta.columns);

    return {
      backgroundImage: `url(${npcSpriteUrl})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${npcSpriteMeta.columns * size}px ${npcSpriteMeta.rows * size}px`,
      backgroundPosition: `-${column * size}px -${row * size}px`,
      imageRendering: 'pixelated',
    };
  };

  const tileCellStyle = (code: EditorTileCode, size: number, rotationQuarter = 0): CSSProperties => {
    if (code === BLANK_TILE_CODE) {
      return {
        width: `${size}px`,
        height: `${size}px`,
        background: 'transparent',
      };
    }

    const knownTile = isKnownTileCode(code) ? TILE_DEFINITIONS[code as BaseTileCode] : null;
    const fallback: CSSProperties = knownTile
      ? {
          backgroundColor: knownTile.color,
          boxShadow: `inset 0 0 0 1px ${knownTile.accentColor ?? '#111'}`,
          imageRendering: 'pixelated',
        }
      : {
          backgroundColor: '#5f2d3a',
          boxShadow: 'inset 0 0 0 1px rgba(255, 203, 219, 0.4)',
          imageRendering: 'pixelated',
        };

    const withRotation = (base: CSSProperties): CSSProperties => {
      const style = { ...base };
      if (rotationQuarter % 4 !== 0) {
        style.transform = `rotate(${(rotationQuarter % 4) * 90}deg)`;
        style.transformOrigin = 'center center';
      }
      return style;
    };

    if (!tilesetUrl || !atlasMeta.loaded || atlasMeta.columns <= 0 || atlasMeta.rows <= 0) {
      return withRotation(fallback);
    }

    const tileIndex = atlasIndexByCode.get(code);
    if (tileIndex === undefined || !Number.isFinite(tileIndex) || tileIndex < 0) {
      return withRotation(fallback);
    }

    return withRotation({
      ...fallback,
      ...atlasCellStyle(tileIndex, size),
    });
  };

  const headerTitle = isTilesSection
    ? 'Tile Library'
    : isNpcSpritesSection
      ? 'NPC Sprite Studio'
    : isNpcCharactersSection
        ? 'NPC Character Studio'
        : isNpcsSection
          ? 'NPC Studio'
          : 'Map Editor';
  const headerDescription = isTilesSection
    ? 'Load tilesets, pick 1x1 or larger tile regions, and save reusable tile stamps.'
    : isNpcSpritesSection
      ? 'Build reusable NPC sprite sheets, directional frames, and animation sets.'
    : isNpcCharactersSection
        ? 'Create NPC characters from saved sprites and configure behavior + story-state rules.'
        : isNpcsSection
          ? 'Load existing maps, place NPCs, and edit map-specific story behavior.'
          : 'Create new maps, edit existing ones, and configure warps between maps.';

  return (
    <section className={`admin-tool ${embedded ? 'admin-tool--embedded' : ''}`}>
      <datalist id="admin-flag-options">
        {knownFlagIds.map((flagId) => (
          <option key={`admin-flag-option-${flagId}`} value={flagId} />
        ))}
      </datalist>
      {!embedded && (
        <header className="admin-tool__header">
          <div>
            <h2>{headerTitle}</h2>
            <p>{headerDescription}</p>
          </div>
          <div className="admin-tool__status">
            {statusMessage && <span className="status-chip">{statusMessage}</span>}
            {errorMessage && <span className="status-chip is-error">{errorMessage}</span>}
          </div>
        </header>
      )}
      {embedded && (
        <div className="admin-tool__status admin-tool__status--embedded">
          {statusMessage && <span className="status-chip">{statusMessage}</span>}
          {errorMessage && <span className="status-chip is-error">{errorMessage}</span>}
        </div>
      )}

      <div className={`admin-layout ${showTwoColumnLayout ? '' : 'admin-layout--single'}`}>
        <aside className="admin-layout__left">
          {showMapEditing && (
          <section className="admin-panel">
            <h3>Map Source</h3>
            <div className="admin-row">
              <select value={selectedSourceMapId} onChange={(event) => setSelectedSourceMapId(event.target.value)}>
                <option value="">Select existing map</option>
                {sourceMaps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.id}
                  </option>
                ))}
              </select>
              <button type="button" className="secondary" onClick={loadSelectedSourceMap}>
                Load Existing
              </button>
              <button type="button" className="secondary" onClick={loadSourceMapsFromDatabase}>
                Refresh Maps
              </button>
            </div>
            <p className="admin-note">
              {isNpcsSection
                ? 'NPC Studio works on existing maps only. Load a map, then paint/edit/remove NPC characters.'
                : 'Editor starts blank. Load a map, create one, or import JSON to begin.'}
            </p>
          </section>
          )}

          {isNpcCharactersSection && selectedCharacterForInstanceList && (
          <section className="admin-panel">
            <h3>{selectedCharacterForInstanceList.npcName} Instances</h3>
            <p className="admin-note">
              Pick an instance to edit its full dialogue, team, and movement in the character form below.
            </p>
            <div className="admin-row">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const fallbackMapId =
                    selectedCharacterInstances[selectedCharacterInstances.length - 1]?.mapId || sourceMapIds[0] || '';
                  if (!fallbackMapId) {
                    setError('Load maps before adding an NPC instance so a map target can be assigned.');
                    return;
                  }
                  addCharacterPlacementInstance(selectedCharacterForInstanceList.id, fallbackMapId, { x: 0, y: 0 });
                }}
              >
                Add Instance
              </button>
            </div>
            <div className="npc-instance-list">
              {selectedCharacterInstances.length === 0 && (
                <p className="admin-note">No instances yet. Add one to place this character in the story timeline.</p>
              )}
              {selectedCharacterInstances.map((placement, index, list) => {
                const movementType = toEditorNpcMovementType(placement.movement?.type);
                const battleTeams = (placement.battleTeamIds ?? []).join(', ') || 'No battle team';
                return (
                  <article
                    key={`character-instance-card-${selectedCharacterForInstanceList.id}-${index}`}
                    className={`npc-instance-card ${
                      selectedCharacterInstanceKey === `${selectedCharacterForInstanceList.id}:${index}` ? 'is-selected' : ''
                    }`}
                  >
                    <div className="npc-instance-card__header">
                      <h4>Instance #{index + 1}</h4>
                      <p className="npc-instance-card__meta">
                        {movementType} | {battleTeams}
                      </p>
                    </div>
                    <div className="admin-grid-2 npc-instance-card__fields">
                      <label>
                        Map ID
                        <select
                          value={placement.mapId ?? ''}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              mapId: event.target.value,
                            }))
                          }
                        >
                          <option value="">(Select map)</option>
                          {sourceMapIds.map((mapId) => (
                            <option key={mapId} value={mapId}>
                              {mapId}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Requires Flag
                        <input
                          list="admin-flag-options"
                          value={placement.requiresFlag ?? ''}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              requiresFlag: event.target.value.trim() || undefined,
                            }))
                          }
                          placeholder="(none)"
                        />
                      </label>
                      <label>
                        Position X
                        <input
                          type="number"
                          value={String(placement.position?.x ?? 0)}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              position: {
                                x: Number.parseInt(event.target.value, 10) || 0,
                                y: entry.position?.y ?? 0,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Position Y
                        <input
                          type="number"
                          value={String(placement.position?.y ?? 0)}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              position: {
                                x: entry.position?.x ?? 0,
                                y: Number.parseInt(event.target.value, 10) || 0,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Set Flag On First Interaction
                        <input
                          list="admin-flag-options"
                          value={placement.firstInteractionSetFlag ?? ''}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              firstInteractionSetFlag: event.target.value.trim() || undefined,
                            }))
                          }
                          placeholder="(none)"
                        />
                      </label>
                      <label>
                        First Interact Battle?
                        <input
                          type="checkbox"
                          checked={Boolean(placement.firstInteractBattle)}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              firstInteractBattle: event.target.checked,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Healer?
                        <input
                          type="checkbox"
                          checked={Boolean(placement.healer)}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              healer: event.target.checked,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="admin-row npc-instance-card__actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => loadCharacterPlacementIntoEditor(selectedCharacterForInstanceList.id, index)}
                      >
                        Edit In Main Form
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => moveCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, 'up')}
                        disabled={index <= 0}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => moveCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, 'down')}
                        disabled={index >= list.length - 1}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => removeCharacterPlacementInstance(selectedCharacterForInstanceList.id, index)}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          )}

          {showMapEditing && !isNpcsSection && (
          <section className="admin-panel">
            <h3>New Map</h3>
            <div className="admin-grid-2">
              <label>
                ID
                <input value={newMapId} onChange={(event) => setNewMapId(event.target.value)} />
              </label>
              <label>
                Name
                <input value={newMapName} onChange={(event) => setNewMapName(event.target.value)} />
              </label>
              <label>
                Width
                <input
                  type="number"
                  min={4}
                  max={MAX_EDITOR_DIMENSION}
                  value={newMapWidthInput}
                  onChange={(event) => setNewMapWidthInput(event.target.value)}
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  min={4}
                  max={MAX_EDITOR_DIMENSION}
                  value={newMapHeightInput}
                  onChange={(event) => setNewMapHeightInput(event.target.value)}
                />
              </label>
              <label>
                Fill Tile
                <select value={newMapFill} onChange={(event) => setNewMapFill(event.target.value)}>
                  <option value="">Select fill tile</option>
                  {TILE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code} - {TILE_DEFINITIONS[code].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" className="primary" onClick={createNewMap}>
              Create Blank Map
            </button>
          </section>
          )}

          {showMapEditing && !isNpcsSection && (
          <section className="admin-panel">
            <h3>Active Map</h3>
            <div className="admin-grid-2">
              <label>
                Map ID
                <input
                  value={editableMap.id}
                  disabled={!hasMapLoaded}
                  onChange={(event) =>
                    setEditableMap((current) => ({
                      ...cloneEditableMap(current),
                      id: sanitizeIdentifier(event.target.value, current.id),
                    }))
                  }
                />
              </label>
              <label>
                Map Name
                <input
                  value={editableMap.name}
                  disabled={!hasMapLoaded}
                  onChange={(event) =>
                    setEditableMap((current) => ({
                      ...cloneEditableMap(current),
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Camera Size (tiles)
                <span className="admin-inline-inputs">
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={editableMap.cameraSize?.widthTiles ?? 19}
                    disabled={!hasMapLoaded}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isFinite(n) || n < 1) return;
                      setEditableMap((c) => ({
                        ...cloneEditableMap(c),
                        cameraSize: { widthTiles: Math.min(64, n), heightTiles: c.cameraSize?.heightTiles ?? 15 },
                      }));
                    }}
                    title="Viewport width in tiles"
                  />
                  <span>×</span>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={editableMap.cameraSize?.heightTiles ?? 15}
                    disabled={!hasMapLoaded}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isFinite(n) || n < 1) return;
                      setEditableMap((c) => ({
                        ...cloneEditableMap(c),
                        cameraSize: { widthTiles: c.cameraSize?.widthTiles ?? 19, heightTiles: Math.min(64, n) },
                      }));
                    }}
                    title="Viewport height in tiles"
                  />
                </span>
              </label>
              <label>
                Camera Point
                <span className="admin-inline-inputs">
                  <input
                    type="number"
                    min={0}
                    value={editableMap.cameraPoint != null ? editableMap.cameraPoint.x : ''}
                    disabled={!hasMapLoaded}
                    placeholder="x"
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setEditableMap((c) => ({
                        ...cloneEditableMap(c),
                        cameraPoint: c.cameraPoint
                          ? { ...c.cameraPoint, x: Number.isFinite(n) ? Math.max(0, n) : 0 }
                          : Number.isFinite(n) ? { x: Math.max(0, n), y: 0 } : null,
                      }));
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    value={editableMap.cameraPoint != null ? editableMap.cameraPoint.y : ''}
                    disabled={!hasMapLoaded}
                    placeholder="y"
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setEditableMap((c) => ({
                        ...cloneEditableMap(c),
                        cameraPoint: c.cameraPoint
                          ? { ...c.cameraPoint, y: Number.isFinite(n) ? Math.max(0, n) : 0 }
                          : Number.isFinite(n) ? { x: 0, y: Math.max(0, n) } : null,
                      }));
                    }}
                  />
                  <button
                    type="button"
                    className="secondary"
                    disabled={!hasMapLoaded || editableMap.cameraPoint == null}
                    onClick={() =>
                      setEditableMap((c) => ({ ...cloneEditableMap(c), cameraPoint: null }))
                    }
                  >
                    Clear
                  </button>
                </span>
              </label>
              <label>
                Active Layer
                <select
                  value={activeLayer?.id ?? ''}
                  disabled={!hasMapLoaded}
                  onChange={(event) => setActiveLayerId(event.target.value)}
                >
                  {orderedLayers.map((layer) => (
                    <option key={layer.id} value={layer.id}>
                      {layer.id} - {layer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Layer ID
                <input
                  type="number"
                  min={1}
                  value={activeLayer ? String(parseLayerOrderId(activeLayer.id) ?? '') : ''}
                  disabled={!activeLayer}
                  onChange={(event) => {
                    if (!activeLayer) {
                      return;
                    }
                    const nextValue = parseInteger(event.target.value);
                    if (!nextValue || nextValue < 1) {
                      return;
                    }
                    const nextId = makeUniqueLayerId(
                      editableMap.layers,
                      activeLayer.id,
                      nextValue,
                    );
                    updateActiveLayer((layer) => ({
                      ...layer,
                      id: nextId,
                    }));
                    setActiveLayerId(nextId);
                  }}
                />
              </label>
              <label>
                Layer Name
                <input
                  value={activeLayer?.name ?? ''}
                  disabled={!activeLayer}
                  onChange={(event) =>
                    updateActiveLayer((layer) => ({
                      ...layer,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Layer Visible
                <input
                  type="checkbox"
                  checked={Boolean(activeLayer?.visible)}
                  disabled={!activeLayer}
                  onChange={(event) =>
                    updateActiveLayer((layer) => ({
                      ...layer,
                      visible: event.target.checked,
                    }))
                  }
                />
              </label>
              <label>
                Layer Collision
                <input
                  type="checkbox"
                  checked={Boolean(activeLayer?.collision)}
                  disabled={!activeLayer}
                  onChange={(event) =>
                    updateActiveLayer((layer) => ({
                      ...layer,
                      collision: event.target.checked,
                    }))
                  }
                />
              </label>
              <label>
                Resize Width
                <input
                  type="number"
                  min={4}
                  max={MAX_EDITOR_DIMENSION}
                  value={resizeWidthInput}
                  onChange={(event) => setResizeWidthInput(event.target.value)}
                  disabled={!hasMapLoaded}
                />
              </label>
              <label>
                Resize Height
                <input
                  type="number"
                  min={4}
                  max={MAX_EDITOR_DIMENSION}
                  value={resizeHeightInput}
                  onChange={(event) => setResizeHeightInput(event.target.value)}
                  disabled={!hasMapLoaded}
                />
              </label>
              <label>
                Fill Tile
                <select value={resizeFill} onChange={(event) => setResizeFill(event.target.value)} disabled={!hasMapLoaded}>
                  <option value="">Select fill tile</option>
                  {TILE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="admin-row">
              <input
                value={newLayerName}
                onChange={(event) => setNewLayerName(event.target.value)}
                placeholder="New layer name"
                disabled={!hasMapLoaded}
              />
              <button type="button" className="secondary" onClick={addLayer} disabled={!hasMapLoaded}>
                Add Layer
              </button>
              <button
                type="button"
                className="secondary"
                onClick={removeActiveLayer}
                disabled={!activeLayer || editableMap.layers.length <= 1}
              >
                Remove Active Layer
              </button>
            </div>
            <button type="button" className="secondary" onClick={applyResize}>
              Apply Resize
            </button>
            <p className="admin-note">
              {hasMapLoaded
                ? `Current size: ${mapSize.width}x${mapSize.height} | Layers: ${editableMap.layers.length}`
                : 'No active map loaded.'}
            </p>
            <p className="admin-note">Layer render order uses numeric IDs: higher IDs draw above lower IDs.</p>
          </section>
          )}

          {showTilesLibrary && (
          <section className="admin-panel">
            <h3>Tileset</h3>
            <div className="admin-grid-2">
              <label>
                Tileset URL
                <input value={tilesetUrlInput} onChange={(event) => setTilesetUrlInput(event.target.value)} />
              </label>
              <label>
                Tile Pixel Width
                <input
                  type="number"
                  min={8}
                  max={128}
                  value={tilePixelWidthInput}
                  onChange={(event) => setTilePixelWidthInput(event.target.value)}
                />
              </label>
              <label>
                Tile Pixel Height
                <input
                  type="number"
                  min={8}
                  max={128}
                  value={tilePixelHeightInput}
                  onChange={(event) => setTilePixelHeightInput(event.target.value)}
                />
              </label>
              <label>
                Load from File
                <input type="file" accept="image/*" onChange={onTilesetFileSelected} />
              </label>
            </div>
            <h4>Supabase Tilesets</h4>
            <div className="admin-grid-2">
              <label>
                Bucket
                <input value={tilesetBucketInput} onChange={(event) => setTilesetBucketInput(event.target.value)} />
              </label>
              <label>
                Prefix (Optional)
                <input value={tilesetPrefixInput} onChange={(event) => setTilesetPrefixInput(event.target.value)} />
              </label>
            </div>
            <div className="admin-row">
              <label>
                Search
                <input
                  value={tilesetSearchInput}
                  onChange={(event) => setTilesetSearchInput(event.target.value)}
                  placeholder="Search by file name or path"
                />
              </label>
              <button
                type="button"
                className="secondary"
                onClick={loadTilesetSupabaseAssets}
                disabled={isLoadingTilesetSupabaseAssets}
              >
                {isLoadingTilesetSupabaseAssets ? 'Loading...' : 'Reload Bucket'}
              </button>
            </div>
            <div className="spritesheet-browser">
              {filteredTilesetSupabaseAssets.length === 0 && (
                <p className="admin-note">
                  {isLoadingTilesetSupabaseAssets ? 'Loading tilesets...' : 'No PNG tilesets found.'}
                </p>
              )}
              {filteredTilesetSupabaseAssets.map((entry) => (
                <div
                  key={`tileset-supabase-asset-${entry.path}`}
                  className={`spritesheet-browser__row ${selectedTilesetSupabasePath === entry.path ? 'is-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setTilesetUrlInput(entry.publicUrl);
                      setTilesetUrl(entry.publicUrl);
                      setSelectedTilesetSupabasePath(entry.path);
                      setStatus(`Loaded tileset "${entry.path}" from Supabase.`);
                    }}
                  >
                    Load
                  </button>
                  <span className="spritesheet-browser__meta" title={entry.path}>
                    {entry.path}
                  </span>
                  <span className="spritesheet-browser__meta">
                    {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : '-'}
                  </span>
                </div>
              ))}
            </div>
            <div className="admin-row">
              <button type="button" className="secondary" onClick={applyTilesetUrl}>
                Apply URL
              </button>
              <button type="button" className="secondary" onClick={loadExampleTileset}>
                Use Example Tileset
              </button>
              <button type="button" className="secondary" onClick={autoGeneratePaintTiles}>
                Auto Mode: Generate Paint Tiles
              </button>
              <button type="button" className="secondary" onClick={loadSavedPaintTilesFromDatabase}>
                Load Saved Tiles
              </button>
              <button type="button" className="secondary" onClick={clearSavedPaintTiles} disabled={savedPaintTiles.length === 0}>
                Clear Saved Tiles
              </button>
            </div>
            <p className="admin-note">
              {atlasMeta.loaded
                ? `Loaded ${atlasMeta.width}x${atlasMeta.height} (${atlasMeta.columns} columns x ${atlasMeta.rows} rows)`
                : atlasMeta.error ?? 'No tileset loaded.'}
            </p>

            <h4>Tileset Grid Picker</h4>
            <p className="admin-note">Click-drag to select one or many adjacent atlas cells, then save as a stamp.</p>
            <div className="tileset-grid-wrap">
              {atlasMeta.loaded ? (
                <div
                  className="tileset-grid"
                  style={{
                    gridTemplateColumns: `repeat(${atlasMeta.columns}, ${ATLAS_PREVIEW_SIZE}px)`,
                  }}
                >
                  {Array.from({ length: atlasCellCount }, (_, atlasIndex) => (
                    <button
                      key={`atlas-${atlasIndex}`}
                      type="button"
                      className={`tileset-grid__cell ${
                        isAtlasCellInRect(selectedAtlasRect, atlasIndex, atlasMeta.columns) ? 'is-selected' : ''
                      } ${selectedAtlasStartIndex === atlasIndex ? 'is-anchor' : ''}`}
                      style={{
                        ...atlasCellStyle(atlasIndex, ATLAS_PREVIEW_SIZE),
                        width: `${ATLAS_PREVIEW_SIZE}px`,
                        height: `${ATLAS_PREVIEW_SIZE}px`,
                      }}
                      onMouseDown={(event) => {
                        if (event.button !== 0) {
                          return;
                        }
                        event.preventDefault();
                        onAtlasCellMouseDown(atlasIndex);
                      }}
                      onMouseEnter={() => onAtlasCellMouseEnter(atlasIndex)}
                      title={`Atlas index ${atlasIndex}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="tileset-grid__empty">Tileset not loaded yet.</div>
              )}
            </div>

            <div className="admin-grid-2">
              <label>
                Selected Rectangle
                <input
                  value={selectedAtlasRect ? `${selectedAtlasRect.width}x${selectedAtlasRect.height}` : ''}
                  placeholder="None"
                  readOnly
                />
              </label>
              <label>
                Saved Tile Name
                <input value={manualPaintTileName} onChange={(event) => setManualPaintTileName(event.target.value)} />
              </label>
              <label>
                Preview
                <span
                  className="saved-paint-preview-large"
                  style={
                    selectedAtlasRect
                      ? atlasCellStyle(selectedAtlasRect.minRow * atlasMeta.columns + selectedAtlasRect.minCol, 34)
                      : undefined
                  }
                />
              </label>
            </div>
            <button type="button" className="secondary" onClick={saveManualPaintTileFromAtlas}>
              Save Selected Atlas Rectangle To Paint Tools
            </button>

            <h4>Saved Paint Tiles</h4>
            <p className="admin-note">Rename, select, or remove saved tiles. New tiles persist to IndexedDB.</p>
            <div className="saved-paint-list">
              {savedPaintTiles.length === 0 && <p className="admin-note">No saved paint tiles yet.</p>}
              {savedPaintTiles.map((tile) => (
                <div key={tile.id} className={`saved-paint-row ${selectedPaintTileId === tile.id ? 'is-selected' : ''}`}>
                  <button type="button" className="secondary" onClick={() => selectPaintTile(tile.id)}>
                    Use
                  </button>
                  <div
                    className="saved-paint-row__preview-grid"
                    style={{ gridTemplateColumns: `repeat(${tile.width}, 18px)` }}
                  >
                    {tile.cells.map((cell) => (
                      <span
                        key={`${tile.id}-${cell.dx}-${cell.dy}`}
                        className="saved-paint-row__preview"
                        style={atlasCellStyle(cell.atlasIndex, 18)}
                      />
                    ))}
                  </div>
                  <input
                    value={tile.name}
                    onChange={(event) =>
                      updateSavedPaintTile(tile.id, (current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                  <label>
                    Y-Sort With Actors
                    <input
                      type="checkbox"
                      checked={tile.ySortWithActors}
                      onChange={(event) =>
                        updateSavedPaintTile(tile.id, (current) => ({
                          ...current,
                          ySortWithActors: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <span className="saved-paint-row__meta">
                    {tile.width}x{tile.height} | {tile.cells.length} codes | {tile.ySortWithActors ? 'Y-sort' : 'Flat'}
                  </span>
                  <button type="button" className="secondary" onClick={() => removePaintTile(tile.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
          )}

          {showMapEditing && !isNpcsSection && (
          <section className="admin-panel">
            <h3>Warp Editor</h3>
            <div className="admin-row">
              <select value={selectedWarpId} onChange={(event) => setSelectedWarpId(event.target.value)}>
                <option value="">No warp selected</option>
                {editableMap.warps.map((warp) => (
                  <option key={warp.id} value={warp.id}>
                    {warp.id}
                  </option>
                ))}
              </select>
              <button type="button" className="secondary" onClick={addWarp} disabled={!hasMapLoaded}>
                Add Warp
              </button>
              <button type="button" className="secondary" onClick={removeSelectedWarp} disabled={!selectedWarp}>
                Remove
              </button>
            </div>

            {selectedWarp && (
              <>
                <div className="admin-grid-2">
                  <label>
                    Warp ID
                    <input
                      value={selectedWarp.id}
                      onChange={(event) =>
                        updateSelectedWarp((warp) => ({
                          ...warp,
                          id: sanitizeIdentifier(event.target.value, warp.id),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Label
                    <input
                      value={selectedWarp.label ?? ''}
                      onChange={(event) =>
                        updateSelectedWarp((warp) => ({
                          ...warp,
                          label: event.target.value || undefined,
                        }))
                      }
                    />
                  </label>
                  <label>
                    To Map ID
                    <select
                      value={selectedWarp.toMapId}
                      onChange={(event) =>
                        updateSelectedWarp((warp) => ({
                          ...warp,
                          toMapId: event.target.value,
                        }))
                      }
                    >
                      {selectableWarpMapIds.map((mapId) => (
                        <option key={`warp-map-${mapId}`} value={mapId}>
                          {mapId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Require Interact
                    <input
                      type="checkbox"
                      checked={Boolean(selectedWarp.requireInteract)}
                      onChange={(event) =>
                        updateSelectedWarp((warp) => ({
                          ...warp,
                          requireInteract: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Required Facing
                    <select
                      value={selectedWarp.requiredFacing ?? ''}
                      onChange={(event) =>
                        updateSelectedWarp((warp) => ({
                          ...warp,
                          requiredFacing: (event.target.value || undefined) as Direction | undefined,
                        }))
                      }
                    >
                      <option value="">None</option>
                      <option value="up">Up</option>
                      <option value="down">Down</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                  <label>
                    To Facing
                    <select
                      value={selectedWarp.toFacing ?? ''}
                      onChange={(event) =>
                        updateSelectedWarp((warp) => ({
                          ...warp,
                          toFacing: (event.target.value || undefined) as Direction | undefined,
                        }))
                      }
                    >
                      <option value="">Keep Current</option>
                      <option value="up">Up</option>
                      <option value="down">Down</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                  <label>
                    From X List
                    <input
                      value={warpFromXListInput}
                      onChange={(event) => setWarpFromXListInput(event.target.value)}
                    />
                  </label>
                  <label>
                    From Y List
                    <input
                      value={warpFromYListInput}
                      onChange={(event) => setWarpFromYListInput(event.target.value)}
                    />
                  </label>
                  <label>
                    To X List
                    <input
                      value={warpToXListInput}
                      onChange={(event) => setWarpToXListInput(event.target.value)}
                    />
                  </label>
                  <label>
                    To Y List
                    <input
                      value={warpToYListInput}
                      onChange={(event) => setWarpToYListInput(event.target.value)}
                    />
                  </label>
                </div>
                <p className="admin-note">
                  Enter comma-separated indices (for example: <code>8, 9, 10</code>). X/Y list lengths must match, or
                  one side can be a single value.
                </p>
                <button type="button" className="secondary" onClick={applySelectedWarpCoordinateLists}>
                  Apply Coordinate Lists
                </button>
                <div className="admin-row">
                  <button
                    type="button"
                    className={`secondary ${tool === 'warp-from' ? 'is-selected' : ''}`}
                    onClick={() => toggleTool('warp-from')}
                  >
                    Paint Warp From
                  </button>
                  <button
                    type="button"
                    className={`secondary ${tool === 'warp-to' ? 'is-selected' : ''}`}
                    onClick={() => toggleTool('warp-to')}
                  >
                    Paint Warp To
                  </button>
                </div>
                <div className="admin-row">
                  <select value={edgeSide} onChange={(event) => setEdgeSide(event.target.value as EdgeSide)}>
                    <option value="top">Top Edge</option>
                    <option value="right">Right Edge</option>
                    <option value="bottom">Bottom Edge</option>
                    <option value="left">Left Edge</option>
                  </select>
                  <input
                    type="number"
                    value={edgeOffset}
                    onChange={(event) => setEdgeOffset(Number(event.target.value))}
                  />
                  <button type="button" className="secondary" onClick={() => setWarpCoordinateFromEdge('from')}>
                    Set From Edge
                  </button>
                  <button type="button" className="secondary" onClick={() => setWarpCoordinateFromEdge('to')}>
                    Set To Edge
                  </button>
                </div>
              </>
            )}
          </section>
          )}

          {showMapEditing && !isNpcsSection && (
          <section className="admin-panel">
            <h3>Encounter Tools</h3>
            <div className="admin-row">
              <button
                type="button"
                className="secondary"
                onClick={loadEncounterDataFromDatabase}
                disabled={isLoadingEncounterTables}
              >
                {isLoadingEncounterTables ? 'Loading...' : 'Reload Encounter Pools'}
              </button>
              <button type="button" className="secondary" onClick={startEncounterGroupDraft}>
                New Encounter Group
              </button>
              <button type="button" className="primary" onClick={applyEncounterGroupToMap}>
                Set Encounter
              </button>
              <button type="button" className="secondary" onClick={removeSelectedEncounterGroup} disabled={!selectedEncounterGroup}>
                Remove Group
              </button>
              <button type="button" className="secondary" onClick={clearEncounterSelection}>
                Clear Selection
              </button>
              <button
                type="button"
                className={`secondary ${tool === 'encounter-select' ? 'is-selected' : ''}`}
                onClick={() => toggleTool('encounter-select')}
              >
                Select Cells
              </button>
            </div>

            <div className="admin-grid-2">
              <label>
                Current Encounter Group
                <select
                  value={selectedEncounterGroupId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    if (!nextId) {
                      startEncounterGroupDraft();
                      return;
                    }
                    setSelectedEncounterGroupId(nextId);
                  }}
                >
                  <option value="">Draft New Group</option>
                  {editableMap.encounterGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.id} ({group.tilePositions.length} tiles)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Encounter Group ID
                <input
                  value={encounterGroupIdInput}
                  onChange={(event) => setEncounterGroupIdInput(event.target.value)}
                  placeholder="tall-grass-route-1"
                />
              </label>
              <label>
                Walk Encounter Pool
                <select value={encounterWalkTableIdInput} onChange={(event) => setEncounterWalkTableIdInput(event.target.value)}>
                  <option value="">None</option>
                  {encounterTables.map((table) => (
                    <option key={`walk-encounter-${table.id}`} value={table.id}>
                      {table.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fish Encounter Pool
                <select value={encounterFishTableIdInput} onChange={(event) => setEncounterFishTableIdInput(event.target.value)}>
                  <option value="">None</option>
                  {encounterTables.map((table) => (
                    <option key={`fish-encounter-${table.id}`} value={table.id}>
                      {table.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Walk Frequency ({encounterWalkFrequencyPercent}%)
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={encounterWalkFrequencyPercent}
                  onChange={(event) => setEncounterWalkFrequencyPercent(clampInt(Number(event.target.value), 0, 100))}
                />
              </label>
              <label>
                Fish Frequency ({encounterFishFrequencyPercent}%)
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={encounterFishFrequencyPercent}
                  onChange={(event) => setEncounterFishFrequencyPercent(clampInt(Number(event.target.value), 0, 100))}
                />
              </label>
            </div>

            <div className="admin-row">
              <label>
                Add Tile Index X
                <input
                  value={encounterManualTileXInput}
                  onChange={(event) => setEncounterManualTileXInput(event.target.value)}
                  placeholder="12"
                />
              </label>
              <label>
                Add Tile Index Y
                <input
                  value={encounterManualTileYInput}
                  onChange={(event) => setEncounterManualTileYInput(event.target.value)}
                  placeholder="8"
                />
              </label>
              <button type="button" className="secondary" onClick={addManualEncounterTileIndex}>
                Add Tile Index
              </button>
            </div>

            <p className="admin-note">
              Select non-empty map cells with Encounter Tools {'>'} Select Cells (left click sets, shift+click adds, right click removes).
              Walk/Fish pool defaults are None. Pools loaded: {encounterTables.length}. Critters loaded: {encounterCritters.length}.
            </p>
            <div className="encounter-selection-list">
              {selectedCellKeys.map((key) => (
                <button
                  key={`encounter-selected-cell-${key}`}
                  type="button"
                  className="secondary"
                  onClick={() => {
                    const parsed = parseCellKey(key);
                    if (!parsed) {
                      return;
                    }
                    removeEncounterSelectionCell(parsed.x, parsed.y);
                  }}
                >
                  {key}
                </button>
              ))}
              {selectedCellKeys.length === 0 && <p className="admin-note">No encounter cells selected.</p>}
            </div>
          </section>
          )}

          {showNpcStudio && (
          <section className="admin-panel">
            <h3>
              {isNpcSpritesSection
                ? 'NPC Sprite Studio'
                : isNpcCharactersSection
                  ? 'NPC Character Studio'
                  : isNpcsSection
                    ? 'NPC Map Placement'
                    : 'NPC Studio'}
            </h3>
            <div className="admin-row">
              {showMapEditing && (
                <>
                  <button
                    type="button"
                    className={`secondary ${tool === 'npc-paint' ? 'is-selected' : ''}`}
                    onClick={() => toggleTool('npc-paint')}
                  >
                    NPC Paint
                  </button>
                  <button
                    type="button"
                    className={`secondary ${tool === 'npc-erase' ? 'is-selected' : ''}`}
                    onClick={() => toggleTool('npc-erase')}
                  >
                    NPC Erase
                  </button>
                </>
              )}
              <button type="button" className="secondary" onClick={loadNpcTemplatesFromDatabase}>
                Load NPC Catalog
              </button>
            </div>

            {showNpcSpriteStudio && (
            <>
            <h4>Sprite Library</h4>
            <div className="admin-grid-2">
              <label>
                Sprite Label
                <input
                  value={npcSpriteLabelInput}
                  onChange={(event) => setNpcSpriteLabelInput(event.target.value)}
                  placeholder="Custom sprite label"
                />
              </label>
            </div>

            <h4>NPC Spritesheet</h4>
            <div className="admin-grid-2">
              <label>
                Atlas Cell Width
                <input value={npcFrameWidthInput} onChange={(event) => setNpcFrameWidthInput(event.target.value)} />
              </label>
              <label>
                Atlas Cell Height
                <input value={npcFrameHeightInput} onChange={(event) => setNpcFrameHeightInput(event.target.value)} />
              </label>
              <label>
                Load from File
                <input type="file" accept="image/*" onChange={onNpcSpriteFileSelected} />
              </label>
            </div>
            <h4>Supabase Spritesheets</h4>
            <div className="admin-grid-2">
              <label>
                Bucket
                <input value={npcSpriteBucketInput} onChange={(event) => setNpcSpriteBucketInput(event.target.value)} />
              </label>
              <label>
                Prefix (Optional)
                <input value={npcSpritePrefixInput} onChange={(event) => setNpcSpritePrefixInput(event.target.value)} />
              </label>
            </div>
            <div className="admin-row">
              <label>
                Search
                <input
                  value={npcSpriteSearchInput}
                  onChange={(event) => setNpcSpriteSearchInput(event.target.value)}
                  placeholder="Search by file name or path"
                />
              </label>
              <button
                type="button"
                className="secondary"
                onClick={loadNpcSupabaseSpriteSheets}
                disabled={isLoadingNpcSupabaseSpriteSheets}
              >
                {isLoadingNpcSupabaseSpriteSheets ? 'Loading...' : 'Reload Bucket'}
              </button>
            </div>
            <div className="spritesheet-browser">
              {filteredNpcSupabaseSpriteSheets.length === 0 && (
                <p className="admin-note">
                  {isLoadingNpcSupabaseSpriteSheets ? 'Loading spritesheets...' : 'No PNG spritesheets found.'}
                </p>
              )}
              {filteredNpcSupabaseSpriteSheets.map((entry) => (
                <div
                  key={`npc-supabase-sheet-${entry.path}`}
                  className={`spritesheet-browser__row ${selectedNpcSupabaseSheetPath === entry.path ? 'is-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setNpcSpriteUrl(entry.publicUrl);
                      setSelectedNpcSupabaseSheetPath(entry.path);
                      setStatus(`Loaded spritesheet "${entry.path}" from Supabase.`);
                    }}
                  >
                    Load
                  </button>
                  <span className="spritesheet-browser__meta" title={entry.path}>
                    {entry.path}
                  </span>
                  <span className="spritesheet-browser__meta">
                    {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : '-'}
                  </span>
                </div>
              ))}
            </div>
            <p className="admin-note">Sprite label is fully manual and will be saved exactly as entered.</p>
            <p className="admin-note">
              Default NPC size: render 1 tile wide x 2 tiles tall (16x32 world pixels).
            </p>
            <p className="admin-note">
              Active NPC sheet: {npcSpriteUrl ? 'Loaded from file.' : 'No file loaded yet.'}
            </p>
            <p className="admin-note">
              {npcSpriteMeta.loaded
                ? `Loaded ${npcSpriteMeta.width}x${npcSpriteMeta.height} (${npcSpriteMeta.columns} columns x ${npcSpriteMeta.rows} rows)`
                : npcSpriteMeta.error ?? 'No NPC sheet loaded.'}
            </p>
            {isNpcPreviewTruncated && (
              <p className="admin-note">
                Preview limited to first {npcPreviewCellCount} cells (of {npcAtlasCellCount}). Increase atlas cell size for a smaller grid.
              </p>
            )}
            <div className="admin-grid-2">
              <label>
                Frame Cells Wide
                <input
                  value={npcFrameCellsWideInput}
                  onChange={(event) => setNpcFrameCellsWideInput(event.target.value)}
                />
              </label>
              <label>
                Frame Cells Tall
                <input
                  value={npcFrameCellsTallInput}
                  onChange={(event) => setNpcFrameCellsTallInput(event.target.value)}
                />
              </label>
              <label>
                Render Tiles Wide
                <input
                  value={npcRenderWidthTilesInput}
                  onChange={(event) => setNpcRenderWidthTilesInput(event.target.value)}
                />
              </label>
              <label>
                Render Tiles Tall
                <input
                  value={npcRenderHeightTilesInput}
                  onChange={(event) => setNpcRenderHeightTilesInput(event.target.value)}
                />
              </label>
            </div>
            <div className="admin-row">
              <label>
                Animation
                <select
                  value={selectedNpcAnimationName}
                  onChange={(event) => setSelectedNpcAnimationName(event.target.value)}
                >
                  {npcAnimationNames.map((name) => (
                    <option key={`npc-animation-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                New Animation
                <input
                  value={newNpcAnimationNameInput}
                  onChange={(event) => setNewNpcAnimationNameInput(event.target.value)}
                  placeholder="attack"
                />
              </label>
              <button type="button" className="secondary" onClick={addNpcAnimation}>
                Add Animation
              </button>
            </div>
            <div className="admin-row">
              <label>
                Rename Selected Animation
                <input
                  value={renameNpcAnimationNameInput}
                  onChange={(event) => setRenameNpcAnimationNameInput(event.target.value)}
                />
              </label>
              <button type="button" className="secondary" onClick={renameSelectedNpcAnimation}>
                Rename Animation
              </button>
              <button type="button" className="secondary" onClick={deleteSelectedNpcAnimation}>
                Delete Animation
              </button>
            </div>
            <div className="admin-row">
              <label>
                Direction
                <select
                  value={npcAssignDirection}
                  onChange={(event) => setNpcAssignDirection(event.target.value as Direction)}
                >
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <button type="button" className="secondary" onClick={addSelectedNpcFrameToAnimation}>
                Add Selected Frame
              </button>
              <button type="button" className="secondary" onClick={clearNpcDirectionFrames}>
                Clear Direction Frames
              </button>
            </div>
            <div className="tileset-grid-wrap npc-sheet-grid-wrap">
              {npcSpriteMeta.loaded ? (
                <div
                  className="tileset-grid"
                  style={{
                    gridTemplateColumns: `repeat(${npcSpriteMeta.columns}, ${ATLAS_PREVIEW_SIZE}px)`,
                  }}
                >
                  {Array.from({ length: npcPreviewCellCount }, (_, frameIndex) => {
                    const isAnimationFrameSelected = selectedNpcAnimationFramesForDirection.includes(frameIndex);
                    return (
                      <button
                        key={`npc-frame-${frameIndex}`}
                        type="button"
                        className={`tileset-grid__cell ${
                          isAnimationFrameSelected ||
                          isAtlasCellInRect(selectedNpcAtlasRect, frameIndex, npcSpriteMeta.columns)
                            ? 'is-selected'
                            : ''
                        } ${selectedNpcAtlasStartIndex === frameIndex ? 'is-anchor' : ''}`}
                        style={{
                          ...npcAtlasCellStyle(frameIndex, ATLAS_PREVIEW_SIZE),
                          width: `${ATLAS_PREVIEW_SIZE}px`,
                          height: `${ATLAS_PREVIEW_SIZE}px`,
                        }}
                        onMouseDown={(event) => {
                          if (event.button !== 0) {
                            return;
                          }
                          event.preventDefault();
                          setIsSelectingNpcAtlas(true);
                          setSelectedNpcAtlasStartIndex(frameIndex);
                          setSelectedNpcAtlasEndIndex(frameIndex);
                        }}
                        onMouseEnter={() => {
                          if (!isSelectingNpcAtlas) {
                            return;
                          }
                          setSelectedNpcAtlasEndIndex(frameIndex);
                        }}
                        title={`Frame ${frameIndex}`}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="tileset-grid__empty">NPC sheet not loaded yet.</div>
              )}
            </div>

            <p className="admin-note">
              Frames for {selectedNpcAnimationName || '-'} {npcAssignDirection}: [
              {selectedNpcAnimationFramesForDirection.join(', ')}]
            </p>
            <div className="admin-row">
              {selectedNpcAnimationFramesForDirection.length === 0 && (
                <span className="admin-note">No frames in this direction yet.</span>
              )}
              {selectedNpcAnimationFramesForDirection.map((frame) => (
                <button
                  key={`npc-frame-remove-${selectedNpcAnimationName}-${npcAssignDirection}-${frame}`}
                  type="button"
                  className="secondary"
                  onClick={() => removeNpcFrameFromAnimation(frame)}
                >
                  Remove {frame}
                </button>
              ))}
            </div>
            <div className="admin-grid-2">
              <label>
                Default Idle Animation
                <input
                  value={npcDefaultIdleAnimationInput}
                  onChange={(event) => setNpcDefaultIdleAnimationInput(event.target.value)}
                />
              </label>
              <label>
                Default Move Animation
                <input
                  value={npcDefaultMoveAnimationInput}
                  onChange={(event) => setNpcDefaultMoveAnimationInput(event.target.value)}
                />
              </label>
            </div>
            <p className="admin-note">
              Selected Rectangle: {selectedNpcAtlasRect ? `${selectedNpcAtlasRect.width}x${selectedNpcAtlasRect.height}` : 'none'}
            </p>

            <button type="button" className="secondary" onClick={saveNpcSprite}>
              Save Sprite
            </button>
            <div className="saved-paint-list">
              {npcSpriteLibrary.length === 0 && <p className="admin-note">No NPC sprites saved yet.</p>}
              {npcSpriteLibrary.map((sprite) => (
                <div
                  key={sprite.id}
                  className={`saved-paint-row ${selectedNpcSpriteId === sprite.id ? 'is-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      const atlasCellWidth = sprite.sprite.atlasCellWidth ?? sprite.sprite.frameWidth;
                      const atlasCellHeight = sprite.sprite.atlasCellHeight ?? sprite.sprite.frameHeight;
                      const frameCellsWide =
                        sprite.sprite.frameCellsWide ??
                        Math.max(1, Math.round(sprite.sprite.frameWidth / Math.max(1, atlasCellWidth)));
                      const frameCellsTall =
                        sprite.sprite.frameCellsTall ??
                        Math.max(1, Math.round(sprite.sprite.frameHeight / Math.max(1, atlasCellHeight)));
                      setSelectedNpcSpriteId(sprite.id);
                      setNpcSpriteLabelInput(sprite.label);
                      setNpcSpriteUrl(sprite.sprite.url);
                      setNpcFrameWidthInput(String(atlasCellWidth));
                      setNpcFrameHeightInput(String(atlasCellHeight));
                      setNpcFrameCellsWideInput(String(frameCellsWide));
                      setNpcFrameCellsTallInput(String(frameCellsTall));
                      setNpcRenderWidthTilesInput(String(sprite.sprite.renderWidthTiles ?? 1));
                      setNpcRenderHeightTilesInput(String(sprite.sprite.renderHeightTiles ?? 2));
                      setNpcFacingFrames({ ...sprite.sprite.facingFrames });
                      setNpcWalkFrames({
                        up: [...(sprite.sprite.walkFrames?.up ?? [])],
                        down: [...(sprite.sprite.walkFrames?.down ?? [])],
                        left: [...(sprite.sprite.walkFrames?.left ?? [])],
                        right: [...(sprite.sprite.walkFrames?.right ?? [])],
                      });
                      const nextAnimationSets =
                        sprite.sprite.animationSets &&
                        Object.keys(sprite.sprite.animationSets).length > 0
                          ? sanitizeDirectionalAnimationSets(
                              sprite.sprite.animationSets as Partial<
                                Record<string, Partial<Record<Direction, number[]>>>
                              >,
                            )
                          : buildDirectionalAnimationSetsFromLegacyFrames(
                              sprite.sprite.facingFrames,
                              {
                                up: [...(sprite.sprite.walkFrames?.up ?? [])],
                                down: [...(sprite.sprite.walkFrames?.down ?? [])],
                                left: [...(sprite.sprite.walkFrames?.left ?? [])],
                                right: [...(sprite.sprite.walkFrames?.right ?? [])],
                              },
                            );
                      setNpcAnimationSetsInput(stringifyDirectionalAnimationSetsForEditor(nextAnimationSets));
                      const nextIdleAnimation = sprite.sprite.defaultIdleAnimation ?? 'idle';
                      const nextMoveAnimation = sprite.sprite.defaultMoveAnimation ?? 'walk';
                      const nextAnimationNames = Object.keys(nextAnimationSets);
                      const nextSelectedAnimation = nextAnimationNames.includes(nextMoveAnimation)
                        ? nextMoveAnimation
                        : nextAnimationNames.includes('walk')
                          ? 'walk'
                          : nextAnimationNames[0] ?? '';
                      setSelectedNpcAnimationName(nextSelectedAnimation);
                      setNpcDefaultIdleAnimationInput(nextIdleAnimation);
                      setNpcDefaultMoveAnimationInput(nextMoveAnimation);
                    }}
                  >
                    Use
                  </button>
                  <span className="saved-paint-row__meta">{sprite.label}</span>
                  <span className="saved-paint-row__meta">{sprite.id}</span>
                  <button type="button" className="secondary" onClick={() => removeNpcSprite(sprite.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <h4>Sprite Usage</h4>
            {selectedNpcSprite ? (
              <>
                <p className="admin-note">
                  {charactersUsingSelectedNpcSprite.length > 0
                    ? `"${selectedNpcSprite.label}" is currently used by ${charactersUsingSelectedNpcSprite.length} character(s).`
                    : `"${selectedNpcSprite.label}" is not linked to any NPC character yet.`}
                </p>
                <div className="saved-paint-list">
                  {charactersUsingSelectedNpcSprite.map((template) => (
                    <div key={`npc-sprite-usage-${template.id}`} className="saved-paint-row">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          loadNpcCharacterTemplateIntoEditor(template, {
                            statusMessage: `Loaded NPC character "${template.label}" from sprite usage.`,
                          })
                        }
                      >
                        Open
                      </button>
                      <span className="saved-paint-row__meta">{template.label}</span>
                      <span className="saved-paint-row__meta">{template.npcName}</span>
                      <span className="saved-paint-row__meta">
                        {getCharacterPlacementInstances(template).length} instance(s)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="admin-note">Select a sprite to see linked characters.</p>
            )}
            </>
            )}

            {showNpcCharacterStudio && (
            <>
            <h4>Character Library</h4>
            {isNpcCharactersSection && (
              <div className="admin-row" style={{ marginBottom: '0.5rem' }}>
                <button type="button" className="primary" onClick={addNewBlankNpcCharacter}>
                  New Character
                </button>
              </div>
            )}
            <div className="admin-grid-2">
              <label>
                Selected Character
                <select
                  value={selectedNpcCharacterId}
                  onChange={(event) => {
                    const template = npcCharacterLibrary.find((entry) => entry.id === event.target.value);
                    if (!template) {
                      setSelectedNpcCharacterId(event.target.value);
                      return;
                    }
                    loadNpcCharacterTemplateIntoEditor(template, {
                      statusMessage: `Loaded NPC character "${template.label}".`,
                    });
                  }}
                >
                  <option value="">Select character</option>
                  {npcCharacterLibrary.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label || template.npcName || '(no name)'} ({template.npcName || template.label || template.id || '—'})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Character Label
                <input
                  value={npcCharacterLabelInput}
                  onChange={(event) => setNpcCharacterLabelInput(event.target.value)}
                />
              </label>
              <label>
                NPC Name
                <input
                  value={npcCharacterNameInput}
                  onChange={(event) => setNpcCharacterNameInput(event.target.value)}
                />
              </label>
              <label>
                Character Sprite
                <select
                  value={selectedNpcSpriteId}
                  onChange={(event) => setSelectedNpcSpriteId(event.target.value)}
                >
                  <option value="">Select sprite</option>
                  {npcSpriteLibrary.map((sprite) => (
                    <option key={sprite.id} value={sprite.id}>
                      {sprite.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Color
                <input
                  type="color"
                  value={npcCharacterColorInput}
                  onChange={(event) => setNpcCharacterColorInput(event.target.value)}
                />
              </label>
              <label>
                Facing
                <select
                  value={npcFacingInput}
                  onChange={(event) => setNpcFacingInput(event.target.value as Direction)}
                >
                  <option value="down">Down</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="up">Up</option>
                </select>
              </label>
              <label>
                Dialogue ID (fallback)
                <input value={npcDialogueIdInput} onChange={(event) => setNpcDialogueIdInput(event.target.value)} />
              </label>
              <label>
                Dialogue Speaker
                <input value={npcDialogueSpeakerInput} onChange={(event) => setNpcDialogueSpeakerInput(event.target.value)} />
              </label>
              <label>
                Set Flag On Complete
                <input
                  list="admin-flag-options"
                  value={npcDialogueSetFlagInput}
                  onChange={(event) => setNpcDialogueSetFlagInput(event.target.value)}
                />
              </label>
              <label>
                Set Flag On First Interaction
                <input
                  list="admin-flag-options"
                  value={npcFirstInteractionSetFlagInput}
                  onChange={(event) => setNpcFirstInteractionSetFlagInput(event.target.value)}
                  placeholder="optional"
                />
              </label>
              <label>
                First Interact Battle?
                <input
                  type="checkbox"
                  checked={npcFirstInteractBattleInput}
                  onChange={(event) => setNpcFirstInteractBattleInput(event.target.checked)}
                />
              </label>
              <label>
                Healer?
                <input
                  type="checkbox"
                  checked={npcHealerInput}
                  onChange={(event) => setNpcHealerInput(event.target.checked)}
                />
              </label>
              <label>
                Movement Type
                <select
                  value={npcMovementTypeInput}
                  onChange={(event) =>
                    setNpcMovementTypeInput(event.target.value as 'static' | 'static-turning' | 'wander' | 'path')
                  }
                >
                  <option value="static">Static</option>
                  <option value="static-turning">Static Turning</option>
                  <option value="wander">Wander</option>
                  <option value="path">Path</option>
                </select>
              </label>
              <label>
                Turn/Step Interval (ms)
                <input value={npcStepIntervalInput} onChange={(event) => setNpcStepIntervalInput(event.target.value)} />
              </label>
              {npcMovementTypeInput === 'wander' && (
                <label>
                  Wander Leash Radius (tiles, optional)
                  <input
                    value={npcWanderLeashRadiusInput}
                    onChange={(event) => setNpcWanderLeashRadiusInput(event.target.value)}
                    placeholder="e.g. 4"
                  />
                </label>
              )}
              {npcMovementTypeInput === 'path' && (
                <label>
                  Path Mode
                  <select
                    value={npcMovementPathModeInput}
                    onChange={(event) => setNpcMovementPathModeInput(event.target.value as 'loop' | 'pingpong')}
                  >
                    <option value="loop">Loop</option>
                    <option value="pingpong">Back and Forth</option>
                  </select>
                </label>
              )}
              <label>
                Character Idle Animation
                <input
                  value={npcCharacterIdleAnimationInput}
                  onChange={(event) => setNpcCharacterIdleAnimationInput(event.target.value)}
                  placeholder="idle"
                />
              </label>
              <label>
                Character Move Animation
                <input
                  value={npcCharacterMoveAnimationInput}
                  onChange={(event) => setNpcCharacterMoveAnimationInput(event.target.value)}
                  placeholder="walk"
                />
              </label>
            </div>
            <label>
              Dialogue Lines (one line per row)
              <textarea
                rows={5}
                className="admin-json"
                value={npcDialogueLinesInput}
                onChange={(event) => setNpcDialogueLinesInput(event.target.value)}
              />
            </label>
            {(npcMovementTypeInput === 'path' || npcMovementTypeInput === 'static-turning') && (
              <label>
                {npcMovementTypeInput === 'path'
                  ? 'Path Pattern (comma-separated: up, right, down, left)'
                  : 'Turn Pattern (comma-separated: up, right, down, left)'}
                <input
                  value={npcMovementPatternInput}
                  onChange={(event) => setNpcMovementPatternInput(event.target.value)}
                />
              </label>
            )}
            <label>
              Battle Team IDs (comma-separated, future use)
              <input
                value={npcBattleTeamsInput}
                onChange={(event) => setNpcBattleTeamsInput(event.target.value)}
              />
            </label>
            <label>
              Story States JSON (ordered by timeline)
              <textarea
                rows={7}
                className="admin-json"
                value={npcStoryStatesInput}
                onChange={(event) => setNpcStoryStatesInput(event.target.value)}
                placeholder='[{"id":"after-demo","requiresFlag":"demo-done","mapId":"portlock","position":{"x":8,"y":6},"movement":{"type":"wander","stepIntervalMs":2000,"leashRadius":3},"dialogueLines":["..."]}]'
              />
            </label>
            <label>
              Movement Guards JSON (block movement by flag/area)
              <textarea
                rows={5}
                className="admin-json"
                value={npcMovementGuardsInput}
                onChange={(event) => setNpcMovementGuardsInput(event.target.value)}
                placeholder='[{"id":"guard-north","hideIfFlag":"demo-done","maxY":0,"dialogueSpeaker":"Ben","dialogueLines":["..."]},{"id":"battle-guard","maxY":0,"defeatedFlag":"ben-defeated","postDuelDialogueSpeaker":"Ben","postDuelDialogueLines":["I lost..."]}]'
              />
            </label>
            <label>
              Interaction Cutscene JSON
              <textarea
                rows={7}
                className="admin-json"
                value={npcInteractionScriptInput}
                onChange={(event) => setNpcInteractionScriptInput(event.target.value)}
                placeholder='[{"type":"face_player"},{"type":"dialogue","speaker":"Jacob","lines":["Hey there!"]},{"type":"move_to_player"},{"type":"set_flag","flag":"met-jacob"}]'
              />
            </label>
            <div className="admin-row">
              <button type="button" className="secondary" onClick={saveNpcTemplate}>
                Save Character
              </button>
              {(isNpcsSection || isNpcCharactersSection) && (
                <button
                  type="button"
                  className="primary"
                  onClick={applyNpcEditorToSelectedMapNpc}
                  disabled={isNpcsSection ? !selectedMapNpc && !selectedCharacterInstance : !selectedCharacterInstance}
                >
                  {selectedCharacterInstance
                    ? 'Apply To Selected Character Instance'
                    : isNpcCharactersSection
                      ? 'Select An Instance To Apply'
                      : 'Apply To Selected Map NPC'}
                </button>
              )}
            </div>
            <div className="saved-paint-list">
              {npcCharacterLibrary.length === 0 && <p className="admin-note">No NPC characters saved yet.</p>}
              {npcCharacterLibrary.map((template) => (
                <div
                  key={template.id}
                  className={`saved-paint-row ${selectedNpcCharacterId === template.id ? 'is-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      loadNpcCharacterTemplateIntoEditor(template, {
                        statusMessage: `Loaded NPC character "${template.label}".`,
                      })
                    }
                  >
                    Use
                  </button>
                  <span className="saved-paint-row__meta">{template.label}</span>
                  <span className="saved-paint-row__meta">{template.npcName}</span>
                  <span className="saved-paint-row__meta">
                    {template.spriteId ?? 'No Sprite'}
                  </span>
                  <span className="saved-paint-row__meta">{template.facing ?? 'down'}</span>
                  <span className="saved-paint-row__meta">{template.movement?.type ?? 'static'}</span>
                  <span className="saved-paint-row__meta">
                    {template.idleAnimation ?? '-'} / {template.moveAnimation ?? '-'}
                  </span>
                  <button type="button" className="secondary" onClick={() => removeNpcTemplate(template.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            </>
            )}
          </section>
          )}

          {showMapEditing && !isNpcsSection && (
          <section className="admin-panel">
            <h3>NPCs JSON</h3>
            <textarea
              rows={8}
              value={npcJsonDraft}
              onChange={(event) => setNpcJsonDraft(event.target.value)}
              className="admin-json"
              placeholder={hasMapLoaded ? '' : 'Load a map to edit NPC JSON'}
            />
            <button type="button" className="secondary" onClick={applyNpcJson} disabled={!hasMapLoaded}>
              Apply NPC JSON
            </button>
          </section>
          )}

          {showMapEditing && !isNpcsSection && (
          <section className="admin-panel">
            <h3>Interactions JSON</h3>
            <textarea
              rows={8}
              value={interactionJsonDraft}
              onChange={(event) => setInteractionJsonDraft(event.target.value)}
              className="admin-json"
              placeholder={hasMapLoaded ? '' : 'Load a map to edit interactions JSON'}
            />
            <button type="button" className="secondary" onClick={applyInteractionJson} disabled={!hasMapLoaded}>
              Apply Interaction JSON
            </button>
          </section>
          )}

          {showMapEditing && !isNpcsSection && (
          <section className="admin-panel">
            <h3>Import / Export</h3>
            <div className="admin-row">
              <button
                type="button"
                className="secondary"
                onClick={() => copyExport(exportTypeScript, 'TypeScript')}
                disabled={!hasMapLoaded}
              >
                Copy TypeScript
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => downloadExport(exportTypeScript, `${editableMap.id}.ts`)}
                disabled={!hasMapLoaded}
              >
                Download .ts
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => copyExport(exportJson, 'JSON')}
                disabled={!hasMapLoaded}
              >
                Copy JSON
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => downloadExport(exportJson, `${editableMap.id}.json`)}
                disabled={!hasMapLoaded}
              >
                Download .json
              </button>
            </div>
            <label>
              TypeScript Output
              <textarea rows={10} value={exportTypeScript} readOnly className="admin-json" />
            </label>
            <label>
              JSON Output
              <textarea rows={10} value={exportJson} readOnly className="admin-json" />
            </label>
            <label>
              Import Map JSON
              <textarea
                rows={8}
                value={importJsonDraft}
                onChange={(event) => setImportJsonDraft(event.target.value)}
                className="admin-json"
              />
            </label>
            <button type="button" className="secondary" onClick={applyImportedJson}>
              Import JSON Into Editor
            </button>
          </section>
          )}
        </aside>

        {showMapEditing && (
        <main className="admin-layout__center">
          {isNpcsSection && (
          <section className="admin-panel">
            <h3>NPC Paint Tools</h3>
            <div className="admin-row">
              <button
                type="button"
                className={`secondary ${tool === 'npc-paint' ? 'is-selected' : ''}`}
                onClick={() => toggleTool('npc-paint')}
              >
                NPC Paint
              </button>
              <button
                type="button"
                className={`secondary ${tool === 'npc-erase' ? 'is-selected' : ''}`}
                onClick={() => toggleTool('npc-erase')}
              >
                NPC Erase
              </button>
              <button type="button" className="secondary" onClick={loadNpcTemplatesFromDatabase}>
                Reload NPC Catalog
              </button>
            </div>
            <div className="admin-row">
              <label>
                NPC Character
                <select value={selectedNpcCharacterId} onChange={(event) => setSelectedNpcCharacterId(event.target.value)}>
                  <option value="">Select character</option>
                  {npcCharacterLibrary.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label} ({entry.npcName})
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-inline-label">
                Zoom
                <input
                  type="range"
                  min={MIN_CELL_SIZE}
                  max={MAX_CELL_SIZE}
                  value={cellSize}
                  onChange={(event) => setCellSize(clampInt(Number(event.target.value), MIN_CELL_SIZE, MAX_CELL_SIZE))}
                />
              </label>
            </div>
            <p className="admin-note">
              Left click paints selected NPC character. Right click removes NPCs from map.
            </p>
          </section>
          )}

          {!isNpcsSection && (
          <section className="admin-panel">
            <h3>Paint Tools</h3>
            <div className="admin-tool-group">
              <h4>Selection + Tile Paint</h4>
              <div className="admin-row">
                <button
                  type="button"
                  className={`secondary ${tool === 'select' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('select')}
                >
                  Select
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'paint' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('paint')}
                >
                  Paint
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'paint-rotated' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('paint-rotated')}
                >
                  Paint Rotated
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'erase' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('erase')}
                >
                  Erase
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'fill' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('fill')}
                >
                  Fill
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'fill-rotated' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('fill-rotated')}
                >
                  Fill Rotated
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'pick' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('pick')}
                >
                  Eyedropper
                </button>
              </div>
            </div>

            <div className="admin-tool-group">
              <h4>Tile Edits</h4>
              <div className="admin-row">
                <button
                  type="button"
                  className={`secondary ${tool === 'rotate-left' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('rotate-left')}
                >
                  Rotate Left Tool
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'rotate-right' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('rotate-right')}
                >
                  Rotate Right Tool
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'mirror-horizontal' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('mirror-horizontal')}
                >
                  Mirror H Tool
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'mirror-vertical' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('mirror-vertical')}
                >
                  Mirror V Tool
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'collision-edge' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('collision-edge')}
                >
                  Collision Edges
                </button>
              </div>
            </div>

            <div className="admin-tool-group">
              <h4>Camera</h4>
              <div className="admin-row">
                <button
                  type="button"
                  className={`secondary ${tool === 'camera-preview' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('camera-preview')}
                  title="Show red viewport rectangle"
                >
                  Show camera
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'camera-point' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('camera-point')}
                  title="Click a cell to center the camera view there"
                >
                  Select Camera Point
                </button>
              </div>
            </div>

            <div className="admin-tool-group">
              <h4>Stamp Orientation</h4>
              <div className="admin-row">
                <button type="button" className="secondary" onClick={removeSelectedPaintTile} disabled={!selectedPaintTile}>
                  Remove Selected Paint Tile
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!selectedPaintTile}
                  onClick={() => {
                    setBrushRotationQuarter((current) => normalizeQuarter(current - 1));
                    setStatus('Stamp rotation adjusted left.');
                  }}
                >
                  Stamp Rotate Left
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!selectedPaintTile}
                  onClick={() => {
                    setBrushRotationQuarter((current) => normalizeQuarter(current + 1));
                    setStatus('Stamp rotation adjusted right.');
                  }}
                >
                  Stamp Rotate Right
                </button>
                <button
                  type="button"
                  className={`secondary ${brushMirrorHorizontal ? 'is-selected' : ''}`}
                  disabled={!selectedPaintTile}
                  onClick={() => {
                    setBrushMirrorHorizontal((current) => !current);
                    setStatus(brushMirrorHorizontal ? 'Stamp horizontal mirror off.' : 'Stamp horizontal mirror on.');
                  }}
                >
                  Stamp Mirror H
                </button>
                <button
                  type="button"
                  className={`secondary ${brushMirrorVertical ? 'is-selected' : ''}`}
                  disabled={!selectedPaintTile}
                  onClick={() => {
                    setBrushMirrorVertical((current) => !current);
                    setStatus(brushMirrorVertical ? 'Stamp vertical mirror off.' : 'Stamp vertical mirror on.');
                  }}
                >
                  Stamp Mirror V
                </button>
              </div>
            </div>

            <div className="admin-tool-group">
              <h4>NPC Tools</h4>
              <div className="admin-row">
                <button
                  type="button"
                  className={`secondary ${tool === 'npc-paint' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('npc-paint')}
                >
                  NPC Paint
                </button>
                <button
                  type="button"
                  className={`secondary ${tool === 'npc-erase' ? 'is-selected' : ''}`}
                  onClick={() => toggleTool('npc-erase')}
                >
                  NPC Erase
                </button>
                {isMapSection && (
                  <>
                    <button type="button" className="secondary" onClick={loadSavedPaintTilesFromDatabase}>
                      Reload Saved Tiles
                    </button>
                    <button type="button" className="secondary" onClick={loadNpcTemplatesFromDatabase}>
                      Reload NPC Catalog
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="admin-row">
              <label className="admin-inline-label">
                Zoom
                <input
                  type="range"
                  min={MIN_CELL_SIZE}
                  max={MAX_CELL_SIZE}
                  value={cellSize}
                  onChange={(event) => setCellSize(clampInt(Number(event.target.value), MIN_CELL_SIZE, MAX_CELL_SIZE))}
                />
              </label>
            </div>
            {isMapSection && (
              <div className="admin-row">
                <label>
                  NPC Character
                  <select value={selectedNpcCharacterId} onChange={(event) => setSelectedNpcCharacterId(event.target.value)}>
                    <option value="">Select character</option>
                    {npcCharacterLibrary.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label} ({entry.npcName})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {tool === 'collision-edge' && (
              <>
                <div className="admin-row">
                  <button
                    type="button"
                    className={`secondary ${collisionPaintMode === 'add' ? 'is-selected' : ''}`}
                    onClick={() => setCollisionPaintMode('add')}
                  >
                    Add Edges
                  </button>
                  <button
                    type="button"
                    className={`secondary ${collisionPaintMode === 'remove' ? 'is-selected' : ''}`}
                    onClick={() => setCollisionPaintMode('remove')}
                  >
                    Remove Edges
                  </button>
                </div>
                <div className="admin-row">
                  {(Object.keys(COLLISION_EDGE_BIT) as EdgeSide[]).map((side) => (
                    <button
                      key={side}
                      type="button"
                      className={`secondary ${collisionEdgeSelection[side] ? 'is-selected' : ''}`}
                      onClick={() =>
                        setCollisionEdgeSelection((current) => ({
                          ...current,
                          [side]: !current[side],
                        }))
                      }
                    >
                      {side[0].toUpperCase() + side.slice(1)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setCollisionEdgeSelection({
                        top: true,
                        right: false,
                        bottom: false,
                        left: false,
                      })
                    }
                  >
                    Reset Sides
                  </button>
                </div>
              </>
            )}

            <div className="paint-tile-grid">
              {savedPaintTiles.length === 0 && (
                <p className="admin-note">No saved paint tiles. Use auto mode or save from the tileset grid.</p>
              )}
              {savedPaintTiles.map((tile) => {
                return (
                  <button
                    key={tile.id}
                    type="button"
                    className={`paint-tile ${selectedPaintTileId === tile.id ? 'is-selected' : ''}`}
                    onClick={() => selectPaintTile(tile.id)}
                    title={`${tile.name} (${tile.width}x${tile.height})`}
                  >
                    <span
                      className="paint-tile__preview-grid"
                      style={{
                        gridTemplateColumns: `repeat(${tile.width}, 12px)`,
                      }}
                    >
                      {tile.cells.map((cell) => (
                        <span
                          key={`${tile.id}-${cell.dx}-${cell.dy}`}
                          className="paint-tile__preview"
                          style={atlasCellStyle(cell.atlasIndex, 12)}
                        />
                      ))}
                    </span>
                    <span className="paint-tile__name">{tile.name}</span>
                    <span className="paint-tile__meta">
                      {tile.width}x{tile.height} | {tile.cells.length} cells | {tile.ySortWithActors ? 'Y-sort' : 'Flat'}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="admin-note">
              Hover: {hoveredCell ? `${hoveredCell.x}, ${hoveredCell.y}` : '-'} | Current Tool: {tool} | Selected Tile:
              {' '}
              {selectedTileCode} | Active Layer: {activeLayer?.id ?? '-'} | Collision Mask: 0x
              {selectedCollisionEdgeMask.toString(16)} | Brush Rot: {brushRotationQuarter * 90}deg | Mirror H/V:{' '}
              {brushMirrorHorizontal ? 'Y' : 'N'}/{brushMirrorVertical ? 'Y' : 'N'} | NPC Character:{' '}
              {selectedNpcCharacter?.label ?? '-'} | Selected Cells: {selectedCellKeys.length} | Encounter Group:{' '}
              {selectedEncounterGroupId || '-'}
            </p>
          </section>
          )}

          <section className="admin-panel admin-panel--grow admin-panel--map-canvas">
            <h3>Map Canvas</h3>
            {hasMapLoaded ? (
              <div className="map-grid-wrap">
                <div className="map-grid-shell">
                  <div className="map-grid-header">
                    <span className="map-grid-corner">Y\\X</span>
                    <div
                      className="map-grid-axis map-grid-axis--x"
                      style={{
                        gridTemplateColumns: `repeat(${mapSize.width}, ${cellSize}px)`,
                      }}
                    >
                      {Array.from({ length: mapSize.width }, (_, x) => (
                        <span key={`axis-x-${x}`} className="map-grid-axis__cell">
                          {x}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="map-grid-main">
                    <div
                      className="map-grid-axis map-grid-axis--y"
                      style={{
                        gridTemplateRows: `repeat(${mapSize.height}, ${cellSize}px)`,
                      }}
                    >
                      {Array.from({ length: mapSize.height }, (_, y) => (
                        <span key={`axis-y-${y}`} className="map-grid-axis__cell">
                          {y}
                        </span>
                      ))}
                    </div>
                    <div className="map-grid-with-overlay" style={{ position: 'relative' }}>
                    <div
                      className="map-grid"
                      style={{
                        gridTemplateColumns: `repeat(${mapSize.width}, ${cellSize}px)`,
                      }}
                    >
                      {composedTiles.map((row, y) =>
                        row.split('').map((rawCode, x) => {
                          const code = rawCode;
                          const cellKey = `${x},${y}`;
                          const cellLayers = visibleLayerCellsByPosition.get(cellKey) ?? [];
                          const activeLayerCollisionMask = activeLayerCollisionMasksByPosition.get(cellKey) ?? 0;
                          const isHoveredCell = hoveredCell?.x === x && hoveredCell?.y === y;
                          const displayedCollisionMask =
                            tool === 'collision-edge' && isHoveredCell
                              ? collisionPaintMode === 'add'
                                ? (activeLayerCollisionMask | hoverCollisionEdgeMask)
                                : (activeLayerCollisionMask & ~hoverCollisionEdgeMask)
                              : activeLayerCollisionMask;
                          const warpMarker = warpMarkersByCell.get(`${x},${y}`) ?? [];
                          const encounterMarker = encounterGroupTileLookup.get(cellKey) ?? [];
                          const npcMarker = isNpcsSection
                            ? npcMarkerByCell.get(cellKey) ?? null
                            : npcByCell.get(cellKey) ?? null;
                          const selectedWarpMarker = selectedWarp
                            ? getWarpFromPositions(selectedWarp).some(
                                (position) => position.x === x && position.y === y,
                              )
                            : false;
                          const selectedWarpTarget = selectedWarp
                            ? getWarpToPositions(selectedWarp).some(
                                (position) => position.x === x && position.y === y,
                              )
                            : false;
                          const isEncounterSelected = selectedCellSet.has(cellKey);

                          return (
                            <button
                              key={`${x}-${y}`}
                              type="button"
                              className={`map-grid__cell ${selectedWarpMarker ? 'is-warp-from' : ''} ${selectedWarpTarget ? 'is-warp-to' : ''} ${hoverStampCells.has(cellKey) ? 'is-stamp-preview' : ''} ${isEncounterSelected ? 'is-selected-cell' : ''} ${encounterMarker.length > 0 ? 'is-encounter-assigned' : ''}`}
                              style={{
                                width: `${cellSize}px`,
                                height: `${cellSize}px`,
                              }}
                              onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                                if (event.button === 2) {
                                  event.preventDefault();
                                  if (isNpcsSection && npcMarker && 'source' in npcMarker && npcMarker.source === 'map') {
                                    removeMapNpcById(npcMarker.npc.id);
                                    return;
                                  }
                                  if (isNpcsSection && npcMarker && 'source' in npcMarker && npcMarker.source === 'character') {
                                    const [characterId, placementIndexText] = npcMarker.marker.key.split(':');
                                    const placementIndex = Number.parseInt(placementIndexText, 10);
                                    if (characterId && Number.isFinite(placementIndex)) {
                                      removeCharacterPlacementInstance(characterId, placementIndex);
                                    }
                                    return;
                                  }
                                  if (isNpcsSection) {
                                    return;
                                  }
                                  if (tool === 'encounter-select') {
                                    removeEncounterSelectionCell(x, y);
                                    return;
                                  }
                                  if (tool === 'npc-paint' || tool === 'npc-erase') {
                                    setEditableMap((current) => removeNpcAtPosition(current, x, y));
                                    return;
                                  }
                                  if (!activeLayer) {
                                    setError('Select an active layer before editing.');
                                    return;
                                  }
                                  if (tool === 'collision-edge') {
                                    setEditableMap((current) =>
                                      updateCollisionEdgeMask(current, activeLayer.id, x, y, 0),
                                    );
                                    return;
                                  }

                                  setEditableMap((current) => updateTile(current, activeLayer.id, x, y, BLANK_TILE_CODE, 0));
                                  return;
                                }
                                if (event.button !== 0) {
                                  return;
                                }
                                setIsDrawing(true);
                                applyPaintTool(x, y, 'click', {
                                  appendSelection: event.shiftKey || event.metaKey || event.ctrlKey,
                                });
                              }}
                              onContextMenu={(event) => event.preventDefault()}
                              onMouseEnter={() => {
                                setHoveredCell({ x, y });
                                if (isDrawing) {
                                  applyPaintTool(x, y, 'drag', { appendSelection: true });
                                }
                              }}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              <span className="map-grid__tile-stack">
                                {cellLayers.length > 0 ? (
                                  cellLayers.map((entry, index) => (
                                    <span
                                      key={`${cellKey}-${entry.layerId}-${index}`}
                                      className={`map-grid__tile-layer ${activeLayer?.id === entry.layerId ? 'is-active-layer' : ''}`}
                                      style={tileCellStyle(entry.code, cellSize, entry.rotation)}
                                    />
                                  ))
                                ) : (
                                  <span className="map-grid__tile-layer is-empty" style={tileCellStyle(code, cellSize, 0)} />
                                )}
                              </span>
                              {(displayedCollisionMask & COLLISION_EDGE_BIT.top) !== 0 && (
                                <span className="map-grid__collision-edge is-top" />
                              )}
                              {(displayedCollisionMask & COLLISION_EDGE_BIT.right) !== 0 && (
                                <span className="map-grid__collision-edge is-right" />
                              )}
                              {(displayedCollisionMask & COLLISION_EDGE_BIT.bottom) !== 0 && (
                                <span className="map-grid__collision-edge is-bottom" />
                              )}
                              {(displayedCollisionMask & COLLISION_EDGE_BIT.left) !== 0 && (
                                <span className="map-grid__collision-edge is-left" />
                              )}
                              {npcMarker &&
                                (() => {
                                  const isCharacterMarker =
                                    isNpcsSection &&
                                    typeof npcMarker === 'object' &&
                                    npcMarker !== null &&
                                    'source' in npcMarker &&
                                    npcMarker.source === 'character';
                                  const isMapMarker =
                                    isNpcsSection &&
                                    typeof npcMarker === 'object' &&
                                    npcMarker !== null &&
                                    'source' in npcMarker &&
                                    npcMarker.source === 'map';
                                  const markerName = isCharacterMarker
                                    ? npcMarker.marker.name
                                    : isMapMarker
                                      ? npcMarker.npc.name
                                      : (npcMarker as NpcDefinition).name;
                                  const markerColor = isCharacterMarker
                                    ? npcMarker.marker.color
                                    : isMapMarker
                                      ? npcMarker.npc.color
                                      : (npcMarker as NpcDefinition).color;
                                  const markerTitle = isCharacterMarker
                                    ? `${npcMarker.marker.name} (instance #${npcMarker.marker.order})${
                                        npcMarker.marker.requiresFlag
                                          ? ` - hidden until "${npcMarker.marker.requiresFlag}" unlocks`
                                          : ''
                                      }`
                                    : markerName;
                                  const markerLocked = isCharacterMarker && Boolean(npcMarker.marker.requiresFlag);
                                  return (
                                    <span
                                      className={`map-grid__npc-badge ${markerLocked ? 'is-flag-locked' : ''}`}
                                      style={{ backgroundColor: markerColor || '#9b73b8' }}
                                      title={markerTitle}
                                    >
                                      {formatNpcMarkerLabel(markerName)}
                                    </span>
                                  );
                                })()}
                              {warpMarker.length > 0 && <span className="map-grid__warp-badge">W{warpMarker.length}</span>}
                              {encounterMarker.length > 0 && (
                                <span className="map-grid__encounter-badge">E{encounterMarker.length}</span>
                              )}
                              {hoverStampCells.has(cellKey) && <span className="map-grid__stamp-shadow" />}
                            </button>
                          );
                        }),
                      )}
                    </div>
                    {(tool === 'camera-preview' || tool === 'camera-point') && (() => {
                      const cam = editableMap.cameraSize ?? { widthTiles: 19, heightTiles: 15 };
                      const cx = editableMap.cameraPoint != null
                        ? editableMap.cameraPoint.x + 0.5
                        : mapSize.width / 2;
                      const cy = editableMap.cameraPoint != null
                        ? editableMap.cameraPoint.y + 0.5
                        : mapSize.height / 2;
                      // Clamp so the camera box stays within map bounds (same as in-game: pushes against edges).
                      const boxLeftTiles = Math.max(
                        0,
                        Math.min(mapSize.width - cam.widthTiles, cx - cam.widthTiles / 2),
                      );
                      const boxTopTiles = Math.max(
                        0,
                        Math.min(mapSize.height - cam.heightTiles, cy - cam.heightTiles / 2),
                      );
                      const left = boxLeftTiles * cellSize;
                      const top = boxTopTiles * cellSize;
                      const w = cam.widthTiles * cellSize;
                      const h = cam.heightTiles * cellSize;
                      return (
                        <div
                          className="map-camera-overlay"
                          style={{
                            position: 'absolute',
                            left,
                            top,
                            width: w,
                            height: h,
                            border: '4px solid #2563eb',
                            boxSizing: 'border-box',
                            pointerEvents: 'none',
                          }}
                          aria-hidden
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
            ) : (
              <div className="tileset-grid__empty">No map loaded yet. Create, load, or import a map first.</div>
            )}

            {hasMapLoaded && mapWarnings.length > 0 && (
              <div className="admin-warning-box">
                <h4>Validation Warnings</h4>
                <ul>
                  {mapWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {isNpcsSection && (
          <section className="admin-panel">
            <h3>Map NPCs</h3>
            <p className="admin-note">
              Right-click an NPC on the map to remove it, or use these cards to edit/remove by instance.
            </p>
            <div className="saved-paint-list">
              {mapNpcCards.length === 0 && <p className="admin-note">No NPCs placed on this map.</p>}
              {mapNpcCards.map((npc) => (
                <div
                  key={`map-npc-card-${npc.id}`}
                  className={`saved-paint-row ${
                    (npc.type === 'map-npc' && selectedMapNpcId === npc.id) ||
                    (npc.type === 'character-instance' && selectedCharacterInstanceKey === npc.id)
                      ? 'is-selected'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      npc.type === 'map-npc'
                        ? (() => {
                            const match = editableMap.npcs.find((entry) => entry.id === npc.id);
                            if (match) {
                              editMapNpc(match);
                            }
                          })()
                        : loadCharacterPlacementIntoEditor(
                            npc.characterId,
                            Number.parseInt(npc.id.split(':')[1] ?? '0', 10),
                          )
                    }
                  >
                    Edit
                  </button>
                  <span className="saved-paint-row__meta">{npc.name}</span>
                  <span className="saved-paint-row__meta">{npc.id}</span>
                  <span className="saved-paint-row__meta">
                    ({npc.position.x}, {npc.position.y})
                  </span>
                  <span className="saved-paint-row__meta">{npc.movementType ?? 'static'}</span>
                  <span className="saved-paint-row__meta">{npc.facing ?? 'down'}</span>
                  {npc.type === 'character-instance' && (
                    <span className="saved-paint-row__meta">
                      #{npc.order}{npc.requiresFlag ? ` requires "${npc.requiresFlag}"` : ' always'}
                    </span>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      if (npc.type === 'map-npc') {
                        removeMapNpcById(npc.id);
                        return;
                      }
                      removeCharacterPlacementInstance(npc.characterId, Number.parseInt(npc.id.split(':')[1] ?? '0', 10));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
          )}

          {isNpcsSection && selectedCharacterForInstanceList && (
          <section className="admin-panel">
            <h3>{selectedCharacterForInstanceList.npcName} Instances</h3>
            <p className="admin-note">
              One character, ordered timeline. Highest order wins in gameplay when its flag requirement is met.
            </p>
            <div className="admin-row">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const fallbackMapId =
                    editableMap.id ||
                    selectedCharacterInstances[selectedCharacterInstances.length - 1]?.mapId ||
                    sourceMapIds[0] ||
                    '';
                  if (!fallbackMapId) {
                    setError('Load maps before adding an NPC instance so a map target can be assigned.');
                    return;
                  }
                  addCharacterPlacementInstance(selectedCharacterForInstanceList.id, fallbackMapId, { x: 0, y: 0 });
                }}
              >
                Add Instance
              </button>
              <span className="admin-note">
                Every instance stores its own map, position, movement, dialogue, battle team, and flag requirement.
              </span>
            </div>
            <div className="npc-instance-list">
              {selectedCharacterInstances.length === 0 && (
                <p className="admin-note">No instances yet. Add one to place this character in the story timeline.</p>
              )}
              {selectedCharacterInstances.map((placement, index, list) => {
                const placementMovementType = toEditorNpcMovementType(placement.movement?.type);
                const cardKey = `${selectedCharacterForInstanceList.id}:${index}`;
                return (
                  <article
                    key={`character-instance-row-${selectedCharacterForInstanceList.id}-${index}`}
                    className={`npc-instance-card ${selectedCharacterInstanceKey === cardKey ? 'is-selected' : ''}`}
                  >
                    <div className="npc-instance-card__header">
                      <h4>Instance #{index + 1}</h4>
                      <div className="admin-row">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => loadCharacterPlacementIntoEditor(selectedCharacterForInstanceList.id, index)}
                        >
                          Edit In Main Form
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => moveCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, 'up')}
                          disabled={index <= 0}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => moveCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, 'down')}
                          disabled={index >= list.length - 1}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => removeCharacterPlacementInstance(selectedCharacterForInstanceList.id, index)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="admin-grid-2">
                      <label>
                        Map ID
                        <select
                          value={placement.mapId ?? ''}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              mapId: event.target.value,
                            }))
                          }
                        >
                          <option value="">(Select map)</option>
                          {sourceMapIds.map((mapId) => (
                            <option key={mapId} value={mapId}>
                              {mapId}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Requires Flag
                        <input
                          list="admin-flag-options"
                          value={placement.requiresFlag ?? ''}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              requiresFlag: event.target.value.trim() || undefined,
                            }))
                          }
                          placeholder="(none)"
                        />
                      </label>
                      <label>
                        Position X
                        <input
                          type="number"
                          value={String(placement.position?.x ?? 0)}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              position: {
                                x: Number.parseInt(event.target.value, 10) || 0,
                                y: entry.position?.y ?? 0,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Position Y
                        <input
                          type="number"
                          value={String(placement.position?.y ?? 0)}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              position: {
                                x: entry.position?.x ?? 0,
                                y: Number.parseInt(event.target.value, 10) || 0,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Facing
                        <select
                          value={placement.facing ?? selectedCharacterForInstanceList.facing ?? 'down'}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              facing: event.target.value as Direction,
                            }))
                          }
                        >
                          <option value="down">Down</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                          <option value="up">Up</option>
                        </select>
                      </label>
                      <label>
                        Movement Type
                        <select
                          value={placementMovementType}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              movement: buildPlacementMovement(
                                entry.movement,
                                event.target.value as EditorNpcMovementType,
                              ),
                            }))
                          }
                        >
                          <option value="static">Static</option>
                          <option value="static-turning">Static Turning</option>
                          <option value="wander">Wander</option>
                          <option value="path">Path</option>
                        </select>
                      </label>
                      {placementMovementType !== 'static' && (
                        <label>
                          Step Interval (ms)
                          <input
                            type="number"
                            value={String(placement.movement?.stepIntervalMs ?? 850)}
                            onChange={(event) =>
                              updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => {
                                const parsed = parseInteger(event.target.value);
                                return {
                                  ...entry,
                                  movement: buildPlacementMovement(
                                    entry.movement,
                                    toEditorNpcMovementType(entry.movement?.type),
                                    { stepIntervalMs: parsed ?? 850 },
                                  ),
                                };
                              })
                            }
                          />
                        </label>
                      )}
                      {(placementMovementType === 'path' || placementMovementType === 'static-turning') && (
                        <label>
                          {placementMovementType === 'path' ? 'Path Pattern' : 'Turn Pattern'}
                          <input
                            value={(placement.movement?.pattern ?? []).join(', ')}
                            onChange={(event) =>
                              updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                                ...entry,
                                movement: buildPlacementMovement(
                                  entry.movement,
                                  toEditorNpcMovementType(entry.movement?.type),
                                  {
                                    pattern: parseDirectionPattern(event.target.value),
                                  },
                                ),
                              }))
                            }
                            placeholder="up, right, down, left"
                          />
                        </label>
                      )}
                      {placementMovementType === 'path' && (
                        <label>
                          Path Mode
                          <select
                            value={placement.movement?.pathMode === 'pingpong' ? 'pingpong' : 'loop'}
                            onChange={(event) =>
                              updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                                ...entry,
                                movement: buildPlacementMovement(
                                  entry.movement,
                                  toEditorNpcMovementType(entry.movement?.type),
                                  { pathMode: event.target.value === 'pingpong' ? 'pingpong' : 'loop' },
                                ),
                              }))
                            }
                          >
                            <option value="loop">Loop</option>
                            <option value="pingpong">Back and Forth</option>
                          </select>
                        </label>
                      )}
                      {placementMovementType === 'wander' && (
                        <label>
                          Wander Leash Radius
                          <input
                            type="number"
                            value={
                              typeof placement.movement?.leashRadius === 'number'
                                ? String(placement.movement.leashRadius)
                                : ''
                            }
                            onChange={(event) =>
                              updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => {
                                const parsed = parseInteger(event.target.value);
                                return {
                                  ...entry,
                                  movement: buildPlacementMovement(
                                    entry.movement,
                                    toEditorNpcMovementType(entry.movement?.type),
                                    { leashRadius: parsed ?? undefined },
                                  ),
                                };
                              })
                            }
                            placeholder="optional"
                          />
                        </label>
                      )}
                      <label>
                        Battle Team IDs
                        <input
                          value={(placement.battleTeamIds ?? []).join(', ')}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              battleTeamIds: parseStringList(event.target.value),
                            }))
                          }
                          placeholder="moolnir@1, buddo@3"
                        />
                      </label>
                      <label>
                        Dialogue ID
                        <input
                          value={placement.dialogueId ?? selectedCharacterForInstanceList.dialogueId ?? 'custom_npc_dialogue'}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              dialogueId: sanitizeIdentifier(event.target.value, 'custom_npc_dialogue'),
                            }))
                          }
                        />
                      </label>
                      <label>
                        Dialogue Speaker
                        <input
                          value={placement.dialogueSpeaker ?? ''}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              dialogueSpeaker: event.target.value.trim() || undefined,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Set Flag On Dialogue Complete
                        <input
                          list="admin-flag-options"
                          value={placement.dialogueSetFlag ?? ''}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              dialogueSetFlag: event.target.value.trim() || undefined,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Set Flag On First Interaction
                        <input
                          list="admin-flag-options"
                          value={placement.firstInteractionSetFlag ?? ''}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              firstInteractionSetFlag: event.target.value.trim() || undefined,
                            }))
                          }
                          placeholder="optional"
                        />
                      </label>
                      <label>
                        First Interact Battle?
                        <input
                          type="checkbox"
                          checked={Boolean(placement.firstInteractBattle)}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              firstInteractBattle: event.target.checked,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Healer?
                        <input
                          type="checkbox"
                          checked={Boolean(placement.healer)}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              healer: event.target.checked,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Idle Animation
                        <input
                          value={placement.idleAnimation ?? ''}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              idleAnimation: event.target.value.trim() || undefined,
                            }))
                          }
                          placeholder="idle"
                        />
                      </label>
                      <label>
                        Move Animation
                        <input
                          value={placement.moveAnimation ?? ''}
                          onChange={(event) =>
                            updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                              ...entry,
                              moveAnimation: event.target.value.trim() || undefined,
                            }))
                          }
                          placeholder="walk"
                        />
                      </label>
                    </div>
                    <label>
                      Dialogue Lines (one line per row)
                      <textarea
                        rows={3}
                        className="admin-json"
                        value={(placement.dialogueLines ?? []).join('\n')}
                        onChange={(event) =>
                          updateCharacterPlacementInstance(selectedCharacterForInstanceList.id, index, (entry) => ({
                            ...entry,
                            dialogueLines: event.target.value
                              .split('\n')
                              .map((line) => line.trim())
                              .filter((line) => line.length > 0),
                          }))
                        }
                      />
                    </label>
                  </article>
                );
              })}
            </div>
          </section>
          )}

          <section className="admin-panel">
            <h3>Save To Project</h3>
            <p className="admin-note">
              {loadedSourceMapIdForSave
                ? `Saving edits directly back to loaded map source: ${loadedSourceMapIdForSave}.`
                : 'This map will be saved as a map file derived from current map id.'}
            </p>
            <button
              type="button"
              className="primary"
              onClick={saveMapToProjectFile}
              disabled={!hasMapLoaded || isSavingMapFile}
            >
              {isSavingMapFile ? 'Saving...' : 'Save Map File + Tile IDs'}
            </button>
          </section>
        </main>
        )}
      </div>
    </section>
  );
}

function placeNpcFromTemplate(
  map: EditableMap,
  x: number,
  y: number,
  template: NpcCharacterTemplateEntry,
  resolvedSprite?: NpcSpriteConfig,
): EditableMap {
  const next = cloneEditableMap(map);
  const existingIndex = next.npcs.findIndex((npc) => npc.position.x === x && npc.position.y === y);

  const nextNpc: NpcDefinition = {
    id:
      existingIndex >= 0
        ? next.npcs[existingIndex].id
        : makeNpcInstanceId(template.label || template.npcName, next.npcs),
    name: template.npcName,
    position: { x, y },
    facing: template.facing,
    color: template.color || '#9b73b8',
    dialogueId: template.dialogueId || 'custom_npc_dialogue',
    dialogueSpeaker: template.dialogueSpeaker,
    dialogueLines: template.dialogueLines ? [...template.dialogueLines] : undefined,
    dialogueSetFlag: template.dialogueSetFlag,
    firstInteractionSetFlag: template.firstInteractionSetFlag,
    firstInteractBattle: template.firstInteractBattle,
    healer: template.healer,
    battleTeamIds: template.battleTeamIds ? [...template.battleTeamIds] : undefined,
    movement: template.movement
      ? {
          ...template.movement,
          pattern: template.movement.pattern ? [...template.movement.pattern] : undefined,
        }
      : undefined,
    storyStates: template.storyStates
      ? template.storyStates.map((state) => ({
          ...state,
          position: state.position ? { ...state.position } : undefined,
          dialogueLines: state.dialogueLines ? [...state.dialogueLines] : undefined,
          battleTeamIds: state.battleTeamIds ? [...state.battleTeamIds] : undefined,
          movement: state.movement
            ? {
                ...state.movement,
                pattern: state.movement.pattern ? [...state.movement.pattern] : undefined,
              }
            : undefined,
          movementGuards: state.movementGuards
            ? state.movementGuards.map((guard) => ({
                ...guard,
                dialogueLines: guard.dialogueLines ? [...guard.dialogueLines] : undefined,
              }))
            : undefined,
          interactionScript: state.interactionScript ? state.interactionScript.map((step) => ({ ...step })) : undefined,
        }))
      : undefined,
    movementGuards: template.movementGuards
      ? template.movementGuards.map((guard) => ({
          ...guard,
          dialogueLines: guard.dialogueLines ? [...guard.dialogueLines] : undefined,
        }))
      : undefined,
    interactionScript: template.interactionScript ? template.interactionScript.map((step) => ({ ...step })) : undefined,
    idleAnimation: template.idleAnimation,
    moveAnimation: template.moveAnimation,
    sprite: resolvedSprite
      ? {
          ...resolvedSprite,
          url:
            typeof template.cacheVersion === 'number' && Number.isFinite(template.cacheVersion)
              ? withCacheBusterTagValue(resolvedSprite.url, template.cacheVersion)
              : resolvedSprite.url,
          animationSets: resolvedSprite.animationSets
            ? Object.fromEntries(
                Object.entries(resolvedSprite.animationSets).map(([name, directions]) => [
                  name,
                  {
                    up: directions?.up ? [...directions.up] : undefined,
                    down: directions?.down ? [...directions.down] : undefined,
                    left: directions?.left ? [...directions.left] : undefined,
                    right: directions?.right ? [...directions.right] : undefined,
                  },
                ]),
              )
            : undefined,
          defaultIdleAnimation: resolvedSprite.defaultIdleAnimation,
          defaultMoveAnimation: resolvedSprite.defaultMoveAnimation,
          facingFrames: { ...resolvedSprite.facingFrames },
          walkFrames: resolvedSprite.walkFrames
            ? {
                up: resolvedSprite.walkFrames.up ? [...resolvedSprite.walkFrames.up] : undefined,
                down: resolvedSprite.walkFrames.down ? [...resolvedSprite.walkFrames.down] : undefined,
                left: resolvedSprite.walkFrames.left ? [...resolvedSprite.walkFrames.left] : undefined,
                right: resolvedSprite.walkFrames.right ? [...resolvedSprite.walkFrames.right] : undefined,
              }
            : undefined,
        }
      : undefined,
  };

  if (existingIndex >= 0) {
    next.npcs[existingIndex] = nextNpc;
  } else {
    next.npcs.push(nextNpc);
  }
  return next;
}

function removeNpcAtPosition(map: EditableMap, x: number, y: number): EditableMap {
  const next = cloneEditableMap(map);
  const filtered = next.npcs.filter((npc) => npc.position.x !== x || npc.position.y !== y);
  if (filtered.length === next.npcs.length) {
    return map;
  }
  next.npcs = filtered;
  return next;
}

function createAutoPaintTiles(maxAtlasIndex: number): SavedPaintTile[] {
  const maxIndex = Number.isFinite(maxAtlasIndex) ? Math.max(0, maxAtlasIndex) : Number.MAX_SAFE_INTEGER;

  return TILE_CODES.map((code) => ({
    id: `auto-${code}`,
    name: `${code} ${TILE_DEFINITIONS[code].label}`,
    primaryCode: code,
    width: 1,
    height: 1,
    ySortWithActors: inferTileYSortWithActors(TILE_DEFINITIONS[code].label, 1, 1),
    cells: [
      {
        code,
        atlasIndex: clampInt(DEFAULT_TILESET_INDEX[code], 0, maxIndex),
        dx: 0,
        dy: 0,
      },
    ],
  }));
}

function makeSavedPaintTileId(baseName: string, existing: SavedPaintTile[]): string {
  const safeBase = baseName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const base = safeBase.length > 0 ? safeBase : 'paint-tile';

  let suffix = 1;
  while (suffix < 5000) {
    const candidate = `${base}-${suffix}`;
    if (!existing.some((tile) => tile.id === candidate)) {
      return candidate;
    }
    suffix += 1;
  }

  return `${base}-${Date.now()}`;
}

function findMostRecentPaintTileForCode(tiles: SavedPaintTile[], code: EditorTileCode): SavedPaintTile | null {
  for (let index = tiles.length - 1; index >= 0; index -= 1) {
    if (tiles[index].cells.some((cell) => cell.code === code)) {
      return tiles[index];
    }
  }

  return null;
}

function generateNextTileCode(usedCodes: Set<string>): string | null {
  for (const [start, end] of TILE_CODE_GENERATION_RANGES) {
    for (let codePoint = start; codePoint <= end; codePoint += 1) {
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
        continue;
      }

      const candidate = String.fromCharCode(codePoint);
      if (!usedCodes.has(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function sanitizeIdentifier(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
}

function makeUniqueWarpId(existing: WarpDefinition[], mapId: string): string {
  const safeMapId = mapId.replace(/[^a-z0-9]/gi, '_');
  let index = existing.length + 1;

  while (index < 5000) {
    const candidate = `${safeMapId}_warp_${index}`;
    if (!existing.some((warp) => warp.id === candidate)) {
      return candidate;
    }
    index += 1;
  }

  return `${safeMapId}_warp_${Date.now()}`;
}

function makeUniqueLayerId(existing: EditableMapLayer[], currentId: string, nextOrderId: number): string {
  const safeCurrent = parseLayerOrderId(currentId) ?? 1;
  const safeOrder = Math.max(1, Math.floor(nextOrderId));
  if (safeCurrent === safeOrder) {
    return String(safeCurrent);
  }

  const usedIds = new Set<number>();
  for (const layer of existing) {
    if (layer.id === currentId) {
      continue;
    }
    const parsed = parseLayerOrderId(layer.id);
    if (parsed) {
      usedIds.add(parsed);
    }
  }

  let candidate = safeOrder;
  while (usedIds.has(candidate)) {
    candidate += 1;
  }
  return String(candidate);
}

function nextLayerId(existing: EditableMapLayer[]): string {
  let maxId = 0;
  for (const layer of existing) {
    const parsed = parseLayerOrderId(layer.id);
    if (parsed && parsed > maxId) {
      maxId = parsed;
    }
  }
  return String(maxId + 1);
}

function pseudoRandomQuarter(x: number, y: number): number {
  const hash = (x * 73856093) ^ (y * 19349663);
  return Math.abs(hash) % 4;
}

function normalizeQuarter(value: number): number {
  return ((value % 4) + 4) % 4;
}

function inferTileYSortWithActors(name: string, width: number, height: number): boolean {
  if (width > 1 || height > 1) {
    return true;
  }

  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) {
    return true;
  }

  const flatKeywords = ['grass', 'flower', 'path', 'sand', 'water', 'floor', 'ground'];
  if (flatKeywords.some((keyword) => normalizedName.includes(keyword))) {
    return false;
  }

  const overheadKeywords = [
    'tree',
    'bush',
    'house',
    'roof',
    'wall',
    'building',
    'cliff',
    'rock',
    'fence',
    'gate',
    'pillar',
    'tower',
    'arch',
    'sign',
    'door',
  ];
  if (overheadKeywords.some((keyword) => normalizedName.includes(keyword))) {
    return true;
  }

  return true;
}

function transformStampCells(
  tile: SavedPaintTile,
  rotationQuarter: number,
  mirrorHorizontal: boolean,
  mirrorVertical: boolean,
): Array<{ code: EditorTileCode; dx: number; dy: number; rotationQuarter: number }> {
  const quarter = normalizeQuarter(rotationQuarter);

  return tile.cells.map((cell) => {
    const mirroredX = mirrorHorizontal ? tile.width - 1 - cell.dx : cell.dx;
    const mirroredY = mirrorVertical ? tile.height - 1 - cell.dy : cell.dy;

    switch (quarter) {
      case 1:
        return {
          code: cell.code,
          dx: tile.height - 1 - mirroredY,
          dy: mirroredX,
          rotationQuarter: 1,
        };
      case 2:
        return {
          code: cell.code,
          dx: tile.width - 1 - mirroredX,
          dy: tile.height - 1 - mirroredY,
          rotationQuarter: 2,
        };
      case 3:
        return {
          code: cell.code,
          dx: mirroredY,
          dy: tile.width - 1 - mirroredX,
          rotationQuarter: 3,
        };
      default:
        return {
          code: cell.code,
          dx: mirroredX,
          dy: mirroredY,
          rotationQuarter: 0,
        };
    }
  });
}

function getWarpFromPositions(warp: WarpDefinition): Vector2[] {
  if (Array.isArray(warp.fromPositions) && warp.fromPositions.length > 0) {
    return warp.fromPositions.map((position) => ({ ...position }));
  }
  return [{ ...warp.from }];
}

function getWarpToPositions(warp: WarpDefinition): Vector2[] {
  if (Array.isArray(warp.toPositions) && warp.toPositions.length > 0) {
    return warp.toPositions.map((position) => ({ ...position }));
  }
  return [{ ...warp.to }];
}

function formatCoordinateAxisList(values: number[]): string {
  return values.join(', ');
}

function parseCommaSeparatedIntegers(raw: string): number[] | null {
  const tokens = raw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return null;
  }

  const parsed: number[] = [];
  for (const token of tokens) {
    if (!/^-?\d+$/.test(token)) {
      return null;
    }
    parsed.push(Number.parseInt(token, 10));
  }
  return parsed;
}

function buildWarpPositionsFromAxisLists(xs: number[], ys: number[], prefix: string): Vector2[] | null {
  if (xs.length === 0 || ys.length === 0) {
    return null;
  }
  if (xs.length === ys.length) {
    return xs.map((x, index) => ({ x, y: ys[index] }));
  }
  if (xs.length === 1) {
    return ys.map((y) => ({ x: xs[0], y }));
  }
  if (ys.length === 1) {
    return xs.map((x) => ({ x, y: ys[0] }));
  }
  console.warn(`${prefix} warp coordinate list mismatch`, { xs, ys });
  return null;
}

function coordinateForEdge(side: EdgeSide, offset: number, width: number, height: number): Vector2 {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);

  switch (side) {
    case 'top':
      return {
        x: clampInt(offset, 0, safeWidth - 1),
        y: 0,
      };
    case 'bottom':
      return {
        x: clampInt(offset, 0, safeWidth - 1),
        y: safeHeight - 1,
      };
    case 'left':
      return {
        x: 0,
        y: clampInt(offset, 0, safeHeight - 1),
      };
    case 'right':
      return {
        x: safeWidth - 1,
        y: clampInt(offset, 0, safeHeight - 1),
      };
    default:
      return { x: 0, y: 0 };
  }
}

function parseCellKey(raw: string): Vector2 | null {
  const [xRaw, yRaw] = raw.split(',');
  if (xRaw === undefined || yRaw === undefined) {
    return null;
  }
  const x = Number.parseInt(xRaw, 10);
  const y = Number.parseInt(yRaw, 10);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return {
    x: Math.floor(x),
    y: Math.floor(y),
  };
}

function suggestEncounterGroupId(groups: MapEncounterGroupDefinition[]): string {
  const used = new Set(groups.map((group) => group.id));
  let index = groups.length + 1;
  let candidate = `encounter-group-${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `encounter-group-${index}`;
  }
  return candidate;
}

function clampEncounterFrequency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * 1000) / 1000;
}

function buildWarnings(map: EditableMap, savedCustomTileCodes: Set<string>, knownSourceMapIds: string[]): string[] {
  const warnings: string[] = [];
  const { width, height } = getMapSize(map);
  const unknownTileCodes = new Set<string>();

  if (map.layers.length === 0) {
    warnings.push('Map has no layers.');
    return warnings;
  }

  const usedLayerIds = new Set<number>();
  for (const layer of map.layers) {
    const parsedLayerId = parseLayerOrderId(layer.id);
    if (!parsedLayerId) {
      warnings.push(`Layer "${layer.id}" has invalid numeric id. Use integers >= 1.`);
    } else if (usedLayerIds.has(parsedLayerId)) {
      warnings.push(`Duplicate layer id ${parsedLayerId} detected.`);
    } else {
      usedLayerIds.add(parsedLayerId);
    }
    if (layer.tiles.length !== height) {
      warnings.push(`Layer ${layer.id} height mismatch (${layer.tiles.length} vs ${height}).`);
    }
    if (layer.rotations.length !== height) {
      warnings.push(`Layer ${layer.id} rotation height mismatch (${layer.rotations.length} vs ${height}).`);
    }
    if (layer.collisionEdges.length !== height) {
      warnings.push(
        `Layer ${layer.id} collision edge height mismatch (${layer.collisionEdges.length} vs ${height}).`,
      );
    }

    for (let y = 0; y < layer.tiles.length; y += 1) {
      const row = layer.tiles[y] ?? '';
      const rotationRow = layer.rotations[y] ?? '';
      const collisionRow = layer.collisionEdges[y] ?? '';
      if (row.length !== width) {
        warnings.push(`Layer ${layer.id} row ${y} width mismatch (${row.length} vs ${width}).`);
      }
      if (rotationRow.length !== row.length) {
        warnings.push(
          `Layer ${layer.id} row ${y} rotation width mismatch (${rotationRow.length} vs ${row.length}).`,
        );
      }
      if (collisionRow.length !== row.length) {
        warnings.push(
          `Layer ${layer.id} row ${y} collision edge width mismatch (${collisionRow.length} vs ${row.length}).`,
        );
      }

      for (const code of row) {
        if (!isKnownTileCode(code) && !savedCustomTileCodes.has(code)) {
          unknownTileCodes.add(code);
        }
      }

      for (const collisionChar of collisionRow) {
        const collisionValue = Number.parseInt(collisionChar, 16);
        if (!Number.isFinite(collisionValue) || collisionValue < 0 || collisionValue > 15) {
          warnings.push(
            `Layer ${layer.id} row ${y} has invalid collision edge value "${collisionChar}" (must be hex 0-f).`,
          );
          break;
        }
      }
    }
  }

  if (unknownTileCodes.size > 0) {
    const list = Array.from(unknownTileCodes).sort().join(', ');
    warnings.push(
      `Custom tile code(s) ${list} are not currently in runtime tile definitions. Save map file + tile IDs to sync them to the game runtime.`,
    );
  }

  for (const npc of map.npcs) {
    if (!isInsideBounds(npc.position.x, npc.position.y, width, height)) {
      warnings.push(`NPC ${npc.id} is out of bounds at (${npc.position.x}, ${npc.position.y}).`);
    }
    const movementType = npc.movement?.type;
    const movementPattern = npc.movement?.pattern;
    if (
      (movementType === 'path' || movementType === 'loop' || movementType === 'static-turning') &&
      (!movementPattern || movementPattern.length === 0)
    ) {
      warnings.push(`NPC ${npc.id} has ${movementType} movement but no pattern directions.`);
    }
    if (npc.sprite && (!npc.sprite.url || npc.sprite.frameWidth <= 0 || npc.sprite.frameHeight <= 0)) {
      warnings.push(`NPC ${npc.id} has incomplete sprite sheet settings.`);
    }
  }

  for (const interaction of map.interactions) {
    if (!isInsideBounds(interaction.position.x, interaction.position.y, width, height)) {
      warnings.push(
        `Interaction ${interaction.id} is out of bounds at (${interaction.position.x}, ${interaction.position.y}).`,
      );
    }
  }

  for (const warp of map.warps) {
    for (const from of getWarpFromPositions(warp)) {
      if (!isInsideBounds(from.x, from.y, width, height)) {
        warnings.push(`Warp ${warp.id} "from" is out of bounds at (${from.x}, ${from.y}).`);
      }
    }

    if (warp.toMapId === map.id) {
      for (const target of getWarpToPositions(warp)) {
        if (!isInsideBounds(target.x, target.y, width, height)) {
          warnings.push(`Warp ${warp.id} targets this map out of bounds at (${target.x}, ${target.y}).`);
        }
      }
    }
  }

  const knownMapIds = new Set(knownSourceMapIds);
  for (const warp of map.warps) {
    if (!knownMapIds.has(warp.toMapId) && warp.toMapId !== map.id) {
      warnings.push(`Warp ${warp.id} targets unknown map id "${warp.toMapId}".`);
    }
  }

  for (const encounterGroup of map.encounterGroups) {
    if (!encounterGroup.id.trim()) {
      warnings.push('Encounter group with empty id detected.');
    }
    if (encounterGroup.tilePositions.length === 0) {
      warnings.push(`Encounter group ${encounterGroup.id} has no tile positions.`);
    }
    if (encounterGroup.walkFrequency < 0 || encounterGroup.walkFrequency > 1) {
      warnings.push(`Encounter group ${encounterGroup.id} walkFrequency must be between 0 and 1.`);
    }
    if (encounterGroup.fishFrequency < 0 || encounterGroup.fishFrequency > 1) {
      warnings.push(`Encounter group ${encounterGroup.id} fishFrequency must be between 0 and 1.`);
    }
    for (const position of encounterGroup.tilePositions) {
      if (!isInsideBounds(position.x, position.y, width, height)) {
        warnings.push(`Encounter group ${encounterGroup.id} tile is out of bounds at (${position.x}, ${position.y}).`);
      }
    }
  }

  return warnings;
}

function isInsideBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

function parseInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && result.startsWith('data:')) {
        resolve(result);
        return;
      }
      reject(new Error('Invalid file data URL.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

function buildAtlasSelectionRect(
  startIndex: number | null,
  endIndex: number | null,
  columns: number,
  rows: number,
): AtlasSelectionRect | null {
  if (startIndex === null || endIndex === null || columns <= 0 || rows <= 0) {
    return null;
  }

  const maxIndex = columns * rows - 1;
  const safeStart = clampInt(startIndex, 0, maxIndex);
  const safeEnd = clampInt(endIndex, 0, maxIndex);

  const startCol = safeStart % columns;
  const startRow = Math.floor(safeStart / columns);
  const endCol = safeEnd % columns;
  const endRow = Math.floor(safeEnd / columns);

  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);

  return {
    minCol,
    maxCol,
    minRow,
    maxRow,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
  };
}

function isAtlasCellInRect(rect: AtlasSelectionRect | null, atlasIndex: number, columns: number): boolean {
  if (!rect || columns <= 0) {
    return false;
  }

  const col = atlasIndex % columns;
  const row = Math.floor(atlasIndex / columns);
  return col >= rect.minCol && col <= rect.maxCol && row >= rect.minRow && row <= rect.maxRow;
}

function sanitizeSavedPaintTiles(raw: unknown): SavedPaintTile[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const sanitized: SavedPaintTile[] = [];
  for (const entry of raw) {
    const tile = sanitizeSavedPaintTile(entry);
    if (tile) {
      sanitized.push(tile);
    }
  }

  return sanitized;
}

function sanitizeSavedPaintTile(raw: unknown): SavedPaintTile | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as {
    id?: unknown;
    name?: unknown;
    primaryCode?: unknown;
    width?: unknown;
    height?: unknown;
    ySortWithActors?: unknown;
    cells?: unknown;
    code?: unknown;
    atlasIndex?: unknown;
  };

  const id = typeof record.id === 'string' && record.id.trim() ? record.id : `tile-${Date.now()}`;
  const name = typeof record.name === 'string' && record.name.trim() ? record.name : 'Saved Tile';

  if (Array.isArray(record.cells)) {
    const cells: SavedPaintTileCell[] = [];
    for (const rawCell of record.cells) {
      if (!rawCell || typeof rawCell !== 'object') {
        continue;
      }
      const cell = rawCell as {
        code?: unknown;
        atlasIndex?: unknown;
        dx?: unknown;
        dy?: unknown;
      };

      const code = typeof cell.code === 'string' && cell.code.trim() ? cell.code.trim()[0] : '';
      const atlasIndex = typeof cell.atlasIndex === 'number' ? clampInt(cell.atlasIndex, 0, Number.MAX_SAFE_INTEGER) : 0;
      const dx = typeof cell.dx === 'number' ? Math.floor(cell.dx) : 0;
      const dy = typeof cell.dy === 'number' ? Math.floor(cell.dy) : 0;
      if (!code) {
        continue;
      }

      cells.push({ code, atlasIndex, dx, dy });
    }

    if (cells.length === 0) {
      return null;
    }

    const width = typeof record.width === 'number' ? Math.max(1, Math.floor(record.width)) : 1;
    const height = typeof record.height === 'number' ? Math.max(1, Math.floor(record.height)) : 1;
    const primaryCode =
      typeof record.primaryCode === 'string' && record.primaryCode.trim() ? record.primaryCode.trim()[0] : cells[0].code;
    const ySortWithActors =
      typeof record.ySortWithActors === 'boolean'
        ? record.ySortWithActors
        : inferTileYSortWithActors(name, width, height);

    return {
      id,
      name,
      primaryCode,
      width,
      height,
      ySortWithActors,
      cells,
    };
  }

  if (typeof record.code === 'string') {
    const code = record.code.trim()[0];
    if (!code) {
      return null;
    }
    const atlasIndex = typeof record.atlasIndex === 'number' ? clampInt(record.atlasIndex, 0, Number.MAX_SAFE_INTEGER) : 0;
    return {
      id,
      name,
      primaryCode: code,
      width: 1,
      height: 1,
      ySortWithActors: inferTileYSortWithActors(name, 1, 1),
      cells: [{ code, atlasIndex, dx: 0, dy: 0 }],
    };
  }

  return null;
}

function parseDirectionPattern(value: string): Direction[] {
  if (!value.trim()) {
    return [];
  }

  const tokens = value
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const parsed: Direction[] = [];
  for (const token of tokens) {
    if (token === 'up' || token === 'down' || token === 'left' || token === 'right') {
      parsed.push(token);
    }
  }
  return parsed;
}

function isDirectionValue(value: unknown): value is Direction {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}

function withCacheBusterTag(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed, window.location.origin);
    parsed.searchParams.set('v', String(Date.now()));
    if (/^https?:\/\//i.test(trimmed)) {
      return parsed.toString();
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}v=${Date.now()}`;
  }
}

function normalizeAssetUrlForCompare(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed, window.location.origin);
    parsed.search = '';
    parsed.hash = '';
    if (/^https?:\/\//i.test(trimmed)) {
      return parsed.toString();
    }
    return parsed.pathname;
  } catch {
    return trimmed.split('?')[0].split('#')[0];
  }
}

function withCacheBusterTagValue(url: string, version: number): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }
  const normalizedVersion = Number.isFinite(version) ? Math.max(1, Math.floor(version)) : Date.now();
  try {
    const parsed = new URL(trimmed, window.location.origin);
    parsed.searchParams.set('v', String(normalizedVersion));
    if (/^https?:\/\//i.test(trimmed)) {
      return parsed.toString();
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}v=${normalizedVersion}`;
  }
}

function makeNpcSpriteId(baseName: string, existing: NpcSpriteLibraryEntry[]): string {
  const base = sanitizeIdentifier(baseName, 'npc-sprite');
  let suffix = 1;
  while (suffix < 5000) {
    const candidate = `${base}-${suffix}`;
    if (!existing.some((entry) => entry.id === candidate)) {
      return candidate;
    }
    suffix += 1;
  }
  return `${base}-${Date.now()}`;
}

function makeNpcCharacterId(baseName: string, existing: NpcCharacterTemplateEntry[]): string {
  const base = sanitizeIdentifier(baseName, 'npc-character');
  let suffix = 1;
  while (suffix < 5000) {
    const candidate = `${base}-${suffix}`;
    if (!existing.some((entry) => entry.id === candidate)) {
      return candidate;
    }
    suffix += 1;
  }
  return `${base}-${Date.now()}`;
}

function makeNpcInstanceId(baseName: string, existing: NpcDefinition[]): string {
  const base = sanitizeIdentifier(baseName, 'npc');
  let suffix = 1;
  while (suffix < 5000) {
    const candidate = `${base}-${suffix}`;
    if (!existing.some((entry) => entry.id === candidate)) {
      return candidate;
    }
    suffix += 1;
  }
  return `${base}-${Date.now()}`;
}

function sanitizeNpcSpriteLibrary(raw: unknown): NpcSpriteLibraryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const sprites: NpcSpriteLibraryEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const record = entry as {
      id?: unknown;
      label?: unknown;
      sprite?: unknown;
    };

    const sprite = sanitizeNpcSprite(record.sprite);
    if (!sprite) {
      continue;
    }

    sprites.push({
      id: typeof record.id === 'string' && record.id.trim() ? record.id : `npc-sprite-${Date.now()}`,
      label: typeof record.label === 'string' && record.label.trim() ? record.label.trim() : 'NPC Sprite',
      sprite,
    });
  }

  return sprites;
}

function sanitizeNpcCharacterLibrary(raw: unknown): NpcCharacterTemplateEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const characters: NpcCharacterTemplateEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const record = entry as {
      id?: unknown;
      label?: unknown;
      npcName?: unknown;
      color?: unknown;
      facing?: unknown;
      dialogueId?: unknown;
      dialogueSpeaker?: unknown;
      dialogueLines?: unknown;
      dialogueSetFlag?: unknown;
      firstInteractionSetFlag?: unknown;
      firstInteractBattle?: unknown;
      healer?: unknown;
      battleTeamIds?: unknown;
      movementGuards?: unknown;
      storyStates?: unknown;
      interactionScript?: unknown;
      movement?: unknown;
      spriteId?: unknown;
      cacheVersion?: unknown;
      idleAnimation?: unknown;
      moveAnimation?: unknown;
    };

    const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : '';
    const npcName = typeof record.npcName === 'string' && record.npcName.trim() ? record.npcName.trim() : '';
    if (!label || !npcName) {
      continue;
    }

    const dialogueLines = Array.isArray(record.dialogueLines)
      ? record.dialogueLines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
      : undefined;
    const battleTeamIds = Array.isArray(record.battleTeamIds)
      ? record.battleTeamIds
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map((entry) => entry.trim())
      : undefined;
    const facing =
      record.facing === 'up' || record.facing === 'down' || record.facing === 'left' || record.facing === 'right'
        ? record.facing
        : undefined;

    characters.push({
      id: typeof record.id === 'string' && record.id.trim() ? record.id : `npc-character-${Date.now()}`,
      label,
      npcName,
      color: typeof record.color === 'string' && record.color ? record.color : '#9b73b8',
      facing,
      dialogueId:
        typeof record.dialogueId === 'string' && record.dialogueId.trim()
          ? record.dialogueId
          : 'custom_npc_dialogue',
      dialogueSpeaker:
        typeof record.dialogueSpeaker === 'string' && record.dialogueSpeaker.trim()
          ? record.dialogueSpeaker
          : undefined,
      dialogueLines: dialogueLines && dialogueLines.length > 0 ? dialogueLines : undefined,
      dialogueSetFlag:
        typeof record.dialogueSetFlag === 'string' && record.dialogueSetFlag.trim()
          ? record.dialogueSetFlag
          : undefined,
      firstInteractionSetFlag:
        typeof record.firstInteractionSetFlag === 'string' && record.firstInteractionSetFlag.trim()
          ? record.firstInteractionSetFlag.trim()
          : undefined,
      firstInteractBattle: typeof record.firstInteractBattle === 'boolean' ? record.firstInteractBattle : undefined,
      healer: typeof record.healer === 'boolean' ? record.healer : undefined,
      battleTeamIds: battleTeamIds && battleTeamIds.length > 0 ? battleTeamIds : undefined,
      movementGuards: sanitizeNpcMovementGuards(record.movementGuards),
      storyStates: compactCharacterPlacementOrder(sanitizeNpcStoryStates(record.storyStates) ?? []),
      interactionScript: sanitizeNpcInteractionScript(record.interactionScript),
      movement: sanitizeNpcMovement(record.movement),
      spriteId:
        typeof record.spriteId === 'string' && record.spriteId.trim() ? record.spriteId.trim() : undefined,
      cacheVersion:
        typeof record.cacheVersion === 'number' && Number.isFinite(record.cacheVersion)
          ? Math.max(1, Math.floor(record.cacheVersion))
          : undefined,
      idleAnimation:
        typeof record.idleAnimation === 'string' && record.idleAnimation.trim()
          ? record.idleAnimation.trim()
          : undefined,
      moveAnimation:
        typeof record.moveAnimation === 'string' && record.moveAnimation.trim()
          ? record.moveAnimation.trim()
          : undefined,
    });
  }

  return normalizeCoreStoryNpcCharacters(characters);
}

function sanitizeNpcStoryStates(raw: unknown): NpcStoryStateDefinition[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const states: NpcStoryStateDefinition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const positionRaw =
      record.position && typeof record.position === 'object' && !Array.isArray(record.position)
        ? (record.position as Record<string, unknown>)
        : null;
    const position =
      positionRaw &&
      typeof positionRaw.x === 'number' &&
      Number.isFinite(positionRaw.x) &&
      typeof positionRaw.y === 'number' &&
      Number.isFinite(positionRaw.y)
        ? {
            x: Math.floor(positionRaw.x),
            y: Math.floor(positionRaw.y),
          }
        : undefined;
    const facing =
      record.facing === 'up' || record.facing === 'down' || record.facing === 'left' || record.facing === 'right'
        ? record.facing
        : undefined;
    const dialogueLines = Array.isArray(record.dialogueLines)
      ? record.dialogueLines
          .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
          .map((line) => line.trim())
      : undefined;
    const battleTeamIds = Array.isArray(record.battleTeamIds)
      ? record.battleTeamIds
          .filter((teamId): teamId is string => typeof teamId === 'string' && teamId.trim().length > 0)
          .map((teamId) => teamId.trim())
      : undefined;

    const state: NpcStoryStateDefinition = {
      id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : undefined,
      requiresFlag:
        typeof record.requiresFlag === 'string' && record.requiresFlag.trim() ? record.requiresFlag.trim() : undefined,
      mapId: typeof record.mapId === 'string' && record.mapId.trim() ? record.mapId.trim() : undefined,
      position,
      facing,
      dialogueId:
        typeof record.dialogueId === 'string' && record.dialogueId.trim() ? record.dialogueId.trim() : undefined,
      dialogueLines: dialogueLines && dialogueLines.length > 0 ? dialogueLines : undefined,
      dialogueSpeaker:
        typeof record.dialogueSpeaker === 'string' && record.dialogueSpeaker.trim()
          ? record.dialogueSpeaker.trim()
          : undefined,
      dialogueSetFlag:
        typeof record.dialogueSetFlag === 'string' && record.dialogueSetFlag.trim()
          ? record.dialogueSetFlag.trim()
          : undefined,
      firstInteractionSetFlag:
        typeof record.firstInteractionSetFlag === 'string' && record.firstInteractionSetFlag.trim()
          ? record.firstInteractionSetFlag.trim()
          : undefined,
      firstInteractBattle: typeof record.firstInteractBattle === 'boolean' ? record.firstInteractBattle : undefined,
      healer: typeof record.healer === 'boolean' ? record.healer : undefined,
      battleTeamIds: battleTeamIds && battleTeamIds.length > 0 ? battleTeamIds : undefined,
      movement: sanitizeNpcMovement(record.movement),
      movementGuards: sanitizeNpcMovementGuards(record.movementGuards),
      idleAnimation:
        typeof record.idleAnimation === 'string' && record.idleAnimation.trim()
          ? record.idleAnimation.trim()
          : undefined,
      moveAnimation:
        typeof record.moveAnimation === 'string' && record.moveAnimation.trim()
          ? record.moveAnimation.trim()
          : undefined,
      interactionScript: sanitizeNpcInteractionScript(record.interactionScript),
    };

    states.push(state);
  }
  return states.length > 0 ? states : undefined;
}

function parseNpcStoryStatesInput(
  rawInput: string,
): { ok: true; states: NpcStoryStateDefinition[] } | { ok: false; error: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: true, states: [] };
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const states = sanitizeNpcStoryStates(parsed) ?? [];
    return { ok: true, states };
  } catch {
    return {
      ok: false,
      error: 'Story States JSON is invalid. Provide a valid JSON array.',
    };
  }
}

function sanitizeNpcMovementGuards(raw: unknown): NpcMovementGuardDefinition[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const guards: NpcMovementGuardDefinition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const hasTarget =
      (typeof record.x === 'number' && Number.isFinite(record.x)) ||
      (typeof record.y === 'number' && Number.isFinite(record.y)) ||
      (typeof record.minX === 'number' && Number.isFinite(record.minX)) ||
      (typeof record.maxX === 'number' && Number.isFinite(record.maxX)) ||
      (typeof record.minY === 'number' && Number.isFinite(record.minY)) ||
      (typeof record.maxY === 'number' && Number.isFinite(record.maxY));
    if (!hasTarget) {
      continue;
    }
    guards.push({
      id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : undefined,
      requiresFlag:
        typeof record.requiresFlag === 'string' && record.requiresFlag.trim() ? record.requiresFlag.trim() : undefined,
      hideIfFlag:
        typeof record.hideIfFlag === 'string' && record.hideIfFlag.trim() ? record.hideIfFlag.trim() : undefined,
      x: typeof record.x === 'number' && Number.isFinite(record.x) ? Math.floor(record.x) : undefined,
      y: typeof record.y === 'number' && Number.isFinite(record.y) ? Math.floor(record.y) : undefined,
      minX: typeof record.minX === 'number' && Number.isFinite(record.minX) ? Math.floor(record.minX) : undefined,
      maxX: typeof record.maxX === 'number' && Number.isFinite(record.maxX) ? Math.floor(record.maxX) : undefined,
      minY: typeof record.minY === 'number' && Number.isFinite(record.minY) ? Math.floor(record.minY) : undefined,
      maxY: typeof record.maxY === 'number' && Number.isFinite(record.maxY) ? Math.floor(record.maxY) : undefined,
      dialogueSpeaker:
        typeof record.dialogueSpeaker === 'string' && record.dialogueSpeaker.trim()
          ? record.dialogueSpeaker.trim()
          : undefined,
      dialogueLines: Array.isArray(record.dialogueLines)
        ? record.dialogueLines
            .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
            .map((line) => line.trim())
        : undefined,
      setFlag: typeof record.setFlag === 'string' && record.setFlag.trim() ? record.setFlag.trim() : undefined,
      defeatedFlag:
        typeof record.defeatedFlag === 'string' && record.defeatedFlag.trim() ? record.defeatedFlag.trim() : undefined,
      postDuelDialogueSpeaker:
        typeof record.postDuelDialogueSpeaker === 'string' && record.postDuelDialogueSpeaker.trim()
          ? record.postDuelDialogueSpeaker.trim()
          : undefined,
      postDuelDialogueLines: Array.isArray(record.postDuelDialogueLines)
        ? record.postDuelDialogueLines
            .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
            .map((line) => line.trim())
        : undefined,
    });
  }
  return guards.length > 0 ? guards : undefined;
}

function parseNpcMovementGuardsInput(
  rawInput: string,
): { ok: true; guards: NpcMovementGuardDefinition[] } | { ok: false; error: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: true, guards: [] };
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const guards = sanitizeNpcMovementGuards(parsed) ?? [];
    return { ok: true, guards };
  } catch {
    return {
      ok: false,
      error: 'Movement Guards JSON is invalid. Provide a valid JSON array.',
    };
  }
}

function sanitizeNpcInteractionScript(raw: unknown): NpcInteractionActionDefinition[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const actions: NpcInteractionActionDefinition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type.trim() : '';
    if (type === 'dialogue') {
      const lines = Array.isArray(record.lines)
        ? record.lines
            .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
            .map((line) => line.trim())
        : [];
      if (lines.length === 0) {
        continue;
      }
      actions.push({
        type: 'dialogue',
        speaker: typeof record.speaker === 'string' && record.speaker.trim() ? record.speaker.trim() : undefined,
        lines,
        setFlag: typeof record.setFlag === 'string' && record.setFlag.trim() ? record.setFlag.trim() : undefined,
      });
      continue;
    }
    if (type === 'set_flag') {
      const flag = typeof record.flag === 'string' ? record.flag.trim() : '';
      if (!flag) {
        continue;
      }
      actions.push({
        type: 'set_flag',
        flag,
      });
      continue;
    }
    if (type === 'move_to_player') {
      actions.push({ type: 'move_to_player' });
      continue;
    }
    if (type === 'face_player') {
      actions.push({ type: 'face_player' });
      continue;
    }
    if (type === 'wait') {
      const durationMsRaw = typeof record.durationMs === 'number' ? record.durationMs : 0;
      actions.push({
        type: 'wait',
        durationMs: clampInt(Math.floor(durationMsRaw), 0, 60000),
      });
      continue;
    }
    if (type === 'move_path') {
      const directions = Array.isArray(record.directions)
        ? record.directions.filter((direction): direction is Direction => isDirectionValue(direction))
        : [];
      if (directions.length === 0) {
        continue;
      }
      actions.push({
        type: 'move_path',
        directions,
      });
      continue;
    }
  }
  return actions.length > 0 ? actions : undefined;
}

function parseNpcInteractionScriptInput(
  rawInput: string,
): { ok: true; actions: NpcInteractionActionDefinition[] } | { ok: false; error: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: true, actions: [] };
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const actions = sanitizeNpcInteractionScript(parsed) ?? [];
    return { ok: true, actions };
  } catch {
    return {
      ok: false,
      error: 'Interaction Cutscene JSON is invalid. Provide a valid JSON array.',
    };
  }
}

function parseStringList(value: string): string[] | undefined {
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return entries.length > 0 ? entries : undefined;
}

function toEditorNpcMovementType(movementType: NpcMovementDefinition['type'] | undefined): EditorNpcMovementType {
  if (movementType === 'static-turning') {
    return 'static-turning';
  }
  if (movementType === 'path' || movementType === 'loop') {
    return 'path';
  }
  if (movementType === 'wander' || movementType === 'random') {
    return 'wander';
  }
  return 'static';
}

function getCharacterPlacementInstances(template: NpcCharacterTemplateEntry): NpcStoryStateDefinition[] {
  const states = Array.isArray(template.storyStates) ? template.storyStates : [];
  return compactCharacterPlacementOrder(states);
}

function compactCharacterPlacementOrder(states: NpcStoryStateDefinition[]): NpcStoryStateDefinition[] {
  return states.map((state, index) => ({
    ...state,
    id: `instance-${index + 1}`,
    mapId: typeof state.mapId === 'string' ? state.mapId.trim() : '',
    position: state.position ? { ...state.position } : undefined,
    dialogueLines: state.dialogueLines ? [...state.dialogueLines] : undefined,
    battleTeamIds: state.battleTeamIds ? [...state.battleTeamIds] : undefined,
    movement: state.movement
      ? {
          ...state.movement,
          pattern: state.movement.pattern ? [...state.movement.pattern] : undefined,
        }
      : undefined,
    movementGuards: state.movementGuards
      ? state.movementGuards.map((guard) => ({
          ...guard,
          dialogueLines: guard.dialogueLines ? [...guard.dialogueLines] : undefined,
        }))
      : undefined,
    interactionScript: state.interactionScript ? state.interactionScript.map((entry) => ({ ...entry })) : undefined,
  }));
}

function formatNpcMarkerLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'NPC';
  }
  if (trimmed.length <= 12) {
    return trimmed;
  }
  const parts = trimmed
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

type DirectionalAnimationSets = Partial<Record<string, Partial<Record<Direction, number[]>>>>;

function buildDirectionalAnimationSetsFromLegacyFrames(
  facingFrames: Record<Direction, number>,
  walkFrames: Record<Direction, number[]>,
): DirectionalAnimationSets {
  return {
    idle: {
      up: [facingFrames.up],
      down: [facingFrames.down],
      left: [facingFrames.left],
      right: [facingFrames.right],
    },
    walk: {
      up: [...walkFrames.up],
      down: [...walkFrames.down],
      left: [...walkFrames.left],
      right: [...walkFrames.right],
    },
  };
}

function sanitizeDirectionalAnimationSets(animationSets: DirectionalAnimationSets): DirectionalAnimationSets {
  const sanitized: DirectionalAnimationSets = {};
  for (const [name, directions] of Object.entries(animationSets)) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      continue;
    }
    const directionRecord =
      directions && typeof directions === 'object' && !Array.isArray(directions)
        ? directions
        : {};
    const sanitizedDirections: Partial<Record<Direction, number[]>> = {
      up: [],
      down: [],
      left: [],
      right: [],
    };
    for (const direction of ['up', 'down', 'left', 'right'] as Direction[]) {
      const rawFrames = directionRecord[direction];
      const frames = Array.isArray(rawFrames)
        ? rawFrames
            .filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry))
            .map((entry) => Math.max(0, Math.floor(entry)))
        : [];
      sanitizedDirections[direction] = frames;
    }
    sanitized[trimmedName] = sanitizedDirections;
  }

  return sanitized;
}

function stringifyDirectionalAnimationSetsForEditor(animationSets: DirectionalAnimationSets): string {
  return JSON.stringify(animationSets, null, 2);
}

function parseDirectionalAnimationSetsInput(
  rawInput: string,
  facingFrames: Record<Direction, number>,
  walkFrames: Record<Direction, number[]>,
): { ok: true; animationSets: DirectionalAnimationSets } | { ok: false; error: string } {
  const fallback = sanitizeDirectionalAnimationSets(buildDirectionalAnimationSetsFromLegacyFrames(facingFrames, walkFrames));
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: true,
      animationSets: fallback,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        error: 'Animation sets must be an object keyed by animation name.',
      };
    }
    const sanitized = sanitizeDirectionalAnimationSets(parsed as DirectionalAnimationSets);
    if (Object.keys(sanitized).length === 0) {
      return {
        ok: false,
        error: 'Animation sets must include at least one animation name.',
      };
    }
    return {
      ok: true,
      animationSets: sanitized,
    };
  } catch {
    return {
      ok: false,
      error: 'Animation sets are invalid. Use valid object JSON syntax.',
    };
  }
}

function deriveLegacyFramesFromAnimationSets(
  animationSets: DirectionalAnimationSets,
  defaultIdleAnimation: string,
  defaultMoveAnimation: string,
): { facingFrames: Record<Direction, number>; walkFrames: Record<Direction, number[]> } {
  const idleSet = animationSets[defaultIdleAnimation] ?? {};
  const moveSet = animationSets[defaultMoveAnimation] ?? {};

  const pickFirstFrame = (frames: number[] | undefined): number => {
    if (!Array.isArray(frames) || frames.length === 0) {
      return 0;
    }
    const value = frames[0];
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  };

  const normalizeFrames = (frames: number[] | undefined): number[] => {
    if (!Array.isArray(frames)) {
      return [];
    }
    return frames
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .map((value) => Math.max(0, Math.floor(value)));
  };

  const facingFrames: Record<Direction, number> = {
    up: pickFirstFrame(idleSet.up),
    down: pickFirstFrame(idleSet.down),
    left: pickFirstFrame(idleSet.left),
    right: pickFirstFrame(idleSet.right),
  };
  const walkFrames: Record<Direction, number[]> = {
    up: normalizeFrames(moveSet.up),
    down: normalizeFrames(moveSet.down),
    left: normalizeFrames(moveSet.left),
    right: normalizeFrames(moveSet.right),
  };

  for (const direction of ['up', 'down', 'left', 'right'] as Direction[]) {
    if (walkFrames[direction].length === 0) {
      walkFrames[direction] = [facingFrames[direction]];
    }
  }

  return {
    facingFrames,
    walkFrames,
  };
}

function upsertIdleWalkAnimationSetsInDraft(
  rawInput: string,
  facingFrames: Record<Direction, number>,
  walkFrames: Record<Direction, number[]>,
): DirectionalAnimationSets {
  const legacyBase = buildDirectionalAnimationSetsFromLegacyFrames(facingFrames, walkFrames);
  const parsed = parseDirectionalAnimationSetsInput(rawInput, facingFrames, walkFrames);
  if (!parsed.ok) {
    return legacyBase;
  }
  return {
    ...parsed.animationSets,
    ...legacyBase,
  };
}

function sanitizeNpcMovement(raw: unknown): NpcMovementDefinition | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const record = raw as {
    type?: unknown;
    pattern?: unknown;
    stepIntervalMs?: unknown;
    pathMode?: unknown;
    leashRadius?: unknown;
  };
  const parsedType = typeof record.type === 'string' ? record.type : 'static';
  const type =
    parsedType === 'static-turning' ||
    parsedType === 'wander' ||
    parsedType === 'path' ||
    parsedType === 'loop' ||
    parsedType === 'random' ||
    parsedType === 'static'
      ? parsedType
      : 'static';
  const normalizedType =
    type === 'loop' ? 'path' : type === 'random' ? 'wander' : type;
  const pattern = Array.isArray(record.pattern)
    ? record.pattern.filter((entry): entry is Direction => entry === 'up' || entry === 'down' || entry === 'left' || entry === 'right')
    : undefined;
  const stepIntervalMs =
    typeof record.stepIntervalMs === 'number' && Number.isFinite(record.stepIntervalMs)
      ? Math.floor(record.stepIntervalMs)
      : undefined;
  const pathMode = record.pathMode === 'pingpong' ? 'pingpong' : 'loop';
  const leashRadius =
    typeof record.leashRadius === 'number' && Number.isFinite(record.leashRadius)
      ? clampInt(record.leashRadius, 1, 64)
      : undefined;

  return {
    type: normalizedType,
    pattern:
      normalizedType === 'path' || normalizedType === 'static-turning'
        ? pattern && pattern.length > 0
          ? pattern
          : undefined
        : undefined,
    stepIntervalMs,
    pathMode: normalizedType === 'path' ? pathMode : undefined,
    leashRadius: normalizedType === 'wander' ? leashRadius : undefined,
  };
}

function sanitizeNpcSprite(raw: unknown): NpcSpriteConfig | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const record = raw as {
    url?: unknown;
    frameWidth?: unknown;
    frameHeight?: unknown;
    atlasCellWidth?: unknown;
    atlasCellHeight?: unknown;
    frameCellsWide?: unknown;
    frameCellsTall?: unknown;
    renderWidthTiles?: unknown;
    renderHeightTiles?: unknown;
    animationSets?: unknown;
    defaultIdleAnimation?: unknown;
    defaultMoveAnimation?: unknown;
    facingFrames?: unknown;
    walkFrames?: unknown;
  };
  if (typeof record.url !== 'string' || !record.url.trim()) {
    return undefined;
  }
  const frameWidth = typeof record.frameWidth === 'number' ? Math.max(1, Math.floor(record.frameWidth)) : 64;
  const frameHeight = typeof record.frameHeight === 'number' ? Math.max(1, Math.floor(record.frameHeight)) : 64;
  const atlasCellWidth =
    typeof record.atlasCellWidth === 'number' ? Math.max(1, Math.floor(record.atlasCellWidth)) : frameWidth;
  const atlasCellHeight =
    typeof record.atlasCellHeight === 'number' ? Math.max(1, Math.floor(record.atlasCellHeight)) : frameHeight;
  const frameCellsWide =
    typeof record.frameCellsWide === 'number'
      ? Math.max(1, Math.floor(record.frameCellsWide))
      : Math.max(1, Math.round(frameWidth / atlasCellWidth));
  const frameCellsTall =
    typeof record.frameCellsTall === 'number'
      ? Math.max(1, Math.floor(record.frameCellsTall))
      : Math.max(1, Math.round(frameHeight / atlasCellHeight));
  const renderWidthTiles =
    typeof record.renderWidthTiles === 'number' ? Math.max(1, Math.floor(record.renderWidthTiles)) : 1;
  const renderHeightTiles =
    typeof record.renderHeightTiles === 'number' ? Math.max(1, Math.floor(record.renderHeightTiles)) : 2;

  const facingFramesRecord = (record.facingFrames ?? {}) as Partial<Record<Direction, number>>;
  const facingFrames: Record<Direction, number> = {
    up: typeof facingFramesRecord.up === 'number' ? Math.max(0, Math.floor(facingFramesRecord.up)) : 0,
    down: typeof facingFramesRecord.down === 'number' ? Math.max(0, Math.floor(facingFramesRecord.down)) : 0,
    left: typeof facingFramesRecord.left === 'number' ? Math.max(0, Math.floor(facingFramesRecord.left)) : 0,
    right: typeof facingFramesRecord.right === 'number' ? Math.max(0, Math.floor(facingFramesRecord.right)) : 0,
  };

  const walkRecord = (record.walkFrames ?? {}) as Partial<Record<Direction, unknown>>;
  const walkFrames: Partial<Record<Direction, number[]>> = {};
  for (const direction of ['up', 'down', 'left', 'right'] as Direction[]) {
    const rawFrames = walkRecord[direction];
    if (!Array.isArray(rawFrames)) {
      continue;
    }
    walkFrames[direction] = rawFrames
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .map((value) => Math.max(0, Math.floor(value)));
  }

  const animationSets = sanitizeNpcSpriteAnimationSets(record.animationSets);
  const defaultIdleAnimation =
    typeof record.defaultIdleAnimation === 'string' && record.defaultIdleAnimation.trim()
      ? record.defaultIdleAnimation.trim()
      : undefined;
  const defaultMoveAnimation =
    typeof record.defaultMoveAnimation === 'string' && record.defaultMoveAnimation.trim()
      ? record.defaultMoveAnimation.trim()
      : undefined;

  return {
    url: record.url.trim(),
    frameWidth,
    frameHeight,
    atlasCellWidth,
    atlasCellHeight,
    frameCellsWide,
    frameCellsTall,
    renderWidthTiles,
    renderHeightTiles,
    animationSets,
    defaultIdleAnimation,
    defaultMoveAnimation,
    facingFrames,
    walkFrames,
  };
}

function sanitizeNpcSpriteAnimationSets(
  raw: unknown,
): Partial<Record<string, Partial<Record<Direction, number[]>>>> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }

  const sanitized = sanitizeDirectionalAnimationSets(raw as DirectionalAnimationSets);
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}
