'use client';

import { useEffect, useMemo, useState } from 'react';

import { approvePO, fetchPurchaseOrders, type PurchaseOrder } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

export default function ApprovalsPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPo, setSelectedPo] = useState<string | null>(null);
  const { profile } = useAuth();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  async function loadOrders() {
    setLoading(true);
    try {
      const data = await fetchPurchaseOrders({ status: 'draft', limit: 30 });
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  const selectedOrder = useMemo(() => orders.find(order => order.po_number === selectedPo) || null, [orders, selectedPo]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedOrder) return;
    setSubmitting(true);

    try {
      await approvePO(selectedOrder.po_number, notes, action);
      setToast(`PO ${selectedOrder.po_number} ${action}d successfully.`);
      setNotes('');
      await loadOrders();
      setSelectedPo(null);
      setTimeout(() => setToast(''), 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Approval request failed.';
      setToast(`Error: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <section className="surface-card p-8">
        <p className="eyebrow">Approval Workspace</p>
        <h1 className="page-title">Review and finalize draft purchase orders</h1>
        <p className="page-subtitle">Inspect totals, line items, and AI summaries before approving or rejecting each order.</p>
      </section>

      {toast && (
        <section className="surface-card border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {toast}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <article className="surface-card p-0 overflow-hidden">
          <header className="panel-header">
            <div>
              <p className="panel-title">Draft Purchase Orders</p>
              <p className="panel-subtitle">Pending items requiring human review</p>
            </div>
            <button onClick={() => void loadOrders()} className="button button-secondary">
              Refresh
            </button>
          </header>

          {loading ? (
            <div className="p-5 space-y-3">
              <div className="loading-line h-5 w-full" />
              <div className="loading-line h-5 w-full" />
              <div className="loading-line h-5 w-4/5" />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No pending approvals. Trigger a new pipeline run to generate draft POs.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map(order => (
                <button
                  key={order.po_number}
                  className={`w-full text-left px-5 py-4 transition ${selectedPo === order.po_number ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                  onClick={() => setSelectedPo(order.po_number)}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{order.po_number}</p>
                      <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString()} · {order.created_by}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="font-semibold text-slate-900">${order.total_usd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-slate-500">{order.po_line_items?.length || 0} line items</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="surface-card p-6">
          <p className="panel-title">Review Panel</p>
          <p className="panel-subtitle mb-4">Select a PO to inspect details and submit your decision.</p>

          {!selectedOrder ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
              Pick a draft purchase order from the list to begin review.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="surface-subtle rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">{selectedOrder.po_number}</p>
                <p className="text-xs text-slate-500 mt-1">Total ${selectedOrder.total_usd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                {selectedOrder.notes && <p className="mt-3 text-sm text-slate-700">{selectedOrder.notes}</p>}
              </div>

              <div className="max-h-56 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-left">Supplier</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder.po_line_items || []).map(line => (
                      <tr key={`${line.sku}-${line.supplier_id}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">{line.sku}</td>
                        <td className="px-3 py-2 text-slate-600">{line.supplier_id}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{line.qty_ordered}</td>
                        <td className="px-3 py-2 text-right text-slate-700">${line.unit_price?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="field-label">Reviewer</label>
                  <input className="field-input" value={profile?.full_name || ''} readOnly />
                </div>
                <div>
                  <label className="field-label">Notes</label>
                  <input
                    className="field-input"
                    placeholder="Optional notes for approvers and audit trail"
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="button button-success" disabled={submitting} onClick={() => void handleAction('approve')}>
                  Approve PO
                </button>
                <button className="button button-danger" disabled={submitting} onClick={() => void handleAction('reject')}>
                  Reject PO
                </button>
              </div>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
