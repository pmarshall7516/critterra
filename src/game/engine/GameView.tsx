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

type SideMenuView = 'root' | 'squad' | 'collection' | 'backpack';
type CollectionSort = 'id' | 'name';
type CritterCardEntry = RuntimeSnapshot['critters']['collection'][number];
type BattleSnapshot = NonNullable<RuntimeSnapshot['battle']>;
type BattleTeamEntry = BattleSnapshot['playerTeam'][number];
type BackpackSort = 'name' | 'category';
type BackpackItemEntry = RuntimeSnapshot['backpack']['items'][number];
type GameViewKeyIntent = 'toggle-fullscreen' | 'battle-cancel' | 'toggle-menu' | 'block-for-menu' | 'forward-to-runtime';

interface ResolveGameViewKeyIntentInput {
  key: string;
  battleActive: boolean;
  storyInputLocked: boolean;
  menuOpen: boolean;
}

export function resolveGameViewKeyIntent(input: ResolveGameViewKeyIntentInput): GameViewKeyIntent {
  const { key, battleActive, storyInputLocked, menuOpen } = input;
  if (key === 'y' || key === 'Y') {
    return 'toggle-fullscreen';
  }
  if (battleActive && key === 'Escape') {
    return 'battle-cancel';
  }
  if (!battleActive && key === 'Escape') {
    if (storyInputLocked) {
      return 'block-for-menu';
    }
    return 'toggle-menu';
  }
  if (menuOpen || battleActive) {
    return 'block-for-menu';
  }
  return 'forward-to-runtime';
}

export function GameView({ mode, playerName, onReturnToTitle }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const squadGridRef = useRef<HTMLDivElement | null>(null);
  const menuOpenRef = useRef(false);
  const battleActiveRef = useRef(false);
  const renderSizeRef = useRef<ViewportSize>(DEFAULT_VIEWPORT);
  const manualStepUntilRef = useRef(0);
  const storyInputLockedRef = useRef(false);
  const healPromptActiveRef = useRef(false);

  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<SideMenuView>('root');
  const [collectionSearchInput, setCollectionSearchInput] = useState('');
  const [collectionSort, setCollectionSort] = useState<CollectionSort>('id');
  const [backpackSearchInput, setBackpackSearchInput] = useState('');
  const [backpackSort, setBackpackSort] = useState<BackpackSort>('name');
  const [backpackCategoryFilter, setBackpackCategoryFilter] = useState<'all' | string>('all');
  const [backpackHealingItemId, setBackpackHealingItemId] = useState<string | null>(null);
  const [squadPickerSlotIndex, setSquadPickerSlotIndex] = useState<number | null>(null);
  const [squadSearchInput, setSquadSearchInput] = useState('');
  const [expandedStatsByCritterId, setExpandedStatsByCritterId] = useState<Record<number, boolean>>({});
  const [squadLargestOccupiedCardHeight, setSquadLargestOccupiedCardHeight] = useState<number | null>(null);
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
    storyInputLockedRef.current = Boolean(snapshot?.story.inputLocked || snapshot?.dialogue || snapshot?.story.healPrompt);
    healPromptActiveRef.current = Boolean(snapshot?.story.healPrompt);
    if (!snapshot?.story.starterSelection) {
      setHoveredStarterCritterId(null);
    }
  }, [snapshot?.dialogue, snapshot?.story.healPrompt, snapshot?.story.inputLocked, snapshot?.story.starterSelection]);

  useEffect(() => {
    if ((snapshot?.dialogue || snapshot?.story.healPrompt) && menuOpen) {
      setMenuOpen(false);
    }
  }, [menuOpen, snapshot?.dialogue, snapshot?.story.healPrompt]);

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
      setBackpackHealingItemId(null);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (menuView !== 'squad') {
      setSquadPickerSlotIndex(null);
      setSquadSearchInput('');
      setBlockedSquadRemovalNotice(null);
    }
    if (menuView !== 'backpack') {
      setBackpackHealingItemId(null);
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
      const keyIntent = resolveGameViewKeyIntent({
        key,
        battleActive: battleActiveRef.current,
        storyInputLocked: storyInputLockedRef.current,
        menuOpen: menuOpenRef.current,
      });

      if (keyIntent === 'toggle-fullscreen') {
        event.preventDefault();
        void toggleFullscreen(viewport);
        return;
      }

      if (keyIntent === 'battle-cancel') {
        event.preventDefault();
        const changed = runtime.cancelBattleSwapSelection();
        if (changed) {
          setSnapshot(runtime.getSnapshot());
        }
        return;
      }

      if (battleActiveRef.current) {
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

      if (
        healPromptActiveRef.current &&
        (key === 'y' || key === 'Y' || key === 'n' || key === 'N' || key === 'Enter')
      ) {
        event.preventDefault();
      }

      if (keyIntent === 'toggle-menu') {
        event.preventDefault();
        setMenuOpen((open) => !open);
        return;
      }

      if (keyIntent === 'block-for-menu') {
        if (key === 'Escape') {
          event.preventDefault();
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
        key === 'f' ||
        key === 'F' ||
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

  const handleUseBackpackItem = (item: BackpackItemEntry) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    if (item.effectType === 'heal_flat' || item.effectType === 'heal_percent') {
      setBackpackHealingItemId(item.itemId);
      return;
    }
    const changed = runtime.useBackpackItem(item.itemId);
    setSnapshot(runtime.getSnapshot());
    if (!changed) {
      return;
    }
  };

  const handleUseBackpackHealingItemOnSlot = (itemId: string, slotIndex: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.useBackpackItemOnSquadSlot(itemId, slotIndex);
    setSnapshot(runtime.getSnapshot());
    if (changed) {
      setBackpackHealingItemId(null);
    }
  };

  const handleAssignSquadCritter = (critterId: number) => {
    const runtime = runtimeRef.current;
    if (!runtime || squadPickerSlotIndex === null) {
      return;
    }

    const changed = runtime.assignCritterToSquadSlot(squadPickerSlotIndex, critterId);
    setSnapshot(runtime.getSnapshot());
    if (changed) {
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
    setSnapshot(runtime.getSnapshot());
    if (changed) {
      setBlockedSquadRemovalNotice(null);
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

  const handleHealPromptChoice = (shouldHeal: boolean) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const changed = runtime.chooseHealPrompt(shouldHeal);
    if (changed) {
      setSnapshot(runtime.getSnapshot());
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const critterState = snapshot?.critters;
  const backpackState = snapshot?.backpack;
  const starterSelection = snapshot?.story.starterSelection ?? null;
  const healPrompt = snapshot?.story.healPrompt ?? null;
  const squadSlots = critterState?.squadSlots ?? [];
  const collection = critterState?.collection ?? [];
  const backpackItems = backpackState?.items ?? [];
  const backpackCategories = backpackState?.categories ?? [];
  useEffect(() => {
    if (backpackCategoryFilter === 'all') {
      return;
    }
    if (!backpackCategories.includes(backpackCategoryFilter)) {
      setBackpackCategoryFilter('all');
    }
  }, [backpackCategories, backpackCategoryFilter]);
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
  const hasAssignedSquadCritter = assignedSquadCritterIds.size > 0;
  const squadGridStyle = useMemo(() => {
    if (!Number.isFinite(squadLargestOccupiedCardHeight) || squadLargestOccupiedCardHeight === null) {
      return undefined;
    }
    return {
      '--squad-slot-target-height': `${Math.ceil(squadLargestOccupiedCardHeight)}px`,
    } as CSSProperties;
  }, [squadLargestOccupiedCardHeight]);
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
  const displayBackpackItems = useMemo(() => {
    const query = backpackSearchInput.trim().toLowerCase();
    let filtered = !query
      ? [...backpackItems]
      : backpackItems.filter((item) => {
          return (
            item.name.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
          );
        });
    if (backpackCategoryFilter !== 'all') {
      filtered = filtered.filter((item) => item.category === backpackCategoryFilter);
    }
    filtered.sort((left, right) => {
      if (backpackSort === 'category') {
        const byCategory = left.category.localeCompare(right.category, undefined, { sensitivity: 'base' });
        if (byCategory !== 0) {
          return byCategory;
        }
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });
    return filtered;
  }, [backpackCategoryFilter, backpackItems, backpackSearchInput, backpackSort]);
  const backpackHealingItem = useMemo(
    () => (backpackHealingItemId ? backpackItems.find((item) => item.itemId === backpackHealingItemId) ?? null : null),
    [backpackHealingItemId, backpackItems],
  );
  const backpackHealingTargetSlots = useMemo(() => squadSlots, [squadSlots]);

  useEffect(() => {
    if (menuView !== 'squad') {
      setSquadLargestOccupiedCardHeight(null);
      return;
    }

    const squadGridNode = squadGridRef.current;
    if (!squadGridNode) {
      setSquadLargestOccupiedCardHeight(null);
      return;
    }

    const cardSelector = '.squad-slot.is-unlocked .collection-card';
    const measureLargestCard = () => {
      const occupiedCards = Array.from(squadGridNode.querySelectorAll<HTMLElement>(cardSelector));
      if (occupiedCards.length === 0) {
        setSquadLargestOccupiedCardHeight(null);
        return;
      }

      let largestHeight = 0;
      for (const card of occupiedCards) {
        largestHeight = Math.max(largestHeight, card.getBoundingClientRect().height);
      }
      const nextHeight = largestHeight > 0 ? Math.ceil(largestHeight) : null;
      setSquadLargestOccupiedCardHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    let frameHandle = window.requestAnimationFrame(measureLargestCard);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            window.cancelAnimationFrame(frameHandle);
            frameHandle = window.requestAnimationFrame(measureLargestCard);
          })
        : null;

    if (resizeObserver) {
      const occupiedCards = Array.from(squadGridNode.querySelectorAll<HTMLElement>(cardSelector));
      for (const card of occupiedCards) {
        resizeObserver.observe(card);
      }
    }

    return () => {
      window.cancelAnimationFrame(frameHandle);
      resizeObserver?.disconnect();
    };
  }, [collection, expandedStatsByCritterId, menuView, squadSlots]);

  useEffect(() => {
    if (menuView === 'squad' && !hasAssignedSquadCritter) {
      setMenuView('root');
    }
  }, [hasAssignedSquadCritter, menuView]);

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

        {healPrompt && !snapshot?.dialogue && (
          <div className="dialogue-box">
            <p className="dialogue-box__speaker">{healPrompt.speaker}</p>
            <p>{healPrompt.text}</p>
            <div className="dialogue-box__actions">
              <button type="button" className="primary" onClick={() => handleHealPromptChoice(true)}>
                Yes
              </button>
              <button type="button" className="secondary" onClick={() => handleHealPromptChoice(false)}>
                No
              </button>
            </div>
            <p className="dialogue-box__meta">Press Y or Space for Yes. Press N for No.</p>
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
          className={`side-menu ${menuOpen ? 'is-open' : ''} ${menuView === 'collection' || menuView === 'backpack' ? 'side-menu--collection' : ''} ${
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
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setMenuView('squad')}
                  disabled={!hasAssignedSquadCritter}
                  title={!hasAssignedSquadCritter ? 'No critters are currently assigned to your squad.' : undefined}
                >
                  Squad
                </button>
                <button type="button" className="secondary" onClick={() => setMenuView('backpack')}>
                  Backpack
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
              {snapshot?.message && <p className="side-menu__notice">{snapshot.message}</p>}
              <div className={`squad-layout ${squadPickerSlotIndex !== null ? 'is-picking' : ''}`}>
                <div className="squad-grid" ref={squadGridRef} style={squadGridStyle}>
                  {squadSlots.map((slot) => {
                    const slottedCritter = slot.critterId ? collectionById.get(slot.critterId) ?? null : null;
                    const isKnockedOutSlot =
                      slot.unlocked &&
                      slot.critterId !== null &&
                      slot.currentHp !== null &&
                      slot.currentHp <= 0;
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
                        } ${isBlockedRemovalSlot ? 'is-removal-blocked' : ''} ${
                          isKnockedOutSlot ? 'is-knocked-out' : ''
                        }`}
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
                            onEquipSkill={handleEquipSkill}
                            onUnequipSkill={handleUnequipSkill}
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
                        {isKnockedOutSlot && <div className="squad-slot__ko-badge">Knocked Out</div>}
                        {isBlockedRemovalSlot && (
                          <div className="squad-slot__blocked-popup">You need at least 1 Critter!</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {squadPickerSlotIndex !== null && (
                <div className="squad-picker-modal" role="dialog" aria-modal="true" aria-label="Choose squad critter">
                  <button type="button" className="squad-picker-modal__backdrop" onClick={() => setSquadPickerSlotIndex(null)} />
                  <section className="squad-picker">
                    <div className="squad-picker__toolbar">
                      <input
                        value={squadSearchInput}
                        onChange={(event) => setSquadSearchInput(event.target.value)}
                        placeholder="Search unlocked critters"
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
                </div>
              )}
              <div className="side-menu__actions">
                <button type="button" className="secondary" onClick={() => setMenuView('root')}>
                  Back
                </button>
              </div>
            </>
          ) : menuView === 'backpack' ? (
            <>
              <h2>Backpack</h2>
              <p className="side-menu__meta">
                {backpackState?.totalOwnedKinds ?? 0} item types | {backpackState?.totalOwnedCount ?? 0} total items.
              </p>
              {snapshot?.message && <p className="side-menu__notice">{snapshot.message}</p>}
              <div className="collection-toolbar">
                <label className="collection-toolbar__search">
                  Search
                  <input
                    value={backpackSearchInput}
                    onChange={(event) => setBackpackSearchInput(event.target.value)}
                    placeholder="Name, category, or description"
                  />
                </label>
                <div className="collection-toolbar__sort">
                  <span>Sort</span>
                  <button
                    type="button"
                    className={`secondary ${backpackSort === 'name' ? 'is-selected' : ''}`}
                    onClick={() => setBackpackSort('name')}
                  >
                    Name
                  </button>
                  <button
                    type="button"
                    className={`secondary ${backpackSort === 'category' ? 'is-selected' : ''}`}
                    onClick={() => setBackpackSort('category')}
                  >
                    Category
                  </button>
                </div>
                <div className="collection-toolbar__sort">
                  <span>Filter</span>
                  <button
                    type="button"
                    className={`secondary ${backpackCategoryFilter === 'all' ? 'is-selected' : ''}`}
                    onClick={() => setBackpackCategoryFilter('all')}
                  >
                    All
                  </button>
                  {backpackCategories.map((category) => (
                    <button
                      key={`backpack-filter-${category}`}
                      type="button"
                      className={`secondary ${backpackCategoryFilter === category ? 'is-selected' : ''}`}
                      onClick={() => setBackpackCategoryFilter(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              <div className="collection-grid backpack-grid">
                {displayBackpackItems.map((item) => (
                  <BackpackItemCard key={`backpack-${item.itemId}`} item={item} onUse={() => handleUseBackpackItem(item)} />
                ))}
                {displayBackpackItems.length === 0 && (
                  <p className="collection-card__mission-summary">No items match that search/filter.</p>
                )}
              </div>
              {backpackHealingItem && (
                <section className="backpack-heal-picker">
                  <p className="side-menu__meta">Select a squad critter to use {backpackHealingItem.name}.</p>
                  <div className="backpack-heal-picker__grid">
                    {backpackHealingTargetSlots.map((slot) => {
                      const critterEntry = slot.critterId ? collectionById.get(slot.critterId) ?? null : null;
                      const isSelectable = slot.unlocked && slot.critterId !== null;
                      const critterName = slot.critterName ?? critterEntry?.name ?? (slot.unlocked ? 'Empty' : 'Locked');
                      const maxHp = Math.max(1, slot.maxHp ?? critterEntry?.effectiveStats.hp ?? 1);
                      const currentHp = Math.max(0, Math.min(slot.currentHp ?? 0, maxHp));
                      const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));
                      const hpTier = hpPercent <= 25 ? 'critical' : hpPercent <= 55 ? 'warning' : 'healthy';
                      const hpStyle = {
                        '--backpack-heal-hp-fill': `${hpPercent}%`,
                      } as CSSProperties;
                      return (
                        <button
                          key={`backpack-heal-slot-${slot.index}`}
                          type="button"
                          className={`backpack-heal-target-card ${currentHp <= 0 ? 'is-knocked-out' : ''} ${
                            isSelectable ? '' : 'is-disabled'
                          }`}
                          onClick={() => handleUseBackpackHealingItemOnSlot(backpackHealingItem.itemId, slot.index)}
                          disabled={!isSelectable}
                          title={`Slot ${slot.index + 1}: ${critterName}`}
                        >
                          <span className="backpack-heal-target-card__slot">Slot {slot.index + 1}</span>
                          <span className="backpack-heal-target-card__name">{critterName}</span>
                          {critterEntry?.spriteUrl ? (
                            <img
                              src={critterEntry.spriteUrl}
                              alt={critterName}
                              className="backpack-heal-target-card__sprite"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="backpack-heal-target-card__sprite backpack-heal-target-card__sprite--missing">
                              No Sprite
                            </div>
                          )}
                          {isSelectable ? (
                            <div className={`backpack-heal-target-card__hp is-${hpTier}`} style={hpStyle}>
                              <span className="backpack-heal-target-card__hp-fill" />
                              <span className="backpack-heal-target-card__hp-label">
                                HP {currentHp}/{maxHp}
                              </span>
                            </div>
                          ) : (
                            <span className="backpack-heal-target-card__status">{slot.unlocked ? 'No critter' : 'Locked slot'}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" className="secondary" onClick={() => setBackpackHealingItemId(null)}>
                    Cancel
                  </button>
                </section>
              )}
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
                    healthProgress={
                      entry.currentHp !== null && entry.maxHp !== null
                        ? {
                            currentHp: entry.currentHp,
                            maxHp: entry.maxHp,
                          }
                        : undefined
                    }
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

interface BackpackItemCardProps {
  item: BackpackItemEntry;
  onUse: () => void;
}

function BackpackItemCard({ item, onUse }: BackpackItemCardProps) {
  const detailsText = item.description.trim() || item.effectSummary;
  return (
    <article className={`collection-card backpack-card ${item.hasUseAction && !item.canUse ? 'is-locked' : ''}`}>
      <div className="collection-card__body">
        <header className="backpack-card__head">
          <span className="backpack-card__name">{item.name}</span>
          <span className="backpack-card__type">{capitalizeToken(item.category)}</span>
        </header>
        <div className="backpack-card__image-wrap">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="collection-card__sprite" loading="lazy" decoding="async" />
          ) : (
            <div className="collection-card__sprite collection-card__sprite--missing">No Image</div>
          )}
        </div>
        <p className="backpack-card__owned">Owned: {item.quantityOwned}</p>
        <section className="backpack-card__details">
          <p className="collection-card__mission-summary">{detailsText || 'No details set.'}</p>
        </section>
      </div>
      {item.hasUseAction && (
        <button
          type="button"
          className="collection-card__advance backpack-card__use"
          disabled={!item.canUse}
          onClick={(event) => {
            event.stopPropagation();
            onUse();
          }}
        >
          Use
        </button>
      )}
      {!item.hasUseAction && <div className="backpack-card__use-spacer" aria-hidden="true" />}
    </article>
  );
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
                      if (onEquipSkill) {
                        e.stopPropagation();
                        setSkillPopup({ slotIndex: index });
                      }
                    }}
                    onContextMenu={(e) => {
                      if (onUnequipSkill && slot) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                      if (onUnequipSkill && slot && equippedCount > 1) {
                        onUnequipSkill(entry.critterId, index);
                      }
                    }}
                    title={tooltip || (!slot && onEquipSkill ? 'Empty slot – click to equip' : undefined)}
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
            onClick={(e) => e.stopPropagation()}
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
            <button
              type="button"
              className="secondary"
              onClick={(e) => {
                e.stopPropagation();
                setSkillPopup(null);
              }}
            >
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
  const showSwapBackLink = !battle.canAdvanceNarration && battle.requiresSwapSelection && battle.canCancelSwap;

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
            teamEntries={battle.playerTeam}
            iconsBucketRoot={iconsBucketRoot}
            isAttacking={battle.activeAnimation?.attacker === 'player'}
            attackToken={battle.activeAnimation?.attacker === 'player' ? battle.activeAnimation.token : null}
            squadEntries={battle.playerTeam}
            playerActiveIndex={battle.playerActiveIndex}
            canSelectSquad={canSelectSquad}
            emptyText={
              canSelectSquad
                ? battle.requiresStarterSelection
                  ? 'Choose your lead critter.'
                  : 'Choose a squad critter.'
                : 'No active critter.'
            }
            onSelectSquadSlot={onSelectSquadSlot}
          />
          <BattleActivePanel
            title="Opponent"
            position="opponent"
            critter={activeOpponent}
            teamEntries={battle.opponentTeam}
            iconsBucketRoot={iconsBucketRoot}
            isAttacking={battle.activeAnimation?.attacker === 'opponent'}
            attackToken={battle.activeAnimation?.attacker === 'opponent' ? battle.activeAnimation.token : null}
            emptyText={
              battle.requiresStarterSelection && battle.source.type === 'npc'
                ? 'Opponent reveals after your pick.'
                : 'No active critter.'
            }
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
            {showSwapBackLink && (
              <a
                href="#"
                className="battle-screen__back-link"
                onClick={(e) => {
                  e.preventDefault();
                  onCancelSwap();
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
  teamEntries?: BattleTeamEntry[];
  iconsBucketRoot: string | null;
  isAttacking: boolean;
  attackToken: number | null;
  squadEntries?: BattleSnapshot['playerTeam'];
  playerActiveIndex?: number | null;
  canSelectSquad?: boolean;
  emptyText?: string;
  onSelectSquadSlot?: (slotIndex: number) => void;
}

const BATTLE_HP_ANIMATION_MIN_MS = 120;
const BATTLE_HP_ANIMATION_MAX_MS = 1400;
const BATTLE_HP_ANIMATION_MS_PER_PERCENT = 16;

function calcBattleHpPercent(entry: BattleSnapshot['playerTeam'][number] | null): number {
  if (!entry) return 0;
  const safeMax = Math.max(1, entry.maxHp);
  const safeCurrent = Math.max(0, Math.min(entry.currentHp, safeMax));
  return Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100));
}

function calcBattleHpAnimationMs(deltaPercent: number): number {
  const safeDelta = Math.max(0, deltaPercent);
  if (safeDelta <= 0) return 0;
  const rawDuration = Math.round(BATTLE_HP_ANIMATION_MIN_MS + safeDelta * BATTLE_HP_ANIMATION_MS_PER_PERCENT);
  return Math.max(BATTLE_HP_ANIMATION_MIN_MS, Math.min(BATTLE_HP_ANIMATION_MAX_MS, rawDuration));
}

function BattleActivePanel({
  title,
  position,
  critter,
  teamEntries = [],
  iconsBucketRoot,
  isAttacking,
  attackToken,
  squadEntries = [],
  playerActiveIndex = null,
  canSelectSquad = false,
  emptyText = 'No active critter.',
  onSelectSquadSlot,
}: BattleActivePanelProps) {
  const [displayCritter, setDisplayCritter] = useState<BattleSnapshot['playerTeam'][number] | null>(critter);
  const [spriteMotion, setSpriteMotion] = useState<'idle' | 'entering' | 'knockout'>('idle');
  const [displayedHpPercent, setDisplayedHpPercent] = useState<number>(() => calcBattleHpPercent(critter));
  const [hpBarTransitionMs, setHpBarTransitionMs] = useState(0);
  const previousCritterRef = useRef<BattleSnapshot['playerTeam'][number] | null>(critter);
  const previousHpIdentityRef = useRef<{ critterId: number; maxHp: number } | null>(
    critter ? { critterId: critter.critterId, maxHp: critter.maxHp } : null,
  );
  const previousAnimatedHpRef = useRef<number>(calcBattleHpPercent(critter));
  const hiddenKnockoutCritterIdRef = useRef<number | null>(null);
  const spriteMotionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (spriteMotionTimeoutRef.current !== null) {
        window.clearTimeout(spriteMotionTimeoutRef.current);
        spriteMotionTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const previous = previousCritterRef.current;
    previousCritterRef.current = critter;

    if (spriteMotionTimeoutRef.current !== null) {
      window.clearTimeout(spriteMotionTimeoutRef.current);
      spriteMotionTimeoutRef.current = null;
    }

    if (!critter) {
      hiddenKnockoutCritterIdRef.current = null;
      setDisplayCritter(null);
      setSpriteMotion('idle');
      return;
    }

    const sameCritter = previous?.critterId === critter.critterId;
    const previousAlive = Boolean(previous && !previous.fainted && previous.currentHp > 0);
    const nowFainted = critter.fainted || critter.currentHp <= 0;

    if (!sameCritter) {
      hiddenKnockoutCritterIdRef.current = null;
      setDisplayCritter(critter);
      setSpriteMotion('entering');
      spriteMotionTimeoutRef.current = window.setTimeout(() => {
        setSpriteMotion('idle');
        spriteMotionTimeoutRef.current = null;
      }, 340);
      return;
    }

    if (hiddenKnockoutCritterIdRef.current === critter.critterId && nowFainted) {
      setDisplayCritter(null);
      setSpriteMotion('idle');
      return;
    }

    if (sameCritter && previousAlive && nowFainted) {
      setDisplayCritter(critter);
      setSpriteMotion('knockout');
      spriteMotionTimeoutRef.current = window.setTimeout(() => {
        hiddenKnockoutCritterIdRef.current = critter.critterId;
        setDisplayCritter((current) => (current && current.critterId === critter.critterId ? null : current));
        setSpriteMotion('idle');
        spriteMotionTimeoutRef.current = null;
      }, 520);
      return;
    }

    setDisplayCritter(critter);
    setSpriteMotion('idle');
  }, [
    critter?.critterId,
    critter?.currentHp,
    critter?.fainted,
    critter?.name,
    critter?.level,
    critter?.attack,
    critter?.defense,
    critter?.speed,
    critter?.spriteUrl,
    critter?.element,
    critter?.maxHp,
  ]);

  const critterForRender = displayCritter;
  const battleDotStates = buildBattleDotStates(teamEntries, position === 'player');
  const attackStyle = {
    animationDelay: isAttacking && attackToken !== null ? `${attackToken % 2}ms` : undefined,
  } as CSSProperties;
  const hpFillStyle = {
    width: `${displayedHpPercent}%`,
    '--battle-hp-transition-ms': `${hpBarTransitionMs}ms`,
  } as CSSProperties;

  const showSquadGrid = position === 'player' && squadEntries.length > 0 && canSelectSquad;

  const effectIcons = critterForRender?.activeEffectIconUrls ?? [];
  const effectDescriptions = critterForRender?.activeEffectDescriptions ?? [];
  const elementLogoUrl = critterForRender
    ? buildElementLogoUrlFromIconsBucket(critterForRender.element, iconsBucketRoot) ??
      buildElementLogoUrl(critterForRender.element, critterForRender.spriteUrl, null)
    : null;
  const elementToken = critterForRender ? critterForRender.element.trim().slice(0, 2).toUpperCase() : '';
  const spriteClasses = [
    'battle-critter__sprite',
    isAttacking ? 'is-attacking' : '',
    spriteMotion === 'entering' ? 'is-entering' : '',
    spriteMotion === 'knockout' ? 'is-knocked-out' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const missingSpriteClasses = [
    'battle-critter__sprite',
    'battle-critter__sprite--missing',
    isAttacking ? 'is-attacking' : '',
    spriteMotion === 'entering' ? 'is-entering' : '',
    spriteMotion === 'knockout' ? 'is-knocked-out' : '',
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (!critterForRender) {
      previousHpIdentityRef.current = null;
      previousAnimatedHpRef.current = 0;
      setHpBarTransitionMs(0);
      setDisplayedHpPercent(0);
      return;
    }

    const nextPercent = calcBattleHpPercent(critterForRender);
    const previousHpIdentity = previousHpIdentityRef.current;
    const isNewCritter =
      !previousHpIdentity ||
      previousHpIdentity.critterId !== critterForRender.critterId ||
      previousHpIdentity.maxHp !== critterForRender.maxHp;

    if (isNewCritter) {
      previousAnimatedHpRef.current = nextPercent;
      setHpBarTransitionMs(0);
      setDisplayedHpPercent(nextPercent);
      previousHpIdentityRef.current = { critterId: critterForRender.critterId, maxHp: critterForRender.maxHp };
      return;
    }

    const deltaPercent = Math.abs(nextPercent - previousAnimatedHpRef.current);
    previousAnimatedHpRef.current = nextPercent;
    setHpBarTransitionMs(calcBattleHpAnimationMs(deltaPercent));
    setDisplayedHpPercent(nextPercent);
    previousHpIdentityRef.current = { critterId: critterForRender.critterId, maxHp: critterForRender.maxHp };
  }, [critterForRender?.critterId, critterForRender?.currentHp, critterForRender?.maxHp]);

  return (
    <article className={`battle-critter battle-critter--${position}`}>
      <p className="battle-critter__title">{title}</p>
      <div className="battle-critter__slot-dots" aria-label={`${title} squad status`}>
        {battleDotStates.map((state, index) => (
          <span key={`battle-dot-${position}-${index}`} className={`battle-critter__slot-dot is-${state}`} />
        ))}
      </div>
      {critterForRender && (
        <span className="battle-critter__element-logo-wrap" title={`${capitalizeToken(critterForRender.element)} element`}>
          {elementLogoUrl ? (
            <img
              src={elementLogoUrl}
              alt={`${critterForRender.element} element`}
              className="battle-critter__element-logo"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="battle-critter__element-logo battle-critter__element-logo--fallback">{elementToken}</span>
          )}
        </span>
      )}
      {effectIcons.length > 0 && (
        <div className="battle-critter__effect-bubbles" aria-label="Active effects">
          {effectIcons.map((url, i) => (
            <span key={`${url}-${i}`} className="battle-critter__effect-bubble" title={effectDescriptions[i]?.trim() || undefined}>
              <img src={url} alt="" className="battle-critter__effect-icon" loading="lazy" decoding="async" />
            </span>
          ))}
        </div>
      )}
      {critterForRender ? (
        <>
          <div className="battle-critter__head">
            <h3>{critterForRender.name}</h3>
            <span>Lv.{critterForRender.level}</span>
          </div>
          {critterForRender.spriteUrl ? (
            <img
              src={critterForRender.spriteUrl}
              alt={critterForRender.name}
              className={spriteClasses}
              style={attackStyle}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className={missingSpriteClasses}>
              No Sprite
            </div>
          )}
          <div className="battle-critter__hp">
            <span className="battle-critter__hp-bar">
              <span className="battle-critter__hp-fill" style={hpFillStyle} />
            </span>
            <span className="battle-critter__hp-label">
              HP {Math.max(0, critterForRender.currentHp)}/{Math.max(1, critterForRender.maxHp)}
            </span>
          </div>
          <div className="battle-critter__stats">
            <span>ATK {critterForRender.attack}</span>
            <span>DEF {critterForRender.defense}</span>
            <span>SPD {critterForRender.speed}</span>
          </div>
        </>
      ) : (
        <p className="battle-critter__empty">{emptyText}</p>
      )}
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

function buildBattleDotStates(teamEntries: BattleTeamEntry[], preferSlotIndex: boolean): Array<'alive' | 'fainted' | 'empty'> {
  const dots: Array<'alive' | 'fainted' | 'empty'> = Array.from({ length: 8 }, () => 'empty');
  const fallbackOrder: number[] = [];
  for (let index = 0; index < dots.length; index += 1) {
    fallbackOrder.push(index);
  }

  for (const entry of teamEntries) {
    let targetIndex = -1;
    if (
      preferSlotIndex &&
      typeof entry.slotIndex === 'number' &&
      entry.slotIndex >= 0 &&
      entry.slotIndex < dots.length &&
      dots[entry.slotIndex] === 'empty'
    ) {
      targetIndex = entry.slotIndex;
    } else {
      targetIndex = fallbackOrder.find((index) => dots[index] === 'empty') ?? -1;
    }
    if (targetIndex < 0) {
      continue;
    }
    dots[targetIndex] = entry.fainted || entry.currentHp <= 0 ? 'fainted' : 'alive';
  }
  return dots;
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
