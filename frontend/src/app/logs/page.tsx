'use client';
import { useEffect, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

type LogEntry = {
  id: number;
  run_id: string;
  po_number?: string;
  agent_name: string;
  timestamp: string;
  inputs: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence?: number;
  rationale: string;
};

const AGENTS = ['All', 'DemandAnalyst', 'SupplierSelector', 'ContainerOptimizer', 'POCompiler'];

const AGENT_COLORS: Record<string, string> = {
  DemandAnalyst:      'badge-blue',
  SupplierSelector:   'badge-purple',
  ContainerOptimizer: 'badge-amber',
  POCompiler:         'badge-green',
};

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

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Decision Log
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Full audit trail — every agent action with inputs, outputs, and rationale.
          </p>
        </div>
        <button onClick={fetchLogs} className="btn-outline" style={{ marginTop: 4 }}>
          Refresh
        </button>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {AGENTS.map(a => {
          const count = a === 'All' ? logs.length : logs.filter(l => l.agent_name === a).length;
          const isActive = filter === a;
          return (
            <button
              key={a}
              onClick={() => setFilter(a)}
              style={{
                padding: '6px 14px',
                borderRadius: 100,
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border)'}`,
                background: isActive ? 'var(--accent-blue-glow)' : 'transparent',
                color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {a}
              {count > 0 && (
                <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Loading decision log…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>
            No log entries yet.
          </p>
          <a href="/pipeline" style={{ color: 'var(--accent-blue)', fontSize: 13, textDecoration: 'none' }}>
            Run a pipeline to generate audit records →
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(entry => {
            const isExpanded = expandedId === entry.id;
            const confPct = entry.confidence != null ? Math.round(entry.confidence * 100) : null;
            return (
              <div key={entry.id} className="card" style={{ overflow: 'hidden' }}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 16,
                    padding: '14px 18px', cursor: 'pointer',
                  }}
                >
                  {/* Confidence */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                      {confPct ?? '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>conf%</div>
                    {confPct != null && (
                      <div style={{
                        width: '100%', height: 3, background: 'var(--border)',
                        borderRadius: 2, marginTop: 5, overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          width: `${confPct}%`,
                          background: confPct >= 80 ? 'var(--accent-green)' : confPct >= 60 ? 'var(--accent-amber)' : 'var(--accent-red)',
                        }} />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span className={`badge ${AGENT_COLORS[entry.agent_name] || 'badge-blue'}`}>
                        {entry.agent_name}
                      </span>
                      {entry.po_number && (
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {entry.po_number}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        run: {entry.run_id?.slice(0, 8)}…
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.rationale}
                    </p>
                  </div>

                  <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {/* Expanded: inputs + outputs */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    <div style={{ padding: 16, borderRight: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Inputs
                      </p>
                      <pre style={{
                        fontSize: 11, background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border)', borderRadius: 6, padding: 12,
                        overflow: 'auto', maxHeight: 200, lineHeight: 1.5,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {JSON.stringify(entry.inputs, null, 2)}
                      </pre>
                    </div>
                    <div style={{ padding: 16 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Output
                      </p>
                      <pre style={{
                        fontSize: 11, background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border)', borderRadius: 6, padding: 12,
                        overflow: 'auto', maxHeight: 200, lineHeight: 1.5,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {JSON.stringify(entry.output, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
