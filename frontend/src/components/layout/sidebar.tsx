'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  FileSearch,
  LayoutGrid,
  ShieldCheck,
  UserCog,
  Users,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** If set, only render when the user has at least one of these permissions */
  requireAny?: string[];
}

const ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid },
  { href: '/dashboard/users', label: 'Users', icon: Users, requireAny: ['user.view'] },
  { href: '/dashboard/roles', label: 'Roles & Permissions', icon: UserCog, requireAny: ['role.view'] },
  { href: '/dashboard/audit', label: 'Audit log', icon: FileSearch, requireAny: ['audit.view'] },
  { href: '/dashboard/settings', label: 'My account', icon: ClipboardList },
  { href: '/dashboard/trade-categories', label: 'Trade Categories', icon: Tag, requireAny: ['trade.set_fee'] },
];

export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const visible = ITEMS.filter(
    (i) => !i.requireAny || i.requireAny.some((p) => permissions.includes(p)),
  );

  return (
    <aside className="hidden w-64 flex-col border-r border-ink-200 bg-white lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-ink-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent text-parchment">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-display text-base font-medium leading-none text-ink-900">Darbel</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-ink-500">
            Branddarrow
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-5">
        {visible.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-accent/5 text-accent font-medium'
                  : 'text-ink-700 hover:bg-ink-50',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <footer className="border-t border-ink-100 px-4 py-3 text-[10px] uppercase tracking-wider text-ink-400">
        Phase 1 · v0.1.0
      </footer>
    </aside>
  );
}
