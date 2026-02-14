import { useEffect, useMemo, useState } from 'react';
import { MapEditorTool } from '@/admin/MapEditorTool';
import { MapWorkspaceTool } from '@/admin/MapWorkspaceTool';
import { PlayerSpriteTool } from '@/admin/PlayerSpriteTool';
import { apiFetchJson } from '@/shared/apiClient';

type AdminRoute = 'maps' | 'tiles' | 'npcs' | 'player-sprite' | 'critters' | 'encounters';

interface AdminViewProps {
  gameHref?: string;
}

interface AdminNavLink {
  id: AdminRoute;
  label: string;
  type: 'active' | 'placeholder';
}

const ACTIVE_NAV_LINKS: AdminNavLink[] = [
  { id: 'maps', label: 'Maps', type: 'active' },
  { id: 'tiles', label: 'Tiles', type: 'active' },
  { id: 'npcs', label: 'NPCs', type: 'active' },
  { id: 'player-sprite', label: 'Player Sprite', type: 'active' },
];

const PLACEHOLDER_NAV_LINKS: AdminNavLink[] = [
  { id: 'critters', label: 'Critters (Soon)', type: 'placeholder' },
  { id: 'encounters', label: 'Encounters (Soon)', type: 'placeholder' },
];

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
    route === 'player-sprite' ||
    route === 'critters' ||
    route === 'encounters'
  ) {
    return route;
  }

  return 'maps';
}

export function AdminView({ gameHref = '/' }: AdminViewProps) {
  const [activeRoute, setActiveRoute] = useState<AdminRoute>(() => parseAdminRoute(window.location.pathname));
  const [authState, setAuthState] = useState<'checking' | 'ok' | 'blocked'>('checking');

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
        const result = await apiFetchJson<{ ok: boolean }>('/api/auth/session');
        if (!mounted) {
          return;
        }
        setAuthState(result.ok ? 'ok' : 'blocked');
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
    if (activeRoute === 'npcs') {
      return 'NPC Studio';
    }
    if (activeRoute === 'player-sprite') {
      return 'Player Sprite';
    }
    if (activeRoute === 'critters') {
      return 'Critter Editor';
    }
    return 'Encounter Tables';
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
          <h2>Sign In Required</h2>
          <p>Open the game home screen, sign in, then reopen Admin Tools.</p>
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
          {activeRoute === 'npcs' && <MapEditorTool section="npcs" />}
          {activeRoute === 'player-sprite' && <PlayerSpriteTool />}
          {activeRoute === 'critters' && (
            <section className="admin-placeholder">
              <h2>Critter Editor</h2>
              <p>This module will hold creature stats, move sets, evolutions, and sprite assignments.</p>
            </section>
          )}
          {activeRoute === 'encounters' && (
            <section className="admin-placeholder">
              <h2>Encounter Tables</h2>
              <p>This module will manage route spawn tables, level bands, and encounter conditions.</p>
            </section>
          )}
        </main>
      </div>
    </section>
  );
}
