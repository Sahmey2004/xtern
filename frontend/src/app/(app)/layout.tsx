'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth-provider';

type NavItem = { href: string; label: string; roles: Array<'administrator' | 'po_manager'> };

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', roles: ['administrator'] },
  { href: '/pipeline', label: 'Pipeline', roles: ['administrator', 'po_manager'] },
  { href: '/approvals', label: 'Approvals', roles: ['administrator'] },
  { href: '/logs', label: 'Decision Log', roles: ['administrator'] },
  { href: '/data', label: 'Data', roles: ['administrator', 'po_manager'] },
  { href: '/settings/account', label: 'Account', roles: ['administrator', 'po_manager'] },
];

const MANAGER_BLOCKLIST = ['/dashboard', '/approvals', '/logs'];

function navClass(isActive: boolean) {
  return `nav-link ${isActive ? 'nav-link-active' : ''}`;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace('/signin');
      return;
    }
    if (profile.role === 'po_manager' && MANAGER_BLOCKLIST.some(prefix => pathname.startsWith(prefix))) {
      router.replace('/pipeline');
    }
  }, [loading, pathname, profile, router]);

  if (loading || !profile) {
    return (
      <div className="app-shell">
        <div className="surface-card p-8">
          <p className="text-sm text-slate-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(profile.role));

  return (
    <div className="app-shell">
      <aside className="app-sidebar hidden lg:flex">
        <div className="flex items-center gap-3 pb-7">
          <div className="brand-mark">P</div>
          <div>
            <p className="text-sm font-semibold text-slate-900">ProcurePilot</p>
            <p className="text-xs text-slate-500">{profile.role === 'administrator' ? 'Administrator' : 'PO Manager'}</p>
          </div>
        </div>

        <nav className="space-y-1">
          {filteredNav.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={navClass(active)}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Signed in</p>
            <p className="mt-2 text-sm font-medium text-slate-700">{profile.full_name}</p>
            <p className="text-xs text-slate-500">{profile.email}</p>
          </div>
          <button
            className="button button-secondary w-full"
            onClick={async () => {
              await signOut();
              router.replace('/signin');
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
            <span className="brand-mark brand-mark-sm">P</span>
            ProcurePilot
          </Link>

          <nav className="flex flex-wrap items-center gap-2 lg:hidden">
            {filteredNav.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} className={`top-nav-pill ${active ? 'top-nav-pill-active' : ''}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {profile.role === 'administrator' ? 'Admin Access' : 'Manager Access'}
          </div>
        </header>

        <section className="app-content">{children}</section>
      </div>
    </div>
  );
}

