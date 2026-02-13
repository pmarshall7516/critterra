import { CSSProperties, ChangeEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { WORLD_MAPS } from '@/game/data/maps';
import { SAVED_PAINT_TILE_DATABASE } from '@/game/world/customTiles';
import {
  DEFAULT_NPC_CHARACTER_LIBRARY,
  DEFAULT_NPC_SPRITE_LIBRARY,
  type NpcCharacterTemplateEntry,
  type NpcSpriteLibraryEntry,
} from '@/game/world/npcCatalog';
import { BLANK_TILE_CODE, TILE_DEFINITIONS } from '@/game/world/tiles';
import { getAdminDbValue, setAdminDbValue } from '@/admin/indexedDbStore';
import type {
  InteractionDefinition,
  NpcMovementDefinition,
  NpcSpriteConfig,
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
  resizeEditableMap,
  updateCollisionEdgeMask,
  updateTile,
  worldMapToEditable,
} from '@/admin/mapEditorUtils';

type PaintTool =
  | 'paint'
  | 'paint-rotated'
  | 'erase'
  | 'fill'
  | 'pick'
  | 'npc-paint'
  | 'npc-erase'
  | 'collision-edge'
  | 'warp-from'
  | 'warp-to';
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

type BaseTileCode = keyof typeof TILE_DEFINITIONS;
const TILE_CODES = Object.keys(TILE_DEFINITIONS) as BaseTileCode[];
const SAVED_PAINT_TILES_DB_KEY = 'map-editor-saved-paint-tiles-v2';
const NPC_SPRITE_LIBRARY_DB_KEY = 'map-editor-npc-sprite-library-v1';
const NPC_CHARACTER_LIBRARY_DB_KEY = 'map-editor-npc-character-library-v1';
const MIN_CELL_SIZE = 14;
const MAX_CELL_SIZE = 52;
const ATLAS_PREVIEW_SIZE = 28;
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
const EMPTY_EDITABLE_MAP: EditableMap = {
  id: '',
  name: '',
  layers: [],
  npcs: [],
  warps: [],
  interactions: [],
};

export function MapEditorTool() {
  const sourceMaps = useMemo(() => WORLD_MAPS.map((map) => worldMapToEditable(map)), []);
  const sourceMapIds = useMemo(() => sourceMaps.map((map) => map.id), [sourceMaps]);
  const [selectedSourceMapId, setSelectedSourceMapId] = useState('');
  const [loadedSourceMapIdForSave, setLoadedSourceMapIdForSave] = useState<string | null>(null);
  const [editableMap, setEditableMap] = useState<EditableMap>(EMPTY_EDITABLE_MAP);

  const [tool, setTool] = useState<PaintTool>('paint');
  const [selectedTileCode, setSelectedTileCode] = useState<EditorTileCode>('');
  const [selectedPaintTileId, setSelectedPaintTileId] = useState('');
  const [activeLayerId, setActiveLayerId] = useState('');
  const [newLayerName, setNewLayerName] = useState('');
  const [cellSize, setCellSize] = useState(24);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<Vector2 | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingMapFile, setIsSavingMapFile] = useState(false);

  const [tilesetUrlInput, setTilesetUrlInput] = useState('');
  const [tilesetUrl, setTilesetUrl] = useState('');
  const [tilePixelWidthInput, setTilePixelWidthInput] = useState('');
  const [tilePixelHeightInput, setTilePixelHeightInput] = useState('');
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
  const [npcSpriteLibrary, setNpcSpriteLibrary] = useState<NpcSpriteLibraryEntry[]>(DEFAULT_NPC_SPRITE_LIBRARY);
  const [selectedNpcSpriteId, setSelectedNpcSpriteId] = useState(DEFAULT_NPC_SPRITE_LIBRARY[0]?.id ?? '');
  const [npcSpriteLabelInput, setNpcSpriteLabelInput] = useState(DEFAULT_NPC_SPRITE_LIBRARY[0]?.label ?? '');
  const [npcCharacterLibrary, setNpcCharacterLibrary] =
    useState<NpcCharacterTemplateEntry[]>(DEFAULT_NPC_CHARACTER_LIBRARY);
  const [selectedNpcCharacterId, setSelectedNpcCharacterId] = useState(DEFAULT_NPC_CHARACTER_LIBRARY[0]?.id ?? '');
  const [npcCharacterLabelInput, setNpcCharacterLabelInput] = useState(DEFAULT_NPC_CHARACTER_LIBRARY[0]?.label ?? '');
  const [npcCharacterNameInput, setNpcCharacterNameInput] = useState(DEFAULT_NPC_CHARACTER_LIBRARY[0]?.npcName ?? '');
  const [npcCharacterColorInput, setNpcCharacterColorInput] = useState(DEFAULT_NPC_CHARACTER_LIBRARY[0]?.color ?? '#9b73b8');
  const [npcDialogueIdInput, setNpcDialogueIdInput] = useState('');
  const [npcDialogueSpeakerInput, setNpcDialogueSpeakerInput] = useState('');
  const [npcDialogueLinesInput, setNpcDialogueLinesInput] = useState('');
  const [npcDialogueSetFlagInput, setNpcDialogueSetFlagInput] = useState('');
  const [npcBattleTeamsInput, setNpcBattleTeamsInput] = useState('');
  const [npcMovementTypeInput, setNpcMovementTypeInput] = useState<'static' | 'loop' | 'random'>('static');
  const [npcMovementPatternInput, setNpcMovementPatternInput] = useState('');
  const [npcStepIntervalInput, setNpcStepIntervalInput] = useState('850');
  const [npcSpriteUrlInput, setNpcSpriteUrlInput] = useState('');
  const [npcSpriteUrl, setNpcSpriteUrl] = useState('');
  const [npcFrameWidthInput, setNpcFrameWidthInput] = useState('32');
  const [npcFrameHeightInput, setNpcFrameHeightInput] = useState('32');
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
  const [npcAssignMode, setNpcAssignMode] = useState<'idle' | 'walk'>('idle');
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

  const uploadedObjectUrlRef = useRef<string | null>(null);
  const uploadedNpcObjectUrlRef = useRef<string | null>(null);

  const mapSize = useMemo(() => getMapSize(editableMap), [editableMap]);
  const hasMapLoaded = mapSize.width > 0 && mapSize.height > 0;
  const composedTiles = useMemo(() => composeEditableTiles(editableMap), [editableMap]);
  const activeLayer = useMemo(
    () => (activeLayerId ? getLayerById(editableMap, activeLayerId) : editableMap.layers[0] ?? null),
    [activeLayerId, editableMap],
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
  const selectedNpcSprite = useMemo(
    () => npcSpriteLibrary.find((sprite) => sprite.id === selectedNpcSpriteId) ?? null,
    [npcSpriteLibrary, selectedNpcSpriteId],
  );

  const atlasCellCount = useMemo(() => Math.max(0, atlasMeta.columns * atlasMeta.rows), [atlasMeta]);
  const npcAtlasCellCount = useMemo(() => Math.max(0, npcSpriteMeta.columns * npcSpriteMeta.rows), [npcSpriteMeta]);
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
    () => buildWarnings(editableMap, savedCustomTileCodes),
    [editableMap, savedCustomTileCodes],
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

    for (const layer of editableMap.layers) {
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
  }, [editableMap.layers, hasMapLoaded, mapSize.height, mapSize.width]);
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

    const previewRotation = tool === 'paint-rotated' ? pseudoRandomQuarter(hoveredCell.x, hoveredCell.y) : 0;
    const transformedCells = rotateStampCells(selectedPaintTile, previewRotation);
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
  }, [hasMapLoaded, hoveredCell, mapSize.height, mapSize.width, selectedPaintTile, tool]);
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
      return;
    }

    setResizeWidthInput(String(mapSize.width));
    setResizeHeightInput(String(mapSize.height));
  }, [hasMapLoaded, mapSize.height, mapSize.width]);

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

    setActiveLayerId(editableMap.layers[0]?.id ?? '');
  }, [activeLayerId, editableMap.layers, hasMapLoaded]);

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
      if (uploadedNpcObjectUrlRef.current) {
        URL.revokeObjectURL(uploadedNpcObjectUrlRef.current);
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

  const persistSavedPaintTiles = async (nextTiles: SavedPaintTile[]) => {
    try {
      await setAdminDbValue(SAVED_PAINT_TILES_DB_KEY, nextTiles);
      const tilePixelWidth = parseInteger(tilePixelWidthInput);
      const tilePixelHeight = parseInteger(tilePixelHeightInput);

      const response = await fetch('/api/admin/tiles/save', {
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
      const payload = (await response.json()) as SaveTileDatabaseResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'Unable to sync tile database.');
      }
    } catch {
      setError('Unable to save paint tiles to database/project tile catalog.');
    }
  };

  const persistNpcSpriteLibrary = async (nextSprites: NpcSpriteLibraryEntry[]) => {
    try {
      await setAdminDbValue(NPC_SPRITE_LIBRARY_DB_KEY, nextSprites);
    } catch {
      setError('Unable to save NPC sprites.');
    }
  };

  const persistNpcCharacterLibrary = async (nextCharacters: NpcCharacterTemplateEntry[]) => {
    try {
      await setAdminDbValue(NPC_CHARACTER_LIBRARY_DB_KEY, nextCharacters);
    } catch {
      setError('Unable to save NPC characters.');
    }
  };

  const loadSavedPaintTilesFromDatabase = async () => {
    try {
      const raw = await getAdminDbValue<unknown>(SAVED_PAINT_TILES_DB_KEY);
      const loadedFromIndexedDb = sanitizeSavedPaintTiles(raw);
      const loadedFromProjectDb = sanitizeSavedPaintTiles(SAVED_PAINT_TILE_DATABASE as unknown);
      const mergedById = new Map<string, SavedPaintTile>();
      for (const tile of loadedFromProjectDb) {
        mergedById.set(tile.id, tile);
      }
      for (const tile of loadedFromIndexedDb) {
        mergedById.set(tile.id, tile);
      }
      const loaded = Array.from(mergedById.values());
      setSavedPaintTiles(loaded);
      const first = loaded[0];
      setSelectedPaintTileId(first?.id ?? '');
      setSelectedTileCode(first?.primaryCode ?? '');
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

      const spriteLibraryIndexedDb = sanitizeNpcSpriteLibrary(rawSpriteLibrary);
      const characterLibraryIndexedDb = sanitizeNpcCharacterLibrary(rawCharacterLibrary);

      const spriteById = new Map<string, NpcSpriteLibraryEntry>();
      for (const sprite of DEFAULT_NPC_SPRITE_LIBRARY) {
        spriteById.set(sprite.id, sprite);
      }
      for (const sprite of spriteLibraryIndexedDb) {
        spriteById.set(sprite.id, sprite);
      }
      const mergedSprites = Array.from(spriteById.values());

      const characterById = new Map<string, NpcCharacterTemplateEntry>();
      for (const character of DEFAULT_NPC_CHARACTER_LIBRARY) {
        characterById.set(character.id, character);
      }
      for (const character of characterLibraryIndexedDb) {
        characterById.set(character.id, character);
      }
      const mergedCharacters = Array.from(characterById.values());

      setNpcSpriteLibrary(mergedSprites);
      setNpcCharacterLibrary(mergedCharacters);
      setSelectedNpcSpriteId(mergedSprites[0]?.id ?? '');
      setSelectedNpcCharacterId(mergedCharacters[0]?.id ?? '');
      setStatus(
        mergedCharacters.length > 0
          ? `Loaded ${mergedSprites.length} NPC sprite(s) and ${mergedCharacters.length} NPC character(s).`
          : 'No NPC sprites/characters found in database.',
      );
    } catch {
      setError('Unable to load NPC sprites/characters from database.');
    }
  };

  const applyPaintTileStamp = (
    map: EditableMap,
    layerId: string,
    originX: number,
    originY: number,
    tile: SavedPaintTile,
    rotationQuarter: number,
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

    const transformedCells = rotateStampCells(tile, rotationQuarter);
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

  const applyPaintTool = (x: number, y: number, source: 'drag' | 'click') => {
    if (!hasMapLoaded) {
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

    if (tool === 'fill') {
      if (source === 'click') {
        if (!selectedTileCode) {
          setError('Select a paint tile or map cell first.');
          return;
        }
        if (!activeLayer) {
          setError('Select an active layer before using fill.');
          return;
        }
        setEditableMap((current) => floodFill(current, activeLayer.id, x, y, selectedTileCode, 0));
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

    const rotationQuarter = tool === 'paint-rotated' ? Math.floor(Math.random() * 4) : 0;
    setEditableMap((current) =>
      applyPaintTileStamp(current, activeLayer.id, x, y, selectedPaintTile, rotationQuarter),
    );
  };

  const selectPaintTile = (tileId: string) => {
    const entry = savedPaintTiles.find((tile) => tile.id === tileId);
    if (!entry) {
      return;
    }

    setSelectedPaintTileId(tileId);
    setSelectedTileCode(entry.primaryCode);
    setTool('paint');
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
    setActiveLayerId(source.layers[0]?.id ?? '');
    setLoadedSourceMapIdForSave(source.id);
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
    setActiveLayerId(next.layers[0]?.id ?? '');
    setSelectedWarpId('');
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

    const existingIds = new Set(editableMap.layers.map((layer) => layer.id));
    const baseName = sanitizeIdentifier(newLayerName, 'layer');
    let suffix = 1;
    let nextId = baseName;
    while (existingIds.has(nextId)) {
      suffix += 1;
      nextId = `${baseName}-${suffix}`;
    }

    const layerName = newLayerName.trim() || `Layer ${editableMap.layers.length + 1}`;
    const nextLayer = createBlankLayer(mapSize.width, mapSize.height, {
      id: nextId,
      name: layerName,
      fillCode: BLANK_TILE_CODE,
      visible: true,
      collision: false,
    });

    setEditableMap((current) => {
      const next = cloneEditableMap(current);
      next.layers = [...next.layers, nextLayer];
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
      next.layers = next.layers.filter((layer) => layer.id !== targetLayerId);
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
    setTool('warp-from');
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
      setActiveLayerId(parsed.layers[0]?.id ?? '');
      setSelectedSourceMapId(parsed.id);
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

      const response = await fetch('/api/admin/maps/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          existingMapId: loadedSourceMapIdForSave,
          map: editableMap,
          savedPaintTiles,
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

      const payload = (await response.json()) as SaveMapResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'Map save failed.');
      }

      const nextMapId = payload.mapId ?? editableMap.id;
      if (nextMapId !== editableMap.id) {
        setEditableMap((current) => ({
          ...cloneEditableMap(current),
          id: nextMapId,
        }));
      }
      setLoadedSourceMapIdForSave(nextMapId);
      setSelectedSourceMapId(nextMapId);

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
    setTilesetUrlInput('/example_assets/tileset/tileset.png');
    setStatus('Loaded example tileset path.');
  };

  const onTilesetFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (uploadedObjectUrlRef.current) {
      URL.revokeObjectURL(uploadedObjectUrlRef.current);
      uploadedObjectUrlRef.current = null;
    }

    const objectUrl = URL.createObjectURL(file);
    uploadedObjectUrlRef.current = objectUrl;
    setTilesetUrlInput(objectUrl);
    setStatus(`Loaded tileset file ${file.name}`);
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
    setTool('paint');
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
      cells,
    };

    const updatedSavedTiles = [...savedPaintTiles, next];
    setSavedPaintTiles(updatedSavedTiles);
    void persistSavedPaintTiles(updatedSavedTiles);
    setSelectedPaintTileId(next.id);
    setSelectedTileCode(next.primaryCode);
    setTool('paint');
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

  const applyNpcSpriteUrl = () => {
    if (!npcSpriteUrlInput.trim()) {
      setError('NPC sheet URL cannot be empty.');
      return;
    }
    if (!parseInteger(npcFrameWidthInput) || !parseInteger(npcFrameHeightInput)) {
      setError('Set NPC frame width and height before applying NPC sheet URL.');
      return;
    }

    setNpcSpriteUrl(npcSpriteUrlInput.trim());
    setStatus('NPC spritesheet URL applied.');
  };

  const loadExampleNpcSprite = () => {
    setNpcSpriteUrlInput('/example_assets/character_npc_spritesheets/ow1.png');
    setNpcSpriteLabelInput('Teen Boy');
    setNpcFrameWidthInput('32');
    setNpcFrameHeightInput('32');
    setNpcFrameCellsWideInput('1');
    setNpcFrameCellsTallInput('1');
    setNpcRenderWidthTilesInput('1');
    setNpcRenderHeightTilesInput('2');
    setSelectedNpcAtlasStartIndex(null);
    setSelectedNpcAtlasEndIndex(null);
    setNpcFacingFrames({
      down: 0,
      left: 4,
      right: 8,
      up: 12,
    });
    setNpcWalkFrames({
      down: [1, 2, 3],
      left: [5, 6, 7],
      right: [9, 10, 11],
      up: [13, 14, 15],
    });
    setStatus('Loaded example NPC spritesheet path.');
  };

  const onNpcSpriteFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (uploadedNpcObjectUrlRef.current) {
      URL.revokeObjectURL(uploadedNpcObjectUrlRef.current);
      uploadedNpcObjectUrlRef.current = null;
    }

    const objectUrl = URL.createObjectURL(file);
    uploadedNpcObjectUrlRef.current = objectUrl;
    setNpcSpriteUrlInput(objectUrl);
    setStatus(`Loaded NPC sheet file ${file.name}`);
  };

  const assignNpcFrameFromAtlas = () => {
    if (!selectedNpcAtlasRect || npcSpriteMeta.columns <= 0) {
      setError('Select a rectangle on the NPC sheet first.');
      return;
    }

    const frameIndex = selectedNpcAtlasRect.minRow * npcSpriteMeta.columns + selectedNpcAtlasRect.minCol;
    setNpcFrameCellsWideInput(String(selectedNpcAtlasRect.width));
    setNpcFrameCellsTallInput(String(selectedNpcAtlasRect.height));

    if (npcAssignMode === 'idle') {
      setNpcFacingFrames((current) => ({
        ...current,
        [npcAssignDirection]: frameIndex,
      }));
      setStatus(
        `Assigned ${npcAssignDirection} idle frame ${frameIndex} (${selectedNpcAtlasRect.width}x${selectedNpcAtlasRect.height} cells).`,
      );
      return;
    }

    setNpcWalkFrames((current) => {
      const next = [...current[npcAssignDirection]];
      const existingIndex = next.indexOf(frameIndex);
      if (existingIndex >= 0) {
        next.splice(existingIndex, 1);
      } else {
        next.push(frameIndex);
        next.sort((a, b) => a - b);
      }
      setStatus(
        `Updated ${npcAssignDirection} walk frames: ${next.length > 0 ? next.join(', ') : 'none'} (${selectedNpcAtlasRect.width}x${selectedNpcAtlasRect.height} cells).`,
      );
      return {
        ...current,
        [npcAssignDirection]: next,
      };
    });
  };

  const autoFillNpcFramesFrom4x4 = () => {
    setNpcFrameCellsWideInput('1');
    setNpcFrameCellsTallInput('1');
    setNpcFacingFrames({
      down: 0,
      left: 4,
      right: 8,
      up: 12,
    });
    setNpcWalkFrames({
      down: [1, 2, 3],
      left: [5, 6, 7],
      right: [9, 10, 11],
      up: [13, 14, 15],
    });
    setStatus('Applied 4x4 row preset (Down, Left, Right, Up).');
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

    const spriteEntry: NpcSpriteLibraryEntry = {
      id: makeNpcSpriteId(label, npcSpriteLibrary),
      label,
      sprite: {
        url: npcSpriteUrl.trim(),
        frameWidth,
        frameHeight,
        atlasCellWidth,
        atlasCellHeight,
        frameCellsWide,
        frameCellsTall,
        renderWidthTiles,
        renderHeightTiles,
        facingFrames: { ...npcFacingFrames },
        walkFrames: {
          up: [...npcWalkFrames.up],
          down: [...npcWalkFrames.down],
          left: [...npcWalkFrames.left],
          right: [...npcWalkFrames.right],
        },
      },
    };

    const next = [...npcSpriteLibrary, spriteEntry];
    setNpcSpriteLibrary(next);
    setSelectedNpcSpriteId(spriteEntry.id);
    void persistNpcSpriteLibrary(next);
    setStatus(`Saved NPC sprite "${spriteEntry.label}".`);
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

    const dialogueLines = npcDialogueLinesInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const pattern = parseDirectionPattern(npcMovementPatternInput);
    if (npcMovementTypeInput === 'loop' && pattern.length === 0) {
      setError('Loop movement requires at least one direction in pattern.');
      return;
    }

    const movement: NpcMovementDefinition =
      npcMovementTypeInput === 'static'
        ? {
            type: 'static',
          }
        : {
            type: npcMovementTypeInput,
            pattern: npcMovementTypeInput === 'loop' ? pattern : undefined,
            stepIntervalMs: clampInt(parseInteger(npcStepIntervalInput) ?? 850, 180, 4000),
          };

    const characterTemplate: NpcCharacterTemplateEntry = {
      id: makeNpcCharacterId(label, npcCharacterLibrary),
      label,
      npcName,
      color: npcCharacterColorInput || '#9b73b8',
      dialogueId: sanitizeIdentifier(npcDialogueIdInput, 'custom_npc_dialogue'),
      dialogueSpeaker: npcDialogueSpeakerInput.trim() || undefined,
      dialogueLines: dialogueLines.length > 0 ? dialogueLines : undefined,
      dialogueSetFlag: npcDialogueSetFlagInput.trim() || undefined,
      battleTeamIds: parseStringList(npcBattleTeamsInput),
      movement,
      spriteId: selectedNpcSpriteId,
    };

    const next = [...npcCharacterLibrary, characterTemplate];
    setNpcCharacterLibrary(next);
    setSelectedNpcCharacterId(characterTemplate.id);
    setTool('npc-paint');
    void persistNpcCharacterLibrary(next);
    setStatus(`Saved NPC character "${characterTemplate.label}".`);
  };

  const removeNpcTemplate = (templateId: string) => {
    const next = npcCharacterLibrary.filter((template) => template.id !== templateId);
    setNpcCharacterLibrary(next);
    if (selectedNpcCharacterId === templateId) {
      setSelectedNpcCharacterId(next[0]?.id ?? '');
    }
    void persistNpcCharacterLibrary(next);
    setStatus('Removed NPC character.');
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

  return (
    <section className="admin-tool">
      <header className="admin-tool__header">
        <div>
          <h2>Map Editor</h2>
          <p>Create new maps, edit existing ones, and configure warps between maps.</p>
        </div>
        <div className="admin-tool__status">
          {statusMessage && <span className="status-chip">{statusMessage}</span>}
          {errorMessage && <span className="status-chip is-error">{errorMessage}</span>}
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-layout__left">
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
            </div>
            <p className="admin-note">
              Editor starts blank. Load a map, create one, or import JSON to begin.
            </p>
          </section>

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
                Active Layer
                <select
                  value={activeLayer?.id ?? ''}
                  disabled={!hasMapLoaded}
                  onChange={(event) => setActiveLayerId(event.target.value)}
                >
                  {editableMap.layers.map((layer) => (
                    <option key={layer.id} value={layer.id}>
                      {layer.id} - {layer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Layer ID
                <input
                  value={activeLayer?.id ?? ''}
                  disabled={!activeLayer}
                  onChange={(event) => {
                    if (!activeLayer) {
                      return;
                    }
                    const nextId = makeUniqueLayerId(
                      editableMap.layers,
                      activeLayer.id,
                      sanitizeIdentifier(event.target.value, activeLayer.id),
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
          </section>

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
                Tile Code
                <input value="Auto-generated" readOnly />
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
                  <span className="saved-paint-row__meta">
                    {tile.width}x{tile.height} | {tile.cells.length} codes
                  </span>
                  <button type="button" className="secondary" onClick={() => removePaintTile(tile.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

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
                  <button type="button" className="secondary" onClick={() => setTool('warp-from')}>
                    Paint Warp From
                  </button>
                  <button type="button" className="secondary" onClick={() => setTool('warp-to')}>
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

          <section className="admin-panel">
            <h3>NPC Painter</h3>
            <div className="admin-row">
              <button
                type="button"
                className={`secondary ${tool === 'npc-paint' ? 'is-selected' : ''}`}
                onClick={() => setTool('npc-paint')}
              >
                NPC Paint
              </button>
              <button
                type="button"
                className={`secondary ${tool === 'npc-erase' ? 'is-selected' : ''}`}
                onClick={() => setTool('npc-erase')}
              >
                NPC Erase
              </button>
              <button type="button" className="secondary" onClick={loadNpcTemplatesFromDatabase}>
                Load NPC Catalog
              </button>
            </div>

            <h4>Sprite Library</h4>
            <div className="admin-grid-2">
              <label>
                Sprite Label
                <input value={npcSpriteLabelInput} onChange={(event) => setNpcSpriteLabelInput(event.target.value)} />
              </label>
            </div>

            <h4>NPC Spritesheet</h4>
            <div className="admin-grid-2">
              <label>
                Sheet URL
                <input value={npcSpriteUrlInput} onChange={(event) => setNpcSpriteUrlInput(event.target.value)} />
              </label>
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
            <div className="admin-row">
              <button type="button" className="secondary" onClick={applyNpcSpriteUrl}>
                Apply NPC Sheet URL
              </button>
              <button type="button" className="secondary" onClick={loadExampleNpcSprite}>
                Use Example NPC Sheet
              </button>
              <button type="button" className="secondary" onClick={autoFillNpcFramesFrom4x4}>
                Auto Fill 4x4 D/L/R/U
              </button>
            </div>
            <p className="admin-note">
              For a 4x4 sheet at 32x32 frames: rows are Down, Left, Right, Up.
            </p>
            <p className="admin-note">
              Default NPC size: render 1 tile wide x 2 tiles tall (16x32 world pixels).
            </p>
            <p className="admin-note">
              {npcSpriteMeta.loaded
                ? `Loaded ${npcSpriteMeta.width}x${npcSpriteMeta.height} (${npcSpriteMeta.columns} columns x ${npcSpriteMeta.rows} rows)`
                : npcSpriteMeta.error ?? 'No NPC sheet loaded.'}
            </p>
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
                Assign Direction
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
              <label>
                Assign Mode
                <select
                  value={npcAssignMode}
                  onChange={(event) => setNpcAssignMode(event.target.value as 'idle' | 'walk')}
                >
                  <option value="idle">Idle Frame</option>
                  <option value="walk">Walk Frame Toggle</option>
                </select>
              </label>
              <button type="button" className="secondary" onClick={assignNpcFrameFromAtlas}>
                Assign Selected Rectangle
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
                  {Array.from({ length: npcAtlasCellCount }, (_, frameIndex) => {
                    const isIdleSelected = npcFacingFrames[npcAssignDirection] === frameIndex;
                    const isWalkSelected = npcWalkFrames[npcAssignDirection].includes(frameIndex);
                    return (
                      <button
                        key={`npc-frame-${frameIndex}`}
                        type="button"
                        className={`tileset-grid__cell ${
                          isIdleSelected ||
                          isWalkSelected ||
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

            <div className="admin-grid-2">
              {(Object.keys(npcFacingFrames) as Direction[]).map((direction) => (
                <label key={`npc-facing-${direction}`}>
                  {direction} Idle
                  <input value={String(npcFacingFrames[direction])} readOnly />
                </label>
              ))}
            </div>
            <p className="admin-note">
              Walk Frames: up[{npcWalkFrames.up.join(', ')}] down[{npcWalkFrames.down.join(', ')}] left[
              {npcWalkFrames.left.join(', ')}] right[{npcWalkFrames.right.join(', ')}]
            </p>
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
                      setNpcSpriteUrlInput(sprite.sprite.url);
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

            <h4>Character Library</h4>
            <div className="admin-grid-2">
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
                Sprite
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
                Dialogue ID (fallback)
                <input value={npcDialogueIdInput} onChange={(event) => setNpcDialogueIdInput(event.target.value)} />
              </label>
              <label>
                Dialogue Speaker
                <input value={npcDialogueSpeakerInput} onChange={(event) => setNpcDialogueSpeakerInput(event.target.value)} />
              </label>
              <label>
                Set Flag On Complete
                <input value={npcDialogueSetFlagInput} onChange={(event) => setNpcDialogueSetFlagInput(event.target.value)} />
              </label>
              <label>
                Movement Type
                <select
                  value={npcMovementTypeInput}
                  onChange={(event) => setNpcMovementTypeInput(event.target.value as 'static' | 'loop' | 'random')}
                >
                  <option value="static">Static</option>
                  <option value="loop">Loop Pattern</option>
                  <option value="random">Random Wander</option>
                </select>
              </label>
              <label>
                Step Interval (ms)
                <input value={npcStepIntervalInput} onChange={(event) => setNpcStepIntervalInput(event.target.value)} />
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
            <label>
              Loop Pattern (comma-separated: up, right, down, left)
              <input
                value={npcMovementPatternInput}
                onChange={(event) => setNpcMovementPatternInput(event.target.value)}
              />
            </label>
            <label>
              Battle Team IDs (comma-separated, future use)
              <input
                value={npcBattleTeamsInput}
                onChange={(event) => setNpcBattleTeamsInput(event.target.value)}
              />
            </label>
            <button type="button" className="secondary" onClick={saveNpcTemplate}>
              Save Character
            </button>
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
                    onClick={() => {
                      setSelectedNpcCharacterId(template.id);
                      setNpcCharacterLabelInput(template.label);
                      setNpcCharacterNameInput(template.npcName);
                      setNpcCharacterColorInput(template.color);
                      setNpcDialogueIdInput(template.dialogueId);
                      setNpcDialogueSpeakerInput(template.dialogueSpeaker ?? '');
                      setNpcDialogueLinesInput((template.dialogueLines ?? []).join('\n'));
                      setNpcDialogueSetFlagInput(template.dialogueSetFlag ?? '');
                      setNpcMovementTypeInput(template.movement?.type ?? 'static');
                      setNpcMovementPatternInput((template.movement?.pattern ?? []).join(', '));
                      setNpcStepIntervalInput(String(template.movement?.stepIntervalMs ?? 850));
                      setNpcBattleTeamsInput((template.battleTeamIds ?? []).join(', '));
                      setSelectedNpcSpriteId(template.spriteId ?? '');
                    }}
                  >
                    Use
                  </button>
                  <span className="saved-paint-row__meta">{template.label}</span>
                  <span className="saved-paint-row__meta">{template.npcName}</span>
                  <span className="saved-paint-row__meta">
                    {template.spriteId ?? 'No Sprite'}
                  </span>
                  <span className="saved-paint-row__meta">{template.movement?.type ?? 'static'}</span>
                  <button type="button" className="secondary" onClick={() => removeNpcTemplate(template.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

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
        </aside>

        <main className="admin-layout__center">
          <section className="admin-panel">
            <h3>Paint Tools</h3>
            <div className="admin-row">
              <button
                type="button"
                className={`secondary ${tool === 'paint' ? 'is-selected' : ''}`}
                onClick={() => setTool('paint')}
              >
                Paint
              </button>
              <button
                type="button"
                className={`secondary ${tool === 'paint-rotated' ? 'is-selected' : ''}`}
                onClick={() => setTool('paint-rotated')}
              >
                Paint Rotated
              </button>
              <button
                type="button"
                className={`secondary ${tool === 'erase' ? 'is-selected' : ''}`}
                onClick={() => setTool('erase')}
              >
                Erase (Blank)
              </button>
              <button
                type="button"
                className={`secondary ${tool === 'fill' ? 'is-selected' : ''}`}
                onClick={() => setTool('fill')}
              >
                Fill
              </button>
              <button
                type="button"
                className={`secondary ${tool === 'pick' ? 'is-selected' : ''}`}
                onClick={() => setTool('pick')}
              >
                Eyedropper
              </button>
              <button
                type="button"
                className={`secondary ${tool === 'npc-paint' ? 'is-selected' : ''}`}
                onClick={() => setTool('npc-paint')}
              >
                NPC Paint
              </button>
              <button
                type="button"
                className={`secondary ${tool === 'npc-erase' ? 'is-selected' : ''}`}
                onClick={() => setTool('npc-erase')}
              >
                NPC Erase
              </button>
              <button
                type="button"
                className={`secondary ${tool === 'collision-edge' ? 'is-selected' : ''}`}
                onClick={() => setTool('collision-edge')}
              >
                Collision Edges
              </button>
              <button type="button" className="secondary" onClick={removeSelectedPaintTile} disabled={!selectedPaintTile}>
                Remove Selected Paint Tile
              </button>
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
                      {tile.width}x{tile.height} | {tile.cells.length} cells
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="admin-note">
              Hover: {hoveredCell ? `${hoveredCell.x}, ${hoveredCell.y}` : '-'} | Current Tool: {tool} | Selected Tile:
              {' '}
              {selectedTileCode} | Active Layer: {activeLayer?.id ?? '-'} | Collision Mask: 0x
              {selectedCollisionEdgeMask.toString(16)} | NPC Character: {selectedNpcCharacter?.label ?? '-'}
            </p>
          </section>

          <section className="admin-panel admin-panel--grow">
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
                          const npcMarker = npcByCell.get(cellKey) ?? null;
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

                          return (
                            <button
                              key={`${x}-${y}`}
                              type="button"
                              className={`map-grid__cell ${selectedWarpMarker ? 'is-warp-from' : ''} ${selectedWarpTarget ? 'is-warp-to' : ''} ${hoverStampCells.has(cellKey) ? 'is-stamp-preview' : ''}`}
                              style={{
                                width: `${cellSize}px`,
                                height: `${cellSize}px`,
                              }}
                              onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                                if (event.button === 2) {
                                  event.preventDefault();
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
                                applyPaintTool(x, y, 'click');
                              }}
                              onContextMenu={(event) => event.preventDefault()}
                              onMouseEnter={() => {
                                setHoveredCell({ x, y });
                                if (isDrawing) {
                                  applyPaintTool(x, y, 'drag');
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
                              {npcMarker && (
                                <span className="map-grid__npc-badge" style={{ backgroundColor: npcMarker.color }}>
                                  {npcMarker.name.slice(0, 1).toUpperCase() || 'N'}
                                </span>
                              )}
                              {warpMarker.length > 0 && <span className="map-grid__warp-badge">W{warpMarker.length}</span>}
                              {hoverStampCells.has(cellKey) && <span className="map-grid__stamp-shadow" />}
                            </button>
                          );
                        }),
                      )}
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
    color: template.color || '#9b73b8',
    dialogueId: template.dialogueId || 'custom_npc_dialogue',
    dialogueSpeaker: template.dialogueSpeaker,
    dialogueLines: template.dialogueLines ? [...template.dialogueLines] : undefined,
    dialogueSetFlag: template.dialogueSetFlag,
    battleTeamIds: template.battleTeamIds ? [...template.battleTeamIds] : undefined,
    movement: template.movement
      ? {
          ...template.movement,
          pattern: template.movement.pattern ? [...template.movement.pattern] : undefined,
        }
      : undefined,
    sprite: resolvedSprite
      ? {
          ...resolvedSprite,
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

function makeUniqueLayerId(existing: EditableMapLayer[], currentId: string, nextId: string): string {
  const safeId = sanitizeIdentifier(nextId, currentId);
  if (safeId === currentId) {
    return currentId;
  }

  const usedIds = new Set(existing.filter((layer) => layer.id !== currentId).map((layer) => layer.id));
  if (!usedIds.has(safeId)) {
    return safeId;
  }

  let suffix = 2;
  while (suffix < 5000) {
    const candidate = `${safeId}-${suffix}`;
    if (!usedIds.has(candidate)) {
      return candidate;
    }
    suffix += 1;
  }

  return `${safeId}-${Date.now()}`;
}

function pseudoRandomQuarter(x: number, y: number): number {
  const hash = (x * 73856093) ^ (y * 19349663);
  return Math.abs(hash) % 4;
}

function rotateStampCells(
  tile: SavedPaintTile,
  rotationQuarter: number,
): Array<{ code: EditorTileCode; dx: number; dy: number; rotationQuarter: number }> {
  const quarter = ((rotationQuarter % 4) + 4) % 4;

  return tile.cells.map((cell) => {
    switch (quarter) {
      case 1:
        return {
          code: cell.code,
          dx: tile.height - 1 - cell.dy,
          dy: cell.dx,
          rotationQuarter: 1,
        };
      case 2:
        return {
          code: cell.code,
          dx: tile.width - 1 - cell.dx,
          dy: tile.height - 1 - cell.dy,
          rotationQuarter: 2,
        };
      case 3:
        return {
          code: cell.code,
          dx: cell.dy,
          dy: tile.width - 1 - cell.dx,
          rotationQuarter: 3,
        };
      default:
        return {
          code: cell.code,
          dx: cell.dx,
          dy: cell.dy,
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

function buildWarnings(map: EditableMap, savedCustomTileCodes: Set<string>): string[] {
  const warnings: string[] = [];
  const { width, height } = getMapSize(map);
  const unknownTileCodes = new Set<string>();

  if (map.layers.length === 0) {
    warnings.push('Map has no layers.');
    return warnings;
  }

  for (const layer of map.layers) {
    if (!layer.id.trim()) {
      warnings.push('Layer with empty id detected.');
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
    if (npc.movement?.type === 'loop' && (!npc.movement.pattern || npc.movement.pattern.length === 0)) {
      warnings.push(`NPC ${npc.id} has loop movement but no pattern directions.`);
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

  const knownMapIds = new Set(WORLD_MAPS.map((entry) => entry.id));
  for (const warp of map.warps) {
    if (!knownMapIds.has(warp.toMapId) && warp.toMapId !== map.id) {
      warnings.push(`Warp ${warp.id} targets unknown map id "${warp.toMapId}".`);
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

    return {
      id,
      name,
      primaryCode,
      width,
      height,
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
      dialogueId?: unknown;
      dialogueSpeaker?: unknown;
      dialogueLines?: unknown;
      dialogueSetFlag?: unknown;
      battleTeamIds?: unknown;
      movement?: unknown;
      spriteId?: unknown;
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

    characters.push({
      id: typeof record.id === 'string' && record.id.trim() ? record.id : `npc-character-${Date.now()}`,
      label,
      npcName,
      color: typeof record.color === 'string' && record.color ? record.color : '#9b73b8',
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
      battleTeamIds: battleTeamIds && battleTeamIds.length > 0 ? battleTeamIds : undefined,
      movement: sanitizeNpcMovement(record.movement),
      spriteId:
        typeof record.spriteId === 'string' && record.spriteId.trim() ? record.spriteId.trim() : undefined,
    });
  }

  return characters;
}

function parseStringList(value: string): string[] | undefined {
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return entries.length > 0 ? entries : undefined;
}

function sanitizeNpcMovement(raw: unknown): NpcMovementDefinition | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const record = raw as {
    type?: unknown;
    pattern?: unknown;
    stepIntervalMs?: unknown;
  };
  const type =
    record.type === 'loop' || record.type === 'random' || record.type === 'static'
      ? record.type
      : 'static';
  const pattern = Array.isArray(record.pattern)
    ? record.pattern.filter((entry): entry is Direction => entry === 'up' || entry === 'down' || entry === 'left' || entry === 'right')
    : undefined;
  const stepIntervalMs =
    typeof record.stepIntervalMs === 'number' ? clampInt(record.stepIntervalMs, 180, 4000) : undefined;

  return {
    type,
    pattern: pattern && pattern.length > 0 ? pattern : undefined,
    stepIntervalMs,
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
    facingFrames?: unknown;
    walkFrames?: unknown;
  };
  if (typeof record.url !== 'string' || !record.url.trim()) {
    return undefined;
  }
  const frameWidth = typeof record.frameWidth === 'number' ? Math.max(1, Math.floor(record.frameWidth)) : 32;
  const frameHeight = typeof record.frameHeight === 'number' ? Math.max(1, Math.floor(record.frameHeight)) : 32;
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
    facingFrames,
    walkFrames,
  };
}
