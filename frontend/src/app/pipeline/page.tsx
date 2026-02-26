'use client';
import { useState } from 'react';
import { runPipeline } from '@/lib/api';

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
  error?: string;
};

const SAMPLE_SKUS = ['FLT-001', 'FLT-002', 'ENG-001', 'ELC-001', 'GSK-001'];

export default function PipelinePage() {
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [customSku, setCustomSku] = useState('');
  const [horizon, setHorizon] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [currentStep, setCurrentStep] = useState('');

  const steps = [
    { key: 'demand',    label: 'Demand Analyst',       desc: 'Calculating net requirements…' },
    { key: 'supplier',  label: 'Supplier Selector',     desc: 'Scoring & selecting suppliers…' },
    { key: 'container', label: 'Container Optimizer',   desc: 'Planning container allocation…' },
    { key: 'po',        label: 'PO Compiler',           desc: 'Drafting purchase order…' },
  ];

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
    setCurrentStep('demand');

    // Simulate step progress while waiting
    const stepKeys = ['demand', 'supplier', 'container', 'po'];
    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx = (stepIdx + 1) % stepKeys.length;
      setCurrentStep(stepKeys[stepIdx]);
    }, 4000);

    try {
      const data = await runPipeline(selectedSkus);
      setResult(data);
    } catch (err: any) {
      setResult({ status: 'error', error: err.message });
    } finally {
      clearInterval(interval);
      setCurrentStep('done');
      setLoading(false);
    }
  };

  const getStepStatus = (key: string) => {
    if (!loading && !result) return 'idle';
    if (!loading && result) return 'done';
    const stepKeys = ['demand', 'supplier', 'container', 'po'];
    const current = stepKeys.indexOf(currentStep);
    const idx = stepKeys.indexOf(key);
    if (idx < current) return 'done';
    if (idx === current) return 'active';
    return 'waiting';
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Run Pipeline</h1>
      <p className="text-gray-500 mb-8">Trigger the multi-agent PO automation pipeline.</p>

      {/* Config panel */}
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

      {/* Agent progress */}
      {loading && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="font-semibold text-lg mb-4">Agent Progress</h2>
          <div className="space-y-3">
            {steps.map(step => {
              const status = getStepStatus(step.key);
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    status === 'done'    ? 'bg-green-500 text-white' :
                    status === 'active'  ? 'bg-blue-500 text-white animate-pulse' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {status === 'done' ? '✓' : steps.indexOf(step) + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{step.label}</p>
                    {status === 'active' && <p className="text-xs text-blue-500">{step.desc}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results */}
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

          {/* Agent rationales */}
          {result.demand_rationale && (
            <div className="space-y-3">
              {[
                { agent: 'Demand Analyst', text: result.demand_rationale },
                { agent: 'Supplier Selector', text: result.supplier_rationale },
                { agent: 'Container Optimizer', text: result.container_rationale },
                { agent: 'PO Compiler', text: result.po_rationale },
              ].filter(r => r.text).map(r => (
                <div key={r.agent} className="bg-white rounded p-3 text-sm">
                  <span className="font-semibold text-gray-700">{r.agent}: </span>
                  <span className="text-gray-600">{r.text}</span>
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
