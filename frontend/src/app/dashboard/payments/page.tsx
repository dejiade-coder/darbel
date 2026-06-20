import Link from 'next/link';
import { ArrowRight, CheckCircle2, CreditCard, Filter, ReceiptText, Search, ShieldCheck, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { approvePaymentFromListAction } from './actions';

export const metadata = { title: 'Payments' };

type Payment = {
  id: string;
  handlerRegistrationId: string;
  handlerName: string;
  tradeCategory: string | null;
  amount: string;
  currency: string;
  method: 'CASH' | 'BANK_TRANSFER' | 'POS' | 'ONLINE';
  reference: string | null;
  receiptNumber: string | null;
  status: 'RECORDED' | 'APPROVED' | 'VOIDED' | 'REFUNDED';
  paidAt: string;
  approvedAt: string | null;
  registrationUid: string | null;
  registrationHasApprovedPayment: boolean;
};

type PaymentsSearchParams = {
  q?: string;
  status?: Payment['status'];
  paymentError?: string;
};

const statusStyles: Record<string, string> = {
  Recorded: 'bg-info/10 text-info',
  Approved: 'bg-success/10 text-success',
  Voided: 'bg-ink-100 text-ink-600',
  Refunded: 'bg-warning/10 text-warning',
};

const STATUS_TABS: Array<{ label: string; value: Payment['status'] | '' }> = [
  { label: 'All payments', value: '' },
  { label: 'Recorded', value: 'RECORDED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Voided', value: 'VOIDED' },
  { label: 'Refunded', value: 'REFUNDED' },
];

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: PaymentsSearchParams | Promise<PaymentsSearchParams>;
}) {
  const params = await Promise.resolve(searchParams);
  const actor = await readActorFromAccessToken();
  const canApprovePayment = actor?.permissions.includes('payment.approve') ?? false;
  let items: Payment[] = [];
  let loadError = '';
  const q = params?.q?.trim() ?? '';
  const statusFilter = params?.status;
  const paymentError = params?.paymentError?.trim() ?? '';
  const apiParams = new URLSearchParams();
  if (q) apiParams.set('q', q);
  if (statusFilter) apiParams.set('status', statusFilter);

  try {
    const result = await apiFetch<{ items: Payment[]; nextCursor: string | null }>(
      `/payments${apiParams.size ? `?${apiParams.toString()}` : ''}`,
      { authenticated: true },
    );
    items = result.items;
  } catch (e) {
    if (e instanceof ApiError) {
      loadError = e.message;
    } else {
      throw e;
    }
  }

  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
  const recordedCount = items.filter((item) => item.status === 'RECORDED').length;
  const approvedCount = items.filter((item) => item.status === 'APPROVED').length;
  const cashCount = items.filter((item) => item.method === 'CASH').length;

  return (
    <div className="space-y-6">
      <header className="rounded-sm border border-ink-200 bg-white p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Payment operations</p>
            <h1 className="mt-2 font-display text-4xl font-medium text-ink-950">Payments</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600">
              Review recorded payments, approve the payment gate, and send handlers onward to medical screening without blocking the workflow on finance.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/registrations/new">
              <CreditCard className="mr-2 h-4 w-4" />
              New registration
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={WalletCards} label="Total captured" value={`NGN ${total.toLocaleString()}`} detail="In current result set" />
        <Metric icon={ReceiptText} label="Recorded" value={`${recordedCount}`} detail="Awaiting registrar decision" />
        <Metric icon={ShieldCheck} label="Approved" value={`${approvedCount}`} detail="Ready for medical screening" />
        <Metric icon={CreditCard} label="Cash payments" value={`${cashCount}`} detail="Recorded as cash" />
      </section>

      <section className="rounded-sm border border-ink-200 bg-white p-4">
        {paymentError && (
          <div className="mb-4 rounded-sm border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {paymentError}
          </div>
        )}
        <form
          action="/dashboard/payments"
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              name="q"
              defaultValue={q}
              className="pl-9"
              placeholder="Search by handler, receipt, UID, or category"
              aria-label="Search payments"
            />
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              <Search className="mr-2 h-3.5 w-3.5" />
              Search
            </Button>
            {(q || statusFilter) && (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/payments">Clear</Link>
              </Button>
            )}
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <Button key={tab.value || 'all'} asChild size="sm" variant={(statusFilter ?? '') === tab.value ? 'default' : 'outline'}>
              <Link href={buildPaymentsHref({ q, status: tab.value || undefined })}>
                {tab.value === 'RECORDED' && <Filter className="mr-2 h-3.5 w-3.5" />}
                {tab.label}
              </Link>
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-ink-200 bg-white">
        <div className="flex items-center gap-3 border-b border-ink-100 p-5">
          <ReceiptText className="h-4 w-4 text-accent" />
          <h2 className="text-base font-semibold text-ink-900">Payment queue</h2>
        </div>
        {loadError && <p className="p-5 text-sm text-danger">{loadError}</p>}
        {!loadError && items.length === 0 && (
          <p className="p-5 text-sm text-ink-500">
            {q || statusFilter ? 'No payments match this filter.' : 'No payments recorded yet.'}
          </p>
        )}
        <div className="grid gap-4 p-5">
          {items.map((payment) => {
            const status = displayStatus(payment.status);
            return (
              <div key={payment.id} className="grid gap-4 rounded-sm border border-ink-100 bg-white p-4 shadow-sm xl:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{payment.handlerName}</p>
                      <p className="mt-1 text-xs text-ink-500">{payment.tradeCategory || 'No category'}</p>
                      <p className="mt-1 font-mono text-xs text-ink-500">
                        {payment.registrationUid ?? payment.receiptNumber ?? payment.id}
                      </p>
                    </div>
                    <span className={`rounded-sm px-2 py-1 text-xs font-medium ${statusStyles[status]}`}>
                      {status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-600">
                    <span className="rounded-sm bg-ink-50 px-2.5 py-1 font-semibold text-ink-900">
                      {payment.currency} {Number(payment.amount).toLocaleString()}
                    </span>
                    <span className="rounded-sm bg-ink-50 px-2.5 py-1">{displayMethod(payment.method)}</span>
                    <span className="rounded-sm bg-ink-50 px-2.5 py-1">Paid {formatDate(payment.paidAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  {canApprovePayment &&
                    payment.status === 'RECORDED' &&
                    !payment.registrationHasApprovedPayment && (
                    <form action={approvePaymentFromListAction}>
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <input type="hidden" name="registrationId" value={payment.handlerRegistrationId} />
                      <Button type="submit" variant="outline" size="sm">
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                        Approve
                      </Button>
                    </form>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/registrations/${payment.handlerRegistrationId}`}>
                      Open
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function displayStatus(status: Payment['status']): string {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'VOIDED') return 'Voided';
  if (status === 'REFUNDED') return 'Refunded';
  return 'Recorded';
}

function displayMethod(method: Payment['method']): string {
  if (method === 'BANK_TRANSFER') return 'Bank transfer';
  if (method === 'POS') return 'POS';
  if (method === 'ONLINE') return 'Online';
  return 'Cash';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function buildPaymentsHref({ q, status }: { q?: string; status?: Payment['status'] }): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  const query = params.toString();
  return `/dashboard/payments${query ? `?${query}` : ''}`;
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-sm border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
        <Icon className="h-4 w-4 text-accent" strokeWidth={1.6} />
      </div>
      <p className="mt-3 font-display text-3xl font-medium text-ink-900">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{detail}</p>
    </div>
  );
}
