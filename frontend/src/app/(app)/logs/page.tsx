'use client';

import { useEffect, useMemo, useState } from 'react';

import { fetchDecisionLogs, type DecisionLogEntry } from '@/lib/api';

const FILTERS = ['All', 'DemandAnalyst', 'SupplierSelector', 'ContainerOptimizer', 'POCompiler', 'HumanApproval'] as const;
type Filter = (typeof FILTERS)[number];

export default function LogsPage() {
  const [logs, setLogs] = useState<DecisionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function loadLogs() {
    setLoading(true);
    setError('');
    try {
      const entries = await fetchDecisionLogs({ limit: 100 });
      setLogs(entries);
    } catch (err: unknown) {
      setLogs([]);
      setError(err instanceof Error ? err.message : 'Failed to load decision logs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  const filtered = useMemo(
    () => (filter === 'All' ? logs : logs.filter(entry => entry.agent_name === filter)),
    [filter, logs],
  );

  return (
    <div className="page-shell">
      <section className="surface-card p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Decision Intelligence</p>
            <h1 className="page-title">Audit every agent action</h1>
            <p className="page-subtitle">Filter and inspect full decision payloads, rationale, and confidence for each pipeline run.</p>
          </div>
          <button onClick={() => void loadLogs()} className="button button-secondary">Refresh Logs</button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map(item => (
            <button
              key={item}
              className={`sku-chip ${filter === item ? 'sku-chip-active' : ''}`}
              onClick={() => setFilter(item)}
            >
              {item}
              {item !== 'All' ? ` (${logs.filter(log => log.agent_name === item).length})` : ''}
            </button>
          ))}
        </div>
      </section>

      <section className="surface-card p-0 overflow-hidden">
        {error && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <div className="p-5 space-y-3">
            <div className="loading-line h-5 w-full" />
            <div className="loading-line h-5 w-full" />
            <div className="loading-line h-5 w-4/5" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No decision logs found for this filter.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(entry => (
              <article key={entry.id}>
                <button
                  className="w-full px-5 py-4 text-left hover:bg-slate-50 transition"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{entry.agent_name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        run {entry.run_id?.slice(0, 8)}... {entry.po_number ? `· ${entry.po_number}` : ''}
                      </p>
                      <p className="text-sm text-slate-600 mt-2">{entry.rationale}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
                      <p className="text-sm font-semibold text-brand-700 mt-1">
                        {entry.confidence != null ? `Confidence ${Math.round(entry.confidence * 100)}%` : 'Confidence N/A'}
                      </p>
                    </div>
                  </div>
                </button>

                {expandedId === entry.id && (
                  <div className="grid gap-0 border-t border-slate-100 md:grid-cols-2">
                    <div className="p-4 border-b border-slate-100 md:border-b-0 md:border-r md:border-slate-100">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2">Inputs</p>
                      <pre className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 overflow-auto max-h-64">
                        {JSON.stringify(entry.inputs, null, 2)}
                      </pre>
                    </div>
                    <div className="p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2">Output</p>
                      <pre className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 overflow-auto max-h-64">
                        {JSON.stringify(entry.output, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
