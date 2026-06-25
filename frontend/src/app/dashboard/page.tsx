import Link from 'next/link';
import {
  AlertTriangle,
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
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { getRestrictedWorkspace, type RestrictedWorkspace } from '@/lib/auth/workspace';
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
  let restrictedWorkspace = getRestrictedWorkspace(actor.roleCodes, actor.isPlatformOperator);
  if (!restrictedWorkspace && actor.roleCodes.length === 0) {
    try {
      const currentUser = await apiFetch<UserPublic>('/users/me', { authenticated: true });
      restrictedWorkspace = getRestrictedWorkspace(
        currentUser.roles.map((role) => role.code),
        actor.isPlatformOperator,
      );
    } catch {
      // The regular dashboard error state handles a failed profile request.
    }
  }
  if (restrictedWorkspace) return <RestrictedWorkspaceHome workspace={restrictedWorkspace} />;

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
  const certificationRate = percent(summary.validCertificates, summary.registrations);
  const medicalPassRate = percent(summary.medicalApproved, summary.medicalApproved + summary.medicalRejected);
  const activeWork = summary.drafts + summary.submittedForReview + medicalQueue + pendingDelivery;

  const workflow = [
    { label: 'Intake', value: summary.registrations, href: '/dashboard/registrations', color: 'bg-[#0f5257]' },
    { label: 'Payment', value: summary.approvedPayments, href: '/dashboard/payments', color: 'bg-[#17806f]' },
    { label: 'Medical', value: summary.medicalScreenings, href: '/dashboard/medical', color: 'bg-[#4f9f78]' },
    { label: 'Approved', value: summary.medicalApproved, href: '/dashboard/medical', color: 'bg-[#82a957]' },
    { label: 'Certified', value: summary.validCertificates, href: '/dashboard/certificates', color: 'bg-[#d4a017]' },
  ];

  const priorities = [
    {
      href: '/dashboard/registrations?status=SUBMITTED_FOR_REVIEW',
      label: 'Payment review',
      description: 'Registrar decision needed',
      value: summary.submittedForReview,
      tone: 'warning' as const,
    },
    {
      href: '/dashboard/medical',
      label: 'Medical queue',
      description: 'Collect samples or enter results',
      value: medicalQueue,
      tone: 'accent' as const,
    },
    {
      href: '/dashboard/certificates',
      label: 'Certificate delivery',
      description: 'Print, send, or mark delivered',
      value: pendingDelivery,
      tone: 'success' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-sm border border-[#0c4a42]/20 bg-[#062f2d] text-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7">
          <div className="flex min-h-56 flex-col justify-between gap-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/75">Darbel command center</p>
              <h1 className="mt-3 max-w-3xl font-display text-4xl font-medium text-white lg:text-5xl">
                {me ? `Welcome back, ${firstName(me.fullName)}.` : 'Compliance Overview'}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">
                Monitor registrations, medical screening, certificates, and delivery from one calm operating view.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="bg-white text-[#062f2d] hover:bg-emerald-50">
                <Link href="/dashboard/registrations/new">
                  <ClipboardPlus className="mr-2 h-4 w-4" />
                  New registration
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
                <Link href="/dashboard/reports">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Reports
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid content-between gap-3 rounded-sm border border-white/15 bg-white/8 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-100/70">Active workload</p>
                <p className="mt-2 font-display text-5xl font-medium">{activeWork}</p>
              </div>
              <LayoutDashboard className="h-6 w-6 text-emerald-100/80" />
            </div>
            <div className="grid gap-3">
              <HeroMeter label="Certification rate" value={certificationRate} />
              <HeroMeter label="Medical pass rate" value={medicalPassRate} />
            </div>
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
        <Metric icon={ClipboardPlus} label="Registrations" value={summary.registrations} detail={`${summary.drafts} drafts saved`} />
        <Metric icon={CreditCard} label="Payments approved" value={summary.approvedPayments} detail={`${summary.submittedForReview} awaiting decision`} />
        <Metric icon={FlaskConical} label="Medical queue" value={medicalQueue} detail={`${summary.resultsEntered} results entered`} />
        <Metric icon={ShieldCheck} label="Valid certificates" value={summary.validCertificates} detail={`${pendingDelivery} pending delivery`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Panel title="Workflow Movement" description="A quick view of where applications are clustering." icon={TrendingUp}>
          <WorkflowBars items={workflow} />
        </Panel>

        <Panel title="Priority Work" description="Clear these first to keep the flow moving." icon={AlertTriangle}>
          <div className="grid gap-3">
            {priorities.map((item) => (
              <QueueItem key={item.label} {...item} />
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <Panel title="Fast Paths" description="Open the main workspaces without hunting through the sidebar." icon={ArrowRight}>
          <div className="grid gap-3 md:grid-cols-2">
            <ActionLink href="/dashboard/registrations" icon={ClipboardPlus} title="Registration queue" value={summary.registrations} />
            <ActionLink href="/dashboard/medical" icon={FlaskConical} title="Medical workspace" value={summary.medicalScreenings} />
            <ActionLink href="/dashboard/certificates" icon={Printer} title="Certificate desk" value={summary.validCertificates} />
            <ActionLink href="/dashboard/reports" icon={BarChart3} title="Reporting dashboard" value={summary.registrations + summary.validCertificates} />
          </div>
        </Panel>

        <Panel title="Operator" description="Current account and useful admin links." icon={UserCog}>
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

function RestrictedWorkspaceHome({ workspace }: { workspace: Exclude<RestrictedWorkspace, null> }) {
  const isFinance = workspace === 'finance' || workspace === 'finance_auditor';
  const isAuditor = workspace === 'auditor' || workspace === 'finance_auditor';
  const isInspector = workspace === 'inspector';
  const isMedical = workspace === 'medical' || workspace === 'medical_lab';
  const isLab = workspace === 'lab' || workspace === 'medical_lab';
  const title = getWorkspaceTitle(workspace);
  const description = getWorkspaceDescription(workspace);

  return (
    <div className="space-y-6">
      <header className="rounded-sm border border-[#0c4a42]/20 bg-[#062f2d] p-7 text-white shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/75">Focused workspace</p>
        <h1 className="mt-3 font-display text-4xl font-medium">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">{description}</p>
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isFinance && <WorkspaceLink href="/dashboard/payments" icon={CreditCard} title="Payments" description="Record, review, approve, and reconcile payment activity." />}
        {isAuditor && <WorkspaceLink href="/dashboard/certificates" icon={BadgeCheck} title="Certificate review" description="Review certificate status, appeal posture, and validity records." />}
        {isAuditor && <WorkspaceLink href="/dashboard/medical" icon={FlaskConical} title="Medical review" description="Review medical screening outcomes without operational controls." />}
        {isInspector && <WorkspaceLink href="/dashboard/certificates" icon={BadgeCheck} title="Barcode and UID checks" description="Scan certificates or search UIDs during field verification." />}
        {(isMedical || isLab) && <WorkspaceLink href="/dashboard/medical" icon={FlaskConical} title="Medical screening" description="Attend handlers, collect samples, and record lab results." />}
        {!isInspector && <WorkspaceLink href="/dashboard/reports" icon={BarChart3} title="Reports" description="Open management reports and permitted exports." />}
      </section>
    </div>
  );
}

function getWorkspaceTitle(workspace: Exclude<RestrictedWorkspace, null>): string {
  if (workspace === 'finance') return 'Finance workspace';
  if (workspace === 'auditor') return 'Compliance review workspace';
  if (workspace === 'finance_auditor') return 'Finance and review workspace';
  if (workspace === 'inspector') return 'Inspector workspace';
  if (workspace === 'lab') return 'Lab technician workspace';
  if (workspace === 'medical_lab') return 'Medical and lab workspace';
  return 'Medical officer workspace';
}

function getWorkspaceDescription(workspace: Exclude<RestrictedWorkspace, null>): string {
  if (workspace === 'finance') return 'Review and manage payment activity for your organization.';
  if (workspace === 'auditor') return 'Review permitted compliance records and reports without access to raw audit logs.';
  if (workspace === 'finance_auditor') return 'Review payment activity and compliance records without raw audit-log access.';
  if (workspace === 'inspector') return 'Scan certificate barcodes and search UIDs during field verification.';
  if (workspace === 'lab') return 'Collect samples and enter Mantoux, Hepatitis B, HIV, and Widal results.';
  if (workspace === 'medical_lab') return 'Manage medical attendance, sample collection, lab results, and screening decisions.';
  return 'Review screening outcomes and approve fit handlers for certification.';
}

function WorkspaceLink({ href, icon: Icon, title, description }: { href: string; icon: React.ElementType; title: string; description: string }) {
  return (
    <Link href={href} className="group rounded-sm border border-ink-200 bg-white p-5 shadow-sm transition hover:border-accent/40">
      <Icon className="h-5 w-5 text-accent" />
      <p className="mt-4 text-lg font-semibold text-ink-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink-600">{description}</p>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-accent">Open <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
    </Link>
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
    <div className="rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
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
    <section className="rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
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
        const height = Math.max(7, Math.round((item.value / max) * 100));
        return (
          <Link key={item.label} href={item.href} className="group flex h-full min-w-0 flex-col items-center justify-end gap-3">
            <p className="font-mono text-sm font-semibold text-ink-900">{item.value}</p>
            <div className="flex h-56 w-full items-end rounded-t-sm bg-ink-50">
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
  description,
  value,
  tone,
}: {
  href: string;
  label: string;
  description: string;
  value: number;
  tone: 'warning' | 'accent' | 'success';
}) {
  return (
    <Link href={href} className="flex items-center justify-between gap-4 rounded-sm border border-ink-100 bg-ink-50/50 p-4 transition hover:border-accent/40 hover:bg-white">
      <div>
        <p className="text-sm font-semibold text-ink-900">{label}</p>
        <p className="mt-1 text-xs text-ink-500">{value <= 0 ? 'Nothing pending' : description}</p>
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
    <Link href={href} className="group rounded-sm border border-ink-100 bg-ink-50/50 p-4 transition hover:border-accent/40 hover:bg-white">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 text-accent" />
        <span className="font-mono text-sm font-semibold text-ink-700">{value}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink-900">{title}</p>
      <span className="mt-3 inline-flex items-center text-xs font-medium text-accent">
        Open
        <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function HeroMeter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-emerald-50/80">
        <span>{label}</span>
        <span className="font-mono font-semibold text-white">{value}%</span>
      </div>
      <div className="h-2 rounded-sm bg-white/15">
        <div className="h-2 rounded-sm bg-[#d4a017]" style={{ width: `${value}%` }} />
      </div>
    </div>
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

function queueTone(tone: 'warning' | 'accent' | 'success'): string {
  if (tone === 'warning') return 'bg-warning/10 text-warning';
  if (tone === 'success') return 'bg-success/10 text-success';
  return 'bg-accent/10 text-accent';
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function firstName(full: string): string {
  const f = full.trim().split(/\s+/)[0];
  return f ? f : 'Operator';
}
