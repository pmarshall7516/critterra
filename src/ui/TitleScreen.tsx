import { useState } from 'react';
import { GAME_TITLE } from '@/shared/constants';

interface TitleScreenProps {
  userEmail: string;
  hasSave: boolean;
  onLogout: () => void;
  onContinue: () => void;
  onNewGame: () => void;
  onStartOver: (password: string) => Promise<void>;
}

export function TitleScreen({ userEmail, hasSave, onLogout, onContinue, onNewGame, onStartOver }: TitleScreenProps) {
  const [showControls, setShowControls] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetSubmit = async () => {
    if (!resetPassword.trim()) {
      setResetError('Password is required to start over.');
      return;
    }

    setIsResetting(true);
    setResetError(null);
    try {
      await onStartOver(resetPassword);
      setResetPassword('');
      setShowResetModal(false);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Unable to reset save.');
    } finally {
      setIsResetting(false);
    }
  };

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
        <p className="admin-note">Signed in as {userEmail}</p>
        <div className="title-screen__actions">
          {hasSave && (
            <button type="button" className="primary" onClick={onContinue}>
              Continue
            </button>
          )}
          {!hasSave && (
            <button type="button" className="secondary" onClick={onNewGame}>
              Start Game
            </button>
          )}
          {hasSave && (
            <button type="button" className="secondary" onClick={() => setShowResetModal(true)}>
              Start Over
            </button>
          )}
          <button type="button" className="secondary" onClick={() => window.location.assign('/admin/maps')}>
            Admin Tools
          </button>
          <button type="button" className="secondary" onClick={onLogout}>
            Log Out
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

      {showResetModal && (
        <div className="controls-modal__backdrop" onClick={() => setShowResetModal(false)}>
          <div className="controls-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Start Over</h2>
            <p>Enter your password to clear your existing save and start fresh.</p>
            <label htmlFor="reset-password-input">Password</label>
            <input
              id="reset-password-input"
              type="password"
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
              autoComplete="current-password"
            />
            {resetError && <p className="admin-note" style={{ color: '#f7b9b9' }}>{resetError}</p>}
            <div className="title-screen__actions">
              <button type="button" className="primary" onClick={handleResetSubmit} disabled={isResetting}>
                {isResetting ? 'Resetting...' : 'Confirm Start Over'}
              </button>
              <button type="button" className="secondary" onClick={() => setShowResetModal(false)} disabled={isResetting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
