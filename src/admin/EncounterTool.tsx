import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import type { CritterDefinition } from '@/game/critters/types';
import { sanitizeCritterDatabase } from '@/game/critters/schema';
import { sanitizeEncounterTableLibrary } from '@/game/encounters/schema';
import type { EncounterTableDefinition } from '@/game/encounters/types';
import type { GameItemDefinition } from '@/game/items/types';
import { sanitizeItemCatalog } from '@/game/items/schema';
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

interface ItemListResponse {
  ok: boolean;
  items?: unknown;
  error?: string;
}

interface EncounterSaveResponse {
  ok: boolean;
  error?: string;
}

type EncounterDraftEntryKind = 'critter' | 'item';

interface EncounterEntryDraft {
  rowId: string;
  kind: EncounterDraftEntryKind;
  critterId: number | null;
  itemId: string;
  weightInput: string;
  minValueInput: string;
  maxValueInput: string;
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
  shade: '#b8a0e0',
  normal: '#b0b0b0',
};

const ENCOUNTER_ELEMENT_LABELS: Record<string, string> = {
  bloom: 'BL',
  ember: 'EM',
  tide: 'TI',
  gust: 'GU',
  stone: 'ST',
  spark: 'SP',
  shade: 'SH',
  normal: 'NO',
};

export function EncounterTool() {
  const [critters, setCritters] = useState<CritterDefinition[]>([]);
  const [items, setItems] = useState<GameItemDefinition[]>([]);
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
    return toComparableDraftJson(tableToDraft(selectedTable)) !== toComparableDraftJson(draft);
  }, [draft, selectedTable]);

  const sortedCritters = useMemo(() => [...critters].sort((left, right) => left.id - right.id), [critters]);
  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
    [items],
  );

  const filteredCritters = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query) {
      return sortedCritters;
    }
    return sortedCritters.filter(
      (critter) => critter.name.toLowerCase().includes(query) || String(critter.id).includes(query),
    );
  }, [searchInput, sortedCritters]);

  const filteredItems = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query) {
      return sortedItems;
    }
    return sortedItems.filter(
      (item) =>
        item.id.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query),
    );
  }, [searchInput, sortedItems]);

  const critterById = useMemo(() => {
    const lookup = new Map<number, CritterDefinition>();
    for (const critter of critters) {
      lookup.set(critter.id, critter);
    }
    return lookup;
  }, [critters]);

  const itemById = useMemo(() => {
    const lookup = new Map<string, GameItemDefinition>();
    for (const item of items) {
      lookup.set(item.id, item);
    }
    return lookup;
  }, [items]);

  const loadAll = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const [critterResult, itemResult, encounterResult] = await Promise.all([
        apiFetchJson<CritterListResponse>('/api/admin/critters/list'),
        apiFetchJson<ItemListResponse>('/api/admin/items/list'),
        apiFetchJson<EncounterListResponse>('/api/admin/encounters/list'),
      ]);
      if (!critterResult.ok) {
        throw new Error(critterResult.error ?? critterResult.data?.error ?? 'Unable to load critters.');
      }
      if (!itemResult.ok) {
        throw new Error(itemResult.error ?? itemResult.data?.error ?? 'Unable to load items.');
      }
      if (!encounterResult.ok) {
        throw new Error(encounterResult.error ?? encounterResult.data?.error ?? 'Unable to load encounter tables.');
      }

      const loadedCritters = sanitizeCritterDatabase(critterResult.data?.critters);
      const loadedItems = sanitizeItemCatalog(itemResult.data?.items);
      const loadedTables = sanitizeEncounterTableLibrary(encounterResult.data?.encounterTables);
      setCritters(loadedCritters);
      setItems(loadedItems);
      setEncounterTables(loadedTables);
      if (loadedTables.length > 0) {
        setSelectedTableId(loadedTables[0].id);
        setDraft(tableToDraft(loadedTables[0]));
      } else {
        const fallbackId = suggestEncounterId(loadedTables);
        setSelectedTableId(null);
        setDraft({ id: fallbackId, entries: [] });
      }
      setStatus(
        `Loaded ${loadedTables.length} encounter table(s), ${loadedCritters.length} critter(s), and ${loadedItems.length} item(s).`,
      );
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
    const critter = critterById.get(critterId);
    const maxLevel = getMaxCritterLevel(critter);
    setDraft((current) => ({
      ...current,
      entries: [
        ...current.entries,
        {
          rowId: createDraftRowId(),
          kind: 'critter',
          critterId,
          itemId: '',
          weightInput: '0',
          minValueInput: '1',
          maxValueInput: String(maxLevel),
        },
      ],
    }));
    setError('');
    setStatus(`Added critter #${critterId} row with weight 0 and level range 1-${maxLevel}.`);
  };

  const addItemToDraft = (itemId: string) => {
    const item = itemById.get(itemId);
    if (!item) {
      setError('Choose a valid item.');
      return;
    }
    setDraft((current) => ({
      ...current,
      entries: [
        ...current.entries,
        {
          rowId: createDraftRowId(),
          kind: 'item',
          critterId: null,
          itemId,
          weightInput: '0',
          minValueInput: '1',
          maxValueInput: '1',
        },
      ],
    }));
    setError('');
    setStatus(`Added item row for "${item.name}" with weight 0 and amount range 1-1.`);
  };

  const updateDraftEntry = (rowId: string, patch: Partial<EncounterEntryDraft>) => {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry) => (entry.rowId === rowId ? { ...entry, ...patch } : entry)),
    }));
  };

  const updateDraftEntryKind = (rowId: string, nextKind: EncounterDraftEntryKind) => {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.rowId !== rowId || entry.kind === nextKind) {
          return entry;
        }
        if (nextKind === 'item') {
          return {
            ...entry,
            kind: 'item',
            critterId: null,
            itemId: sortedItems[0]?.id ?? '',
            minValueInput: '1',
            maxValueInput: '1',
          };
        }
        const fallbackCritter = sortedCritters[0];
        const maxLevel = getMaxCritterLevel(fallbackCritter);
        return {
          ...entry,
          kind: 'critter',
          critterId: fallbackCritter?.id ?? 1,
          itemId: '',
          minValueInput: '1',
          maxValueInput: String(maxLevel),
        };
      }),
    }));
  };

  const removeDraftEntry = (rowId: string) => {
    setDraft((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.rowId !== rowId),
    }));
  };

  const applyDraft = () => {
    const parsed = parseDraft(draft, {
      allowedCritterIds: new Set(critters.map((critter) => critter.id)),
      allowedItemIds: new Set(items.map((item) => item.id)),
    });
    if (!parsed) {
      setError('Encounter table draft is invalid. Check ID, weights, critter/item rows, and ranges.');
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
        setError(`Encounter table "${table.id}" must include at least one entry.`);
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
          <p className="admin-note">Entries can be critters or items. Duplicate rows are allowed. Weights must sum to 1.0.</p>
          {status && <p className="admin-note">{status}</p>}
          {error && (
            <p className="admin-note" style={{ color: '#f7b9b9' }}>
              {error}
            </p>
          )}
          <div className="admin-item-grid">
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
          <p className="admin-note">Critter rows use level ranges. Item rows use amount ranges.</p>
          <div className="encounter-current-grid">
            {draft.entries.map((entry) => {
              const critter = entry.kind === 'critter' && entry.critterId !== null ? critterById.get(entry.critterId) : null;
              const item = entry.kind === 'item' ? itemById.get(entry.itemId) : null;
              const rangeLabelMin = entry.kind === 'critter' ? 'Min Lv' : 'Min Amt';
              const rangeLabelMax = entry.kind === 'critter' ? 'Max Lv' : 'Max Amt';
              return (
                <article key={entry.rowId} className="encounter-entry-card">
                  <p className="encounter-entry-card__name">
                    {entry.kind === 'critter'
                      ? `Critter: #${entry.critterId ?? '?'} ${critter?.name ?? 'Unknown Critter'}`
                      : `Item: ${item?.name ?? entry.itemId ?? 'Unknown Item'}`}
                  </p>
                  <div className="encounter-entry-card__fields">
                    <label>
                      Type
                      <select
                        value={entry.kind}
                        onChange={(event) => updateDraftEntryKind(entry.rowId, event.target.value as EncounterDraftEntryKind)}
                      >
                        <option value="critter">Critter</option>
                        <option value="item">Item</option>
                      </select>
                    </label>
                    {entry.kind === 'critter' ? (
                      <label>
                        Critter
                        <select
                          value={entry.critterId ?? ''}
                          onChange={(event) => {
                            const nextId = Number.parseInt(event.target.value, 10);
                            const maxLevel = getMaxCritterLevel(critterById.get(nextId));
                            updateDraftEntry(entry.rowId, {
                              critterId: Number.isFinite(nextId) ? nextId : null,
                              minValueInput: '1',
                              maxValueInput: String(maxLevel),
                            });
                          }}
                        >
                          {sortedCritters.map((candidate) => (
                            <option key={`row-${entry.rowId}-critter-${candidate.id}`} value={candidate.id}>
                              #{candidate.id} {candidate.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label>
                        Item
                        <select
                          value={entry.itemId}
                          onChange={(event) => updateDraftEntry(entry.rowId, { itemId: event.target.value })}
                        >
                          {sortedItems.map((candidate) => (
                            <option key={`row-${entry.rowId}-item-${candidate.id}`} value={candidate.id}>
                              {candidate.name} ({candidate.id})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Wt
                      <input
                        value={entry.weightInput}
                        onChange={(event) => updateDraftEntry(entry.rowId, { weightInput: event.target.value })}
                      />
                    </label>
                    <label>
                      {rangeLabelMin}
                      <input
                        value={entry.minValueInput}
                        onChange={(event) => updateDraftEntry(entry.rowId, { minValueInput: event.target.value })}
                        placeholder="auto"
                      />
                    </label>
                    <label>
                      {rangeLabelMax}
                      <input
                        value={entry.maxValueInput}
                        onChange={(event) => updateDraftEntry(entry.rowId, { maxValueInput: event.target.value })}
                        placeholder="auto"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="secondary encounter-entry-card__remove"
                    onClick={() => removeDraftEntry(entry.rowId)}
                  >
                    Remove
                  </button>
                </article>
              );
            })}
            {draft.entries.length === 0 && <p className="admin-note">No entries in this table yet.</p>}
          </div>

          <h4>Add Encounter Row</h4>
          <label className="encounter-search-field">
            Search Critters / Items (Name or ID)
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="buddo, old-rod, 1"
            />
          </label>

          <h5>Critter Rows</h5>
          <div className="encounter-candidate-grid">
            {filteredCritters.map((critter) => {
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
                    Add Critter Row
                  </button>
                </article>
              );
            })}
            {filteredCritters.length === 0 && <p className="admin-note">No critters match that search.</p>}
          </div>

          <h5>Item Rows</h5>
          <div className="admin-item-grid">
            {filteredItems.map((item) => (
              <article key={`item-candidate-${item.id}`} className="encounter-entry-card">
                <p className="encounter-entry-card__name">{item.name}</p>
                <p className="admin-note">
                  {item.id} | {item.category}
                </p>
                <button type="button" className="primary" onClick={() => addItemToDraft(item.id)}>
                  Add Item Row
                </button>
              </article>
            ))}
            {filteredItems.length === 0 && <p className="admin-note">No items match that search.</p>}
          </div>
        </section>
      </section>
    </section>
  );
}

function tableToDraft(table: EncounterTableDefinition): EncounterTableDraft {
  return {
    id: table.id,
    entries: table.entries.map((entry, index) => {
      if (entry.kind === 'item') {
        return {
          rowId: `row-${index + 1}`,
          kind: 'item',
          critterId: null,
          itemId: entry.itemId,
          weightInput: String(entry.weight),
          minValueInput: typeof entry.minAmount === 'number' ? String(entry.minAmount) : '',
          maxValueInput: typeof entry.maxAmount === 'number' ? String(entry.maxAmount) : '',
        };
      }
      return {
        rowId: `row-${index + 1}`,
        kind: 'critter',
        critterId: entry.critterId,
        itemId: '',
        weightInput: String(entry.weight),
        minValueInput: typeof entry.minLevel === 'number' ? String(entry.minLevel) : '',
        maxValueInput: typeof entry.maxLevel === 'number' ? String(entry.maxLevel) : '',
      };
    }),
  };
}

function parseDraft(
  draft: EncounterTableDraft,
  options: { allowedCritterIds: Set<number>; allowedItemIds: Set<string> },
): EncounterTableDefinition | null {
  const id = sanitizeEncounterId(draft.id);
  if (!id) {
    return null;
  }

  const entries: EncounterTableDefinition['entries'] = [];
  for (const entry of draft.entries) {
    const parsedWeight = Number.parseFloat(entry.weightInput);
    if (!Number.isFinite(parsedWeight)) {
      return null;
    }
    const weight = Math.max(0, Math.min(1, parsedWeight));

    if (entry.kind === 'item') {
      const itemId = sanitizeItemId(entry.itemId);
      if (!itemId || !options.allowedItemIds.has(itemId)) {
        return null;
      }
      const minAmount = parseAmountInput(entry.minValueInput);
      const maxAmount = parseAmountInput(entry.maxValueInput);
      if (minAmount === undefined || maxAmount === undefined) {
        return null;
      }
      const normalizedMin =
        minAmount !== null && maxAmount !== null && minAmount > maxAmount ? maxAmount : minAmount;
      const normalizedMax =
        minAmount !== null && maxAmount !== null && minAmount > maxAmount ? minAmount : maxAmount;
      entries.push({
        kind: 'item',
        itemId,
        weight,
        minAmount: normalizedMin,
        maxAmount: normalizedMax,
      });
      continue;
    }

    if (entry.critterId === null || !Number.isInteger(entry.critterId) || !options.allowedCritterIds.has(entry.critterId)) {
      return null;
    }
    const minLevel = parseLevelInput(entry.minValueInput);
    const maxLevel = parseLevelInput(entry.maxValueInput);
    if (minLevel === undefined || maxLevel === undefined) {
      return null;
    }
    const normalizedMin =
      minLevel !== null && maxLevel !== null && minLevel > maxLevel ? maxLevel : minLevel;
    const normalizedMax =
      minLevel !== null && maxLevel !== null && minLevel > maxLevel ? minLevel : maxLevel;
    entries.push({
      kind: 'critter',
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

function parseAmountInput(value: string): number | null | undefined {
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
  return Math.max(1, Math.min(9999, Math.floor(parsed)));
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

function sanitizeItemId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
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

function createDraftRowId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toComparableDraftJson(draft: EncounterTableDraft): string {
  return JSON.stringify({
    id: draft.id.trim(),
    entries: draft.entries.map((entry) => ({
      kind: entry.kind,
      critterId: entry.critterId,
      itemId: entry.itemId,
      weightInput: entry.weightInput,
      minValueInput: entry.minValueInput,
      maxValueInput: entry.maxValueInput,
    })),
  });
}
