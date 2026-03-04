'use client';
import { useEffect, useState } from 'react';
import { approvePO } from '@/lib/api';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

type LineItem = {
  sku: string;
  supplier_id: string;
  qty_ordered: number;
  unit_price: number;
  total_price: number;
  rationale: string;
};

type ContainerPlanDetail = {
  num_containers?: number;
  container_type?: string;
  volume_utilisation_pct?: number;
  weight_utilisation_pct?: number;
  binding_utilisation_pct?: number;
  estimated_freight_usd?: number;
};

type PurchaseOrder = {
  po_number: string;
  status: string;
  created_at: string;
  created_by: string;
  total_usd: number;
  notes: string;
  container_plan?: ContainerPlanDetail | null;
  po_line_items: LineItem[];
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-amber',
  pending_approval: 'badge-blue',
  approved: 'badge-green',
  rejected: 'badge-red',
};

export default function ApprovalsPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPo, setSelectedPo] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState('Manager');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchPos = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${BACKEND_URL}/pipeline/pos?status=draft&limit=50`).then(r => r.json()),
        fetch(`${BACKEND_URL}/pipeline/pos?status=pending_approval&limit=50`).then(r => r.json()),
      ]);
      const combined: PurchaseOrder[] = [
        ...(r1.purchase_orders || []),
        ...(r2.purchase_orders || []),
      ];
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPos(combined);
    } catch {
      setPos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPos(); }, []);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAction = async (po: PurchaseOrder, action: 'approve' | 'reject') => {
    setSubmitting(true);
    try {
      await approvePO(po.po_number, reviewer, notes, action);
      showToast(`PO ${po.po_number} ${action}d successfully.`, true);
      setSelectedPo(null);
      setNotes('');
      fetchPos();
    } catch (e: unknown) {
      showToast(`Error: ${e instanceof Error ? e.message : 'Request failed'}`, false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Approval Queue
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Review and approve or reject draft Purchase Orders.
          </p>
        </div>
        <button onClick={fetchPos} className="btn-outline" style={{ marginTop: 4 }}>
          Refresh
        </button>
      </div>

      {toast && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: toast.ok ? 'var(--accent-green-glow)' : 'var(--accent-red-glow)',
          color: toast.ok ? 'var(--accent-green)' : 'var(--accent-red)',
          border: `1px solid ${toast.ok ? 'rgba(93,153,117,0.2)' : 'rgba(157,92,99,0.2)'}`,
        }}>
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 13 }}>Loading purchase orders\u2026</div>
        </div>
      ) : pos.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>
            No pending purchase orders.
          </p>
          <a href="/pipeline" style={{ color: 'var(--accent-blue)', fontSize: 13, textDecoration: 'none' }}>
            Run a pipeline to generate a PO &rarr;
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pos.map(po => {
            const isExpanded = selectedPo === po.po_number;
            return (
              <div key={po.po_number} className="card" style={{ overflow: 'hidden' }}>
                <div
                  onClick={() => setSelectedPo(isExpanded ? null : po.po_number)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div>
                      <p className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {po.po_number}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(po.created_at).toLocaleString()} &middot; by {po.created_by}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total Value</p>
                      <p className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        ${po.total_usd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Line Items</p>
                      <p className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {po.po_line_items?.length ?? 0}
                      </p>
                    </div>
                    <span className={`badge ${STATUS_COLORS[po.status] || 'badge-blue'}`}>
                      {po.status.replace('_', ' ')}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {isExpanded ? '\u25B2' : '\u25BC'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '20px 20px 24px' }}>
                    {po.notes && (
                      <div style={{
                        marginBottom: 20, padding: '12px 16px',
                        background: 'var(--accent-blue-glow)', border: '1px solid rgba(43,65,98,0.15)',
                        borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
                      }}>
                        <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>AI Summary: </span>
                        {po.notes}
                      </div>
                    )}

                    {po.container_plan && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                        {[
                          { label: 'Container', value: `${po.container_plan.num_containers}x ${po.container_plan.container_type}` },
                          { label: 'Volume Util.', value: `${po.container_plan.volume_utilisation_pct?.toFixed(1)}%` },
                          { label: 'Weight Util.', value: `${po.container_plan.weight_utilisation_pct?.toFixed(1)}%` },
                          { label: 'Freight Est.', value: `$${po.container_plan.estimated_freight_usd?.toLocaleString()}` },
                        ].map(card => (
                          <div key={card.label} style={{
                            background: 'var(--bg-surface)', border: '1px solid var(--border)',
                            borderRadius: 8, padding: '10px 14px',
                          }}>
                            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{card.label}</p>
                            <p className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 3 }}>
                              {card.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20 }}>
                      <table>
                        <thead>
                          <tr>
                            {['SKU', 'Supplier', 'Qty', 'Unit Price', 'Line Total'].map(h => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(po.po_line_items || []).map((item, i) => (
                            <tr key={i}>
                              <td className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.sku}</td>
                              <td style={{ color: 'var(--text-secondary)' }}>{item.supplier_id}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>{item.qty_ordered?.toLocaleString()}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>${item.unit_price?.toFixed(2)}</td>
                              <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                                ${item.total_price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12, paddingTop: 12 }}>
                              Total:
                            </td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, paddingTop: 12 }}>
                              ${po.total_usd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14 }}>
                        Manager Approval
                      </p>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                            Reviewer Name
                          </label>
                          <input value={reviewer} onChange={e => setReviewer(e.target.value)} style={{ width: 200 }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                            Notes (optional)
                          </label>
                          <input
                            placeholder="Approval notes or rejection reason\u2026"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => handleAction(po, 'approve')} disabled={submitting} className="btn-success">
                          ✓ Approve PO
                        </button>
                        <button onClick={() => handleAction(po, 'reject')} disabled={submitting} className="btn-danger">
                          ✕ Reject PO
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
