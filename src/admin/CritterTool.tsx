import { useEffect, useMemo, useState } from 'react';
import { sanitizeCritterDatabase, sanitizeCritterDefinition } from '@/game/critters/schema';
import {
  CRITTER_ABILITY_KINDS,
  CRITTER_ELEMENTS,
  CRITTER_MISSION_TYPES,
  CRITTER_RARITIES,
  type CritterDefinition,
  type CritterMissionType,
} from '@/game/critters/types';
import { apiFetchJson } from '@/shared/apiClient';

interface CritterListResponse {
  ok: boolean;
  critters?: unknown;
  error?: string;
}

interface CritterSaveResponse {
  ok: boolean;
  error?: string;
}

interface SupabaseSpriteSheetListItem {
  name: string;
  path: string;
  publicUrl: string;
  updatedAt: string | null;
}

interface LoadSupabaseSpriteSheetsResponse {
  ok: boolean;
  bucket?: string;
  prefix?: string;
  spritesheets?: SupabaseSpriteSheetListItem[];
  error?: string;
}

interface MissionDraft {
  id: string;
  type: CritterMissionType;
  targetValue: string;
  ascendsFromCritterId: string;
  knockoutFilter: 'any' | 'elements' | 'critters';
  knockoutElements: string[];
  knockoutCritterIds: string[];
}

interface LevelDraft {
  requiredMissionCount: string;
  hpDelta: string;
  attackDelta: string;
  defenseDelta: string;
  speedDelta: string;
  abilityUnlockIdsInput: string;
  missions: MissionDraft[];
}

interface AbilityDraft {
  id: string;
  name: string;
  kind: 'passive' | 'active';
  description: string;
}

interface CritterDraft {
  id: string;
  name: string;
  element: string;
  rarity: string;
  description: string;
  spriteUrl: string;
  hp: string;
  attack: string;
  defense: string;
  speed: string;
  abilities: AbilityDraft[];
  levels: LevelDraft[];
}

const DEFAULT_CRITTER_SPRITE_BUCKET = 'critter-sprites';

export function CritterTool() {
  const [critters, setCritters] = useState<CritterDefinition[]>([]);
  const [selectedCritterId, setSelectedCritterId] = useState<number | null>(null);
  const [draft, setDraft] = useState<CritterDraft>(() => createEmptyDraft([]));
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [spriteBucketInput, setSpriteBucketInput] = useState(DEFAULT_CRITTER_SPRITE_BUCKET);
  const [spritePrefixInput, setSpritePrefixInput] = useState('');
  const [spriteSearchInput, setSpriteSearchInput] = useState('');
  const [missionKnockoutCritterSearchInput, setMissionKnockoutCritterSearchInput] = useState('');
  const [spriteEntries, setSpriteEntries] = useState<SupabaseSpriteSheetListItem[]>([]);
  const [isLoadingSpriteEntries, setIsLoadingSpriteEntries] = useState(false);
  const [selectedSpritePath, setSelectedSpritePath] = useState('');
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<number>>(new Set());

  const sortedCritters = useMemo(() => [...critters].sort((left, right) => left.id - right.id), [critters]);

  const selectedCritter = useMemo(
    () => critters.find((critter) => critter.id === selectedCritterId) ?? null,
    [critters, selectedCritterId],
  );

  const hasDraftChanges = useMemo(() => {
    if (!selectedCritter) {
      return true;
    }
    return JSON.stringify(critterToDraft(selectedCritter)) !== JSON.stringify(draft);
  }, [selectedCritter, draft]);

  const filteredSpriteEntries = useMemo(() => {
    const query = spriteSearchInput.trim().toLowerCase();
    const sorted = [...spriteEntries].sort((left, right) =>
      left.path.localeCompare(right.path, undefined, { sensitivity: 'base' }),
    );
    if (!query) {
      return sorted;
    }
    return sorted.filter(
      (entry) => entry.name.toLowerCase().includes(query) || entry.path.toLowerCase().includes(query),
    );
  }, [spriteEntries, spriteSearchInput]);

  const loadCritters = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<CritterListResponse>('/api/admin/critters/list');
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load critter library.');
      }

      const serverCritters = sanitizeCritterDatabase(result.data?.critters).sort((left, right) => left.id - right.id);
      setCritters(serverCritters);
      setPendingRemovalIds(new Set());
      if (serverCritters.length > 0) {
        setSelectedCritterId(serverCritters[0].id);
        setDraft(critterToDraft(serverCritters[0]));
        const matchingSprite = spriteEntries.find((entry) => entry.publicUrl === serverCritters[0].spriteUrl);
        setSelectedSpritePath(matchingSprite?.path ?? '');
      } else {
        setSelectedCritterId(null);
        setDraft(createEmptyDraft(serverCritters));
        setSelectedSpritePath('');
      }
      setStatus(`Loaded ${serverCritters.length} critter definition(s).`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load critter library.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCritterSprites = async () => {
    const bucket = spriteBucketInput.trim() || DEFAULT_CRITTER_SPRITE_BUCKET;
    const prefix = spritePrefixInput.trim();
    const params = new URLSearchParams();
    params.set('bucket', bucket);
    if (prefix) {
      params.set('prefix', prefix);
    }
    setIsLoadingSpriteEntries(true);
    try {
      const result = await apiFetchJson<LoadSupabaseSpriteSheetsResponse>(
        `/api/admin/spritesheets/list?${params.toString()}`,
      );
      if (!result.ok || !result.data?.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load critter sprites from Supabase.');
      }
      const loadedEntries = Array.isArray(result.data.spritesheets) ? result.data.spritesheets : [];
      setSpriteEntries(loadedEntries);
      setStatus(`Loaded ${loadedEntries.length} critter sprite image(s) from bucket "${bucket}".`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load critter sprites from Supabase.');
    } finally {
      setIsLoadingSpriteEntries(false);
    }
  };

  useEffect(() => {
    void loadCritters();
    void loadCritterSprites();
    // Run once on mount with default critter bucket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draft.spriteUrl) {
      return;
    }
    const matchingSprite = spriteEntries.find((entry) => entry.publicUrl === draft.spriteUrl);
    if (matchingSprite) {
      setSelectedSpritePath(matchingSprite.path);
    }
  }, [draft.spriteUrl, spriteEntries]);

  const startNewDraft = () => {
    setSelectedCritterId(null);
    setDraft(createEmptyDraft(critters));
    setSelectedSpritePath('');
    setError('');
    setStatus('Drafting a new critter entry.');
  };

  const selectCritter = (critter: CritterDefinition) => {
    setSelectedCritterId(critter.id);
    setDraft(critterToDraft(critter));
    const matchingSprite = spriteEntries.find((entry) => entry.publicUrl === critter.spriteUrl);
    setSelectedSpritePath(matchingSprite?.path ?? '');
    setError('');
    setStatus(`Loaded #${critter.id} ${critter.name}.`);
  };

  const togglePendingRemoval = (critterId: number) => {
    const isPending = pendingRemovalIds.has(critterId);
    setPendingRemovalIds((current) => {
      const next = new Set(current);
      if (next.has(critterId)) {
        next.delete(critterId);
      } else {
        next.add(critterId);
      }
      return next;
    });
    setError('');
    setStatus(
      isPending
        ? `Restored critter #${critterId}. Save Critter Database to keep it.`
        : `Marked critter #${critterId} for removal. Save Critter Database to persist removal.`,
    );
  };

  const updateLevelRow = (levelIndex: number, updater: (entry: LevelDraft) => LevelDraft) => {
    setDraft((current) => ({
      ...current,
      levels: current.levels.map((entry, entryIndex) => (entryIndex === levelIndex ? updater(entry) : entry)),
    }));
  };

  const updateMissionRow = (
    levelIndex: number,
    missionIndex: number,
    updater: (entry: MissionDraft) => MissionDraft,
  ) => {
    updateLevelRow(levelIndex, (levelRow) => ({
      ...levelRow,
      missions: levelRow.missions.map((mission, missionEntryIndex) =>
        missionEntryIndex === missionIndex ? updater(mission) : mission,
      ),
    }));
  };

  const applyDraft = () => {
    setError('');
    setStatus('');

    const draftValidationError = validateDraftBeforeApply(draft, critters);
    if (draftValidationError) {
      setError(draftValidationError);
      return;
    }

    const parsed = sanitizeCritterDefinition(draftToRaw(draft));
    if (!parsed) {
      setError('Draft is invalid.');
      return;
    }

    const next = [...critters];
    const existingIndex = selectedCritterId === null ? -1 : next.findIndex((entry) => entry.id === selectedCritterId);
    const duplicateExists = next.some((entry, index) => entry.id === parsed.id && index !== existingIndex);
    if (duplicateExists) {
      setError(`Critter ID #${parsed.id} already exists. Choose a unique numeric ID.`);
      return;
    }

    if (existingIndex >= 0) {
      next[existingIndex] = parsed;
    } else {
      next.push(parsed);
    }
    next.sort((left, right) => left.id - right.id);

    setCritters(next);
    setSelectedCritterId(parsed.id);
    setDraft(critterToDraft(parsed));
    setPendingRemovalIds((current) => {
      const nextPending = new Set(current);
      nextPending.delete(parsed.id);
      if (selectedCritterId !== null) {
        nextPending.delete(selectedCritterId);
      }
      return nextPending;
    });
    const matchingSprite = spriteEntries.find((entry) => entry.publicUrl === parsed.spriteUrl);
    setSelectedSpritePath(matchingSprite?.path ?? '');
    setStatus(`Applied critter #${parsed.id}. Save Critter Database to persist.`);
  };

  const saveCritters = async () => {
    const selectedCritterPendingRemoval = selectedCritterId !== null && pendingRemovalIds.has(selectedCritterId);
    if (hasDraftChanges && !selectedCritterPendingRemoval) {
      setError('Apply Draft before saving.');
      return;
    }

    const crittersToPersist = critters.filter((entry) => !pendingRemovalIds.has(entry.id));
    const removedCount = critters.length - crittersToPersist.length;

    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<CritterSaveResponse>('/api/admin/critters/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          critters: crittersToPersist,
        }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save critter library.');
      }

      setCritters(crittersToPersist);
      setPendingRemovalIds(new Set());

      const nextSelectedCritter =
        selectedCritterId !== null
          ? crittersToPersist.find((entry) => entry.id === selectedCritterId) ?? crittersToPersist[0] ?? null
          : crittersToPersist[0] ?? null;
      if (nextSelectedCritter) {
        setSelectedCritterId(nextSelectedCritter.id);
        setDraft(critterToDraft(nextSelectedCritter));
        const matchingSprite = spriteEntries.find((entry) => entry.publicUrl === nextSelectedCritter.spriteUrl);
        setSelectedSpritePath(matchingSprite?.path ?? '');
      } else {
        setSelectedCritterId(null);
        setDraft(createEmptyDraft(crittersToPersist));
        setSelectedSpritePath('');
      }

      setStatus(
        removedCount > 0
          ? `Saved ${crittersToPersist.length} critter definition(s). Removed ${removedCount} critter(s).`
          : `Saved ${crittersToPersist.length} critter definition(s) to database.`,
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save critter library.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-layout admin-layout--critter-tool">
      <section className="admin-panel critter-database-panel">
        <h3>Critter Database</h3>
        <div className="admin-row">
          <button type="button" className="secondary" onClick={() => void loadCritters()} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Reload'}
          </button>
          <button type="button" className="secondary" onClick={startNewDraft}>
            New Critter
          </button>
          <button type="button" className="secondary" onClick={applyDraft}>
            Apply Draft
          </button>
          <button type="button" className="primary" onClick={() => void saveCritters()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Critter Database'}
          </button>
        </div>
        <p className="admin-note">Critter IDs must be unique numeric dex entries.</p>
        {pendingRemovalIds.size > 0 && (
          <p className="admin-note">{pendingRemovalIds.size} critter(s) marked for removal. Save to commit.</p>
        )}
        {status && <p className="admin-note">{status}</p>}
        {error && (
          <p className="admin-note" style={{ color: '#f7b9b9' }}>
            {error}
          </p>
        )}

        <div className="critter-database-list">
          {sortedCritters.map((critter) => {
            const isSelected = selectedCritterId === critter.id;
            const isPendingRemoval = pendingRemovalIds.has(critter.id);
            return (
              <article
                key={`critter-${critter.id}`}
                className={`critter-db-card ${isSelected ? 'is-selected' : ''} ${isPendingRemoval ? 'is-pending-remove' : ''}`}
              >
                <button type="button" className="critter-db-card__select" onClick={() => selectCritter(critter)}>
                  <div className="critter-db-card__header">
                    <span className="critter-db-card__id">#{critter.id}</span>
                    <span className="critter-db-card__name">{critter.name}</span>
                  </div>
                  <p className="critter-db-card__meta">
                    {critter.element}
                    {isPendingRemoval ? ' | pending remove' : ''}
                  </p>
                  <div className="critter-db-card__stats">
                    <span>HP {critter.baseStats.hp}</span>
                    <span>ATK {critter.baseStats.attack}</span>
                    <span>DEF {critter.baseStats.defense}</span>
                    <span>SPD {critter.baseStats.speed}</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="secondary critter-db-card__remove"
                  onClick={() => togglePendingRemoval(critter.id)}
                >
                  {isPendingRemoval ? 'Undo' : 'Remove'}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-panel admin-panel--grow critter-editor-panel">
        <h3>Critter Editor</h3>

        <section className="critter-editor-group">
          <h4>Basic Info</h4>
          <div className="admin-grid-2">
            <label>
              Critter ID (numeric)
              <input
                type="number"
                min={1}
                value={draft.id}
                onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))}
              />
            </label>
            <label>
              Name
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              Element
              <select
                value={draft.element}
                onChange={(event) => setDraft((current) => ({ ...current, element: event.target.value }))}
              >
                {CRITTER_ELEMENTS.map((element) => (
                  <option key={element} value={element}>
                    {element}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rarity
              <select
                value={draft.rarity}
                onChange={(event) => setDraft((current) => ({ ...current, rarity: event.target.value }))}
              >
                {CRITTER_RARITIES.map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {rarity}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              rows={2}
            />
          </label>
        </section>

        <section className="critter-editor-group">
          <h4>Base Stats</h4>
          <div className="admin-grid-2">
            <label>
              Base HP
              <input
                type="number"
                value={draft.hp}
                onChange={(event) => setDraft((current) => ({ ...current, hp: event.target.value }))}
              />
            </label>
            <label>
              Base Attack
              <input
                type="number"
                value={draft.attack}
                onChange={(event) => setDraft((current) => ({ ...current, attack: event.target.value }))}
              />
            </label>
            <label>
              Base Defense
              <input
                type="number"
                value={draft.defense}
                onChange={(event) => setDraft((current) => ({ ...current, defense: event.target.value }))}
              />
            </label>
            <label>
              Base Speed
              <input
                type="number"
                value={draft.speed}
                onChange={(event) => setDraft((current) => ({ ...current, speed: event.target.value }))}
              />
            </label>
          </div>
        </section>

        <section className="critter-editor-group">
          <h4>Collection Sprite</h4>
          <div className="admin-grid-2">
            <label>
              Sprite URL
              <input
                value={draft.spriteUrl}
                onChange={(event) => {
                  setSelectedSpritePath('');
                  setDraft((current) => ({ ...current, spriteUrl: event.target.value }));
                }}
                placeholder="https://..."
              />
            </label>
            <label>
              Active Sprite
              <input value={selectedSpritePath || (draft.spriteUrl ? 'Manual URL set' : 'None')} readOnly />
            </label>
          </div>
          <div className="admin-grid-2">
            <label>
              Bucket
              <input value={spriteBucketInput} onChange={(event) => setSpriteBucketInput(event.target.value)} />
            </label>
            <label>
              Prefix (Optional)
              <input value={spritePrefixInput} onChange={(event) => setSpritePrefixInput(event.target.value)} />
            </label>
          </div>
          <div className="admin-row">
            <label>
              Search
              <input
                value={spriteSearchInput}
                onChange={(event) => setSpriteSearchInput(event.target.value)}
                placeholder="Search by file name or path"
              />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => void loadCritterSprites()}
              disabled={isLoadingSpriteEntries}
            >
              {isLoadingSpriteEntries ? 'Loading...' : 'Reload Bucket'}
            </button>
          </div>
          <div className="spritesheet-browser">
            {filteredSpriteEntries.length === 0 && (
              <p className="admin-note">
                {isLoadingSpriteEntries ? 'Loading critter sprites...' : 'No PNG critter sprites found.'}
              </p>
            )}
            {filteredSpriteEntries.map((entry) => (
              <div
                key={`critter-sprite-${entry.path}`}
                className={`spritesheet-browser__row ${selectedSpritePath === entry.path ? 'is-selected' : ''}`}
              >
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setSelectedSpritePath(entry.path);
                    setDraft((current) => ({
                      ...current,
                      spriteUrl: entry.publicUrl,
                    }));
                    setStatus(`Loaded critter sprite "${entry.path}" from Supabase.`);
                    setError('');
                  }}
                >
                  Use
                </button>
                <span className="spritesheet-browser__meta" title={entry.path}>
                  {entry.path}
                </span>
                <span className="spritesheet-browser__meta">
                  {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : '-'}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="critter-editor-group">
          <h4>Abilities</h4>
          <div className="admin-row">
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  abilities: [
                    ...current.abilities,
                    {
                      id: `ability-${current.abilities.length + 1}`,
                      name: `Ability ${current.abilities.length + 1}`,
                      kind: 'passive',
                      description: '',
                    },
                  ],
                }))
              }
            >
              Add Ability
            </button>
          </div>
          <div className="saved-paint-list">
            {draft.abilities.length === 0 && <p className="admin-note">No abilities configured yet.</p>}
            {draft.abilities.map((ability, index) => (
              <div key={`ability-${index}`} className="saved-paint-row">
                <input
                  value={ability.id}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      abilities: current.abilities.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, id: event.target.value } : entry,
                      ),
                    }))
                  }
                  placeholder="ability-id"
                />
                <input
                  value={ability.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      abilities: current.abilities.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, name: event.target.value } : entry,
                      ),
                    }))
                  }
                  placeholder="Ability Name"
                />
                <select
                  value={ability.kind}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      abilities: current.abilities.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, kind: event.target.value === 'active' ? 'active' : 'passive' }
                          : entry,
                      ),
                    }))
                  }
                >
                  {CRITTER_ABILITY_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <input
                  value={ability.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      abilities: current.abilities.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, description: event.target.value } : entry,
                      ),
                    }))
                  }
                  placeholder="Ability description"
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      abilities: current.abilities.filter((_, entryIndex) => entryIndex !== index),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="critter-editor-group">
          <h4>Level Requirements</h4>
          <div className="admin-row">
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  levels: [...current.levels, createDefaultLevelDraft()],
                }))
              }
            >
              Add Level Row
            </button>
          </div>

          <div className="saved-paint-list critter-level-list">
            {draft.levels.length === 0 && (
              <p className="admin-note">No level rows configured yet. Add a row for each level block in order.</p>
            )}
            {draft.levels.map((levelRow, levelIndex) => (
              <section key={`level-row-${levelIndex}`} className="admin-panel critter-level-row">
                <h4>{`Level ${levelIndex + 1}`}</h4>
                <div className="admin-grid-2">
                  <label>
                    Missions Required To Level Up
                    <input
                      type="number"
                      min={0}
                      value={levelRow.requiredMissionCount}
                      onChange={(event) =>
                        updateLevelRow(levelIndex, (entry) => ({ ...entry, requiredMissionCount: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    HP Delta
                    <input
                      type="number"
                      value={levelRow.hpDelta}
                      onChange={(event) => updateLevelRow(levelIndex, (entry) => ({ ...entry, hpDelta: event.target.value }))}
                    />
                  </label>
                  <label>
                    Attack Delta
                    <input
                      type="number"
                      value={levelRow.attackDelta}
                      onChange={(event) =>
                        updateLevelRow(levelIndex, (entry) => ({ ...entry, attackDelta: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Defense Delta
                    <input
                      type="number"
                      value={levelRow.defenseDelta}
                      onChange={(event) =>
                        updateLevelRow(levelIndex, (entry) => ({ ...entry, defenseDelta: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Speed Delta
                    <input
                      type="number"
                      value={levelRow.speedDelta}
                      onChange={(event) => updateLevelRow(levelIndex, (entry) => ({ ...entry, speedDelta: event.target.value }))}
                    />
                  </label>
                </div>
                <label>
                  Ability Unlock IDs (comma separated)
                  <input
                    value={levelRow.abilityUnlockIdsInput}
                    onChange={(event) =>
                      updateLevelRow(levelIndex, (entry) => ({ ...entry, abilityUnlockIdsInput: event.target.value }))
                    }
                    placeholder="ability-id-a, ability-id-b"
                  />
                </label>

                <div className="admin-row">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      updateLevelRow(levelIndex, (entry) => ({
                        ...entry,
                        missions: [
                          ...entry.missions,
                          {
                            id: `mission-${entry.missions.length + 1}`,
                            type: 'opposing_knockouts',
                            targetValue: '1',
                            ascendsFromCritterId: '',
                            knockoutFilter: 'any',
                            knockoutElements: [],
                            knockoutCritterIds: [],
                          },
                        ],
                      }))
                    }
                  >
                    Add Mission
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        levels: current.levels.filter((_, entryIndex) => entryIndex !== levelIndex),
                      }))
                    }
                  >
                    Remove Level
                  </button>
                </div>

                <div className="saved-paint-list">
                  {levelRow.missions.length === 0 && <p className="admin-note">No missions in this level yet.</p>}
                  {levelRow.missions.map((mission, missionIndex) => (
                    <div key={`level-${levelIndex}-mission-${missionIndex}`} className="critter-mission-row">
                      <label>
                        Mission ID
                        <input
                          value={mission.id}
                          onChange={(event) =>
                            updateMissionRow(levelIndex, missionIndex, (entry) => ({ ...entry, id: event.target.value }))
                          }
                          placeholder="mission-id"
                        />
                      </label>
                      <label>
                        Mission
                        <select
                          value={mission.type}
                          onChange={(event) => {
                            const nextType = event.target.value === 'ascension' ? 'ascension' : 'opposing_knockouts';
                            updateMissionRow(levelIndex, missionIndex, (entry) => ({
                              ...entry,
                              type: nextType,
                              ascendsFromCritterId:
                                nextType === 'ascension' ? entry.ascendsFromCritterId : '',
                              knockoutFilter:
                                nextType === 'opposing_knockouts' ? entry.knockoutFilter : 'any',
                              knockoutElements:
                                nextType === 'opposing_knockouts' ? entry.knockoutElements : [],
                              knockoutCritterIds:
                                nextType === 'opposing_knockouts' ? entry.knockoutCritterIds : [],
                            }));
                          }}
                        >
                          {CRITTER_MISSION_TYPES.map((missionType) => (
                            <option key={missionType} value={missionType}>
                              {getMissionTypeLabel(missionType)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {mission.type === 'ascension' ? 'Level' : 'Amount'}
                        <input
                          type="number"
                          min={1}
                          value={mission.targetValue}
                          onChange={(event) =>
                            updateMissionRow(levelIndex, missionIndex, (entry) => ({
                              ...entry,
                              targetValue: event.target.value,
                            }))
                          }
                        />
                      </label>

                      {mission.type === 'opposing_knockouts' && (
                        <label>
                          Filter
                          <select
                            value={mission.knockoutFilter}
                            onChange={(event) => {
                              const nextFilter = toKnockoutFilterValue(event.target.value);
                              updateMissionRow(levelIndex, missionIndex, (entry) => ({
                                ...entry,
                                knockoutFilter: nextFilter,
                                knockoutElements: nextFilter === 'elements' ? entry.knockoutElements : [],
                                knockoutCritterIds: nextFilter === 'critters' ? entry.knockoutCritterIds : [],
                              }));
                            }}
                          >
                            <option value="any">Any Critter</option>
                            <option value="elements">Element(s)</option>
                            <option value="critters">Critter(s)</option>
                          </select>
                        </label>
                      )}

                      {mission.type === 'ascension' && (
                        <label className="critter-mission-row__wide">
                          Critter
                          <select
                            value={mission.ascendsFromCritterId}
                            onChange={(event) =>
                              updateMissionRow(levelIndex, missionIndex, (entry) => ({
                                ...entry,
                                ascendsFromCritterId: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select critter</option>
                            {sortedCritters.map((critter) => (
                              <option key={`mission-critter-${critter.id}`} value={String(critter.id)}>
                                #{critter.id} {critter.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {mission.type === 'opposing_knockouts' && mission.knockoutFilter === 'elements' && (
                        <div className="critter-mission-row__wide critter-mission-filter-panel">
                          <p>Element(s) (Optional)</p>
                          <div className="critter-mission-filter-chip-list">
                            {CRITTER_ELEMENTS.map((element) => {
                              const isSelected = mission.knockoutElements.includes(element);
                              return (
                                <button
                                  key={`mission-element-${element}`}
                                  type="button"
                                  className={`secondary critter-mission-filter-chip ${isSelected ? 'is-selected' : ''}`}
                                  onClick={() =>
                                    updateMissionRow(levelIndex, missionIndex, (entry) => ({
                                      ...entry,
                                      knockoutElements: toggleTokenInList(entry.knockoutElements, element),
                                      knockoutCritterIds: [],
                                    }))
                                  }
                                >
                                  {capitalizeToken(element)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {mission.type === 'opposing_knockouts' && mission.knockoutFilter === 'critters' && (
                        <div className="critter-mission-row__wide critter-mission-filter-panel">
                          <p>Critter(s) (Optional)</p>
                          <input
                            value={missionKnockoutCritterSearchInput}
                            onChange={(event) => setMissionKnockoutCritterSearchInput(event.target.value)}
                            placeholder="Search critter by name or ID"
                          />
                          <div className="critter-mission-critter-list">
                            {sortedCritters
                              .filter((critter) => {
                                const query = missionKnockoutCritterSearchInput.trim().toLowerCase();
                                if (!query) {
                                  return true;
                                }
                                return (
                                  critter.name.toLowerCase().includes(query) ||
                                  String(critter.id).includes(query)
                                );
                              })
                              .map((critter) => {
                                const critterIdText = String(critter.id);
                                const isSelected = mission.knockoutCritterIds.includes(critterIdText);
                                return (
                                  <button
                                    key={`mission-knockout-critter-${critter.id}`}
                                    type="button"
                                    className={`secondary critter-mission-critter-pill ${isSelected ? 'is-selected' : ''}`}
                                    onClick={() =>
                                      updateMissionRow(levelIndex, missionIndex, (entry) => ({
                                        ...entry,
                                        knockoutCritterIds: toggleTokenInList(entry.knockoutCritterIds, critterIdText),
                                        knockoutElements: [],
                                      }))
                                    }
                                  >
                                    #{critter.id} {critter.name}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          updateLevelRow(levelIndex, (entry) => ({
                            ...entry,
                            missions: entry.missions.filter((_, entryMissionIndex) => entryMissionIndex !== missionIndex),
                          }))
                        }
                      >
                        Remove Mission
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}

function createEmptyDraft(existing: CritterDefinition[]): CritterDraft {
  const nextId = existing.length === 0 ? 1 : Math.max(...existing.map((entry) => entry.id)) + 1;
  return {
    id: String(nextId),
    name: `Critter ${nextId}`,
    element: CRITTER_ELEMENTS[0],
    rarity: CRITTER_RARITIES[0],
    description: '',
    spriteUrl: '',
    hp: '12',
    attack: '8',
    defense: '8',
    speed: '8',
    abilities: [],
    levels: [createDefaultLevelDraft()],
  };
}

function critterToDraft(critter: CritterDefinition): CritterDraft {
  return {
    id: String(critter.id),
    name: critter.name,
    element: critter.element,
    rarity: critter.rarity,
    description: critter.description,
    spriteUrl: critter.spriteUrl,
    hp: String(critter.baseStats.hp),
    attack: String(critter.baseStats.attack),
    defense: String(critter.baseStats.defense),
    speed: String(critter.baseStats.speed),
    abilities: critter.abilities.map((ability) => ({
      id: ability.id,
      name: ability.name,
      kind: ability.kind,
      description: ability.description,
    })),
    levels: critter.levels.map((level) => ({
      requiredMissionCount: String(level.requiredMissionCount),
      hpDelta: String(level.statDelta.hp),
      attackDelta: String(level.statDelta.attack),
      defenseDelta: String(level.statDelta.defense),
      speedDelta: String(level.statDelta.speed),
      abilityUnlockIdsInput: level.abilityUnlockIds.join(','),
      missions: level.missions.map((mission) => ({
        id: mission.id,
        type: mission.type,
        targetValue: String(mission.targetValue),
        ascendsFromCritterId: mission.ascendsFromCritterId ? String(mission.ascendsFromCritterId) : '',
        knockoutFilter:
          Array.isArray(mission.knockoutCritterIds) && mission.knockoutCritterIds.length > 0
            ? 'critters'
            : Array.isArray(mission.knockoutElements) && mission.knockoutElements.length > 0
              ? 'elements'
              : 'any',
        knockoutElements: Array.isArray(mission.knockoutElements) ? mission.knockoutElements : [],
        knockoutCritterIds: Array.isArray(mission.knockoutCritterIds)
          ? mission.knockoutCritterIds.map((entry) => String(entry))
          : [],
      })),
    })),
  };
}

function draftToRaw(draft: CritterDraft): unknown {
  return {
    id: Number.parseInt(draft.id, 10),
    name: draft.name.trim(),
    element: draft.element,
    rarity: draft.rarity,
    description: draft.description.trim(),
    spriteUrl: draft.spriteUrl.trim(),
    baseStats: {
      hp: Number.parseInt(draft.hp, 10),
      attack: Number.parseInt(draft.attack, 10),
      defense: Number.parseInt(draft.defense, 10),
      speed: Number.parseInt(draft.speed, 10),
    },
    abilities: draft.abilities.map((ability) => ({
      id: ability.id.trim(),
      name: ability.name.trim(),
      kind: ability.kind,
      description: ability.description.trim(),
    })),
    levels: draft.levels.map((level, levelIndex) => ({
      level: levelIndex + 1,
      requiredMissionCount: Number.parseInt(level.requiredMissionCount, 10),
      statDelta: {
        hp: Number.parseInt(level.hpDelta, 10),
        attack: Number.parseInt(level.attackDelta, 10),
        defense: Number.parseInt(level.defenseDelta, 10),
        speed: Number.parseInt(level.speedDelta, 10),
      },
      abilityUnlockIds: level.abilityUnlockIdsInput
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
      missions: level.missions.map((mission) => {
        const ascendsFromCritterId = Number.parseInt(mission.ascendsFromCritterId, 10);
        const knockoutCritterIds = mission.knockoutCritterIds
          .map((entry) => Number.parseInt(entry, 10))
          .filter((entry) => Number.isFinite(entry) && entry > 0);
        const knockoutElements = mission.knockoutElements
          .map((entry) => entry.trim().toLowerCase())
          .filter((entry, index, values) => CRITTER_ELEMENTS.includes(entry as (typeof CRITTER_ELEMENTS)[number]) && values.indexOf(entry) === index);
        return {
          id: mission.id.trim(),
          type: mission.type,
          targetValue: Number.parseInt(mission.targetValue, 10),
          ...(mission.type === 'ascension' && Number.isFinite(ascendsFromCritterId)
            ? { ascendsFromCritterId }
            : {}),
          ...(mission.type === 'opposing_knockouts' && knockoutCritterIds.length > 0
            ? { knockoutCritterIds }
            : {}),
          ...(mission.type === 'opposing_knockouts' && knockoutCritterIds.length === 0 && knockoutElements.length > 0
            ? { knockoutElements }
            : {}),
        };
      }),
    })),
  };
}

function createDefaultLevelDraft(): LevelDraft {
  return {
    requiredMissionCount: '0',
    hpDelta: '0',
    attackDelta: '0',
    defenseDelta: '0',
    speedDelta: '0',
    abilityUnlockIdsInput: '',
    missions: [],
  };
}

function getMissionTypeLabel(missionType: CritterMissionType): string {
  if (missionType === 'opposing_knockouts') {
    return 'Knock-out Critters';
  }
  if (missionType === 'ascension') {
    return 'Ascension';
  }
  return missionType;
}

function toKnockoutFilterValue(value: string): MissionDraft['knockoutFilter'] {
  if (value === 'elements' || value === 'critters') {
    return value;
  }
  return 'any';
}

function toggleTokenInList(values: string[], token: string): string[] {
  const safeValues = Array.isArray(values) ? values.filter((entry) => entry.trim().length > 0) : [];
  if (safeValues.includes(token)) {
    return safeValues.filter((entry) => entry !== token);
  }
  return [...safeValues, token];
}

function capitalizeToken(value: string): string {
  if (!value) {
    return value;
  }
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function validateDraftBeforeApply(draft: CritterDraft, critters: CritterDefinition[]): string | null {
  const draftCritterId = Number.parseInt(draft.id, 10);
  const knownCritterIds = new Set<number>(critters.map((entry) => entry.id));
  if (Number.isFinite(draftCritterId)) {
    knownCritterIds.add(draftCritterId);
  }

  for (let levelIndex = 0; levelIndex < draft.levels.length; levelIndex += 1) {
    const level = draft.levels[levelIndex];
    for (let missionIndex = 0; missionIndex < level.missions.length; missionIndex += 1) {
      const mission = level.missions[missionIndex];
      if (mission.type === 'ascension') {
        const sourceCritterId = Number.parseInt(mission.ascendsFromCritterId, 10);
        if (!Number.isFinite(sourceCritterId) || sourceCritterId < 1) {
          return `Level ${levelIndex + 1} mission ${missionIndex + 1} needs a "Critter" selection.`;
        }
        if (Number.isFinite(draftCritterId) && sourceCritterId === draftCritterId) {
          return `Level ${levelIndex + 1} mission ${missionIndex + 1} cannot ascend from itself.`;
        }
        if (!knownCritterIds.has(sourceCritterId)) {
          return `Level ${levelIndex + 1} mission ${missionIndex + 1} references unknown critter #${sourceCritterId}.`;
        }
      }

      if (mission.type === 'opposing_knockouts') {
        if (mission.knockoutElements.length > 0 && mission.knockoutCritterIds.length > 0) {
          return `Level ${levelIndex + 1} mission ${missionIndex + 1} must use either Element filters or Critter filters, not both.`;
        }
        for (const critterIdText of mission.knockoutCritterIds) {
          const critterId = Number.parseInt(critterIdText, 10);
          if (!Number.isFinite(critterId) || !knownCritterIds.has(critterId)) {
            return `Level ${levelIndex + 1} mission ${missionIndex + 1} includes unknown critter #${critterIdText}.`;
          }
        }
      }
    }
  }

  return null;
}
