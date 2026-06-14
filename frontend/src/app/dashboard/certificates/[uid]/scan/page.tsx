import Link from 'next/link';
import { notFound } from 'next/navigation';
import type React from 'react';
import { ArrowLeft, BadgeCheck, CalendarDays, Mail, Phone, ShieldCheck, Store, UserRound } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Officer certificate scan' };

type Certificate = {
  id: string;
  uid: string;
  handlerName: string;
  handlerEmail: string | null;
  handlerPhone: string | null;
  tradeCategory: string | null;
  status: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
};

export default async function CertificateScanPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const certificate = await fetchCertificate(uid);
  if (!certificate) notFound();
  const isValid = certificate.status === 'VALID' && new Date(certificate.expiresAt) >= new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard/certificates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Certificates
          </Link>
        </Button>
        <Badge variant={isValid ? 'success' : 'danger'}>
          {isValid ? 'Valid certificate' : certificate.status}
        </Badge>
      </div>

      <header className="border-b border-ink-200 pb-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Officer scan result</p>
        <h1 className="mt-1 font-display text-4xl font-medium text-ink-900">{certificate.handlerName}</h1>
        <p className="mt-2 font-mono text-sm text-ink-500">{certificate.uid}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Handler Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <Detail icon={UserRound} label="Handler" value={certificate.handlerName} />
          <Detail icon={Store} label="Trade category" value={certificate.tradeCategory || 'Not listed'} />
          <Detail icon={Phone} label="Phone" value={certificate.handlerPhone || 'Not provided'} />
          <Detail icon={Mail} label="Email" value={certificate.handlerEmail || 'Not provided'} />
          <Detail icon={ShieldCheck} label="Certificate status" value={certificate.status} />
          <Detail icon={CalendarDays} label="Issued" value={formatDate(certificate.issuedAt)} />
          <Detail icon={CalendarDays} label="Expires" value={formatDate(certificate.expiresAt)} />
          <Detail icon={BadgeCheck} label="UID" value={certificate.uid} mono />
        </CardContent>
      </Card>

      {certificate.status === 'REVOKED' && (
        <Card>
          <CardHeader>
            <CardTitle>Revocation</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-danger">
            Revoked {certificate.revokedAt ? formatDate(certificate.revokedAt) : ''}
            {certificate.revokeReason ? ` - ${certificate.revokeReason}` : ''}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function fetchCertificate(uid: string): Promise<Certificate | null> {
  try {
    const result = await apiFetch<{ items: Certificate[] }>(
      `/certificates?q=${encodeURIComponent(uid)}`,
      { authenticated: true },
    );
    return result.items.find((item) => item.uid.toUpperCase() === uid.toUpperCase()) ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

function Detail({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-sm border border-ink-100 bg-ink-50/50 p-4">
      <Icon className="mt-0.5 h-4 w-4 text-accent" />
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
        <p className={mono ? 'mt-1 font-mono text-ink-900' : 'mt-1 font-medium text-ink-900'}>{value}</p>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
