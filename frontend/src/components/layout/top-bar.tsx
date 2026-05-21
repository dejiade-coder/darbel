'use client';

import { useTransition } from 'react';
import { LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { logoutAction } from '@/app/dashboard/actions';

interface TopBarProps {
  fullName: string;
  email: string;
  isPlatformOperator: boolean;
  mfaEnabled: boolean;
}

export function TopBar({ fullName, email, isPlatformOperator, mfaEnabled }: TopBarProps) {
  const [isPending, startTransition] = useTransition();
  const initials = getInitials(fullName);

  return (
    <header className="flex h-16 items-center justify-between border-b border-ink-200 bg-white/85 px-8 backdrop-blur">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
          {isPlatformOperator ? 'Platform Console' : 'Tenant Console'}
        </p>
      </div>
      <div className="flex items-center gap-5">
        {!mfaEnabled && !isPlatformOperator ? (
          <Badge variant="warning" className="gap-1.5">
            <ShieldAlert className="h-3 w-3" />
            MFA not enabled
          </Badge>
        ) : (
          <Badge variant="success" className="gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            MFA enabled
          </Badge>
        )}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight text-ink-800">{fullName}</p>
            <p className="text-xs text-ink-500">{email}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-xs font-medium text-accent">
            {initials}
          </div>
        </div>
        <form
          action={(formData) => {
            startTransition(async () => {
              await logoutAction(formData);
            });
          }}
        >
          <button
            type="submit"
            disabled={isPending}
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-ink-200 text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
