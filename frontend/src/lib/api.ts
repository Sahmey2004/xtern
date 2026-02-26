const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

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
  return res.json();
}

export async function approvePO(poNumber: string, reviewer: string, notes?: string, action: 'approve' | 'reject' = 'approve') {
  const res = await fetch(`${BACKEND_URL}/pipeline/approve/${poNumber}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer, notes, action }),
  });
  return res.json();
}
