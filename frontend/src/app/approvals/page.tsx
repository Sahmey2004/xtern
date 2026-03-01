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

type ContainerPlan = {
  num_containers?: number;
  container_type?: string;
  volume_utilisation_pct?: number;
  weight_utilisation_pct?: number;
  estimated_freight_usd?: number;
};

type PurchaseOrder = {
  po_number: string;
  status: string;
  created_at: string;
  created_by: string;
  total_usd: number;
  notes: string;
  container_plan?: ContainerPlan | null;
  po_line_items: LineItem[];
};

export default function ApprovalsPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [reviewer, setReviewer] = useState('Manager');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const fetchPos = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/pipeline/pos?status=draft`);
      const data = await res.json();
      setPos(data.purchase_orders || []);
    } catch {
      setPos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPos(); }, []);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedPo) return;
    setSubmitting(true);
    try {
      await approvePO(selectedPo.po_number, reviewer, notes, action);
      setToast(`PO ${selectedPo.po_number} ${action}d successfully.`);
      setSelectedPo(null);
      setNotes('');
      setTimeout(() => setToast(''), 3000);
      fetchPos();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Approval request failed.';
      setToast(`Error: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Approval Queue</h1>
      <p className="text-gray-500 mb-6">Review and approve or reject draft Purchase Orders.</p>

      {toast && (
        <div className="mb-4 bg-green-100 text-green-800 px-4 py-2 rounded text-sm">{toast}</div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : pos.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          No pending approvals. <a href="/pipeline" className="text-blue-600 underline">Run a pipeline</a> first.
        </div>
      ) : (
        <div className="space-y-4">
          {pos.map(po => (
            <div key={po.po_number} className="bg-white rounded-lg shadow">
              {/* PO header row */}
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedPo(selectedPo?.po_number === po.po_number ? null : po)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-bold text-lg">{po.po_number}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(po.created_at).toLocaleString()} · By {po.created_by}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total Value</p>
                    <p className="font-bold text-xl">${po.total_usd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Line Items</p>
                    <p className="font-bold text-xl">{po.po_line_items?.length ?? 0}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    po.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                    po.status === 'approved' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>{po.status}</span>
                  <span className="text-gray-400">{selectedPo?.po_number === po.po_number ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {selectedPo?.po_number === po.po_number && (
                <div className="border-t px-5 pb-5">
                  {/* AI notes */}
                  {po.notes && (
                    <div className="mt-4 bg-blue-50 rounded p-3 text-sm text-blue-800">
                      <span className="font-semibold">AI Summary: </span>{po.notes}
                    </div>
                  )}

                  {/* Container plan */}
                  {po.container_plan && (
                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {[
                        { label: 'Container', value: `${po.container_plan.num_containers}x ${po.container_plan.container_type}` },
                        { label: 'Volume Util.', value: `${po.container_plan.volume_utilisation_pct?.toFixed(1)}%` },
                        { label: 'Weight Util.', value: `${po.container_plan.weight_utilisation_pct?.toFixed(1)}%` },
                        { label: 'Freight Est.', value: `$${po.container_plan.estimated_freight_usd?.toLocaleString()}` },
                      ].map(card => (
                        <div key={card.label} className="bg-gray-50 rounded p-3 text-sm">
                          <p className="text-gray-500 text-xs">{card.label}</p>
                          <p className="font-semibold mt-1">{card.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Line items table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b">
                          <th className="pb-2 pr-4">SKU</th>
                          <th className="pb-2 pr-4">Supplier</th>
                          <th className="pb-2 pr-4 text-right">Qty</th>
                          <th className="pb-2 pr-4 text-right">Unit Price</th>
                          <th className="pb-2 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(po.po_line_items || []).map((item, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 pr-4 font-mono font-medium">{item.sku}</td>
                            <td className="py-2 pr-4 text-gray-600">{item.supplier_id}</td>
                            <td className="py-2 pr-4 text-right">{item.qty_ordered?.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-right">${item.unit_price?.toFixed(2)}</td>
                            <td className="py-2 text-right font-medium">${item.total_price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold">
                          <td colSpan={4} className="pt-3 text-right text-sm text-gray-600">Total:</td>
                          <td className="pt-3 text-right text-base">${po.total_usd?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Approval form */}
                  <div className="mt-6 border-t pt-4">
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Reviewer Name</label>
                        <input
                          className="border rounded px-3 py-2 text-sm w-full max-w-xs"
                          value={reviewer}
                          onChange={e => setReviewer(e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                        <input
                          className="border rounded px-3 py-2 text-sm w-full"
                          placeholder="Approval notes or rejection reason…"
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => handleAction('approve')}
                        disabled={submitting}
                        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 text-sm disabled:opacity-50"
                      >
                        Approve PO
                      </button>
                      <button
                        onClick={() => handleAction('reject')}
                        disabled={submitting}
                        className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 text-sm disabled:opacity-50"
                      >
                        Reject PO
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
