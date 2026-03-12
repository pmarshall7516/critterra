import { useEffect, useMemo, useState } from 'react';
import { sanitizeItemCatalog, sanitizeItemDefinition } from '@/game/items/schema';
import { ITEM_CORE_CATEGORIES, ITEM_EFFECT_TYPES, type GameItemDefinition } from '@/game/items/types';
import { apiFetchJson } from '@/shared/apiClient';
import { sanitizeEquipmentEffectLibrary } from '@/game/equipmentEffects/schema';
import {
  EQUIPMENT_EFFECT_MODES,
  EQUIPMENT_PERSISTENT_HEAL_MODES,
  type EquipmentEffectAttachment,
  type EquipmentEffectDefinition,
  type EquipmentEffectMode,
  type EquipmentEffectType,
  type EquipmentPersistentHealMode,
} from '@/game/equipmentEffects/types';

interface ItemListResponse {
  ok: boolean;
  items?: unknown;
  error?: string;
}

interface ItemSaveResponse {
  ok: boolean;
  error?: string;
}

interface EquipmentEffectsListResponse {
  ok: boolean;
  equipmentEffects?: unknown;
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
  equipSizeInput: string;
  equipmentEffectAttachments: EquipmentEffectAttachmentDraft[];
  valueInput: string;
  consumable: boolean;
  maxStack: string;
  isActive: boolean;
  starterGrantAmount: string;
}

interface EquipmentEffectAttachmentDraft {
  effectId: string;
  mode: EquipmentEffectMode;
  value: string;
  critChanceBonus: string;
  persistentHealMode: EquipmentPersistentHealMode;
  persistentHealValue: string;
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
  const [equipmentEffects, setEquipmentEffects] = useState<EquipmentEffectDefinition[]>([]);
  const [equipmentEffectSearchInput, setEquipmentEffectSearchInput] = useState('');
  const [equipmentEffectDropdownOpen, setEquipmentEffectDropdownOpen] = useState(false);

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
    return JSON.stringify(itemToDraft(selectedItem, equipmentEffects)) !== JSON.stringify(draft);
  }, [selectedItem, draft, equipmentEffects]);

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

  const selectedEquipmentEffectIds = useMemo(
    () => draft.equipmentEffectAttachments.map((attachment) => attachment.effectId),
    [draft.equipmentEffectAttachments],
  );

  const filteredEquipmentEffects = useMemo(() => {
    const query = equipmentEffectSearchInput.trim().toLowerCase();
    const selected = new Set(selectedEquipmentEffectIds);
    return equipmentEffects
      .filter((effect) => !selected.has(effect.effect_id))
      .filter((effect) => {
        if (!query) {
          return true;
        }
        return (
          effect.effect_id.toLowerCase().includes(query) ||
          effect.effect_name.toLowerCase().includes(query)
        );
      })
      .sort((left, right) => left.effect_id.localeCompare(right.effect_id))
      .slice(0, 16);
  }, [equipmentEffects, equipmentEffectSearchInput, selectedEquipmentEffectIds]);

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
        setDraft(itemToDraft(loadedItems[0], equipmentEffects));
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

  const loadEquipmentEffects = async () => {
    try {
      const result = await apiFetchJson<EquipmentEffectsListResponse>('/api/admin/equipment-effects/list');
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load equipment effects.');
      }
      const loaded = sanitizeEquipmentEffectLibrary(result.data?.equipmentEffects);
      setEquipmentEffects(loaded);
    } catch {
      setEquipmentEffects([]);
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
    void loadEquipmentEffects();
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
    setDraft(itemToDraft(item, equipmentEffects));
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

    const isEquipmentCategory = draft.category === 'equipment';
    const parsedValue = isEquipmentCategory ? undefined : parseOptionalNumberInput(draft.valueInput);
    const parsedEffectConfig = parseEffectConfigJson(draft.effectConfigJson);
    if (!isEquipmentCategory && !parsedEffectConfig.ok) {
      setError(parsedEffectConfig.error);
      return;
    }
    const equipSizeRaw = Number.parseInt(draft.equipSizeInput, 10);
    const equipmentEffectById = new Map(equipmentEffects.map((effect) => [effect.effect_id, effect] as const));
    const equipmentEffectAttachments = buildEquipmentEffectAttachmentsFromDraft(
      draft.equipmentEffectAttachments,
      equipmentEffectById,
    );
    const equipmentConfig = {
      equipSize: Number.isFinite(equipSizeRaw) ? Math.max(1, Math.min(8, Math.floor(equipSizeRaw))) : 1,
      equipmentEffectAttachments,
      equipmentEffectIds: equipmentEffectAttachments.map((entry) => entry.effectId),
    };
    const syncedEffectConfig = isEquipmentCategory
      ? equipmentConfig
      : syncEffectConfigWithValue(draft.effectType, parsedEffectConfig.ok ? parsedEffectConfig.value : {}, parsedValue);
    const effectType = isEquipmentCategory ? 'equip_effect' : draft.effectType;

    const parsed = sanitizeItemDefinition(
      {
        id: draft.id,
        name: draft.name,
        category: draft.category,
        description: draft.description,
        imageUrl: draft.imageUrl,
        misuseText: draft.misuseText,
        successText: draft.successText,
        effectType,
        effectConfig: syncedEffectConfig,
        value: parsedValue,
        consumable: isEquipmentCategory ? false : draft.consumable,
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
    setDraft(itemToDraft(parsed, equipmentEffects));
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
        setDraft(itemToDraft(nextSelected, equipmentEffects));
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
                onChange={(event) =>
                  setDraft((current) => {
                    const nextCategory = event.target.value;
                    const nextIsEquipment = nextCategory === 'equipment';
                    return {
                      ...current,
                      category: nextCategory,
                      effectType: nextIsEquipment ? 'equip_effect' : current.effectType,
                      consumable: nextIsEquipment ? false : current.consumable,
                    };
                  })
                }
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            {draft.category === 'equipment' ? (
              <>
                <label>
                  Effect Type
                  <input value="equip_effect" readOnly />
                </label>
                <label>
                  Equip Size
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={draft.equipSizeInput}
                    onChange={(event) => setDraft((current) => ({ ...current, equipSizeInput: event.target.value }))}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Effect Type
                  <select
                    value={draft.effectType}
                    onChange={(event) => setDraft((current) => ({ ...current, effectType: event.target.value }))}
                  >
                    {ITEM_EFFECT_TYPES.filter((type) => type !== 'equip_effect').map((type) => (
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
              </>
            )}
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
                disabled={draft.category === 'equipment'}
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
          {draft.category === 'equipment' ? (
            <>
              <label className="admin-effect-picker-wrap">
                <span>Equipment Effect Templates</span>
                <div className="admin-effect-picker" onClick={() => setEquipmentEffectDropdownOpen(true)}>
                  {selectedEquipmentEffectIds.map((id) => {
                    const effect = equipmentEffects.find((entry) => entry.effect_id === id);
                    return (
                      <span key={id} className="admin-effect-picker__chip">
                        {effect ? `${effect.effect_name} (${effect.effect_id})` : id}
                        <button
                          type="button"
                          className="admin-effect-picker__chip-remove"
                          aria-label={`Remove ${id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDraft((current) => ({
                              ...current,
                              equipmentEffectAttachments: current.equipmentEffectAttachments.filter(
                                (entry) => entry.effectId !== id,
                              ),
                            }));
                          }}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  <input
                    type="text"
                    className="admin-effect-picker__input"
                    value={equipmentEffectSearchInput}
                    onChange={(event) => setEquipmentEffectSearchInput(event.target.value)}
                    onFocus={() => setEquipmentEffectDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setEquipmentEffectDropdownOpen(false), 150)}
                    onKeyDown={(event) => {
                      if ((event.key === 'Backspace' || event.key === 'Delete') && !equipmentEffectSearchInput && selectedEquipmentEffectIds.length > 0) {
                        setDraft((current) => ({
                          ...current,
                          equipmentEffectAttachments: current.equipmentEffectAttachments.slice(0, -1),
                        }));
                      }
                    }}
                    placeholder={selectedEquipmentEffectIds.length === 0 ? 'Search equipment effect templates…' : 'Add another template'}
                  />
                  {equipmentEffectDropdownOpen && (
                    <div className="admin-effect-picker__dropdown" onMouseDown={(event) => event.preventDefault()}>
                      {filteredEquipmentEffects.length === 0 ? (
                        <div className="admin-effect-picker__dropdown-empty">
                          {equipmentEffectSearchInput.trim() ? 'No matching equipment templates' : 'All templates selected'}
                        </div>
                      ) : (
                        filteredEquipmentEffects.map((effect) => (
                          <button
                            key={effect.effect_id}
                            type="button"
                            className="admin-effect-picker__dropdown-item"
                            onMouseDown={() => {
                              setDraft((current) => ({
                                ...current,
                                equipmentEffectAttachments: [
                                  ...current.equipmentEffectAttachments,
                                  buildEquipmentEffectAttachmentDraftFromTemplate(effect),
                                ],
                              }));
                              setEquipmentEffectSearchInput('');
                              setEquipmentEffectDropdownOpen(false);
                            }}
                          >
                            {effect.effect_name} ({effect.effect_id}) • {effect.effect_type}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </label>
              {draft.equipmentEffectAttachments.length > 0 && (
                <section className="admin-panel" style={{ marginTop: '0.5rem' }}>
                  <h4>Template Attachments</h4>
                  {draft.equipmentEffectAttachments.map((attachment) => {
                    const effect = equipmentEffects.find((entry) => entry.effect_id === attachment.effectId);
                    const effectType = effect?.effect_type;
                    const isStatTemplate = isStatEquipmentEffectType(effectType);
                    return (
                      <div key={`equipment-attachment-${attachment.effectId}`} className="admin-grid-2" style={{ marginBottom: '0.75rem' }}>
                        <label style={{ gridColumn: '1 / -1' }}>
                          Template
                          <input value={effect ? `${effect.effect_name} (${effect.effect_id})` : attachment.effectId} readOnly />
                        </label>
                        {isStatTemplate && (
                          <>
                            <label>
                              Mode
                              <select
                                value={attachment.mode}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    equipmentEffectAttachments: current.equipmentEffectAttachments.map((entry) =>
                                      entry.effectId === attachment.effectId
                                        ? { ...entry, mode: event.target.value as EquipmentEffectMode }
                                        : entry,
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
                                step={attachment.mode === 'flat' ? '1' : '0.01'}
                                value={attachment.value}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    equipmentEffectAttachments: current.equipmentEffectAttachments.map((entry) =>
                                      entry.effectId === attachment.effectId
                                        ? { ...entry, value: event.target.value }
                                        : entry,
                                    ),
                                  }))
                                }
                              />
                            </label>
                          </>
                        )}
                        {effectType === 'crit_buff' && (
                          <label style={{ gridColumn: '1 / -1' }}>
                            Crit Chance Bonus (0-1)
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step="0.01"
                              value={attachment.critChanceBonus}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  equipmentEffectAttachments: current.equipmentEffectAttachments.map((entry) =>
                                    entry.effectId === attachment.effectId
                                      ? { ...entry, critChanceBonus: event.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                          </label>
                        )}
                        {effectType === 'persistent_heal' && (
                          <>
                            <label>
                              Heal Mode
                              <select
                                value={attachment.persistentHealMode}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    equipmentEffectAttachments: current.equipmentEffectAttachments.map((entry) =>
                                      entry.effectId === attachment.effectId
                                        ? { ...entry, persistentHealMode: event.target.value as EquipmentPersistentHealMode }
                                        : entry,
                                    ),
                                  }))
                                }
                              >
                                {EQUIPMENT_PERSISTENT_HEAL_MODES.map((mode) => (
                                  <option key={mode} value={mode}>
                                    {mode}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Heal Value
                              <input
                                type="number"
                                min={attachment.persistentHealMode === 'flat' ? 1 : 0}
                                max={attachment.persistentHealMode === 'flat' ? undefined : 1}
                                step={attachment.persistentHealMode === 'flat' ? '1' : '0.01'}
                                value={attachment.persistentHealValue}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    equipmentEffectAttachments: current.equipmentEffectAttachments.map((entry) =>
                                      entry.effectId === attachment.effectId
                                        ? { ...entry, persistentHealValue: event.target.value }
                                        : entry,
                                    ),
                                  }))
                                }
                              />
                            </label>
                          </>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}
              <p className="admin-note">
                Equipment is non-consumable and equipped from the Squad screen. Select template(s) and configure per-item attachment values here.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
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
    equipSizeInput: '1',
    equipmentEffectAttachments: [],
    valueInput: '',
    consumable: true,
    maxStack: '99',
    isActive: true,
    starterGrantAmount: '0',
  };
}

function itemToDraft(item: GameItemDefinition, equipmentEffects: EquipmentEffectDefinition[] = []): ItemDraft {
  const derivedValue = deriveValueFromItem(item);
  const equipmentConfig = item.effectConfig as {
    equipSize?: number;
    equipmentEffectIds?: string[];
    equipmentEffectAttachments?: EquipmentEffectAttachment[];
  };
  const equipSize =
    typeof equipmentConfig.equipSize === 'number' && Number.isFinite(equipmentConfig.equipSize)
      ? Math.max(1, Math.min(8, Math.floor(equipmentConfig.equipSize)))
      : 1;
  const equipmentEffectById = new Map(equipmentEffects.map((effect) => [effect.effect_id, effect] as const));
  const equipmentEffectIds = Array.isArray(equipmentConfig.equipmentEffectIds)
    ? equipmentConfig.equipmentEffectIds
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map((entry) => entry.trim())
    : [];
  const equipmentEffectAttachments = Array.isArray(equipmentConfig.equipmentEffectAttachments)
    ? equipmentConfig.equipmentEffectAttachments
        .filter((entry): entry is EquipmentEffectAttachment => Boolean(entry && typeof entry === 'object'))
        .map((entry) => buildEquipmentEffectAttachmentDraft(entry, equipmentEffectById.get(entry.effectId)))
    : equipmentEffectIds.map((effectId) =>
        buildEquipmentEffectAttachmentDraftFromTemplate(
          equipmentEffectById.get(effectId) ?? {
            effect_id: effectId,
            effect_name: effectId,
            effect_type: inferEquipmentEffectTypeFromId(effectId),
            description: '',
            modifiers: [],
          },
        ),
      );
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
    equipSizeInput: String(equipSize),
    equipmentEffectAttachments,
    valueInput: typeof derivedValue === 'number' && Number.isFinite(derivedValue) ? String(derivedValue) : '',
    consumable: item.consumable,
    maxStack: String(item.maxStack),
    isActive: item.isActive,
    starterGrantAmount: String(item.starterGrantAmount),
  };
}

function isStatEquipmentEffectType(effectType: EquipmentEffectType | undefined): boolean {
  return (
    effectType === 'atk_buff' ||
    effectType === 'def_buff' ||
    effectType === 'speed_buff' ||
    effectType === 'hp_buff'
  );
}

function buildEquipmentEffectAttachmentDraftFromTemplate(
  effect: EquipmentEffectDefinition,
): EquipmentEffectAttachmentDraft {
  const statFallback = findTemplateStatFallback(effect);
  const persistentFallback = effect.persistentHeal;
  return {
    effectId: effect.effect_id,
    mode: statFallback?.mode ?? 'percent',
    value: String(statFallback?.value ?? 0.1),
    critChanceBonus: String(0.05),
    persistentHealMode: persistentFallback?.mode ?? 'percent_max_hp',
    persistentHealValue: String(persistentFallback?.value ?? 0.05),
  };
}

function buildEquipmentEffectAttachmentDraft(
  attachment: EquipmentEffectAttachment,
  template: EquipmentEffectDefinition | undefined,
): EquipmentEffectAttachmentDraft {
  const base = template
    ? buildEquipmentEffectAttachmentDraftFromTemplate(template)
    : buildEquipmentEffectAttachmentDraftFromTemplate({
        effect_id: attachment.effectId,
        effect_name: attachment.effectId,
        effect_type: inferEquipmentEffectTypeFromId(attachment.effectId),
        description: '',
        modifiers: [],
      });
  const mode = attachment.mode === 'flat' || attachment.mode === 'percent' ? attachment.mode : base.mode;
  const persistentHealMode =
    attachment.persistentHealMode === 'flat' || attachment.persistentHealMode === 'percent_max_hp'
      ? attachment.persistentHealMode
      : base.persistentHealMode;
  return {
    effectId: attachment.effectId,
    mode,
    value: String(typeof attachment.value === 'number' && Number.isFinite(attachment.value) ? attachment.value : base.value),
    critChanceBonus: String(
      typeof attachment.critChanceBonus === 'number' && Number.isFinite(attachment.critChanceBonus)
        ? attachment.critChanceBonus
        : base.critChanceBonus,
    ),
    persistentHealMode,
    persistentHealValue: String(
      typeof attachment.persistentHealValue === 'number' && Number.isFinite(attachment.persistentHealValue)
        ? attachment.persistentHealValue
        : base.persistentHealValue,
    ),
  };
}

function buildEquipmentEffectAttachmentsFromDraft(
  draftAttachments: EquipmentEffectAttachmentDraft[],
  equipmentEffectById: Map<string, EquipmentEffectDefinition>,
): EquipmentEffectAttachment[] {
  const parsed: EquipmentEffectAttachment[] = [];
  const seen = new Set<string>();
  for (const attachment of draftAttachments) {
    const effectId = normalizeEffectId(attachment.effectId);
    if (!effectId || seen.has(effectId)) {
      continue;
    }
    const template = equipmentEffectById.get(effectId);
    const effectType = template?.effect_type ?? inferEquipmentEffectTypeFromId(effectId);

    if (effectType === 'crit_buff') {
      parsed.push({
        effectId,
        critChanceBonus: clampFloatFromInput(attachment.critChanceBonus, 0, 1, 0.05),
      });
      seen.add(effectId);
      continue;
    }

    if (effectType === 'persistent_heal') {
      const persistentHealMode =
        attachment.persistentHealMode === 'flat' || attachment.persistentHealMode === 'percent_max_hp'
          ? attachment.persistentHealMode
          : 'percent_max_hp';
      const persistentHealValue = persistentHealMode === 'flat'
        ? Math.max(1, Math.floor(clampFloatFromInput(attachment.persistentHealValue, 1, 9999, 1)))
        : clampFloatFromInput(attachment.persistentHealValue, 0, 1, 0.05);
      parsed.push({
        effectId,
        persistentHealMode,
        persistentHealValue,
      });
      seen.add(effectId);
      continue;
    }

    const mode = attachment.mode === 'flat' || attachment.mode === 'percent' ? attachment.mode : 'percent';
    const value = mode === 'flat'
      ? Math.floor(clampFloatFromInput(attachment.value, -999, 999, 1))
      : clampFloatFromInput(attachment.value, -5, 5, 0.1);
    parsed.push({
      effectId,
      mode,
      value,
    });
    seen.add(effectId);
  }
  return parsed;
}

function findTemplateStatFallback(effect: EquipmentEffectDefinition): { mode: EquipmentEffectMode; value: number } | null {
  if (effect.effect_type === 'atk_buff') {
    return getTemplateModifier(effect, 'attack');
  }
  if (effect.effect_type === 'def_buff') {
    return getTemplateModifier(effect, 'defense');
  }
  if (effect.effect_type === 'speed_buff') {
    return getTemplateModifier(effect, 'speed');
  }
  if (effect.effect_type === 'hp_buff') {
    return getTemplateModifier(effect, 'hp');
  }
  return null;
}

function getTemplateModifier(
  effect: EquipmentEffectDefinition,
  stat: 'attack' | 'defense' | 'speed' | 'hp',
): { mode: EquipmentEffectMode; value: number } | null {
  const match = effect.modifiers.find((entry) => entry.stat === stat);
  if (!match) {
    return null;
  }
  const mode = match.mode === 'flat' ? 'flat' : 'percent';
  const value = mode === 'flat'
    ? Math.floor(clampFloat(match.value, -999, 999))
    : clampFloat(match.value, -5, 5);
  return { mode, value };
}

function inferEquipmentEffectTypeFromId(effectId: string): EquipmentEffectType {
  const normalized = effectId.toLowerCase();
  if (normalized.includes('crit')) {
    return 'crit_buff';
  }
  if (normalized.includes('heal') || normalized.includes('regen')) {
    return 'persistent_heal';
  }
  if (normalized.includes('atk') || normalized.includes('attack')) {
    return 'atk_buff';
  }
  if (normalized.includes('speed') || normalized.includes('spd')) {
    return 'speed_buff';
  }
  if (normalized.includes('hp')) {
    return 'hp_buff';
  }
  return 'def_buff';
}

function normalizeEffectId(raw: string): string {
  return raw.trim();
}

function clampFloatFromInput(raw: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clampFloat(parsed, min, max);
}

function clampFloat(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
