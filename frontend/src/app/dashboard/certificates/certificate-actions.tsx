'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ExternalLink, Mail, MessageCircle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Certificate = {
  id: string;
  uid: string;
  handlerName: string;
  handlerEmail: string | null;
  handlerPhone: string | null;
};

type DeliveryChannel = 'PRINT' | 'EMAIL' | 'WHATSAPP';

export function CertificateActions({ item, origin }: { item: Certificate; origin: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const printUrl = `/dashboard/certificates/${encodeURIComponent(item.uid)}/print`;
  const mailUrl = buildMailLink(item, origin);
  const whatsAppUrl = buildWhatsAppLink(item, origin);

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
        alert(error instanceof Error ? error.message : 'Failed to record certificate delivery.');
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
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
        disabled={isPending}
        onClick={() => recordAndOpen('EMAIL', mailUrl, 'location')}
      >
        <Mail className="mr-2 h-3.5 w-3.5" />
        {item.handlerEmail ? 'Email' : 'Email draft'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => recordAndOpen('WHATSAPP', whatsAppUrl, 'new-tab')}
      >
        <MessageCircle className="mr-2 h-3.5 w-3.5" />
        {item.handlerPhone ? 'WhatsApp' : 'Share'}
      </Button>
    </>
  );
}

async function recordDelivery(item: Certificate, channel: DeliveryChannel, deliveryUrl: string): Promise<void> {
  const res = await fetch('/dashboard/certificates/deliveries', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      certificateId: item.id,
      channel,
      recipient: channel === 'EMAIL' ? item.handlerEmail : channel === 'WHATSAPP' ? item.handlerPhone : null,
      deliveryUrl,
      messagePreview: buildMessagePreview(item, channel),
    }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Failed to record certificate delivery.');
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
