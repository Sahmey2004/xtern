'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Supplier = {
  id: string;
  name: string;
  region: string;
  lead_time_days: number;
  quality_score: number;
  delivery_performance: number;
  cost_rating: number;
  contact_email?: string;
};

type SupplierProduct = {
  sku: string;
  unit_price: number;
  moq_override?: number;
  products?: { name: string; category: string; moq: number };
};

function ScoreBar({ value, accent }: { value: number; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: accent, borderRadius: 2 }} />
      </div>
      <span className="mono" style={{ fontSize: 12, color: 'var(--text-primary)', width: 28, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<Record<string, SupplierProduct[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .order('id');
      setSuppliers(data || []);

      // Load all supplier_products with SKU info
      const { data: spData } = await supabase
        .from('supplier_products')
        .select('supplier_id, sku, unit_price, moq_override, products(name, category, moq)');

      const bySupplier: Record<string, SupplierProduct[]> = {};
      for (const row of (spData || [])) {
        const sid = (row as unknown as { supplier_id: string }).supplier_id;
        if (!bySupplier[sid]) bySupplier[sid] = [];
        bySupplier[sid].push({
          sku: (row as unknown as { sku: string }).sku,
          unit_price: (row as unknown as { unit_price: number }).unit_price,
          moq_override: (row as unknown as { moq_override?: number }).moq_override,
          products: (row as unknown as { products: SupplierProduct['products'] }).products,
        });
      }
      setSupplierProducts(bySupplier);
      setLoading(false);
    }
    load();
  }, []);

  const regionColor: Record<string, string> = {
    'North America': 'badge-blue',
    'Europe': 'badge-purple',
    'Asia': 'badge-amber',
    'South America': 'badge-green',
    'Global': 'badge-blue',
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Supplier Master
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          All approved suppliers with performance scores and product catalog.
        </p>
      </div>

      {/* Stats row */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            {
              label: 'Total Suppliers',
              value: suppliers.length,
              accent: 'var(--accent-blue)',
              css: 'stat-accent-blue',
            },
            {
              label: 'Avg Quality Score',
              value: suppliers.length > 0
                ? Math.round(suppliers.reduce((s, x) => s + x.quality_score, 0) / suppliers.length)
                : 0,
              accent: 'var(--accent-green)',
              css: 'stat-accent-green',
            },
            {
              label: 'Avg Lead Time',
              value: suppliers.length > 0
                ? `${Math.round(suppliers.reduce((s, x) => s + x.lead_time_days, 0) / suppliers.length)}d`
                : '—',
              accent: 'var(--accent-amber)',
              css: 'stat-accent-amber',
            },
            {
              label: 'Total SKUs Covered',
              value: Object.values(supplierProducts).reduce((s, arr) => s + arr.length, 0),
              accent: 'var(--accent-purple)',
              css: 'stat-accent-purple',
            },
          ].map(s => (
            <div key={s.label} className={`card stat-accent ${s.css}`} style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{s.label}</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Loading suppliers…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {suppliers.map(sup => {
            const isExpanded = selectedId === sup.id;
            const products = supplierProducts[sup.id] || [];
            return (
              <div key={sup.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Header row */}
                <div
                  onClick={() => setSelectedId(isExpanded ? null : sup.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px 180px 180px 120px 40px',
                    alignItems: 'center',
                    padding: '14px 20px',
                    cursor: 'pointer',
                    gap: 16,
                  }}
                >
                  {/* Name + region */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {sup.name}
                      </span>
                      <span className={`badge ${regionColor[sup.region] || 'badge-blue'}`}>
                        {sup.region}
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      {sup.id}
                      {sup.contact_email && <span style={{ marginLeft: 8 }}>{sup.contact_email}</span>}
                    </div>
                  </div>

                  {/* Lead time */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Lead Time</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {sup.lead_time_days}d
                    </div>
                  </div>

                  {/* Quality score */}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Quality</div>
                    <ScoreBar value={sup.quality_score} accent="var(--accent-green)" />
                  </div>

                  {/* Delivery */}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Delivery</div>
                    <ScoreBar value={sup.delivery_performance} accent="var(--accent-blue)" />
                  </div>

                  {/* SKU count */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>SKUs</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {products.length}
                    </div>
                  </div>

                  <span style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'right' }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {/* Expanded: product catalog */}
                {isExpanded && products.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '0 20px 16px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Product Catalog ({products.length} SKUs)
                    </p>
                    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <table>
                        <thead>
                          <tr>
                            {['SKU', 'Product Name', 'Category', 'MOQ', 'Unit Price'].map(h => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {products.slice(0, 20).map(p => (
                            <tr key={p.sku}>
                              <td className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.sku}</td>
                              <td style={{ color: 'var(--text-secondary)' }}>{p.products?.name || '—'}</td>
                              <td>
                                <span className="badge badge-blue" style={{ fontSize: 10 }}>
                                  {p.products?.category || '—'}
                                </span>
                              </td>
                              <td className="mono">{p.moq_override ?? p.products?.moq ?? '—'}</td>
                              <td className="mono" style={{ color: 'var(--accent-green)' }}>${p.unit_price?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {products.length > 20 && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                        Showing 20 of {products.length} SKUs
                      </p>
                    )}
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
