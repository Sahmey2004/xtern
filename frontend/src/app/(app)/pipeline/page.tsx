'use client';

import { useState, useEffect } from 'react';
import {
  startPipeline,
  continueAgent,
  approvePO,
  type NetRequirement,
  type SupplierSelection,
  type ContainerPlan,
  type AgentActivityEntry,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

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

const URGENCY_COLOR = {
  critical: 'var(--accent-red)',
  watch: 'var(--accent-amber)',
  normal: 'var(--accent-green)',
};

const URGENCY_GLOW = {
  critical: 'rgba(239,68,68,0.15)',
  watch: 'rgba(245,158,11,0.15)',
  normal: 'rgba(16,185,129,0.15)',
};

function MetricChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      padding: '3px 10px',
      borderRadius: 100,
      border: `1px solid ${accent}40`,
      background: `${accent}12`,
      fontSize: 11,
      color: accent,
      fontWeight: 600,
      whiteSpace: 'nowrap' as const,
    }}>
      {label}: {value}
    </div>
  );
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
    </div>
  );
}

export default function PipelinePage() {
  const { displayName } = useAuth();
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
  const [supplierConcerns, setSupplierConcerns] = useState<string[]>([]);
  const [supplierPicks, setSupplierPicks] = useState<Record<string, SupplierSelection>>({});
  const [containerPlan, setContainerPlan] = useState<ContainerPlan | null>(null);
  const [containerRationale, setContainerRationale] = useState('');
  const [poNumber, setPoNumber] = useState<string | null>(null);
  const [poTotal, setPoTotal] = useState<number | null>(null);
  const [poRationale, setPoRationale] = useState('');
  const [agentActivity, setAgentActivity] = useState<Record<string, AgentActivityEntry>>({});
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [existingDraftPos, setExistingDraftPos] = useState<{ po_number: string; total_usd: number }[]>([]);

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    fetch(`${backendUrl}/pipeline/pos?status=draft&limit=10`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.purchase_orders?.length) setExistingDraftPos(data.purchase_orders);
      })
      .catch(() => {});
  }, [step]);

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
      const data = await startPipeline(selectedSkus, horizon, displayName || 'planner');
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
      setSupplierConcerns(data.supplier_concerns || []);
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
      await approvePO(poNumber, displayName || 'planner', '', action);
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
    setSupplierConcerns([]);
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
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Run Pipeline
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Each agent runs one at a time. Review the results and confirm before the next agent starts.
        </p>
      </div>

      {/* Existing draft POs warning */}
      {step === 'idle' && existingDraftPos.length > 0 && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          padding: '14px 18px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
        }}>
          <span style={{ fontSize: 16, color: 'var(--accent-amber)', marginTop: 1 }}>⚠</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-amber)', marginBottom: 4 }}>
              {existingDraftPos.length} draft PO{existingDraftPos.length > 1 ? 's' : ''} already exist
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              {existingDraftPos.map(p => `${p.po_number} ($${p.total_usd?.toLocaleString()})`).join(', ')}.{' '}
              Starting a new pipeline will not re-order SKUs already covered. Review or approve existing POs first.
            </p>
          </div>
        </div>
      )}

      {/* Config step */}
      {step === 'idle' && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
            Pipeline Configuration
          </h2>

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
                    padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                    border: `1px solid ${selectedSkus.includes(sku) ? 'var(--accent-blue)' : 'var(--border)'}`,
                    background: selectedSkus.includes(sku) ? 'var(--accent-blue-glow)' : 'transparent',
                    color: selectedSkus.includes(sku) ? 'var(--accent-blue)' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.15s',
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
                    {i < stepIndex ? '\u2713' : i + 1}
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

      {isRunning && (
        <div className="card" style={{ padding: 28, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="animate-spin" style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent-blue)',
          }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Agent running\u2026</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>This may take 10\u201330 seconds</p>
          </div>
        </div>
      )}

      {/* Step 1 — Demand Analyst Results (compact color-coded) */}
      {step === 'review_demand' && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Demand Analyst Results</h2>
              {demandRationale && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 600 }}>
                  {demandRationale}
                </p>
              )}
            </div>
            <span className="badge badge-blue">
              {netRequirements.length} SKUs need replenishment
            </span>
          </div>

          {/* Compact color-coded SKU list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {netRequirements.map(req => {
              const urgency = req.urgency as keyof typeof URGENCY_COLOR;
              const urgColor = URGENCY_COLOR[urgency] || 'var(--accent-blue)';
              const urgGlow = URGENCY_GLOW[urgency] || 'transparent';
              const deltaVal = req.sales_delta_pct;
              const deltaStr = deltaVal != null
                ? `${deltaVal > 0 ? '↑' : '↓'}${Math.abs(deltaVal)}%`
                : null;

              return (
                <div key={req.sku} style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid var(--border)`,
                  borderLeft: `3px solid ${urgColor}`,
                  borderRadius: 8,
                  padding: '12px 16px',
                }}>
                  {/* Line 1: urgency dot + main summary */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: urgColor,
                      boxShadow: `0 0 6px ${urgColor}80`,
                      flexShrink: 0,
                    }} />
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                      {req.sku}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      short by <strong style={{ color: urgColor }}>{req.net_qty.toLocaleString()}</strong> qty
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      considering <strong>{req.safety_stock}</strong> safety stock already have
                    </span>
                    {req.need_by_date && req.need_by_date !== 'N/A' && (
                      <>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                          need by <strong style={{ color: urgColor }}>{req.need_by_date}</strong>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Line 2: metrics chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', paddingLeft: 18 }}>
                    {req.uf_qty_in != null && (
                      <MetricChip label="UF Qty In" value={req.uf_qty_in.toLocaleString()} accent="var(--accent-cyan)" />
                    )}
                    {deltaStr && (
                      <MetricChip
                        label="Sales"
                        value={`${deltaStr} (past qtr)`}
                        accent={deltaVal! > 0 ? 'var(--accent-green)' : 'var(--accent-amber)'}
                      />
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                      Safety: {req.safety_stock} → New Order: {req.net_qty} → Final: {req.final_order_qty ?? req.net_qty}
                      {req.moq > 1 && <span style={{ color: 'var(--text-muted)' }}> (MOQ: {req.moq})</span>}
                    </span>
                  </div>

                  {/* Line 3: open PO warning */}
                  {(req.open_po_count ?? 0) > 0 && (
                    <div style={{
                      marginTop: 6,
                      paddingLeft: 18,
                      fontSize: 11,
                      color: 'var(--accent-amber)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <span>⚠</span>
                      <span>
                        {req.open_po_count} open PO{req.open_po_count! > 1 ? 's' : ''} already exist for this SKU
                        ({req.open_po_qty?.toLocaleString()} qty on order)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={handleRunSupplier} className="btn-primary">
            Continue to Supplier Selection &rarr;
          </button>
        </div>
      )}

      {/* Step 2 — Supplier Selector Results (primary + alternatives) */}
      {step === 'review_supplier' && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Supplier Selector Results</h2>
              {supplierRationale && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 600 }}>
                  {supplierRationale}
                </p>
              )}
            </div>
            <span className="badge badge-green">Review &amp; pick suppliers</span>
          </div>

          {/* Global concerns */}
          {supplierConcerns.length > 0 && (
            <div style={{
              marginBottom: 16,
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
            }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-amber)', marginBottom: 6 }}>
                ⚠ Confidence Concerns
              </p>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {supplierConcerns.map((c, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            AI has recommended a primary supplier for each SKU. Click an alternative to switch.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            {supplierSelections.filter(s => s.supplier_id).map(sel => {
              const picked = supplierPicks[sel.sku] || sel;
              const candidates = sel.all_candidates || [];
              const alternatives = candidates.filter(c => c.supplier_id !== picked.supplier_id);

              return (
                <div key={sel.sku} style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 16,
                }}>
                  {/* SKU header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                      {sel.sku}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      · {sel.net_qty.toLocaleString()} units
                    </span>
                    <span className={`badge ${sel.urgency === 'critical' ? 'badge-red' : sel.urgency === 'watch' ? 'badge-amber' : 'badge-green'}`}>
                      {sel.urgency}
                    </span>
                  </div>

                  {/* Primary supplier */}
                  <div style={{
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.25)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginBottom: alternatives.length > 0 ? 10 : 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Primary
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {picked.supplier_name}
                        </span>
                      </div>
                      <span className="mono" style={{ fontWeight: 700, color: 'var(--accent-blue)', fontSize: 16 }}>
                        {picked.score}/100
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      <MetricChip label="Price" value={`$${picked.unit_price?.toFixed(2)}/unit`} accent="var(--accent-green)" />
                      <MetricChip label="Lead" value={`${picked.lead_time_days}d`} accent="var(--accent-cyan)" />
                      {picked.delivery_performance != null && (
                        <MetricChip label="Delivery" value={`${picked.delivery_performance}%`} accent="var(--accent-green)" />
                      )}
                      {picked.quality_score != null && (
                        <MetricChip label="Quality" value={`${picked.quality_score}%`} accent="var(--accent-purple)" />
                      )}
                      {picked.cost_rating != null && (
                        <MetricChip label="Cost" value={`${picked.cost_rating}/100`} accent="var(--accent-amber)" />
                      )}
                    </div>
                  </div>

                  {/* Alternative suppliers */}
                  {alternatives.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Alternatives:</p>
                      {alternatives.map(c => (
                        <button
                          key={c.supplier_id}
                          onClick={() => setSupplierPicks(prev => ({
                            ...prev,
                            [sel.sku]: { ...sel, ...c },
                          }))}
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 7,
                            padding: '9px 12px',
                            cursor: 'pointer',
                            textAlign: 'left' as const,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)';
                            e.currentTarget.style.background = 'rgba(59,130,246,0.05)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.background = 'var(--bg-card)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {c.supplier_name}
                            </span>
                            <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {c.score}/100
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                            <MetricChip label="Price" value={`$${c.unit_price?.toFixed(2)}`} accent="var(--text-muted)" />
                            <MetricChip label="Lead" value={`${c.lead_time_days}d`} accent="var(--text-muted)" />
                            {c.delivery_performance != null && (
                              <MetricChip label="Delivery" value={`${c.delivery_performance}%`} accent="var(--text-muted)" />
                            )}
                            {c.quality_score != null && (
                              <MetricChip label="Quality" value={`${c.quality_score}%`} accent="var(--text-muted)" />
                            )}
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--accent-blue)', marginTop: 5 }}>Click to switch →</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={handleRunContainer} className="btn-primary">
            Continue to Container Optimization &rarr;
          </button>
        </div>
      )}

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
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
              }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{card.label}</p>
                <p className="mono" style={{ fontSize: 22, fontWeight: 700, color: card.accent, marginTop: 4 }}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>
          <button onClick={handleRunPO} className="btn-primary">
            Continue to PO Compilation &rarr;
          </button>
        </div>
      )}

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
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
              }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{card.label}</p>
                <p className={card.mono ? 'mono' : ''} style={{
                  fontSize: card.mono ? 18 : 16, fontWeight: 700, color: card.accent,
                  marginTop: 4, textTransform: 'capitalize',
                }}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>
          {step === 'review_po' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => handleApproval('approve')} className="btn-success">
                \u2713 Approve PO
              </button>
              <button onClick={() => handleApproval('reject')} className="btn-danger">
                \u2717 Reject PO
              </button>
            </div>
          )}
          {step === 'done' && (
            <div style={{
              borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 600,
              background: approvalStatus === 'approved' ? 'var(--accent-green-glow)' : 'var(--accent-red-glow)',
              color: approvalStatus === 'approved' ? 'var(--accent-green)' : 'var(--accent-red)',
              border: `1px solid ${approvalStatus === 'approved' ? 'rgba(93,153,117,0.2)' : 'rgba(157,92,99,0.2)'}`,
            }}>
              PO {poNumber} has been {approvalStatus}.{' '}
              {approvalStatus === 'approved' && 'View it in the Approval Queue.'}
            </div>
          )}
        </div>
      )}

      {step === 'error' && error && (
        <div className="card" style={{ padding: 24, marginBottom: 20, border: '1px solid rgba(157,92,99,0.2)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent-red)', marginBottom: 12 }}>
            Pipeline Error
          </h2>
          <pre style={{
            fontSize: 12, background: 'var(--accent-red-glow)', color: 'var(--accent-red)',
            border: '1px solid rgba(157,92,99,0.15)', borderRadius: 8, padding: 14,
            marginBottom: 16, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {error}
          </pre>
          <button onClick={resetPipeline} className="btn-outline">
            &larr; Start Over
          </button>
        </div>
      )}

      {step !== 'idle' && step !== 'error' && (
        <button
          onClick={resetPipeline}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--text-muted)', textDecoration: 'underline',
          }}
        >
          &larr; Start over with new configuration
        </button>
      )}
    </div>
  );
}
