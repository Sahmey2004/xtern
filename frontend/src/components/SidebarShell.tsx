'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import NavLinks from './NavLinks';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/auth';

export default function SidebarShell({ children }: { children: React.ReactNode }) {
  const { user, displayName, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Pages with their own full-page layout render without sidebar
  if (pathname === '/login' || pathname === '/') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const roleLabel = role === 'administrator' ? 'Admin' : 'PO Manager';
  const roleBadgeStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 100,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    background: role === 'administrator' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)',
    color: role === 'administrator' ? 'var(--accent-purple)' : 'var(--accent-blue)',
    border: `1px solid ${role === 'administrator' ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.3)'}`,
  };

  return (
    <>
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

        {/* Bottom: user info + logout */}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {user ? (
            <>
              <Link
                href="/account"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 8px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  marginBottom: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--accent-blue-glow)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)',
                  flexShrink: 0,
                }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </div>
                  <span style={roleBadgeStyle}>{roleLabel}</span>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  padding: '6px 10px',
                  textAlign: 'left' as const,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
                  e.currentTarget.style.color = 'var(--accent-red)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                ↑ Sign out
              </button>
            </>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: 4 }}>
              Cummins Xtern 2026<br />
              Multi-Agent PO System
            </div>
          )}
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
    </>
  );
}
