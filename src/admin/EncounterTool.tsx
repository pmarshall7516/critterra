import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import type { CritterDefinition } from '@/game/critters/types';
import { sanitizeCritterDatabase } from '@/game/critters/schema';
import { sanitizeEncounterTableLibrary } from '@/game/encounters/schema';
import type { EncounterTableDefinition } from '@/game/encounters/types';
import { apiFetchJson } from '@/shared/apiClient';

interface CritterListResponse {
  ok: boolean;
  critters?: unknown;
  error?: string;
}

interface EncounterListResponse {
  ok: boolean;
  encounterTables?: unknown;
  error?: string;
}

interface EncounterSaveResponse {
  ok: boolean;
  error?: string;
}

interface EncounterEntryDraft {
  critterId: number;
  weightInput: string;
  minLevelInput: string;
  maxLevelInput: string;
}

interface EncounterTableDraft {
  id: string;
  entries: EncounterEntryDraft[];
}

const ENCOUNTER_ELEMENT_ACCENTS: Record<string, string> = {
  bloom: '#7dff9a',
  ember: '#ff8a65',
  tide: '#7bc8ff',
  gust: '#d9f6ff',
  stone: '#d7b98f',
  spark: '#ffe06c',
  shade: '#c5b7ff',
};

const ENCOUNTER_ELEMENT_LABELS: Record<string, string> = {
  bloom: 'BL',
  ember: 'EM',
  tide: 'TI',
  gust: 'GU',
  stone: 'ST',
  spark: 'SP',
  shade: 'SH',
};

export function EncounterTool() {
  const [critters, setCritters] = useState<CritterDefinition[]>([]);
  const [encounterTables, setEncounterTables] = useState<EncounterTableDefinition[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EncounterTableDraft>({ id: '', entries: [] });
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedTable = useMemo(
    () => encounterTables.find((table) => table.id === selectedTableId) ?? null,
    [encounterTables, selectedTableId],
  );

  const draftWeightTotal = useMemo(
    () =>
      draft.entries.reduce((sum, entry) => {
        const parsed = Number.parseFloat(entry.weightInput);
        if (!Number.isFinite(parsed)) {
          return sum;
        }
        return sum + Math.max(0, Math.min(1, parsed));
      }, 0),
    [draft.entries],
  );

  const hasDraftChanges = useMemo(() => {
    if (!selectedTable) {
      return draft.id.trim().length > 0 || draft.entries.length > 0;
    }
    return JSON.stringify(tableToDraft(selectedTable)) !== JSON.stringify(draft);
  }, [draft, selectedTable]);

  const filteredCritters = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    const sorted = [...critters].sort((left, right) => left.id - right.id);
    if (!query) {
      return sorted;
    }
    return sorted.filter(
      (critter) => critter.name.toLowerCase().includes(query) || String(critter.id).includes(query),
    );
  }, [critters, searchInput]);

  const critterById = useMemo(() => {
    const lookup = new Map<number, CritterDefinition>();
    for (const critter of critters) {
      lookup.set(critter.id, critter);
    }
    return lookup;
  }, [critters]);

  const selectedCritterIds = useMemo(() => new Set(draft.entries.map((entry) => entry.critterId)), [draft.entries]);
  const addableCritters = useMemo(
    () => filteredCritters.filter((critter) => !selectedCritterIds.has(critter.id)),
    [filteredCritters, selectedCritterIds],
  );

  const loadAll = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const [critterResult, encounterResult] = await Promise.all([
        apiFetchJson<CritterListResponse>('/api/admin/critters/list'),
        apiFetchJson<EncounterListResponse>('/api/admin/encounters/list'),
      ]);
      if (!critterResult.ok) {
        throw new Error(critterResult.error ?? critterResult.data?.error ?? 'Unable to load critters.');
      }
      if (!encounterResult.ok) {
        throw new Error(encounterResult.error ?? encounterResult.data?.error ?? 'Unable to load encounter tables.');
      }

      const loadedCritters = sanitizeCritterDatabase(critterResult.data?.critters);
      const loadedTables = sanitizeEncounterTableLibrary(encounterResult.data?.encounterTables);
      setCritters(loadedCritters);
      setEncounterTables(loadedTables);
      if (loadedTables.length > 0) {
        setSelectedTableId(loadedTables[0].id);
        setDraft(tableToDraft(loadedTables[0]));
      } else {
        const fallbackId = suggestEncounterId(loadedTables);
        setSelectedTableId(null);
        setDraft({ id: fallbackId, entries: [] });
      }
      setStatus(`Loaded ${loadedTables.length} encounter table(s) and ${loadedCritters.length} critter(s).`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load encounter data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTable = (table: EncounterTableDefinition) => {
    setSelectedTableId(table.id);
    setDraft(tableToDraft(table));
    setError('');
    setStatus(`Loaded encounter table "${table.id}".`);
  };

  const startNewTable = () => {
    setSelectedTableId(null);
    setDraft({
      id: suggestEncounterId(encounterTables),
      entries: [],
    });
    setError('');
    setStatus('Drafting a new encounter table.');
  };

  const addCritterToDraft = (critterId: number) => {
    if (draft.entries.some((entry) => entry.critterId === critterId)) {
      setError(`Critter #${critterId} is already in this encounter table.`);
      return;
    }

    const critter = critterById.get(critterId);
    const maxLevel = getMaxCritterLevel(critter);
    setDraft((current) => ({
      ...current,
      entries: [
        ...current.entries,
        {
          critterId,
          weightInput: '0.00',
          minLevelInput: '1',
          maxLevelInput: String(maxLevel),
        },
      ],
    }));
    setError('');
    setStatus(`Added critter #${critterId} with default weight 0.00 and level range 1-${maxLevel}.`);
  };

  const removeDraftEntry = (critterId: number) => {
    setDraft((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.critterId !== critterId),
    }));
  };

  const applyDraft = () => {
    const parsed = parseDraft(draft);
    if (!parsed) {
      setError('Encounter table draft is invalid. Check ID, weights, and level ranges.');
      return;
    }

    const existingIndex = selectedTableId ? encounterTables.findIndex((table) => table.id === selectedTableId) : -1;
    const duplicateIdIndex = encounterTables.findIndex((table) => table.id === parsed.id);
    if (duplicateIdIndex >= 0 && duplicateIdIndex !== existingIndex) {
      setError(`Encounter table ID "${parsed.id}" already exists.`);
      return;
    }

    const next =
      existingIndex >= 0
        ? encounterTables.map((table, index) => (index === existingIndex ? parsed : table))
        : [...encounterTables, parsed];
    next.sort((left, right) => left.id.localeCompare(right.id));

    setEncounterTables(next);
    setSelectedTableId(parsed.id);
    setDraft(tableToDraft(parsed));
    setError('');
    setStatus(`Applied encounter table "${parsed.id}". Save Encounter Tables to persist.`);
  };

  const removeSelected = () => {
    if (!selectedTableId) {
      setError('Select an encounter table to remove.');
      return;
    }
    const next = encounterTables.filter((table) => table.id !== selectedTableId);
    setEncounterTables(next);
    if (next.length > 0) {
      setSelectedTableId(next[0].id);
      setDraft(tableToDraft(next[0]));
    } else {
      setSelectedTableId(null);
      setDraft({ id: suggestEncounterId([]), entries: [] });
    }
    setError('');
    setStatus(`Removed encounter table "${selectedTableId}" from local list.`);
  };

  const saveEncounterTables = async () => {
    if (hasDraftChanges) {
      setError('Apply Draft before saving encounter tables.');
      return;
    }

    for (const table of encounterTables) {
      if (table.entries.length === 0) {
        setError(`Encounter table "${table.id}" must include at least one critter.`);
        return;
      }
      const totalWeight = table.entries.reduce((sum, entry) => sum + entry.weight, 0);
      if (Math.abs(totalWeight - 1) > 0.000001) {
        setError(`Encounter table "${table.id}" weights must total 1.0 (current ${totalWeight.toFixed(3)}).`);
        return;
      }
    }

    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<EncounterSaveResponse>('/api/admin/encounters/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encounterTables,
        }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save encounter tables.');
      }
      setStatus(`Saved ${encounterTables.length} encounter table(s) to database.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save encounter tables.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-layout admin-layout--single">
      <section className="admin-layout__left">
        <section className="admin-panel">
          <h3>Encounter Tables</h3>
          <div className="admin-row">
            <button type="button" className="secondary" onClick={() => void loadAll()} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Reload'}
            </button>
            <button type="button" className="secondary" onClick={startNewTable}>
              New Encounter Table
            </button>
            <button type="button" className="secondary" onClick={applyDraft}>
              Apply Draft
            </button>
            <button type="button" className="secondary" onClick={removeSelected} disabled={!selectedTableId}>
              Remove
            </button>
            <button type="button" className="primary" onClick={() => void saveEncounterTables()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Encounter Tables'}
            </button>
          </div>
          <p className="admin-note">Each table must have unique critters and weights that sum to exactly 1.0.</p>
          {status && <p className="admin-note">{status}</p>}
          {error && <p className="admin-note" style={{ color: '#f7b9b9' }}>{error}</p>}
          <div className="saved-paint-list">
            {encounterTables.map((table) => (
              <button
                key={table.id}
                type="button"
                className={`secondary ${selectedTableId === table.id ? 'is-selected' : ''}`}
                onClick={() => selectTable(table)}
              >
                {table.id} ({table.entries.length})
              </button>
            ))}
            {encounterTables.length === 0 && <p className="admin-note">No encounter tables yet.</p>}
          </div>
        </section>

        <section className="admin-panel">
          <h3>Encounter Draft</h3>
          <div className="admin-grid-2">
            <label>
              Encounter Table ID
              <input
                value={draft.id}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    id: event.target.value,
                  }))
                }
                placeholder="starter-critter"
              />
            </label>
            <label>
              Weight Total
              <input value={draftWeightTotal.toFixed(4)} readOnly />
            </label>
          </div>

          <h4>Current Entries</h4>
          <p className="admin-note">
            Optional level range: when set, wild levels are sampled from this critter&apos;s implemented levels inside Min/Max.
          </p>
          <div className="encounter-current-grid">
            {draft.entries.map((entry) => {
              const critter = critterById.get(entry.critterId);
              return (
                <article key={`entry-${entry.critterId}`} className="encounter-entry-card">
                  <p className="encounter-entry-card__name">
                    #{entry.critterId} {critter?.name ?? 'Unknown Critter'}
                  </p>
                  <div className="encounter-entry-card__fields">
                    <label>
                      Wt
                      <input
                        value={entry.weightInput}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            entries: current.entries.map((row) =>
                              row.critterId === entry.critterId ? { ...row, weightInput: event.target.value } : row,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Min Lv
                      <input
                        value={entry.minLevelInput}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            entries: current.entries.map((row) =>
                              row.critterId === entry.critterId ? { ...row, minLevelInput: event.target.value } : row,
                            ),
                          }))
                        }
                        placeholder="auto"
                      />
                    </label>
                    <label>
                      Max Lv
                      <input
                        value={entry.maxLevelInput}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            entries: current.entries.map((row) =>
                              row.critterId === entry.critterId ? { ...row, maxLevelInput: event.target.value } : row,
                            ),
                          }))
                        }
                        placeholder="auto"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="secondary encounter-entry-card__remove"
                    onClick={() => removeDraftEntry(entry.critterId)}
                  >
                    Remove
                  </button>
                </article>
              );
            })}
            {draft.entries.length === 0 && <p className="admin-note">No critters in this table yet.</p>}
          </div>

          <h4>Add Critter</h4>
          <label className="encounter-search-field">
            Search Critter (Name or ID)
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="buddo or 1"
            />
          </label>
          <div className="encounter-candidate-grid">
            {addableCritters.map((critter) => {
              const maxLevel = getMaxCritterLevel(critter);
              return (
                <article
                  key={`candidate-${critter.id}`}
                  className="encounter-candidate-card"
                  style={encounterCandidateCardStyle(critter.element)}
                >
                  <header className="encounter-candidate-card__header">
                    <span className="encounter-candidate-card__element" title={critter.element}>
                      {ENCOUNTER_ELEMENT_LABELS[critter.element] ?? '??'}
                    </span>
                    <div className="encounter-candidate-card__title">
                      <p className="encounter-candidate-card__id">#{critter.id}</p>
                      <h5>{critter.name}</h5>
                      <p className="encounter-candidate-card__rarity">{critter.rarity}</p>
                    </div>
                  </header>
                  {critter.spriteUrl ? (
                    <img src={critter.spriteUrl} alt={critter.name} className="encounter-candidate-card__sprite" loading="lazy" />
                  ) : (
                    <div className="encounter-candidate-card__sprite encounter-candidate-card__sprite--missing">No Sprite</div>
                  )}
                  <div className="encounter-candidate-card__meta">
                    <span>Levels 1-{maxLevel}</span>
                    <span>{critter.element.toUpperCase()}</span>
                  </div>
                  <div className="encounter-candidate-card__stats">
                    <span>HP {critter.baseStats.hp}</span>
                    <span>ATK {critter.baseStats.attack}</span>
                    <span>DEF {critter.baseStats.defense}</span>
                    <span>SPD {critter.baseStats.speed}</span>
                  </div>
                  <button
                    type="button"
                    className="primary encounter-candidate-card__add"
                    onClick={() => addCritterToDraft(critter.id)}
                  >
                    Add To Table
                  </button>
                </article>
              );
            })}
            {addableCritters.length === 0 && (
              <p className="admin-note">
                {filteredCritters.length === 0
                  ? 'No critters match that search.'
                  : 'All matching critters are already in the current encounter table.'}
              </p>
            )}
          </div>
        </section>
      </section>
    </section>
  );
}

function tableToDraft(table: EncounterTableDefinition): EncounterTableDraft {
  return {
    id: table.id,
    entries: table.entries.map((entry) => ({
      critterId: entry.critterId,
      weightInput: entry.weight.toFixed(2),
      minLevelInput: typeof entry.minLevel === 'number' ? String(entry.minLevel) : '',
      maxLevelInput: typeof entry.maxLevel === 'number' ? String(entry.maxLevel) : '',
    })),
  };
}

function parseDraft(draft: EncounterTableDraft): EncounterTableDefinition | null {
  const id = sanitizeEncounterId(draft.id);
  if (!id) {
    return null;
  }
  const seen = new Set<number>();
  const entries: EncounterTableDefinition['entries'] = [];
  for (const entry of draft.entries) {
    if (seen.has(entry.critterId)) {
      return null;
    }
    seen.add(entry.critterId);

    const parsedWeight = Number.parseFloat(entry.weightInput);
    if (!Number.isFinite(parsedWeight)) {
      return null;
    }
    const minLevel = parseLevelInput(entry.minLevelInput);
    const maxLevel = parseLevelInput(entry.maxLevelInput);
    if (minLevel === undefined || maxLevel === undefined) {
      return null;
    }
    const normalizedMin =
      minLevel !== null && maxLevel !== null && minLevel > maxLevel ? maxLevel : minLevel;
    const normalizedMax =
      minLevel !== null && maxLevel !== null && minLevel > maxLevel ? minLevel : maxLevel;
    const weight = Math.round(Math.max(0, Math.min(1, parsedWeight)) * 1000000) / 1000000;
    entries.push({
      critterId: entry.critterId,
      weight,
      minLevel: normalizedMin,
      maxLevel: normalizedMax,
    });
  }
  return {
    id,
    entries,
  };
}

function parseLevelInput(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.max(1, Math.min(99, Math.floor(parsed)));
}

function encounterCandidateCardStyle(element: string): CSSProperties {
  return {
    '--encounter-accent': ENCOUNTER_ELEMENT_ACCENTS[element] ?? '#7bc8ff',
  } as CSSProperties;
}

function getMaxCritterLevel(critter: CritterDefinition | undefined): number {
  if (!critter || critter.levels.length === 0) {
    return 1;
  }
  return Math.max(1, ...critter.levels.map((level) => Math.max(1, level.level)));
}

function sanitizeEncounterId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function suggestEncounterId(current: EncounterTableDefinition[]): string {
  const used = new Set(current.map((table) => table.id));
  let index = 1;
  let candidate = 'encounter-table-1';
  while (used.has(candidate)) {
    index += 1;
    candidate = `encounter-table-${index}`;
  }
  return candidate;
}
