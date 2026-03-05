'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/lib/auth';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles?: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '◆' },
  { href: '/pipeline', label: 'Pipeline', icon: '▷' },
  { href: '/approvals', label: 'Approvals', icon: '◎', roles: ['administrator'] },
  { href: '/logs', label: 'Logs', icon: '≡', roles: ['administrator'] },
  { href: '/data', label: 'Data', icon: '⊞' },
  { href: '/suppliers', label: 'Suppliers', icon: '◈' },
  { href: '/agents', label: 'Agents', icon: '⬡' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  const visibleItems = NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role));

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      justifyContent: 'center',
      gap: 0,
      padding: '0 8px',
      backdropFilter: 'blur(16px)',
    }}>
      {visibleItems.map(item => {
        const isActive = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '10px 12px',
              minWidth: 56,
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)',
              textDecoration: 'none',
              transition: 'all 0.15s',
              borderTop: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
