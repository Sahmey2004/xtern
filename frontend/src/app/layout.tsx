import type { Metadata } from 'next';
import './globals.css';
import NavLinks from '@/components/NavLinks';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'ProcureAI — Supply Chain PO Automation',
  description: 'Multi-Agent Purchase Order Automation for Cummins',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', margin: 0 }}>
        <Providers>
          {/* Sidebar */}
          <aside style={{
            width: 220,
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border)',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            height: '100vh',
            flexShrink: 0,
            overflowY: 'auto',
          }}>
            {/* Brand */}
            <div style={{ marginBottom: 32, paddingLeft: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                ProcureAI
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                Supply Chain Automation
              </div>
            </div>

            <NavLinks />

            <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--border)', paddingLeft: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Cummins Xtern 2026<br />
                Multi-Agent PO System
              </div>
            </div>
          </aside>

          {/* Main */}
          <main style={{
            flex: 1,
            padding: 32,
            minHeight: '100vh',
            overflowY: 'auto',
            background: 'var(--bg-primary)',
          }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
