import { ChangeEvent, CSSProperties, useEffect, useRef, useState } from 'react';
import { PLAYER_SPRITE_CONFIG } from '@/game/world/playerSprite';
import type { Direction } from '@/shared/types';

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

const ATLAS_PREVIEW_SIZE = 28;

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
  const [spriteUrlInput, setSpriteUrlInput] = useState(PLAYER_SPRITE_CONFIG.url);
  const [spriteUrl, setSpriteUrl] = useState(PLAYER_SPRITE_CONFIG.url);
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
  const [assignMode, setAssignMode] = useState<'idle' | 'walk'>('idle');
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const uploadedObjectUrlRef = useRef<string | null>(null);

  const atlasCellCount = Math.max(0, atlasMeta.columns * atlasMeta.rows);
  const selectedAtlasRect = buildAtlasSelectionRect(
    selectedAtlasStartIndex,
    selectedAtlasEndIndex,
    atlasMeta.columns,
    atlasMeta.rows,
  );

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

  const applySpriteUrl = () => {
    if (!spriteUrlInput.trim()) {
      setError('Sprite URL cannot be empty.');
      return;
    }
    if (!parseInteger(frameWidthInput) || !parseInteger(frameHeightInput)) {
      setError('Set frame width and height before applying sprite URL.');
      return;
    }
    setSpriteUrl(spriteUrlInput.trim());
    setStatus('Player sprite URL applied.');
  };

  const loadExampleSprite = () => {
    setSpriteUrlInput('/example_assets/character_npc_spritesheets/user_char.png');
    setStatus('Loaded example player sprite path.');
  };

  const onSpriteFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
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
    setSpriteUrlInput(objectUrl);
    setStatus(`Loaded sprite file ${file.name}`);
  };

  const autoFillFrom4x4 = () => {
    setFrameCellsWideInput('1');
    setFrameCellsTallInput('1');
    setFacingFrames({
      down: 0,
      left: 4,
      right: 8,
      up: 12,
    });
    setWalkFrames({
      down: [1, 2, 3],
      left: [5, 6, 7],
      right: [9, 10, 11],
      up: [13, 14, 15],
    });
    setStatus('Applied 4x4 row preset (Down, Left, Right, Up).');
  };

  const assignFrame = () => {
    if (!selectedAtlasRect || atlasMeta.columns <= 0) {
      setError('Select a rectangle on the sheet first.');
      return;
    }

    const frameIndex = selectedAtlasRect.minRow * atlasMeta.columns + selectedAtlasRect.minCol;
    setFrameCellsWideInput(String(selectedAtlasRect.width));
    setFrameCellsTallInput(String(selectedAtlasRect.height));

    if (assignMode === 'idle') {
      setFacingFrames((current) => ({
        ...current,
        [assignDirection]: frameIndex,
      }));
      setStatus(
        `Assigned ${assignDirection} idle frame ${frameIndex} (${selectedAtlasRect.width}x${selectedAtlasRect.height} cells).`,
      );
      return;
    }

    setWalkFrames((current) => {
      const next = [...current[assignDirection]];
      const existingIndex = next.indexOf(frameIndex);
      if (existingIndex >= 0) {
        next.splice(existingIndex, 1);
      } else {
        next.push(frameIndex);
        next.sort((a, b) => a - b);
      }
      setStatus(
        `Updated ${assignDirection} walk frames: ${next.length > 0 ? next.join(', ') : 'none'} (${selectedAtlasRect.width}x${selectedAtlasRect.height} cells).`,
      );
      return {
        ...current,
        [assignDirection]: next,
      };
    });
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

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/player-sprite/save', {
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
            facingFrames,
            walkFrames,
          },
        }),
      });
      const payload = (await response.json()) as SavePlayerSpriteResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'Unable to save player sprite config.');
      }
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
          <p>Configure the user character sprite sheet and directional idle/walk animation frames.</p>
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
            Sprite URL
            <input value={spriteUrlInput} onChange={(event) => setSpriteUrlInput(event.target.value)} />
          </label>
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
        <div className="admin-row">
          <button type="button" className="secondary" onClick={applySpriteUrl}>
            Apply Sprite URL
          </button>
          <button type="button" className="secondary" onClick={loadExampleSprite}>
            Use Example User Sprite
          </button>
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
        <p className="admin-note">
          {atlasMeta.loaded
            ? `Loaded ${atlasMeta.width}x${atlasMeta.height} (${atlasMeta.columns} columns x ${atlasMeta.rows} rows)`
            : atlasMeta.error ?? 'No sprite sheet loaded.'}
        </p>

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
          <label>
            Assign Mode
            <select value={assignMode} onChange={(event) => setAssignMode(event.target.value as 'idle' | 'walk')}>
              <option value="idle">Idle Frame</option>
              <option value="walk">Walk Frame Toggle</option>
            </select>
          </label>
          <button type="button" className="secondary" onClick={assignFrame}>
            Assign Selected Rectangle
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
              {Array.from({ length: atlasCellCount }, (_, frameIndex) => {
                const isIdleSelected = facingFrames[assignDirection] === frameIndex;
                const isWalkSelected = walkFrames[assignDirection].includes(frameIndex);
                return (
                  <button
                    key={`player-frame-${frameIndex}`}
                    type="button"
                    className={`tileset-grid__cell ${
                      isIdleSelected || isWalkSelected || isAtlasCellInRect(selectedAtlasRect, frameIndex, atlasMeta.columns)
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

        <div className="admin-grid-2">
          {(Object.keys(facingFrames) as Direction[]).map((direction) => (
            <label key={`player-facing-${direction}`}>
              {direction} Idle
              <input value={String(facingFrames[direction])} readOnly />
            </label>
          ))}
        </div>
        <p className="admin-note">
          Walk Frames: up[{walkFrames.up.join(', ')}] down[{walkFrames.down.join(', ')}] left[
          {walkFrames.left.join(', ')}] right[{walkFrames.right.join(', ')}]
        </p>
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

function parseInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
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
