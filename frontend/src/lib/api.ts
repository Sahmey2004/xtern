const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export type AgentActivityEntry = {
  status: 'completed' | 'failed' | 'idle';
  summary: string;
  confidence?: number | null;
  llm_used?: boolean;
  llm_error?: string | null;
  details?: Record<string, unknown>;
};

export type NetRequirement = {
  sku: string;
  net_qty: number;
  current_stock: number;
  in_transit: number;
  safety_stock: number;
  forecast_demand: number;
  urgency: 'critical' | 'watch' | 'normal';
  moq: number;
  // enriched fields
  uf_qty_in?: number;
  open_po_count?: number;
  open_po_qty?: number;
  need_by_date?: string;
  sales_delta_pct?: number | null;
  final_order_qty?: number;
};

export type SupplierCandidate = {
  supplier_id: string;
  supplier_name: string;
  unit_price: number;
  score: number;
  lead_time_days: number;
  moq_fit_pct?: number;
  quality_score?: number;
  delivery_performance?: number;
  cost_rating?: number;
};

export type SupplierSelection = {
  sku: string;
  supplier_id: string | null;
  supplier_name?: string;
  unit_price?: number;
  score?: number;
  lead_time_days?: number;
  net_qty: number;
  urgency: string;
  rationale?: string;
  concerns?: string[];
  quality_score?: number;
  delivery_performance?: number;
  cost_rating?: number;
  all_candidates?: SupplierCandidate[];
  error?: string;
};

export type ContainerPlan = {
  container_type: string;
  num_containers: number;
  binding_utilisation_pct: number;
  estimated_freight_usd: number;
  volume_utilisation_pct?: number;
  weight_utilisation_pct?: number;
};

export async function fetchHealth() {
  const res = await fetch(`${BACKEND_URL}/health`);
  return res.json();
}

export async function approvePO(
  poNumber: string,
  reviewer: string,
  notes?: string,
  action: 'approve' | 'reject' = 'approve'
) {
  const res = await fetch(`${BACKEND_URL}/pipeline/approve/${poNumber}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer, notes, action }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || 'Failed to update PO.');
  return data;
}

/** Step 1: Start pipeline — runs Demand Analyst only */
export async function startPipeline(skus: string[], horizonMonths = 3, triggeredBy = 'planner') {
  const res = await fetch(`${BACKEND_URL}/pipeline/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skus, horizon_months: horizonMonths, triggered_by: triggeredBy }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || 'Failed to start pipeline.');
  return data as {
    run_id: string;
    agent: string;
    status: string;
    next_agent: string;
    net_requirements: NetRequirement[];
    demand_rationale: string;
    demand_confidence: number;
    agent_activity: Record<string, AgentActivityEntry>;
  };
}

/** Step 2–4: Continue to the next agent one at a time */
export async function continueAgent(
  runId: string,
  nextAgent: string,
  supplierOverrides?: {
    sku: string;
    supplier_id: string;
    supplier_name: string;
    unit_price: number;
    lead_time_days: number;
    score: number;
  }[],
  netRequirementsOverrides?: NetRequirement[]
) {
  const res = await fetch(`${BACKEND_URL}/pipeline/${runId}/continue/${nextAgent}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplier_overrides: supplierOverrides || null,
      net_requirements_overrides: netRequirementsOverrides || null,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || `Agent ${nextAgent} failed.`);
  return data as {
    run_id: string;
    agent: string;
    status: string;
    next_agent: string | null;
    agent_activity: Record<string, AgentActivityEntry>;
    supplier_selections?: SupplierSelection[];
    supplier_rationale?: string;
    supplier_confidence?: number;
    supplier_concerns?: string[];
    container_plan?: ContainerPlan;
    container_rationale?: string;
    order_line_items?: unknown[];
    po_number?: string;
    po_total_usd?: number;
    po_rationale?: string;
    approval_status?: string;
    error?: string;
  };
}
