import { useEffect, useMemo, useState } from 'react';
import { sanitizeItemCatalog, sanitizeItemDefinition } from '@/game/items/schema';
import { ITEM_CORE_CATEGORIES, ITEM_EFFECT_TYPES, type GameItemDefinition } from '@/game/items/types';
import { apiFetchJson } from '@/shared/apiClient';

interface ItemListResponse {
  ok: boolean;
  items?: unknown;
  error?: string;
}

interface ItemSaveResponse {
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

interface ItemDraft {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  misuseText: string;
  successText: string;
  effectType: string;
  effectConfigJson: string;
  valueInput: string;
  consumable: boolean;
  maxStack: string;
  isActive: boolean;
  starterGrantAmount: string;
}

const DEFAULT_ITEM_BUCKET = 'items';

export function ItemTool() {
  const [items, setItems] = useState<GameItemDefinition[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemDraft>(() => createEmptyDraft([]));
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bucketInput, setBucketInput] = useState(DEFAULT_ITEM_BUCKET);
  const [prefixInput, setPrefixInput] = useState('');
  const [itemSearchInput, setItemSearchInput] = useState('');
  const [imageSearchInput, setImageSearchInput] = useState('');
  const [selectedImagePath, setSelectedImagePath] = useState('');
  const [imageEntries, setImageEntries] = useState<SupabaseSpriteSheetListItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
    [items],
  );

  const selectedItem = useMemo(
    () => items.find((entry) => entry.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const hasDraftChanges = useMemo(() => {
    if (!selectedItem) {
      return true;
    }
    return JSON.stringify(itemToDraft(selectedItem)) !== JSON.stringify(draft);
  }, [selectedItem, draft]);

  const categoryOptions = useMemo(() => {
    const dynamic = new Set<string>(ITEM_CORE_CATEGORIES);
    for (const item of items) {
      dynamic.add(item.category);
    }
    return [...dynamic].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
  }, [items]);

  const filteredImageEntries = useMemo(() => {
    const query = imageSearchInput.trim().toLowerCase();
    const sorted = [...imageEntries].sort((left, right) =>
      left.path.localeCompare(right.path, undefined, { sensitivity: 'base' }),
    );
    if (!query) {
      return sorted;
    }
    return sorted.filter(
      (entry) => entry.path.toLowerCase().includes(query) || entry.name.toLowerCase().includes(query),
    );
  }, [imageEntries, imageSearchInput]);

  const loadItems = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<ItemListResponse>('/api/admin/items/list');
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load item catalog.');
      }
      const loadedItems = sanitizeItemCatalog(result.data?.items);
      setItems(loadedItems);
      setPendingRemovalIds(new Set());
      if (loadedItems.length > 0) {
        setSelectedItemId(loadedItems[0].id);
        setDraft(itemToDraft(loadedItems[0]));
      } else {
        setSelectedItemId(null);
        setDraft(createEmptyDraft(loadedItems));
      }
      setStatus(`Loaded ${loadedItems.length} item definition(s).`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load item catalog.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadImages = async () => {
    const bucket = bucketInput.trim() || DEFAULT_ITEM_BUCKET;
    const prefix = prefixInput.trim();
    const params = new URLSearchParams();
    params.set('bucket', bucket);
    if (prefix) {
      params.set('prefix', prefix);
    }
    setIsLoadingImages(true);
    setError('');
    try {
      const result = await apiFetchJson<LoadSupabaseSpriteSheetsResponse>(
        `/api/admin/spritesheets/list?${params.toString()}`,
      );
      if (!result.ok || !result.data?.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load item images from Supabase.');
      }
      const entries = Array.isArray(result.data.spritesheets) ? result.data.spritesheets : [];
      setImageEntries(entries);
      setStatus(`Loaded ${entries.length} item image(s) from bucket "${bucket}".`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load item images from Supabase.');
    } finally {
      setIsLoadingImages(false);
    }
  };

  useEffect(() => {
    void loadItems();
    void loadImages();
    // Run once on mount with defaults.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draft.imageUrl) {
      return;
    }
    const matchingEntry = imageEntries.find(
      (entry) => normalizeAssetUrlForCompare(entry.publicUrl) === normalizeAssetUrlForCompare(draft.imageUrl),
    );
    if (matchingEntry) {
      setSelectedImagePath(matchingEntry.path);
    }
  }, [draft.imageUrl, imageEntries]);

  const selectItem = (item: GameItemDefinition) => {
    setSelectedItemId(item.id);
    setDraft(itemToDraft(item));
    const matchingEntry = imageEntries.find(
      (entry) => normalizeAssetUrlForCompare(entry.publicUrl) === normalizeAssetUrlForCompare(item.imageUrl),
    );
    setSelectedImagePath(matchingEntry?.path ?? '');
    setError('');
    setStatus(`Loaded item "${item.name}".`);
  };

  const startNewDraft = () => {
    setSelectedItemId(null);
    setDraft(createEmptyDraft(items));
    setSelectedImagePath('');
    setError('');
    setStatus('Drafting a new item entry.');
  };

  const togglePendingRemoval = (itemId: string) => {
    setPendingRemovalIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
    setError('');
    setStatus(
      pendingRemovalIds.has(itemId)
        ? `Restored item "${itemId}". Save Item Database to persist.`
        : `Marked item "${itemId}" for removal. Save Item Database to commit.`,
    );
  };

  const applyDraft = () => {
    setError('');
    setStatus('');

    const parsedEffectConfig = parseEffectConfigJson(draft.effectConfigJson);
    if (!parsedEffectConfig.ok) {
      setError(parsedEffectConfig.error);
      return;
    }

    const parsedValue = parseOptionalNumberInput(draft.valueInput);
    const syncedEffectConfig = syncEffectConfigWithValue(draft.effectType, parsedEffectConfig.value, parsedValue);

    const parsed = sanitizeItemDefinition(
      {
        id: draft.id,
        name: draft.name,
        category: draft.category,
        description: draft.description,
        imageUrl: draft.imageUrl,
        misuseText: draft.misuseText,
        successText: draft.successText,
        effectType: draft.effectType,
        effectConfig: syncedEffectConfig,
        value: parsedValue,
        consumable: draft.consumable,
        maxStack: Number.parseInt(draft.maxStack, 10),
        isActive: draft.isActive,
        starterGrantAmount: Number.parseInt(draft.starterGrantAmount, 10),
      },
      items.length,
    );
    if (!parsed) {
      setError('Draft is invalid.');
      return;
    }

    const existingIndex = selectedItemId === null ? -1 : items.findIndex((entry) => entry.id === selectedItemId);
    const duplicateExists = items.some((entry, index) => entry.id === parsed.id && index !== existingIndex);
    if (duplicateExists) {
      setError(`Item ID "${parsed.id}" already exists.`);
      return;
    }

    const nextItems = [...items];
    if (existingIndex >= 0) {
      nextItems[existingIndex] = parsed;
    } else {
      nextItems.push(parsed);
    }

    setItems(nextItems);
    setSelectedItemId(parsed.id);
    setDraft(itemToDraft(parsed));
    setPendingRemovalIds((current) => {
      const next = new Set(current);
      next.delete(parsed.id);
      if (selectedItemId) {
        next.delete(selectedItemId);
      }
      return next;
    });
    setStatus(`Applied item "${parsed.name}". Save Item Database to persist.`);
  };

  const saveItems = async () => {
    const selectedPendingRemoval = selectedItemId !== null && pendingRemovalIds.has(selectedItemId);
    if (hasDraftChanges && !selectedPendingRemoval) {
      setError('Apply Draft before saving.');
      return;
    }

    const itemsToPersist = items.filter((entry) => !pendingRemovalIds.has(entry.id));
    const removedCount = items.length - itemsToPersist.length;
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<ItemSaveResponse>('/api/admin/items/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: itemsToPersist,
        }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save item catalog.');
      }

      setItems(itemsToPersist);
      setPendingRemovalIds(new Set());
      const nextSelected = selectedItemId
        ? itemsToPersist.find((entry) => entry.id === selectedItemId) ?? itemsToPersist[0] ?? null
        : itemsToPersist[0] ?? null;
      if (nextSelected) {
        setSelectedItemId(nextSelected.id);
        setDraft(itemToDraft(nextSelected));
      } else {
        setSelectedItemId(null);
        setDraft(createEmptyDraft(itemsToPersist));
      }
      setStatus(
        removedCount > 0
          ? `Saved ${itemsToPersist.length} item definition(s). Removed ${removedCount} item(s).`
          : `Saved ${itemsToPersist.length} item definition(s) to database.`,
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save item catalog.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-layout admin-layout--critter-tool">
      <section className="admin-panel critter-database-panel">
        <h3>Item Database</h3>
        <div className="admin-row">
          <button type="button" className="secondary" onClick={() => void loadItems()} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Reload'}
          </button>
          <button type="button" className="secondary" onClick={startNewDraft}>
            New Item
          </button>
          <button type="button" className="secondary" onClick={applyDraft}>
            Apply Draft
          </button>
          <button type="button" className="primary" onClick={() => void saveItems()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Item Database'}
          </button>
        </div>
        <p className="admin-note">Item IDs must be unique and stable (e.g. old-rod, field-bandage).</p>
        {pendingRemovalIds.size > 0 && (
          <p className="admin-note">{pendingRemovalIds.size} item(s) marked for removal. Save to commit.</p>
        )}
        {status && <p className="admin-note">{status}</p>}
        {error && (
          <p className="admin-note" style={{ color: '#f7b9b9' }}>
            {error}
          </p>
        )}
        <div className="admin-row">
          <label>
            Search
            <input
              value={itemSearchInput}
              onChange={(event) => setItemSearchInput(event.target.value)}
              placeholder="Search item ID, name, category"
            />
          </label>
        </div>
        <div className="critter-database-list">
          {sortedItems
            .filter((item) => {
              const query = itemSearchInput.trim().toLowerCase();
              if (!query) {
                return true;
              }
              return (
                item.id.toLowerCase().includes(query) ||
                item.name.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query)
              );
            })
            .map((item) => {
              const isSelected = selectedItemId === item.id;
              const isPendingRemoval = pendingRemovalIds.has(item.id);
              return (
                <article
                  key={`item-${item.id}`}
                  className={`critter-db-card ${isSelected ? 'is-selected' : ''} ${isPendingRemoval ? 'is-pending-remove' : ''}`}
                >
                  <button type="button" className="critter-db-card__select" onClick={() => selectItem(item)}>
                    <div className="critter-db-card__header">
                      <span className="critter-db-card__id">{item.id}</span>
                      <span className="critter-db-card__name">{item.name}</span>
                    </div>
                    <p className="critter-db-card__meta">
                      {item.category}
                      {isPendingRemoval ? ' | pending remove' : ''}
                    </p>
                    <div className="critter-db-card__stats">
                      <span>{item.effectType}</span>
                      <span>{item.consumable ? 'Consumable' : 'Reusable'}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="secondary critter-db-card__remove"
                    onClick={() => togglePendingRemoval(item.id)}
                  >
                    {isPendingRemoval ? 'Undo' : 'Remove'}
                  </button>
                </article>
              );
            })}
        </div>
      </section>

      <section className="admin-panel admin-panel--grow critter-editor-panel">
        <h3>Item Editor</h3>

        <section className="critter-editor-group">
          <h4>Basic Info</h4>
          <div className="admin-grid-2">
            <label>
              Item ID
              <input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
            </label>
            <label>
              Name
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              Category
              <select
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Effect Type
              <select
                value={draft.effectType}
                onChange={(event) => setDraft((current) => ({ ...current, effectType: event.target.value }))}
              >
                {ITEM_EFFECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Value (Optional Number)
              <input
                type="number"
                step="any"
                value={draft.valueInput}
                onChange={(event) => setDraft((current) => ({ ...current, valueInput: event.target.value }))}
                placeholder="heal_flat: healAmount | tool_action: power"
              />
            </label>
          </div>

          <label>
            Description
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              rows={3}
            />
          </label>
          <label>
            Misuse Text
            <textarea
              value={draft.misuseText}
              onChange={(event) => setDraft((current) => ({ ...current, misuseText: event.target.value }))}
              rows={2}
            />
          </label>
          <label>
            Success Text (Optional)
            <textarea
              value={draft.successText}
              onChange={(event) => setDraft((current) => ({ ...current, successText: event.target.value }))}
              rows={2}
              placeholder="<Critter> was healed by X HP!"
            />
          </label>
        </section>

        <section className="critter-editor-group">
          <h4>Image (Supabase bucket: items)</h4>
          <div className="admin-grid-2">
            <label>
              Image URL
              <input
                value={draft.imageUrl}
                onChange={(event) => {
                  setSelectedImagePath('');
                  setDraft((current) => ({ ...current, imageUrl: event.target.value }));
                }}
                placeholder="https://..."
              />
            </label>
            <label>
              Active Image
              <input value={selectedImagePath || (draft.imageUrl ? 'Manual URL set' : 'None')} readOnly />
            </label>
          </div>
          <div className="admin-grid-2">
            <label>
              Bucket
              <input value={bucketInput} onChange={(event) => setBucketInput(event.target.value)} />
            </label>
            <label>
              Prefix (Optional)
              <input value={prefixInput} onChange={(event) => setPrefixInput(event.target.value)} />
            </label>
          </div>
          <div className="admin-row">
            <label>
              Search Bucket Images
              <input
                value={imageSearchInput}
                onChange={(event) => setImageSearchInput(event.target.value)}
                placeholder="Search by file name or path"
              />
            </label>
            <button type="button" className="secondary" onClick={() => void loadImages()} disabled={isLoadingImages}>
              {isLoadingImages ? 'Loading...' : 'Reload Bucket'}
            </button>
          </div>
          <div className="spritesheet-browser">
            {filteredImageEntries.length === 0 && (
              <p className="admin-note">{isLoadingImages ? 'Loading item images...' : 'No PNG item images found.'}</p>
            )}
            {filteredImageEntries.map((entry) => (
              <div
                key={`item-image-${entry.path}`}
                className={`spritesheet-browser__row ${selectedImagePath === entry.path ? 'is-selected' : ''}`}
              >
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setSelectedImagePath(entry.path);
                    setDraft((current) => ({
                      ...current,
                      imageUrl: entry.publicUrl,
                    }));
                    setStatus(`Loaded item image "${entry.path}" from Supabase.`);
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
          <h4>Behavior</h4>
          <div className="admin-grid-2">
            <label>
              Max Stack
              <input
                type="number"
                min={1}
                value={draft.maxStack}
                onChange={(event) => setDraft((current) => ({ ...current, maxStack: event.target.value }))}
              />
            </label>
            <label>
              Starter Grant Amount
              <input
                type="number"
                min={0}
                value={draft.starterGrantAmount}
                onChange={(event) => setDraft((current) => ({ ...current, starterGrantAmount: event.target.value }))}
              />
            </label>
          </div>
          <div className="admin-grid-2">
            <label>
              <input
                type="checkbox"
                checked={draft.consumable}
                onChange={(event) => setDraft((current) => ({ ...current, consumable: event.target.checked }))}
              />{' '}
              Consumable
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
              />{' '}
              Active
            </label>
          </div>
          <label>
            Effect Config (JSON)
            <textarea
              value={draft.effectConfigJson}
              onChange={(event) => setDraft((current) => ({ ...current, effectConfigJson: event.target.value }))}
              rows={8}
              className="admin-json"
            />
          </label>
          <p className="admin-note">
            Examples: tool <code>{'{"actionId":"fishing","requiresFacingTileKeyword":["water"]}'}</code>; heal flat{' '}
            <code>{'{"healAmount":20}'}</code>; heal percent <code>{'{"healPercent":0.35}'}</code>.
            Success Text supports <code>{'<Critter>'}</code> and <code>X</code> tokens. Value sync rules: <code>heal_flat</code>{' '}
            updates <code>effectConfig.healAmount</code>, and <code>tool_action</code> updates <code>effectConfig.power</code>.
          </p>
        </section>
      </section>
    </section>
  );
}

function createEmptyDraft(existingItems: GameItemDefinition[]): ItemDraft {
  const candidate = nextItemId(existingItems);
  return {
    id: candidate,
    name: 'New Item',
    category: 'other',
    description: '',
    imageUrl: '',
    misuseText: 'That item cannot be used right now.',
    successText: '',
    effectType: 'other_stub',
    effectConfigJson: JSON.stringify({ actionId: 'other-action' }, null, 2),
    valueInput: '',
    consumable: true,
    maxStack: '99',
    isActive: true,
    starterGrantAmount: '0',
  };
}

function itemToDraft(item: GameItemDefinition): ItemDraft {
  const derivedValue = deriveValueFromItem(item);
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    imageUrl: item.imageUrl,
    misuseText: item.misuseText,
    successText: item.successText ?? '',
    effectType: item.effectType,
    effectConfigJson: JSON.stringify(item.effectConfig ?? {}, null, 2),
    valueInput: typeof derivedValue === 'number' && Number.isFinite(derivedValue) ? String(derivedValue) : '',
    consumable: item.consumable,
    maxStack: String(item.maxStack),
    isActive: item.isActive,
    starterGrantAmount: String(item.starterGrantAmount),
  };
}

function parseEffectConfigJson(raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: {} };
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Effect config must be a JSON object.' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: 'Effect config JSON is invalid.' };
  }
}

function nextItemId(existingItems: GameItemDefinition[]): string {
  let index = existingItems.length + 1;
  const taken = new Set(existingItems.map((item) => item.id));
  let candidate = `item-${index}`;
  while (taken.has(candidate)) {
    index += 1;
    candidate = `item-${index}`;
  }
  return candidate;
}

function normalizeAssetUrlForCompare(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function parseOptionalNumberInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function syncEffectConfigWithValue(
  effectType: string,
  effectConfig: Record<string, unknown>,
  value: number | undefined,
): Record<string, unknown> {
  const next = { ...effectConfig };
  if (effectType === 'heal_flat') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      next.healAmount = Math.max(1, Math.floor(value));
    } else {
      delete next.healAmount;
    }
  }
  if (effectType === 'tool_action') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      next.power = Math.max(0, Math.min(1, value));
    } else {
      delete next.power;
    }
  }
  return next;
}

function deriveValueFromItem(item: GameItemDefinition): number | undefined {
  if (typeof item.value === 'number' && Number.isFinite(item.value)) {
    return item.value;
  }
  if (item.effectType === 'heal_flat') {
    const effect = item.effectConfig as { healAmount?: number };
    if (typeof effect.healAmount === 'number' && Number.isFinite(effect.healAmount)) {
      return Math.max(1, Math.floor(effect.healAmount));
    }
  }
  if (item.effectType === 'tool_action') {
    const effect = item.effectConfig as { power?: number };
    if (typeof effect.power === 'number' && Number.isFinite(effect.power)) {
      return Math.max(0, Math.min(1, effect.power));
    }
  }
  return undefined;
}
