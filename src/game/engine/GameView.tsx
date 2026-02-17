import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { GameRuntime, RuntimeSnapshot } from '@/game/engine/runtime';
import { TILE_SIZE } from '@/shared/constants';

interface GameViewProps {
  mode: 'new' | 'continue';
  playerName?: string;
  onReturnToTitle: () => void;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface RuntimeAutomationWindow extends Window {
  render_game_to_text?: () => string;
  advanceTime?: (ms: number) => void | Promise<void>;
}

const DEFAULT_VIEWPORT: ViewportSize = {
  width: TILE_SIZE * 19,
  height: TILE_SIZE * 15,
};

const FIXED_STEP_MS = 1000 / 60;

type SideMenuView = 'root' | 'squad' | 'collection';
type CollectionSort = 'id' | 'name';
type CritterCardEntry = RuntimeSnapshot['critters']['collection'][number];
type BattleSnapshot = NonNullable<RuntimeSnapshot['battle']>;

export function GameView({ mode, playerName, onReturnToTitle }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const menuOpenRef = useRef(false);
  const battleActiveRef = useRef(false);
  const renderSizeRef = useRef<ViewportSize>(DEFAULT_VIEWPORT);
  const manualStepUntilRef = useRef(0);

  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<SideMenuView>('root');
  const [collectionSearchInput, setCollectionSearchInput] = useState('');
  const [collectionSort, setCollectionSort] = useState<CollectionSort>('id');
  const [squadPickerSlotIndex, setSquadPickerSlotIndex] = useState<number | null>(null);
  const [squadSearchInput, setSquadSearchInput] = useState('');
  const [expandedStatsByCritterId, setExpandedStatsByCritterId] = useState<Record<number, boolean>>({});
  const [blockedSquadRemovalNotice, setBlockedSquadRemovalNotice] = useState<{ slotIndex: number; attempt: number } | null>(
    null,
  );
  const blockedSquadRemovalTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    battleActiveRef.current = Boolean(snapshot?.battle);
  }, [snapshot?.battle]);

  useEffect(() => {
    if (snapshot?.battle?.id) {
      setMenuOpen(false);
    }
  }, [snapshot?.battle?.id]);

  useEffect(() => {
    if (!menuOpen) {
      setMenuView('root');
      setSquadPickerSlotIndex(null);
      setSquadSearchInput('');
    }
  }, [menuOpen]);

  useEffect(() => {
    if (menuView !== 'squad') {
      setSquadPickerSlotIndex(null);
      setSquadSearchInput('');
      setBlockedSquadRemovalNotice(null);
    }
  }, [menuView]);

  useEffect(() => {
    if (!blockedSquadRemovalNotice) {
      if (blockedSquadRemovalTimeoutRef.current !== null) {
        window.clearTimeout(blockedSquadRemovalTimeoutRef.current);
        blockedSquadRemovalTimeoutRef.current = null;
      }
      return;
    }

    if (blockedSquadRemovalTimeoutRef.current !== null) {
      window.clearTimeout(blockedSquadRemovalTimeoutRef.current);
    }
    blockedSquadRemovalTimeoutRef.current = window.setTimeout(() => {
      setBlockedSquadRemovalNotice(null);
      blockedSquadRemovalTimeoutRef.current = null;
    }, 2000);

    return () => {
      if (blockedSquadRemovalTimeoutRef.current !== null) {
        window.clearTimeout(blockedSquadRemovalTimeoutRef.current);
        blockedSquadRemovalTimeoutRef.current = null;
      }
    };
  }, [blockedSquadRemovalNotice]);

  useEffect(() => {
    const runtime = new GameRuntime({
      forceNewGame: mode === 'new',
      playerName,
    });

    runtimeRef.current = runtime;
    setSnapshot(runtime.getSnapshot());
    setMenuOpen(false);

    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) {
      return () => {
        runtimeRef.current = null;
      };
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return () => {
        runtimeRef.current = null;
      };
    }

    context.imageSmoothingEnabled = false;

    const resizeCanvas = () => {
      const rect = viewport.getBoundingClientRect();
      const cameraWidth = DEFAULT_VIEWPORT.width;
      const cameraHeight = DEFAULT_VIEWPORT.height;
      const viewportScale = Math.min(rect.width / cameraWidth, rect.height / cameraHeight);
      const displayScale =
        viewportScale >= 1 ? Math.max(1, Math.floor(viewportScale)) : Math.max(0.5, viewportScale);

      canvas.width = cameraWidth;
      canvas.height = cameraHeight;
      canvas.style.width = `${Math.floor(cameraWidth * displayScale)}px`;
      canvas.style.height = `${Math.floor(cameraHeight * displayScale)}px`;
      renderSizeRef.current = { width: cameraWidth, height: cameraHeight };
    };

    const renderCurrentFrame = () => {
      const { width, height } = renderSizeRef.current;
      runtime.render(context, width, height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let animationFrame = 0;
    let previousTime = performance.now();
    let snapshotTimer = 0;

    const frame = (currentTime: number) => {
      const delta = Math.min(33, currentTime - previousTime);
      previousTime = currentTime;

      const shouldAutoAdvance = !menuOpenRef.current && currentTime >= manualStepUntilRef.current;
      if (shouldAutoAdvance) {
        runtime.update(delta);
      }

      renderCurrentFrame();

      snapshotTimer += delta;
      if (snapshotTimer >= 70) {
        setSnapshot(runtime.getSnapshot());
        snapshotTimer = 0;
      }

      animationFrame = requestAnimationFrame(frame);
    };

    animationFrame = requestAnimationFrame(frame);

    const automationWindow = window as RuntimeAutomationWindow;
    const previousRenderGameToText = automationWindow.render_game_to_text;
    const previousAdvanceTime = automationWindow.advanceTime;

    automationWindow.render_game_to_text = () => runtime.renderGameToText();
    automationWindow.advanceTime = (ms: number) => {
      const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : FIXED_STEP_MS;
      const steps = Math.max(1, Math.round(safeMs / FIXED_STEP_MS));

      manualStepUntilRef.current = performance.now() + 80;
      for (let i = 0; i < steps; i += 1) {
        runtime.update(FIXED_STEP_MS);
      }

      renderCurrentFrame();
      setSnapshot(runtime.getSnapshot());
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;

      if (key === 'f' || key === 'F') {
        event.preventDefault();
        void toggleFullscreen(viewport);
        return;
      }

      if (key === 'Escape' && document.fullscreenElement) {
        event.preventDefault();
        void document.exitFullscreen();
        return;
      }

      if (battleActiveRef.current) {
        if (key === 'Escape') {
          event.preventDefault();
          const changed = runtime.cancelBattleSwapSelection();
          if (changed) {
            setSnapshot(runtime.getSnapshot());
          }
          return;
        }
        if (
          key.startsWith('Arrow') ||
          key === 'w' ||
          key === 'W' ||
          key === 'a' ||
          key === 'A' ||
          key === 's' ||
          key === 'S' ||
          key === 'd' ||
          key === 'D' ||
          key === ' ' ||
          key === 'Enter'
        ) {
          event.preventDefault();
        }
        return;
      }

      if (key === 'Escape') {
        event.preventDefault();
        setMenuOpen((open) => !open);
        return;
      }

      if (menuOpenRef.current) {
        return;
      }

      if (
        key.startsWith('Arrow') ||
        key === 'w' ||
        key === 'W' ||
        key === 'a' ||
        key === 'A' ||
        key === 's' ||
        key === 'S' ||
        key === 'd' ||
        key === 'D' ||
        key === ' '
      ) {
        event.preventDefault();
      }

      runtime.keyDown(key);
      setSnapshot(runtime.getSnapshot());
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (menuOpenRef.current || battleActiveRef.current) {
        return;
      }

      runtime.keyUp(event.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      if (previousRenderGameToText) {
        automationWindow.render_game_to_text = previousRenderGameToText;
      } else {
        delete automationWindow.render_game_to_text;
      }

      if (previousAdvanceTime) {
        automationWindow.advanceTime = previousAdvanceTime;
      } else {
        delete automationWindow.advanceTime;
      }

      runtimeRef.current = null;
    };
  }, [mode, playerName]);

  const handleManualSave = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    runtime.saveNow();
    setSnapshot(runtime.getSnapshot());
  };

  const handleAdvanceCritter = (critterId: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.tryAdvanceCritter(critterId);
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const handleAssignSquadCritter = (critterId: number) => {
    const runtime = runtimeRef.current;
    if (!runtime || squadPickerSlotIndex === null) {
      return;
    }

    const changed = runtime.assignCritterToSquadSlot(squadPickerSlotIndex, critterId);
    if (changed) {
      setSnapshot(runtime.getSnapshot());
      setSquadPickerSlotIndex(null);
      setSquadSearchInput('');
    }
  };

  const handleOpenSquadPicker = (slotIndex: number) => {
    const slot = squadSlots.find((entry) => entry.index === slotIndex);
    if (!slot || !slot.unlocked) {
      return;
    }
    setSquadPickerSlotIndex(slotIndex);
  };

  const handleRemoveSquadCritter = (slotIndex: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.clearSquadSlot(slotIndex);
    if (changed) {
      setBlockedSquadRemovalNotice(null);
      setSnapshot(runtime.getSnapshot());
      return;
    }

    const assignedCount = squadSlots.reduce(
      (count, slot) => count + (slot.unlocked && slot.critterId !== null ? 1 : 0),
      0,
    );
    const targetSlot = squadSlots.find((slot) => slot.index === slotIndex);
    const targetIsDamaged =
      targetSlot?.currentHp !== null &&
      targetSlot?.maxHp !== null &&
      (targetSlot?.currentHp ?? 0) < (targetSlot?.maxHp ?? 0);
    const hasUnlockedCritter = (critterState?.unlockedCount ?? 0) > 0;
    if (targetSlot?.critterId !== null && !targetIsDamaged && assignedCount <= 1 && hasUnlockedCritter) {
      setBlockedSquadRemovalNotice((current) => ({
        slotIndex,
        attempt: current?.slotIndex === slotIndex ? current.attempt + 1 : 1,
      }));
    }
  };

  const handleToggleStatInfo = (critterId: number) => {
    setExpandedStatsByCritterId((current) => ({
      ...current,
      [critterId]: !current[critterId],
    }));
  };

  const handleBattleAction = (action: 'attack' | 'guard' | 'swap' | 'retreat') => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.battleChooseAction(action);
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const handleBattleSelectSlot = (slotIndex: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.battleSelectSquadSlot(slotIndex);
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const handleBattleCancelSwap = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.cancelBattleSwapSelection();
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const handleBattleContinue = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.battleAcknowledgeResult();
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const handleBattleNextNarration = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.battleAdvanceNarration();
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const critterState = snapshot?.critters;
  const squadSlots = critterState?.squadSlots ?? [];
  const collection = critterState?.collection ?? [];
  const collectionById = useMemo(() => {
    const next = new Map<number, CritterCardEntry>();
    for (const entry of collection) {
      next.set(entry.critterId, entry);
    }
    return next;
  }, [collection]);
  const elementLogoBucketRoot = useMemo(() => {
    for (const entry of collection) {
      const bucketRoot = extractSupabasePublicBucketRoot(entry.spriteUrl);
      if (bucketRoot) {
        return bucketRoot;
      }
    }
    return null;
  }, [collection]);
  const squadPickerCollection = useMemo(() => {
    const query = squadSearchInput.trim().toLowerCase();
    return collection
      .filter((entry) => entry.unlocked)
      .filter((entry) => {
        if (!query) {
          return true;
        }
        return entry.name.toLowerCase().includes(query) || String(entry.critterId).includes(query);
      })
      .sort((left, right) => left.critterId - right.critterId);
  }, [collection, squadSearchInput]);
  const assignedSquadCritterIds = useMemo(() => {
    const assigned = new Set<number>();
    for (const slot of squadSlots) {
      if (typeof slot.critterId === 'number') {
        assigned.add(slot.critterId);
      }
    }
    return assigned;
  }, [squadSlots]);
  const displayCollection = useMemo(() => {
    const query = collectionSearchInput.trim().toLowerCase();
    const filtered = !query
      ? [...collection]
      : collection.filter(
          (entry) =>
            entry.name.toLowerCase().includes(query) ||
            String(entry.critterId).includes(query),
        );
    filtered.sort((left, right) => {
      if (collectionSort === 'name') {
        const compared = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
        return compared !== 0 ? compared : left.critterId - right.critterId;
      }
      return left.critterId - right.critterId;
    });
    return filtered;
  }, [collection, collectionSearchInput, collectionSort]);

  return (
    <section className="game-screen">
      <div className="game-screen__viewport" ref={viewportRef}>
        <canvas ref={canvasRef} />

        {snapshot?.warpHint && <div className="warp-popup">{snapshot.warpHint}</div>}

        {snapshot?.dialogue && (
          <div className="dialogue-box">
            <p className="dialogue-box__speaker">{snapshot.dialogue.speaker}</p>
            <p>{snapshot.dialogue.text}</p>
            <p className="dialogue-box__meta">
              Line {snapshot.dialogue.lineIndex}/{snapshot.dialogue.totalLines}
            </p>
          </div>
        )}

        {snapshot?.battle && (
          <BattleOverlay
            battle={snapshot.battle}
            onAction={handleBattleAction}
            onSelectSquadSlot={handleBattleSelectSlot}
            onCancelSwap={handleBattleCancelSwap}
            onContinue={handleBattleContinue}
            onNextNarration={handleBattleNextNarration}
          />
        )}

        {menuOpen && <div className="side-menu__backdrop" onClick={closeMenu} />}

        <aside
          className={`side-menu ${menuOpen ? 'is-open' : ''} ${menuView === 'collection' ? 'side-menu--collection' : ''} ${
            menuView === 'squad' ? 'side-menu--squad' : ''
          }`}
        >
          {menuView === 'root' ? (
            <>
              <h2>Menu</h2>
              <div className="side-menu__section">
                <button type="button" className="secondary" onClick={() => setMenuView('collection')}>
                  Collection
                </button>
                <button type="button" className="secondary" onClick={() => setMenuView('squad')}>
                  Squad
                </button>
                <button type="button" className="secondary" disabled>
                  Backpack (Soon)
                </button>
              </div>
              <div className="side-menu__actions">
                <button type="button" className="primary" onClick={handleManualSave}>
                  Save
                </button>
                <button type="button" className="secondary" onClick={closeMenu}>
                  Resume
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    closeMenu();
                    onReturnToTitle();
                  }}
                >
                  Back To Title
                </button>
              </div>
            </>
          ) : menuView === 'squad' ? (
            <>
              <h2>Squad</h2>
              <p className="side-menu__meta">
                {critterState?.unlockedSquadSlots ?? 0}/{critterState?.maxSquadSlots ?? 0} slots unlocked.
              </p>
              <div className="squad-layout">
                {squadPickerSlotIndex !== null && (
                  <section className="squad-picker">
                    <div className="squad-picker__toolbar">
                      <input
                        value={squadSearchInput}
                        onChange={(event) => setSquadSearchInput(event.target.value)}
                        placeholder="Search Name or ID"
                      />
                      <button type="button" className="squad-picker__close" onClick={() => setSquadPickerSlotIndex(null)}>
                        X
                      </button>
                    </div>
                    <p className="side-menu__meta">Selecting for slot {squadPickerSlotIndex + 1}.</p>
                    <div className="squad-picker__grid">
                      {squadPickerCollection.map((entry) => (
                        <CritterCard
                          key={`squad-pick-${entry.critterId}`}
                          entry={entry}
                          elementLogoBucketRoot={elementLogoBucketRoot}
                          showStatBreakdown={Boolean(expandedStatsByCritterId[entry.critterId])}
                          onToggleStatInfo={() => handleToggleStatInfo(entry.critterId)}
                          onSelectCritter={handleAssignSquadCritter}
                          isSelectionDisabled={assignedSquadCritterIds.has(entry.critterId)}
                        />
                      ))}
                      {squadPickerCollection.length === 0 && (
                        <p className="collection-card__mission-summary">No unlocked critters match that search.</p>
                      )}
                    </div>
                  </section>
                )}
                <div className="squad-grid">
                  {squadSlots.map((slot) => {
                    const slottedCritter = slot.critterId ? collectionById.get(slot.critterId) ?? null : null;
                    const isBlockedRemovalSlot = blockedSquadRemovalNotice?.slotIndex === slot.index;
                    const blockedRemovalAnimationName =
                      blockedSquadRemovalNotice && isBlockedRemovalSlot
                        ? blockedSquadRemovalNotice.attempt % 2 === 0
                          ? 'squad-slot-shake-b'
                          : 'squad-slot-shake-a'
                        : undefined;
                    return (
                      <div
                        key={`squad-slot-${slot.index}`}
                        className={`squad-slot ${slot.unlocked ? 'is-unlocked' : 'is-locked'} ${
                          slot.index === squadPickerSlotIndex ? 'is-selected' : ''
                        } ${isBlockedRemovalSlot ? 'is-removal-blocked' : ''}`}
                        style={
                          blockedRemovalAnimationName
                            ? ({ '--squad-slot-shake-name': blockedRemovalAnimationName } as CSSProperties)
                            : undefined
                        }
                        onClick={() => {
                          if (!slot.unlocked) {
                            return;
                          }
                          handleOpenSquadPicker(slot.index);
                        }}
                        onContextMenu={(event) => {
                          if (!slot.unlocked || slot.critterId === null) {
                            return;
                          }
                          event.preventDefault();
                          handleRemoveSquadCritter(slot.index);
                        }}
                      >
                        {!slot.unlocked ? (
                          'Locked'
                        ) : slottedCritter ? (
                          <CritterCard
                            entry={slottedCritter}
                            elementLogoBucketRoot={elementLogoBucketRoot}
                            showStatBreakdown={Boolean(expandedStatsByCritterId[slottedCritter.critterId])}
                            onToggleStatInfo={() => handleToggleStatInfo(slottedCritter.critterId)}
                            healthProgress={
                              slot.currentHp !== null && slot.maxHp !== null
                                ? {
                                    currentHp: slot.currentHp,
                                    maxHp: slot.maxHp,
                                  }
                                : undefined
                            }
                          />
                        ) : (
                          <span className="squad-slot__placeholder">Empty</span>
                        )}
                        {isBlockedRemovalSlot && (
                          <div className="squad-slot__blocked-popup">You need at least 1 Critter!</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="side-menu__actions">
                <button type="button" className="secondary" onClick={() => setMenuView('root')}>
                  Back
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Collection</h2>
              <p className="side-menu__meta">
                {critterState?.unlockedCount ?? 0}/{critterState?.totalCount ?? 0} critters unlocked.
              </p>
              <div className="collection-toolbar">
                <label className="collection-toolbar__search">
                  Search
                  <input
                    value={collectionSearchInput}
                    onChange={(event) => setCollectionSearchInput(event.target.value)}
                    placeholder="Name or ID"
                  />
                </label>
                <div className="collection-toolbar__sort">
                  <span>Sort</span>
                  <button
                    type="button"
                    className={`secondary ${collectionSort === 'id' ? 'is-selected' : ''}`}
                    onClick={() => setCollectionSort('id')}
                  >
                    ID
                  </button>
                  <button
                    type="button"
                    className={`secondary ${collectionSort === 'name' ? 'is-selected' : ''}`}
                    onClick={() => setCollectionSort('name')}
                  >
                    Name
                  </button>
                </div>
              </div>
              <div className="collection-grid">
                {displayCollection.map((entry) => (
                  <CritterCard
                    key={`collection-${entry.critterId}`}
                    entry={entry}
                    elementLogoBucketRoot={elementLogoBucketRoot}
                    showStatBreakdown={Boolean(expandedStatsByCritterId[entry.critterId])}
                    onToggleStatInfo={() => handleToggleStatInfo(entry.critterId)}
                    onAdvanceCritter={handleAdvanceCritter}
                  />
                ))}
              </div>
              <div className="side-menu__actions">
                <button type="button" className="secondary" onClick={() => setMenuView('root')}>
                  Back
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

const ELEMENT_ACCENTS: Record<string, string> = {
  bloom: '#7dff9a',
  ember: '#ff8a65',
  tide: '#7bc8ff',
  gust: '#d9f6ff',
  stone: '#d7b98f',
  spark: '#ffe06c',
  shade: '#c5b7ff',
};

function collectionCardStyle(element: string): CSSProperties {
  return {
    '--collection-accent': ELEMENT_ACCENTS[element] ?? '#7bc8ff',
  } as CSSProperties;
}

interface CritterCardProps {
  entry: CritterCardEntry;
  elementLogoBucketRoot: string | null;
  showStatBreakdown: boolean;
  onToggleStatInfo: () => void;
  onAdvanceCritter?: (critterId: number) => void;
  onSelectCritter?: (critterId: number) => void;
  isSelectionDisabled?: boolean;
  healthProgress?: {
    currentHp: number;
    maxHp: number;
  };
}

function CritterCard({
  entry,
  elementLogoBucketRoot,
  showStatBreakdown,
  onToggleStatInfo,
  onAdvanceCritter,
  onSelectCritter,
  isSelectionDisabled = false,
  healthProgress,
}: CritterCardProps) {
  const elementLogoUrl = buildElementLogoUrl(entry.element, entry.spriteUrl, elementLogoBucketRoot);
  const safeMaxLevel = Math.max(1, entry.maxLevel);
  const safeLevel = Math.max(0, Math.min(entry.level, safeMaxLevel));
  const levelProgressPercent = entry.unlocked
    ? Math.max(0, Math.min(100, Math.round((safeLevel / safeMaxLevel) * 100)))
    : 0;
  const isMaxLevel = safeLevel >= safeMaxLevel && entry.unlocked;
  const progressLabel = entry.unlocked ? `Level ${safeLevel}/${safeMaxLevel}` : 'LOCKED';
  const levelFillStart = !entry.unlocked
    ? '#5a2620'
    : isMaxLevel
      ? '#7a0b18'
      : '#1b74d8';
  const levelFillEnd = !entry.unlocked
    ? '#703028'
    : isMaxLevel
      ? '#b01a31'
      : '#3d9cff';
  const cardStyle = {
    ...collectionCardStyle(entry.element),
  } as CSSProperties;
  const progressStyle = {
    '--level-progress-fill': `${levelProgressPercent}%`,
    '--level-progress-color-start': levelFillStart,
    '--level-progress-color-end': levelFillEnd,
  } as CSSProperties;
  const safeHealthMax = healthProgress ? Math.max(1, healthProgress.maxHp) : 1;
  const safeHealthCurrent = healthProgress ? Math.max(0, Math.min(healthProgress.currentHp, safeHealthMax)) : 0;
  const healthProgressPercent = Math.max(0, Math.min(100, Math.round((safeHealthCurrent / safeHealthMax) * 100)));
  const healthTier = healthProgressPercent <= 25 ? 'critical' : healthProgressPercent <= 55 ? 'warning' : 'healthy';
  const healthFillStart = healthTier === 'critical' ? '#931c1c' : healthTier === 'warning' ? '#af6d11' : '#1f7a2f';
  const healthFillEnd = healthTier === 'critical' ? '#d94444' : healthTier === 'warning' ? '#e2a323' : '#45c95f';
  const healthStyle = {
    '--health-progress-fill': `${healthProgressPercent}%`,
    '--health-progress-color-start': healthFillStart,
    '--health-progress-color-end': healthFillEnd,
  } as CSSProperties;
  return (
    <article
      className={`collection-card ${entry.unlocked ? 'is-unlocked' : 'is-locked'} ${
        onSelectCritter ? 'collection-card--selectable' : ''
      } ${isSelectionDisabled ? 'collection-card--disabled' : ''}`}
      style={cardStyle}
      onClick={onSelectCritter && !isSelectionDisabled ? () => onSelectCritter(entry.critterId) : undefined}
    >
      <header className="collection-card__head">
        {elementLogoUrl ? (
          <img
            src={elementLogoUrl}
            alt={`${entry.element} element`}
            className="collection-card__element-logo"
            loading="lazy"
          />
        ) : (
          <span className="collection-card__element-logo collection-card__element-logo--empty">-</span>
        )}
        <span className="collection-card__id">#{entry.critterId}</span>
        <span className="collection-card__name">{entry.name}</span>
        <button
          type="button"
          className={`collection-card__info-toggle ${showStatBreakdown ? 'is-active' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleStatInfo();
          }}
          aria-label={showStatBreakdown ? 'Hide stat details' : 'Show stat details'}
        >
          i
        </button>
      </header>
      {entry.spriteUrl ? (
        <img
          src={entry.spriteUrl}
          alt={entry.name}
          className="collection-card__sprite"
          loading="lazy"
        />
      ) : (
        <div className="collection-card__sprite collection-card__sprite--missing">No Sprite</div>
      )}
      <div
        className={`collection-card__level-progress ${
          entry.unlocked ? (isMaxLevel ? 'is-max' : 'is-growing') : 'is-locked'
        }`}
        style={progressStyle}
      >
        <span className="collection-card__level-progress-fill" />
        <span className="collection-card__level-progress-label">{progressLabel}</span>
      </div>
      {healthProgress && (
        <div className={`collection-card__health-progress is-${healthTier}`} style={healthStyle}>
          <span className="collection-card__health-progress-fill" />
          <span className="collection-card__health-progress-label">
            HP {safeHealthCurrent}/{safeHealthMax}
          </span>
        </div>
      )}
      {entry.canAdvance && entry.advanceActionLabel && onAdvanceCritter && (
        <button
          type="button"
          className="collection-card__advance"
          onClick={(event) => {
            event.stopPropagation();
            onAdvanceCritter(entry.critterId);
          }}
        >
          {entry.advanceActionLabel}
        </button>
      )}
      <section className="collection-card__stats">
        <h3>Stats</h3>
        <dl>
          <div><dt>HP</dt><dd>{formatStatValue(entry.baseStats.hp, entry.statBonus.hp, showStatBreakdown)}</dd></div>
          <div><dt>ATK</dt><dd>{formatStatValue(entry.baseStats.attack, entry.statBonus.attack, showStatBreakdown)}</dd></div>
          <div><dt>DEF</dt><dd>{formatStatValue(entry.baseStats.defense, entry.statBonus.defense, showStatBreakdown)}</dd></div>
          <div><dt>SPD</dt><dd>{formatStatValue(entry.baseStats.speed, entry.statBonus.speed, showStatBreakdown)}</dd></div>
        </dl>
      </section>
      {entry.abilities.length > 0 && (
        <section className="collection-card__abilities">
          <h3>Abilities</h3>
          <ul>
            {entry.abilities.map((ability) => (
              <li key={`ability-${entry.critterId}-${ability.id}`}>
                <span>{ability.name}</span>
                <span>{ability.unlocked ? 'Ready' : 'Locked'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="collection-card__missions">
        <h3>Missions</h3>
        {entry.activeRequirement ? (
          <>
            <p className="collection-card__mission-summary">
              {entry.activeRequirement.completedMissionCount}/{entry.activeRequirement.requiredMissionCount} complete
            </p>
            <ul>
              {entry.activeRequirement.missions.map((mission) => (
                <li key={`mission-${entry.critterId}-${entry.activeRequirement?.level}-${mission.id}`}>
                  <span>{formatMissionTypeLabel(mission)}</span>
                  <span>{Math.min(mission.currentValue, mission.targetValue)}/{mission.targetValue}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="collection-card__mission-summary">{isMaxLevel ? 'MAX LEVEL' : 'No mission requirements configured.'}</p>
        )}
      </section>
    </article>
  );
}

interface BattleOverlayProps {
  battle: BattleSnapshot;
  onAction: (action: 'attack' | 'guard' | 'swap' | 'retreat') => void;
  onSelectSquadSlot: (slotIndex: number) => void;
  onCancelSwap: () => void;
  onContinue: () => void;
  onNextNarration: () => void;
}

function BattleOverlay({
  battle,
  onAction,
  onSelectSquadSlot,
  onCancelSwap,
  onContinue,
  onNextNarration,
}: BattleOverlayProps) {
  const activePlayer =
    battle.playerActiveIndex !== null ? battle.playerTeam[battle.playerActiveIndex] ?? null : null;
  const activeOpponent =
    battle.opponentActiveIndex !== null ? battle.opponentTeam[battle.opponentActiveIndex] ?? null : null;
  const transitionProgress = battle.transition
    ? Math.max(0, Math.min(1, 1 - battle.transition.remainingMs / Math.max(1, battle.transition.totalMs)))
    : 0;
  const transitionStyle = {
    '--battle-transition-progress': transitionProgress.toFixed(3),
  } as CSSProperties;

  if (battle.phase === 'transition' && battle.transition) {
    return (
      <div className="battle-overlay">
        <div
          className={`battle-transition battle-transition--${battle.transition.effect}`}
          style={transitionStyle}
        >
          <p className="battle-transition__label">{battle.source.label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="battle-overlay">
      <section className="battle-screen">
        <header className="battle-screen__header">
          <p className="battle-screen__source">{battle.source.label}</p>
          <p className="battle-screen__turn">Turn {battle.turnNumber}</p>
        </header>
        <div className="battle-screen__field">
          <BattleActivePanel
            title="Your Critter"
            position="player"
            critter={activePlayer}
            isAttacking={battle.activeAnimation?.attacker === 'player'}
            attackToken={battle.activeAnimation?.attacker === 'player' ? battle.activeAnimation.token : null}
          />
          <BattleActivePanel
            title="Opponent"
            position="opponent"
            critter={activeOpponent}
            isAttacking={battle.activeAnimation?.attacker === 'opponent'}
            attackToken={battle.activeAnimation?.attacker === 'opponent' ? battle.activeAnimation.token : null}
          />
        </div>
        <div className="battle-screen__console">
          <p className="battle-screen__log">{battle.logLine}</p>

          {battle.canAdvanceNarration && (
            <button type="button" className="primary battle-screen__continue-button" onClick={onNextNarration}>
              Next
            </button>
          )}

          {!battle.canAdvanceNarration && (battle.requiresStarterSelection || battle.requiresSwapSelection) && (
            <>
              <p className="battle-screen__hint">
                {battle.requiresStarterSelection
                  ? 'Pick a critter from your squad to open the battle.'
                  : 'Swap to another squad critter.'}
              </p>
              <div className="battle-squad-picker">
                {battle.playerTeam.map((entry, index) => {
                  const isActive = battle.playerActiveIndex === index;
                  const disabled = entry.fainted || entry.currentHp <= 0 || isActive;
                  return (
                    <button
                      key={`battle-slot-${entry.slotIndex ?? index}`}
                      type="button"
                      className={`battle-squad-picker__slot ${isActive ? 'is-active' : ''} ${
                        entry.fainted ? 'is-fainted' : ''
                      }`}
                      disabled={disabled}
                      onClick={() => {
                        if (entry.slotIndex === null) {
                          return;
                        }
                        onSelectSquadSlot(entry.slotIndex);
                      }}
                    >
                      <span className="battle-squad-picker__name">
                        {entry.slotIndex !== null ? `Slot ${entry.slotIndex + 1}` : 'Bench'} · {entry.name}
                      </span>
                      <span className="battle-squad-picker__hp">
                        HP {Math.max(0, entry.currentHp)}/{Math.max(1, entry.maxHp)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {battle.canCancelSwap && (
                <button type="button" className="secondary battle-screen__back-button" onClick={onCancelSwap}>
                  Back
                </button>
              )}
            </>
          )}

          {!battle.canAdvanceNarration && battle.phase === 'player-turn' && (
            <div className="battle-actions">
              <button type="button" className="primary" disabled={!battle.canAttack} onClick={() => onAction('attack')}>
                Attack
              </button>
              <button type="button" className="secondary" disabled={!battle.canGuard} onClick={() => onAction('guard')}>
                Guard
              </button>
              <button type="button" className="secondary" disabled={!battle.canSwap} onClick={() => onAction('swap')}>
                Swap
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!battle.canRetreat}
                onClick={() => onAction('retreat')}
              >
                Retreat
              </button>
            </div>
          )}

          {!battle.canAdvanceNarration && battle.phase === 'result' && (
            <button type="button" className="primary battle-screen__continue-button" onClick={onContinue}>
              {battle.result === 'won'
                ? 'Continue After Victory'
                : battle.result === 'escaped'
                  ? 'Continue After Escape'
                  : 'Continue'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

interface BattleActivePanelProps {
  title: string;
  position: 'player' | 'opponent';
  critter: BattleSnapshot['playerTeam'][number] | null;
  isAttacking: boolean;
  attackToken: number | null;
}

function BattleActivePanel({ title, position, critter, isAttacking, attackToken }: BattleActivePanelProps) {
  const hpPercent = critter
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, critter.currentHp) / Math.max(1, critter.maxHp)) * 100)))
    : 0;
  const attackStyle = {
    animationDelay: isAttacking && attackToken !== null ? `${attackToken % 2}ms` : undefined,
  } as CSSProperties;
  return (
    <article className={`battle-critter battle-critter--${position}`}>
      <p className="battle-critter__title">{title}</p>
      {critter ? (
        <>
          <div className="battle-critter__head">
            <h3>{critter.name}</h3>
            <span>Lv.{critter.level}</span>
          </div>
          {critter.spriteUrl ? (
            <img
              src={critter.spriteUrl}
              alt={critter.name}
              className={`battle-critter__sprite ${isAttacking ? 'is-attacking' : ''}`}
              style={attackStyle}
              loading="lazy"
            />
          ) : (
            <div className={`battle-critter__sprite battle-critter__sprite--missing ${isAttacking ? 'is-attacking' : ''}`}>
              No Sprite
            </div>
          )}
          <div className="battle-critter__hp">
            <span className="battle-critter__hp-bar">
              <span className="battle-critter__hp-fill" style={{ width: `${hpPercent}%` }} />
            </span>
            <span className="battle-critter__hp-label">
              HP {Math.max(0, critter.currentHp)}/{Math.max(1, critter.maxHp)}
            </span>
          </div>
          <div className="battle-critter__stats">
            <span>ATK {critter.attack}</span>
            <span>DEF {critter.defense}</span>
            <span>SPD {critter.speed}</span>
          </div>
        </>
      ) : (
        <p className="battle-critter__empty">Waiting for active critter...</p>
      )}
    </article>
  );
}

function formatMissionTypeLabel(mission: {
  type: string;
  targetValue: number;
  ascendsFromCritterName?: string;
  ascendsFromCritterId?: number;
  knockoutElements?: string[];
  knockoutCritterIds?: number[];
  knockoutCritterNames?: string[];
}): string {
  if (mission.type === 'opposing_knockouts') {
    const knockoutCritterNames = Array.isArray(mission.knockoutCritterNames) ? mission.knockoutCritterNames : [];
    if (knockoutCritterNames.length > 0) {
      return `Opposing Knockouts (${knockoutCritterNames.join(', ')})`;
    }
    const knockoutElements = Array.isArray(mission.knockoutElements) ? mission.knockoutElements : [];
    if (knockoutElements.length > 0) {
      return `Opposing Knockouts (${knockoutElements.map(capitalizeToken).join(', ')})`;
    }
    return 'Opposing Knockouts';
  }
  if (mission.type === 'ascension') {
    const sourceLabel = mission.ascendsFromCritterName
      ? mission.ascendsFromCritterName
      : mission.ascendsFromCritterId
        ? `Critter #${mission.ascendsFromCritterId}`
        : 'Critter';
    return `Ascends from ${sourceLabel} at Level ${mission.targetValue}`;
  }
  return mission.type.replace(/_/g, ' ');
}

function formatStatValue(baseValue: number, statDelta: number, expanded: boolean): string {
  if (!expanded) {
    return String(baseValue + statDelta);
  }
  const sign = statDelta >= 0 ? `+${statDelta}` : `${statDelta}`;
  return `${baseValue}${sign}`;
}

function capitalizeToken(value: string): string {
  if (!value) {
    return value;
  }
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function extractSupabasePublicBucketRoot(assetUrl: string): string | null {
  if (!assetUrl) {
    return null;
  }
  try {
    const parsed = new URL(assetUrl);
    const marker = '/storage/v1/object/public/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }
    const suffix = parsed.pathname.slice(markerIndex + marker.length);
    const bucket = suffix.split('/')[0];
    if (!bucket) {
      return null;
    }
    parsed.pathname = `${marker}${bucket}`;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function buildElementLogoUrl(element: string, spriteUrl: string, fallbackBucketRoot: string | null): string | null {
  const bucketRoot = extractSupabasePublicBucketRoot(spriteUrl) ?? fallbackBucketRoot;
  if (!bucketRoot) {
    return null;
  }
  return `${bucketRoot}/${encodeURIComponent(`${element}-element.png`)}`;
}

async function toggleFullscreen(viewport: HTMLElement): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  await viewport.requestFullscreen();
}
