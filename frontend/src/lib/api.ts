const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export type AgentActivityEntry = {
  status: 'completed' | 'failed' | 'idle';
  summary: string;
  confidence?: number | null;
  llm_used?: boolean;
  llm_error?: string | null;
  details?: Record<string, unknown>;
};

export async function fetchHealth() {
  const res = await fetch(`${BACKEND_URL}/health`);
  return res.json();
}

export async function runPipeline(skus: string[], horizonMonths = 3) {
  const res = await fetch(`${BACKEND_URL}/pipeline/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skus, horizon_months: horizonMonths, triggered_by: 'planner' }),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      status: 'error',
      error: data?.detail || 'Pipeline request failed.',
      agent_activity: data?.agent_activity || {},
    };
  }
  return data;
}

export async function approvePO(poNumber: string, reviewer: string, notes?: string, action: 'approve' | 'reject' = 'approve') {
  const res = await fetch(`${BACKEND_URL}/pipeline/approve/${poNumber}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer, notes, action }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || 'Failed to update PO.');
  }
  return data;
}
