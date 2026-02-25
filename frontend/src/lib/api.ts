const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function fetchHealth() {
  const res = await fetch(`${BACKEND_URL}/health`);
  return res.json();
}

export async function runPipeline(skus: string[]) {
  const res = await fetch(`${BACKEND_URL}/pipeline/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skus }),
  });
  return res.json();
}

export async function approvePO(poNumber: string, reviewer: string, notes?: string) {
  const res = await fetch(`${BACKEND_URL}/pipeline/approve/${poNumber}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer, notes }),
  });
  return res.json();
}
