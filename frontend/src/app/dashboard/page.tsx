import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ClipboardPlus,
  CreditCard,
  FileSearch,
  FlaskConical,
  LayoutDashboard,
  Printer,
  ShieldCheck,
  Users,
  UserCog,
} from 'lucide-react';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserPublic } from '@/lib/api/types';
import { formatDateTime } from '@/lib/utils';

export const metadata = { title: 'Overview' };

type Summary = {
  registrations: number;
  drafts: number;
  submittedForReview: number;
  readyForScreening: number;
  approvedPayments: number;
  medicalScreenings: number;
  samplesCollected: number;
  resultsEntered: number;
  medicalApproved: number;
  medicalRejected: number;
  validCertificates: number;
  expiredCertificates: number;
  certificateDeliveries: number;
};

const emptySummary: Summary = {
  registrations: 0,
  drafts: 0,
  submittedForReview: 0,
  readyForScreening: 0,
  approvedPayments: 0,
  medicalScreenings: 0,
  samplesCollected: 0,
  resultsEntered: 0,
  medicalApproved: 0,
  medicalRejected: 0,
  validCertificates: 0,
  expiredCertificates: 0,
  certificateDeliveries: 0,
};

export default async function DashboardHome() {
  const actor = await readActorFromAccessToken();
  if (!actor) return null;

  let me: UserPublic | null = null;
  let summary = emptySummary;
  let loadError = '';

  try {
    const [profile, reportSummary] = await Promise.all([
      apiFetch<UserPublic>('/users/me', { authenticated: true }),
      apiFetch<Summary>('/reports/summary', { authenticated: true }),
    ]);
    me = profile;
    summary = reportSummary;
  } catch (error) {
    if (error instanceof ApiError) loadError = error.message;
    else throw error;
  }

  const medicalQueue = summary.readyForScreening + summary.samplesCollected + summary.resultsEntered;
  const pendingDelivery = Math.max(summary.validCertificates - summary.certificateDeliveries, 0);
  const workflow = [
    { label: 'Intake', value: summary.registrations, href: '/dashboard/registrations', color: 'bg-[#0f5257]' },
    { label: 'Paid / UID', value: summary.approvedPayments, href: '/dashboard/payments', color: 'bg-[#1f7a6d]' },
    { label: 'Medical', value: summary.medicalScreenings, href: '/dashboard/medical', color: 'bg-[#3d8b6f]' },
    { label: 'Approved', value: summary.medicalApproved, href: '/dashboard/medical', color: 'bg-[#6d9f71]' },
    { label: 'Certified', value: summary.validCertificates, href: '/dashboard/certificates', color: 'bg-[#d4a017]' },
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-sm border border-ink-200 bg-white p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Darbel command center</p>
            <h1 className="mt-2 font-display text-4xl font-medium text-ink-950">
              {me ? `Welcome back, ${firstName(me.fullName)}.` : 'Compliance Overview'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600">
              Track today’s compliance work from intake to certification, then jump straight into the queue that needs attention.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/dashboard/registrations/new">
                <ClipboardPlus className="mr-2 h-4 w-4" />
                New registration
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/reports">
                <BarChart3 className="mr-2 h-4 w-4" />
                Reports
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {loadError && (
        <Alert variant="danger" title="Workflow summary could not load">
          {loadError}
        </Alert>
      )}

      {me && !me.mfaEnabled && !actor.isPlatformOperator && (
        <Alert variant="warning" title="Multi-factor authentication is not enabled">
          This account can touch sensitive compliance data. Enable MFA from{' '}
          <Link href="/dashboard/settings" className="font-medium underline">
            My account
          </Link>
          .
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={ClipboardPlus} label="Registrations" value={summary.registrations} detail={`${summary.drafts} drafts`} />
        <Metric icon={BadgeCheck} label="Review queue" value={summary.submittedForReview} detail="Awaiting payment decision" />
        <Metric icon={FlaskConical} label="Medical queue" value={medicalQueue} detail={`${summary.resultsEntered} results entered`} />
        <Metric icon={ShieldCheck} label="Certificates" value={summary.validCertificates} detail={`${pendingDelivery} pending delivery`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Panel title="Workflow Progress" description="Live movement from registration to valid certificate." icon={LayoutDashboard}>
          <WorkflowBars items={workflow} />
        </Panel>

        <Panel title="Priority Queue" description="The work that should be cleared first." icon={BadgeCheck}>
          <div className="grid gap-3">
            <QueueItem href="/dashboard/registrations?status=SUBMITTED_FOR_REVIEW" label="Review applicants" value={summary.submittedForReview} tone="warning" />
            <QueueItem href="/dashboard/medical" label="Complete medical screening" value={medicalQueue} tone="accent" />
            <QueueItem href="/dashboard/certificates" label="Record certificate delivery" value={pendingDelivery} tone="success" />
            <QueueItem href="/dashboard/readiness" label="Launch readiness" value={summary.registrations > 0 && summary.validCertificates > 0 ? 0 : 1} tone="neutral" />
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <Panel title="Quick Actions" description="Jump into the main operating surfaces." icon={ArrowRight}>
          <div className="grid gap-3 md:grid-cols-2">
            <ActionLink href="/dashboard/payments" icon={CreditCard} title="Approve payments" value={summary.approvedPayments} />
            <ActionLink href="/dashboard/medical" icon={FlaskConical} title="Attend medical queue" value={summary.medicalScreenings} />
            <ActionLink href="/dashboard/certificates" icon={Printer} title="Print certificates" value={summary.validCertificates} />
            <ActionLink href="/dashboard/reports" icon={BarChart3} title="Open reports" value={summary.registrations + summary.validCertificates} />
          </div>
        </Panel>

        <Panel title="Operator Context" description="Signed-in user and admin shortcuts." icon={UserCog}>
          <div className="space-y-3 text-sm">
            <Row label="Full name" value={me?.fullName ?? actor.email} />
            <Row label="Email" value={actor.email} mono />
            <Row label="Last sign-in" value={me?.lastLoginAt ? formatDateTime(me.lastLoginAt) : 'First sign-in'} />
            <Row label="Permissions" value={`${actor.permissions.length}`} mono />
            {me && (
              <Row
                label="Roles"
                value={
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {me.roles.map((role) => (
                      <Badge key={role.code} variant="accent">
                        {role.displayName}
                      </Badge>
                    ))}
                  </div>
                }
              />
            )}
            <div className="grid gap-2 pt-2">
              {actor.permissions.includes('user.view') && <MiniLink href="/dashboard/users" icon={Users} label="Users" />}
              {actor.permissions.includes('role.view') && <MiniLink href="/dashboard/roles" icon={UserCog} label="Roles" />}
              {actor.permissions.includes('audit.view') && <MiniLink href="/dashboard/audit" icon={FileSearch} label="Audit log" />}
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-sm border border-ink-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <p className="mt-4 font-display text-4xl font-medium text-ink-950">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{detail}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-ink-200 bg-white p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-medium text-ink-950">{title}</h2>
          <p className="mt-1 text-sm text-ink-500">{description}</p>
        </div>
        <Icon className="mt-1 h-5 w-5 shrink-0 text-accent" />
      </div>
      {children}
    </section>
  );
}

function WorkflowBars({ items }: { items: Array<{ label: string; value: number; href: string; color: string }> }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="grid min-h-80 grid-cols-5 items-end gap-3 border-l border-b border-ink-100 px-3 pb-4 pt-8">
      {items.map((item) => {
        const height = Math.max(6, Math.round((item.value / max) * 100));
        return (
          <Link key={item.label} href={item.href} className="group flex h-full min-w-0 flex-col items-center justify-end gap-3">
            <p className="font-mono text-sm font-semibold text-ink-900">{item.value}</p>
            <div className="flex h-56 w-full items-end">
              <div className={`w-full rounded-t-sm transition-opacity group-hover:opacity-80 ${item.color}`} style={{ height: `${height}%` }} />
            </div>
            <p className="min-h-8 text-center text-xs font-medium text-ink-600">{item.label}</p>
          </Link>
        );
      })}
    </div>
  );
}

function QueueItem({
  href,
  label,
  value,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  tone: 'warning' | 'accent' | 'success' | 'neutral';
}) {
  return (
    <Link href={href} className="flex items-center justify-between gap-4 rounded-sm border border-ink-100 bg-ink-50/40 p-4 transition hover:border-accent/40">
      <div>
        <p className="text-sm font-semibold text-ink-900">{label}</p>
        <p className="mt-1 text-xs text-ink-500">{value <= 0 ? 'Nothing pending' : 'Needs attention'}</p>
      </div>
      <span className={`rounded-sm px-2.5 py-1 font-mono text-sm font-semibold ${queueTone(tone)}`}>{value <= 0 ? 'Clear' : value}</span>
    </Link>
  );
}

function ActionLink({
  href,
  icon: Icon,
  title,
  value,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  value: number;
}) {
  return (
    <Link href={href} className="group rounded-sm border border-ink-100 bg-ink-50/40 p-4 transition hover:border-accent/40">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 text-accent" />
        <span className="font-mono text-sm font-semibold text-ink-700">{value}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink-900">{title}</p>
      <span className="mt-3 inline-flex items-center text-xs font-medium text-accent">
        Continue
        <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</span>
      <span className={mono ? 'font-mono text-ink-800' : 'text-right text-ink-800'}>{value}</span>
    </div>
  );
}

function MiniLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Button asChild variant="outline" size="sm" className="justify-start">
      <Link href={href}>
        <Icon className="mr-2 h-3.5 w-3.5" />
        {label}
      </Link>
    </Button>
  );
}

function queueTone(tone: 'warning' | 'accent' | 'success' | 'neutral'): string {
  if (tone === 'warning') return 'bg-warning/10 text-warning';
  if (tone === 'success') return 'bg-success/10 text-success';
  if (tone === 'accent') return 'bg-accent/10 text-accent';
  return 'bg-ink-100 text-ink-700';
}

function firstName(full: string): string {
  const f = full.trim().split(/\s+/)[0];
  return f ? f : 'Operator';
}
