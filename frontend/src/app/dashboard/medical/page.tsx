import Link from 'next/link';
import type React from 'react';
import { BadgeCheck, ClipboardCheck, Download, FlaskConical, Search, ShieldCheck, TestTube2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { collectSampleAction, enterResultAction, reviewScreeningAction } from './actions';

export const metadata = { title: 'Medical screening' };

type Registration = {
  id: string;
  uid: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  tradeCategory: string | null;
  approvedPaymentAt: string | null;
};

type Screening = {
  id: string;
  handlerRegistrationId: string;
  handlerName: string;
  uid: string | null;
  tradeCategory: string | null;
  status: 'SAMPLE_COLLECTED' | 'RESULT_ENTERED' | 'APPROVED' | 'REJECTED';
  fitnessStatus: 'FIT' | 'UNFIT' | 'REQUIRES_REVIEW' | null;
  labResultSummary: string | null;
  mantouxResult: TestResult | null;
  mantouxIndurationMm: number | null;
  hepatitisBResult: TestResult | null;
  hivResult: TestResult | null;
  widalResult: TestResult | null;
  medicalOfficerNotes: string | null;
};

type TestResult = 'NEGATIVE' | 'POSITIVE' | 'INDETERMINATE' | 'NOT_DONE';

const STATUS_TABS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All screenings', value: '' },
  { label: 'Sample collected', value: 'SAMPLE_COLLECTED' },
  { label: 'Result entered', value: 'RESULT_ENTERED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

type StatusFilter = '' | Screening['status'];

type MedicalSearchParams = { q?: string; status?: StatusFilter; medicalError?: string };

export default async function MedicalPage({
  searchParams,
}: {
  searchParams?: MedicalSearchParams | Promise<MedicalSearchParams>;
}) {
  const params = await Promise.resolve(searchParams);
  const actor = await readActorFromAccessToken();
  const q = params?.q?.trim() ?? '';
  const status = params?.status ?? '';
  const medicalError = params?.medicalError?.trim() ?? '';
  let ready: Registration[] = [];
  let screenings: Screening[] = [];
  let loadError = '';

  try {
    const [readyResult, screeningsResult] = await Promise.all([
      apiFetch<{ items: Registration[] }>(
        `/medical-screenings/ready${q ? `?q=${encodeURIComponent(q)}` : ''}`,
        { authenticated: true },
      ),
      apiFetch<{ items: Screening[] }>(
        `/medical-screenings${buildQuery({ q, status })}`,
        { authenticated: true },
      ),
    ]);
    ready = readyResult.items;
    screenings = screeningsResult.items;
  } catch (error) {
    if (error instanceof ApiError) loadError = error.message;
    else throw error;
  }

  const screenedRegistrationIds = new Set(screenings.map((item) => item.handlerRegistrationId));
  const readyForCollection = ready.filter((item) => !screenedRegistrationIds.has(item.id));
  const canCollect = actor?.permissions.includes('medical.record_sample') ?? false;
  const canEnter = actor?.permissions.includes('medical.enter_result') ?? false;
  const canReview = actor?.permissions.includes('medical.approve_result') ?? false;

  return (
    <div className="space-y-6">
      <header className="rounded-sm border border-ink-200 bg-white p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Medical officer workspace</p>
          <h1 className="mt-2 font-display text-4xl font-medium text-ink-950">Medical screening</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            Attend approved handlers, collect samples, record Mantoux, Hepatitis B, HIV, and Widal results, then approve fit handlers for certification.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/dashboard/reports/exports/medical-screenings.csv">
              <Download className="mr-2 h-3.5 w-3.5" />
              CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/dashboard/reports/exports/medical-screenings.xls">
              <Download className="mr-2 h-3.5 w-3.5" />
              Excel
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/dashboard/reports/exports/medical-screenings.pdf">
              <Download className="mr-2 h-3.5 w-3.5" />
              PDF
            </a>
          </Button>
        </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={ClipboardCheck} label="Ready" value={readyForCollection.length} detail="Awaiting sample collection" />
        <Metric icon={TestTube2} label="In progress" value={screenings.filter((item) => item.status === 'SAMPLE_COLLECTED' || item.status === 'RESULT_ENTERED').length} detail="Samples or results pending" />
        <Metric icon={ShieldCheck} label="Approved" value={screenings.filter((item) => item.status === 'APPROVED').length} detail="Fit for certification" />
        <Metric icon={BadgeCheck} label="Rejected" value={screenings.filter((item) => item.status === 'REJECTED').length} detail="Not fit or rejected" />
      </section>

      <section className="rounded-sm border border-ink-200 bg-white p-4">
        <form action="/dashboard/medical" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input name="q" defaultValue={q} className="pl-9" placeholder="Search by UID, full name, phone, business, or category" />
            {status && <input type="hidden" name="status" value={status} />}
          </div>
          <div className="flex gap-2">
            <Button type="submit">Search</Button>
            {(q || status) && (
              <Button asChild type="button" variant="outline">
                <Link href="/dashboard/medical">Clear</Link>
              </Button>
            )}
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <Button key={tab.value || 'all'} asChild size="sm" variant={status === tab.value ? 'default' : 'outline'}>
              <Link href={`/dashboard/medical${buildQuery({ q, status: tab.value })}`}>{tab.label}</Link>
            </Button>
          ))}
        </div>
      </section>

      {(loadError || medicalError) && (
        <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {medicalError || loadError}
        </div>
      )}

      <section className="rounded-sm border border-ink-200 bg-white">
        <div className="flex items-center gap-3 border-b border-ink-100 p-5">
          <ClipboardCheck className="h-4 w-4 text-[#0f766e]" />
          <h2 className="text-base font-semibold text-ink-900">Ready for sample collection</h2>
        </div>
        <div className="overflow-x-auto">
          {readyForCollection.length === 0 && (
            <p className="p-5 text-sm text-ink-500">No approved handlers are waiting for medical screening.</p>
          )}
          {readyForCollection.length > 0 && (
            <table className="min-w-[920px] w-full border-collapse text-sm">
              <thead className="bg-ink-50 text-left text-[10px] uppercase tracking-[0.16em] text-ink-500">
                <tr>
                  <Th>Handler</Th>
                  <Th>UID</Th>
                  <Th>Trade category</Th>
                  <Th>Phone</Th>
                  <Th>Payment approved</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {readyForCollection.map((item) => {
                  const name = [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Unnamed handler';
                  return (
                    <tr key={item.id} className="border-t border-ink-100 transition hover:bg-accent/5">
                      <Td className="font-semibold text-ink-900">{name}</Td>
                      <Td><span className="font-mono text-xs">{item.uid}</span></Td>
                      <Td>{item.tradeCategory || 'No category'}</Td>
                      <Td>{item.phone || 'No phone'}</Td>
                      <Td>{item.approvedPaymentAt ? formatDate(item.approvedPaymentAt) : 'Recently'}</Td>
                      <Td>
                        <div className="flex justify-end">
                          {canCollect && (
                            <form action={collectSampleAction}>
                              <input type="hidden" name="handlerRegistrationId" value={item.id} />
                              <Button type="submit" size="sm">Attend and collect sample</Button>
                            </form>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-sm border border-ink-200 bg-white">
        <div className="flex items-center gap-3 border-b border-ink-100 p-5">
          <FlaskConical className="h-4 w-4 text-[#0f766e]" />
          <h2 className="text-base font-semibold text-ink-900">Screening queue</h2>
        </div>
        <div className="overflow-x-auto">
          {screenings.length === 0 && <p className="p-5 text-sm text-ink-500">No medical screenings yet.</p>}
          {screenings.length > 0 && (
            <table className="min-w-[1220px] w-full border-collapse text-sm">
              <thead className="bg-ink-50 text-left text-[10px] uppercase tracking-[0.16em] text-ink-500">
                <tr>
                  <Th>Handler</Th>
                  <Th>UID</Th>
                  <Th>Status</Th>
                  <Th>Mantoux</Th>
                  <Th>Hepatitis B</Th>
                  <Th>HIV</Th>
                  <Th>Widal</Th>
                  <Th>Fitness</Th>
                  <Th className="min-w-[360px]">Officer action</Th>
                </tr>
              </thead>
              <tbody>
                {screenings.map((screening) => (
                  <tr key={screening.id} className="border-t border-ink-100 align-top transition hover:bg-accent/5">
                    <Td>
                      <p className="font-semibold text-ink-900">{screening.handlerName}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{screening.tradeCategory || 'No category'}</p>
                    </Td>
                    <Td><span className="font-mono text-xs">{screening.uid}</span></Td>
                    <Td>
                      <span className={`inline-flex rounded-sm px-2 py-1 text-xs font-medium ${statusTone(screening.status)}`}>
                        {displayStatus(screening.status)}
                      </span>
                    </Td>
                    <Td>{displayTest(screening.mantouxResult)}{screening.mantouxIndurationMm !== null ? ` (${screening.mantouxIndurationMm} mm)` : ''}</Td>
                    <Td>{displayTest(screening.hepatitisBResult)}</Td>
                    <Td>{displayTest(screening.hivResult)}</Td>
                    <Td>{displayTest(screening.widalResult)}</Td>
                    <Td>{screening.fitnessStatus ? displayFitness(screening.fitnessStatus) : 'Pending'}</Td>
                    <Td>
                      <div className="space-y-3">
                        {screening.labResultSummary && <p className="text-xs text-ink-600">{screening.labResultSummary}</p>}
                        {screening.medicalOfficerNotes && <p className="text-xs text-ink-500">Notes: {screening.medicalOfficerNotes}</p>}
                        {canEnter && screening.status !== 'APPROVED' && screening.status !== 'REJECTED' && (
                          <details className="rounded-sm border border-ink-200 bg-white p-3">
                            <summary className="cursor-pointer text-xs font-semibold text-accent">Enter or update result</summary>
                            <form action={enterResultAction} className="mt-3 space-y-3">
                              <input type="hidden" name="screeningId" value={screening.id} />
                              <div className="grid gap-3 sm:grid-cols-2">
                                <ResultSelect name="mantouxResult" label="Mantoux" defaultValue={screening.mantouxResult ?? 'NEGATIVE'} />
                                <label className="space-y-1 text-xs font-medium text-ink-700">
                                  <span>Mantoux induration (mm)</span>
                                  <input name="mantouxIndurationMm" type="number" min={0} max={50} defaultValue={screening.mantouxIndurationMm ?? ''} className="w-full rounded-sm border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" />
                                </label>
                                <ResultSelect name="hepatitisBResult" label="Hepatitis B" defaultValue={screening.hepatitisBResult ?? 'NEGATIVE'} />
                                <ResultSelect name="hivResult" label="HIV" defaultValue={screening.hivResult ?? 'NEGATIVE'} />
                                <ResultSelect name="widalResult" label="Widal test" defaultValue={screening.widalResult ?? 'NEGATIVE'} />
                                <label className="space-y-1 text-xs font-medium text-ink-700">
                                  <span>Fitness decision</span>
                                  <select name="fitnessStatus" className="w-full rounded-sm border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" defaultValue={screening.fitnessStatus ?? 'FIT'}>
                                    <option value="FIT">Fit</option>
                                    <option value="UNFIT">Unfit</option>
                                    <option value="REQUIRES_REVIEW">Requires review</option>
                                  </select>
                                </label>
                              </div>
                              <textarea name="labResultSummary" rows={2} placeholder="Clinical summary" className="w-full rounded-sm border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" defaultValue={screening.labResultSummary ?? ''} />
                              <textarea name="medicalOfficerNotes" rows={2} placeholder="Medical officer notes" className="w-full rounded-sm border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" defaultValue={screening.medicalOfficerNotes ?? ''} />
                              <Button type="submit" size="sm" variant="outline">Save result</Button>
                            </form>
                          </details>
                        )}
                        {canReview && screening.status === 'RESULT_ENTERED' && screening.fitnessStatus === 'FIT' && (
                          <form action={reviewScreeningAction}>
                            <input type="hidden" name="screeningId" value={screening.id} />
                            <input type="hidden" name="approved" value="true" />
                            <Button type="submit" size="sm">Approve and issue certificate</Button>
                          </form>
                        )}
                        {canReview && screening.status === 'RESULT_ENTERED' && screening.fitnessStatus !== 'FIT' && (
                          <form action={reviewScreeningAction} className="space-y-2">
                            <input type="hidden" name="screeningId" value={screening.id} />
                            <input type="hidden" name="approved" value="false" />
                            <textarea name="reviewNotes" rows={2} placeholder="Rejection notes" className="w-full rounded-sm border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" />
                            <Button type="submit" size="sm" variant="outline">Reject result</Button>
                          </form>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function displayStatus(status: Screening['status']): string {
  if (status === 'SAMPLE_COLLECTED') return 'Sample collected';
  if (status === 'RESULT_ENTERED') return 'Result entered';
  if (status === 'APPROVED') return 'Approved';
  return 'Rejected';
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

function statusTone(status: Screening['status']): string {
  if (status === 'APPROVED') return 'bg-success/10 text-success';
  if (status === 'REJECTED') return 'bg-danger/10 text-danger';
  if (status === 'RESULT_ENTERED') return 'bg-warning/10 text-warning';
  return 'bg-accent/10 text-accent';
}

function buildQuery({ q, status }: { q?: string; status?: StatusFilter }): string {
  const params = new URLSearchParams();
  if (q?.trim()) params.set('q', q.trim());
  if (status) params.set('status', status);
  const text = params.toString();
  return text ? `?${text}` : '';
}

function ResultSelect({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: TestResult;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-ink-700">
      <span>{label}</span>
      <select name={name} className="w-full rounded-[8px] border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15" defaultValue={defaultValue}>
        <option value="NEGATIVE">Negative</option>
        <option value="POSITIVE">Positive</option>
        <option value="INDETERMINATE">Indeterminate</option>
        <option value="NOT_DONE">Not done</option>
      </select>
    </label>
  );
}

function TestBadge({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-[8px] border border-ink-200 bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-500">{label}</p>
      <p className="mt-1 text-xs font-semibold text-ink-900">{value}</p>
      {detail && <p className="mt-0.5 text-[11px] text-ink-500">{detail}</p>}
    </div>
  );
}

function displayTest(value: TestResult | null): string {
  if (value === 'NEGATIVE') return 'Negative';
  if (value === 'POSITIVE') return 'Positive';
  if (value === 'INDETERMINATE') return 'Indeterminate';
  if (value === 'NOT_DONE') return 'Not done';
  return 'Pending';
}

function displayFitness(value: NonNullable<Screening['fitnessStatus']>): string {
  if (value === 'FIT') return 'Fit';
  if (value === 'UNFIT') return 'Unfit';
  return 'Requires review';
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-4 py-3 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`align-middle px-4 py-3 text-ink-700 ${className}`}>{children}</td>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

