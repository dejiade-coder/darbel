import { ClipboardCheck, Download, FlaskConical, Search } from 'lucide-react';
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

export default async function MedicalPage({ searchParams }: { searchParams?: { q?: string; medicalError?: string } }) {
  const actor = await readActorFromAccessToken();
  const q = searchParams?.q?.trim() ?? '';
  const medicalError = searchParams?.medicalError?.trim() ?? '';
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
        `/medical-screenings${q ? `?q=${encodeURIComponent(q)}` : ''}`,
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
  const canCollect = actor?.permissions.includes('medical.record_sample') ?? false;
  const canEnter = actor?.permissions.includes('medical.enter_result') ?? false;
  const canReview = actor?.permissions.includes('medical.approve_result') ?? false;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-ink-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Phase 3</p>
          <h1 className="mt-1 font-display text-4xl font-medium text-ink-900">Medical screening</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            Medical officer workspace for Mantoux, Hepatitis B, HIV, and Widal test entry before certification.
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
      </header>

      <form action="/dashboard/medical" className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input name="q" defaultValue={q} className="pl-9" placeholder="Search by UID, name, phone, or category" />
      </form>

      {(loadError || medicalError) && (
        <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {medicalError || loadError}
        </div>
      )}

      <section className="rounded-[8px] border border-ink-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-ink-100 p-5">
          <ClipboardCheck className="h-4 w-4 text-[#0f766e]" />
          <h2 className="text-base font-semibold text-ink-900">Ready for sample collection</h2>
        </div>
        <div className="divide-y divide-ink-100">
          {ready.filter((item) => !screenedRegistrationIds.has(item.id)).length === 0 && (
            <p className="p-5 text-sm text-ink-500">No approved handlers are waiting for medical screening.</p>
          )}
          {ready.filter((item) => !screenedRegistrationIds.has(item.id)).map((item) => {
            const name = [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Unnamed handler';
            return (
              <div key={item.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-ink-900">{name}</p>
                  <p className="font-mono text-xs text-ink-500">{item.uid}</p>
                  <p className="text-xs text-ink-500">
                    Payment approved {item.approvedPaymentAt ? formatDate(item.approvedPaymentAt) : 'recently'}
                  </p>
                  <p className="text-xs text-ink-500">{item.tradeCategory || 'No category'} - {item.phone || 'No phone'}</p>
                </div>
                {canCollect && (
                  <form action={collectSampleAction}>
                    <input type="hidden" name="handlerRegistrationId" value={item.id} />
                    <Button type="submit" size="sm">Attend and collect sample</Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[8px] border border-ink-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-ink-100 p-5">
          <FlaskConical className="h-4 w-4 text-[#0f766e]" />
          <h2 className="text-base font-semibold text-ink-900">Screening queue</h2>
        </div>
        <div className="divide-y divide-ink-100">
          {screenings.length === 0 && <p className="p-5 text-sm text-ink-500">No medical screenings yet.</p>}
          {screenings.map((screening) => (
            <div key={screening.id} className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
              <div>
                <p className="font-medium text-ink-900">{screening.handlerName}</p>
                <p className="font-mono text-xs text-ink-500">{screening.uid}</p>
                <p className="mt-1 text-sm text-ink-600">{screening.tradeCategory || 'No category'}</p>
                <span className="mt-3 inline-flex rounded-[8px] bg-[#0f766e]/10 px-2 py-1 text-xs font-medium text-[#0f766e]">
                  {displayStatus(screening.status)}
                </span>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <TestBadge label="Mantoux" value={displayTest(screening.mantouxResult)} detail={screening.mantouxIndurationMm !== null ? `${screening.mantouxIndurationMm} mm` : undefined} />
                  <TestBadge label="Hepatitis B" value={displayTest(screening.hepatitisBResult)} />
                  <TestBadge label="HIV" value={displayTest(screening.hivResult)} />
                  <TestBadge label="Widal" value={displayTest(screening.widalResult)} />
                </div>
                {screening.labResultSummary && <p className="mt-3 text-sm text-ink-700">{screening.labResultSummary}</p>}
                {screening.medicalOfficerNotes && <p className="mt-2 text-xs text-ink-500">Officer notes: {screening.medicalOfficerNotes}</p>}
              </div>
              <div className="space-y-3">
                {canEnter && screening.status !== 'APPROVED' && screening.status !== 'REJECTED' && (
                  <form action={enterResultAction} className="space-y-3 rounded-[8px] border border-ink-200 bg-ink-50 p-4">
                    <input type="hidden" name="screeningId" value={screening.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ResultSelect name="mantouxResult" label="Mantoux" defaultValue={screening.mantouxResult ?? 'NEGATIVE'} />
                      <label className="space-y-1 text-xs font-medium text-ink-700">
                        <span>Mantoux induration (mm)</span>
                        <input
                          name="mantouxIndurationMm"
                          type="number"
                          min={0}
                          max={50}
                          defaultValue={screening.mantouxIndurationMm ?? ''}
                          className="w-full rounded-[8px] border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
                        />
                      </label>
                      <ResultSelect name="hepatitisBResult" label="Hepatitis B" defaultValue={screening.hepatitisBResult ?? 'NEGATIVE'} />
                      <ResultSelect name="hivResult" label="HIV" defaultValue={screening.hivResult ?? 'NEGATIVE'} />
                      <ResultSelect name="widalResult" label="Widal test" defaultValue={screening.widalResult ?? 'NEGATIVE'} />
                      <label className="space-y-1 text-xs font-medium text-ink-700">
                        <span>Fitness decision</span>
                        <select name="fitnessStatus" className="w-full rounded-[8px] border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15" defaultValue={screening.fitnessStatus ?? 'FIT'}>
                          <option value="FIT">Fit</option>
                          <option value="UNFIT">Unfit</option>
                          <option value="REQUIRES_REVIEW">Requires review</option>
                        </select>
                      </label>
                    </div>
                    <textarea name="labResultSummary" rows={2} placeholder="Clinical summary" className="w-full rounded-[8px] border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15" defaultValue={screening.labResultSummary ?? ''} />
                    <textarea name="medicalOfficerNotes" rows={2} placeholder="Medical officer notes" className="w-full rounded-[8px] border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15" defaultValue={screening.medicalOfficerNotes ?? ''} />
                    <Button type="submit" size="sm" variant="outline">Save result</Button>
                  </form>
                )}
                {canReview && screening.status === 'RESULT_ENTERED' && screening.fitnessStatus === 'FIT' && (
                  <form action={reviewScreeningAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="screeningId" value={screening.id} />
                    <input type="hidden" name="approved" value="true" />
                    <Button type="submit" size="sm">Approve and issue certificate</Button>
                  </form>
                )}
                {canReview && screening.status === 'RESULT_ENTERED' && screening.fitnessStatus !== 'FIT' && (
                  <div className="space-y-3 rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-xs text-ink-700">
                    <p>Certificate approval is available only when the saved fitness decision is Fit.</p>
                    <form action={reviewScreeningAction} className="space-y-2">
                      <input type="hidden" name="screeningId" value={screening.id} />
                      <input type="hidden" name="approved" value="false" />
                      <textarea name="reviewNotes" rows={2} placeholder="Rejection notes" className="w-full rounded-[8px] border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15" />
                      <Button type="submit" size="sm" variant="outline">Reject result</Button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ))}
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

