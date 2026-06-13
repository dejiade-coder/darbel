import { Activity, BarChart3, Download, FileText, PieChart, ShieldCheck, TrendingUp } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <header className="border-b border-ink-200 pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Compliance intelligence</p>
            <h1 className="mt-1 font-display text-4xl font-medium text-ink-900">Reports & Analysis</h1>
            <p className="mt-2 max-w-3xl text-sm text-ink-600">
              Monitor intake, payment, medical screening, certificate issuance, and export regulator-ready reports.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton href={`/dashboard/reports/exports/summary.pdf${exportSuffix}`} label="Summary PDF" />
            <ExportButton href={`/dashboard/reports/exports/registrations.pdf${exportSuffix}`} label="Registrations PDF" />
            <ExportButton href={`/dashboard/reports/exports/certificates.pdf${exportSuffix}`} label="Certificates PDF" />
          </div>
        </div>
      </header>

      <form action="/dashboard/reports" className="grid gap-3 rounded-sm border border-ink-200 bg-white p-4 md:grid-cols-5">
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
      </form>

      {loadError && <div className="rounded-sm border border-danger/25 bg-danger/5 p-4 text-sm text-danger">{loadError}</div>}

      {summary && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Activity} label="Total registrations" value={summary.registrations} detail={`${summary.submittedForReview} awaiting review`} />
            <Metric icon={TrendingUp} label="Payment approval" value={`${summary.conversion.paymentApprovalRate}%`} detail={`${summary.approvedPayments} paid and UID issued`} />
            <Metric icon={BarChart3} label="Medical completion" value={`${summary.conversion.medicalCompletionRate}%`} detail={`${summary.medicalApproved} approved, ${summary.medicalRejected} rejected`} />
            <Metric icon={ShieldCheck} label="Certification rate" value={`${summary.conversion.certificationRate}%`} detail={`${summary.validCertificates} valid certificates`} />
          </section>

          <section className="rounded-sm border border-ink-200 bg-white">
            <div className="border-b border-ink-100 p-5">
              <h2 className="font-display text-2xl font-medium text-ink-900">Workflow Funnel</h2>
              <p className="mt-1 text-sm text-ink-600">The count of handlers at each compliance stage.</p>
            </div>
            <div className="grid gap-4 p-5 lg:grid-cols-5">
              <FunnelStep label="Registered" value={summary.registrations} max={summary.registrations} />
              <FunnelStep label="Payment approved" value={summary.approvedPayments} max={summary.registrations} />
              <FunnelStep label="Medical started" value={summary.medicalScreenings} max={summary.registrations} />
              <FunnelStep label="Medical approved" value={summary.medicalApproved} max={summary.registrations} />
              <FunnelStep label="Certified" value={summary.validCertificates} max={summary.registrations} />
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="grid gap-5 md:grid-cols-2">
              <BreakdownPanel title="Registration Status" items={summary.registrationStatusBreakdown} total={summary.registrations} />
              <BreakdownPanel title="Medical Status" items={summary.medicalStatusBreakdown} total={summary.medicalScreenings} />
              <BreakdownPanel title="Certificate Status" items={summary.certificateStatusBreakdown} total={summary.validCertificates + summary.expiredCertificates} />
              <BreakdownPanel title="Top Trade Categories" items={summary.topTradeCategories} total={summary.registrations} />
            </div>

            <section className="rounded-sm border border-ink-200 bg-white">
              <div className="border-b border-ink-100 p-5">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-accent" />
                  <h2 className="text-base font-semibold text-ink-900">Exports</h2>
                </div>
                <p className="mt-1 text-sm text-ink-600">Download operational records as spreadsheet-friendly CSV or printable PDF.</p>
              </div>
              <div className="grid gap-3 p-5">
                <ExportRow title="Compliance summary" pdf={`/dashboard/reports/exports/summary.pdf${exportSuffix}`} />
                <ExportRow title="Registrations" csv={`/dashboard/reports/exports/registrations.csv${exportSuffix}`} xls={`/dashboard/reports/exports/registrations.xls${exportSuffix}`} pdf={`/dashboard/reports/exports/registrations.pdf${exportSuffix}`} />
                <ExportRow title="Medical screenings" csv={`/dashboard/reports/exports/medical-screenings.csv${exportSuffix}`} xls={`/dashboard/reports/exports/medical-screenings.xls${exportSuffix}`} pdf={`/dashboard/reports/exports/medical-screenings.pdf${exportSuffix}`} />
                <ExportRow title="Certificates" csv={`/dashboard/reports/exports/certificates.csv${exportSuffix}`} xls={`/dashboard/reports/exports/certificates.xls${exportSuffix}`} pdf={`/dashboard/reports/exports/certificates.pdf${exportSuffix}`} />
              </div>
            </section>
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
      <p className="mt-4 font-display text-4xl font-medium text-ink-900">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{detail}</p>
    </div>
  );
}

function FunnelStep({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="rounded-sm border border-ink-100 bg-ink-50/50 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className="mt-3 font-display text-3xl font-medium text-ink-900">{value}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-sm bg-ink-100">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink-500">{pct}% of registrations</p>
    </div>
  );
}

function BreakdownPanel({ title, items, total }: { title: string; items: Breakdown[]; total: number }) {
  return (
    <section className="rounded-sm border border-ink-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <PieChart className="h-4 w-4 text-accent" />
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      </div>
      <div className="mt-5 space-y-4">
        {items.length === 0 && <p className="text-sm text-ink-500">No data yet.</p>}
        {items.map((item) => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-ink-800">{formatLabel(item.label)}</span>
                <span className="font-mono text-xs text-ink-500">{item.count}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-sm bg-ink-100">
                <div className="h-full bg-success" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ExportButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline">
      <a href={href}>
        <Download className="mr-2 h-4 w-4" />
        {label}
      </a>
    </Button>
  );
}

function ExportRow({ title, csv, xls, pdf }: { title: string; csv?: string; xls?: string; pdf: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-ink-100 p-4 sm:flex-row sm:items-center sm:justify-between">
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

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
