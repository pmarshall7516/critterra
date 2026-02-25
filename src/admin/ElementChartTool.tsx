import { useEffect, useMemo, useState } from 'react';
import { CRITTER_ELEMENTS } from '@/game/critters/types';
import type { CritterElement } from '@/game/critters/types';
import type { ElementChart } from '@/game/skills/types';
import { sanitizeElementChart } from '@/game/skills/schema';
import { apiFetchJson } from '@/shared/apiClient';

interface ElementChartResponse {
  ok: boolean;
  elementChart?: unknown;
  error?: string;
}

function getMultiplier(chart: ElementChart, attacker: CritterElement, defender: CritterElement): number {
  const e = chart.find((x) => x.attacker === attacker && x.defender === defender);
  return e?.multiplier ?? 1;
}

function setMultiplier(
  chart: ElementChart,
  attacker: CritterElement,
  defender: CritterElement,
  value: number,
): ElementChart {
  const next = chart.filter((e) => !(e.attacker === attacker && e.defender === defender));
  next.push({ attacker, defender, multiplier: value });
  return next;
}

export function ElementChartTool() {
  const [chart, setChart] = useState<ElementChart>(() =>
    CRITTER_ELEMENTS.flatMap((a) => CRITTER_ELEMENTS.map((d) => ({ attacker: a, defender: d, multiplier: 1 }))),
  );
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadAll = async () => {
    setIsLoading(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<ElementChartResponse>('/api/admin/element-chart/get');
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to load element chart.');
      }
      const loaded = sanitizeElementChart(result.data?.elementChart);
      setChart(loaded);
      setStatus('Loaded element chart.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load element chart.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const saveChart = async () => {
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const result = await apiFetchJson<ElementChartResponse>('/api/admin/element-chart/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementChart: chart }),
      });
      if (!result.ok) {
        throw new Error(result.error ?? result.data?.error ?? 'Unable to save element chart.');
      }
      setStatus('Saved element chart.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save element chart.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateCell = (attacker: CritterElement, defender: CritterElement, value: number) => {
    setChart((prev) => setMultiplier(prev, attacker, defender, value));
  };

  return (
    <section className="admin-layout admin-layout--single">
      <section className="admin-panel" style={{ maxWidth: '100%' }}>
        <h3>Element Chart</h3>
        <p className="admin-note">
          Rows = defender element, columns = attacker element. Multiplier applied to damage (e.g. 0.5 = half, 2 = double).
        </p>
        <div className="admin-row">
          <button type="button" className="secondary" onClick={() => void loadAll()} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Reload'}
          </button>
          <button type="button" className="primary" onClick={() => void saveChart()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Chart'}
          </button>
        </div>
        {status && <p className="admin-note">{status}</p>}
        {error && <p className="admin-note" style={{ color: '#f7b9b9' }}>{error}</p>}
        <div className="element-chart-grid-wrap">
          <table className="element-chart-grid">
            <thead>
              <tr>
                <th>Def ↓ / Atk →</th>
                {CRITTER_ELEMENTS.map((a) => (
                  <th key={a}>{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CRITTER_ELEMENTS.map((defender) => (
                <tr key={defender}>
                  <th>{defender}</th>
                  {CRITTER_ELEMENTS.map((attacker) => (
                    <td key={`${defender}-${attacker}`}>
                      <input
                        type="number"
                        min={0}
                        max={4}
                        step={0.25}
                        value={getMultiplier(chart, attacker, defender)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) updateCell(attacker, defender, Math.max(0, Math.min(4, v)));
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
