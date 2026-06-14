'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Gavel, Mail, MessageCircle, Printer, RotateCcw, ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Certificate = {
  id: string;
  uid: string;
  handlerName: string;
  handlerEmail: string | null;
  handlerPhone: string | null;
  status: string;
};

type DeliveryChannel = 'PRINT' | 'EMAIL' | 'WHATSAPP';
type DialogMode = 'renew' | 'revoke' | 'appeal' | 'approveAppeal' | 'rejectAppeal';

export function CertificateActions({
  item,
  canRevoke,
  canRenew,
}: {
  item: Certificate;
  canRevoke: boolean;
  canRenew: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<DialogMode | null>(null);
  const [renewDays, setRenewDays] = useState('365');
  const [revokeReason, setRevokeReason] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [formError, setFormError] = useState('');
  const printUrl = `/dashboard/certificates/${encodeURIComponent(item.uid)}/print`;
  const mailUrl = buildMailLink(item);
  const whatsAppUrl = buildWhatsAppLink(item);

  function recordAndOpen(channel: DeliveryChannel, url: string, mode: 'same-tab' | 'new-tab' | 'location') {
    const targetWindow = mode === 'new-tab' ? window.open('about:blank', '_blank') : null;
    startTransition(async () => {
      try {
        await recordDelivery(item, channel, url);
        router.refresh();
        if (mode === 'same-tab') {
          router.push(url);
        } else if (mode === 'location') {
          window.location.href = url;
        } else if (targetWindow) {
          targetWindow.location.href = url;
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch (error) {
        if (targetWindow) targetWindow.close();
        setFormError(error instanceof Error ? error.message : 'Failed to record certificate delivery.');
      }
    });
  }

  function revokeCertificate() {
    const trimmed = revokeReason.trim();
    if (trimmed.length < 3) {
      setFormError('Enter a revocation reason of at least 3 characters.');
      return;
    }

    setFormError('');
    startTransition(async () => {
      try {
        await revokeCertificateRequest(item.id, trimmed);
        setMode(null);
        setRevokeReason('');
        router.refresh();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Failed to revoke certificate.');
      }
    });
  }

  function renewCertificate() {
    const validityDays = Number(renewDays);
    if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650) {
      setFormError('Enter a whole number between 1 and 3650 days.');
      return;
    }

    setFormError('');
    startTransition(async () => {
      try {
        await renewCertificateRequest(item.id, validityDays);
        setMode(null);
        router.refresh();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Failed to renew certificate.');
      }
    });
  }

  const isRevoked = item.status === 'REVOKED';
  const isUnderAppeal = item.status === 'UNDER_APPEAL';
  const canDeliver = !isRevoked && !isUnderAppeal;

  function submitAppeal() {
    const trimmed = appealReason.trim();
    if (trimmed.length < 3) {
      setFormError('Enter an appeal reason of at least 3 characters.');
      return;
    }

    setFormError('');
    startTransition(async () => {
      try {
        await appealCertificateRequest(item.id, trimmed);
        setMode(null);
        setAppealReason('');
        router.refresh();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Failed to submit certificate appeal.');
      }
    });
  }

  function reviewAppeal() {
    const trimmed = reviewNotes.trim();
    if (trimmed.length < 3) {
      setFormError('Enter review notes of at least 3 characters.');
      return;
    }
    const validityDays = Number(renewDays);
    if (mode === 'approveAppeal' && (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650)) {
      setFormError('Enter a whole number between 1 and 3650 days.');
      return;
    }

    setFormError('');
    startTransition(async () => {
      try {
        await reviewCertificateAppealRequest(item.id, mode === 'approveAppeal' ? 'APPROVE' : 'REJECT', trimmed, validityDays);
        setMode(null);
        setReviewNotes('');
        router.refresh();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Failed to review certificate appeal.');
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending || !canDeliver}
        onClick={() => recordAndOpen('PRINT', printUrl, 'same-tab')}
      >
        <Printer className="mr-2 h-3.5 w-3.5" />
        Print
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending || !canDeliver}
        onClick={() => recordAndOpen('EMAIL', mailUrl, 'location')}
      >
        <Mail className="mr-2 h-3.5 w-3.5" />
        {item.handlerEmail ? 'Email' : 'Email draft'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending || !canDeliver}
        onClick={() => recordAndOpen('WHATSAPP', whatsAppUrl, 'new-tab')}
      >
        <MessageCircle className="mr-2 h-3.5 w-3.5" />
        {item.handlerPhone ? 'WhatsApp' : 'Share'}
      </Button>
      {canRenew && canDeliver && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setMode('renew');
            setFormError('');
          }}
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Renew
        </Button>
      )}
      {canRevoke && canDeliver && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setMode('revoke');
            setFormError('');
          }}
        >
          <ShieldX className="mr-2 h-3.5 w-3.5" />
          Revoke
        </Button>
      )}
      {canRevoke && isRevoked && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setMode('appeal');
            setFormError('');
          }}
        >
          <Gavel className="mr-2 h-3.5 w-3.5" />
          Appeal
        </Button>
      )}
      {canRenew && isUnderAppeal && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setMode('approveAppeal');
              setFormError('');
            }}
          >
            <ShieldCheck className="mr-2 h-3.5 w-3.5" />
            Approve appeal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setMode('rejectAppeal');
              setFormError('');
            }}
          >
            <ShieldX className="mr-2 h-3.5 w-3.5" />
            Reject appeal
          </Button>
        </>
      )}
      {mode && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/40 px-4">
          <div className="w-full max-w-md rounded-sm border border-ink-200 bg-white p-5 shadow-xl">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-500">
                {dialogTitle(mode)}
              </p>
              <h2 className="mt-1 font-display text-2xl font-medium text-ink-950">{item.uid}</h2>
              <p className="mt-1 text-sm text-ink-600">{item.handlerName}</p>
            </div>

            {(mode === 'renew' || mode === 'approveAppeal') && (
              <label className="mt-5 grid gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500">Validity days</span>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={renewDays}
                  onChange={(event) => setRenewDays(event.target.value)}
                  className="h-10 rounded-sm border border-ink-200 px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </label>
            )}

            {mode === 'revoke' && (
              <label className="mt-5 grid gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500">Revocation reason</span>
                <textarea
                  rows={4}
                  value={revokeReason}
                  onChange={(event) => setRevokeReason(event.target.value)}
                  className="rounded-sm border border-ink-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                  placeholder="Enter reason for revoking this certificate"
                />
              </label>
            )}

            {mode === 'appeal' && (
              <label className="mt-5 grid gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500">Appeal reason</span>
                <textarea
                  rows={4}
                  value={appealReason}
                  onChange={(event) => setAppealReason(event.target.value)}
                  className="rounded-sm border border-ink-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                  placeholder="Enter why this revocation should be reviewed"
                />
              </label>
            )}

            {(mode === 'approveAppeal' || mode === 'rejectAppeal') && (
              <label className="mt-5 grid gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500">Review notes</span>
                <textarea
                  rows={4}
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  className="rounded-sm border border-ink-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                  placeholder="Enter the appeal review decision notes"
                />
              </label>
            )}

            {formError && <p className="mt-3 rounded-sm border border-danger/25 bg-danger/5 p-3 text-sm text-danger">{formError}</p>}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setMode(null);
                  setFormError('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={mode === 'revoke' || mode === 'rejectAppeal' ? 'destructive' : 'default'}
                disabled={isPending}
                onClick={submitHandler(mode, renewCertificate, revokeCertificate, submitAppeal, reviewAppeal)}
              >
                {isPending ? 'Saving...' : submitLabel(mode)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

async function recordDelivery(
  item: Certificate,
  channel: DeliveryChannel,
  deliveryUrl: string,
): Promise<void> {
  const res = await fetch('/dashboard/certificates/deliveries', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      certificateId: item.id,
      channel,
      recipient: channel === 'EMAIL' ? item.handlerEmail : channel === 'WHATSAPP' ? item.handlerPhone : null,
      deliveryUrl,
      verificationUrl: '',
      messagePreview: buildMessagePreview(item, channel),
    }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Failed to record certificate delivery.');
  }
}

async function revokeCertificateRequest(certificateId: string, reason: string): Promise<void> {
  const res = await fetch('/dashboard/certificates/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ certificateId, reason }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Failed to revoke certificate.');
  }
}

async function renewCertificateRequest(certificateId: string, validityDays: number): Promise<void> {
  const res = await fetch('/dashboard/certificates/renew', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ certificateId, validityDays }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Failed to renew certificate.');
  }
}

async function appealCertificateRequest(certificateId: string, reason: string): Promise<void> {
  const res = await fetch('/dashboard/certificates/appeal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ certificateId, reason }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Failed to submit certificate appeal.');
  }
}

async function reviewCertificateAppealRequest(
  certificateId: string,
  decision: 'APPROVE' | 'REJECT',
  notes: string,
  validityDays: number,
): Promise<void> {
  const res = await fetch('/dashboard/certificates/appeal-review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ certificateId, decision, notes, validityDays }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Failed to review certificate appeal.');
  }
}

function buildMessagePreview(item: Certificate, channel: DeliveryChannel): string {
  if (channel === 'PRINT') return `Printed certificate ${item.uid} for ${item.handlerName}`;
  if (channel === 'EMAIL') return `Email certificate ${item.uid} to ${item.handlerEmail ?? 'draft recipient'}`;
  return `WhatsApp certificate ${item.uid} to ${item.handlerPhone ?? 'share recipient'}`;
}

function buildMailLink(item: Certificate): string {
  const subject = `Darbel certificate ${item.uid}`;
  const body = [
    `Hello ${item.handlerName},`,
    '',
    'Your Darbel compliance certificate is ready.',
    `Certificate UID: ${item.uid}`,
    `Authorized officers can scan the barcode on the printed certificate to view handler details.`,
  ].join('\n');
  const recipient = item.handlerEmail ? encodeURIComponent(item.handlerEmail) : '';
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildWhatsAppLink(item: Certificate): string {
  const text = [
    `Darbel compliance certificate for ${item.handlerName}`,
    `UID: ${item.uid}`,
    'Officer barcode scan is required to reveal handler details.',
  ].join('\n');
  const phone = normalizeWhatsAppPhone(item.handlerPhone);
  const recipientPath = phone ? `/${phone}` : '';
  return `https://wa.me${recipientPath}?text=${encodeURIComponent(text)}`;
}

function normalizeWhatsAppPhone(value: string | null): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  return digits;
}

function dialogTitle(mode: DialogMode): string {
  if (mode === 'renew') return 'Renew certificate';
  if (mode === 'revoke') return 'Revoke certificate';
  if (mode === 'appeal') return 'Submit appeal';
  if (mode === 'approveAppeal') return 'Approve appeal';
  return 'Reject appeal';
}

function submitLabel(mode: DialogMode): string {
  if (mode === 'renew') return 'Renew certificate';
  if (mode === 'revoke') return 'Revoke certificate';
  if (mode === 'appeal') return 'Submit appeal';
  if (mode === 'approveAppeal') return 'Approve appeal';
  return 'Reject appeal';
}

function submitHandler(
  mode: DialogMode,
  renewCertificate: () => void,
  revokeCertificate: () => void,
  submitAppeal: () => void,
  reviewAppeal: () => void,
): () => void {
  if (mode === 'renew') return renewCertificate;
  if (mode === 'revoke') return revokeCertificate;
  if (mode === 'appeal') return submitAppeal;
  return reviewAppeal;
}
