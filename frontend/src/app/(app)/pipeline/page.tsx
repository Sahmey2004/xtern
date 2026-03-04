'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fetchDecisionLogs, runPipeline, type AgentActivityEntry, type DecisionLogEntry, type PipelineRunResponse } from '@/lib/api';

const SAMPLE_SKUS = ['FLT-001', 'FLT-002', 'ENG-001', 'ELC-001', 'GSK-001'];

const AGENT_ORDER = ['DemandAnalyst', 'SupplierSelector', 'ContainerOptimizer', 'POCompiler'] as const;
type AgentKey = (typeof AGENT_ORDER)[number];

const AGENT_LABELS: Record<AgentKey, { label: string; desc: string }> = {
  DemandAnalyst: {
    label: 'Demand Analyst',
    desc: 'Calculates replenishment requirements from inventory and forecast data.',
  },
  SupplierSelector: {
    label: 'Supplier Selector',
    desc: 'Scores supplier options and recommends the best vendor per SKU.',
  },
  ContainerOptimizer: {
    label: 'Container Optimizer',
    desc: 'Produces container allocation and freight estimates.',
  },
  POCompiler: {
    label: 'PO Compiler',
    desc: 'Generates the final draft PO summary and write-back payload.',
  },
};

const PIE_COLORS = ['#12B76A', '#F79009', '#F04438', '#98A2B3'];

function formatDetailValue(value: unknown) {
  if (value == null) return 'N/A';
  if (Array.isArray(value)) return value.length === 0 ? 'None' : JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function safeConfidence(entry?: AgentActivityEntry) {
  return entry?.confidence != null ? Math.round(entry.confidence * 100) : 0;
}

export default function PipelinePage() {
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [customSku, setCustomSku] = useState('');
  const [horizon, setHorizon] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineRunResponse | null>(null);
  const [decisionLogs, setDecisionLogs] = useState<DecisionLogEntry[]>([]);
  const [activeAgentTab, setActiveAgentTab] = useState<AgentKey>('DemandAnalyst');
  const [confidenceView, setConfidenceView] = useState<'bar' | 'radar'>('bar');

  useEffect(() => {
    async function loadInitialLogs() {
      try {
        const logs = await fetchDecisionLogs({ limit: 80 });
        setDecisionLogs(logs);
      } catch {
        setDecisionLogs([]);
      }
    }
    void loadInitialLogs();
  }, []);

  useEffect(() => {
    const runId = result?.run_id;
    if (!runId) return;
    async function loadRunLogs() {
      try {
        const logs = await fetchDecisionLogs({ runId, limit: 100 });
        setDecisionLogs(logs);
      } catch {
        // Keep prior logs if scoped fetch fails.
      }
    }
    void loadRunLogs();
  }, [result?.run_id]);

  const toggleSku = (sku: string) =>
    setSelectedSkus(prev => prev.includes(sku) ? prev.filter(current => current !== sku) : [...prev, sku]);

  const addCustomSku = () => {
    const sku = customSku.trim().toUpperCase();
    if (sku && !selectedSkus.includes(sku)) {
      setSelectedSkus(prev => [...prev, sku]);
    }
    setCustomSku('');
  };

  const handleRun = async () => {
    setLoading(true);
    setResult(null);
    setActiveAgentTab('DemandAnalyst');
    const payload = await runPipeline(selectedSkus, horizon);
    setResult(payload);
    setLoading(false);
  };

  const agentEntries = useMemo(() => {
    const entries = result?.agent_activity || {};
    return AGENT_ORDER.map(key => ({
      key,
      ...AGENT_LABELS[key],
      entry: entries[key],
    }));
  }, [result?.agent_activity]);

  const confidenceChartData = useMemo(
    () =>
      agentEntries.map(agent => ({
        agent: agent.label,
        confidence: safeConfidence(agent.entry),
      })),
    [agentEntries],
  );

  const statusDistribution = useMemo(() => {
    const counts = {
      completed: 0,
      running: 0,
      failed: 0,
      idle: 0,
    };

    AGENT_ORDER.forEach(key => {
      const status = result?.agent_activity?.[key]?.status;
      if (loading && !status) {
        counts.running += 1;
      } else if (status === 'completed') {
        counts.completed += 1;
      } else if (status === 'failed') {
        counts.failed += 1;
      } else {
        counts.idle += 1;
      }
    });

    return [
      { name: 'Completed', value: counts.completed },
      { name: 'Running', value: counts.running },
      { name: 'Failed', value: counts.failed },
      { name: 'Idle', value: counts.idle },
    ];
  }, [loading, result?.agent_activity]);

  const trendData = useMemo(() => {
    const logsWithConfidence = decisionLogs.filter(log => log.confidence != null).slice(0, 24);
    return logsWithConfidence.map((log, index) => ({
      index: index + 1,
      confidence: Math.round((log.confidence || 0) * 100),
      agent: log.agent_name,
    }));
  }, [decisionLogs]);

  const activeAgent = AGENT_LABELS[activeAgentTab];
  const activeAgentEntry = result?.agent_activity?.[activeAgentTab];
  const detailEntries = Object.entries(activeAgentEntry?.details || {});
  const isClient = typeof window !== 'undefined';

  const runMetrics = [
    { label: 'OpenAI Requests', value: result?.openai_requests_made ?? 0, hint: 'Calls made during this run' },
    { label: 'Net Requirements', value: result?.net_requirements_count ?? 0, hint: 'SKUs requiring replenishment' },
    { label: 'Suppliers Selected', value: result?.supplier_selections_count ?? 0, hint: 'Line items matched to suppliers' },
    {
      label: 'Container Utilization',
      value: result?.container_plan?.binding_utilisation_pct != null ? `${Math.round(result.container_plan.binding_utilisation_pct)}%` : 'N/A',
      hint: 'Binding utilization from optimizer',
    },
  ];

  return (
    <div className="page-shell">
      <section className="surface-card p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="eyebrow">Pipeline Studio</p>
            <h1 className="page-title">Run procurement agents with live observability</h1>
            <p className="page-subtitle">
              Configure SKUs and planning horizon, then inspect confidence, urgency, and decision quality.
            </p>
          </div>
          <button onClick={handleRun} disabled={loading} className="button button-primary">
            {loading ? 'Running Pipeline...' : 'Run Pipeline'}
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="field-label">Planning Horizon</label>
            <select className="field-input" value={horizon} onChange={event => setHorizon(Number(event.target.value))}>
              <option value={1}>1 month</option>
              <option value={2}>2 months</option>
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="field-label">SKU Selection</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {SAMPLE_SKUS.map(sku => (
                <button
                  key={sku}
                  onClick={() => toggleSku(sku)}
                  className={`sku-chip ${selectedSkus.includes(sku) ? 'sku-chip-active' : ''}`}
                >
                  {sku}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="field-input"
                value={customSku}
                placeholder="Add custom SKU"
                onChange={event => setCustomSku(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && addCustomSku()}
              />
              <button onClick={addCustomSku} className="button button-secondary">Add</button>
            </div>
          </div>

          <div className="surface-subtle p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Selected SKUs</p>
            <p className="mt-3 text-sm text-slate-700">{selectedSkus.length > 0 ? selectedSkus.join(', ') : 'Auto-select below reorder point'}</p>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        {runMetrics.map(metric => (
          <article key={metric.label} className="surface-card metric-card metric-card-indigo">
            <p className="metric-label">{metric.label}</p>
            <p className="metric-value">{metric.value}</p>
            <p className="metric-hint">{metric.hint}</p>
          </article>
        ))}
      </section>

      <section className="chart-grid">
        <article className="surface-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="panel-title">Agent Confidence</p>
              <p className="panel-subtitle">Confidence score by agent in the latest run</p>
            </div>
            <div className="segmented-control">
              <button className={`segment ${confidenceView === 'bar' ? 'segment-active' : ''}`} onClick={() => setConfidenceView('bar')}>
                Bar
              </button>
              <button className={`segment ${confidenceView === 'radar' ? 'segment-active' : ''}`} onClick={() => setConfidenceView('radar')}>
                Radar
              </button>
            </div>
          </div>

          <div className="h-72">
            {!isClient ? (
              <div className="loading-line h-full w-full" />
            ) : confidenceView === 'bar' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confidenceChartData}>
                  <XAxis dataKey="agent" tick={{ fill: '#475467', fontSize: 11 }} interval={0} angle={-10} textAnchor="end" height={70} />
                  <YAxis tick={{ fill: '#475467', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="confidence" radius={[6, 6, 0, 0]} fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={confidenceChartData}>
                  <PolarGrid stroke="#E4E7EC" />
                  <PolarAngleAxis dataKey="agent" tick={{ fill: '#475467', fontSize: 11 }} />
                  <Radar dataKey="confidence" fill="#2E90FA" stroke="#1570EF" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="surface-card p-6">
          <p className="panel-title">Agent Status Distribution</p>
          <p className="panel-subtitle mb-4">Execution status split for the active run state</p>
          <div className="h-72">
            {!isClient ? (
              <div className="loading-line h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusDistribution} dataKey="value" innerRadius={65} outerRadius={100} paddingAngle={3}>
                    {statusDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {statusDistribution.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2 text-slate-600">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index] }} />
                {entry.name} ({entry.value})
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card p-6 md:col-span-2">
          <p className="panel-title">Recent Decision Confidence Trend</p>
          <p className="panel-subtitle mb-4">Live confidence telemetry from decision logs</p>
          <div className="h-64">
            {!isClient ? (
              <div className="loading-line h-full w-full" />
            ) : trendData.length === 0 ? (
              <div className="h-full rounded-xl border border-dashed border-slate-300 bg-slate-50 grid place-items-center text-sm text-slate-500">
                No confidence data yet. Run the pipeline to populate this chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <XAxis dataKey="index" tick={{ fill: '#475467', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#475467', fontSize: 11 }} />
                  <Tooltip />
                  <Area dataKey="confidence" type="monotone" stroke="#2563EB" fill="#BFDBFE" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <section className="surface-card p-6">
        <div className="flex flex-col gap-2 mb-5">
          <p className="panel-title">Agent Activity Workspace</p>
          <p className="panel-subtitle">Inspect structured details for each agent in the latest run.</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {AGENT_ORDER.map(key => {
            const entry = result?.agent_activity?.[key];
            const stateClass = entry?.status === 'completed'
              ? 'sku-chip-success'
              : entry?.status === 'failed'
                ? 'sku-chip-danger'
                : 'sku-chip-muted';
            return (
              <button key={key} onClick={() => setActiveAgentTab(key)} className={`sku-chip ${stateClass} ${activeAgentTab === key ? 'ring-2 ring-brand-200' : ''}`}>
                {AGENT_LABELS[key].label}
              </button>
            );
          })}
        </div>

        <div className="surface-subtle rounded-xl border border-slate-200 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{activeAgent.label}</h3>
              <p className="text-sm text-slate-600 mt-1">
                {activeAgentEntry?.summary || activeAgent.desc}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="status-chip status-chip-neutral">{activeAgentEntry?.status || (loading ? 'running' : 'idle')}</span>
              {activeAgentEntry?.confidence != null && (
                <span className="status-chip status-chip-neutral">Confidence {Math.round(activeAgentEntry.confidence * 100)}%</span>
              )}
              <span className={`status-chip ${activeAgentEntry?.llm_used ? 'status-chip-success' : 'status-chip-warn'}`}>
                {activeAgentEntry?.llm_used ? 'OpenAI used' : 'No LLM call'}
              </span>
            </div>
          </div>

          {activeAgentEntry?.llm_error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {activeAgentEntry.llm_error}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {detailEntries.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 md:col-span-2">
                No structured details yet for this agent.
              </div>
            ) : (
              detailEntries.map(([key, value]) => (
                <div key={key} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{key.replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-sm text-slate-700 break-words">{formatDetailValue(value)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {result?.error && (
        <section className="surface-card border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {result.error}
        </section>
      )}
    </div>
  );
}
