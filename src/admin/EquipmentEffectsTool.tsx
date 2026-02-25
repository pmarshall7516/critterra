import { useEffect, useMemo, useState } from 'react';
import { apiFetchJson } from '@/shared/apiClient';
import {
  EQUIPMENT_EFFECT_MODES,
  EQUIPMENT_EFFECT_STATS,
  type EquipmentEffectDefinition,
  type EquipmentEffectMode,
  type EquipmentEffectModifier,
  type EquipmentEffectStat,
} from '@/game/equipmentEffects/types';
import { sanitizeEquipmentEffectLibrary } from '@/game/equipmentEffects/schema';

const ICONS_BUCKET = 'icons';

interface EquipmentEffectsListResponse {
  ok: boolean;
  equipmentEffects?: unknown;
  error?: string;
}

interface EquipmentEffectsSaveResponse {
  ok: boolean;
  error?: string;
}

interface SupabaseIconEntry {
  name: string;
  path: string;
  publicUrl: string;
  updatedAt: string | null;
}

interface LoadSupabaseIconsResponse {
  ok: boolean;
  bucket?: string;
  spritesheets?: SupabaseIconEntry[];
  error?: string;
}

interface EffectDraft {
  effect_id: string;
  effect_name: string;
  description: string;
  iconUrl: string;
  modifiers: Array<{
    stat: EquipmentEffectStat;
    mode: EquipmentEffectMode;
    value: string;
  }>;
}

const emptyDraft: EffectDraft = {
  effect_id: '',
  effect_name: '',
  description: '',
  iconUrl: '',
  modifiers: [
    {
      stat: 'defense',
      mode: 'flat',
      value: '1',
    },
  ],
};

function effectToDraft(effect: EquipmentEffectDefinition): EffectDraft {
  return {
    effect_id: effect.effect_id,
    effect_name: effect.effect_name,
    description: effect.description,
    iconUrl: effect.iconUrl ?? '',
    modifiers: (effect.modifiers ?? []).map((modifier) => ({
      stat: modifier.stat,
      mode: modifier.mode,
      value: String(modifier.value),
    })),
  };
}

function parseDraftModifiers(raw: EffectDraft['modifiers']): EquipmentEffectModifier[] {
  const parsed: EquipmentEffectModifier[] = [];
  for (const entry of raw) {
    const value = Number.parseFloat(entry.value);
    if (!Number.isFinite(value)) {
      continue;
    }
    parsed.push({
      stat: entry.stat,
      mode: entry.mode,
      value,
    });
  }
  return parsed;
}

export function EquipmentEffectsTool() {
  const [effects, setEffects] = useState<EquipmentEffectDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EffectDraft>(emptyDraft);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [iconEntries, setIconEntries] = useState<SupabaseIconEntry[]>([]);
  const [iconSearchInput, setIconSearchInput] = useState('');
  const [isLoadingIcons, setIsLoadingIcons] = useState(false);

  const selected = useMemo(() => effects.find((entry) => entry.effect_id === selectedId) ?? null, [effects, selectedId]);

  const filteredIconEntries = useMemo(() => {
    const query = iconSearchInput.trim().toLowerCase();
    const sorted = [...iconEntries].sort((left, right) => left.path.localeCompare(right.path));
    if (!query) {
      return sorted;
    }
    return sorted.filter(
      (entry) => entry.name.toLowerCase().includes(query) || entry.path.toLowerCase().includes(query),
    );
  }, [iconEntries, iconSearchInput]);

  const loadAll = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<EquipmentEffectsListResponse>('/api/admin/equipment-effects/list');
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load equipment effects.');
      }
      const loaded = sanitizeEquipmentEffectLibrary(result.data?.equipmentEffects);
      setEffects(loaded);
      if (loaded.length > 0) {
        const nextSelected = selectedId && loaded.some((entry) => entry.effect_id === selectedId) ? selectedId : loaded[0].effect_id;
        const nextEffect = loaded.find((entry) => entry.effect_id === nextSelected) ?? loaded[0];
        setSelectedId(nextSelected);
        setDraft(effectToDraft(nextEffect));
      } else {
        setSelectedId(null);
        setDraft(emptyDraft);
      }
      setStatus(`Loaded ${loaded.length} equipment effect(s).`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load equipment effects.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadIconEntries = async () => {
    setIsLoadingIcons(true);
    try {
      const result = await apiFetchJson<LoadSupabaseIconsResponse>(
        `/api/admin/spritesheets/list?bucket=${encodeURIComponent(ICONS_BUCKET)}`,
      );
      if (!result.ok || !result.data?.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load icons.');
      }
      const list = Array.isArray(result.data.spritesheets) ? result.data.spritesheets : [];
      setIconEntries(list);
      setStatus(`Loaded ${list.length} icon(s) from bucket "${ICONS_BUCKET}".`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load icons.');
    } finally {
      setIsLoadingIcons(false);
    }
  };

  useEffect(() => {
    void loadAll();
    void loadIconEntries();
    // mount
  }, []);

  const saveEffects = async () => {
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const payload = effects.map((effect) => ({
        effect_id: effect.effect_id,
        effect_name: effect.effect_name,
        description: effect.description,
        iconUrl: effect.iconUrl,
        modifiers: effect.modifiers,
      }));
      const result = await apiFetchJson<EquipmentEffectsSaveResponse>('/api/admin/equipment-effects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipmentEffects: payload }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save equipment effects.');
      }
      setStatus(`Saved ${effects.length} equipment effect(s).`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save equipment effects.');
    } finally {
      setIsSaving(false);
    }
  };

  const addNew = () => {
    const nextId = `equipment-effect-${effects.length + 1}`;
    setSelectedId(null);
    setDraft({
      ...emptyDraft,
      effect_id: nextId,
      effect_name: `Equipment Effect ${effects.length + 1}`,
    });
  };

  const createOrUpdateFromDraft = () => {
    const effectId = draft.effect_id.trim();
    const effectName = draft.effect_name.trim();
    if (!effectId || !effectName) {
      setError('Effect ID and name are required.');
      return;
    }
    const modifiers = parseDraftModifiers(draft.modifiers);
    if (modifiers.length === 0) {
      setError('Add at least one valid modifier.');
      return;
    }
    const parsed = sanitizeEquipmentEffectLibrary([
      {
        effect_id: effectId,
        effect_name: effectName,
        description: draft.description,
        iconUrl: draft.iconUrl,
        modifiers,
      },
    ])[0];
    if (!parsed) {
      setError('Unable to parse equipment effect draft.');
      return;
    }

    const existingIndex = effects.findIndex((entry) => entry.effect_id === parsed.effect_id);
    const next = existingIndex >= 0 ? effects.map((entry, index) => (index === existingIndex ? parsed : entry)) : [...effects, parsed];
    setEffects(next);
    setSelectedId(parsed.effect_id);
    setDraft(effectToDraft(parsed));
    setStatus(existingIndex >= 0 ? 'Updated equipment effect.' : 'Added equipment effect.');
    setError('');
  };

  const removeSelected = () => {
    if (!selectedId) {
      return;
    }
    const next = effects.filter((entry) => entry.effect_id !== selectedId);
    setEffects(next);
    if (next.length > 0) {
      setSelectedId(next[0].effect_id);
      setDraft(effectToDraft(next[0]));
    } else {
      setSelectedId(null);
      setDraft(emptyDraft);
    }
    setStatus('Removed equipment effect.');
  };

  return (
    <section className="admin-layout admin-layout--single">
      <section className="admin-layout__left">
        <section className="admin-panel">
          <h3>Equipment Effects</h3>
          <div className="admin-row">
            <button type="button" className="secondary" onClick={() => void loadAll()} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Reload'}
            </button>
            <button type="button" className="secondary" onClick={addNew}>
              New Effect
            </button>
            <button type="button" className="secondary" onClick={() => selected && setDraft(effectToDraft(selected))}>
              Reset to selected
            </button>
            <button type="button" className="secondary" onClick={removeSelected} disabled={!selectedId}>
              Remove
            </button>
            <button type="button" className="primary" onClick={() => void saveEffects()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Effects'}
            </button>
          </div>
          {status && <p className="admin-note">{status}</p>}
          {error && (
            <p className="admin-note" style={{ color: '#f7b9b9' }}>
              {error}
            </p>
          )}
          <div className="admin-item-grid">
            {effects.map((entry) => (
              <button
                key={entry.effect_id}
                type="button"
                className={`secondary ${selectedId === entry.effect_id ? 'is-selected' : ''}`}
                onClick={() => {
                  setSelectedId(entry.effect_id);
                  setDraft(effectToDraft(entry));
                }}
              >
                {entry.effect_id} - {entry.effect_name}
              </button>
            ))}
            {effects.length === 0 && <p className="admin-note">No equipment effects yet.</p>}
          </div>
        </section>
      </section>

      <section className="admin-layout__right">
        <section className="admin-panel">
          <h4>Effect details</h4>
          <div className="admin-grid-2">
            <label>
              Effect ID
              <input
                value={draft.effect_id}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    effect_id: event.target.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
                  }))
                }
              />
            </label>
            <label>
              Effect name
              <input
                value={draft.effect_name}
                onChange={(event) => setDraft((current) => ({ ...current, effect_name: event.target.value }))}
              />
            </label>
          </div>
          <label>
            Description (tooltip)
            <input
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="Increases defense while equipped."
            />
          </label>

          <section className="admin-panel" style={{ marginTop: '0.5rem' }}>
            <h4>Modifiers</h4>
            <div className="saved-paint-list">
              {draft.modifiers.map((modifier, index) => (
                <div key={`modifier-${index}`} className="admin-grid-2" style={{ marginBottom: '0.35rem' }}>
                  <label>
                    Stat
                    <select
                      value={modifier.stat}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          modifiers: current.modifiers.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, stat: event.target.value as EquipmentEffectStat } : entry,
                          ),
                        }))
                      }
                    >
                      {EQUIPMENT_EFFECT_STATS.map((stat) => (
                        <option key={stat} value={stat}>
                          {stat}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Mode
                    <select
                      value={modifier.mode}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          modifiers: current.modifiers.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, mode: event.target.value as EquipmentEffectMode } : entry,
                          ),
                        }))
                      }
                    >
                      {EQUIPMENT_EFFECT_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Value
                    <input
                      type="number"
                      step={modifier.mode === 'percent' ? '0.01' : '1'}
                      value={modifier.value}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          modifiers: current.modifiers.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, value: event.target.value } : entry,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Remove
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          modifiers: current.modifiers.filter((_, entryIndex) => entryIndex !== index),
                        }))
                      }
                    >
                      Remove modifier
                    </button>
                  </label>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  modifiers: [...current.modifiers, { stat: 'defense', mode: 'flat', value: '1' }],
                }))
              }
            >
              Add modifier
            </button>
          </section>

          <section className="admin-panel" style={{ marginTop: '0.5rem' }}>
            <h4>Icon (Supabase bucket: {ICONS_BUCKET})</h4>
            <div className="admin-row">
              <button type="button" className="secondary" onClick={() => void loadIconEntries()} disabled={isLoadingIcons}>
                {isLoadingIcons ? 'Loading...' : 'Reload icons'}
              </button>
            </div>
            <label>
              <input
                type="text"
                placeholder="Search by icon name/path"
                value={iconSearchInput}
                onChange={(event) => setIconSearchInput(event.target.value)}
              />
            </label>
            {draft.iconUrl ? (
              <div className="admin-row" style={{ alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <img src={draft.iconUrl} alt="Selected icon" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                <span
                  className="admin-note"
                  style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={draft.iconUrl}
                >
                  {draft.iconUrl}
                </span>
                <button type="button" className="secondary" onClick={() => setDraft((current) => ({ ...current, iconUrl: '' }))}>
                  Clear
                </button>
              </div>
            ) : null}
            <div className="spritesheet-browser" style={{ maxHeight: 200, overflowY: 'auto', marginTop: '0.35rem' }}>
              {filteredIconEntries.map((entry) => (
                <div
                  key={entry.path}
                  className={`spritesheet-browser__row ${draft.iconUrl === entry.publicUrl ? 'is-selected' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem' }}
                >
                  <img src={entry.publicUrl} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                  <button
                    type="button"
                    className="secondary"
                    style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    onClick={() => setDraft((current) => ({ ...current, iconUrl: entry.publicUrl }))}
                  >
                    {entry.path}
                  </button>
                </div>
              ))}
              {filteredIconEntries.length === 0 && (
                <p className="admin-note">No icons found in bucket "{ICONS_BUCKET}".</p>
              )}
            </div>
          </section>

          <div className="admin-row">
            <button type="button" className="primary" onClick={createOrUpdateFromDraft}>
              {effects.some((entry) => entry.effect_id === draft.effect_id.trim()) ? 'Update' : 'Add'} effect
            </button>
          </div>
        </section>
      </section>
    </section>
  );
}

