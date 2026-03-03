'use client';

import { useState } from 'react';
import {
  startPipeline,
  continueAgent,
  approvePO,
  type NetRequirement,
  type SupplierSelection,
  type ContainerPlan,
  type AgentActivityEntry,
} from '@/lib/api';

// ─── OLD IMPORTS (kept for reference) ────────────────────────
// import { type AgentActivityEntry, runPipeline } from '@/lib/api';

// ─── OLD TYPES (kept for reference) ──────────────────────────
// type PipelineResult = {
//   status: string;
//   run_id?: string;
//   po_number?: string;
//   po_total_usd?: number;
//   net_requirements_count?: number;
//   supplier_selections_count?: number;
//   container_plan?: {
//     container_type: string;
//     num_containers: number;
//     binding_utilisation_pct: number;
//     estimated_freight_usd: number;
//   };
//   demand_rationale?: string;
//   supplier_rationale?: string;
//   container_rationale?: string;
//   po_rationale?: string;
//   agent_activity?: Record<string, AgentActivityEntry>;
//   error?: string;
// };

// ─── OLD CONSTANTS (kept for reference) ──────────────────────
// const AGENT_TABS = [
//   { key: 'DemandAnalyst', label: 'Demand Analyst', desc: '...' },
//   { key: 'SupplierSelector', label: 'Supplier Selector', desc: '...' },
//   { key: 'ContainerOptimizer', label: 'Container Optimizer', desc: '...' },
//   { key: 'POCompiler', label: 'PO Compiler', desc: '...' },
// ] as const;
// const STEP_ORDER = AGENT_TABS.map(agent => agent.key);
// function formatDetailValue(value: unknown) {
//   if (value == null) return 'N/A';
//   if (Array.isArray(value)) return value.length === 0 ? 'None' : JSON.stringify(value);
//   if (typeof value === 'object') return JSON.stringify(value);
//   return String(value);
// }

const SAMPLE_SKUS = ['FLT-001', 'FLT-002', 'ENG-001', 'ELC-001', 'GSK-001'];

type Step =
  | 'idle'
  | 'running_demand'
  | 'review_demand'
  | 'running_supplier'
  | 'review_supplier'
  | 'running_container'
  | 'review_container'
  | 'running_po'
  | 'review_po'
  | 'done'
  | 'error';

export default function PipelinePage() {
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [customSku, setCustomSku] = useState('');
  const [horizon, setHorizon] = useState(3);
  const [step, setStep] = useState<Step>('idle');
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [netRequirements, setNetRequirements] = useState<NetRequirement[]>([]);
  const [demandRationale, setDemandRationale] = useState('');
  const [supplierSelections, setSupplierSelections] = useState<SupplierSelection[]>([]);
  const [supplierRationale, setSupplierRationale] = useState('');
  const [supplierPicks, setSupplierPicks] = useState<Record<string, SupplierSelection>>({});
  const [containerPlan, setContainerPlan] = useState<ContainerPlan | null>(null);
  const [containerRationale, setContainerRationale] = useState('');
  const [poNumber, setPoNumber] = useState<string | null>(null);
  const [poTotal, setPoTotal] = useState<number | null>(null);
  const [poRationale, setPoRationale] = useState('');
  const [agentActivity, setAgentActivity] = useState<Record<string, AgentActivityEntry>>({});
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);

  const toggleSku = (sku: string) =>
    setSelectedSkus(prev => prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku]);

  const addCustomSku = () => {
    const sku = customSku.trim().toUpperCase();
    if (sku && !selectedSkus.includes(sku)) setSelectedSkus(prev => [...prev, sku]);
    setCustomSku('');
  };

  const handleStart = async () => {
    setStep('running_demand');
    setError(null);
    try {
      const data = await startPipeline(selectedSkus, horizon);
      setRunId(data.run_id);
      setNetRequirements(data.net_requirements);
      setDemandRationale(data.demand_rationale);
      setAgentActivity(prev => ({ ...prev, ...data.agent_activity }));
      setStep('review_demand');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start pipeline.');
      setStep('error');
    }
  };

  const handleRunSupplier = async () => {
    if (!runId) return;
    setStep('running_supplier');
    try {
      const data = await continueAgent(runId, 'supplier_selector');
      setSupplierSelections(data.supplier_selections || []);
      setSupplierRationale(data.supplier_rationale || '');
      setAgentActivity(prev => ({ ...prev, ...data.agent_activity }));
      const defaults: Record<string, SupplierSelection> = {};
      for (const sel of data.supplier_selections || []) {
        if (sel.supplier_id) defaults[sel.sku] = sel;
      }
      setSupplierPicks(defaults);
      setStep('review_supplier');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Supplier selection failed.');
      setStep('error');
    }
  };

  const handleRunContainer = async () => {
    if (!runId) return;
    setStep('running_container');
    try {
      const overrides = Object.values(supplierPicks).map(s => ({
        sku: s.sku,
        supplier_id: s.supplier_id!,
        supplier_name: s.supplier_name!,
        unit_price: s.unit_price!,
        lead_time_days: s.lead_time_days!,
        score: s.score!,
      }));
      const data = await continueAgent(runId, 'container_optimizer', overrides);
      setContainerPlan(data.container_plan || null);
      setContainerRationale(data.container_rationale || '');
      setAgentActivity(prev => ({ ...prev, ...data.agent_activity }));
      setStep('review_container');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Container optimization failed.');
      setStep('error');
    }
  };

  const handleRunPO = async () => {
    if (!runId) return;
    setStep('running_po');
    try {
      const data = await continueAgent(runId, 'po_compiler');
      setPoNumber(data.po_number || null);
      setPoTotal(data.po_total_usd || null);
      setPoRationale(data.po_rationale || '');
      setApprovalStatus(data.approval_status || null);
      setAgentActivity(prev => ({ ...prev, ...data.agent_activity }));
      setStep('review_po');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'PO compilation failed.');
      setStep('error');
    }
  };

  const handleApproval = async (action: 'approve' | 'reject') => {
    if (!poNumber) return;
    try {
      await approvePO(poNumber, 'planner', '', action);
      setApprovalStatus(action === 'approve' ? 'approved' : 'rejected');
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approval failed.');
    }
  };

  const isRunning = ['running_demand', 'running_supplier', 'running_container', 'running_po'].includes(step);

  const STEPS = [
    { key: 'demand', label: 'Demand Analyst' },
    { key: 'supplier', label: 'Supplier Selector' },
    { key: 'container', label: 'Container Optimizer' },
    { key: 'po', label: 'PO Compiler' },
  ];

  const stepIndex = ({
    idle: -1,
    running_demand: 0, review_demand: 0,
    running_supplier: 1, review_supplier: 1,
    running_container: 2, review_container: 2,
    running_po: 3, review_po: 3,
    done: 4, error: -1,
  } as Record<Step, number>)[step] ?? -1;

  const resetPipeline = () => {
    setStep('idle');
    setRunId(null);
    setError(null);
    setNetRequirements([]);
    setSupplierSelections([]);
    setSupplierPicks({});
    setContainerPlan(null);
    setPoNumber(null);
    setPoTotal(null);
    setAgentActivity({});
    setApprovalStatus(null);
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Run Pipeline</h1>
      <p className="text-gray-500 mb-8">
        Each agent runs one at a time. Review the results and confirm before the next agent starts.
      </p>

      {/* ── Configuration ── */}
      {step === 'idle' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="font-semibold text-lg mb-4">Pipeline Configuration</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Planning Horizon</label>
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
          <div className="mb-6">
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
              <button onClick={addCustomSku} className="px-4 py-1.5 text-sm border rounded hover:bg-gray-50">
                Add
              </button>
            </div>
            {selectedSkus.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">Selected: {selectedSkus.join(', ')}</p>
            )}
          </div>
          <button
            onClick={handleStart}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Start Pipeline
          </button>
        </div>
      )}

      {/* ── Progress bar ── */}
      {step !== 'idle' && step !== 'error' && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition ${
                    i < stepIndex ? 'bg-green-500 border-green-500 text-white' :
                    i === stepIndex ? 'bg-blue-600 border-blue-600 text-white' :
                    'bg-white border-gray-300 text-gray-400'
                  }`}>
                    {i < stepIndex ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs mt-1 text-center w-20 ${i === stepIndex ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-5 mx-1 ${i < stepIndex ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading spinner ── */}
      {isRunning && (
        <div className="bg-white rounded-lg shadow p-8 mb-6 flex items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <div>
            <p className="font-medium text-gray-800">Agent running...</p>
            <p className="text-sm text-gray-500">This may take 10–30 seconds</p>
          </div>
        </div>
      )}

      {/* ── Step 1: Demand Analyst Results ── */}
      {step === 'review_demand' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-lg">Demand Analyst Results</h2>
              <p className="text-sm text-gray-500 mt-1">{demandRationale}</p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
              {netRequirements.length} SKUs need replenishment
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border mb-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['SKU', 'Net Qty', 'Current Stock', 'Safety Stock', 'Forecast Demand', 'Urgency'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {netRequirements.map(req => (
                  <tr key={req.sku} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium">{req.sku}</td>
                    <td className="px-4 py-3 font-bold text-blue-700">{req.net_qty.toLocaleString()}</td>
                    <td className="px-4 py-3">{req.current_stock.toLocaleString()}</td>
                    <td className="px-4 py-3">{req.safety_stock.toLocaleString()}</td>
                    <td className="px-4 py-3">{req.forecast_demand.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        req.urgency === 'critical' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {req.urgency}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleRunSupplier} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
            Continue to Supplier Selection →
          </button>
        </div>
      )}

      {/* ── Step 2: Supplier Selector Results ── */}
      {step === 'review_supplier' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-lg">Supplier Selector Results</h2>
              <p className="text-sm text-gray-500 mt-1">{supplierRationale}</p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
              Review &amp; pick suppliers
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            The AI has recommended a supplier for each SKU. You can change any selection using the dropdown.
          </p>
          <div className="overflow-x-auto rounded-lg border mb-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['SKU', 'Qty', 'Urgency', 'Select Supplier', 'Unit Price', 'Lead Time', 'Score'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {supplierSelections.filter(s => s.supplier_id).map(sel => {
                  const picked = supplierPicks[sel.sku] || sel;
                  const candidates = sel.all_candidates || [];
                  return (
                    <tr key={sel.sku} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium">{sel.sku}</td>
                      <td className="px-4 py-3">{sel.net_qty.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          sel.urgency === 'critical' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {sel.urgency}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {candidates.length > 1 ? (
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={picked.supplier_id || ''}
                            onChange={e => {
                              const chosen = candidates.find(c => c.supplier_id === e.target.value);
                              if (chosen) setSupplierPicks(prev => ({ ...prev, [sel.sku]: { ...sel, ...chosen } }));
                            }}
                          >
                            {candidates.map(c => (
                              <option key={c.supplier_id} value={c.supplier_id}>
                                {c.supplier_name} (score: {c.score})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-medium">{picked.supplier_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">${picked.unit_price?.toFixed(2)}</td>
                      <td className="px-4 py-3">{picked.lead_time_days}d</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${(picked.score || 0) >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
                          {picked.score}/100
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button onClick={handleRunContainer} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
            Continue to Container Optimization →
          </button>
        </div>
      )}

      {/* ── Step 3: Container Optimizer Results ── */}
      {step === 'review_container' && containerPlan && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-4">
            <h2 className="font-semibold text-lg">Container Optimizer Results</h2>
            <p className="text-sm text-gray-500 mt-1">{containerRationale}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Container Type', value: containerPlan.container_type },
              { label: 'Number of Containers', value: containerPlan.num_containers },
              { label: 'Utilisation', value: `${containerPlan.binding_utilisation_pct?.toFixed(1)}%` },
              { label: 'Est. Freight', value: `$${containerPlan.estimated_freight_usd?.toLocaleString()}` },
            ].map(card => (
              <div key={card.label} className="bg-gray-50 rounded-lg p-4 border">
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="font-bold text-lg mt-1">{card.value}</p>
              </div>
            ))}
          </div>
          <button onClick={handleRunPO} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
            Continue to PO Compilation →
          </button>
        </div>
      )}

      {/* ── Step 4: PO Compiler Results ── */}
      {(step === 'review_po' || step === 'done') && poNumber && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-4">
            <h2 className="font-semibold text-lg">Draft PO Ready</h2>
            <p className="text-sm text-gray-500 mt-1">{poRationale}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'PO Number', value: poNumber },
              { label: 'Total Value', value: `$${poTotal?.toLocaleString()}` },
              { label: 'Status', value: approvalStatus || 'pending' },
            ].map(card => (
              <div key={card.label} className="bg-gray-50 rounded-lg p-4 border">
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="font-bold text-lg mt-1 capitalize">{card.value}</p>
              </div>
            ))}
          </div>
          {step === 'review_po' && (
            <div className="flex gap-3">
              <button onClick={() => handleApproval('approve')} className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition">
                ✓ Approve PO
              </button>
              <button onClick={() => handleApproval('reject')} className="bg-red-100 text-red-700 px-6 py-3 rounded-lg hover:bg-red-200 transition">
                ✗ Reject PO
              </button>
            </div>
          )}
          {step === 'done' && (
            <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
              approvalStatus === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              PO {poNumber} has been {approvalStatus}.
            </div>
          )}
        </div>
      )}

      {/* ── Error state ── */}
      {step === 'error' && error && (
        <div className="bg-red-50 rounded-lg shadow p-6 mb-6">
          <h2 className="font-semibold text-lg text-red-700 mb-2">Pipeline Error</h2>
          <p className="text-sm font-mono bg-red-100 text-red-800 p-3 rounded mb-4">{error}</p>
          <button onClick={resetPipeline} className="bg-white border px-5 py-2 rounded hover:bg-gray-50 text-sm">
            Start Over
          </button>
        </div>
      )}

      {/* ── Start Over ── */}
      {step !== 'idle' && step !== 'error' && (
        <button onClick={resetPipeline} className="text-sm text-gray-400 hover:text-gray-600 underline">
          ← Start over with new configuration
        </button>
      )}
    </div>
  );
}
