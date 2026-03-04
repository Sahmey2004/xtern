'use client';
import { ServerManagementTable, type ServerItem } from '@/components/ui/server-management-table';

// Map the 4 AI agents as "services" in the ServerManagementTable
const agentServices: ServerItem[] = [
  {
    id: '1',
    number: '01',
    serviceName: 'Demand Analyst',
    osType: 'ubuntu',
    serviceLocation: 'LangGraph Node · Step 1',
    countryCode: 'us',
    ip: 'gpt-4o-mini',
    dueDate: 'Always On',
    cpuPercentage: 72,
    status: 'active',
  },
  {
    id: '2',
    number: '02',
    serviceName: 'Supplier Selector',
    osType: 'linux',
    serviceLocation: 'LangGraph Node · Step 2',
    countryCode: 'us',
    ip: 'gpt-4o-mini',
    dueDate: 'Always On',
    cpuPercentage: 58,
    status: 'active',
  },
  {
    id: '3',
    number: '03',
    serviceName: 'Container Optimizer',
    osType: 'linux',
    serviceLocation: 'LangGraph Node · Step 3',
    countryCode: 'de',
    ip: 'gpt-4o-mini',
    dueDate: 'Always On',
    cpuPercentage: 45,
    status: 'active',
  },
  {
    id: '4',
    number: '04',
    serviceName: 'PO Compiler',
    osType: 'windows',
    serviceLocation: 'LangGraph Node · Step 4',
    countryCode: 'us',
    ip: 'gpt-4o-mini',
    dueDate: 'Always On',
    cpuPercentage: 33,
    status: 'active',
  },
];

export default function AgentsPage() {
  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }} className="animate-fade-up">
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Agent Services</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Multi-agent pipeline · 4 LangGraph nodes · Human-in-the-loop
        </p>
      </div>

      <div className="animate-fade-up stagger-1">
        <ServerManagementTable
          title="Pipeline Agents"
          servers={agentServices}
        />
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 20 }}
        className="animate-fade-up stagger-2">
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pipeline Flow
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {['Demand Analyst', '→', 'Supplier Selector', '→', 'Container Optimizer', '→', 'PO Compiler'].map((s, i) => (
              <span key={i} style={{
                fontSize: 12,
                color: s === '→' ? 'var(--text-muted)' : 'var(--text-primary)',
                fontWeight: s === '→' ? 400 : 600,
                background: s === '→' ? 'transparent' : 'var(--bg-surface)',
                border: s === '→' ? 'none' : '1px solid var(--border)',
                padding: s === '→' ? '0' : '3px 10px',
                borderRadius: 20,
              }}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            MCP Servers Connected
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { name: 'erp-data-server', status: 'Products & Inventory' },
              { name: 'supplier-data-server', status: 'Suppliers & Scoring' },
              { name: 'logistics-server', status: 'Container Specs' },
              { name: 'po-management-server', status: 'PO CRUD & Decision Log' },
            ].map(s => (
              <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="mono" style={{ color: 'var(--accent-blue)' }}>{s.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
