import { useEffect, useMemo, useState } from 'react';
import { CRITTER_ELEMENTS } from '@/game/critters/types';
import { sanitizeElementChartWithElements } from '@/game/skills/schema';
import { apiFetchJson } from '@/shared/apiClient';

interface ElementChartResponse {
  ok: boolean;
  elementChart?: unknown;
  error?: string;
}

interface AdminElementRow {
  element_id: string;
  display_name: string;
  color_hex: string;
  icon_bucket: string;
  icon_path: string;
  sort_index: number;
}

interface ElementsListResponse {
  ok: boolean;
  elements?: unknown;
  error?: string;
}

interface ElementsSaveResponse {
  ok: boolean;
  elements?: unknown;
  error?: string;
}

interface SupabaseIconListItem {
  name: string;
  path: string;
  publicUrl: string;
  updatedAt: string | null;
}

interface LoadSupabaseIconsResponse {
  ok: boolean;
  bucket?: string;
  prefix?: string;
  spritesheets?: SupabaseIconListItem[];
  error?: string;
}

interface AdminElementChartEntry {
  attacker: string;
  defender: string;
  multiplier: number;
}

type AdminElementChart = AdminElementChartEntry[];

function sanitizeAdminElements(raw: unknown): AdminElementRow[] {
  if (!Array.isArray(raw)) return [];
  const parsed: AdminElementRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.element_id === 'string' ? record.element_id.trim().toLowerCase() : '';
    if (!id || seen.has(id)) continue;
    parsed.push({
      element_id: id,
      display_name: typeof record.display_name === 'string' ? record.display_name : id,
      color_hex: typeof record.color_hex === 'string' ? record.color_hex : '',
      icon_bucket: typeof record.icon_bucket === 'string' ? record.icon_bucket : 'icons',
      icon_path: typeof record.icon_path === 'string' ? record.icon_path : `${id}-element.png`,
      sort_index: typeof record.sort_index === 'number' ? record.sort_index : i,
    });
    seen.add(id);
  }
  return parsed.sort((a, b) => a.sort_index - b.sort_index || a.element_id.localeCompare(b.element_id));
}

function getMultiplier(chart: AdminElementChart, attacker: string, defender: string): number {
  const e = chart.find((x) => x.attacker === attacker && x.defender === defender);
  return e?.multiplier ?? 1;
}

function setMultiplier(
  chart: AdminElementChart,
  attacker: string,
  defender: string,
  value: number,
): AdminElementChart {
  const next = chart.filter((e) => !(e.attacker === attacker && e.defender === defender));
  next.push({ attacker, defender, multiplier: value });
  return next;
}

export function ElementChartTool() {
  const [elements, setElements] = useState<AdminElementRow[]>([]);
  const elementIds = useMemo(() => elements.map((e) => e.element_id), [elements]);
  const [chart, setChart] = useState<AdminElementChart>(() => []);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingElements, setIsSavingElements] = useState(false);
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
  const [elementSearchInput, setElementSearchInput] = useState('');
  const [iconsBucketRoot, setIconsBucketRoot] = useState<string | null>(null);
  const [iconEntries, setIconEntries] = useState<SupabaseIconListItem[]>([]);
  const [isLoadingIcons, setIsLoadingIcons] = useState(false);
  const selectedElement = selectedElementIndex != null ? elements[selectedElementIndex] ?? null : null;
  const selectedElementId = selectedElement?.element_id ?? '';
  const selectedElementIconMatches = useMemo(() => {
    const id = selectedElementId.trim().toLowerCase();
    if (!id) return [];
    const expected = `${id}-element.png`;
    return iconEntries.filter((entry) => entry.name === expected || entry.path.endsWith(`/${expected}`) || entry.path.endsWith(expected));
  }, [iconEntries, selectedElementId]);

  const resolveIconPublicUrl = (iconPath: string): string | null => {
    const trimmed = iconPath.trim();
    if (!trimmed) return null;
    const direct = iconEntries.find((e) => e.path === trimmed || e.name === trimmed)?.publicUrl;
    if (direct) return direct;
    if (!iconsBucketRoot) return null;
    return `${iconsBucketRoot}/${trimmed.split('/').map(encodeURIComponent).join('/')}`;
  };

  const filteredElements = useMemo(() => {
    const query = elementSearchInput.trim().toLowerCase();
    const sorted = [...elements].sort((a, b) => a.sort_index - b.sort_index || a.element_id.localeCompare(b.element_id));
    if (!query) {
      return sorted;
    }
    return sorted.filter((e) => {
      const id = e.element_id.toLowerCase();
      const name = (e.display_name ?? '').toLowerCase();
      return id.includes(query) || name.includes(query);
    });
  }, [elements, elementSearchInput]);

  const loadAll = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const elementsResult = await apiFetchJson<ElementsListResponse>('/api/admin/elements/list');
      if (!elementsResult.ok) {
        if (elementsResult.status === 401) {
          setElements(
            CRITTER_ELEMENTS.map((id, i) => ({
              element_id: id,
              display_name: id,
              color_hex: '',
              icon_bucket: 'icons',
              icon_path: `${id}-element.png`,
              sort_index: i,
            })),
          );
          setChart(
            CRITTER_ELEMENTS.flatMap((a) =>
              CRITTER_ELEMENTS.map((d) => ({ attacker: a, defender: d, multiplier: 1 })),
            ),
          );
          throw new Error('Admin sign-in required to load elements. Please sign in again.');
        }
        throw new Error(elementsResult.error ?? elementsResult.data?.error ?? 'Unable to load elements.');
      }
      const loadedElements = sanitizeAdminElements(elementsResult.data?.elements);
      setElements(loadedElements);
      const ids = loadedElements.map((e) => e.element_id);
      setChart(ids.flatMap((a) => ids.map((d) => ({ attacker: a, defender: d, multiplier: 1 }))));

      const result = await apiFetchJson<ElementChartResponse>('/api/admin/element-chart/get');
      if (!result.ok) {
        if (result.status === 401) {
          throw new Error('Admin sign-in required to load element chart. Please sign in again.');
        }
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load element chart.');
      }
      const loaded = sanitizeElementChartWithElements(result.data?.elementChart, ids);
      setChart(loaded);
      setStatus('Loaded element chart.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load element chart.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const saveChart = async () => {
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<ElementChartResponse>('/api/admin/element-chart/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementChart: chart }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save element chart.');
      }
      setStatus('Saved element chart.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save element chart.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveElements = async () => {
    setIsSavingElements(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<ElementsSaveResponse>('/api/admin/elements/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save elements.');
      }
      setElements(sanitizeAdminElements(result.data?.elements));
      setStatus('Saved elements.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save elements.');
    } finally {
      setIsSavingElements(false);
    }
  };

  const loadIconsBucket = async () => {
    setIsLoadingIcons(true);
    setError('');
    try {
      const result = await apiFetchJson<LoadSupabaseIconsResponse>('/api/admin/spritesheets/list?bucket=icons&prefix=');
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load icons bucket.');
      }
      const spritesheets = Array.isArray(result.data?.spritesheets) ? result.data?.spritesheets : [];
      setIconEntries(spritesheets ?? []);
      const firstPublicUrl = spritesheets?.[0]?.publicUrl;
      if (typeof firstPublicUrl === 'string' && firstPublicUrl.trim()) {
        try {
          const url = new URL(firstPublicUrl);
          const marker = '/storage/v1/object/public/';
          const idx = url.pathname.indexOf(marker);
          if (idx >= 0) {
            const root = `${url.origin}${marker}icons`;
            setIconsBucketRoot(root.replace(/\/+$/, ''));
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load icons bucket.');
    } finally {
      setIsLoadingIcons(false);
    }
  };

  const updateCell = (attacker: string, defender: string, value: number) => {
    setChart((prev) => setMultiplier(prev, attacker, defender, value));
  };

  return (
    <section className="admin-layout admin-layout--single">
      <section className="admin-panel" style={{ maxWidth: '100%' }}>
        <h3>Element Chart</h3>
        <p className="admin-note">
          Rows = defender element, columns = attacker element. Multiplier applied to damage (e.g. 0.5 = half, 2 = double).
        </p>
        <div className="admin-row">
          <button type="button" className="secondary" onClick={() => void loadAll()} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Reload'}
          </button>
          <button type="button" className="secondary" onClick={() => void saveElements()} disabled={isSavingElements}>
            {isSavingElements ? 'Saving Elements...' : 'Save Elements'}
          </button>
          <button type="button" className="primary" onClick={() => void saveChart()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Chart'}
          </button>
        </div>
        {status && <p className="admin-note">{status}</p>}
        {error && <p className="admin-note" style={{ color: '#f7b9b9' }}>{error}</p>}

        <details className="admin-panel__details" open>
          <summary>Elements</summary>
          <div className="admin-note">
            Elements are stored in <code>game_elements</code>. Logos are expected in Supabase <code>icons</code> bucket as{' '}
            <code>{'<element>-element.png'}</code>.
          </div>

          <div className="admin-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setElements((prev) => {
                  const nextIndex = prev.length;
                  const id = `new-element-${nextIndex + 1}`;
                  const next = [
                    ...prev,
                    {
                      element_id: id,
                      display_name: `New Element ${nextIndex + 1}`,
                      color_hex: '#FFFFFF',
                      icon_bucket: 'icons',
                      icon_path: `${id}-element.png`,
                      sort_index: nextIndex,
                    },
                  ];
                  setSelectedElementIndex(nextIndex);
                  return next;
                });
              }}
            >
              New Element
            </button>
            <button type="button" className="secondary" onClick={() => void loadIconsBucket()} disabled={isLoadingIcons}>
              {isLoadingIcons ? 'Loading Icons...' : 'Refresh Icons Bucket'}
            </button>
            {selectedElement ? (
              <span className="admin-note">Editing: {selectedElement.display_name || selectedElement.element_id}</span>
            ) : (
              <span className="admin-note">Click an element card to edit.</span>
            )}
          </div>

          <div>
            <label
              className="admin-row"
              style={{ marginBottom: 6, justifyContent: 'flex-start', alignItems: 'flex-start' }}
            >
                Search
                <input
                  value={elementSearchInput}
                  onChange={(e) => setElementSearchInput(e.target.value)}
                  placeholder="ID or name"
                />
              </label>
              <div className="admin-item-grid">
                {filteredElements.map((el) => {
                  const idx = elements.findIndex((x) => x.element_id === el.element_id);
                  const elementColor = el.color_hex && /^#[0-9a-fA-F]{6}$/.test(el.color_hex) ? el.color_hex : '';
                  const style = elementColor ? { ['--admin-skill-bg' as string]: elementColor } : undefined;
                  const logoUrl = resolveIconPublicUrl(el.icon_path);
                  return (
                    <button
                      key={el.element_id}
                      type="button"
                      className={`secondary admin-skill-list-item ${elementColor ? 'admin-skill-list-item--colored' : ''} ${idx === selectedElementIndex ? 'is-selected' : ''}`}
                      style={style}
                      title={el.element_id}
                      onClick={() => setSelectedElementIndex(idx)}
                    >
                      {logoUrl && <img src={logoUrl} alt={el.element_id} className="skill-cell__element-logo" />}
                      <span className="skill-cell__name">{el.display_name || el.element_id}</span>
                    </button>
                  );
                })}
                {elements.length === 0 && <p className="admin-note">No elements yet. Create one and save.</p>}
              </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="admin-note" style={{ marginBottom: 8 }}>Element editor</div>
            {selectedElement ? (
              <div className="admin-panel" style={{ padding: 12 }}>
                <label style={{ display: 'block' }}>
                  Element ID
                  <input
                    value={selectedElement.element_id}
                    onChange={(e) => {
                      const v = e.target.value.trim().toLowerCase();
                      setElements((prev) =>
                        prev.map((p, i) => (i === selectedElementIndex ? { ...p, element_id: v } : p)),
                      );
                    }}
                  />
                </label>
                <label style={{ display: 'block', marginTop: 10 }}>
                  Name
                  <input
                    value={selectedElement.display_name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setElements((prev) =>
                        prev.map((p, i) => (i === selectedElementIndex ? { ...p, display_name: v } : p)),
                      );
                    }}
                  />
                </label>
                <label style={{ display: 'block', marginTop: 10 }}>
                  Color
                  <input
                    type="color"
                    value={
                      selectedElement.color_hex && /^#[0-9a-fA-F]{6}$/.test(selectedElement.color_hex)
                        ? selectedElement.color_hex
                        : '#FFFFFF'
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setElements((prev) =>
                        prev.map((p, i) => (i === selectedElementIndex ? { ...p, color_hex: v } : p)),
                      );
                    }}
                  />
                </label>

                <div style={{ marginTop: 12 }}>
                  <div className="admin-note" style={{ marginBottom: 6 }}>Logo image (`icons` bucket)</div>
                  <div className="admin-note" style={{ marginBottom: 8 }}>
                    Expected filename: <code>{selectedElementId ? `${selectedElementId}-element.png` : '<element>-element.png'}</code>
                  </div>

                  {iconEntries.length === 0 ? (
                    <button type="button" className="secondary" onClick={() => void loadIconsBucket()} disabled={isLoadingIcons}>
                      {isLoadingIcons ? 'Loading Icons...' : 'Load icons bucket'}
                    </button>
                  ) : selectedElementIconMatches.length === 0 ? (
                    <p className="admin-note" style={{ color: '#f7b9b9' }}>
                      No matching icon found in the bucket for this element ID.
                    </p>
                  ) : (
                    <div className="admin-grid" style={{ gridTemplateColumns: '1fr', gap: 6 }}>
                      {selectedElementIconMatches.map((icon) => (
                        <button
                          key={icon.path}
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setElements((prev) =>
                              prev.map((p, i) => (i === selectedElementIndex ? { ...p, icon_path: icon.path } : p)),
                            );
                          }}
                          style={{ padding: 8, textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <img src={icon.publicUrl} alt="" style={{ width: 22, height: 22 }} />
                            <span style={{ fontSize: 13 }}>{icon.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <label style={{ display: 'block', marginTop: 10 }}>
                    Stored icon path
                    <input
                      value={selectedElement.icon_path}
                      onChange={(e) => {
                        const v = e.target.value;
                        setElements((prev) =>
                          prev.map((p, i) => (i === selectedElementIndex ? { ...p, icon_path: v } : p)),
                        );
                      }}
                    />
                  </label>

                  <div className="admin-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12, justifyContent: 'flex-start' }}>
                    <button type="button" className="primary" onClick={() => void saveElements()} disabled={isSavingElements}>
                      {isSavingElements ? 'Saving...' : 'Save Element Changes'}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        const idx = selectedElementIndex;
                        setElements((prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, sort_index: i })));
                        setSelectedElementIndex(null);
                      }}
                    >
                      Delete (local only)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="admin-note">Select an element card to edit it.</div>
            )}
          </div>
        </details>

        <div className="element-chart-grid-wrap">
          <table className="element-chart-grid">
            <thead>
              <tr>
                <th>Def ↓ / Atk →</th>
                {elementIds.map((a) => (
                  <th key={a}>{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {elementIds.map((defender) => (
                <tr key={defender}>
                  <th>{defender}</th>
                  {elementIds.map((attacker) => (
                    <td key={`${defender}-${attacker}`}>
                      <input
                        type="number"
                        min={0}
                        max={4}
                        step={0.25}
                        value={getMultiplier(chart, attacker, defender)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) updateCell(attacker, defender, Math.max(0, Math.min(4, v)));
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
