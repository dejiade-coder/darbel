import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Circle,
  FileDown,
  FileText,
  Settings,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Readiness' };

type Summary = {
  registrations: number;
  approvedPayments: number;
  medicalScreenings: number;
  medicalApproved: number;
  medicalRejected?: number;
  validCertificates: number;
  certificateDeliveries: number;
  expiredCertificates?: number;
  certificateEmails?: number;
  certificatePrints?: number;
  certificateWhatsApps?: number;
  conversion?: {
    paymentApprovalRate: number;
    medicalCompletionRate: number;
    certificationRate: number;
  };
};

type CertificateTemplate = {
  originalFilename: string | null;
  isApproved: boolean;
} | null;

type NotificationProviders = {
  emailEnabled: boolean;
  smtpHost: string | null;
  smtpPasswordConfigured: boolean;
  emailFromAddress: string | null;
  whatsAppEnabled: boolean;
  whatsAppPhoneNumberId: string | null;
  whatsAppAccessTokenConfigured: boolean;
};

type ReadinessItem = {
  label: string;
  detail: string;
  ready: boolean;
  href?: string;
  priority?: 'blocker' | 'important' | 'normal';
};

const emptySummary: Summary = {
  registrations: 0,
  approvedPayments: 0,
  medicalScreenings: 0,
  medicalApproved: 0,
  medicalRejected: 0,
  validCertificates: 0,
  certificateDeliveries: 0,
  expiredCertificates: 0,
  certificateEmails: 0,
  certificatePrints: 0,
  certificateWhatsApps: 0,
  conversion: {
    paymentApprovalRate: 0,
    medicalCompletionRate: 0,
    certificationRate: 0,
  },
};

export default async function ReadinessPage() {
  const actor = await readActorFromAccessToken();
  if (!actor) return null;

  let summary = emptySummary;
  let template: CertificateTemplate = null;
  let providers: NotificationProviders | null = null;
  let loadError = '';

  try {
    const [summaryResult, templateResult, providersResult] = await Promise.all([
      actor.permissions.includes('report.view')
        ? apiFetch<Summary>('/reports/summary', { authenticated: true })
        : Promise.resolve(emptySummary),
      actor.permissions.includes('tenant.view')
        ? apiFetch<CertificateTemplate>('/tenant-settings/certificate-template', { authenticated: true })
        : Promise.resolve(null),
      actor.permissions.includes('tenant.view')
        ? apiFetch<NotificationProviders>('/tenant-settings/notification-providers', { authenticated: true })
        : Promise.resolve(null),
    ]);
    summary = summaryResult;
    template = templateResult;
    providers = providersResult;
  } catch (error) {
    if (error instanceof ApiError) loadError = error.message;
    else throw error;
  }

  const sections = [
    {
      title: 'Workflow UAT',
      items: [
        item('Create registrations', `${summary.registrations} registration records exist`, summary.registrations > 0, '/dashboard/registrations/new'),
        item('Approve payment and issue UID', `${summary.approvedPayments} payments approved`, summary.approvedPayments > 0, '/dashboard/payments'),
        item('Complete medical screening', `${summary.medicalScreenings} screenings started, ${summary.medicalApproved} approved`, summary.medicalApproved > 0, '/dashboard/medical'),
        item('Issue certificates', `${summary.validCertificates} valid certificates`, summary.validCertificates > 0, '/dashboard/certificates'),
        item('Record certificate delivery', deliveryDetail(summary), summary.certificateDeliveries > 0, '/dashboard/certificates'),
      ],
    },
    {
      title: 'Tenant Setup',
      items: [
        item('Approved certificate template', template?.originalFilename ?? 'No approved certificate template uploaded', Boolean(template?.isApproved), '/dashboard/settings', 'blocker'),
        item('Email provider configured', emailProviderDetail(providers), Boolean(providers?.emailEnabled && providers.smtpHost && providers.emailFromAddress && providers.smtpPasswordConfigured), '/dashboard/settings', 'important'),
        item('WhatsApp provider configured', whatsAppProviderDetail(providers), Boolean(providers?.whatsAppEnabled && providers.whatsAppPhoneNumberId && providers.whatsAppAccessTokenConfigured), '/dashboard/settings', 'important'),
      ],
    },
    {
      title: 'Operations',
      items: [
        item('Reports exports available', 'Registration, medical, certificate, summary PDF, CSV, and Excel exports are built', true, '/dashboard/reports'),
        item('Deployment runbook prepared', 'Production deployment instructions exist in docs/DEPLOYMENT.md', true),
        item('Backup and restore runbook prepared', 'Database and upload-storage restore instructions exist in docs/BACKUP_RESTORE.md', true),
        item('Audit trail enabled', 'Certificate delivery, template settings, payments, medical, and user actions are audited', true, '/dashboard/audit'),
      ],
    },
    {
      title: 'Security',
      items: [
        item('MFA available', 'Operators can enroll MFA from My account', true, '/dashboard/settings'),
        item('Tenant RLS active', 'Tenant-scoped tables use database row-level security', true),
        item('Secrets masked in UI', 'SMTP passwords and WhatsApp access tokens are write-only after saving', true, '/dashboard/settings'),
      ],
    },
  ];

  const allItems = sections.flatMap((section) => section.items);
  const readyCount = allItems.filter((entry) => entry.ready).length;
  const percent = allItems.length ? Math.round((readyCount / allItems.length) * 100) : 0;
  const blockers = allItems.filter((entry) => !entry.ready && entry.priority === 'blocker');
  const important = allItems.filter((entry) => !entry.ready && entry.priority === 'important');
  const nextActions = [...blockers, ...important, ...allItems.filter((entry) => !entry.ready && entry.priority !== 'blocker' && entry.priority !== 'important')].slice(0, 4);
  const launchState = getLaunchState(percent, blockers.length, important.length);
  const conversion = summary.conversion ?? emptySummary.conversion;

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-sm border border-ink-200 bg-white shadow-sm">
        <div className={`border-l-4 p-6 ${launchState.borderClass}`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Go-live control</p>
              <h1 className="mt-2 font-display text-4xl font-medium text-ink-950">Readiness Checklist</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600">
                Live launch control for workflow testing, tenant setup, exports, backup, audit, and security readiness.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <ReadinessMetric label="Ready" value={`${percent}%`} detail={`${readyCount} of ${allItems.length}`} tone={launchState.metricTone} />
              <ReadinessMetric label="Blockers" value={String(blockers.length)} detail="must fix before launch" tone={blockers.length ? 'danger' : 'success'} />
              <ReadinessMetric label="Important" value={String(important.length)} detail="provider and setup gaps" tone={important.length ? 'warning' : 'success'} />
            </div>
          </div>
        </div>
      </header>

      {loadError && (
        <Alert variant="danger" title="Readiness data could not load">
          {loadError}
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-sm border border-ink-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className={`mt-0.5 h-5 w-5 ${launchState.iconClass}`} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-ink-900">Launch Recommendation</h2>
                <Badge variant={launchState.badgeVariant}>{launchState.label}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-600">{launchState.detail}</p>
            </div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-sm bg-ink-100">
            <div className={`h-full ${launchState.progressClass}`} style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="rounded-sm border border-ink-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">Next actions</p>
              <h2 className="mt-1 text-base font-semibold text-ink-900">Do These First</h2>
            </div>
            <Badge variant={nextActions.length ? 'warning' : 'success'}>{nextActions.length ? `${nextActions.length} open` : 'Clear'}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {nextActions.length ? nextActions.map((entry) => <NextAction key={entry.label} entry={entry} />) : (
              <p className="rounded-sm border border-success/20 bg-success/5 p-3 text-sm text-success">
                No launch-critical gaps detected from the current checks.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WorkflowCard
          icon={UsersRound}
          title="Registration"
          value={summary.registrations}
          detail={`${summary.approvedPayments} paid and issued UID`}
          rate={conversion?.paymentApprovalRate ?? 0}
        />
        <WorkflowCard
          icon={Stethoscope}
          title="Medical"
          value={(summary.medicalApproved ?? 0) + (summary.medicalRejected ?? 0)}
          detail={`${summary.medicalApproved} approved, ${summary.medicalRejected ?? 0} rejected`}
          rate={conversion?.medicalCompletionRate ?? 0}
        />
        <WorkflowCard
          icon={ShieldCheck}
          title="Certificates"
          value={summary.validCertificates}
          detail={`${summary.expiredCertificates ?? 0} expired certificates`}
          rate={conversion?.certificationRate ?? 0}
        />
        <WorkflowCard
          icon={FileDown}
          title="Delivery"
          value={summary.certificateDeliveries}
          detail={deliveryDetail(summary)}
          rate={summary.validCertificates ? Math.min(100, Math.round((summary.certificateDeliveries / summary.validCertificates) * 100)) : 0}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-sm border border-ink-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-ink-900">Launch Evidence</h2>
              <p className="text-sm text-ink-600">Quick exports for management review and sign-off.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <ExportLink href="/dashboard/reports/exports/summary.pdf" label="Summary PDF" />
            <ExportLink href="/dashboard/reports/exports/registrations.xls" label="Registrations Excel" />
            <ExportLink href="/dashboard/reports/exports/medical-screenings.xls" label="Medical Excel" />
            <ExportLink href="/dashboard/reports/exports/certificates.xls" label="Certificates Excel" />
          </div>
        </div>

        <div className="rounded-sm border border-ink-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-ink-900">Setup Snapshot</h2>
              <p className="text-sm text-ink-600">Tenant configuration that affects certificates and outbound messaging.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SetupState label="Certificate template" value={template?.originalFilename ?? 'Not uploaded'} ready={Boolean(template?.isApproved)} />
            <SetupState label="Email" value={emailProviderDetail(providers)} ready={Boolean(providers?.emailEnabled && providers.smtpHost && providers.emailFromAddress && providers.smtpPasswordConfigured)} />
            <SetupState label="WhatsApp" value={whatsAppProviderDetail(providers)} ready={Boolean(providers?.whatsAppEnabled && providers.whatsAppPhoneNumberId && providers.whatsAppAccessTokenConfigured)} />
          </div>
        </div>
      </section>

      <section className="border-b border-ink-200 pb-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Go-live control</p>
        <h2 className="mt-1 font-display text-2xl font-medium text-ink-900">Detailed Checks</h2>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="rounded-sm border border-ink-200 bg-white">
            <div className="border-b border-ink-100 p-5">
              <h2 className="font-display text-2xl font-medium text-ink-900">{section.title}</h2>
            </div>
            <div className="divide-y divide-ink-100">
              {section.items.map((entry) => (
                <ReadinessRow key={entry.label} entry={entry} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ReadinessRow({ entry }: { entry: ReadinessItem }) {
  const Icon = entry.ready ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Icon className={entry.ready ? 'mt-0.5 h-4 w-4 text-success' : 'mt-0.5 h-4 w-4 text-warning'} />
        <div>
          <p className="text-sm font-semibold text-ink-900">{entry.label}</p>
          <p className="mt-1 text-sm text-ink-600">{entry.detail}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={entry.ready ? 'success' : 'warning'}>
          {entry.ready ? 'Ready' : 'Needs work'}
        </Badge>
        {entry.href ? (
          <Button asChild variant="outline" size="sm">
            <Link href={entry.href}>
              Open
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : (
          <Circle className="h-4 w-4 text-ink-300" />
        )}
      </div>
    </div>
  );
}

function ReadinessMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-warning';
  return (
    <div className="rounded-sm border border-ink-100 bg-ink-50/70 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className={`mt-1 font-display text-3xl font-medium ${toneClass}`}>{value}</p>
      <p className="text-xs text-ink-500">{detail}</p>
    </div>
  );
}

function WorkflowCard({
  icon: Icon,
  title,
  value,
  detail,
  rate,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  detail: string;
  rate: number;
}) {
  const normalizedRate = Math.max(0, Math.min(100, Math.round(rate)));
  return (
    <div className="rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-accent" />
        <Badge variant={normalizedRate >= 70 ? 'success' : normalizedRate > 0 ? 'warning' : 'default'}>{normalizedRate}%</Badge>
      </div>
      <p className="mt-4 text-sm font-semibold text-ink-900">{title}</p>
      <p className="mt-2 font-display text-4xl font-medium text-ink-950">{value.toLocaleString()}</p>
      <p className="mt-1 text-sm text-ink-500">{detail}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-sm bg-ink-100">
        <div className="h-full bg-accent" style={{ width: `${normalizedRate}%` }} />
      </div>
    </div>
  );
}

function NextAction({ entry }: { entry: ReadinessItem }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-sm border border-warning/25 bg-warning/5 p-3">
      <div>
        <p className="text-sm font-semibold text-ink-900">{entry.label}</p>
        <p className="mt-1 text-xs leading-5 text-ink-600">{entry.detail}</p>
      </div>
      {entry.href && (
        <Button asChild variant="outline" size="sm">
          <Link href={entry.href}>Fix</Link>
        </Button>
      )}
    </div>
  );
}

function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" className="justify-between">
      <Link href={href}>
        <span className="inline-flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {label}
        </span>
        <FileDown className="h-4 w-4" />
      </Link>
    </Button>
  );
}

function SetupState({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="rounded-sm border border-ink-100 bg-ink-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
        <Badge variant={ready ? 'success' : 'warning'}>{ready ? 'Ready' : 'Open'}</Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-ink-900">{value}</p>
    </div>
  );
}

function item(label: string, detail: string, ready: boolean, href?: string, priority: ReadinessItem['priority'] = 'normal'): ReadinessItem {
  return { label, detail, ready, href, priority };
}

function emailProviderDetail(providers: NotificationProviders | null): string {
  if (!providers?.emailEnabled) return 'Email sending is disabled';
  return providers.smtpHost && providers.emailFromAddress
    ? `${providers.emailFromAddress} via ${providers.smtpHost}`
    : 'Email is enabled but provider details are incomplete';
}

function whatsAppProviderDetail(providers: NotificationProviders | null): string {
  if (!providers?.whatsAppEnabled) return 'WhatsApp sending is disabled';
  return providers.whatsAppPhoneNumberId
    ? `Phone number ID ${providers.whatsAppPhoneNumberId}`
    : 'WhatsApp is enabled but provider details are incomplete';
}

function deliveryDetail(summary: Summary): string {
  return `${summary.certificatePrints ?? 0} print, ${summary.certificateEmails ?? 0} email, ${summary.certificateWhatsApps ?? 0} WhatsApp`;
}

function getLaunchState(percent: number, blockerCount: number, importantCount: number): {
  label: string;
  detail: string;
  badgeVariant: 'success' | 'warning' | 'danger';
  borderClass: string;
  iconClass: string;
  progressClass: string;
  metricTone: 'success' | 'warning' | 'danger';
} {
  if (blockerCount > 0) {
    return {
      label: 'Not ready',
      detail: 'There are launch blockers. Clear these before onboarding real production handlers.',
      badgeVariant: 'danger',
      borderClass: 'border-danger',
      iconClass: 'text-danger',
      progressClass: 'bg-danger',
      metricTone: 'danger',
    };
  }
  if (percent >= 85 && importantCount === 0) {
    return {
      label: 'Launch ready',
      detail: 'Core workflow, setup, exports, and security checks are in good shape for controlled production use.',
      badgeVariant: 'success',
      borderClass: 'border-success',
      iconClass: 'text-success',
      progressClass: 'bg-success',
      metricTone: 'success',
    };
  }
  return {
    label: 'Nearly ready',
    detail: 'The app is functional. Finish the remaining provider or operational checks before full production rollout.',
    badgeVariant: 'warning',
    borderClass: 'border-warning',
    iconClass: 'text-warning',
    progressClass: 'bg-warning',
    metricTone: 'warning',
  };
}
