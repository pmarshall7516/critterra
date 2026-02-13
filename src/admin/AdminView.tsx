import { useState } from 'react';
import { MapEditorTool } from '@/admin/MapEditorTool';
import { PlayerSpriteTool } from '@/admin/PlayerSpriteTool';

type AdminModule = 'map-editor' | 'player-sprite' | 'critters' | 'encounters';

interface AdminViewProps {
  gameHref?: string;
}

export function AdminView({ gameHref = '/' }: AdminViewProps) {
  const [activeModule, setActiveModule] = useState<AdminModule>('map-editor');

  return (
    <section className="admin-screen">
      <header className="admin-screen__header">
        <div>
          <p className="admin-screen__kicker">Admin Tools</p>
          <h1>Critterra Builder</h1>
          <p>Map tools now, creature/content tools later.</p>
        </div>
        <a className="admin-screen__back" href={gameHref}>
          Back To Game
        </a>
      </header>

      <div className="admin-shell">
        <aside className="admin-shell__nav">
          <button
            type="button"
            className={`secondary ${activeModule === 'map-editor' ? 'is-selected' : ''}`}
            onClick={() => setActiveModule('map-editor')}
          >
            Map Editor
          </button>
          <button
            type="button"
            className={`secondary ${activeModule === 'player-sprite' ? 'is-selected' : ''}`}
            onClick={() => setActiveModule('player-sprite')}
          >
            Player Sprite
          </button>
          <button
            type="button"
            className={`secondary ${activeModule === 'critters' ? 'is-selected' : ''}`}
            onClick={() => setActiveModule('critters')}
          >
            Critters (Soon)
          </button>
          <button
            type="button"
            className={`secondary ${activeModule === 'encounters' ? 'is-selected' : ''}`}
            onClick={() => setActiveModule('encounters')}
          >
            Encounters (Soon)
          </button>
        </aside>

        <main className="admin-shell__content">
          {activeModule === 'map-editor' && <MapEditorTool />}
          {activeModule === 'player-sprite' && <PlayerSpriteTool />}
          {activeModule === 'critters' && (
            <section className="admin-placeholder">
              <h2>Critter Editor</h2>
              <p>This module will hold creature stats, move sets, evolutions, and sprite assignments.</p>
            </section>
          )}
          {activeModule === 'encounters' && (
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
