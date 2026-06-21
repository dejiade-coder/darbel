'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ClipboardList,
  ClipboardPlus,
  ListChecks,
  FileSearch,
  FlaskConical,
  LayoutGrid,
  CreditCard,
  ShieldCheck,
  BadgeCheck,
  BarChart3,
  UserCog,
  Users,
  Tag,
  Building2,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  requireAny?: string[];
}

const ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid },
  { href: '/dashboard/tenants', label: 'Tenants', icon: Building2, requireAny: ['platform.manage'] },
  { href: '/dashboard/registrations', label: 'Registrations', icon: ClipboardPlus, requireAny: ['handler.view'] },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCard, requireAny: ['payment.view'] },
  { href: '/dashboard/medical', label: 'Medical', icon: FlaskConical, requireAny: ['medical.view_results'] },
  { href: '/dashboard/certificates', label: 'Certificates', icon: BadgeCheck, requireAny: ['certificate.view'] },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, requireAny: ['report.view'] },
  { href: '/dashboard/readiness', label: 'Readiness', icon: ListChecks, requireAny: ['tenant.view', 'report.view'] },
  { href: '/dashboard/users', label: 'Users', icon: Users, requireAny: ['user.view'] },
  { href: '/dashboard/roles', label: 'Roles & Permissions', icon: UserCog, requireAny: ['role.view'] },
  { href: '/dashboard/audit', label: 'Audit log', icon: FileSearch, requireAny: ['audit.view'] },
  { href: '/dashboard/settings', label: 'Settings', icon: ClipboardList },
  { href: '/dashboard/trade-categories', label: 'Trade Categories', icon: Tag, requireAny: ['trade.set_fee'] },
];

export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const visible = ITEMS.filter(
    (item) => !item.requireAny || item.requireAny.some((permission) => permissions.includes(permission)),
  );

  return (
    <>
      <aside className="hidden w-64 flex-col border-r border-ink-200 bg-white lg:flex">
        <Brand />
        <Navigation items={visible} pathname={pathname} />
        <footer className="border-t border-ink-100 px-4 py-3 text-[10px] uppercase tracking-wider text-ink-400">
          Phase 1 - v0.1.0
        </footer>
      </aside>
      <MobileNavigation items={visible} pathname={pathname} />
    </>
  );
}

function Brand() {
  return (
    <div className="flex h-16 items-center gap-3 px-6">
      <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent text-parchment">
        <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div>
        <p className="font-display text-base font-medium leading-none text-ink-900">Darbel</p>
        <p className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-ink-500">Branddarrow</p>
      </div>
    </div>
  );
}

function Navigation({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-5">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors',
              active ? 'bg-accent/5 font-medium text-accent' : 'text-ink-700 hover:bg-ink-50',
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.6} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavigation({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          title="Open navigation"
          aria-label="Open navigation"
          className="fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-sm border border-ink-200 bg-white text-ink-700 shadow-sm lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/30 backdrop-blur-[1px] lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,86vw)] flex-col bg-white shadow-xl lg:hidden">
          <div className="flex items-center justify-between border-b border-ink-200">
            <Brand />
            <Dialog.Close asChild>
              <button
                type="button"
                title="Close navigation"
                aria-label="Close navigation"
                className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-600 hover:bg-ink-50"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Close asChild>
            <div>
              <Navigation items={items} pathname={pathname} />
            </div>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
