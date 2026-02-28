'use client';

import { useState } from 'react';

import { type AgentActivityEntry, runPipeline } from '@/lib/api';

type PipelineResult = {
  status: string;
  run_id?: string;
  po_number?: string;
  po_total_usd?: number;
  net_requirements_count?: number;
  supplier_selections_count?: number;
  container_plan?: {
    container_type: string;
    num_containers: number;
    binding_utilisation_pct: number;
    estimated_freight_usd: number;
  };
  demand_rationale?: string;
  supplier_rationale?: string;
  container_rationale?: string;
  po_rationale?: string;
  agent_activity?: Record<string, AgentActivityEntry>;
  error?: string;
};

const SAMPLE_SKUS = ['FLT-001', 'FLT-002', 'ENG-001', 'ELC-001', 'GSK-001'];

const AGENT_TABS = [
  { key: 'DemandAnalyst', label: 'Demand Analyst', desc: 'Calculating net requirements from inventory and forecast data.' },
  { key: 'SupplierSelector', label: 'Supplier Selector', desc: 'Scoring suppliers and selecting the best fit for each SKU.' },
  { key: 'ContainerOptimizer', label: 'Container Optimizer', desc: 'Planning container allocation and estimated freight.' },
  { key: 'POCompiler', label: 'PO Compiler', desc: 'Compiling the draft PO and generating the final summary.' },
] as const;

const STEP_ORDER = AGENT_TABS.map(agent => agent.key);

function formatDetailValue(value: unknown) {
  if (value == null) return 'N/A';
  if (Array.isArray(value)) {
    return value.length === 0 ? 'None' : JSON.stringify(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export default function PipelinePage() {
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [customSku, setCustomSku] = useState('');
  const [horizon, setHorizon] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [currentAgentKey, setCurrentAgentKey] = useState<(typeof STEP_ORDER)[number]>('DemandAnalyst');
  const [activeAgentTab, setActiveAgentTab] = useState<(typeof STEP_ORDER)[number]>('DemandAnalyst');

  const toggleSku = (sku: string) =>
    setSelectedSkus(prev => prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku]);

  const addCustomSku = () => {
    const sku = customSku.trim().toUpperCase();
    if (sku && !selectedSkus.includes(sku)) setSelectedSkus(prev => [...prev, sku]);
    setCustomSku('');
  };

  const handleRun = async () => {
    setLoading(true);
    setResult(null);
    setCurrentAgentKey('DemandAnalyst');
    setActiveAgentTab('DemandAnalyst');

    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx = (stepIdx + 1) % STEP_ORDER.length;
      setCurrentAgentKey(STEP_ORDER[stepIdx]);
    }, 4000);

    try {
      const data = await runPipeline(selectedSkus, horizon);
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Pipeline request failed.';
      setResult({ status: 'error', error: message });
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const getStepStatus = (agentKey: (typeof STEP_ORDER)[number]) => {
    if (loading) {
      const current = STEP_ORDER.indexOf(currentAgentKey);
      const idx = STEP_ORDER.indexOf(agentKey);
      if (idx < current) return 'done';
      if (idx === current) return 'active';
      return 'waiting';
    }

    if (!result) return 'idle';

    const agentEntry = result.agent_activity?.[agentKey];
    if (agentEntry?.status === 'completed') return 'done';
    if (agentEntry?.status === 'failed') return 'failed';

    let lastFinished: (typeof STEP_ORDER)[number] | undefined;
    for (const key of [...STEP_ORDER].reverse()) {
      if (result.agent_activity?.[key]) {
        lastFinished = key;
        break;
      }
    }
    if (!lastFinished) return 'idle';

    return STEP_ORDER.indexOf(agentKey) <= STEP_ORDER.indexOf(lastFinished) ? 'done' : 'idle';
  };

  const fallbackSummaryByAgent: Record<string, string | undefined> = {
    DemandAnalyst: result?.demand_rationale,
    SupplierSelector: result?.supplier_rationale,
    ContainerOptimizer: result?.container_rationale,
    POCompiler: result?.po_rationale,
  };

  const activeAgentEntry = result?.agent_activity?.[activeAgentTab];
  const activeAgentMeta = AGENT_TABS.find(agent => agent.key === activeAgentTab)!;
  const activeSummary = loading
    ? activeAgentMeta.desc
    : activeAgentEntry?.summary || fallbackSummaryByAgent[activeAgentTab] || 'No summary available yet.';
  const detailEntries: [string, unknown][] = loading
    ? [['current_work', activeAgentMeta.desc]]
    : Object.entries(activeAgentEntry?.details || {});

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Run Pipeline</h1>
      <p className="text-gray-500 mb-8">Trigger the multi-agent PO automation pipeline and inspect each agent&apos;s status.</p>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="font-semibold text-lg mb-4">Pipeline Configuration</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Planning Horizon
          </label>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={horizon}
            onChange={e => setHorizon(Number(e.target.value))}
          >
            <option value={1}>1 month</option>
            <option value={2}>2 months</option>
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            SKU Selection
            <span className="ml-2 text-gray-400 font-normal">(leave empty = auto-select below-reorder SKUs)</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {SAMPLE_SKUS.map(sku => (
              <button
                key={sku}
                onClick={() => toggleSku(sku)}
                className={`px-3 py-1 rounded-full text-sm border transition ${
                  selectedSkus.includes(sku)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                {sku}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="border rounded px-3 py-1.5 text-sm flex-1 max-w-xs"
              placeholder="Add custom SKU (e.g. ENG-003)"
              value={customSku}
              onChange={e => setCustomSku(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomSku()}
            />
            <button
              onClick={addCustomSku}
              className="px-4 py-1.5 text-sm border rounded hover:bg-gray-50"
            >
              Add
            </button>
          </div>
          {selectedSkus.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Selected: {selectedSkus.join(', ')}
            </p>
          )}
        </div>

        <button
          onClick={handleRun}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Pipeline Running…' : 'Run Pipeline'}
        </button>
      </div>

      {(loading || result) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col gap-2 mb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-lg">Agent Activity</h2>
              <p className="text-sm text-gray-500">Each tab shows the current status, summary, and structured details for one agent.</p>
            </div>
            {result?.status === 'error' && result.error && (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-red-100 text-red-700">
                Pipeline failed
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {AGENT_TABS.map(agent => {
              const status = getStepStatus(agent.key);
              const statusClass =
                status === 'done' ? 'bg-green-100 text-green-700 border-green-200' :
                status === 'active' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                status === 'failed' ? 'bg-red-100 text-red-700 border-red-200' :
                'bg-gray-100 text-gray-600 border-gray-200';

              return (
                <button
                  key={agent.key}
                  onClick={() => setActiveAgentTab(agent.key)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                    activeAgentTab === agent.key ? 'ring-2 ring-blue-200' : ''
                  } ${statusClass}`}
                >
                  {agent.label}
                </button>
              );
            })}
          </div>

          <div className="border rounded-lg p-5 bg-slate-50">
            <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="font-semibold text-base text-slate-900">{activeAgentMeta.label}</h3>
                <p className="text-sm text-slate-600 mt-1">{activeSummary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  getStepStatus(activeAgentTab) === 'done' ? 'bg-green-100 text-green-700' :
                  getStepStatus(activeAgentTab) === 'active' ? 'bg-blue-100 text-blue-700' :
                  getStepStatus(activeAgentTab) === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {loading && activeAgentTab === currentAgentKey ? 'Running' : activeAgentEntry?.status || getStepStatus(activeAgentTab)}
                </span>
                {activeAgentEntry?.confidence != null && (
                  <span className="text-xs px-3 py-1 rounded-full bg-white text-slate-700 border">
                    Confidence {Math.round(activeAgentEntry.confidence * 100)}%
                  </span>
                )}
                {!loading && (
                  <span className={`text-xs px-3 py-1 rounded-full border ${
                    activeAgentEntry?.llm_used ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {activeAgentEntry?.llm_used ? 'OpenRouter used' : 'No LLM call'}
                  </span>
                )}
              </div>
            </div>

            {activeAgentEntry?.llm_error && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {activeAgentEntry.llm_error}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {detailEntries.map(([key, value]) => (
                <div key={key} className="rounded-md bg-white border px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-slate-800 mt-1 break-words">{formatDetailValue(value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className={`rounded-lg shadow p-6 ${result.status === 'error' ? 'bg-red-50' : 'bg-green-50'}`}>
          <h2 className="font-semibold text-lg mb-4">
            {result.status === 'error' ? 'Pipeline Failed' : 'Pipeline Complete'}
          </h2>

          {result.error && (
            <p className="text-red-700 text-sm mb-4 font-mono bg-red-100 p-3 rounded">{result.error}</p>
          )}

          {result.po_number && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'PO Number', value: result.po_number },
                { label: 'Total Value', value: `$${result.po_total_usd?.toLocaleString()}` },
                { label: 'SKUs Ordered', value: result.supplier_selections_count },
                { label: 'Container Type', value: result.container_plan ? `${result.container_plan.num_containers}x ${result.container_plan.container_type}` : 'N/A' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded p-4 shadow-sm">
                  <p className="text-xs text-gray-500">{card.label}</p>
                  <p className="font-bold text-lg mt-1">{card.value ?? '—'}</p>
                </div>
              ))}
            </div>
          )}

          {result.po_number && (
            <div className="mt-4 flex gap-3">
              <a
                href="/approvals"
                className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 text-sm"
              >
                Go to Approvals
              </a>
              <a
                href="/logs"
                className="border px-5 py-2 rounded hover:bg-gray-50 text-sm"
              >
                View Decision Log
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
