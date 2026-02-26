'use client';
import { useEffect, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

type LogEntry = {
  id: number;
  run_id: string;
  po_number?: string;
  agent_name: string;
  timestamp: string;
  inputs: any;
  output: any;
  confidence?: number;
  rationale: string;
};

const AGENTS = ['All', 'DemandAnalyst', 'SupplierSelector', 'ContainerOptimizer', 'POCompiler'];

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/pipeline/logs?limit=100`);
      const data = await res.json();
      setLogs(data.entries || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = filter === 'All' ? logs : logs.filter(l => l.agent_name === filter);

  const agentColor: Record<string, string> = {
    DemandAnalyst:      'bg-blue-100 text-blue-800',
    SupplierSelector:   'bg-purple-100 text-purple-800',
    ContainerOptimizer: 'bg-orange-100 text-orange-800',
    POCompiler:         'bg-green-100 text-green-800',
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Decision Log</h1>
          <p className="text-gray-500">Full audit trail — every agent action with inputs, outputs, and rationale.</p>
        </div>
        <button onClick={fetchLogs} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {/* Agent filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {AGENTS.map(a => (
          <button
            key={a}
            onClick={() => setFilter(a)}
            className={`px-3 py-1 rounded-full text-sm border transition ${
              filter === a ? 'bg-slate-800 text-white border-slate-800' : 'hover:border-gray-400'
            }`}
          >
            {a}
            {a !== 'All' && (
              <span className="ml-1 text-xs opacity-70">
                ({logs.filter(l => l.agent_name === a).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          No log entries yet. <a href="/pipeline" className="text-blue-600 underline">Run a pipeline</a> to generate audit records.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <div key={entry.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div
                className="flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                {/* Confidence bar */}
                <div className="flex flex-col items-center w-12 shrink-0">
                  <div className="text-lg font-bold text-gray-700">
                    {entry.confidence != null ? Math.round(entry.confidence * 100) : '—'}
                  </div>
                  <div className="text-xs text-gray-400">conf%</div>
                  {entry.confidence != null && (
                    <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full"
                        style={{ width: `${entry.confidence * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${agentColor[entry.agent_name] || 'bg-gray-100 text-gray-700'}`}>
                      {entry.agent_name}
                    </span>
                    {entry.po_number && (
                      <span className="text-xs text-gray-500 font-mono">{entry.po_number}</span>
                    )}
                    <span className="text-xs text-gray-400">run: {entry.run_id?.slice(0, 8)}…</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{entry.rationale}</p>
                </div>
                <span className="text-gray-400 text-sm shrink-0">{expandedId === entry.id ? '▲' : '▼'}</span>
              </div>

              {/* Expanded: inputs + outputs */}
              {expandedId === entry.id && (
                <div className="border-t grid grid-cols-2 divide-x text-xs">
                  <div className="p-4">
                    <p className="font-semibold text-gray-500 mb-2 uppercase tracking-wide text-xs">Inputs</p>
                    <pre className="bg-gray-50 rounded p-3 overflow-auto max-h-48 text-xs leading-relaxed">
                      {JSON.stringify(entry.inputs, null, 2)}
                    </pre>
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-500 mb-2 uppercase tracking-wide text-xs">Output</p>
                    <pre className="bg-gray-50 rounded p-3 overflow-auto max-h-48 text-xs leading-relaxed">
                      {JSON.stringify(entry.output, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
