import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { GameRuntime, RuntimeSnapshot } from '@/game/engine/runtime';
import { TILE_SIZE } from '@/shared/constants';
import { ELEMENT_SKILL_COLORS } from '@/game/skills/types';

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
  const storyInputLockedRef = useRef(false);

  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<SideMenuView>('root');
  const [collectionSearchInput, setCollectionSearchInput] = useState('');
  const [collectionSort, setCollectionSort] = useState<CollectionSort>('id');
  const [squadPickerSlotIndex, setSquadPickerSlotIndex] = useState<number | null>(null);
  const [squadSearchInput, setSquadSearchInput] = useState('');
  const [expandedStatsByCritterId, setExpandedStatsByCritterId] = useState<Record<number, boolean>>({});
  const [hoveredStarterCritterId, setHoveredStarterCritterId] = useState<number | null>(null);
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
    storyInputLockedRef.current = Boolean(snapshot?.story.inputLocked || snapshot?.dialogue);
    if (!snapshot?.story.starterSelection) {
      setHoveredStarterCritterId(null);
    }
  }, [snapshot?.dialogue, snapshot?.story.inputLocked, snapshot?.story.starterSelection]);

  useEffect(() => {
    if (snapshot?.dialogue && menuOpen) {
      setMenuOpen(false);
    }
  }, [menuOpen, snapshot?.dialogue]);

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
      const size = runtime.getViewportSize();
      const cameraWidth = size.width;
      const cameraHeight = size.height;
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

      const viewportSize = runtime.getViewportSize();
      if (
        renderSizeRef.current.width !== viewportSize.width ||
        renderSizeRef.current.height !== viewportSize.height
      ) {
        resizeCanvas();
      }

      renderCurrentFrame();

      snapshotTimer += delta;
      if (snapshotTimer >= 100) {
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
        if (storyInputLockedRef.current) {
          event.preventDefault();
          return;
        }
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

  const handleBattleAction = (action: 'guard' | 'swap' | 'retreat') => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.battleChooseAction(action);
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const handleBattleChooseSkill = (skillSlotIndex: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.battleChooseSkill(skillSlotIndex);
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const handleEquipSkill = (critterId: number, slotIndex: number, skillId: string | null) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const changed = runtime.setEquippedSkill(critterId, slotIndex, skillId);
    if (changed) setSnapshot(runtime.getSnapshot());
  };

  const handleUnequipSkill = (critterId: number, slotIndex: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const changed = runtime.setEquippedSkill(critterId, slotIndex, null);
    if (changed) setSnapshot(runtime.getSnapshot());
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

  const handleSelectStarterCandidate = (critterId: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.selectStarterCandidate(critterId);
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const handleCancelStarterCandidate = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.cancelStarterCandidate();
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const handleConfirmStarterCandidate = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.confirmStarterCandidate();
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const critterState = snapshot?.critters;
  const starterSelection = snapshot?.story.starterSelection ?? null;
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
  const iconsBucketRoot = useMemo(() => {
    const marker = '/storage/v1/object/public/';
    function buildIconsBucketRootFromSupabaseUrl(supabaseAssetUrl: string): string | null {
      try {
        const url = new URL(supabaseAssetUrl);
        const markerIndex = url.pathname.indexOf(marker);
        if (markerIndex >= 0) {
          url.pathname = url.pathname.substring(0, markerIndex) + marker + 'icons';
          url.search = '';
          url.hash = '';
          return url.toString().replace(/\/+$/, '');
        }
      } catch {
        // ignore
      }
      return null;
    }
    // Try to get icons bucket root from any skill effect icon URL (often already in icons bucket)
    for (const entry of collection) {
      for (const slot of entry.equippedSkillSlots ?? []) {
        if (slot?.effectIconUrls && slot.effectIconUrls.length > 0) {
          const root = buildIconsBucketRootFromSupabaseUrl(slot.effectIconUrls[0]);
          if (root) return root;
        }
      }
    }
    // Derive from sprite URL: same Supabase origin, bucket = 'icons'
    for (const entry of collection) {
      if (entry.spriteUrl) {
        const root = buildIconsBucketRootFromSupabaseUrl(entry.spriteUrl);
        if (root) return root;
      }
    }
    // Fallback: from element logo bucket root (e.g. critter-sprites -> icons)
    if (elementLogoBucketRoot) {
      const root = buildIconsBucketRootFromSupabaseUrl(elementLogoBucketRoot);
      if (root) return root;
    }
    // Env fallback so icons work when no Supabase asset URLs have been loaded yet
    try {
      const envUrl = (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_SUPABASE_URL?: string } }).env?.VITE_SUPABASE_URL) as string | undefined;
      const base = typeof envUrl === 'string' && envUrl.trim() ? envUrl.trim().replace(/\/+$/, '') : null;
      if (base && base.startsWith('http')) {
        return `${base}/storage/v1/object/public/icons`;
      }
    } catch {
      // ignore
    }
    return null;
  }, [collection, elementLogoBucketRoot]);
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

  const inBattle = Boolean(snapshot?.battle);

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
            iconsBucketRoot={iconsBucketRoot}
            onAction={handleBattleAction}
            onChooseSkill={handleBattleChooseSkill}
            onSelectSquadSlot={handleBattleSelectSlot}
            onCancelSwap={handleBattleCancelSwap}
            onContinue={handleBattleContinue}
            onNextNarration={handleBattleNextNarration}
          />
        )}

        {starterSelection && (
          <StarterSelectionOverlay
            selection={starterSelection}
            hoveredCritterId={hoveredStarterCritterId}
            onHoverCritter={setHoveredStarterCritterId}
            onSelectCritter={handleSelectStarterCandidate}
            onConfirm={handleConfirmStarterCandidate}
            onCancel={handleCancelStarterCandidate}
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
                          iconsBucketRoot={iconsBucketRoot}
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
                            iconsBucketRoot={iconsBucketRoot}
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
                    iconsBucketRoot={iconsBucketRoot}
                    showStatBreakdown={Boolean(expandedStatsByCritterId[entry.critterId])}
                    onToggleStatInfo={() => handleToggleStatInfo(entry.critterId)}
                    onAdvanceCritter={handleAdvanceCritter}
                    onEquipSkill={handleEquipSkill}
                    onUnequipSkill={handleUnequipSkill}
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
  shade: '#b8a0e0',
  normal: '#b0b0b0',
};

function collectionCardStyle(element: string): CSSProperties {
  return {
    '--collection-accent': ELEMENT_ACCENTS[element] ?? '#7bc8ff',
  } as CSSProperties;
}

interface CritterCardProps {
  entry: CritterCardEntry;
  elementLogoBucketRoot: string | null;
  iconsBucketRoot: string | null;
  showStatBreakdown: boolean;
  onToggleStatInfo: () => void;
  onAdvanceCritter?: (critterId: number) => void;
  onSelectCritter?: (critterId: number) => void;
  onEquipSkill?: (critterId: number, slotIndex: number, skillId: string | null) => void;
  onUnequipSkill?: (critterId: number, slotIndex: number) => void;
  isSelectionDisabled?: boolean;
  healthProgress?: {
    currentHp: number;
    maxHp: number;
  };
}

function buildSkillSlotTooltip(slot: {
  name: string;
  element?: string;
  type: string;
  damage?: number;
  healPercent?: number;
  effectDescriptions?: string | null;
}): string {
  const lines: string[] = [slot.name];
  const typeLabel = slot.type === 'damage' ? 'Damage' : 'Support';
  const elementLabel = slot.element ? ` • ${slot.element.charAt(0).toUpperCase() + slot.element.slice(1)}` : '';
  lines.push(`${typeLabel}${elementLabel}`);
  if (slot.type === 'damage' && slot.damage != null) {
    lines.push(`Power: ${slot.damage}`);
  }
  if (slot.type === 'support' && slot.healPercent != null) {
    lines.push(`Heals: ${Math.round((slot.healPercent ?? 0) * 100)}% HP`);
  }
  if (slot.effectDescriptions && slot.effectDescriptions.trim()) {
    lines.push(`Effect: ${slot.effectDescriptions.trim()}`);
  }
  return lines.join('\n');
}

interface SkillCellContentProps {
  slot: {
    name: string;
    element: string;
    type: string;
    damage?: number;
    healPercent?: number;
    effectIconUrls?: string[];
  } | null;
  iconsBucketRoot: string | null;
  emptyLabel?: string;
}

function SkillCellContent({ slot, iconsBucketRoot, emptyLabel = '—' }: SkillCellContentProps) {
  if (!slot) {
    return <>{emptyLabel}</>;
  }
  const elementLogoUrl = buildElementLogoUrlFromIconsBucket(slot.element, iconsBucketRoot);
  const typeLabel = slot.type === 'damage' ? 'D' : 'S';
  const value = slot.type === 'damage' ? slot.damage : slot.healPercent != null ? Math.round(slot.healPercent * 100) : null;
  return (
    <>
      {elementLogoUrl && (
        <img src={elementLogoUrl} alt={slot.element} className="skill-cell__element-logo" loading="lazy" decoding="async" />
      )}
      <span className="skill-cell__name">{slot.name}</span>
      <span className="skill-cell__spacer"> </span>
      <span className="skill-cell__type">{typeLabel}</span>
      {value != null && <span className="skill-cell__value">{value}</span>}
      {slot.effectIconUrls && slot.effectIconUrls.length > 0 && (
        <>
          {slot.effectIconUrls.map((url, i) => (
            <img key={`${url}-${i}`} src={url} alt="" className="skill-cell__effect-icon" loading="lazy" decoding="async" />
          ))}
        </>
      )}
    </>
  );
}

function CritterCard({
  entry,
  elementLogoBucketRoot,
  iconsBucketRoot,
  showStatBreakdown,
  onToggleStatInfo,
  onAdvanceCritter,
  onSelectCritter,
  onEquipSkill,
  onUnequipSkill,
  isSelectionDisabled = false,
  healthProgress,
}: CritterCardProps) {
  const [skillPopup, setSkillPopup] = useState<{ slotIndex: number } | null>(null);
  const equippedSlots = entry.equippedSkillSlots ?? [null, null, null, null];
  const unlockedOptions = entry.unlockedSkillOptions ?? [];
  const equippedCount = equippedSlots.filter((s) => s !== null).length;
  const elementLogoUrl = buildElementLogoUrlFromIconsBucket(entry.element, iconsBucketRoot) ?? buildElementLogoUrl(entry.element, entry.spriteUrl, elementLogoBucketRoot);
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
      <div className="collection-card__body">
      <header className="collection-card__head">
        {elementLogoUrl ? (
          <img
            src={elementLogoUrl}
            alt={`${entry.element} element`}
            className="collection-card__element-logo"
            loading="lazy"
            decoding="async"
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
          decoding="async"
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
      <section className="collection-card__stats">
        <h3>Stats</h3>
        <dl>
          <div><dt>HP</dt><dd>{formatStatValue(entry.baseStats.hp, entry.statBonus.hp, showStatBreakdown)}</dd></div>
          <div><dt>ATK</dt><dd>{formatStatValue(entry.baseStats.attack, entry.statBonus.attack, showStatBreakdown)}</dd></div>
          <div><dt>DEF</dt><dd>{formatStatValue(entry.baseStats.defense, entry.statBonus.defense, showStatBreakdown)}</dd></div>
          <div><dt>SPD</dt><dd>{formatStatValue(entry.baseStats.speed, entry.statBonus.speed, showStatBreakdown)}</dd></div>
        </dl>
      </section>
      <section className="collection-card__skills">
        <h3>Skills</h3>
        <div className="collection-card__skill-grid">
          {entry.unlocked
            ? equippedSlots.map((slot, index) => {
                const color = slot && ELEMENT_SKILL_COLORS[slot.element as keyof typeof ELEMENT_SKILL_COLORS] ? ELEMENT_SKILL_COLORS[slot.element as keyof typeof ELEMENT_SKILL_COLORS] : undefined;
                const tooltip = slot ? buildSkillSlotTooltip(slot) : undefined;
                return (
                  <button
                    key={`skill-${entry.critterId}-${index}`}
                    type="button"
                    className="collection-card__skill-slot"
                    style={color ? { backgroundColor: color, color: '#1a1a1a' } : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onEquipSkill) setSkillPopup({ slotIndex: index });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onUnequipSkill && slot && equippedCount > 1) {
                        onUnequipSkill(entry.critterId, index);
                      }
                    }}
                    title={tooltip || (slot ? undefined : 'Empty slot – click to equip')}
                  >
                    <SkillCellContent slot={slot} iconsBucketRoot={iconsBucketRoot} />
                  </button>
                );
              })
            : [0, 1, 2, 3].map((index) => (
                <div key={`skill-empty-${entry.critterId}-${index}`} className="collection-card__skill-slot collection-card__skill-slot--empty">
                  <SkillCellContent slot={null} iconsBucketRoot={null} emptyLabel="—" />
                </div>
              ))}
        </div>
        {entry.unlocked && skillPopup !== null && onEquipSkill && (
          <div
            className="collection-card__skill-popup"
            role="dialog"
            aria-label="Equip skill"
          >
            <p className="collection-card__skill-popup-title">Equip or replace skill (slot {skillPopup.slotIndex + 1})</p>
            <div className="collection-card__skill-popup-list">
              {unlockedOptions.map((opt) => (
                <button
                  key={opt.skillId}
                  type="button"
                  className="secondary collection-card__skill-popup-option"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEquipSkill(entry.critterId, skillPopup.slotIndex, opt.skillId);
                    setSkillPopup(null);
                  }}
                >
                  {opt.skillId} – {opt.name}
                </button>
              ))}
              <button
                type="button"
                className="secondary collection-card__skill-popup-option"
                onClick={(e) => {
                  e.stopPropagation();
                  onEquipSkill(entry.critterId, skillPopup.slotIndex, null);
                  setSkillPopup(null);
                }}
              >
                Clear slot
              </button>
            </div>
            <button type="button" className="secondary" onClick={() => setSkillPopup(null)}>
              Cancel
            </button>
          </div>
        )}
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
      </div>
      {entry.canAdvance && entry.advanceActionLabel && onAdvanceCritter && (
        <button
          type="button"
          className={`collection-card__advance ${entry.advanceActionLabel === 'Unlock' ? 'collection-card__advance--unlock' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onAdvanceCritter(entry.critterId);
          }}
        >
          {entry.advanceActionLabel}
        </button>
      )}
    </article>
  );
}

interface StarterSelectionOverlayProps {
  selection: NonNullable<RuntimeSnapshot['story']['starterSelection']>;
  hoveredCritterId: number | null;
  onHoverCritter: (critterId: number | null) => void;
  onSelectCritter: (critterId: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function StarterSelectionOverlay({
  selection,
  hoveredCritterId,
  onHoverCritter,
  onSelectCritter,
  onConfirm,
  onCancel,
}: StarterSelectionOverlayProps) {
  const hoveredCritter = selection.options.find((entry) => entry.critterId === hoveredCritterId) ?? null;
  const confirmCritter =
    selection.confirmCritterId !== null
      ? selection.options.find((entry) => entry.critterId === selection.confirmCritterId) ?? null
      : null;

  return (
    <div className="starter-overlay">
      <section className="starter-overlay__panel">
        <p className="starter-overlay__speaker">Uncle Hank</p>
        <h3>Starter Critter Pickup</h3>
        {hoveredCritter && (
          <p className="starter-overlay__hover-prompt">
            Would you like to select {hoveredCritter.name}?
          </p>
        )}
        <div className="starter-overlay__cards">
          {selection.options.map((entry) => {
            const hovered = hoveredCritterId === entry.critterId;
            return (
              <button
                key={`starter-option-${entry.critterId}`}
                type="button"
                className={`starter-overlay__card ${hovered ? 'is-hovered' : ''}`}
                onMouseEnter={() => onHoverCritter(entry.critterId)}
                onMouseLeave={() => onHoverCritter(null)}
                onClick={() => onSelectCritter(entry.critterId)}
              >
                {entry.spriteUrl ? (
                  <img src={entry.spriteUrl} alt={entry.name} loading="lazy" decoding="async" />
                ) : (
                  <div className="starter-overlay__card-missing">No Sprite</div>
                )}
                <span>#{entry.critterId} {entry.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {confirmCritter && (
        <section className="starter-overlay__confirm">
          <p className="starter-overlay__speaker">Uncle Hank</p>
          <p>Are you sure you want to choose {confirmCritter.name}?</p>
          <div className="starter-overlay__confirm-actions">
            <button type="button" className="primary" onClick={onConfirm}>Yes</button>
            <button type="button" className="secondary" onClick={onCancel}>No</button>
          </div>
        </section>
      )}
    </div>
  );
}

interface BattleOverlayProps {
  battle: BattleSnapshot;
  iconsBucketRoot: string | null;
  onAction: (action: 'guard' | 'swap' | 'retreat') => void;
  onChooseSkill: (skillSlotIndex: number) => void;
  onSelectSquadSlot: (slotIndex: number) => void;
  onCancelSwap: () => void;
  onContinue: () => void;
  onNextNarration: () => void;
}

function BattleOverlay({
  battle,
  iconsBucketRoot,
  onAction,
  onChooseSkill,
  onSelectSquadSlot,
  onCancelSwap,
  onContinue,
  onNextNarration,
}: BattleOverlayProps) {
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  useEffect(() => {
    if (battle.canAdvanceNarration || battle.phase !== 'player-turn') {
      setShowSkillPicker(false);
    }
  }, [battle.canAdvanceNarration, battle.phase]);
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

  const canSelectSquad = !battle.canAdvanceNarration && (battle.requiresStarterSelection || battle.requiresSwapSelection);

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
            squadEntries={battle.playerTeam}
            playerActiveIndex={battle.playerActiveIndex}
            canSelectSquad={canSelectSquad}
            onSelectSquadSlot={onSelectSquadSlot}
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
          <div className="battle-screen__log-wrap">
            <p className="battle-screen__log">{battle.logLine}</p>
            {!battle.canAdvanceNarration && battle.phase === 'player-turn' && showSkillPicker && (
              <a
                href="#"
                className="battle-screen__back-link"
                onClick={(e) => {
                  e.preventDefault();
                  setShowSkillPicker(false);
                }}
              >
                ← Back
              </a>
            )}
          </div>

          <div className="battle-actions">
            {battle.canAdvanceNarration && (
              <button type="button" className="primary battle-screen__continue-button" onClick={onNextNarration}>
                Next
              </button>
            )}

            {!battle.canAdvanceNarration && battle.phase === 'player-turn' && (
              <>
                {!showSkillPicker ? (
                  <>
                    <button
                      key="action-0"
                      type="button"
                      className="primary"
                      disabled={!battle.canAttack}
                      onClick={() => setShowSkillPicker(true)}
                    >
                      Attack
                    </button>
                    <button key="action-1" type="button" className="secondary" disabled={!battle.canGuard} onClick={() => onAction('guard')}>
                      Guard
                    </button>
                    <button key="action-2" type="button" className="secondary" disabled={!battle.canSwap} onClick={() => onAction('swap')}>
                      Swap
                    </button>
                    <button
                      key="action-3"
                      type="button"
                      className="secondary"
                      disabled={!battle.canRetreat}
                      onClick={() => onAction('retreat')}
                    >
                      Retreat
                    </button>
                  </>
                ) : (
                  (() => {
                    const battleIconsRoot =
                      iconsBucketRoot ??
                      (() => {
                        for (const s of battle.playerActiveSkillSlots ?? []) {
                          if (s?.effectIconUrls && s.effectIconUrls.length > 0) {
                            try {
                              const u = new URL(s.effectIconUrls[0]);
                              const marker = '/storage/v1/object/public/';
                              const i = u.pathname.indexOf(marker);
                              if (i >= 0) {
                                u.pathname = u.pathname.substring(0, i) + marker + 'icons';
                                return u.toString().replace(/\/+$/, '');
                              }
                            } catch {
                              // ignore
                            }
                          }
                        }
                        return null;
                      })();
                    return (
                  <>
                    {(battle.playerActiveSkillSlots ?? [null, null, null, null]).map((slot, index) => {
                      const color = slot && ELEMENT_SKILL_COLORS[slot.element as keyof typeof ELEMENT_SKILL_COLORS] ? ELEMENT_SKILL_COLORS[slot.element as keyof typeof ELEMENT_SKILL_COLORS] : undefined;
                      const tooltip = slot ? buildSkillSlotTooltip(slot) : undefined;
                      return (
                        <button
                          key={`skill-${index}`}
                          type="button"
                          className={`battle-skill-button ${color ? 'battle-skill-button--colored' : ''}`}
                          style={color ? { ['--battle-skill-bg' as string]: color } : undefined}
                          disabled={!slot}
                          onClick={() => {
                            if (slot) {
                              onChooseSkill(index);
                              setShowSkillPicker(false);
                            }
                          }}
                      title={tooltip || undefined}
                    >
                      <SkillCellContent slot={slot} iconsBucketRoot={battleIconsRoot} />
                    </button>
                      );
                    })}
                  </>
                    );
                  })() )}
              </>
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
  squadEntries?: BattleSnapshot['playerTeam'];
  playerActiveIndex?: number | null;
  canSelectSquad?: boolean;
  onSelectSquadSlot?: (slotIndex: number) => void;
}

function BattleActivePanel({
  title,
  position,
  critter,
  isAttacking,
  attackToken,
  squadEntries = [],
  playerActiveIndex = null,
  canSelectSquad = false,
  onSelectSquadSlot,
}: BattleActivePanelProps) {
  const hpPercent = critter
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, critter.currentHp) / Math.max(1, critter.maxHp)) * 100)))
    : 0;
  const attackStyle = {
    animationDelay: isAttacking && attackToken !== null ? `${attackToken % 2}ms` : undefined,
  } as CSSProperties;

  const showSquadGrid = position === 'player' && squadEntries.length > 0 && canSelectSquad;

  const effectIcons = critter?.activeEffectIconUrls ?? [];
  const effectDescriptions = critter?.activeEffectDescriptions ?? [];

  return (
    <article className={`battle-critter battle-critter--${position}`}>
      <p className="battle-critter__title">{title}</p>
      {effectIcons.length > 0 && (
        <div className="battle-critter__effect-bubbles" aria-label="Active effects">
          {effectIcons.map((url, i) => (
            <span key={`${url}-${i}`} className="battle-critter__effect-bubble" title={effectDescriptions[i]?.trim() || undefined}>
              <img src={url} alt="" className="battle-critter__effect-icon" loading="lazy" decoding="async" />
            </span>
          ))}
        </div>
      )}
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
              decoding="async"
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
      ) : null}
      {showSquadGrid && (
        <div className="battle-critter__squad-grid-wrap">
          <div className="battle-squad-grid" aria-label="Squad">
            {squadEntries.map((entry, index) => {
              const isActive = playerActiveIndex === index;
              const disabled = !canSelectSquad || entry.fainted || entry.currentHp <= 0 || isActive;
              const slotIndex = entry.slotIndex ?? index;
              return (
                <button
                  key={`squad-cell-${slotIndex}`}
                  type="button"
                  className={`battle-squad-grid__cell ${isActive ? 'is-active' : ''} ${entry.fainted ? 'is-fainted' : ''}`}
                  disabled={disabled}
                  onClick={() => {
                    if (entry.slotIndex !== null && onSelectSquadSlot) {
                      onSelectSquadSlot(entry.slotIndex);
                    }
                  }}
                  title={entry.name}
                >
                  {entry.spriteUrl ? (
                    <img
                      src={entry.spriteUrl}
                      alt={entry.name}
                      className="battle-squad-grid__sprite"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="battle-squad-grid__empty">?</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
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
  storyFlagId?: string;
  label?: string;
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
  if (mission.type === 'story_flag') {
    if (mission.label && mission.label.trim()) {
      return mission.label.trim();
    }
    if (mission.storyFlagId && mission.storyFlagId.trim()) {
      return `Story Flag: ${mission.storyFlagId.trim()}`;
    }
    return 'Story Flag';
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

function buildElementLogoUrlFromIconsBucket(element: string, iconsBucketRoot: string | null): string | null {
  if (!iconsBucketRoot) {
    return null;
  }
  return `${iconsBucketRoot}/${encodeURIComponent(`${element}-element.png`)}`;
}

async function toggleFullscreen(viewport: HTMLElement): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  await viewport.requestFullscreen();
}
