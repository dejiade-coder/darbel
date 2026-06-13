import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ClipboardPlus,
  CreditCard,
  Download,
  FileSearch,
  FlaskConical,
  Printer,
  ShieldCheck,
  Users,
  UserCog,
} from 'lucide-react';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-ink-200 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Darbel compliance workflow</p>
          <h1 className="mt-1 font-display text-4xl font-medium text-ink-900">
            {me ? `${firstName(me.fullName)}, your workflow is ready.` : 'Compliance workflow'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-ink-600">
            Run food handler compliance end to end: register the applicant, confirm payment, issue a UID,
            collect documents, complete medical screening, issue a certificate, verify it publicly, and export reports.
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Metric label="Registrations" value={summary.registrations} detail={`${summary.drafts} drafts`} />
        <Metric label="Review queue" value={summary.submittedForReview} detail="Submitted records" />
        <Metric label="Paid / UID" value={summary.approvedPayments} detail={`${summary.readyForScreening} ready`} />
        <Metric label="Medical" value={summary.medicalScreenings} detail={`${summary.resultsEntered} results entered`} />
        <Metric label="Approved" value={summary.medicalApproved} detail={`${summary.medicalRejected} rejected`} />
        <Metric label="Certificates" value={summary.validCertificates} detail={`${summary.expiredCertificates} expired`} />
      </section>

      <section className="rounded-sm border border-ink-200 bg-white">
        <div className="border-b border-ink-100 p-5">
          <h2 className="font-display text-2xl font-medium text-ink-900">Complete Workflow</h2>
          <p className="mt-1 text-sm text-ink-600">Follow these stages from left to right for each food handler.</p>
        </div>
        <div className="grid gap-0 divide-y divide-ink-100 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          <WorkflowStage
            href="/dashboard/registrations"
            icon={ClipboardPlus}
            label="1. Intake"
            count={summary.registrations}
            detail="Capture applicant identity, trade category, business details, and documents."
            action="Open registrations"
          />
          <WorkflowStage
            href="/dashboard/payments"
            icon={CreditCard}
            label="2. Payment"
            count={summary.approvedPayments}
            detail="Record and approve payment. Approval issues the handler UID automatically."
            action="Open payments"
          />
          <WorkflowStage
            href="/dashboard/medical"
            icon={FlaskConical}
            label="3. Medical"
            count={summary.medicalScreenings}
            detail="Collect samples, enter lab results, and approve fit handlers for certification."
            action="Open medical"
          />
          <WorkflowStage
            href="/dashboard/certificates"
            icon={ShieldCheck}
            label="4. Certificate"
            count={summary.validCertificates}
            detail="Print certificates and share the public UID verification link."
            action="Open certificates"
          />
          <WorkflowStage
            href="/dashboard/reports"
            icon={Download}
            label="5. Reports"
            count={summary.registrations}
            detail="Export registration and certificate CSV reports for operations or regulators."
            action="Open reports"
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="grid gap-4 md:grid-cols-2">
          <ActionCard
            href="/dashboard/registrations?status=SUBMITTED_FOR_REVIEW"
            icon={BadgeCheck}
            title="Review submitted applicants"
            description="Check intake records that are waiting before payment confirmation."
            value={summary.submittedForReview}
          />
          <ActionCard
            href="/dashboard/medical"
            icon={FlaskConical}
            title="Process medical queue"
            description="Collect samples or approve results for handlers ready to be certified."
            value={summary.readyForScreening + summary.resultsEntered}
          />
          <ActionCard
            href="/dashboard/certificates"
            icon={Printer}
            title="Print issued certificates"
            description="Open issued certificates, print them, and use the public verification page."
            value={summary.validCertificates}
          />
          <ActionCard
            href="/dashboard/reports"
            icon={FileSearch}
            title="Export compliance reports"
            description="Download registrations and certificates as CSV for reconciliation."
            value={summary.registrations + summary.validCertificates}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Operator Context</CardTitle>
            <CardDescription>Current account and available administration surfaces.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Full name" value={me?.fullName ?? actor.email} />
            <Row label="Email" value={actor.email} mono />
            <Row label="Last sign-in" value={me?.lastLoginAt ? formatDateTime(me.lastLoginAt) : 'First sign-in'} />
            <Row label="Permissions" value={`${actor.permissions.length}`} mono />
            {me && (
              <Row
                label="Roles"
                value={
                  <div className="flex flex-wrap gap-1.5">
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
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-sm border border-ink-200 bg-white p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className="mt-3 font-display text-3xl font-medium text-ink-900">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{detail}</p>
    </div>
  );
}

function WorkflowStage({
  href,
  icon: Icon,
  label,
  count,
  detail,
  action,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  count: number;
  detail: string;
  action: string;
}) {
  return (
    <Link href={href} className="group flex min-h-[230px] flex-col p-5 transition-colors hover:bg-ink-50/70">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-accent/5 text-accent">
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </div>
        <span className="font-display text-3xl font-medium text-ink-900">{count}</span>
      </div>
      <h3 className="mt-5 text-sm font-semibold text-ink-900">{label}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-ink-600">{detail}</p>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-accent">
        {action}
        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
  value,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  value: number;
}) {
  return (
    <Link href={href} className="group rounded-sm border border-ink-200 bg-white p-5 transition-colors hover:border-accent/40 hover:bg-ink-50/70">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-ink-50 text-accent">
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </div>
        <span className="font-display text-3xl font-medium text-ink-900">{value}</span>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-ink-600">{description}</p>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-accent">
        Continue
        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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

function firstName(full: string): string {
  const f = full.trim().split(/\s+/)[0];
  return f ? f : 'Operator';
}
