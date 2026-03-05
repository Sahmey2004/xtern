'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

type Tab = 'inventory' | 'products';

type SortDir = 'asc' | 'desc';

type InventoryRow = {
  sku: string;
  current_stock: number;
  in_transit: number;
  safety_stock: number;
  buffer_stock: number;
  reorder_point: number;
  products: { name: string; category: string; moq: number } | null;
};

type ProductRow = {
  sku: string;
  name: string;
  category: string;
  moq: number;
  unit_weight_kg: number;
  unit_cbm: number;
  unit_price_usd: number;
};

function statusColor(row: InventoryRow): { label: string; color: string; bg: string; border: string } {
  if (row.current_stock <= row.safety_stock) {
    return { label: 'Critical', color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' };
  }
  if (row.current_stock <= row.reorder_point) {
    return { label: 'Watch', color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
  }
  return { label: 'OK', color: 'var(--accent-green)', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' };
}

function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: SortDir }) {
  if (col !== sortCol) return <span style={{ opacity: 0.3, fontSize: 9 }}>↕</span>;
  return <span style={{ fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
}

function ThBtn({
  col, label, sortCol, sortDir, onSort,
}: {
  col: string; label: string; sortCol: string; sortDir: SortDir; onSort: (c: string) => void;
}) {
  return (
    <th
      onClick={() => onSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label} <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </span>
    </th>
  );
}

export default function DataPage() {
  const [tab, setTab] = useState<Tab>('inventory');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('sku');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [invRes, prodRes] = await Promise.all([
          supabase.from('inventory').select('*, products(name, category, moq)').order('sku'),
          supabase.from('products').select('*').order('sku'),
        ]);
        if (invRes.error) throw new Error(invRes.error.message);
        if (prodRes.error) throw new Error(prodRes.error.message);
        setInventory((invRes.data as unknown as InventoryRow[]) || []);
        setProducts((prodRes.data as unknown as ProductRow[]) || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSort = (col: string) => {
    if (col === sortCol) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const filteredInventory = useMemo(() => {
    const q = search.toLowerCase();
    let rows = inventory.filter(r =>
      !q || [r.sku, r.products?.name ?? '', r.products?.category ?? '']
        .some(v => v.toLowerCase().includes(q))
    );
    rows = [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortCol];
      const bv = (b as Record<string, unknown>)[sortCol];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [inventory, search, sortCol, sortDir]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    let rows = products.filter(r =>
      !q || [r.sku, r.name, r.category]
        .some(v => v.toLowerCase().includes(q))
    );
    rows = [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortCol];
      const bv = (b as Record<string, unknown>)[sortCol];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [products, search, sortCol, sortDir]);

  const displayed = tab === 'inventory' ? filteredInventory : filteredProducts;
  const total = tab === 'inventory' ? inventory.length : products.length;

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '8px 20px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: tab === t ? 600 : 400,
    cursor: 'pointer',
    border: 'none',
    background: tab === t ? 'rgba(59,130,246,0.15)' : 'transparent',
    color: tab === t ? 'var(--accent-blue)' : 'var(--text-muted)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Data
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          View and search inventory positions and product catalog.
        </p>
      </div>

      {/* Tabs + controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '4px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 10,
        }}>
          <button style={tabStyle('inventory')} onClick={() => { setTab('inventory'); setSortCol('sku'); setSortDir('asc'); }}>
            Inventory
          </button>
          <button style={tabStyle('products')} onClick={() => { setTab('products'); setSortCol('sku'); setSortDir('asc'); }}>
            Products / SKUs
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing {displayed.length} of {total}
          </span>
          <input
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 220, fontSize: 13 }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="btn-outline"
              style={{ padding: '7px 14px', fontSize: 12 }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading data…
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          background: 'var(--accent-red-glow)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--accent-red)',
          fontSize: 13,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          {tab === 'inventory' ? (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  {[
                    { col: 'sku', label: 'SKU' },
                    { col: 'products.name', label: 'Name' },
                    { col: 'current_stock', label: 'Current Stock' },
                    { col: 'in_transit', label: 'In Transit' },
                    { col: 'safety_stock', label: 'Safety Stock' },
                    { col: 'buffer_stock', label: 'Buffer Stock' },
                    { col: 'reorder_point', label: 'Reorder Point' },
                    { col: 'status', label: 'Status' },
                  ].map(h => (
                    h.col === 'status' ? (
                      <th key="status" style={{ whiteSpace: 'nowrap' }}>Status</th>
                    ) : (
                      <ThBtn key={h.col} col={h.col} label={h.label} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                    )
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                      No records found.
                    </td>
                  </tr>
                ) : filteredInventory.map(row => {
                  const status = statusColor(row);
                  return (
                    <tr key={row.sku}>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.sku}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.products?.name ?? '—'}</td>
                      <td className="mono">{row.current_stock.toLocaleString()}</td>
                      <td className="mono">{row.in_transit.toLocaleString()}</td>
                      <td className="mono">{row.safety_stock.toLocaleString()}</td>
                      <td className="mono">{row.buffer_stock.toLocaleString()}</td>
                      <td className="mono">{row.reorder_point.toLocaleString()}</td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 9px',
                          borderRadius: 100,
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.03em',
                          background: status.bg,
                          color: status.color,
                          border: `1px solid ${status.border}`,
                        }}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  {[
                    { col: 'sku', label: 'SKU' },
                    { col: 'name', label: 'Name' },
                    { col: 'category', label: 'Category' },
                    { col: 'moq', label: 'MOQ' },
                    { col: 'unit_weight_kg', label: 'Weight (kg)' },
                    { col: 'unit_cbm', label: 'CBM' },
                    { col: 'unit_price_usd', label: 'Unit Price (USD)' },
                  ].map(h => (
                    <ThBtn key={h.col} col={h.col} label={h.label} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                      No records found.
                    </td>
                  </tr>
                ) : filteredProducts.map(row => (
                  <tr key={row.sku}>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.sku}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.name}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 9px',
                        borderRadius: 100,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(59,130,246,0.1)',
                        color: 'var(--accent-blue)',
                        border: '1px solid rgba(59,130,246,0.25)',
                      }}>
                        {row.category}
                      </span>
                    </td>
                    <td className="mono">{row.moq.toLocaleString()}</td>
                    <td className="mono">{Number(row.unit_weight_kg).toFixed(3)}</td>
                    <td className="mono">{Number(row.unit_cbm).toFixed(4)}</td>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--accent-green)' }}>
                      ${Number(row.unit_price_usd).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
