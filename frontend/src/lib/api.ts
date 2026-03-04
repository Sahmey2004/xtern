import { supabase } from '@/lib/supabase';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export type AppRole = 'administrator' | 'po_manager';

export type AuthUserProfile = {
  user_id: string;
  email: string;
  full_name: string;
  role: AppRole;
};

export type AgentActivityEntry = {
  status: 'completed' | 'failed' | 'idle';
  summary: string;
  confidence?: number | null;
  llm_used?: boolean;
  llm_error?: string | null;
  details?: Record<string, unknown>;
};

export type PipelineRunResponse = {
  status: 'completed' | 'error';
  run_id?: string;
  po_number?: string;
  po_total_usd?: number;
  approval_status?: string;
  net_requirements_count?: number;
  supplier_selections_count?: number;
  container_plan?: {
    container_type?: string;
    num_containers?: number;
    binding_utilisation_pct?: number;
    estimated_freight_usd?: number;
    volume_utilisation_pct?: number;
    weight_utilisation_pct?: number;
  } | null;
  demand_rationale?: string;
  supplier_rationale?: string;
  container_rationale?: string;
  po_rationale?: string;
  agent_activity?: Record<string, AgentActivityEntry>;
  openai_requests_made?: number;
  error?: string;
};

export type DecisionLogEntry = {
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

export type PurchaseOrderLineItem = {
  sku: string;
  supplier_id: string;
  qty_ordered: number;
  unit_price: number;
  expected_delivery_date?: string | null;
  total_price: number;
  rationale: string;
};

export type PurchaseOrder = {
  po_number: string;
  status: string;
  created_at: string;
  created_by: string;
  created_by_user_id?: string;
  total_usd: number;
  notes: string;
  container_plan?: {
    num_containers?: number;
    container_type?: string;
    volume_utilisation_pct?: number;
    weight_utilisation_pct?: number;
    estimated_freight_usd?: number;
  } | null;
  po_line_items: PurchaseOrderLineItem[];
};

export type DataTableResponse = {
  dataset: string;
  columns: string[];
  rows: Record<string, unknown>[];
  page: number;
  page_size: number;
  total: number;
};

type DecisionLogResponse = {
  entries: DecisionLogEntry[];
  count: number;
};

type PurchaseOrdersResponse = {
  purchase_orders: PurchaseOrder[];
  count: number;
};

type HealthResponse = {
  status: string;
  service: string;
  openai_configured: boolean;
  llm_provider: string;
  openai_model: string;
};

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

async function parseResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const text = await res.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = {};
    }
  }

  if (!res.ok) {
    if (typeof payload === 'object' && payload && 'detail' in payload) {
      throw new Error(String((payload as { detail: unknown }).detail));
    }
    if (typeof payload === 'object' && payload && 'message' in payload) {
      throw new Error(String((payload as { message: unknown }).message));
    }
    throw new Error(fallbackMessage);
  }

  return payload as T;
}

async function authFetch(input: string, init?: RequestInit, optionalAuth = false) {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (!optionalAuth) {
    throw new Error('Not authenticated. Please sign in.');
  }
  return fetch(input, { ...init, headers });
}

export async function fetchHealth() {
  const res = await authFetch(`${BACKEND_URL}/health`, undefined, true);
  return parseResponse<HealthResponse>(res, 'Failed to fetch backend health.');
}

export async function fetchCurrentUserProfile() {
  const res = await authFetch(`${BACKEND_URL}/auth/me`);
  const data = await parseResponse<{ user: AuthUserProfile }>(res, 'Failed to fetch user profile.');
  return data.user;
}

export async function updateAccountSettings(fullName: string) {
  const res = await authFetch(`${BACKEND_URL}/auth/settings/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: fullName }),
  });
  return parseResponse<{ status: string; full_name: string }>(res, 'Failed to update account settings.');
}

export async function runPipeline(skus: string[], horizonMonths = 3) {
  const res = await authFetch(`${BACKEND_URL}/pipeline/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skus, horizon_months: horizonMonths }),
  });

  if (!res.ok) {
    try {
      const data = await parseResponse<{ detail?: string }>(res, 'Pipeline request failed.');
      return {
        status: 'error',
        error: data.detail || 'Pipeline request failed.',
      } as PipelineRunResponse;
    } catch (error: unknown) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Pipeline request failed.',
      } as PipelineRunResponse;
    }
  }

  return parseResponse<PipelineRunResponse>(res, 'Pipeline request failed.');
}

export async function approvePO(poNumber: string, notes?: string, action: 'approve' | 'reject' = 'approve') {
  const res = await authFetch(`${BACKEND_URL}/pipeline/approve/${poNumber}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes, action }),
  });

  return parseResponse<Record<string, unknown>>(res, 'Failed to update PO status.');
}

export async function fetchDecisionLogs(params?: { runId?: string; poNumber?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.runId) searchParams.set('run_id', params.runId);
  if (params?.poNumber) searchParams.set('po_number', params.poNumber);
  if (params?.limit) {
    const safeLimit = Math.min(Math.max(params.limit, 1), 100);
    searchParams.set('limit', String(safeLimit));
  }
  const query = searchParams.toString();

  const res = await authFetch(`${BACKEND_URL}/pipeline/logs${query ? `?${query}` : ''}`);
  const data = await parseResponse<DecisionLogResponse>(res, 'Failed to fetch decision logs.');
  return data.entries || [];
}

export async function fetchPurchaseOrders(params?: { status?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString();

  const res = await authFetch(`${BACKEND_URL}/pipeline/pos${query ? `?${query}` : ''}`);
  const data = await parseResponse<PurchaseOrdersResponse>(res, 'Failed to fetch purchase orders.');
  return data.purchase_orders || [];
}

export async function fetchDataTable(
  dataset: string,
  params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    filterCol?: string;
    filterVal?: string;
  },
) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('page_size', String(params.pageSize));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sort_by', params.sortBy);
  if (params?.sortDir) searchParams.set('sort_dir', params.sortDir);
  if (params?.filterCol) searchParams.set('filter_col', params.filterCol);
  if (params?.filterVal) searchParams.set('filter_val', params.filterVal);
  const query = searchParams.toString();
  const res = await authFetch(`${BACKEND_URL}/data/table/${dataset}${query ? `?${query}` : ''}`);
  return parseResponse<DataTableResponse>(res, 'Failed to fetch table data.');
}
