'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, ReceiptText, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  approvePaymentAction,
  registrarApprovePaymentAction,
  recordPaymentAction,
  type PaymentMethod,
} from './payment-actions';

type RegistrationStatus =
  | 'DRAFT'
  | 'SUBMITTED_FOR_REVIEW'
  | 'READY_FOR_SCREENING'
  | 'CANCELLED';

export type RegistrationPayment = {
  id: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  receiptNumber: string | null;
  status: string;
  paidAt: string;
  approvedAt?: string | null;
  registrationUid?: string | null;
};

export function PaymentPanel({
  registrationId,
  registrationStatus,
  canRecordPayment,
  canApprovePayment,
  payments,
  tradeCategory,
  tradeCategoryFee,
}: {
  registrationId: string;
  registrationStatus: RegistrationStatus;
  canRecordPayment: boolean;
  canApprovePayment: boolean;
  payments: RegistrationPayment[];
  tradeCategory: string | null;
  tradeCategoryFee: { amount: number; currency: string } | null;
}) {
  const [amount, setAmount] = useState(tradeCategoryFee?.amount ? String(tradeCategoryFee.amount) : '');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paidAt, setPaidAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [approvingPaymentId, setApprovingPaymentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const canRecord = canRecordPayment && registrationStatus === 'SUBMITTED_FOR_REVIEW';
  const canRegistrarApprove = canRecordPayment;
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const hasApprovedPayment = payments.some((payment) => payment.status === 'APPROVED');
  const approvedPayment = payments.find((payment) => payment.status === 'APPROVED');
  const paymentGateComplete = Boolean(approvedPayment) || registrationStatus === 'READY_FOR_SCREENING';

  useEffect(() => {
    if (tradeCategoryFee?.amount && !payments.length) {
      setAmount(String(tradeCategoryFee.amount));
    }
  }, [payments.length, tradeCategoryFee?.amount]);

  async function recordPayment() {
    if (!amount || Number(amount) <= 0) {
      setNotice({ type: 'error', message: 'Enter a valid payment amount.' });
      return;
    }

    setIsSaving(true);
    try {
      const saved = await recordPaymentAction({
        handlerRegistrationId: registrationId,
        amount: Number(amount),
        method,
        receiptNumber,
        paidAt,
        notes,
      });
      if (!saved?.id) {
        throw new Error('Payment was not recorded. Please try again.');
      }
      setAmount('');
      setReceiptNumber('');
      setNotes('');
      const approved = await registrarApprovePaymentAction({
        paymentId: saved.id,
        handlerRegistrationId: registrationId,
      });
      if (!approved?.id) {
        throw new Error('Payment was recorded but could not be approved. Please use the approve button.');
      }
      setNotice({
        type: 'success',
        message: `Payment approved: ${approved.currency} ${Number(approved.amount).toLocaleString()}. UID ${approved.registrationUid ?? 'issued'}.`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to record payment.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function approvePayment(paymentId: string) {
    setApprovingPaymentId(paymentId);
    try {
      const approved = await approvePaymentAction({ paymentId, handlerRegistrationId: registrationId });
      setNotice({
        type: 'success',
        message: `Payment approved: ${approved.currency} ${Number(approved.amount).toLocaleString()}.`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to approve payment.',
      });
    } finally {
      setApprovingPaymentId(null);
    }
  }

  async function registrarApprovePayment(paymentId: string) {
    setApprovingPaymentId(paymentId);
    try {
      const approved = await registrarApprovePaymentAction({ paymentId, handlerRegistrationId: registrationId });
      setNotice({
        type: 'success',
        message: `Payment approved: ${approved.currency} ${Number(approved.amount).toLocaleString()}.`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to approve payment.',
      });
    } finally {
      setApprovingPaymentId(null);
    }
  }

  return (
    <section id="payment" className="rounded-[8px] border border-ink-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-ink-100 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#0f766e]/10 text-[#0f766e]">
            <CreditCard className="h-4 w-4" strokeWidth={1.6} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink-900">Payment</h2>
            <p className="mt-1 text-sm text-ink-600">
              {paymentGateComplete
                ? 'Payment is approved and this handler is cleared for medical screening.'
                : 'Record and approve payment here so the handler can move straight to medical screening.'}
            </p>
          </div>
        </div>
        <div className="rounded-[8px] border border-ink-200 bg-ink-50 px-4 py-2 text-sm text-ink-700">
          Total recorded: <span className="font-semibold text-ink-900">NGN {totalPaid.toLocaleString()}</span>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {paymentGateComplete && (
            <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold text-emerald-900">Payment approved</p>
              <p className="mt-1">
                This handler can proceed to medical screening
                {approvedPayment?.registrationUid ? ` with UID ${approvedPayment.registrationUid}` : ''}.
              </p>
            </div>
          )}
          {!paymentGateComplete && !canRecord && (
            <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {canRecordPayment
                ? 'Submit the registration before recording payment. Cancelled records cannot receive payment.'
                : 'You can view payment history, but you do not have permission to record payments.'}
            </div>
          )}
          {notice && (
            <div
              className={`rounded-[8px] border p-4 text-sm ${
                notice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
              role="status"
            >
              {notice.message}
            </div>
          )}

          <div className="rounded-[8px] border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700">
            <p className="font-semibold text-ink-900">Trade category fee</p>
            <p className="mt-1">
              {tradeCategory || 'No category selected'}:{' '}
              <span className="font-semibold">
                {tradeCategoryFee ? `${tradeCategoryFee.currency} ${tradeCategoryFee.amount.toLocaleString()}` : 'No fee configured'}
              </span>
            </p>
            {!tradeCategoryFee && (
              <p className="mt-2 text-xs text-amber-700">
                Set this category fee under Trade Categories before recording payment.
              </p>
            )}
          </div>

          {!paymentGateComplete && canRecordPayment && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Amount (NGN)" id="paymentAmount" type="number" value={amount} onChange={setAmount} disabled={!canRecord || Boolean(tradeCategoryFee)} />
                <SelectField label="Method" id="paymentMethod" value={method} onChange={(value) => setMethod(value as PaymentMethod)} disabled={!canRecord} />
                <Field label="Receipt number" id="receiptNumber" value={receiptNumber} onChange={setReceiptNumber} disabled={!canRecord} />
                <Field label="Paid date" id="paidAt" type="date" value={paidAt} onChange={setPaidAt} disabled={!canRecord} />
                <div className="md:col-span-2">
                  <Label htmlFor="paymentNotes" className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Notes</Label>
                  <textarea
                    id="paymentNotes"
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={!canRecord}
                    className="mt-2 w-full rounded-[8px] border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 disabled:bg-ink-50"
                    placeholder="Optional payment notes"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={recordPayment}
                disabled={!canRecord || isSaving || !amount || Number(amount) <= 0}
                className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#0f766e] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b5f59] disabled:opacity-60"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Approving...' : 'Record and approve'}
              </button>
            </>
          )}
        </div>

        <aside className="rounded-[8px] border border-ink-200 bg-ink-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <ReceiptText className="h-4 w-4 text-[#0f766e]" />
            Payment history
          </div>
          <div className="mt-4 space-y-3">
            {payments.length === 0 && (
              <p className="text-sm text-ink-500">No payment recorded yet.</p>
            )}
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-[8px] border border-ink-200 bg-white p-3 text-sm text-ink-800">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold">
                    {payment.currency} {Number(payment.amount).toLocaleString()}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      payment.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-sky-100 text-sky-700'
                    }`}
                  >
                    {payment.status.toLowerCase()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-500">{displayMethod(payment.method)} - {formatDate(payment.paidAt)}</p>
                <p className="mt-1 font-mono text-xs text-ink-500">
                  {payment.receiptNumber || payment.id}
                </p>
                {payment.approvedAt && (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">Approved {formatDate(payment.approvedAt)}</p>
                )}
                {payment.registrationUid && (
                  <p className="mt-2 font-mono text-xs text-ink-800">UID {payment.registrationUid}</p>
                )}
                {(canApprovePayment || canRegistrarApprove) && payment.status === 'RECORDED' && !hasApprovedPayment && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => (canApprovePayment ? approvePayment(payment.id) : registrarApprovePayment(payment.id))}
                    disabled={approvingPaymentId === payment.id}
                  >
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                    {approvingPaymentId === payment.id ? 'Approving...' : 'Approve payment'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Field({
  label,
  id,
  type = 'text',
  value,
  onChange,
  disabled,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">{label}</Label>
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-[8px] border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 disabled:bg-ink-50"
      />
    </div>
  );
}

function SelectField({
  label,
  id,
  value,
  onChange,
  disabled,
}: {
  label: string;
  id: string;
  value: PaymentMethod;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">{label}</Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 flex h-11 w-full rounded-[8px] border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 disabled:bg-ink-50"
      >
        <option value="CASH">Cash</option>
        <option value="BANK_TRANSFER">Bank transfer</option>
        <option value="POS">POS</option>
        <option value="ONLINE">Online</option>
      </select>
    </div>
  );
}

function displayMethod(method: PaymentMethod): string {
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

