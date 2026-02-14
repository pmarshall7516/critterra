import { useEffect, useRef, useState } from 'react';
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
const TOTAL_SQUAD_SLOTS = 8;
const STARTING_UNLOCKED_SQUAD_SLOTS = 2;

type SideMenuView = 'root' | 'squad';

export function GameView({ mode, playerName, onReturnToTitle }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const menuOpenRef = useRef(false);
  const renderSizeRef = useRef<ViewportSize>(DEFAULT_VIEWPORT);
  const manualStepUntilRef = useRef(0);

  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<SideMenuView>('root');

  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      setMenuView('root');
    }
  }, [menuOpen]);

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
      if (menuOpenRef.current) {
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

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const squadSlots = Array.from({ length: TOTAL_SQUAD_SLOTS }, (_, index) => ({
    id: index,
    unlocked: index < STARTING_UNLOCKED_SQUAD_SLOTS,
  }));

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

        {menuOpen && <div className="side-menu__backdrop" onClick={closeMenu} />}

        <aside className={`side-menu ${menuOpen ? 'is-open' : ''}`}>
          {menuView === 'root' ? (
            <>
              <h2>Menu</h2>
              <div className="side-menu__section">
                <button type="button" className="secondary" disabled>
                  Collection (Soon)
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
          ) : (
            <>
              <h2>Squad</h2>
              <p className="side-menu__meta">2/8 slots unlocked. More slots unlock later.</p>
              <div className="squad-grid">
                {squadSlots.map((slot) => (
                  <div key={`squad-slot-${slot.id}`} className={`squad-slot ${slot.unlocked ? 'is-unlocked' : 'is-locked'}`}>
                    {slot.unlocked ? 'Empty' : 'Locked'}
                  </div>
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

async function toggleFullscreen(viewport: HTMLElement): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  await viewport.requestFullscreen();
}
