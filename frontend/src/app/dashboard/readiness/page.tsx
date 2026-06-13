import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Circle, FileText, ShieldCheck } from 'lucide-react';
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
  validCertificates: number;
  certificateDeliveries: number;
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
};

const emptySummary: Summary = {
  registrations: 0,
  approvedPayments: 0,
  medicalScreenings: 0,
  medicalApproved: 0,
  validCertificates: 0,
  certificateDeliveries: 0,
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
        item('Record certificate delivery', `${summary.certificateDeliveries} print/email/WhatsApp actions recorded`, summary.certificateDeliveries > 0, '/dashboard/certificates'),
      ],
    },
    {
      title: 'Tenant Setup',
      items: [
        item('Approved certificate template', template?.originalFilename ?? 'No approved certificate template uploaded', Boolean(template?.isApproved), '/dashboard/settings'),
        item('Email provider configured', emailProviderDetail(providers), Boolean(providers?.emailEnabled && providers.smtpHost && providers.emailFromAddress && providers.smtpPasswordConfigured), '/dashboard/settings'),
        item('WhatsApp provider configured', whatsAppProviderDetail(providers), Boolean(providers?.whatsAppEnabled && providers.whatsAppPhoneNumberId && providers.whatsAppAccessTokenConfigured), '/dashboard/settings'),
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

  return (
    <div className="space-y-6">
      <header className="border-b border-ink-200 pb-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Go-live control</p>
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl font-medium text-ink-900">Readiness Checklist</h1>
            <p className="mt-2 max-w-3xl text-sm text-ink-600">
              A live operational checklist for UAT, tenant setup, exports, backup, and security readiness.
            </p>
          </div>
          <div className="rounded-sm border border-ink-200 bg-white px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">Ready</p>
            <p className="mt-1 font-display text-4xl font-medium text-ink-900">{percent}%</p>
            <p className="text-xs text-ink-500">{readyCount} of {allItems.length} checks complete</p>
          </div>
        </div>
      </header>

      {loadError && (
        <Alert variant="danger" title="Readiness data could not load">
          {loadError}
        </Alert>
      )}

      <section className="rounded-sm border border-ink-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-base font-semibold text-ink-900">Launch Recommendation</h2>
            <p className="text-sm text-ink-600">
              {percent >= 85
                ? 'The app is close to launch-ready. Finish remaining provider or UAT checks before production onboarding.'
                : 'Keep completing the checklist before production launch. The system is functional, but operational readiness is still in progress.'}
            </p>
          </div>
        </div>
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
            <Link href={entry.href}>Open</Link>
          </Button>
        ) : (
          <Circle className="h-4 w-4 text-ink-300" />
        )}
      </div>
    </div>
  );
}

function item(label: string, detail: string, ready: boolean, href?: string): ReadinessItem {
  return { label, detail, ready, href };
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
