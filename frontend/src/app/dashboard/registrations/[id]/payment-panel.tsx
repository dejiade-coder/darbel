'use client';

import { useState } from 'react';
import { CreditCard, ReceiptText, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { recordPaymentAction, type PaymentMethod } from './payment-actions';

type RegistrationStatus = 'DRAFT' | 'SUBMITTED_FOR_REVIEW' | 'CANCELLED';

export type RegistrationPayment = {
  id: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  receiptNumber: string | null;
  status: string;
  paidAt: string;
};

export function PaymentPanel({
  registrationId,
  registrationStatus,
  canRecordPayment,
  payments,
}: {
  registrationId: string;
  registrationStatus: RegistrationStatus;
  canRecordPayment: boolean;
  payments: RegistrationPayment[];
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paidAt, setPaidAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const canRecord = canRecordPayment && registrationStatus === 'SUBMITTED_FOR_REVIEW';
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

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
        reference,
        receiptNumber,
        paidAt,
        notes,
      });
      setAmount('');
      setReference('');
      setReceiptNumber('');
      setNotes('');
      setNotice({
        type: 'success',
        message: `Payment recorded: ${saved.currency} ${Number(saved.amount).toLocaleString()}.`,
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

  return (
    <section className="rounded-sm border border-ink-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-ink-100 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm bg-accent/5 text-accent">
            <CreditCard className="h-4 w-4" strokeWidth={1.6} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink-900">Payment</h2>
            <p className="mt-1 text-sm text-ink-500">Record payment after the registration is submitted for review.</p>
          </div>
        </div>
        <div className="text-sm text-ink-700">
          Total recorded: <span className="font-semibold text-ink-900">NGN {totalPaid.toLocaleString()}</span>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {!canRecord && (
            <div className="rounded-sm border border-warning/25 bg-warning/5 p-4 text-sm text-warning">
              {canRecordPayment
                ? 'Submit the registration before recording payment. Cancelled records cannot receive payment.'
                : 'You can view payment history, but you do not have permission to record payments.'}
            </div>
          )}
          {notice && (
            <div
              className={`rounded-sm border p-4 text-sm ${
                notice.type === 'success'
                  ? 'border-success/25 bg-success/5 text-success'
                  : 'border-danger/25 bg-danger/5 text-danger'
              }`}
              role="status"
            >
              {notice.message}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Amount (NGN)" id="paymentAmount" type="number" value={amount} onChange={setAmount} disabled={!canRecord} />
            <SelectField label="Method" id="paymentMethod" value={method} onChange={(value) => setMethod(value as PaymentMethod)} disabled={!canRecord} />
            <Field label="Receipt number" id="receiptNumber" value={receiptNumber} onChange={setReceiptNumber} disabled={!canRecord} />
            <Field label="Reference" id="paymentReference" value={reference} onChange={setReference} disabled={!canRecord} />
            <Field label="Paid date" id="paidAt" type="date" value={paidAt} onChange={setPaidAt} disabled={!canRecord} />
            <div className="md:col-span-2">
              <Label htmlFor="paymentNotes">Notes</Label>
              <textarea
                id="paymentNotes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={!canRecord}
                className="mt-2 w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:bg-ink-50"
                placeholder="Optional payment notes"
              />
            </div>
          </div>

          <Button type="button" onClick={recordPayment} disabled={!canRecord || isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Recording...' : 'Record payment'}
          </Button>
        </div>

        <aside className="rounded-sm border border-ink-200 bg-ink-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <ReceiptText className="h-4 w-4 text-accent" />
            Payment history
          </div>
          <div className="mt-4 space-y-3">
            {payments.length === 0 && (
              <p className="text-sm text-ink-500">No payment recorded yet.</p>
            )}
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-sm border border-ink-200 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-ink-900">
                    {payment.currency} {Number(payment.amount).toLocaleString()}
                  </p>
                  <span className="rounded-sm bg-info/10 px-2 py-1 text-xs font-medium text-info">
                    {payment.status.toLowerCase()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-500">{displayMethod(payment.method)} · {formatDate(payment.paidAt)}</p>
                <p className="mt-1 font-mono text-xs text-ink-500">
                  {payment.receiptNumber || payment.reference || payment.id}
                </p>
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
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2"
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
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 flex h-10 w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:bg-ink-50"
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
