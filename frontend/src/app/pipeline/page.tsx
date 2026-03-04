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

const STEPS = [
  { key: 'demand', label: 'Demand Analyst' },
  { key: 'supplier', label: 'Supplier Selector' },
  { key: 'container', label: 'Container Optimizer' },
  { key: 'po', label: 'PO Compiler' },
];

const stepIndexMap: Record<Step, number> = {
  idle: -1,
  running_demand: 0, review_demand: 0,
  running_supplier: 1, review_supplier: 1,
  running_container: 2, review_container: 2,
  running_po: 3, review_po: 3,
  done: 4, error: -1,
};

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

  const resetPipeline = () => {
    setStep('idle');
    setRunId(null);
    setError(null);
    setNetRequirements([]);
    setDemandRationale('');
    setSupplierSelections([]);
    setSupplierRationale('');
    setSupplierPicks({});
    setContainerPlan(null);
    setContainerRationale('');
    setPoNumber(null);
    setPoTotal(null);
    setPoRationale('');
    setAgentActivity({});
    setApprovalStatus(null);
  };

  const isRunning = ['running_demand', 'running_supplier', 'running_container', 'running_po'].includes(step);
  const stepIndex = stepIndexMap[step] ?? -1;

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Run Pipeline
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Each agent runs one at a time. Review the results and confirm before the next agent starts.
        </p>
      </div>

      {/* Config step */}
      {step === 'idle' && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
            Pipeline Configuration
          </h2>

          {/* Horizon */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Planning Horizon
            </label>
            <select value={horizon} onChange={e => setHorizon(Number(e.target.value))} style={{ width: 160 }}>
              <option value={1}>1 month</option>
              <option value={2}>2 months</option>
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
            </select>
          </div>

          {/* SKU selection */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
              SKU Selection
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                (leave empty to auto-select below-reorder SKUs)
              </span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {SAMPLE_SKUS.map(sku => (
                <button
                  key={sku}
                  onClick={() => toggleSku(sku)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 100,
                    fontSize: 12,
                    fontWeight: 500,
                    border: `1px solid ${selectedSkus.includes(sku) ? 'var(--accent-blue)' : 'var(--border)'}`,
                    background: selectedSkus.includes(sku) ? 'var(--accent-blue-glow)' : 'transparent',
                    color: selectedSkus.includes(sku) ? 'var(--accent-blue)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {sku}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Add custom SKU (e.g. ENG-003)"
                value={customSku}
                onChange={e => setCustomSku(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomSku()}
                style={{ width: 260, fontSize: 13 }}
              />
              <button onClick={addCustomSku} className="btn-outline" style={{ padding: '8px 16px', fontSize: 13 }}>
                Add
              </button>
            </div>
            {selectedSkus.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Selected: {selectedSkus.join(', ')}
              </p>
            )}
          </div>

          <button onClick={handleStart} className="btn-primary">
            Start Pipeline
          </button>
        </div>
      )}

      {/* Progress stepper */}
      {step !== 'idle' && step !== 'error' && (
        <div className="card" style={{ padding: '16px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {STEPS.map((s, i) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    background: i < stepIndex ? 'var(--accent-green)' : i === stepIndex ? 'var(--accent-blue)' : 'var(--bg-surface)',
                    border: `2px solid ${i < stepIndex ? 'var(--accent-green)' : i === stepIndex ? 'var(--accent-blue)' : 'var(--border)'}`,
                    color: i <= stepIndex ? 'white' : 'var(--text-muted)',
                    transition: 'all 0.3s',
                  }}>
                    {i < stepIndex ? '✓' : i + 1}
                  </div>
                  <span style={{
                    fontSize: 11, marginTop: 6, textAlign: 'center', width: 80,
                    color: i === stepIndex ? 'var(--accent-blue)' : i < stepIndex ? 'var(--accent-green)' : 'var(--text-muted)',
                    fontWeight: i === stepIndex ? 600 : 400,
                  }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, marginBottom: 20, marginLeft: 4, marginRight: 4,
                    background: i < stepIndex ? 'var(--accent-green)' : 'var(--border)',
                    transition: 'background 0.3s',
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Running spinner */}
      {isRunning && (
        <div className="card" style={{ padding: 28, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="animate-spin" style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent-blue)',
          }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Agent running…</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>This may take 10–30 seconds</p>
          </div>
        </div>
      )}

      {/* Step 1 — Demand Analyst Results */}
      {step === 'review_demand' && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Demand Analyst Results</h2>
              {demandRationale && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 600, lineHeight: 1.5 }}>
                  {demandRationale}
                </p>
              )}
            </div>
            <span className="badge badge-blue">
              {netRequirements.length} SKUs need replenishment
            </span>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  {['SKU', 'Net Qty', 'Current Stock', 'In Transit', 'Safety Stock', 'Forecast Demand', 'Urgency'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {netRequirements.map(req => (
                  <tr key={req.sku}>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.sku}</td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{req.net_qty.toLocaleString()}</td>
                    <td>{req.current_stock.toLocaleString()}</td>
                    <td>{req.in_transit.toLocaleString()}</td>
                    <td>{req.safety_stock.toLocaleString()}</td>
                    <td>{req.forecast_demand.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${req.urgency === 'critical' ? 'badge-red' : 'badge-amber'}`}>
                        {req.urgency}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={handleRunSupplier} className="btn-primary">
            Continue to Supplier Selection →
          </button>
        </div>
      )}

      {/* Step 2 — Supplier Selector Results */}
      {step === 'review_supplier' && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Supplier Selector Results</h2>
              {supplierRationale && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 600, lineHeight: 1.5 }}>
                  {supplierRationale}
                </p>
              )}
            </div>
            <span className="badge badge-green">Review &amp; pick suppliers</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            AI has recommended a supplier for each SKU. Use the dropdown to override any selection.
          </p>

          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  {['SKU', 'Qty', 'Urgency', 'Select Supplier', 'Unit Price', 'Lead Time', 'Score'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supplierSelections.filter(s => s.supplier_id).map(sel => {
                  const picked = supplierPicks[sel.sku] || sel;
                  const candidates = sel.all_candidates || [];
                  return (
                    <tr key={sel.sku}>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sel.sku}</td>
                      <td className="mono">{sel.net_qty.toLocaleString()}</td>
                      <td>
                        <span className={`badge ${sel.urgency === 'critical' ? 'badge-red' : 'badge-amber'}`}>
                          {sel.urgency}
                        </span>
                      </td>
                      <td>
                        {candidates.length > 1 ? (
                          <select
                            value={picked.supplier_id || ''}
                            onChange={e => {
                              const chosen = candidates.find(c => c.supplier_id === e.target.value);
                              if (chosen) setSupplierPicks(prev => ({ ...prev, [sel.sku]: { ...sel, ...chosen } }));
                            }}
                            style={{ fontSize: 12, padding: '4px 8px' }}
                          >
                            {candidates.map(c => (
                              <option key={c.supplier_id} value={c.supplier_id}>
                                {c.supplier_name} ({c.score})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {picked.supplier_name}
                          </span>
                        )}
                      </td>
                      <td className="mono">${picked.unit_price?.toFixed(2)}</td>
                      <td>{picked.lead_time_days}d</td>
                      <td>
                        <span className="mono" style={{
                          fontWeight: 700,
                          color: (picked.score || 0) >= 80 ? 'var(--accent-green)' : 'var(--accent-amber)',
                        }}>
                          {picked.score}/100
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button onClick={handleRunContainer} className="btn-primary">
            Continue to Container Optimization →
          </button>
        </div>
      )}

      {/* Step 3 — Container Optimizer Results */}
      {step === 'review_container' && containerPlan && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            Container Optimizer Results
          </h2>
          {containerRationale && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              {containerRationale}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Container Type', value: containerPlan.container_type, accent: 'var(--accent-blue)' },
              { label: 'Containers', value: containerPlan.num_containers, accent: 'var(--accent-cyan)' },
              { label: 'Utilisation', value: `${containerPlan.binding_utilisation_pct?.toFixed(1)}%`, accent: 'var(--accent-green)' },
              { label: 'Est. Freight', value: `$${containerPlan.estimated_freight_usd?.toLocaleString()}`, accent: 'var(--accent-amber)' },
            ].map(card => (
              <div key={card.label} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{card.label}</p>
                <p className="mono" style={{ fontSize: 22, fontWeight: 700, color: card.accent, marginTop: 4 }}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <button onClick={handleRunPO} className="btn-primary">
            Continue to PO Compilation →
          </button>
        </div>
      )}

      {/* Step 4 — PO Compiler Results */}
      {(step === 'review_po' || step === 'done') && poNumber && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            Draft PO Ready
          </h2>
          {poRationale && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              {poRationale}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'PO Number', value: poNumber, accent: 'var(--text-primary)', mono: true },
              { label: 'Total Value', value: `$${poTotal?.toLocaleString()}`, accent: 'var(--accent-green)', mono: true },
              {
                label: 'Status',
                value: approvalStatus || 'pending',
                accent: approvalStatus === 'approved' ? 'var(--accent-green)' : approvalStatus === 'rejected' ? 'var(--accent-red)' : 'var(--accent-amber)',
                mono: false,
              },
            ].map(card => (
              <div key={card.label} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{card.label}</p>
                <p className={card.mono ? 'mono' : ''} style={{
                  fontSize: card.mono ? 18 : 16,
                  fontWeight: 700,
                  color: card.accent,
                  marginTop: 4,
                  textTransform: 'capitalize',
                }}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {step === 'review_po' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => handleApproval('approve')} className="btn-success">
                ✓ Approve PO
              </button>
              <button onClick={() => handleApproval('reject')} className="btn-danger">
                ✗ Reject PO
              </button>
            </div>
          )}
          {step === 'done' && (
            <div style={{
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: approvalStatus === 'approved' ? 'var(--accent-green-glow)' : 'var(--accent-red-glow)',
              color: approvalStatus === 'approved' ? 'var(--accent-green)' : 'var(--accent-red)',
              border: `1px solid ${approvalStatus === 'approved' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              PO {poNumber} has been {approvalStatus}.{' '}
              {approvalStatus === 'approved' && 'View it in the Approval Queue.'}
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {step === 'error' && error && (
        <div className="card" style={{ padding: 24, marginBottom: 20, border: '1px solid rgba(239,68,68,0.2)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent-red)', marginBottom: 12 }}>
            Pipeline Error
          </h2>
          <pre style={{
            fontSize: 12,
            background: 'var(--accent-red-glow)',
            color: 'var(--accent-red)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 8,
            padding: 14,
            marginBottom: 16,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {error}
          </pre>
          <button onClick={resetPipeline} className="btn-outline">
            ← Start Over
          </button>
        </div>
      )}

      {/* Start over link */}
      {step !== 'idle' && step !== 'error' && (
        <button
          onClick={resetPipeline}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--text-muted)', textDecoration: 'underline',
          }}
        >
          ← Start over with new configuration
        </button>
      )}
    </div>
  );
}
