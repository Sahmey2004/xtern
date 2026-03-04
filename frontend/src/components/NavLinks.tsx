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
  { href: '/pipeline', label: 'Run Pipeline', icon: '▷' },
  { href: '/approvals', label: 'Approval Queue', icon: '◎', roles: ['administrator'] },
  { href: '/logs', label: 'Decision Log', icon: '≡', roles: ['administrator'] },
  { href: '/data', label: 'Data', icon: '⊞' },
  { href: '/suppliers', label: 'Suppliers', icon: '◈' },
  { href: '/agents', label: 'Agents', icon: '⬡' },
];

export default function NavLinks() {
  const pathname = usePathname();
  const { role } = useAuth();

  const visibleItems = NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role));

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              backgroundColor: isActive ? 'rgba(59, 130, 246, 0.10)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
              marginLeft: isActive ? -2 : 0,
            }}
          >
            <span style={{ fontSize: 11, opacity: 0.7 }}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
