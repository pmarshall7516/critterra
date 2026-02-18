import { useEffect, useMemo, useState } from 'react';
import type { SkillEffectDefinition } from '@/game/skills/types';
import { SKILL_EFFECT_TYPES } from '@/game/skills/types';
import { sanitizeSkillEffectLibrary } from '@/game/skills/schema';
import { apiFetchJson } from '@/shared/apiClient';

const ICONS_BUCKET = 'icons';

interface SkillEffectsListResponse {
  ok: boolean;
  skillEffects?: unknown;
  error?: string;
}

interface SkillEffectsSaveResponse {
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
  effect_type: 'atk_buff' | 'def_buff' | 'speed_buff';
  buffPercent: string;
  description: string;
  iconUrl: string;
}

const emptyDraft: EffectDraft = {
  effect_id: '',
  effect_name: '',
  effect_type: 'atk_buff',
  buffPercent: '0.1',
  description: '',
  iconUrl: '',
};

function effectToDraft(e: SkillEffectDefinition): EffectDraft {
  return {
    effect_id: e.effect_id,
    effect_name: e.effect_name,
    effect_type: e.effect_type,
    buffPercent: String(e.buffPercent),
    description: e.description ?? '',
    iconUrl: e.iconUrl ?? '',
  };
}

export function SkillEffectsTool() {
  const [effects, setEffects] = useState<SkillEffectDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EffectDraft>(emptyDraft);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [iconEntries, setIconEntries] = useState<SupabaseIconEntry[]>([]);
  const [iconSearchInput, setIconSearchInput] = useState('');
  const [isLoadingIcons, setIsLoadingIcons] = useState(false);

  const selected = useMemo(() => effects.find((e) => e.effect_id === selectedId) ?? null, [effects, selectedId]);

  const filteredIconEntries = useMemo(() => {
    const query = iconSearchInput.trim().toLowerCase();
    const sorted = [...iconEntries].sort((a, b) => a.path.localeCompare(b.path));
    if (!query) return sorted;
    return sorted.filter(
      (e) => e.name.toLowerCase().includes(query) || e.path.toLowerCase().includes(query),
    );
  }, [iconEntries, iconSearchInput]);

  const loadAll = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<SkillEffectsListResponse>('/api/admin/skill-effects/list');
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load skill effects.');
      }
      const loaded = sanitizeSkillEffectLibrary(result.data?.skillEffects);
      setEffects(loaded);
      if (loaded.length > 0 && (!selectedId || !loaded.find((e) => e.effect_id === selectedId))) {
        setSelectedId(loaded[0].effect_id);
        setDraft(effectToDraft(loaded[0]));
      } else if (selectedId && loaded.find((e) => e.effect_id === selectedId)) {
        setDraft(effectToDraft(loaded.find((e) => e.effect_id === selectedId)!));
      } else {
        setSelectedId(null);
        setDraft(emptyDraft);
      }
      setStatus(`Loaded ${loaded.length} effect(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load skill effects.');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load icons from Supabase.');
    } finally {
      setIsLoadingIcons(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    void loadIconEntries();
  }, []);

  const saveEffects = async () => {
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const payload = effects.map((e) => ({
        effect_id: e.effect_id,
        effect_name: e.effect_name,
        effect_type: e.effect_type,
        buffPercent: e.buffPercent,
        description: e.description,
        ...(e.iconUrl && { iconUrl: e.iconUrl }),
      }));
      const result = await apiFetchJson<SkillEffectsSaveResponse>('/api/admin/skill-effects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillEffects: payload }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save skill effects.');
      }
      setStatus(`Saved ${effects.length} effect(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save skill effects.');
    } finally {
      setIsSaving(false);
    }
  };

  const addNew = () => {
    setSelectedId(null);
    setDraft({ ...emptyDraft, effect_id: `effect-${effects.length + 1}`, effect_name: `Effect ${effects.length + 1}` });
  };

  const createOrUpdateFromDraft = () => {
    const id = draft.effect_id.trim();
    const name = draft.effect_name.trim();
    if (!id || !name) {
      setError('Effect ID and name are required.');
      return;
    }
    const buff = Math.max(0, Math.min(1, parseFloat(draft.buffPercent) || 0.1));
    const newEffect: SkillEffectDefinition = {
      effect_id: id,
      effect_name: name,
      effect_type: draft.effect_type,
      buffPercent: buff,
      description: draft.description.trim(),
      ...(draft.iconUrl.trim() && { iconUrl: draft.iconUrl.trim() }),
    };
    const idx = effects.findIndex((e) => e.effect_id === id);
    const next = idx >= 0 ? effects.map((e, i) => (i === idx ? newEffect : e)) : [...effects, newEffect];
    setEffects(next);
    setSelectedId(id);
    setDraft(effectToDraft(newEffect));
    setStatus(idx >= 0 ? 'Updated effect.' : 'Added effect.');
  };

  const removeSelected = () => {
    if (!selectedId) return;
    const next = effects.filter((e) => e.effect_id !== selectedId);
    setEffects(next);
    if (next.length > 0) {
      setSelectedId(next[0].effect_id);
      setDraft(effectToDraft(next[0]));
    } else {
      setSelectedId(null);
      setDraft(emptyDraft);
    }
    setStatus('Removed effect.');
  };

  return (
    <section className="admin-layout admin-layout--single">
      <section className="admin-layout__left">
        <section className="admin-panel">
          <h3>Skill Effects</h3>
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
          {error && <p className="admin-note" style={{ color: '#f7b9b9' }}>{error}</p>}
          <div className="admin-item-grid">
            {effects.map((e) => (
              <button
                key={e.effect_id}
                type="button"
                className={`secondary ${selectedId === e.effect_id ? 'is-selected' : ''}`}
                onClick={() => {
                  setSelectedId(e.effect_id);
                  setDraft(effectToDraft(e));
                }}
              >
                {e.effect_id} – {e.effect_name}
              </button>
            ))}
            {effects.length === 0 && <p className="admin-note">No effects yet.</p>}
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
                onChange={(e) => setDraft((d) => ({ ...d, effect_id: e.target.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') }))}
                placeholder="atk-buff"
              />
            </label>
            <label>
              Effect name
              <input
                value={draft.effect_name}
                onChange={(e) => setDraft((d) => ({ ...d, effect_name: e.target.value }))}
                placeholder="Atk Buff"
              />
            </label>
            <label>
              Type
              <select
                value={draft.effect_type}
                onChange={(e) => setDraft((d) => ({ ...d, effect_type: e.target.value as EffectDraft['effect_type'] }))}
              >
                {SKILL_EFFECT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Buff % (0–1)
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={draft.buffPercent}
                onChange={(e) => setDraft((d) => ({ ...d, buffPercent: e.target.value }))}
              />
            </label>
          </div>
          <label>
            Description (tooltip)
            <input
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Raises the user's Attack."
            />
          </label>
          <section className="admin-panel" style={{ marginTop: '0.5rem' }}>
            <h4>Icon (Supabase bucket: {ICONS_BUCKET})</h4>
            <p className="admin-note" style={{ marginBottom: '0.4rem' }}>
              Icon shown on the critter when this effect is active (e.g. stat buffs on your critter card in battle).
            </p>
            <div className="admin-row">
              <button type="button" className="secondary" onClick={() => void loadIconEntries()} disabled={isLoadingIcons}>
                {isLoadingIcons ? 'Loading...' : 'Reload icons'}
              </button>
            </div>
            <label>
              <input
                type="text"
                placeholder="Search by name or path"
                value={iconSearchInput}
                onChange={(e) => setIconSearchInput(e.target.value)}
              />
            </label>
            {draft.iconUrl ? (
              <div className="admin-row" style={{ alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <img src={draft.iconUrl} alt="Selected icon" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                <span className="admin-note" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }} title={draft.iconUrl}>
                  {draft.iconUrl}
                </span>
                <button type="button" className="secondary" onClick={() => setDraft((d) => ({ ...d, iconUrl: '' }))}>
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
                    onClick={() => setDraft((d) => ({ ...d, iconUrl: entry.publicUrl }))}
                  >
                    {entry.path}
                  </button>
                </div>
              ))}
              {filteredIconEntries.length === 0 && (
                <p className="admin-note">No icons. Upload PNGs to Supabase bucket &quot;{ICONS_BUCKET}&quot; and Reload.</p>
              )}
            </div>
          </section>
          <div className="admin-row">
            <button type="button" className="primary" onClick={createOrUpdateFromDraft}>
              {effects.some((e) => e.effect_id === draft.effect_id.trim()) ? 'Update' : 'Add'} effect
            </button>
          </div>
        </section>
      </section>
    </section>
  );
}
