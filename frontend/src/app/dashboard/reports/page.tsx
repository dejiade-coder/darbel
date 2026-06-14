import { Activity, BarChart3, Download, FileSpreadsheet, FileText, Filter, HeartPulse, ShieldCheck, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api/server-client';

export const metadata = { title: 'Reports' };

type Breakdown = { label: string; count: number };

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
  certificatePrints: number;
  certificateEmails: number;
  certificateWhatsApps: number;
  conversion: {
    paymentApprovalRate: number;
    medicalCompletionRate: number;
    certificationRate: number;
  };
  registrationStatusBreakdown: Breakdown[];
  medicalStatusBreakdown: Breakdown[];
  certificateStatusBreakdown: Breakdown[];
  topTradeCategories: Breakdown[];
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    tradeCategory?: string;
  };
}) {
  const filterParams = buildFilterParams(searchParams);
  const filterQuery = filterParams.toString();
  const exportSuffix = filterQuery ? `?${filterQuery}` : '';
  let summary: Summary | null = null;
  let loadError = '';
  try {
    summary = await apiFetch<Summary>(`/reports/summary${exportSuffix}`, { authenticated: true });
  } catch (error) {
    if (error instanceof ApiError) loadError = error.message;
    else throw error;
  }

  const workflow = summary
    ? [
        { label: 'Registered', value: summary.registrations, tone: 'bg-[#0f5257]' },
        { label: 'Paid / UID', value: summary.approvedPayments, tone: 'bg-[#1f7a6d]' },
        { label: 'Medical', value: summary.medicalScreenings, tone: 'bg-[#3d8b6f]' },
        { label: 'Med. approved', value: summary.medicalApproved, tone: 'bg-[#6d9f71]' },
        { label: 'Certified', value: summary.validCertificates, tone: 'bg-[#d4a017]' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <header className="rounded-sm border border-ink-200 bg-white p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Compliance intelligence</p>
            <h1 className="mt-2 font-display text-4xl font-medium text-ink-950">Reports Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600">
              A clear view of registrations, medical progress, certification outcomes, and export-ready compliance records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton href={`/dashboard/reports/exports/summary.pdf${exportSuffix}`} label="Summary PDF" />
            <ExportButton href={`/dashboard/reports/exports/registrations.xls${exportSuffix}`} label="Excel" icon={FileSpreadsheet} />
          </div>
        </div>
      </header>

      <form action="/dashboard/reports" className="rounded-sm border border-ink-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Filter className="h-4 w-4 text-accent" />
          Filters
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="From">
            <Input type="date" name="dateFrom" defaultValue={searchParams?.dateFrom ?? ''} />
          </Field>
          <Field label="To">
            <Input type="date" name="dateTo" defaultValue={searchParams?.dateTo ?? ''} />
          </Field>
          <Field label="Status">
            <select
              name="status"
              defaultValue={searchParams?.status ?? ''}
              className="h-10 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="">All statuses</option>
              {REPORT_STATUSES.map((status) => (
                <option key={status} value={status}>{formatLabel(status)}</option>
              ))}
            </select>
          </Field>
          <Field label="Trade/category">
            <Input name="tradeCategory" defaultValue={searchParams?.tradeCategory ?? ''} placeholder="e.g. Food Vendor" />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" className="w-full">Apply</Button>
            {filterQuery && (
              <Button asChild type="button" variant="outline">
                <a href="/dashboard/reports">Clear</a>
              </Button>
            )}
          </div>
        </div>
      </form>

      {loadError && <div className="rounded-sm border border-danger/25 bg-danger/5 p-4 text-sm text-danger">{loadError}</div>}

      {summary && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Activity} label="Registrations" value={summary.registrations} detail={`${summary.submittedForReview} awaiting review`} />
            <Metric icon={TrendingUp} label="Payment approval" value={`${summary.conversion.paymentApprovalRate}%`} detail={`${summary.approvedPayments} approved payments`} />
            <Metric icon={HeartPulse} label="Medical completion" value={`${summary.conversion.medicalCompletionRate}%`} detail={`${summary.medicalApproved} approved, ${summary.medicalRejected} rejected`} />
            <Metric icon={ShieldCheck} label="Certificates" value={summary.validCertificates} detail={`${summary.expiredCertificates} expired certificates`} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <Panel
              title="Workflow Progress"
              description="A simple stage-by-stage view from intake to certification."
              icon={BarChart3}
            >
              <WorkflowChart items={workflow} />
            </Panel>

            <Panel
              title="Conversion"
              description="Operational rates across the main compliance gates."
              icon={TrendingUp}
            >
              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                <Ring label="Payment" value={summary.conversion.paymentApprovalRate} />
                <Ring label="Medical" value={summary.conversion.medicalCompletionRate} />
                <Ring label="Certified" value={summary.conversion.certificationRate} />
              </div>
            </Panel>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <StatusChart title="Registration Mix" items={summary.registrationStatusBreakdown} total={summary.registrations} />
            <StatusChart title="Medical Mix" items={summary.medicalStatusBreakdown} total={summary.medicalScreenings} />
            <StatusChart title="Certificate Mix" items={summary.certificateStatusBreakdown} total={summary.validCertificates + summary.expiredCertificates} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
            <Panel title="Top Trade Categories" description="Most represented categories in the current report view." icon={BarChart3}>
              <HorizontalBars items={summary.topTradeCategories} total={summary.registrations} />
            </Panel>

            <Panel title="Exports" description="Download filtered records in Excel, CSV, or PDF." icon={FileText}>
              <div className="grid gap-3">
                <ExportRow title="Compliance summary" pdf={`/dashboard/reports/exports/summary.pdf${exportSuffix}`} />
                <ExportRow title="Registrations" csv={`/dashboard/reports/exports/registrations.csv${exportSuffix}`} xls={`/dashboard/reports/exports/registrations.xls${exportSuffix}`} pdf={`/dashboard/reports/exports/registrations.pdf${exportSuffix}`} />
                <ExportRow title="Medical screenings" csv={`/dashboard/reports/exports/medical-screenings.csv${exportSuffix}`} xls={`/dashboard/reports/exports/medical-screenings.xls${exportSuffix}`} pdf={`/dashboard/reports/exports/medical-screenings.pdf${exportSuffix}`} />
                <ExportRow title="Certificates" csv={`/dashboard/reports/exports/certificates.csv${exportSuffix}`} xls={`/dashboard/reports/exports/certificates.xls${exportSuffix}`} pdf={`/dashboard/reports/exports/certificates.pdf${exportSuffix}`} />
              </div>
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}

const REPORT_STATUSES = [
  'DRAFT',
  'SUBMITTED_FOR_REVIEW',
  'READY_FOR_SCREENING',
  'CANCELLED',
  'SAMPLE_COLLECTED',
  'RESULT_ENTERED',
  'APPROVED',
  'REJECTED',
  'VALID',
  'REVOKED',
  'EXPIRED',
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">{label}</span>
      {children}
    </label>
  );
}

function buildFilterParams(searchParams: Record<string, string | undefined> | undefined): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ['dateFrom', 'dateTo', 'status', 'tradeCategory']) {
    const value = searchParams?.[key]?.trim();
    if (value) params.set(key, value);
  }
  return params;
}

function Metric({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string | number; detail: string }) {
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

function WorkflowChart({ items }: { items: Array<{ label: string; value: number; tone: string }> }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="grid min-h-80 grid-cols-5 items-end gap-3 border-l border-b border-ink-100 px-3 pb-4 pt-8">
      {items.map((item) => {
        const height = Math.max(6, Math.round((item.value / max) * 100));
        return (
          <div key={item.label} className="flex h-full min-w-0 flex-col items-center justify-end gap-3">
            <p className="font-mono text-sm font-semibold text-ink-900">{item.value}</p>
            <div className="flex h-56 w-full items-end">
              <div
                className={`w-full rounded-t-sm ${item.tone}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <p className="min-h-8 text-center text-xs font-medium text-ink-600">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function Ring({ label, value }: { label: string; value: number }) {
  const pct = clampPercent(value);
  return (
    <div className="flex items-center gap-4 rounded-sm border border-ink-100 bg-ink-50/40 p-4">
      <div
        className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(#0f766e ${pct * 3.6}deg, #e8ece8 0deg)` }}
      >
        <div className="grid h-14 w-14 place-items-center rounded-full bg-white">
          <span className="font-mono text-sm font-semibold text-ink-900">{pct}%</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-900">{label}</p>
        <p className="mt-1 text-xs text-ink-500">Current conversion rate</p>
      </div>
    </div>
  );
}

function StatusChart({ title, items, total }: { title: string; items: Breakdown[]; total: number }) {
  return (
    <Panel title={title} description="Distribution by status." icon={Activity}>
      <HorizontalBars items={items} total={total} compact />
    </Panel>
  );
}

function HorizontalBars({ items, total, compact = false }: { items: Breakdown[]; total: number; compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {items.length === 0 && <p className="text-sm text-ink-500">No data yet.</p>}
      {items.map((item, index) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return (
          <div key={`${item.label}-${index}`}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-ink-800">{formatLabel(item.label)}</span>
              <span className="font-mono text-xs text-ink-500">{item.count}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-sm bg-ink-100">
              <div className={barTone(index)} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExportButton({ href, label, icon: Icon = Download }: { href: string; label: string; icon?: React.ElementType }) {
  return (
    <Button asChild variant="outline">
      <a href={href}>
        <Icon className="mr-2 h-4 w-4" />
        {label}
      </a>
    </Button>
  );
}

function ExportRow({ title, csv, xls, pdf }: { title: string; csv?: string; xls?: string; pdf: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-ink-100 bg-ink-50/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-ink-900">{title}</p>
      <div className="flex flex-wrap gap-2">
        {csv && (
          <Button asChild variant="outline" size="sm">
            <a href={csv}>CSV</a>
          </Button>
        )}
        {xls && (
          <Button asChild variant="outline" size="sm">
            <a href={xls}>Excel</a>
          </Button>
        )}
        <Button asChild size="sm">
          <a href={pdf}>PDF</a>
        </Button>
      </div>
    </div>
  );
}

function barTone(index: number): string {
  const tones = ['h-full bg-[#0f5257]', 'h-full bg-[#1f7a6d]', 'h-full bg-[#3d8b6f]', 'h-full bg-[#d4a017]', 'h-full bg-[#8a6f3b]'];
  return tones[index % tones.length];
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
