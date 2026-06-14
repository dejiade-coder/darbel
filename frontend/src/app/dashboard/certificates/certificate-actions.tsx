'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Mail, MessageCircle, Printer, RotateCcw, ShieldX } from 'lucide-react';
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
  const [mode, setMode] = useState<'renew' | 'revoke' | null>(null);
  const [renewDays, setRenewDays] = useState('365');
  const [revokeReason, setRevokeReason] = useState('');
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

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending || isRevoked}
        onClick={() => recordAndOpen('PRINT', printUrl, 'same-tab')}
      >
        <Printer className="mr-2 h-3.5 w-3.5" />
        Print
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending || isRevoked}
        onClick={() => recordAndOpen('EMAIL', mailUrl, 'location')}
      >
        <Mail className="mr-2 h-3.5 w-3.5" />
        {item.handlerEmail ? 'Email' : 'Email draft'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending || isRevoked}
        onClick={() => recordAndOpen('WHATSAPP', whatsAppUrl, 'new-tab')}
      >
        <MessageCircle className="mr-2 h-3.5 w-3.5" />
        {item.handlerPhone ? 'WhatsApp' : 'Share'}
      </Button>
      {canRenew && !isRevoked && (
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
      {canRevoke && !isRevoked && (
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
      {mode && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/40 px-4">
          <div className="w-full max-w-md rounded-sm border border-ink-200 bg-white p-5 shadow-xl">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-500">
                {mode === 'renew' ? 'Renew certificate' : 'Revoke certificate'}
              </p>
              <h2 className="mt-1 font-display text-2xl font-medium text-ink-950">{item.uid}</h2>
              <p className="mt-1 text-sm text-ink-600">{item.handlerName}</p>
            </div>

            {mode === 'renew' ? (
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
            ) : (
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
                variant={mode === 'revoke' ? 'destructive' : 'default'}
                disabled={isPending}
                onClick={mode === 'renew' ? renewCertificate : revokeCertificate}
              >
                {isPending ? 'Saving...' : mode === 'renew' ? 'Renew certificate' : 'Revoke certificate'}
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
