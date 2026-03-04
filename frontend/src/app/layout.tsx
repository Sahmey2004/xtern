import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import SidebarShell from '@/components/SidebarShell';

export const metadata: Metadata = {
  title: 'ProcureAI — Supply Chain PO Automation',
  description: 'Multi-Agent Purchase Order Automation for Cummins',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', margin: 0 }}>
        <Providers>
          <SidebarShell>
            {children}
          </SidebarShell>
        </Providers>
      </body>
    </html>
  );
}
