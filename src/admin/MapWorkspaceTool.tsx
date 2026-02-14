import { useState } from 'react';
import { MapEditorTool } from '@/admin/MapEditorTool';

interface MapEditorWindow {
  id: string;
  name: string;
}

function createWindow(index: number): MapEditorWindow {
  return {
    id: `map-window-${Date.now()}-${index}`,
    name: `Map Window ${index + 1}`,
  };
}

export function MapWorkspaceTool() {
  const [windows, setWindows] = useState<MapEditorWindow[]>([createWindow(0)]);

  const addWindow = () => {
    setWindows((current) => [...current, createWindow(current.length)]);
  };

  const removeWindow = (windowId: string) => {
    setWindows((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((window) => window.id !== windowId);
    });
  };

  const renameWindow = (windowId: string, name: string) => {
    setWindows((current) =>
      current.map((window) =>
        window.id === windowId
          ? {
              ...window,
              name,
            }
          : window,
      ),
    );
  };

  return (
    <section className="admin-tool">
      <header className="admin-tool__header">
        <div>
          <h2>Map Workspace</h2>
          <p>
            Open multiple map editor windows and work on different maps side-by-side. Each window keeps its own active
            map selection and editing state.
          </p>
        </div>
        <div className="admin-tool__status">
          <button type="button" className="primary" onClick={addWindow}>
            Add Map Window
          </button>
        </div>
      </header>

      <div className="admin-map-workspace">
        {windows.map((window, index) => (
          <article key={window.id} className="admin-map-window">
            <header className="admin-map-window__header">
              <label>
                Window Name
                <input
                  value={window.name}
                  onChange={(event) => renameWindow(window.id, event.target.value)}
                  placeholder={`Map Window ${index + 1}`}
                />
              </label>
              <button
                type="button"
                className="secondary"
                disabled={windows.length <= 1}
                onClick={() => removeWindow(window.id)}
              >
                Close Window
              </button>
            </header>
            <MapEditorTool section="map" embedded />
          </article>
        ))}
      </div>
    </section>
  );
}
