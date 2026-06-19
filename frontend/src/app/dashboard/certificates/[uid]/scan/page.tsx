import Link from 'next/link';
import { notFound } from 'next/navigation';
import type React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock,
  Mail,
  Phone,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';
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
  const verdict = getVerdict(certificate);
  const VerdictIcon = verdict.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard/certificates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Certificates
          </Link>
        </Button>
        <Badge variant={verdict.badgeVariant}>{verdict.label}</Badge>
      </div>

      <header className="overflow-hidden rounded-sm border border-ink-200 bg-white shadow-sm">
        <div className={`border-l-4 p-5 ${verdict.borderClass}`}>
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Officer scan result</p>
              <h1 className="mt-2 font-display text-4xl font-medium text-ink-950">{certificate.handlerName}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={verdict.badgeVariant}>{verdict.label}</Badge>
                <span className="font-mono text-xs text-ink-500">{certificate.uid}</span>
              </div>
            </div>
            <div className="rounded-sm border border-ink-100 bg-ink-50/70 p-4 md:min-w-64">
              <div className="flex items-start gap-3">
                <VerdictIcon className={`mt-0.5 h-5 w-5 ${verdict.iconClass}`} />
                <div>
                  <p className="text-sm font-semibold text-ink-950">{verdict.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-600">{verdict.description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {verdict.notice && (
        <div className={`rounded-sm border p-4 text-sm ${verdict.noticeClass}`}>
          {verdict.notice}
        </div>
      )}

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

      <Card>
        <CardHeader>
          <CardTitle>Officer Action</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-ink-600 md:grid-cols-[1fr_auto] md:items-center">
          <p>
            Match the handler name, UID, and trade category against the printed certificate and the person presenting it before accepting the certificate.
          </p>
          <Button asChild variant="outline">
            <Link href={`/dashboard/certificates?q=${encodeURIComponent(certificate.uid)}`}>
              Open certificate record
            </Link>
          </Button>
        </CardContent>
      </Card>
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

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

function getVerdict(certificate: Certificate): {
  label: string;
  title: string;
  description: string;
  notice?: string;
  noticeClass?: string;
  badgeVariant: BadgeVariant;
  borderClass: string;
  iconClass: string;
  icon: React.ComponentType<{ className?: string }>;
} {
  const isExpired = certificate.status === 'EXPIRED' || new Date(certificate.expiresAt) < new Date();
  if (certificate.status === 'REVOKED') {
    return {
      label: 'Revoked certificate',
      title: 'Do not accept this certificate',
      description: 'This certificate has been revoked and is no longer valid for compliance checks.',
      notice: certificate.revokeReason
        ? `Revocation reason: ${certificate.revokeReason}`
        : 'This record has been revoked. Review the certificate record for full action history.',
      noticeClass: 'border-danger/25 bg-danger/5 text-danger',
      badgeVariant: 'danger',
      borderClass: 'border-danger',
      iconClass: 'text-danger',
      icon: AlertTriangle,
    };
  }
  if (certificate.status === 'UNDER_APPEAL') {
    return {
      label: 'Under appeal',
      title: 'Appeal review is pending',
      description: 'This certificate was revoked and is currently under appeal. Treat it as not valid until the appeal is approved.',
      notice: 'Do not clear this handler with the appealed certificate until an authorized review restores it.',
      noticeClass: 'border-warning/30 bg-warning/5 text-warning',
      badgeVariant: 'warning',
      borderClass: 'border-warning',
      iconClass: 'text-warning',
      icon: Clock,
    };
  }
  if (isExpired) {
    return {
      label: 'Expired certificate',
      title: 'Renewal is required',
      description: `This certificate expired on ${formatDate(certificate.expiresAt)}.`,
      notice: 'Ask the handler to complete renewal before using this certificate for compliance clearance.',
      noticeClass: 'border-warning/30 bg-warning/5 text-warning',
      badgeVariant: 'warning',
      borderClass: 'border-warning',
      iconClass: 'text-warning',
      icon: Clock,
    };
  }
  return {
    label: 'Valid certificate',
    title: 'Certificate is active',
    description: `This certificate is valid until ${formatDate(certificate.expiresAt)}.`,
    badgeVariant: 'success',
    borderClass: 'border-success',
    iconClass: 'text-success',
    icon: ShieldCheck,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
