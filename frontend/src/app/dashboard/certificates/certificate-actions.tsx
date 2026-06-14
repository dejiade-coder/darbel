'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ExternalLink, Mail, MessageCircle, Printer, RotateCcw, ShieldX } from 'lucide-react';
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
  origin,
  canRevoke,
  canRenew,
}: {
  item: Certificate;
  origin: string;
  canRevoke: boolean;
  canRenew: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const printUrl = `/dashboard/certificates/${encodeURIComponent(item.uid)}/print`;
  const verifyUrl = `${origin}/verify/${encodeURIComponent(item.uid)}`;
  const mailUrl = buildMailLink(item, origin);
  const whatsAppUrl = buildWhatsAppLink(item, origin);

  function recordAndOpen(channel: DeliveryChannel, url: string, mode: 'same-tab' | 'new-tab' | 'location') {
    const targetWindow = mode === 'new-tab' ? window.open('about:blank', '_blank') : null;
    startTransition(async () => {
      try {
        await recordDelivery(item, channel, url, verifyUrl);
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
        alert(error instanceof Error ? error.message : 'Failed to record certificate delivery.');
      }
    });
  }

  function revokeCertificate() {
    const reason = window.prompt(`Why is certificate ${item.uid} being revoked?`);
    if (reason === null) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      alert('Enter a revocation reason of at least 3 characters.');
      return;
    }

    startTransition(async () => {
      try {
        await revokeCertificateRequest(item.id, trimmed);
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to revoke certificate.');
      }
    });
  }

  function renewCertificate() {
    const raw = window.prompt(`Renew certificate ${item.uid} for how many days?`, '365');
    if (raw === null) return;
    const validityDays = Number(raw);
    if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650) {
      alert('Enter a whole number between 1 and 3650 days.');
      return;
    }

    startTransition(async () => {
      try {
        await renewCertificateRequest(item.id, validityDays);
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to renew certificate.');
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
      <Button asChild variant="outline" size="sm">
        <a href={`/verify/${encodeURIComponent(item.uid)}`} target="_blank">
          <ExternalLink className="mr-2 h-3.5 w-3.5" />
          Verify
        </a>
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
          onClick={renewCertificate}
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
          onClick={revokeCertificate}
        >
          <ShieldX className="mr-2 h-3.5 w-3.5" />
          Revoke
        </Button>
      )}
    </>
  );
}

async function recordDelivery(
  item: Certificate,
  channel: DeliveryChannel,
  deliveryUrl: string,
  verificationUrl: string,
): Promise<void> {
  const res = await fetch('/dashboard/certificates/deliveries', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      certificateId: item.id,
      channel,
      recipient: channel === 'EMAIL' ? item.handlerEmail : channel === 'WHATSAPP' ? item.handlerPhone : null,
      deliveryUrl,
      verificationUrl,
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

function buildMailLink(item: Certificate, origin: string): string {
  const verifyUrl = `${origin}/verify/${encodeURIComponent(item.uid)}`;
  const subject = `Darbel certificate ${item.uid}`;
  const body = [
    `Hello ${item.handlerName},`,
    '',
    'Your Darbel compliance certificate is ready.',
    `Certificate UID: ${item.uid}`,
    `Verify it here: ${verifyUrl}`,
  ].join('\n');
  const recipient = item.handlerEmail ? encodeURIComponent(item.handlerEmail) : '';
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildWhatsAppLink(item: Certificate, origin: string): string {
  const verifyUrl = `${origin}/verify/${encodeURIComponent(item.uid)}`;
  const text = [
    `Darbel compliance certificate for ${item.handlerName}`,
    `UID: ${item.uid}`,
    `Verify: ${verifyUrl}`,
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
