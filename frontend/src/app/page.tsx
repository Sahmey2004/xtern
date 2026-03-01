'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchHealth } from '@/lib/api';

type RecentPO = {
  po_number: string;
  status: string;
  total_usd: number;
  created_at: string;
  supplier_id: string;
};

type RecentLog = {
  id: number;
  agent_name: string;
  rationale: string;
  confidence?: number;
  timestamp: string;
};

export default function DashboardPage() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recentPOs, setRecentPOs] = useState<RecentPO[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Backend health
    fetchHealth()
      .then(d => setBackendOk(d.status === 'ok'))
      .catch(() => setBackendOk(false));

    // Supabase counts
    async function load() {
      const tables = ['products', 'suppliers', 'forecasts', 'inventory', 'purchase_orders', 'decision_log'];
      const result: Record<string, number> = {};
      for (const t of tables) {
        const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
        result[t] = count ?? 0;
      }
      setCounts(result);

      // Recent POs
      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('po_number, status, total_usd, created_at, supplier_id')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentPOs(pos || []);

      // Recent decision logs
      const { data: logs } = await supabase
        .from('decision_log')
        .select('id, agent_name, rationale, confidence, timestamp')
        .order('timestamp', { ascending: false })
        .limit(5);
      setRecentLogs(logs || []);

      setLoading(false);
    }
    load();
  }, []);

  const stats = [
    { label: 'Products', value: counts.products, accent: 'stat-accent-blue', icon: '◆' },
    { label: 'Suppliers', value: counts.suppliers, accent: 'stat-accent-green', icon: '◈' },
    { label: 'Forecast Rows', value: counts.forecasts, accent: 'stat-accent-amber', icon: '◇' },
    { label: 'Inventory', value: counts.inventory, accent: 'stat-accent-purple', icon: '□' },
    { label: 'Purchase Orders', value: counts.purchase_orders, accent: 'stat-accent-cyan', icon: '○' },
    { label: 'Decisions Logged', value: counts.decision_log, accent: 'stat-accent-red', icon: '≡' },
  ];

  const statusColor: Record<string, string> = {
    draft: 'badge-amber',
    approved: 'badge-green',
    rejected: 'badge-red',
    pending_approval: 'badge-blue',
  };

  const agentColor: Record<string, string> = {
    DemandAnalyst: 'badge-blue',
    SupplierSelector: 'badge-purple',
    ContainerOptimizer: 'badge-amber',
    POCompiler: 'badge-green',
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }} className="animate-fade-up">
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          System overview · Real-time data from Supabase
        </p>
      </div>

      {/* System status bar */}
      <div className="card animate-fade-up stagger-1" style={{ padding: '12px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: backendOk === null ? 'var(--text-muted)' : backendOk ? 'var(--accent-green)' : 'var(--accent-red)',
            boxShadow: backendOk ? '0 0 8px var(--accent-green)' : 'none',
          }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Backend: {backendOk === null ? 'Checking...' : backendOk ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: counts.products > 0 ? 'var(--accent-green)' : 'var(--text-muted)',
            boxShadow: counts.products > 0 ? '0 0 8px var(--accent-green)' : 'none',
          }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Supabase: {counts.products > 0 ? 'Connected' : 'Checking...'}
          </span>
        </div>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          LLM: OpenRouter (Llama 3.1 8B Free)
        </span>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 28 }}>
        {stats.map((s, i) => (
          <div key={s.label} className={`card stat-accent ${s.accent} animate-fade-up stagger-${i + 1}`}
            style={{ padding: '16px 16px 14px', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>
              {s.label}
            </div>
            {loading ? (
              <div className="skeleton" style={{ width: 48, height: 28 }} />
            ) : (
              <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
                {s.value?.toLocaleString() ?? '—'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Two column: Recent POs + Recent Decisions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent POs */}
        <div className="card animate-fade-up stagger-3" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Recent Purchase Orders</span>
            <a href="/approvals" style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none' }}>View all →</a>
          </div>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 20, marginBottom: 12 }} />)}
            </div>
          ) : recentPOs.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No purchase orders yet. <a href="/pipeline" style={{ color: 'var(--accent-blue)' }}>Run a pipeline</a>
            </div>
          ) : (
            <div>
              {recentPOs.map(po => (
                <div key={po.po_number} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {po.po_number}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {po.supplier_id}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                      ${po.total_usd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`badge ${statusColor[po.status] || 'badge-blue'}`}>
                      {po.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Decisions */}
        <div className="card animate-fade-up stagger-4" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Recent Agent Decisions</span>
            <a href="/logs" style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none' }}>View all →</a>
          </div>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 20, marginBottom: 12 }} />)}
            </div>
          ) : recentLogs.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No decisions logged yet
            </div>
          ) : (
            <div>
              {recentLogs.map(log => (
                <div key={log.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span className={`badge ${agentColor[log.agent_name] || 'badge-blue'}`} style={{ marginTop: 2, flexShrink: 0 }}>
                    {log.agent_name?.replace(/([A-Z])/g, ' $1').trim().split(' ')[0]}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.rationale}
                    </p>
                  </div>
                  {log.confidence != null && (
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {Math.round(log.confidence * 100)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
