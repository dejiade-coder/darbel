import Link from 'next/link';
import { ArrowRight, CheckCircle2, CreditCard, Filter, ReceiptText, Search, WalletCards } from 'lucide-react';
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

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: PaymentsSearchParams;
}) {
  const actor = await readActorFromAccessToken();
  const canApprovePayment = actor?.permissions.includes('payment.approve') ?? false;
  let items: Payment[] = [];
  let loadError = '';
  const q = searchParams?.q?.trim() ?? '';
  const statusFilter = searchParams?.status;
  const paymentError = searchParams?.paymentError?.trim() ?? '';
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
  const cashCount = items.filter((item) => item.method === 'CASH').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-ink-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Phase 2</p>
          <h1 className="mt-1 font-display text-4xl font-medium text-ink-900">Payments</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            Track registration payments recorded before medical screening.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric icon={WalletCards} label="Total captured" value={`NGN ${total.toLocaleString()}`} detail="In current result set" />
        <Metric icon={ReceiptText} label="Recorded" value={`${recordedCount}`} detail="Awaiting finance review" />
        <Metric icon={CreditCard} label="Cash payments" value={`${cashCount}`} detail="Recorded as cash" />
      </section>

      <section className="rounded-sm border border-ink-200 bg-white">
        {paymentError && (
          <div className="border-b border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {paymentError}
          </div>
        )}
        <form
          action="/dashboard/payments"
          className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              name="q"
              defaultValue={q}
              className="pl-9"
              placeholder="Search by handler, receipt, reference, or category"
              aria-label="Search payments"
            />
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" size="sm">
              <Search className="mr-2 h-3.5 w-3.5" />
              Search
            </Button>
            <Button asChild variant={statusFilter === 'RECORDED' ? 'default' : 'outline'} size="sm">
              <Link href={buildPaymentsHref({ q, status: 'RECORDED' })}>
                <Filter className="mr-2 h-3.5 w-3.5" />
                Recorded
              </Link>
            </Button>
            {(q || statusFilter) && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/payments">Clear</Link>
              </Button>
            )}
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-[0.14em] text-ink-500">
              <tr>
                <th className="px-5 py-3 font-medium">Handler</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Paid</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loadError && (
                <tr>
                  <td className="px-5 py-8 text-sm text-danger" colSpan={6}>{loadError}</td>
                </tr>
              )}
              {!loadError && items.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-sm text-ink-500" colSpan={6}>
                    {q || statusFilter ? 'No payments match this filter.' : 'No payments recorded yet.'}
                  </td>
                </tr>
              )}
              {items.map((payment) => {
                const status = displayStatus(payment.status);
                return (
                  <tr key={payment.id} className="hover:bg-ink-50/70">
                    <td className="px-5 py-4">
                      <p className="font-medium text-ink-900">{payment.handlerName}</p>
                      <p className="mt-1 text-xs text-ink-500">{payment.tradeCategory || 'No category'}</p>
                      <p className="mt-1 font-mono text-xs text-ink-500">
                        {payment.registrationUid ?? payment.receiptNumber ?? payment.reference ?? payment.id}
                      </p>
                    </td>
                    <td className="px-5 py-4 font-medium text-ink-900">
                      {payment.currency} {Number(payment.amount).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-ink-700">{displayMethod(payment.method)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-sm px-2 py-1 text-xs font-medium ${statusStyles[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink-600">{formatDate(payment.paidAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
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
                        <Button asChild variant="ghost" size="icon" aria-label={`Open ${payment.handlerName}`}>
                          <Link href={`/dashboard/registrations/${payment.handlerRegistrationId}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
