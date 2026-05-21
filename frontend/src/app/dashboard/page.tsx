import { readActorFromAccessToken } from '@/lib/auth/claims';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserPublic } from '@/lib/api/types';
import { formatDateTime } from '@/lib/utils';
import { ArrowRight, Users, FileSearch, UserCog } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Overview' };

export default async function DashboardHome() {
  const actor = readActorFromAccessToken();
  if (!actor) return null;

  let me: UserPublic | null = null;
  try {
    me = await apiFetch<UserPublic>('/users/me', { authenticated: true });
  } catch (e) {
    // Show degraded view on error
    if (!(e instanceof ApiError)) throw e;
  }

  const hasUserView = actor.permissions.includes('user.view');
  const hasRoleView = actor.permissions.includes('role.view');
  const hasAudit = actor.permissions.includes('audit.view');

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">
          Welcome back
        </p>
        <h1 className="mt-1 font-display text-4xl font-medium text-ink-900">
          {me ? firstName(me.fullName) : 'Operator'}.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-600">
          This is the Darbel administration console. Phase 1 covers identity, access,
          and audit. Registration, payments, medical workflows, and certificates land in
          the next releases.
        </p>
      </header>

      {me && !me.mfaEnabled && !actor.isPlatformOperator && (
        <Alert variant="warning" title="Multi-factor authentication is not enabled">
          For an account with access to sensitive data, enabling MFA is strongly recommended.
          You can enable it from{' '}
          <Link href="/dashboard/settings" className="font-medium underline">
            My account
          </Link>
          .
        </Alert>
      )}

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {hasUserView && (
          <ConsoleCard
            href="/dashboard/users"
            icon={Users}
            title="Users"
            description="Invite, deactivate, and assign roles to people in your tenant."
          />
        )}
        {hasRoleView && (
          <ConsoleCard
            href="/dashboard/roles"
            icon={UserCog}
            title="Roles & Permissions"
            description="Inspect the role catalogue and the permissions each role grants."
          />
        )}
        {hasAudit && (
          <ConsoleCard
            href="/dashboard/audit"
            icon={FileSearch}
            title="Audit log"
            description="Every change in the platform is recorded immutably. Browse and filter."
          />
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your session</CardTitle>
            <CardDescription>The current actor and recent activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Full name" value={me?.fullName ?? '—'} />
            <Row label="Email" value={actor.email} mono />
            <Row
              label="Roles"
              value={
                me ? (
                  <div className="flex flex-wrap gap-1.5">
                    {me.roles.map((r) => (
                      <Badge key={r.code} variant="accent">
                        {r.displayName}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  '—'
                )
              }
            />
            <Row label="Permissions granted" value={`${actor.permissions.length}`} mono />
            <Row
              label="Last sign-in"
              value={me?.lastLoginAt ? formatDateTime(me.lastLoginAt) : 'First sign-in'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What is coming next</CardTitle>
            <CardDescription>Visible to platform admins for planning.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ol className="space-y-3 text-ink-700">
              <Step n="2" label="Registration" detail="Food handlers, trade categories, document uploads, UID issuance." />
              <Step n="3" label="Medical" detail="Configurable test panels, lab entry, medical officer approval workflow." />
              <Step n="4" label="Payments" detail="Paystack / Flutterwave integration, finance approval, refunds." />
              <Step n="5" label="Certificates" detail="QR-verifiable certificates, renewals, revocations." />
              <Step n="6" label="Reports" detail="Excel and PDF exports, compliance reports for regulators." />
            </ol>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ConsoleCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-sm border border-ink-200 bg-white p-5 transition-all hover:border-accent/40 hover:shadow-[0_8px_24px_-12px_rgba(15,82,87,0.16)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-accent/5 text-accent">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <ArrowRight className="h-4 w-4 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
      <h3 className="mt-4 font-display text-lg font-medium text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-600">{description}</p>
    </Link>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</span>
      <span className={mono ? 'font-mono text-ink-800' : 'text-ink-800'}>{value}</span>
    </div>
  );
}

function Step({ n, label, detail }: { n: string; label: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm bg-ink-100 font-mono text-[11px] text-ink-700">
        {n}
      </span>
      <div>
        <p className="font-medium text-ink-900">{label}</p>
        <p className="text-xs text-ink-500">{detail}</p>
      </div>
    </li>
  );
}

function firstName(full: string): string {
  const f = full.trim().split(/\s+/)[0];
  return f ? f : 'Operator';
}
