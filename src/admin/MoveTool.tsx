import { useEffect, useMemo, useRef, useState } from 'react';
import { CRITTER_ELEMENTS } from '@/game/critters/types';
import type { SkillDefinition } from '@/game/skills/types';
import { ELEMENT_SKILL_COLORS, SKILL_TYPES } from '@/game/skills/types';
import { sanitizeSkillLibrary } from '@/game/skills/schema';
import { apiFetchJson } from '@/shared/apiClient';

function extractSupabasePublicBucketRoot(assetUrl: string): string | null {
  try {
    const url = new URL(assetUrl);
    const marker = '/storage/v1/object/public/';
    const suffix = url.pathname.split(marker)[1];
    if (!suffix) {
      return null;
    }
    const bucket = suffix.split('/')[0];
    if (!bucket) {
      return null;
    }
    const parsed = new URL(url);
    parsed.pathname = `${marker}${bucket}`;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function buildElementLogoUrlFromIconsBucket(element: string, iconsBucketRoot: string | null): string | null {
  if (!iconsBucketRoot) {
    return null;
  }
  return `${iconsBucketRoot}/${encodeURIComponent(`${element}-element.png`)}`;
}

interface AdminSkillCellContentProps {
  skill: SkillDefinition;
  effectList: EffectOption[];
  iconsBucketRoot: string | null;
}

function AdminSkillCellContent({ skill, effectList, iconsBucketRoot }: AdminSkillCellContentProps) {
  const elementLogoUrl = buildElementLogoUrlFromIconsBucket(skill.element, iconsBucketRoot);
  const typeLabel = skill.type === 'damage' ? 'D' : 'S';
  const value = skill.type === 'damage' ? skill.damage : skill.healPercent != null ? Math.round(skill.healPercent * 100) : null;
  const effectIconUrls = (skill.effectIds ?? [])
    .map((id) => {
      const effect = effectList.find((e) => e.id === id);
      return effect?.iconUrl;
    })
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
  return (
    <>
      {elementLogoUrl && (
        <img src={elementLogoUrl} alt={skill.element} className="skill-cell__element-logo" />
      )}
      <span className="skill-cell__name">{skill.skill_name}</span>
      <span className="skill-cell__spacer"> </span>
      <span className="skill-cell__type">{typeLabel}</span>
      {value != null && <span className="skill-cell__value">{value}</span>}
      {effectIconUrls.length > 0 && (
        <>
          {effectIconUrls.map((url, i) => (
            <img key={`${url}-${i}`} src={url} alt="" className="skill-cell__effect-icon" />
          ))}
        </>
      )}
    </>
  );
}

interface SkillsListResponse {
  ok: boolean;
  critterSkills?: unknown;
  skillEffects?: unknown;
  error?: string;
}

interface SkillsSaveResponse {
  ok: boolean;
  error?: string;
}

interface SkillDraft {
  skill_id: string;
  skill_name: string;
  element: string;
  type: 'damage' | 'support';
  damage: string;
  healPercent: string;
  effectIds: string[];
}

const emptyDraft: SkillDraft = {
  skill_id: '',
  skill_name: '',
  element: 'normal',
  type: 'damage',
  damage: '20',
  healPercent: '0',
  effectIds: [],
};

function skillToDraft(skill: SkillDefinition, effectIds: string[]): SkillDraft {
  return {
    skill_id: skill.skill_id,
    skill_name: skill.skill_name,
    element: skill.element,
    type: skill.type,
    damage: skill.type === 'damage' && skill.damage != null ? String(skill.damage) : '20',
    healPercent: skill.type === 'support' && skill.healPercent != null ? String(skill.healPercent) : '0',
    effectIds: skill.effectIds ?? effectIds.filter((id) => (skill.effectIds ?? []).includes(id)),
  };
}

interface EffectOption {
  id: string;
  name: string;
  iconUrl?: string;
}

export function MoveTool() {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [effectIds, setEffectIds] = useState<string[]>([]);
  const [effectList, setEffectList] = useState<EffectOption[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SkillDraft>(emptyDraft);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [effectSearchInput, setEffectSearchInput] = useState('');
  const [effectDropdownOpen, setEffectDropdownOpen] = useState(false);
  const effectSearchInputRef = useRef<HTMLInputElement>(null);

  const selectedSkill = useMemo(
    () => skills.find((s) => s.skill_id === selectedSkillId) ?? null,
    [skills, selectedSkillId],
  );

  const filteredSkills = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    const sorted = [...skills].sort((a, b) => a.skill_id.localeCompare(b.skill_id));
    if (!query) return sorted;
    return sorted.filter(
      (s) => s.skill_id.toLowerCase().includes(query) || s.skill_name.toLowerCase().includes(query),
    );
  }, [skills, searchInput]);

  const filteredEffectOptions = useMemo(() => {
    const query = effectSearchInput.trim().toLowerCase();
    const selected = new Set(draft.effectIds);
    return effectList
      .filter((e) => !selected.has(e.id))
      .filter(
        (e) =>
          !query || e.id.toLowerCase().includes(query) || e.name.toLowerCase().includes(query),
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 12);
  }, [effectList, draft.effectIds, effectSearchInput]);

  const iconsBucketRoot = useMemo(() => {
    // Get icons bucket root from any effect icon URL
    for (const effect of effectList) {
      if (effect.iconUrl) {
        const root = extractSupabasePublicBucketRoot(effect.iconUrl);
        if (root) return root;
      }
    }
    return null;
  }, [effectList]);

  const loadAll = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<SkillsListResponse>('/api/admin/skills/list');
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load skills.');
      }
      const rawEffects = result.data?.skillEffects;
      const effects = Array.isArray(rawEffects) ? rawEffects : [];
      const effectIdList = effects
        .map((e: { effect_id?: string }) => e?.effect_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      const list: EffectOption[] = effects
        .map((e: { effect_id?: string; effect_name?: string; iconUrl?: string }) => ({
          id: typeof e?.effect_id === 'string' ? e.effect_id : '',
          name: typeof e?.effect_name === 'string' ? e.effect_name : String(e?.effect_id ?? ''),
          iconUrl: typeof e?.iconUrl === 'string' && e.iconUrl.trim() ? e.iconUrl.trim() : undefined,
        }))
        .filter((x) => x.id.length > 0);
      setEffectIds(effectIdList);
      setEffectList(list);
      const rawSkills = result.data?.critterSkills;
      const knownEffectIds = new Set(effectIdList);
      const loaded = sanitizeSkillLibrary(rawSkills, knownEffectIds);
      setSkills(loaded);
      if (loaded.length > 0 && !selectedSkillId) {
        setSelectedSkillId(loaded[0].skill_id);
        setDraft(skillToDraft(loaded[0], effectIdList));
      } else if (selectedSkillId && loaded.find((s) => s.skill_id === selectedSkillId)) {
        const sel = loaded.find((s) => s.skill_id === selectedSkillId)!;
        setDraft(skillToDraft(sel, effectIdList));
      } else {
        setSelectedSkillId(null);
        setDraft(emptyDraft);
      }
      setStatus(`Loaded ${loaded.length} skill(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load skills.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const applyDraft = () => {
    if (selectedSkill) {
      setDraft(skillToDraft(selectedSkill, effectIds));
    } else {
      setDraft(emptyDraft);
    }
  };

  const saveSkills = async () => {
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const payload = skills.map((s) => ({
        skill_id: s.skill_id,
        skill_name: s.skill_name,
        element: s.element,
        type: s.type,
        damage: s.type === 'damage' ? s.damage : undefined,
        healPercent: s.type === 'support' ? s.healPercent : undefined,
        effectIds: s.effectIds?.length ? s.effectIds : undefined,
      }));
      const result = await apiFetchJson<SkillsSaveResponse>('/api/admin/skills/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ critterSkills: payload }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save skills.');
      }
      setStatus(`Saved ${skills.length} skill(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save skills.');
    } finally {
      setIsSaving(false);
    }
  };

  const addNew = () => {
    const nextId = `skill-${skills.length + 1}`;
    setSelectedSkillId(null);
    setDraft({
      ...emptyDraft,
      skill_id: nextId,
      skill_name: nextId,
    });
  };

  const createOrUpdateFromDraft = () => {
    const id = draft.skill_id.trim();
    const name = draft.skill_name.trim();
    if (!id || !name) {
      setError('Skill ID and name are required.');
      return;
    }
    const damageNum = draft.type === 'damage' ? Math.max(1, parseInt(draft.damage, 10) || 20) : undefined;
    const healNum = draft.type === 'support' ? Math.max(0, Math.min(1, parseFloat(draft.healPercent) || 0)) : undefined;
    const newSkill: SkillDefinition = {
      skill_id: id,
      skill_name: name,
      element: draft.element as SkillDefinition['element'],
      type: draft.type,
      ...(draft.type === 'damage' && { damage: damageNum }),
      ...(draft.type === 'support' && { healPercent: healNum }),
      ...(draft.effectIds.length > 0 && { effectIds: draft.effectIds }),
    };
    const existingIndex = skills.findIndex((s) => s.skill_id === id);
    let next: SkillDefinition[];
    if (existingIndex >= 0) {
      next = skills.map((s, i) => (i === existingIndex ? newSkill : s));
    } else {
      next = [...skills, newSkill];
    }
    setSkills(next);
    setSelectedSkillId(id);
    setDraft(skillToDraft(newSkill, effectIds));
    setStatus(existingIndex >= 0 ? 'Updated skill.' : 'Added skill.');
  };

  const removeSelected = () => {
    if (!selectedSkillId) return;
    setSkills(skills.filter((s) => s.skill_id !== selectedSkillId));
    const next = skills.filter((s) => s.skill_id !== selectedSkillId);
    if (next.length > 0) {
      setSelectedSkillId(next[0].skill_id);
      setDraft(skillToDraft(next[0], effectIds));
    } else {
      setSelectedSkillId(null);
      setDraft(emptyDraft);
    }
    setStatus('Removed skill.');
  };

  return (
    <section className="admin-layout admin-layout--single">
      <section className="admin-layout__left">
        <section className="admin-panel">
          <h3>Skills</h3>
          <div className="admin-row">
            <button type="button" className="secondary" onClick={() => void loadAll()} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Reload'}
            </button>
            <button type="button" className="secondary" onClick={addNew}>
              New Skill
            </button>
            <button type="button" className="secondary" onClick={applyDraft}>
              Reset to selected
            </button>
            <button type="button" className="secondary" onClick={removeSelected} disabled={!selectedSkillId}>
              Remove
            </button>
            <button type="button" className="primary" onClick={() => void saveSkills()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Skills'}
            </button>
          </div>
          <label className="admin-row">
            Search
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ID or name"
            />
          </label>
          {status && <p className="admin-note">{status}</p>}
          {error && <p className="admin-note" style={{ color: '#f7b9b9' }}>{error}</p>}
          <div className="admin-item-grid">
            {filteredSkills.map((skill) => {
              const elementColor = ELEMENT_SKILL_COLORS[skill.element as keyof typeof ELEMENT_SKILL_COLORS];
              const style = elementColor
                ? { ['--admin-skill-bg' as string]: elementColor }
                : undefined;
              return (
                <button
                  key={skill.skill_id}
                  type="button"
                  className={`secondary admin-skill-list-item ${elementColor ? 'admin-skill-list-item--colored' : ''} ${selectedSkillId === skill.skill_id ? 'is-selected' : ''}`}
                  style={style}
                  onClick={() => {
                    setSelectedSkillId(skill.skill_id);
                    setDraft(skillToDraft(skill, effectIds));
                  }}
                >
                  <AdminSkillCellContent skill={skill} effectList={effectList} iconsBucketRoot={iconsBucketRoot} />
                </button>
              );
            })}
            {skills.length === 0 && <p className="admin-note">No skills yet. Create one and save.</p>}
          </div>
        </section>
      </section>
      <section className="admin-layout__right">
        <section className="admin-panel">
          <h4>Skill details</h4>
          <div className="admin-grid-2">
            <label>
              Skill ID
              <input
                value={draft.skill_id}
                onChange={(e) => setDraft((d) => ({ ...d, skill_id: e.target.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') }))}
                placeholder="tackle"
              />
            </label>
            <label>
              Skill name
              <input
                value={draft.skill_name}
                onChange={(e) => setDraft((d) => ({ ...d, skill_name: e.target.value }))}
                placeholder="Tackle"
              />
            </label>
            <label>
              Element
              <select
                value={draft.element}
                onChange={(e) => setDraft((d) => ({ ...d, element: e.target.value }))}
              >
                {CRITTER_ELEMENTS.map((el) => (
                  <option key={el} value={el}>{el}</option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as 'damage' | 'support' }))}
              >
                {SKILL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          {draft.type === 'damage' && (
            <label>
              Damage (power)
              <input
                type="number"
                min={1}
                value={draft.damage}
                onChange={(e) => setDraft((d) => ({ ...d, damage: e.target.value }))}
              />
            </label>
          )}
          {draft.type === 'support' && (
            <label>
              Heal % (0–1)
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={draft.healPercent}
                onChange={(e) => setDraft((d) => ({ ...d, healPercent: e.target.value }))}
              />
            </label>
          )}
          {effectList.length > 0 && (
            <label className="admin-effect-picker-wrap">
              <span>Skill Effects</span>
              <div
                className="admin-effect-picker"
                onClick={() => effectSearchInputRef.current?.focus()}
              >
                {draft.effectIds.map((id) => {
                  const opt = effectList.find((e) => e.id === id);
                  return (
                    <span key={id} className="admin-effect-picker__chip">
                      {opt ? `${opt.id} – ${opt.name}` : id}
                      <button
                        type="button"
                        className="admin-effect-picker__chip-remove"
                        aria-label={`Remove ${id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraft((d) => ({
                            ...d,
                            effectIds: d.effectIds.filter((x) => x !== id),
                          }));
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                <input
                  ref={effectSearchInputRef}
                  type="text"
                  className="admin-effect-picker__input"
                  value={effectSearchInput}
                  onChange={(e) => setEffectSearchInput(e.target.value)}
                  onFocus={() => setEffectDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setEffectDropdownOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === ',' || e.key === 'Enter') {
                      e.preventDefault();
                      const q = effectSearchInput.trim().toLowerCase();
                      if (q) {
                        const exact = effectList.find(
                          (x) => x.id.toLowerCase() === q || x.name.toLowerCase() === q,
                        );
                        if (exact && !draft.effectIds.includes(exact.id)) {
                          setDraft((d) => ({ ...d, effectIds: [...d.effectIds, exact.id] }));
                        }
                        setEffectSearchInput('');
                      }
                    } else if (e.key === 'Backspace' && !effectSearchInput && draft.effectIds.length > 0) {
                      setDraft((d) => ({
                        ...d,
                        effectIds: d.effectIds.slice(0, -1),
                      }));
                    }
                  }}
                  placeholder={draft.effectIds.length === 0 ? 'Search effects…' : 'Add another (type or comma)'}
                />
                {effectDropdownOpen && (
                  <div
                    className="admin-effect-picker__dropdown"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {filteredEffectOptions.length === 0 ? (
                      <div className="admin-effect-picker__dropdown-empty">
                        {effectSearchInput.trim() ? 'No matching effects' : 'All selected or no effects'}
                      </div>
                    ) : (
                      filteredEffectOptions.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className="admin-effect-picker__dropdown-item"
                          onMouseDown={() => {
                            setDraft((d) => ({
                              ...d,
                              effectIds: d.effectIds.includes(opt.id) ? d.effectIds : [...d.effectIds, opt.id],
                            }));
                            setEffectSearchInput('');
                            setEffectDropdownOpen(false);
                          }}
                        >
                          {opt.id} – {opt.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </label>
          )}
          <div className="admin-row">
            <button type="button" className="primary" onClick={createOrUpdateFromDraft}>
              {skills.some((s) => s.skill_id === draft.skill_id.trim()) ? 'Update' : 'Add'} skill
            </button>
          </div>
        </section>
      </section>
    </section>
  );
}
