'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { fetchDecisionLogs, fetchHealth, fetchPurchaseOrders, type DecisionLogEntry, type PurchaseOrder } from '@/lib/api';

type RecentPO = {
  po_number: string;
  status: string;
  total_usd: number;
  created_at: string;
  supplier_id: string;
};

export default function DashboardPage() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recentPOs, setRecentPOs] = useState<RecentPO[]>([]);
  const [recentLogs, setRecentLogs] = useState<DecisionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth()
      .then(data => setBackendOk(data.status === 'ok'))
      .catch(() => setBackendOk(false));

    async function loadDashboardData() {
      try {
        const [summaryRes, poData, logData] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/data-summary`).then(res => res.json()),
          fetchPurchaseOrders({ status: 'all', limit: 6 }),
          fetchDecisionLogs({ limit: 6 }),
        ]);
        setCounts(summaryRes?.counts || {});

        const mappedPOs: RecentPO[] = (poData as PurchaseOrder[]).map(po => ({
          po_number: po.po_number,
          status: po.status,
          total_usd: po.total_usd,
          created_at: po.created_at,
          supplier_id: po.po_line_items?.[0]?.supplier_id || '-',
        }));
        setRecentPOs(mappedPOs);
        setRecentLogs(logData);
      } catch {
        setCounts({});
        setRecentPOs([]);
        setRecentLogs([]);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboardData();
  }, []);

  const statCards = useMemo(
    () => [
      { label: 'Products', value: counts.products, hint: 'Catalog SKUs available', tone: 'blue' },
      { label: 'Suppliers', value: counts.suppliers, hint: 'Vendors in the network', tone: 'indigo' },
      { label: 'Forecast Rows', value: counts.forecasts, hint: 'Demand forecast records', tone: 'teal' },
      { label: 'Inventory', value: counts.inventory, hint: 'Inventory positions tracked', tone: 'emerald' },
      { label: 'Purchase Orders', value: counts.purchase_orders, hint: 'POs created in system', tone: 'amber' },
      { label: 'Decision Logs', value: counts.decision_log, hint: 'Agent decisions audited', tone: 'rose' },
    ],
    [counts],
  );

  return (
    <div className="page-shell">
      <section className="surface-card p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Operations Dashboard</p>
            <h1 className="page-title">Real-time procurement command center</h1>
            <p className="page-subtitle">Track system health, data readiness, purchase orders, and agent decisions in one unified workspace.</p>
          </div>
          <Link href="/pipeline" className="button button-primary">
            Trigger New Pipeline Run
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <div className={`status-chip ${backendOk ? 'status-chip-success' : 'status-chip-error'}`}>
            <span className="status-dot" />
            Backend {backendOk === null ? 'Checking' : backendOk ? 'Connected' : 'Offline'}
          </div>
          <div className={`status-chip ${counts.products > 0 ? 'status-chip-success' : 'status-chip-warn'}`}>
            <span className="status-dot" />
            Supabase {counts.products > 0 ? 'Seeded' : 'Awaiting data'}
          </div>
          <div className="status-chip status-chip-neutral">LLM Provider OpenAI</div>
        </div>
      </section>

      <section className="metric-grid">
        {statCards.map(card => (
          <article key={card.label} className={`surface-card metric-card metric-card-${card.tone}`}>
            <p className="metric-label">{card.label}</p>
            {loading ? <div className="loading-line mt-3 h-8 w-20" /> : <p className="metric-value">{card.value?.toLocaleString() ?? '0'}</p>}
            <p className="metric-hint">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="bento-dashboard">
        <article className="surface-card p-0 overflow-hidden">
          <header className="panel-header">
            <div>
              <p className="panel-title">Recent Purchase Orders</p>
              <p className="panel-subtitle">Latest draft and approved orders</p>
            </div>
            <Link href="/approvals" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Open approvals
            </Link>
          </header>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-5 space-y-3">
                <div className="loading-line h-5 w-full" />
                <div className="loading-line h-5 w-full" />
                <div className="loading-line h-5 w-4/5" />
              </div>
            ) : recentPOs.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No purchase orders yet. Run the pipeline to generate a draft PO.</div>
            ) : (
              recentPOs.map(po => (
                <div key={po.po_number} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{po.po_number}</p>
                    <p className="text-xs text-slate-500">{po.supplier_id} · {new Date(po.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">${po.total_usd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <span className={`status-pill status-pill-${po.status || 'draft'}`}>{po.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="surface-card p-0 overflow-hidden">
          <header className="panel-header">
            <div>
              <p className="panel-title">Latest Agent Decisions</p>
              <p className="panel-subtitle">Most recent rationale snapshots</p>
            </div>
            <Link href="/logs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View logs
            </Link>
          </header>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-5 space-y-3">
                <div className="loading-line h-5 w-full" />
                <div className="loading-line h-5 w-full" />
                <div className="loading-line h-5 w-4/5" />
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No decisions logged yet. Execute a pipeline run to populate this feed.</div>
            ) : (
              recentLogs.map(log => (
                <div key={log.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{log.agent_name}</p>
                    <span className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 line-clamp-2">{log.rationale}</p>
                  {log.confidence != null && (
                    <p className="mt-2 text-xs font-medium text-brand-700">Confidence {Math.round(log.confidence * 100)}%</p>
                  )}
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
