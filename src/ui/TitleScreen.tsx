import { useState } from 'react';
import { GAME_TITLE } from '@/shared/constants';

interface TitleScreenProps {
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: () => void;
}

export function TitleScreen({ hasSave, onContinue, onNewGame }: TitleScreenProps) {
  const [showControls, setShowControls] = useState(false);

  return (
    <section className="title-screen">
      <button type="button" className="controls-icon" onClick={() => setShowControls(true)}>
        ? Controls
      </button>

      <div className="title-screen__card">
        <p className="title-screen__tag">2.5D Creature Capture RPG</p>
        <h1>{GAME_TITLE}</h1>
        <p className="title-screen__subtitle">
          Build your region, capture your crew, and explore town by town.
        </p>
        <div className="title-screen__actions">
          {hasSave && (
            <button type="button" className="primary" onClick={onContinue}>
              Continue
            </button>
          )}
          <button type="button" className="secondary" onClick={onNewGame}>
            {hasSave ? 'New Game' : 'Start Game'}
          </button>
          <button type="button" className="secondary" onClick={() => window.location.assign('/admin.html')}>
            Admin Tools
          </button>
        </div>
      </div>

      {showControls && (
        <div className="controls-modal__backdrop" onClick={() => setShowControls(false)}>
          <div className="controls-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Controls</h2>
            <p>
              <strong>Move:</strong> Arrow Keys / WASD
            </p>
            <p>
              <strong>Interact:</strong> Space
            </p>
            <p>
              <strong>Menu:</strong> Esc
            </p>
            <p>
              <strong>Fullscreen:</strong> F (Esc exits)
            </p>
            <button type="button" className="secondary" onClick={() => setShowControls(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
