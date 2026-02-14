import { FormEvent, useState } from 'react';
import { apiFetchJson } from '@/shared/apiClient';
import { type AuthSession, setAuthToken } from '@/shared/authStorage';

interface AuthScreenProps {
  onAuthenticated: (session: AuthSession) => Promise<void> | void;
}

interface AuthResponse {
  ok: boolean;
  error?: string;
  session?: AuthSession;
}

type AuthMode = 'login' | 'signup';

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email and password are required.');
      setStatusMessage(null);
      return;
    }

    if (mode === 'signup' && !displayName.trim()) {
      setErrorMessage('Display name is required for sign up.');
      setStatusMessage(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await apiFetchJson<AuthResponse>(`/api/auth/${mode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        }),
      });

      if (!result.ok || !result.data?.session) {
        setErrorMessage(result.error ?? result.data?.error ?? 'Authentication failed.');
        setStatusMessage(null);
        return;
      }

      setAuthToken(result.data.session.token);
      await onAuthenticated(result.data.session);
      setStatusMessage(mode === 'signup' ? 'Account created.' : 'Signed in.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed.';
      setErrorMessage(message);
      setStatusMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="title-screen">
      <div className="title-screen__card">
        <p className="title-screen__tag">Account</p>
        <h1>{mode === 'signup' ? 'Create Account' : 'Sign In'}</h1>
        <p className="title-screen__subtitle">
          Sign in to load your save and your database content (maps, tiles, NPCs, and sprites).
        </p>

        <div className="title-screen__actions">
          <button
            type="button"
            className={`secondary ${mode === 'login' ? 'is-selected' : ''}`}
            onClick={() => setMode('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`secondary ${mode === 'signup' ? 'is-selected' : ''}`}
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
        </div>

        <form className="new-game-form" onSubmit={handleSubmit}>
          <label htmlFor="authEmail">Email</label>
          <input
            id="authEmail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          {mode === 'signup' && (
            <>
              <label htmlFor="authDisplayName">Display Name</label>
              <input
                id="authDisplayName"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={30}
                required
              />
            </>
          )}

          <label htmlFor="authPassword">Password</label>
          <input
            id="authPassword"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
          />

          {statusMessage && <p className="admin-note">{statusMessage}</p>}
          {errorMessage && <p className="admin-note" style={{ color: '#f7b9b9' }}>{errorMessage}</p>}

          <div className="title-screen__actions">
            <button type="submit" className="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Working...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
