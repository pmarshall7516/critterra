import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MapEditorTool } from '@/admin/MapEditorTool';
import { MapWorkspaceTool } from '@/admin/MapWorkspaceTool';
import { PlayerSpriteTool } from '@/admin/PlayerSpriteTool';
import { CritterTool } from '@/admin/CritterTool';
import { EncounterTool } from '@/admin/EncounterTool';
import { MoveTool } from '@/admin/MoveTool';
import { SkillEffectsTool } from '@/admin/SkillEffectsTool';
import { ElementChartTool } from '@/admin/ElementChartTool';
import { FlagsTool } from '@/admin/FlagsTool';
import { apiFetchJson } from '@/shared/apiClient';
import { setAuthToken } from '@/shared/authStorage';

type AdminRoute =
  | 'maps'
  | 'tiles'
  | 'npcs'
  | 'npc-sprites'
  | 'npc-characters'
  | 'player-sprite'
  | 'critters'
  | 'encounters'
  | 'flags'
  | 'moves'
  | 'skill-effects'
  | 'element-chart';

interface AdminViewProps {
  gameHref?: string;
}

interface AdminNavLink {
  id: AdminRoute;
  label: string;
  type: 'active' | 'placeholder';
}

interface AdminSessionResponse {
  ok: boolean;
  session?: {
    token: string;
    user: {
      isAdmin?: boolean;
    };
  };
  error?: string;
}

const ACTIVE_NAV_LINKS: AdminNavLink[] = [
  { id: 'maps', label: 'Maps', type: 'active' },
  { id: 'tiles', label: 'Tiles', type: 'active' },
  { id: 'npc-sprites', label: 'NPC Sprites', type: 'active' },
  { id: 'npc-characters', label: 'NPC Characters', type: 'active' },
  { id: 'npcs', label: 'NPC Studio', type: 'active' },
  { id: 'player-sprite', label: 'Player Sprite', type: 'active' },
  { id: 'critters', label: 'Critters', type: 'active' },
  { id: 'encounters', label: 'Encounters', type: 'active' },
  { id: 'moves', label: 'Skills', type: 'active' },
  { id: 'skill-effects', label: 'Skill Effects', type: 'active' },
  { id: 'element-chart', label: 'Element Chart', type: 'active' },
  { id: 'flags', label: 'Flags', type: 'active' },
];

const PLACEHOLDER_NAV_LINKS: AdminNavLink[] = [];

function toAdminPath(route: AdminRoute): string {
  return `/admin/${route}`;
}

function parseAdminRoute(pathname: string): AdminRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (normalized === '/admin' || normalized === '/admin.html' || normalized === '/') {
    return 'maps';
  }

  const match = normalized.match(/^\/admin\/([a-z-]+)$/);
  if (!match) {
    return 'maps';
  }

  const route = match[1] as AdminRoute;
  if (
    route === 'maps' ||
    route === 'tiles' ||
    route === 'npcs' ||
    route === 'npc-sprites' ||
    route === 'npc-characters' ||
    route === 'player-sprite' ||
    route === 'critters' ||
    route === 'encounters' ||
    route === 'flags' ||
    route === 'moves' ||
    route === 'skill-effects' ||
    route === 'element-chart'
  ) {
    return route;
  }

  return 'maps';
}

export function AdminView({ gameHref = '/' }: AdminViewProps) {
  const [activeRoute, setActiveRoute] = useState<AdminRoute>(() => parseAdminRoute(window.location.pathname));
  const [authState, setAuthState] = useState<'checking' | 'ok' | 'blocked'>('checking');
  const [email, setEmail] = useState('playwrite@crittera.com');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const onPopState = () => {
      setActiveRoute(parseAdminRoute(window.location.pathname));
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const verifySession = async () => {
      try {
        const result = await apiFetchJson<AdminSessionResponse>('/api/auth/session');
        if (!mounted) {
          return;
        }
        const isAdmin = Boolean(result.data?.session?.user?.isAdmin);
        setAuthState(result.ok && isAdmin ? 'ok' : 'blocked');
      } catch {
        if (!mounted) {
          return;
        }
        setAuthState('blocked');
      }
    };
    void verifySession();
    return () => {
      mounted = false;
    };
  }, []);

  const onSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setStatusMessage('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const result = await apiFetchJson<AdminSessionResponse>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });
      if (!result.ok || !result.data?.session) {
        setStatusMessage(result.error ?? 'Unable to sign in.');
        return;
      }

      setAuthToken(result.data.session.token);
      const isAdmin = Boolean(result.data.session.user?.isAdmin);
      setAuthState(isAdmin ? 'ok' : 'blocked');
      setStatusMessage(isAdmin ? 'Signed in. Loading admin tools...' : 'Signed in, but this account is not admin.');
    } catch {
      setStatusMessage('Unable to sign in right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const canonicalPath = toAdminPath(activeRoute);
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({}, '', canonicalPath);
    }
  }, [activeRoute]);

  const activeTitle = useMemo(() => {
    if (activeRoute === 'maps') {
      return 'Map Workspace';
    }
    if (activeRoute === 'tiles') {
      return 'Tile Library';
    }
    if (activeRoute === 'npc-sprites') {
      return 'NPC Sprite Studio';
    }
    if (activeRoute === 'npc-characters') {
      return 'NPC Character Studio';
    }
    if (activeRoute === 'npcs') {
      return 'NPC Studio';
    }
    if (activeRoute === 'player-sprite') {
      return 'Player Sprite';
    }
    if (activeRoute === 'critters') {
      return 'Critter Editor';
    }
    if (activeRoute === 'encounters') {
      return 'Encounter Tables';
    }
    if (activeRoute === 'moves') {
      return 'Skills';
    }
    if (activeRoute === 'skill-effects') {
      return 'Skill Effects';
    }
    if (activeRoute === 'element-chart') {
      return 'Element Chart';
    }
    return 'Flag Catalog';
  }, [activeRoute]);

  const navigateTo = (route: AdminRoute) => {
    const path = toAdminPath(route);
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setActiveRoute(route);
  };

  if (authState === 'checking') {
    return (
      <section className="admin-screen">
        <section className="admin-placeholder">
          <h2>Checking Session</h2>
          <p>Validating your account before loading admin tools.</p>
        </section>
      </section>
    );
  }

  if (authState === 'blocked') {
    return (
      <section className="admin-screen">
        <section className="admin-placeholder">
          <h2>Admin Access Required</h2>
          <p>Sign in with an account where `is_admin` is true, then reopen Admin Tools.</p>
          <form className="admin-inline-auth" onSubmit={onSignIn}>
            <label htmlFor="adminEmail">Email</label>
            <input
              id="adminEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
            <label htmlFor="adminPassword">Password</label>
            <input
              id="adminPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="submit" className="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
            {statusMessage ? <p className="admin-inline-auth__status">{statusMessage}</p> : null}
          </form>
          <a className="admin-screen__back" href={gameHref}>
            Back To Game
          </a>
        </section>
      </section>
    );
  }

  return (
    <section className="admin-screen">
      <header className="admin-screen__header">
        <div>
          <p className="admin-screen__kicker">Admin Tools</p>
          <h1>Critterra Builder</h1>
          <p>{activeTitle}</p>
        </div>
        <a className="admin-screen__back" href={gameHref}>
          Back To Game
        </a>
      </header>

      <div className="admin-shell">
        <aside className="admin-shell__nav">
          {ACTIVE_NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className={`secondary ${activeRoute === link.id ? 'is-selected' : ''}`}
              onClick={() => navigateTo(link.id)}
            >
              {link.label}
            </button>
          ))}
          <div className="admin-shell__nav-spacer" />
          {PLACEHOLDER_NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className={`secondary ${activeRoute === link.id ? 'is-selected' : ''}`}
              onClick={() => navigateTo(link.id)}
            >
              {link.label}
            </button>
          ))}
        </aside>

        <main className="admin-shell__content">
          {activeRoute === 'maps' && <MapWorkspaceTool />}
          {activeRoute === 'tiles' && <MapEditorTool section="tiles" />}
          {activeRoute === 'npc-sprites' && <MapEditorTool section="npc-sprites" />}
          {activeRoute === 'npc-characters' && <MapEditorTool section="npc-characters" />}
          {activeRoute === 'npcs' && <MapEditorTool section="npcs" />}
          {activeRoute === 'player-sprite' && <PlayerSpriteTool />}
          {activeRoute === 'critters' && <CritterTool />}
          {activeRoute === 'encounters' && <EncounterTool />}
          {activeRoute === 'moves' && <MoveTool />}
          {activeRoute === 'skill-effects' && <SkillEffectsTool />}
          {activeRoute === 'element-chart' && <ElementChartTool />}
          {activeRoute === 'flags' && <FlagsTool />}
        </main>
      </div>
    </section>
  );
}
