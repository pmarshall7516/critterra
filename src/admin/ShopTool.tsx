import { useEffect, useMemo, useState } from 'react';
import { sanitizeItemCatalog } from '@/game/items/schema';
import type { GameItemDefinition } from '@/game/items/types';
import { sanitizeCritterDatabase } from '@/game/critters/schema';
import type { CritterDefinition } from '@/game/critters/types';
import { loadAdminFlags, type AdminFlagEntry } from '@/admin/flagsApi';
import { parseShopCatalog } from '@/game/shops/schema';
import type { ShopDefinition } from '@/game/shops/types';
import { apiFetchJson } from '@/shared/apiClient';

interface ShopListResponse {
  ok: boolean;
  shops?: unknown;
  error?: string;
}

interface ShopSaveResponse {
  ok: boolean;
  error?: string;
}

interface ItemListResponse {
  ok: boolean;
  items?: unknown;
  error?: string;
}

interface CritterListResponse {
  ok: boolean;
  critters?: unknown;
  error?: string;
}

interface ShopCostDraft {
  itemId: string;
  quantity: string;
}

interface ShopEntryDraft {
  id: string;
  kind: 'item' | 'critter';
  itemId: string;
  quantity: string;
  repeatable: boolean;
  critterId: string;
  unlockFlagId: string;
  costs: ShopCostDraft[];
}

interface ShopDraft {
  id: string;
  name: string;
  entries: ShopEntryDraft[];
}

export function ShopTool() {
  const [shops, setShops] = useState<ShopDefinition[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShopDraft>(() => createEmptyDraft([]));
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(new Set());
  const [itemCatalog, setItemCatalog] = useState<GameItemDefinition[]>([]);
  const [critterCatalog, setCritterCatalog] = useState<CritterDefinition[]>([]);
  const [flags, setFlags] = useState<AdminFlagEntry[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [shopSearchInput, setShopSearchInput] = useState('');

  const sortedShops = useMemo(
    () => [...shops].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
    [shops],
  );
  const selectedShop = useMemo(
    () => shops.find((entry) => entry.id === selectedShopId) ?? null,
    [shops, selectedShopId],
  );
  const knownFlagIds = useMemo(
    () =>
      [...new Set(flags.map((entry) => entry.flagId.trim()).filter((entry) => entry.length > 0))].sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: 'base' }),
      ),
    [flags],
  );
  const defaultItemId = useMemo(() => itemCatalog[0]?.id ?? '', [itemCatalog]);
  const defaultCritterId = useMemo(() => String(critterCatalog[0]?.id ?? ''), [critterCatalog]);

  const hasDraftChanges = useMemo(() => {
    if (!selectedShop) {
      return true;
    }
    return JSON.stringify(shopToDraft(selectedShop)) !== JSON.stringify(draft);
  }, [selectedShop, draft]);

  const loadShops = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const [shopResult, itemResult, critterResult, loadedFlags] = await Promise.all([
        apiFetchJson<ShopListResponse>('/api/admin/shops/list'),
        apiFetchJson<ItemListResponse>('/api/admin/items/list'),
        apiFetchJson<CritterListResponse>('/api/admin/critters/list'),
        loadAdminFlags().catch(() => []),
      ]);
      if (!shopResult.ok || !shopResult.data?.ok) {
        throw new Error(shopResult.error ?? shopResult.data?.error ?? 'Unable to load shop catalog.');
      }
      if (!itemResult.ok || !itemResult.data?.ok) {
        throw new Error(itemResult.error ?? itemResult.data?.error ?? 'Unable to load item catalog.');
      }
      if (!critterResult.ok || !critterResult.data?.ok) {
        throw new Error(critterResult.error ?? critterResult.data?.error ?? 'Unable to load critter catalog.');
      }

      const loadedShops = parseShopCatalog(shopResult.data.shops);
      const loadedItems = sanitizeItemCatalog(itemResult.data.items);
      const loadedCritters = sanitizeCritterDatabase(critterResult.data.critters);
      setShops(loadedShops);
      setItemCatalog(loadedItems);
      setCritterCatalog(loadedCritters);
      setFlags(loadedFlags);
      setPendingRemovalIds(new Set());
      if (loadedShops.length > 0) {
        setSelectedShopId(loadedShops[0].id);
        setDraft(shopToDraft(loadedShops[0]));
      } else {
        setSelectedShopId(null);
        setDraft(createEmptyDraft(loadedShops, loadedItems, loadedCritters));
      }
      setStatus(`Loaded ${loadedShops.length} shop definition(s).`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load shop catalog.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadShops();
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectShop = (shop: ShopDefinition) => {
    setSelectedShopId(shop.id);
    setDraft(shopToDraft(shop));
    setError('');
    setStatus(`Loaded "${shop.name}".`);
  };

  const startNewDraft = () => {
    setSelectedShopId(null);
    setDraft(createEmptyDraft(shops, itemCatalog, critterCatalog));
    setError('');
    setStatus('Drafting a new shop.');
  };

  const togglePendingRemoval = (shopId: string) => {
    const isPending = pendingRemovalIds.has(shopId);
    setPendingRemovalIds((current) => {
      const next = new Set(current);
      if (next.has(shopId)) {
        next.delete(shopId);
      } else {
        next.add(shopId);
      }
      return next;
    });
    setError('');
    setStatus(
      isPending
        ? `Restored shop "${shopId}". Save Shop Database to persist.`
        : `Marked shop "${shopId}" for removal. Save Shop Database to persist.`,
    );
  };

  const applyDraft = () => {
    setError('');
    setStatus('');
    let parsedShop: ShopDefinition | null = null;
    try {
      const parsed = parseShopCatalog(
        [
          {
            id: draft.id,
            name: draft.name,
            entries: draft.entries.map((entry) => ({
              id: entry.id,
              kind: entry.kind,
              itemId: entry.itemId,
              quantity: Number.parseInt(entry.quantity, 10),
              repeatable: entry.repeatable,
              critterId: Number.parseInt(entry.critterId, 10),
              unlockFlagId: entry.unlockFlagId,
              costs: entry.costs.map((cost) => ({
                itemId: cost.itemId,
                quantity: Number.parseInt(cost.quantity, 10),
              })),
            })),
          },
        ],
        { strictUnique: true, strictEntryUnique: true },
      );
      parsedShop = parsed[0] as ShopDefinition | undefined ?? null;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Shop draft is invalid.');
      return;
    }
    if (!parsedShop) {
      setError('Shop draft is invalid.');
      return;
    }

    const existingIndex = selectedShopId === null ? -1 : shops.findIndex((entry) => entry.id === selectedShopId);
    const duplicateExists = shops.some((entry, index) => entry.id === parsedShop?.id && index !== existingIndex);
    if (duplicateExists) {
      setError(`Shop ID "${parsedShop.id}" already exists.`);
      return;
    }

    const nextShops = [...shops];
    if (existingIndex >= 0) {
      nextShops[existingIndex] = parsedShop;
    } else {
      nextShops.push(parsedShop);
    }
    setShops(nextShops);
    setSelectedShopId(parsedShop.id);
    setDraft(shopToDraft(parsedShop));
    setPendingRemovalIds((current) => {
      const next = new Set(current);
      next.delete(parsedShop.id);
      if (selectedShopId) {
        next.delete(selectedShopId);
      }
      return next;
    });
    setStatus(`Applied shop "${parsedShop.name}". Save Shop Database to persist.`);
  };

  const saveShops = async () => {
    const selectedPendingRemoval = selectedShopId !== null && pendingRemovalIds.has(selectedShopId);
    if (hasDraftChanges && !selectedPendingRemoval) {
      setError('Apply Draft before saving.');
      return;
    }
    const shopsToPersist = shops.filter((entry) => !pendingRemovalIds.has(entry.id));
    const removedCount = shops.length - shopsToPersist.length;
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<ShopSaveResponse>('/api/admin/shops/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shops: shopsToPersist,
        }),
      });
      if (!result.ok || !result.data?.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save shop catalog.');
      }
      setShops(shopsToPersist);
      setPendingRemovalIds(new Set());
      const nextSelected = selectedShopId
        ? shopsToPersist.find((entry) => entry.id === selectedShopId) ?? shopsToPersist[0] ?? null
        : shopsToPersist[0] ?? null;
      if (nextSelected) {
        setSelectedShopId(nextSelected.id);
        setDraft(shopToDraft(nextSelected));
      } else {
        setSelectedShopId(null);
        setDraft(createEmptyDraft(shopsToPersist, itemCatalog, critterCatalog));
      }
      setStatus(
        removedCount > 0
          ? `Saved ${shopsToPersist.length} shop(s). Removed ${removedCount} shop(s).`
          : `Saved ${shopsToPersist.length} shop(s) to database.`,
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save shop catalog.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateEntry = (index: number, updater: (entry: ShopEntryDraft) => ShopEntryDraft) => {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) => (entryIndex === index ? updater(entry) : entry)),
    }));
  };

  const addEntry = () => {
    setDraft((current) => ({
      ...current,
      entries: [
        ...current.entries,
        createEntryDraft(current.entries, defaultItemId, defaultCritterId),
      ],
    }));
  };

  const removeEntry = (index: number) => {
    setDraft((current) => ({
      ...current,
      entries: current.entries.filter((_, entryIndex) => entryIndex !== index),
    }));
  };

  const addCostRow = (entryIndex: number) => {
    updateEntry(entryIndex, (entry) => ({
      ...entry,
      costs: [...entry.costs, { itemId: defaultItemId, quantity: '1' }],
    }));
  };

  const removeCostRow = (entryIndex: number, costIndex: number) => {
    updateEntry(entryIndex, (entry) => ({
      ...entry,
      costs: entry.costs.filter((_, index) => index !== costIndex),
    }));
  };

  return (
    <section className="admin-layout admin-layout--critter-tool">
      <section className="admin-panel critter-database-panel">
        <h3>Shop Database</h3>
        <div className="admin-row">
          <button type="button" className="secondary" onClick={() => void loadShops()} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Reload'}
          </button>
          <button type="button" className="secondary" onClick={startNewDraft}>
            New Shop
          </button>
          <button type="button" className="secondary" onClick={applyDraft}>
            Apply Draft
          </button>
          <button type="button" className="primary" onClick={() => void saveShops()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Shop Database'}
          </button>
        </div>
        <p className="admin-note">Create shop IDs once and keep them stable so NPC instances can reference them safely.</p>
        {pendingRemovalIds.size > 0 && (
          <p className="admin-note">{pendingRemovalIds.size} shop(s) marked for removal. Save to commit.</p>
        )}
        {status ? <p className="admin-note">{status}</p> : null}
        {error ? (
          <p className="admin-note" style={{ color: '#f7b9b9' }}>
            {error}
          </p>
        ) : null}
        <label>
          Search Shops
          <input
            value={shopSearchInput}
            onChange={(event) => setShopSearchInput(event.target.value)}
            placeholder="Search shop ID or name"
          />
        </label>
        <div className="critter-database-list">
          {sortedShops
            .filter((shop) => {
              const query = shopSearchInput.trim().toLowerCase();
              if (!query) {
                return true;
              }
              return shop.id.toLowerCase().includes(query) || shop.name.toLowerCase().includes(query);
            })
            .map((shop) => {
              const isSelected = selectedShopId === shop.id;
              const isPendingRemoval = pendingRemovalIds.has(shop.id);
              return (
                <article
                  key={`shop-${shop.id}`}
                  className={`critter-db-card ${isSelected ? 'is-selected' : ''} ${isPendingRemoval ? 'is-pending-remove' : ''}`}
                >
                  <button type="button" className="critter-db-card__select" onClick={() => selectShop(shop)}>
                    <div className="critter-db-card__header">
                      <span className="critter-db-card__id">{shop.id}</span>
                      <span className="critter-db-card__name">{shop.name}</span>
                    </div>
                    <p className="critter-db-card__meta">
                      {shop.entries.length} entr{shop.entries.length === 1 ? 'y' : 'ies'}
                      {isPendingRemoval ? ' | pending remove' : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="secondary critter-db-card__remove"
                    onClick={() => togglePendingRemoval(shop.id)}
                  >
                    {isPendingRemoval ? 'Undo' : 'Remove'}
                  </button>
                </article>
              );
            })}
        </div>
      </section>

      <section className="admin-panel admin-panel--grow critter-editor-panel">
        <h3>Shop Editor</h3>
        <div className="admin-grid-2">
          <label>
            Shop ID
            <input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
          </label>
          <label>
            Shop Name
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
        </div>

        <section className="critter-editor-group">
          <div className="admin-row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0 }}>Entries</h4>
            <button type="button" className="secondary" onClick={addEntry}>
              Add Entry
            </button>
          </div>
          {draft.entries.length === 0 ? <p className="admin-note">No entries yet. Add one to begin.</p> : null}
          <div className="admin-stack">
            {draft.entries.map((entry, entryIndex) => (
              <article key={`entry-${entry.id}-${entryIndex}`} className="admin-panel">
                <div className="admin-grid-2">
                  <label>
                    Entry Kind
                    <select
                      value={entry.kind}
                      onChange={(event) =>
                        updateEntry(entryIndex, (current) => ({
                          ...current,
                          kind: event.target.value === 'critter' ? 'critter' : 'item',
                        }))
                      }
                    >
                      <option value="item">Item</option>
                      <option value="critter">Critter (Flag Unlock)</option>
                    </select>
                  </label>
                </div>

                {entry.kind === 'item' ? (
                  <div className="admin-grid-2">
                    <label>
                      Purchasable Item
                      <select
                        value={entry.itemId}
                        onChange={(event) =>
                          updateEntry(entryIndex, (current) => ({
                            ...current,
                            itemId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select item</option>
                        {itemCatalog.map((item) => (
                          <option key={`shop-entry-item-${entry.id}-${item.id}`} value={item.id}>
                            {item.name} ({item.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantity
                      <input
                        type="number"
                        min={1}
                        value={entry.quantity}
                        onChange={(event) =>
                          updateEntry(entryIndex, (current) => ({
                            ...current,
                            quantity: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={entry.repeatable}
                        onChange={(event) =>
                          updateEntry(entryIndex, (current) => ({
                            ...current,
                            repeatable: event.target.checked,
                          }))
                        }
                      />{' '}
                      Repeatable Item Entry
                    </label>
                  </div>
                ) : (
                  <div className="admin-grid-2">
                    <label>
                      Purchasable Critter
                      <select
                        value={entry.critterId}
                        onChange={(event) =>
                          updateEntry(entryIndex, (current) => ({
                            ...current,
                            critterId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select critter</option>
                        {critterCatalog.map((critter) => (
                          <option key={`shop-entry-critter-${entry.id}-${critter.id}`} value={String(critter.id)}>
                            {critter.name} (#{critter.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Unlock Flag ID
                      <input
                        list="shop-flag-options"
                        value={entry.unlockFlagId}
                        onChange={(event) =>
                          updateEntry(entryIndex, (current) => ({
                            ...current,
                            unlockFlagId: event.target.value,
                          }))
                        }
                        placeholder="required flag id"
                      />
                    </label>
                    <p className="admin-note" style={{ marginTop: 0 }}>
                      Critter entries are always one-time purchases.
                    </p>
                  </div>
                )}

                <section className="critter-editor-group">
                  <div className="admin-row" style={{ justifyContent: 'space-between' }}>
                    <h4 style={{ margin: 0 }}>Costs</h4>
                    <button type="button" className="secondary" onClick={() => addCostRow(entryIndex)}>
                      Add Cost
                    </button>
                  </div>
                  {entry.costs.length === 0 ? <p className="admin-note">Add at least one cost row.</p> : null}
                  {entry.costs.map((cost, costIndex) => (
                    <div key={`entry-cost-${entry.id}-${costIndex}`} className="admin-grid-2">
                      <label>
                        Required Item
                        <select
                          value={cost.itemId}
                          onChange={(event) =>
                            updateEntry(entryIndex, (current) => ({
                              ...current,
                              costs: current.costs.map((currentCost, currentCostIndex) =>
                                currentCostIndex === costIndex
                                  ? { ...currentCost, itemId: event.target.value }
                                  : currentCost,
                              ),
                            }))
                          }
                        >
                          <option value="">Select item</option>
                          {itemCatalog.map((item) => (
                            <option key={`shop-entry-cost-${entry.id}-${costIndex}-${item.id}`} value={item.id}>
                              {item.name} ({item.id})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Required Quantity
                        <input
                          type="number"
                          min={1}
                          value={cost.quantity}
                          onChange={(event) =>
                            updateEntry(entryIndex, (current) => ({
                              ...current,
                              costs: current.costs.map((currentCost, currentCostIndex) =>
                                currentCostIndex === costIndex
                                  ? { ...currentCost, quantity: event.target.value }
                                  : currentCost,
                              ),
                            }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => removeCostRow(entryIndex, costIndex)}
                      >
                        Remove Cost
                      </button>
                    </div>
                  ))}
                </section>

                <div className="admin-row">
                  <button type="button" className="secondary" onClick={() => removeEntry(entryIndex)}>
                    Remove Entry
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <datalist id="shop-flag-options">
          {knownFlagIds.map((flagId) => (
            <option key={`shop-flag-option-${flagId}`} value={flagId} />
          ))}
        </datalist>
      </section>
    </section>
  );
}

function createEmptyDraft(
  existing: ShopDefinition[],
  items: GameItemDefinition[] = [],
  critters: CritterDefinition[] = [],
): ShopDraft {
  const candidate = nextShopId(existing);
  return {
    id: candidate,
    name: 'New Shop',
    entries: [createEntryDraft([], items[0]?.id ?? '', String(critters[0]?.id ?? ''))],
  };
}

function createEntryDraft(
  existingEntries: Array<Pick<ShopEntryDraft, 'id'>>,
  defaultItemId: string,
  defaultCritterId: string,
): ShopEntryDraft {
  return {
    id: nextShopEntryId(existingEntries),
    kind: 'item',
    itemId: defaultItemId,
    quantity: '1',
    repeatable: true,
    critterId: defaultCritterId,
    unlockFlagId: '',
    costs: [{ itemId: defaultItemId, quantity: '1' }],
  };
}

function nextShopEntryId(existingEntries: Array<Pick<ShopEntryDraft, 'id'>>): string {
  const takenIds = new Set(
    existingEntries
      .map((entry) => entry.id.trim())
      .filter((entry) => entry.length > 0),
  );
  let index = existingEntries.length + 1;
  let candidate = `entry-${index}`;
  while (takenIds.has(candidate)) {
    index += 1;
    candidate = `entry-${index}`;
  }
  return candidate;
}

function nextShopId(existing: ShopDefinition[]): string {
  let index = existing.length + 1;
  const taken = new Set(existing.map((shop) => shop.id));
  let candidate = `shop-${index}`;
  while (taken.has(candidate)) {
    index += 1;
    candidate = `shop-${index}`;
  }
  return candidate;
}

function shopToDraft(shop: ShopDefinition): ShopDraft {
  return {
    id: shop.id,
    name: shop.name,
    entries: shop.entries.map((entry, index) => ({
      id: entry.id,
      kind: entry.kind,
      itemId: entry.kind === 'item' ? entry.itemId : '',
      quantity: entry.kind === 'item' ? String(entry.quantity) : '1',
      repeatable: entry.kind === 'item' ? entry.repeatable !== false : false,
      critterId: entry.kind === 'critter' ? String(entry.critterId) : '',
      unlockFlagId: entry.kind === 'critter' ? entry.unlockFlagId : '',
      costs: entry.costs.map((cost) => ({
        itemId: cost.itemId,
        quantity: String(cost.quantity),
      })),
    })),
  };
}
