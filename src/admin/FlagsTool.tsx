import { useEffect, useMemo, useState } from 'react';
import { loadAdminFlags, saveAdminFlags, type AdminFlagEntry } from '@/admin/flagsApi';

interface FlagDraft {
  localId: string;
  flagId: string;
  label: string;
  notes: string;
}

function toDraftEntries(entries: AdminFlagEntry[]): FlagDraft[] {
  return entries.map((entry) => ({
    localId: `${entry.flagId}-${entry.updatedAt || Date.now()}`,
    flagId: entry.flagId,
    label: entry.label,
    notes: entry.notes,
  }));
}

function sanitizeFlagId(value: string): string {
  return value.trim().toLowerCase();
}

export function FlagsTool() {
  const [flags, setFlags] = useState<FlagDraft[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const filteredFlags = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    const sorted = [...flags].sort((left, right) =>
      sanitizeFlagId(left.flagId).localeCompare(sanitizeFlagId(right.flagId), undefined, { sensitivity: 'base' }),
    );
    if (!query) {
      return sorted;
    }
    return sorted.filter(
      (entry) => entry.flagId.toLowerCase().includes(query) || entry.label.toLowerCase().includes(query),
    );
  }, [flags, searchInput]);

  const loadFlags = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const loaded = await loadAdminFlags();
      setFlags(toDraftEntries(loaded));
      setStatus(`Loaded ${loaded.length} flag(s).`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load flags.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadFlags();
  }, []);

  const updateFlag = (localId: string, updater: (entry: FlagDraft) => FlagDraft) => {
    setFlags((current) => current.map((entry) => (entry.localId === localId ? updater(entry) : entry)));
  };

  const addFlag = () => {
    setFlags((current) => [
      ...current,
      {
        localId: `new-flag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        flagId: '',
        label: '',
        notes: '',
      },
    ]);
  };

  const removeFlag = (localId: string) => {
    setFlags((current) => current.filter((entry) => entry.localId !== localId));
  };

  const saveFlags = async () => {
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const next = flags.map((entry) => ({
        ...entry,
        flagId: sanitizeFlagId(entry.flagId),
        label: entry.label.trim(),
        notes: entry.notes.trim(),
      }));
      const deduped = new Set<string>();
      for (const entry of next) {
        if (!entry.flagId) {
          continue;
        }
        if (deduped.has(entry.flagId)) {
          throw new Error(`Duplicate flag id "${entry.flagId}" detected.`);
        }
        deduped.add(entry.flagId);
      }
      const saved = await saveAdminFlags(
        next
          .filter((entry) => entry.flagId.length > 0)
          .map((entry) => ({
            flagId: entry.flagId,
            label: entry.label,
            notes: entry.notes,
            updatedAt: '',
          })),
      );
      setFlags(toDraftEntries(saved));
      setStatus(`Saved ${saved.length} flag(s).`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save flags.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-layout admin-layout--single">
      <section className="admin-layout__left">
        <section className="admin-panel">
          <h3>Flag Catalog</h3>
          <p className="admin-note">
            Flags power story state checks like Requires Flag, Story Flag missions, and interaction unlock flow.
          </p>
          <div className="admin-row">
            <button type="button" className="secondary" onClick={loadFlags} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Reload'}
            </button>
            <button type="button" className="secondary" onClick={addFlag}>
              Add Flag
            </button>
            <button type="button" className="primary" onClick={saveFlags} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Flags'}
            </button>
          </div>
          {status && <p className="admin-note">{status}</p>}
          {error && (
            <p className="admin-note" style={{ color: '#f7b9b9' }}>
              {error}
            </p>
          )}
          <label>
            Search
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="flag id or label"
            />
          </label>
          <div className="saved-paint-list">
            {filteredFlags.length === 0 && <p className="admin-note">No flags yet.</p>}
            {filteredFlags.map((entry) => (
              <section key={entry.localId} className="admin-panel">
                <div className="admin-grid-2">
                  <label>
                    Flag ID
                    <input
                      value={entry.flagId}
                      onChange={(event) =>
                        updateFlag(entry.localId, (current) => ({
                          ...current,
                          flagId: event.target.value,
                        }))
                      }
                      placeholder="demo-done"
                    />
                  </label>
                  <label>
                    Label
                    <input
                      value={entry.label}
                      onChange={(event) =>
                        updateFlag(entry.localId, (current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      placeholder="Demo Done"
                    />
                  </label>
                </div>
                <label>
                  Notes
                  <textarea
                    rows={2}
                    className="admin-json"
                    value={entry.notes}
                    onChange={(event) =>
                      updateFlag(entry.localId, (current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Optional context for this flag."
                  />
                </label>
                <button type="button" className="secondary" onClick={() => removeFlag(entry.localId)}>
                  Remove
                </button>
              </section>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}
