import { useEffect, useMemo, useState } from 'react';
import { GameView } from '@/game/engine/GameView';
import { clearSave, loadSave, resetRemoteSaveWithPassword, hydrateLocalSaveFromServer } from '@/game/saves/saveManager';
import { AuthScreen } from '@/ui/AuthScreen';
import { NewGameSetup } from '@/ui/NewGameSetup';
import { TitleScreen } from '@/ui/TitleScreen';
import { apiFetchJson } from '@/shared/apiClient';
import { clearAuthToken, type AuthSession, type AuthUser, getAuthToken } from '@/shared/authStorage';
import { clearStoredWorldContent, hydrateWorldContentFromServer } from '@/game/content/worldContentStore';

type ScreenState =
  | {
      screen: 'auth';
      sessionId: number;
    }
  | {
      screen: 'title';
      sessionId: number;
    }
  | {
      screen: 'new-game';
      sessionId: number;
    }
  | {
      screen: 'game';
      mode: 'new' | 'continue';
      playerName?: string;
      sessionId: number;
    };

interface SessionResponse {
  ok: boolean;
  session?: AuthSession;
  error?: string;
}

function App() {
  const [state, setState] = useState<ScreenState>({ screen: 'auth', sessionId: 0 });
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const hasSave = useMemo(() => loadSave() !== null, [state.sessionId]);

  const bootstrapAuthenticatedState = async (user: AuthUser) => {
    await Promise.all([
      hydrateLocalSaveFromServer().catch(() => null),
      hydrateWorldContentFromServer().catch(() => undefined),
    ]);
    setAuthUser(user);
    setState((current) => ({
      screen: 'title',
      sessionId: current.sessionId + 1,
    }));
  };

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const token = getAuthToken();
      if (!token) {
        clearSave();
        clearStoredWorldContent();
        if (mounted) {
          setState({ screen: 'auth', sessionId: 0 });
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        const sessionResult = await apiFetchJson<SessionResponse>('/api/auth/session');
        if (!sessionResult.ok || !sessionResult.data?.session?.user) {
          clearAuthToken();
          clearStoredWorldContent();
          if (mounted) {
            setState({ screen: 'auth', sessionId: 0 });
            setIsBootstrapping(false);
          }
          return;
        }

        await bootstrapAuthenticatedState(sessionResult.data.session.user);
      } catch {
        clearAuthToken();
        clearStoredWorldContent();
        if (mounted) {
          setState({ screen: 'auth', sessionId: 0 });
        }
      } finally {
        if (mounted) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  if (isBootstrapping) {
    return (
      <section className="title-screen">
        <div className="title-screen__card">
          <h1>Loading...</h1>
          <p className="title-screen__subtitle">Connecting to your account and game data.</p>
        </div>
      </section>
    );
  }

  if (state.screen === 'auth') {
    return (
      <AuthScreen
        onAuthenticated={async (session) => {
          try {
            await bootstrapAuthenticatedState(session.user);
          } catch {
            clearAuthToken();
            clearStoredWorldContent();
            setAuthUser(null);
            setState((current) => ({
              screen: 'auth',
              sessionId: current.sessionId + 1,
            }));
          }
        }}
      />
    );
  }

  if (state.screen === 'title') {
    return (
      <TitleScreen
        userEmail={authUser?.email ?? 'unknown'}
        hasSave={hasSave}
        onLogout={() => {
          void apiFetchJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
          clearAuthToken();
          clearSave();
          clearStoredWorldContent();
          setAuthUser(null);
          setState((current) => ({
            screen: 'auth',
            sessionId: current.sessionId + 1,
          }));
        }}
        onContinue={async () => {
          await hydrateWorldContentFromServer().catch(() => undefined);
          setState({ screen: 'game', mode: 'continue', sessionId: state.sessionId + 1 });
        }}
        onNewGame={async () => {
          await hydrateWorldContentFromServer().catch(() => undefined);
          setState({ screen: 'new-game', sessionId: state.sessionId + 1 });
        }}
        onStartOver={async (password) => {
          await resetRemoteSaveWithPassword(password);
          clearSave();
          await hydrateWorldContentFromServer().catch(() => undefined);
          setState((current) => ({
            screen: 'new-game',
            sessionId: current.sessionId + 1,
          }));
        }}
      />
    );
  }

  if (state.screen === 'new-game') {
    return (
      <NewGameSetup
        onStart={(playerName) =>
          setState({
            screen: 'game',
            mode: 'new',
            playerName,
            sessionId: state.sessionId + 1,
          })
        }
        onCancel={() => setState({ screen: 'title', sessionId: state.sessionId + 1 })}
      />
    );
  }

  return (
    <GameView
      key={`game-${state.sessionId}`}
      mode={state.mode}
      playerName={state.playerName}
      onReturnToTitle={() =>
        setState((current) => ({
          screen: 'title',
          sessionId: current.sessionId + 1,
        }))
      }
    />
  );
}

export default App;
