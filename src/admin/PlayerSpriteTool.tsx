import { ChangeEvent, CSSProperties, useEffect, useMemo, useState } from 'react';
import { PLAYER_SPRITE_CONFIG } from '@/game/world/playerSprite';
import type { Direction } from '@/shared/types';
import { apiFetchJson } from '@/shared/apiClient';

interface AtlasMeta {
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

interface SavePlayerSpriteResponse {
  ok: boolean;
  error?: string;
  filePath?: string;
}

interface LoadPlayerSpriteResponse {
  ok: boolean;
  playerSprite?: NpcSpriteConfigPayload;
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

interface NpcSpriteConfigPayload {
  url: string;
  frameWidth: number;
  frameHeight: number;
  atlasCellWidth?: number;
  atlasCellHeight?: number;
  frameCellsWide?: number;
  frameCellsTall?: number;
  renderWidthTiles?: number;
  renderHeightTiles?: number;
  animationSets?: Partial<Record<string, Partial<Record<Direction, number[]>>>>;
  defaultIdleAnimation?: string;
  defaultMoveAnimation?: string;
  facingFrames: Record<Direction, number>;
  walkFrames?: Partial<Record<Direction, number[]>>;
}

const ATLAS_PREVIEW_SIZE = 28;
const MAX_ATLAS_PREVIEW_CELLS = 4096;
const DEFAULT_SUPABASE_BUCKET = 'character-spritesheets';

export function PlayerSpriteTool() {
  const defaultAtlasCellWidth = Math.max(1, PLAYER_SPRITE_CONFIG.atlasCellWidth ?? PLAYER_SPRITE_CONFIG.frameWidth);
  const defaultAtlasCellHeight = Math.max(1, PLAYER_SPRITE_CONFIG.atlasCellHeight ?? PLAYER_SPRITE_CONFIG.frameHeight);
  const defaultFrameCellsWide = Math.max(
    1,
    PLAYER_SPRITE_CONFIG.frameCellsWide ?? Math.round(PLAYER_SPRITE_CONFIG.frameWidth / defaultAtlasCellWidth),
  );
  const defaultFrameCellsTall = Math.max(
    1,
    PLAYER_SPRITE_CONFIG.frameCellsTall ?? Math.round(PLAYER_SPRITE_CONFIG.frameHeight / defaultAtlasCellHeight),
  );
  const [spriteLabel] = useState('Player Sprite');
  const [spriteUrl, setSpriteUrl] = useState('');
  const [frameWidthInput, setFrameWidthInput] = useState(
    String(defaultAtlasCellWidth),
  );
  const [frameHeightInput, setFrameHeightInput] = useState(
    String(defaultAtlasCellHeight),
  );
  const [frameCellsWideInput, setFrameCellsWideInput] = useState(String(defaultFrameCellsWide));
  const [frameCellsTallInput, setFrameCellsTallInput] = useState(String(defaultFrameCellsTall));
  const [renderWidthTilesInput, setRenderWidthTilesInput] = useState(
    String(PLAYER_SPRITE_CONFIG.renderWidthTiles ?? 1),
  );
  const [renderHeightTilesInput, setRenderHeightTilesInput] = useState(
    String(PLAYER_SPRITE_CONFIG.renderHeightTiles ?? 2),
  );
  const [atlasMeta, setAtlasMeta] = useState<AtlasMeta>({
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
  const [assignDirection, setAssignDirection] = useState<Direction>('down');
  const [selectedAnimationName, setSelectedAnimationName] = useState('walk');
  const [newAnimationNameInput, setNewAnimationNameInput] = useState('');
  const [renameAnimationNameInput, setRenameAnimationNameInput] = useState('');
  const [facingFrames, setFacingFrames] = useState<Record<Direction, number>>({
    up: PLAYER_SPRITE_CONFIG.facingFrames.up,
    down: PLAYER_SPRITE_CONFIG.facingFrames.down,
    left: PLAYER_SPRITE_CONFIG.facingFrames.left,
    right: PLAYER_SPRITE_CONFIG.facingFrames.right,
  });
  const [walkFrames, setWalkFrames] = useState<Record<Direction, number[]>>({
    up: [...(PLAYER_SPRITE_CONFIG.walkFrames?.up ?? [])],
    down: [...(PLAYER_SPRITE_CONFIG.walkFrames?.down ?? [])],
    left: [...(PLAYER_SPRITE_CONFIG.walkFrames?.left ?? [])],
    right: [...(PLAYER_SPRITE_CONFIG.walkFrames?.right ?? [])],
  });
  const [defaultIdleAnimationInput, setDefaultIdleAnimationInput] = useState(
    PLAYER_SPRITE_CONFIG.defaultIdleAnimation ?? 'idle',
  );
  const [defaultMoveAnimationInput, setDefaultMoveAnimationInput] = useState(
    PLAYER_SPRITE_CONFIG.defaultMoveAnimation ?? 'walk',
  );
  const [animationSetsInput, setAnimationSetsInput] = useState(
    stringifyDirectionalAnimationSets(
      sanitizeDirectionalAnimationSets(
        PLAYER_SPRITE_CONFIG.animationSets && Object.keys(PLAYER_SPRITE_CONFIG.animationSets).length > 0
          ? PLAYER_SPRITE_CONFIG.animationSets
          : buildDirectionalAnimationSetsFromLegacyFrames(
              PLAYER_SPRITE_CONFIG.facingFrames,
              {
                up: [...(PLAYER_SPRITE_CONFIG.walkFrames?.up ?? [])],
                down: [...(PLAYER_SPRITE_CONFIG.walkFrames?.down ?? [])],
                left: [...(PLAYER_SPRITE_CONFIG.walkFrames?.left ?? [])],
                right: [...(PLAYER_SPRITE_CONFIG.walkFrames?.right ?? [])],
              },
            ),
      ),
    ),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [spritesheetBucketInput, setSpritesheetBucketInput] = useState(DEFAULT_SUPABASE_BUCKET);
  const [spritesheetPrefixInput, setSpritesheetPrefixInput] = useState('');
  const [spritesheetSearchInput, setSpritesheetSearchInput] = useState('');
  const [spritesheetEntries, setSpritesheetEntries] = useState<SupabaseSpriteSheetListItem[]>([]);
  const [isLoadingSpritesheetEntries, setIsLoadingSpritesheetEntries] = useState(false);
  const [selectedSpritesheetPath, setSelectedSpritesheetPath] = useState('');

  const atlasCellCount = Math.max(0, atlasMeta.columns * atlasMeta.rows);
  const previewCellCount = Math.min(atlasCellCount, MAX_ATLAS_PREVIEW_CELLS);
  const isPreviewTruncated = atlasCellCount > previewCellCount;
  const selectedAtlasRect = buildAtlasSelectionRect(
    selectedAtlasStartIndex,
    selectedAtlasEndIndex,
    atlasMeta.columns,
    atlasMeta.rows,
  );
  const parsedAnimationSetsResult = parseDirectionalAnimationSetsInput(animationSetsInput, facingFrames, walkFrames);
  const parsedAnimationSets = parsedAnimationSetsResult.ok
    ? parsedAnimationSetsResult.animationSets
    : sanitizeDirectionalAnimationSets(buildDirectionalAnimationSetsFromLegacyFrames(facingFrames, walkFrames));
  const animationNames = Object.keys(parsedAnimationSets);
  const selectedAnimationFramesForDirection = selectedAnimationName
    ? parsedAnimationSets[selectedAnimationName]?.[assignDirection] ?? []
    : [];
  const filteredSpritesheetEntries = useMemo(() => {
    const query = spritesheetSearchInput.trim().toLowerCase();
    const sorted = [...spritesheetEntries].sort((left, right) =>
      left.path.localeCompare(right.path, undefined, { sensitivity: 'base' }),
    );
    if (!query) {
      return sorted;
    }
    return sorted.filter(
      (entry) => entry.name.toLowerCase().includes(query) || entry.path.toLowerCase().includes(query),
    );
  }, [spritesheetEntries, spritesheetSearchInput]);

  useEffect(() => {
    let cancelled = false;
    const frameWidth = parseInteger(frameWidthInput);
    const frameHeight = parseInteger(frameHeightInput);

    if (!spriteUrl) {
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
    if (!frameWidth || !frameHeight) {
      setAtlasMeta({
        loaded: false,
        width: 0,
        height: 0,
        columns: 0,
        rows: 0,
        error: 'Set frame width and height before loading sheet grid.',
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
        setAtlasMeta({
          loaded: false,
          width: image.width,
          height: image.height,
          columns: 0,
          rows: 0,
          error: `Sheet is smaller than one frame (${frameWidth}x${frameHeight}).`,
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
        error: `Unable to load sheet from ${spriteUrl}`,
      }));
    };
    image.src = spriteUrl;

    return () => {
      cancelled = true;
    };
  }, [frameHeightInput, frameWidthInput, spriteUrl]);

  useEffect(() => {
    if (atlasCellCount <= 0) {
      setSelectedAtlasStartIndex(null);
      setSelectedAtlasEndIndex(null);
      return;
    }
    const maxIndex = Math.max(0, atlasCellCount - 1);
    setFacingFrames((current) => ({
      up: clampInt(current.up, 0, maxIndex),
      down: clampInt(current.down, 0, maxIndex),
      left: clampInt(current.left, 0, maxIndex),
      right: clampInt(current.right, 0, maxIndex),
    }));
    setWalkFrames((current) => ({
      up: current.up.map((value) => clampInt(value, 0, maxIndex)),
      down: current.down.map((value) => clampInt(value, 0, maxIndex)),
      left: current.left.map((value) => clampInt(value, 0, maxIndex)),
      right: current.right.map((value) => clampInt(value, 0, maxIndex)),
    }));
    setSelectedAtlasStartIndex((current) => (current === null ? null : clampInt(current, 0, maxIndex)));
    setSelectedAtlasEndIndex((current) => (current === null ? null : clampInt(current, 0, maxIndex)));
  }, [atlasCellCount]);

  useEffect(() => {
    const onMouseUp = () => {
      setIsSelectingAtlas(false);
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    if (!selectedAnimationName || !animationNames.includes(selectedAnimationName)) {
      const fallbackName = animationNames.includes('walk') ? 'walk' : animationNames[0] ?? '';
      setSelectedAnimationName(fallbackName);
    }
  }, [animationNames, selectedAnimationName]);

  useEffect(() => {
    if (!selectedAnimationName) {
      setRenameAnimationNameInput('');
      return;
    }
    setRenameAnimationNameInput(selectedAnimationName);
  }, [selectedAnimationName]);

  const setStatus = (message: string) => {
    setStatusMessage(message);
    setErrorMessage(null);
  };

  const setError = (message: string) => {
    setErrorMessage(message);
    setStatusMessage(null);
  };

  const applySpriteConfigState = (config: NpcSpriteConfigPayload) => {
    const atlasCellWidth = Math.max(1, config.atlasCellWidth ?? config.frameWidth);
    const atlasCellHeight = Math.max(1, config.atlasCellHeight ?? config.frameHeight);
    const frameCellsWide = Math.max(
      1,
      config.frameCellsWide ?? Math.round(config.frameWidth / Math.max(1, atlasCellWidth)),
    );
    const frameCellsTall = Math.max(
      1,
      config.frameCellsTall ?? Math.round(config.frameHeight / Math.max(1, atlasCellHeight)),
    );

    setSpriteUrl(config.url);
    setFrameWidthInput(String(atlasCellWidth));
    setFrameHeightInput(String(atlasCellHeight));
    setFrameCellsWideInput(String(frameCellsWide));
    setFrameCellsTallInput(String(frameCellsTall));
    setRenderWidthTilesInput(String(config.renderWidthTiles ?? 1));
    setRenderHeightTilesInput(String(config.renderHeightTiles ?? 2));
    setFacingFrames({ ...config.facingFrames });
    setWalkFrames({
      up: [...(config.walkFrames?.up ?? [])],
      down: [...(config.walkFrames?.down ?? [])],
      left: [...(config.walkFrames?.left ?? [])],
      right: [...(config.walkFrames?.right ?? [])],
    });
    const nextFacingFrames = { ...config.facingFrames };
    const nextWalkFrames = {
      up: [...(config.walkFrames?.up ?? [])],
      down: [...(config.walkFrames?.down ?? [])],
      left: [...(config.walkFrames?.left ?? [])],
      right: [...(config.walkFrames?.right ?? [])],
    };
    const nextAnimationSets = sanitizeDirectionalAnimationSets(
      config.animationSets && Object.keys(config.animationSets).length > 0
        ? config.animationSets
        : buildDirectionalAnimationSetsFromLegacyFrames(nextFacingFrames, nextWalkFrames),
    );
    setAnimationSetsInput(stringifyDirectionalAnimationSets(nextAnimationSets));
    const nextIdleAnimation = config.defaultIdleAnimation ?? 'idle';
    const nextMoveAnimation = config.defaultMoveAnimation ?? 'walk';
    const nextAnimationNames = Object.keys(nextAnimationSets);
    const nextSelectedAnimation = nextAnimationNames.includes(nextMoveAnimation)
      ? nextMoveAnimation
      : nextAnimationNames.includes('walk')
        ? 'walk'
        : nextAnimationNames[0] ?? '';
    setSelectedAnimationName(nextSelectedAnimation);
    setDefaultIdleAnimationInput(nextIdleAnimation);
    setDefaultMoveAnimationInput(nextMoveAnimation);
  };

  useEffect(() => {
    const loadFromDatabase = async () => {
      const result = await apiFetchJson<LoadPlayerSpriteResponse>('/api/admin/player-sprite/get');
      if (!result.ok || !result.data?.playerSprite) {
        return;
      }
      applySpriteConfigState(result.data.playerSprite);
      setStatus('Loaded player sprite config from database.');
    };

    void loadFromDatabase();
  }, []);

  const loadSupabaseSpriteSheets = async () => {
    const bucket = spritesheetBucketInput.trim() || DEFAULT_SUPABASE_BUCKET;
    const prefix = spritesheetPrefixInput.trim();
    const params = new URLSearchParams();
    params.set('bucket', bucket);
    if (prefix) {
      params.set('prefix', prefix);
    }
    setIsLoadingSpritesheetEntries(true);
    try {
      const result = await apiFetchJson<LoadSupabaseSpriteSheetsResponse>(
        `/api/admin/spritesheets/list?${params.toString()}`,
      );
      if (!result.ok || !result.data?.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load spritesheets from Supabase.');
      }
      const loadedSheets = Array.isArray(result.data.spritesheets) ? result.data.spritesheets : [];
      setSpritesheetEntries(loadedSheets);
      setStatus(`Loaded ${loadedSheets.length} spritesheet(s) from bucket "${bucket}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load spritesheets from Supabase.';
      setError(message);
    } finally {
      setIsLoadingSpritesheetEntries(false);
    }
  };

  useEffect(() => {
    void loadSupabaseSpriteSheets();
    // Run once on mount with the default bucket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAnimationSetsDraft = (nextSets: DirectionalAnimationSets) => {
    const sanitized = sanitizeDirectionalAnimationSets(nextSets);
    const safeSets =
      Object.keys(sanitized).length > 0
        ? sanitized
        : sanitizeDirectionalAnimationSets(buildDirectionalAnimationSetsFromLegacyFrames(facingFrames, walkFrames));
    setAnimationSetsInput(stringifyDirectionalAnimationSets(safeSets));
  };

  const onSpriteFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    event.target.value = '';
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSpriteUrl(dataUrl);
      setStatus(`Loaded and applied sprite file ${file.name}`);
    } catch {
      setError(`Unable to read sprite file ${file.name}.`);
    }
  };

  const autoFillFrom4x4 = () => {
    const nextFacingFrames: Record<Direction, number> = {
      down: 0,
      left: 4,
      right: 8,
      up: 12,
    };
    const nextWalkFrames: Record<Direction, number[]> = {
      down: [1, 2, 3],
      left: [5, 6, 7],
      right: [9, 10, 11],
      up: [13, 14, 15],
    };
    setFrameCellsWideInput('1');
    setFrameCellsTallInput('1');
    setFacingFrames(nextFacingFrames);
    setWalkFrames(nextWalkFrames);
    setAnimationSetsDraft(buildDirectionalAnimationSetsFromLegacyFrames(nextFacingFrames, nextWalkFrames));
    setDefaultIdleAnimationInput('idle');
    setDefaultMoveAnimationInput('walk');
    setSelectedAnimationName('walk');
    setStatus('Applied 4x4 row preset (Down, Left, Right, Up).');
  };

  const addAnimation = () => {
    const animationName = newAnimationNameInput.trim();
    if (!animationName) {
      setError('Animation name is required.');
      return;
    }
    if (parsedAnimationSets[animationName]) {
      setError(`Animation "${animationName}" already exists.`);
      return;
    }
    setAnimationSetsDraft({
      ...parsedAnimationSets,
      [animationName]: {
        up: [],
        down: [],
        left: [],
        right: [],
      },
    });
    setSelectedAnimationName(animationName);
    setNewAnimationNameInput('');
    setStatus(`Added animation "${animationName}".`);
  };

  const renameSelectedAnimation = () => {
    if (!selectedAnimationName) {
      setError('Select an animation to rename.');
      return;
    }
    const nextName = renameAnimationNameInput.trim();
    if (!nextName) {
      setError('New animation name is required.');
      return;
    }
    if (nextName !== selectedAnimationName && parsedAnimationSets[nextName]) {
      setError(`Animation "${nextName}" already exists.`);
      return;
    }

    const currentSet = parsedAnimationSets[selectedAnimationName];
    if (!currentSet) {
      setError('Selected animation no longer exists.');
      return;
    }
    const nextSets: DirectionalAnimationSets = {};
    for (const [name, set] of Object.entries(parsedAnimationSets)) {
      if (name === selectedAnimationName) {
        nextSets[nextName] = set;
      } else {
        nextSets[name] = set;
      }
    }
    setAnimationSetsDraft(nextSets);
    setSelectedAnimationName(nextName);
    if (defaultIdleAnimationInput.trim() === selectedAnimationName) {
      setDefaultIdleAnimationInput(nextName);
    }
    if (defaultMoveAnimationInput.trim() === selectedAnimationName) {
      setDefaultMoveAnimationInput(nextName);
    }
    setStatus(`Renamed animation "${selectedAnimationName}" to "${nextName}".`);
  };

  const deleteSelectedAnimation = () => {
    if (!selectedAnimationName) {
      setError('Select an animation to delete.');
      return;
    }
    const names = Object.keys(parsedAnimationSets);
    if (names.length <= 1) {
      setError('At least one animation must remain.');
      return;
    }

    const nextSets: DirectionalAnimationSets = {};
    for (const [name, set] of Object.entries(parsedAnimationSets)) {
      if (name === selectedAnimationName) {
        continue;
      }
      nextSets[name] = set;
    }
    const nextNames = Object.keys(nextSets);
    const fallbackName = nextNames.includes('walk') ? 'walk' : nextNames[0];
    setAnimationSetsDraft(nextSets);
    setSelectedAnimationName(fallbackName ?? '');
    if (defaultIdleAnimationInput.trim() === selectedAnimationName) {
      setDefaultIdleAnimationInput(fallbackName ?? 'idle');
    }
    if (defaultMoveAnimationInput.trim() === selectedAnimationName) {
      setDefaultMoveAnimationInput(fallbackName ?? 'walk');
    }
    setStatus(`Deleted animation "${selectedAnimationName}".`);
  };

  const addSelectedFrameToAnimation = () => {
    if (!selectedAtlasRect || atlasMeta.columns <= 0) {
      setError('Select a rectangle on the sheet first.');
      return;
    }
    if (!selectedAnimationName) {
      setError('Select an animation before adding frames.');
      return;
    }

    const frameIndex = selectedAtlasRect.minRow * atlasMeta.columns + selectedAtlasRect.minCol;
    setFrameCellsWideInput(String(selectedAtlasRect.width));
    setFrameCellsTallInput(String(selectedAtlasRect.height));
    const currentSet = parsedAnimationSets[selectedAnimationName] ?? {};
    const currentFrames = currentSet[assignDirection] ? [...currentSet[assignDirection]!] : [];
    if (!currentFrames.includes(frameIndex)) {
      currentFrames.push(frameIndex);
    }
    setAnimationSetsDraft({
      ...parsedAnimationSets,
      [selectedAnimationName]: {
        ...currentSet,
        [assignDirection]: currentFrames,
      },
    });
    setStatus(
      `Added frame ${frameIndex} to "${selectedAnimationName}" ${assignDirection} (${selectedAtlasRect.width}x${selectedAtlasRect.height} cells).`,
    );
  };

  const removeFrameFromAnimation = (frameIndex: number) => {
    if (!selectedAnimationName) {
      return;
    }
    const currentSet = parsedAnimationSets[selectedAnimationName] ?? {};
    const currentFrames = currentSet[assignDirection] ? [...currentSet[assignDirection]!] : [];
    const nextFrames = currentFrames.filter((entry) => entry !== frameIndex);
    setAnimationSetsDraft({
      ...parsedAnimationSets,
      [selectedAnimationName]: {
        ...currentSet,
        [assignDirection]: nextFrames,
      },
    });
    setStatus(`Removed frame ${frameIndex} from "${selectedAnimationName}" ${assignDirection}.`);
  };

  const clearDirectionFrames = () => {
    if (!selectedAnimationName) {
      return;
    }
    const currentSet = parsedAnimationSets[selectedAnimationName] ?? {};
    setAnimationSetsDraft({
      ...parsedAnimationSets,
      [selectedAnimationName]: {
        ...currentSet,
        [assignDirection]: [],
      },
    });
    setStatus(`Cleared frames for "${selectedAnimationName}" ${assignDirection}.`);
  };

  const saveToProject = async () => {
    const atlasCellWidth = parseInteger(frameWidthInput);
    const atlasCellHeight = parseInteger(frameHeightInput);
    const frameCellsWide = parseInteger(frameCellsWideInput);
    const frameCellsTall = parseInteger(frameCellsTallInput);
    const renderWidthTiles = parseInteger(renderWidthTilesInput);
    const renderHeightTiles = parseInteger(renderHeightTilesInput);
    if (
      !spriteUrl.trim() ||
      !atlasCellWidth ||
      !atlasCellHeight ||
      !frameCellsWide ||
      !frameCellsTall ||
      !renderWidthTiles ||
      !renderHeightTiles
    ) {
      setError('Sprite URL, atlas cell size, frame span, and render tile size are required.');
      return;
    }
    const frameWidth = atlasCellWidth * frameCellsWide;
    const frameHeight = atlasCellHeight * frameCellsTall;
    const parsedSets = parseDirectionalAnimationSetsInput(animationSetsInput, facingFrames, walkFrames);
    if (!parsedSets.ok) {
      setError(parsedSets.error);
      return;
    }
    const defaultIdleAnimation = defaultIdleAnimationInput.trim() || 'idle';
    const defaultMoveAnimation = defaultMoveAnimationInput.trim() || 'walk';
    if (!parsedSets.animationSets[defaultIdleAnimation]) {
      setError(`Default idle animation "${defaultIdleAnimation}" is not defined in animation sets.`);
      return;
    }
    if (!parsedSets.animationSets[defaultMoveAnimation]) {
      setError(`Default move animation "${defaultMoveAnimation}" is not defined in animation sets.`);
      return;
    }
    const legacyFrames = deriveLegacyFramesFromAnimationSets(
      parsedSets.animationSets,
      defaultIdleAnimation,
      defaultMoveAnimation,
    );

    setIsSaving(true);
    try {
      const result = await apiFetchJson<SavePlayerSpriteResponse>('/api/admin/player-sprite/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerSprite: {
            url: spriteUrl.trim(),
            frameWidth,
            frameHeight,
            atlasCellWidth,
            atlasCellHeight,
            frameCellsWide,
            frameCellsTall,
            renderWidthTiles,
            renderHeightTiles,
            animationSets: parsedSets.animationSets,
            defaultIdleAnimation,
            defaultMoveAnimation,
            facingFrames: legacyFrames.facingFrames,
            walkFrames: legacyFrames.walkFrames,
          },
        }),
      });
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save player sprite config.');
      }
      const payload = result.data;
      setStatus(`Saved player sprite config (${payload.filePath ?? 'src/game/world/playerSprite.ts'}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save player sprite config.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-tool">
      <header className="admin-tool__header">
        <div>
          <h2>Player Sprite</h2>
          <p>Configure the user character sprite sheet and animation sets.</p>
        </div>
        <div className="admin-tool__status">
          {statusMessage && <span className="status-chip">{statusMessage}</span>}
          {errorMessage && <span className="status-chip is-error">{errorMessage}</span>}
        </div>
      </header>

      <div className="admin-panel">
        <h3>{spriteLabel}</h3>
        <div className="admin-grid-2">
          <label>
            Atlas Cell Width
            <input value={frameWidthInput} onChange={(event) => setFrameWidthInput(event.target.value)} />
          </label>
          <label>
            Atlas Cell Height
            <input value={frameHeightInput} onChange={(event) => setFrameHeightInput(event.target.value)} />
          </label>
          <label>
            Load from File
            <input type="file" accept="image/*" onChange={onSpriteFileSelected} />
          </label>
          <label>
            Frame Cells Wide
            <input value={frameCellsWideInput} onChange={(event) => setFrameCellsWideInput(event.target.value)} />
          </label>
          <label>
            Frame Cells Tall
            <input value={frameCellsTallInput} onChange={(event) => setFrameCellsTallInput(event.target.value)} />
          </label>
          <label>
            Render Tiles Wide
            <input value={renderWidthTilesInput} onChange={(event) => setRenderWidthTilesInput(event.target.value)} />
          </label>
          <label>
            Render Tiles Tall
            <input value={renderHeightTilesInput} onChange={(event) => setRenderHeightTilesInput(event.target.value)} />
          </label>
        </div>
        <h4>Supabase Spritesheets</h4>
        <div className="admin-grid-2">
          <label>
            Bucket
            <input value={spritesheetBucketInput} onChange={(event) => setSpritesheetBucketInput(event.target.value)} />
          </label>
          <label>
            Prefix (Optional)
            <input value={spritesheetPrefixInput} onChange={(event) => setSpritesheetPrefixInput(event.target.value)} />
          </label>
        </div>
        <div className="admin-row">
          <label>
            Search
            <input
              value={spritesheetSearchInput}
              onChange={(event) => setSpritesheetSearchInput(event.target.value)}
              placeholder="Search by file name or path"
            />
          </label>
          <button type="button" className="secondary" onClick={loadSupabaseSpriteSheets} disabled={isLoadingSpritesheetEntries}>
            {isLoadingSpritesheetEntries ? 'Loading...' : 'Reload Bucket'}
          </button>
        </div>
        <div className="spritesheet-browser">
          {filteredSpritesheetEntries.length === 0 && (
            <p className="admin-note">
              {isLoadingSpritesheetEntries ? 'Loading spritesheets...' : 'No PNG spritesheets found.'}
            </p>
          )}
          {filteredSpritesheetEntries.map((entry) => (
            <div
              key={`player-supabase-sheet-${entry.path}`}
              className={`spritesheet-browser__row ${selectedSpritesheetPath === entry.path ? 'is-selected' : ''}`}
            >
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSpriteUrl(entry.publicUrl);
                  setSelectedSpritesheetPath(entry.path);
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
        <div className="admin-row">
          <button type="button" className="secondary" onClick={autoFillFrom4x4}>
            Auto Fill 4x4 D/L/R/U
          </button>
        </div>
        <p className="admin-note">
          For a 4x4 sheet at 32x32 frames: rows are Down, Left, Right, Up.
        </p>
        <p className="admin-note">
          Default NPC-friendly size: frame span 1x2 cells and render 1x2 tiles (16x32 world pixels).
        </p>
        <p className="admin-note">Active player sheet: {spriteUrl ? 'Loaded from file.' : 'No file loaded yet.'}</p>
        <p className="admin-note">
          {atlasMeta.loaded
            ? `Loaded ${atlasMeta.width}x${atlasMeta.height} (${atlasMeta.columns} columns x ${atlasMeta.rows} rows)`
            : atlasMeta.error ?? 'No sprite sheet loaded.'}
        </p>
        {isPreviewTruncated && (
          <p className="admin-note">
            Preview limited to first {previewCellCount} cells (of {atlasCellCount}). Increase atlas cell size for a smaller grid.
          </p>
        )}

        <div className="admin-row">
          <label>
            Animation
            <select value={selectedAnimationName} onChange={(event) => setSelectedAnimationName(event.target.value)}>
              {animationNames.map((name) => (
                <option key={`player-animation-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            New Animation
            <input
              value={newAnimationNameInput}
              onChange={(event) => setNewAnimationNameInput(event.target.value)}
              placeholder="attack"
            />
          </label>
          <button type="button" className="secondary" onClick={addAnimation}>
            Add Animation
          </button>
        </div>
        <div className="admin-row">
          <label>
            Rename Selected Animation
            <input value={renameAnimationNameInput} onChange={(event) => setRenameAnimationNameInput(event.target.value)} />
          </label>
          <button type="button" className="secondary" onClick={renameSelectedAnimation}>
            Rename Animation
          </button>
          <button type="button" className="secondary" onClick={deleteSelectedAnimation}>
            Delete Animation
          </button>
        </div>
        <div className="admin-row">
          <label>
            Assign Direction
            <select value={assignDirection} onChange={(event) => setAssignDirection(event.target.value as Direction)}>
              <option value="up">Up</option>
              <option value="down">Down</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
          <button type="button" className="secondary" onClick={addSelectedFrameToAnimation}>
            Add Selected Frame
          </button>
          <button type="button" className="secondary" onClick={clearDirectionFrames}>
            Clear Direction Frames
          </button>
        </div>

        <div className="tileset-grid-wrap npc-sheet-grid-wrap">
          {atlasMeta.loaded ? (
            <div
              className="tileset-grid"
              style={{
                gridTemplateColumns: `repeat(${atlasMeta.columns}, ${ATLAS_PREVIEW_SIZE}px)`,
              }}
            >
              {Array.from({ length: previewCellCount }, (_, frameIndex) => {
                const isAnimationFrameSelected = selectedAnimationFramesForDirection.includes(frameIndex);
                return (
                  <button
                    key={`player-frame-${frameIndex}`}
                    type="button"
                    className={`tileset-grid__cell ${
                      isAnimationFrameSelected || isAtlasCellInRect(selectedAtlasRect, frameIndex, atlasMeta.columns)
                        ? 'is-selected'
                        : ''
                    } ${selectedAtlasStartIndex === frameIndex ? 'is-anchor' : ''}`}
                    style={{
                      ...atlasCellStyle(
                        frameIndex,
                        ATLAS_PREVIEW_SIZE,
                        spriteUrl,
                        atlasMeta.columns,
                        atlasMeta.rows,
                        atlasCellCount,
                      ),
                      width: `${ATLAS_PREVIEW_SIZE}px`,
                      height: `${ATLAS_PREVIEW_SIZE}px`,
                    }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }
                      event.preventDefault();
                      setIsSelectingAtlas(true);
                      setSelectedAtlasStartIndex(frameIndex);
                      setSelectedAtlasEndIndex(frameIndex);
                    }}
                    onMouseEnter={() => {
                      if (!isSelectingAtlas) {
                        return;
                      }
                      setSelectedAtlasEndIndex(frameIndex);
                    }}
                    title={`Frame ${frameIndex}`}
                  />
                );
              })}
            </div>
          ) : (
            <div className="tileset-grid__empty">Sprite sheet not loaded yet.</div>
          )}
        </div>

        <p className="admin-note">
          Frames for {selectedAnimationName || '-'} {assignDirection}: [{selectedAnimationFramesForDirection.join(', ')}]
        </p>
        <div className="admin-row">
          {selectedAnimationFramesForDirection.length === 0 && (
            <span className="admin-note">No frames in this direction yet.</span>
          )}
          {selectedAnimationFramesForDirection.map((frame) => (
            <button
              key={`player-frame-remove-${selectedAnimationName}-${assignDirection}-${frame}`}
              type="button"
              className="secondary"
              onClick={() => removeFrameFromAnimation(frame)}
            >
              Remove {frame}
            </button>
          ))}
        </div>
        <div className="admin-grid-2">
          <label>
            Default Idle Animation
            <input
              value={defaultIdleAnimationInput}
              onChange={(event) => setDefaultIdleAnimationInput(event.target.value)}
            />
          </label>
          <label>
            Default Move Animation
            <input
              value={defaultMoveAnimationInput}
              onChange={(event) => setDefaultMoveAnimationInput(event.target.value)}
            />
          </label>
        </div>
        <p className="admin-note">
          Selected Rectangle: {selectedAtlasRect ? `${selectedAtlasRect.width}x${selectedAtlasRect.height}` : 'none'}
        </p>
        <button type="button" className="primary" onClick={saveToProject} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Player Sprite To Project'}
        </button>
      </div>
    </section>
  );
}

function atlasCellStyle(
  atlasIndex: number,
  size: number,
  spriteUrl: string,
  columns: number,
  rows: number,
  atlasCellCount: number,
): CSSProperties {
  if (!spriteUrl || columns <= 0 || rows <= 0) {
    return {
      backgroundColor: '#1d2731',
      boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
    };
  }

  const safeIndex = clampInt(atlasIndex, 0, Math.max(0, atlasCellCount - 1));
  const column = safeIndex % columns;
  const row = Math.floor(safeIndex / columns);

  return {
    backgroundImage: `url(${spriteUrl})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${columns * size}px ${rows * size}px`,
    backgroundPosition: `-${column * size}px -${row * size}px`,
    imageRendering: 'pixelated',
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length > 0) {
        resolve(reader.result);
        return;
      }
      reject(new Error('File read failed.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed.'));
    reader.readAsDataURL(file);
  });
}

function parseInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
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

function stringifyDirectionalAnimationSets(animationSets: DirectionalAnimationSets): string {
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
