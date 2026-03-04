'use client';

import { useEffect, useMemo, useState } from 'react';

import { fetchDataTable, type DataTableResponse } from '@/lib/api';

const DATASETS = [
  { value: 'inventory', label: 'Inventory' },
  { value: 'forecasts', label: 'Forecasts' },
  { value: 'products', label: 'Products' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'purchase_orders', label: 'Draft POs' },
  { value: 'po_line_items', label: 'PO Line Items' },
];

export default function DataPage() {
  const [dataset, setDataset] = useState('inventory');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterCol, setFilterCol] = useState('');
  const [filterVal, setFilterVal] = useState('');
  const [page, setPage] = useState(1);
  const [table, setTable] = useState<DataTableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pageSize = 25;

  async function loadTable() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDataTable(dataset, {
        page,
        pageSize,
        search,
        sortBy,
        sortDir,
        filterCol,
        filterVal,
      });
      setTable(data);
      if (data.columns.length > 0 && !sortBy) {
        setSortBy(data.columns[0]);
      }
      if (data.columns.length > 0 && !filterCol) {
        setFilterCol(data.columns[0]);
      }
    } catch (exc: unknown) {
      setError(exc instanceof Error ? exc.message : 'Failed to load dataset.');
      setTable(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, page, sortBy, sortDir]);

  const totalPages = useMemo(() => {
    if (!table) return 1;
    return Math.max(1, Math.ceil(table.total / pageSize));
  }, [table, pageSize]);

  return (
    <div className="page-shell">
      <section className="surface-card p-8">
        <p className="eyebrow">Data Explorer</p>
        <h1 className="page-title">Spreadsheet-style operational data access</h1>
        <p className="page-subtitle">Filter, sort, and search across inventory, forecasts, suppliers, and purchase-order records.</p>

        <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="field-label">Dataset</label>
            <select className="field-input" value={dataset} onChange={event => { setDataset(event.target.value); setPage(1); }}>
              {DATASETS.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Search</label>
            <input className="field-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Global search" />
          </div>

          <div>
            <label className="field-label">Filter Column</label>
            <select className="field-input" value={filterCol} onChange={event => setFilterCol(event.target.value)}>
              {(table?.columns || []).map(column => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Filter Value</label>
            <input className="field-input" value={filterVal} onChange={event => setFilterVal(event.target.value)} placeholder="Contains..." />
          </div>

          <div>
            <label className="field-label">Sort By</label>
            <select className="field-input" value={sortBy} onChange={event => setSortBy(event.target.value)}>
              {(table?.columns || []).map(column => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button className="button button-secondary w-full" onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}>
              Sort {sortDir === 'asc' ? 'ASC' : 'DESC'}
            </button>
            <button className="button button-primary w-full" onClick={() => { setPage(1); void loadTable(); }}>
              Apply
            </button>
          </div>
        </div>
      </section>

      {error && (
        <section className="surface-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      )}

      <section className="surface-card p-0 overflow-hidden">
        <header className="panel-header">
          <div>
            <p className="panel-title">{DATASETS.find(item => item.value === dataset)?.label}</p>
            <p className="panel-subtitle">{table?.total ?? 0} rows found</p>
          </div>
        </header>

        {loading ? (
          <div className="p-5 space-y-3">
            <div className="loading-line h-5 w-full" />
            <div className="loading-line h-5 w-full" />
            <div className="loading-line h-5 w-4/5" />
          </div>
        ) : !table || table.rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No rows match the current filters.</div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-600">
                <tr>
                  {table.columns.map(column => (
                    <th key={column} className="px-3 py-2 text-left whitespace-nowrap border-b border-slate-200">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => (
                  <tr key={`${index}-${String(row[table.columns[0]] ?? '')}`} className="border-b border-slate-100">
                    {table.columns.map(column => (
                      <td key={column} className="px-3 py-2 text-slate-700 whitespace-nowrap align-top">
                        {typeof row[column] === 'object' && row[column] !== null
                          ? JSON.stringify(row[column])
                          : String(row[column] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button className="button button-secondary" disabled={page <= 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>
              Previous
            </button>
            <button className="button button-secondary" disabled={page >= totalPages} onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}>
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

