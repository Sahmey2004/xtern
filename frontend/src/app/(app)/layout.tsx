import BottomNav from '@/components/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            fontSize: 16, fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '-0.01em',
          }}>
            ProcureAI
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-muted)',
            padding: '2px 8px', borderRadius: 4,
            background: 'var(--bg-card)',
          }}>
            Supply Chain Automation
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Cummins Xtern 2026
        </div>
      </header>

      {/* Main content with bottom padding for nav */}
      <main style={{
        padding: '24px 32px 80px',
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        {children}
      </main>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  );
}
