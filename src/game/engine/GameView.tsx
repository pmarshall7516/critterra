import { useEffect, useRef, useState } from 'react';
import { GameRuntime, RuntimeSnapshot } from '@/game/engine/runtime';

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
  width: 1280,
  height: 720,
};

const FIXED_STEP_MS = 1000 / 60;

export function GameView({ mode, playerName, onReturnToTitle }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const menuOpenRef = useRef(false);
  const renderSizeRef = useRef<ViewportSize>(DEFAULT_VIEWPORT);
  const manualStepUntilRef = useRef(0);

  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
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
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(320, Math.floor(rect.height));

      canvas.width = width;
      canvas.height = height;
      renderSizeRef.current = { width, height };
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

  return (
    <section className="game-screen">
      <header className="game-screen__hud">
        <div>
          <strong>{snapshot?.playerName ?? 'Player'}</strong>
          <span className="hud-pill">{snapshot?.mapName ?? 'Loading...'}</span>
        </div>
        <div>
          <span className="hud-pill">{snapshot?.saveStatus ?? 'Saved'}</span>
          {snapshot?.lastSavedAt && (
            <span className="hud-pill">{new Date(snapshot.lastSavedAt).toLocaleTimeString()}</span>
          )}
        </div>
      </header>

      {snapshot?.objective && <div className="objective-banner">Objective: {snapshot.objective}</div>}

      <div className="game-screen__viewport" ref={viewportRef}>
        <canvas ref={canvasRef} />

        {snapshot?.dialogue && (
          <div className="dialogue-box">
            <p className="dialogue-box__speaker">{snapshot.dialogue.speaker}</p>
            <p>{snapshot.dialogue.text}</p>
            <p className="dialogue-box__meta">
              Line {snapshot.dialogue.lineIndex}/{snapshot.dialogue.totalLines}
            </p>
          </div>
        )}

        {menuOpen && <div className="side-menu__backdrop" onClick={() => setMenuOpen(false)} />}

        <aside className={`side-menu ${menuOpen ? 'is-open' : ''}`}>
          <h2>Menu</h2>
          <button type="button" className="primary" onClick={handleManualSave}>
            Save
          </button>
          <button type="button" className="secondary" onClick={() => setMenuOpen(false)}>
            Resume
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setMenuOpen(false);
              onReturnToTitle();
            }}
          >
            Back To Title
          </button>
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
