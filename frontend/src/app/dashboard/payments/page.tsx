import Link from 'next/link';
import type React from 'react';
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
  cursor?: string;
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
  const cursor = params?.cursor;
  const paymentError = params?.paymentError?.trim() ?? '';
  const apiParams = new URLSearchParams();
  if (q) apiParams.set('q', q);
  if (statusFilter) apiParams.set('status', statusFilter);
  if (cursor) apiParams.set('cursor', cursor);
  let nextCursor: string | null = null;

  try {
    const result = await apiFetch<{ items: Payment[]; nextCursor: string | null }>(
      `/payments${apiParams.size ? `?${apiParams.toString()}` : ''}`,
      { authenticated: true },
    );
    items = result.items;
    nextCursor = result.nextCursor;
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
        <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full border-collapse text-sm">
            <thead className="bg-ink-50 text-left text-[10px] uppercase tracking-[0.16em] text-ink-500">
              <tr>
                <Th>Handler</Th>
                <Th>UID / Receipt</Th>
                <Th>Category</Th>
                <Th className="text-right">Amount</Th>
                <Th>Method</Th>
                <Th>Status</Th>
                <Th>Paid</Th>
                <Th>Approved</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((payment) => {
                const status = displayStatus(payment.status);
                return (
                  <tr key={payment.id} className="border-t border-ink-100 transition hover:bg-accent/5">
                    <Td>
                      <p className="font-semibold text-ink-900">{payment.handlerName}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{payment.handlerRegistrationId.slice(0, 8)}</p>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-ink-700">
                        {payment.registrationUid ?? payment.receiptNumber ?? payment.id}
                      </span>
                    </Td>
                    <Td>{payment.tradeCategory || 'No category'}</Td>
                    <Td className="text-right font-mono font-semibold text-ink-900">
                      {payment.currency} {Number(payment.amount).toLocaleString()}
                    </Td>
                    <Td>{displayMethod(payment.method)}</Td>
                    <Td>
                      <span className={`rounded-sm px-2 py-1 text-xs font-medium ${statusStyles[status]}`}>
                        {status}
                      </span>
                    </Td>
                    <Td>{formatDate(payment.paidAt)}</Td>
                    <Td>{payment.approvedAt ? formatDate(payment.approvedAt) : '-'}</Td>
                    <Td>
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
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/registrations/${payment.handlerRegistrationId}`}>
                            Open
                            <ArrowRight className="ml-2 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {nextCursor && (
          <div className="border-t border-ink-100 p-5 text-right">
            <Button asChild variant="outline" size="sm">
              <Link href={buildPaymentsHref({ q, status: statusFilter, cursor: nextCursor })}>
                Load more
              </Link>
            </Button>
          </div>
        )}
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

function buildPaymentsHref({ q, status, cursor }: { q?: string; status?: Payment['status']; cursor?: string }): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (cursor) params.set('cursor', cursor);
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

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-4 py-3 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`align-middle px-4 py-3 text-ink-700 ${className}`}>{children}</td>;
}
