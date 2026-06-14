import Link from 'next/link';
import type React from 'react';
import { BadgeCheck, CalendarDays, FileSpreadsheet, Gavel, Printer, Search, Send, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { CertificateActions } from './certificate-actions';

export const metadata = { title: 'Certificates' };

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
  latestDelivery: {
    channel: string;
    deliveryStatus: string;
    recipient: string | null;
    messagePreview: string | null;
    performedAt: string;
  } | null;
  latestAppeal: {
    channel: string;
    status: string;
    notes: string | null;
    performedAt: string;
  } | null;
};

type StatusFilter = '' | 'VALID' | 'UNDER_APPEAL' | 'REVOKED' | 'EXPIRED';

const STATUS_TABS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All certificates', value: '' },
  { label: 'Valid', value: 'VALID' },
  { label: 'Under appeal', value: 'UNDER_APPEAL' },
  { label: 'Revoked', value: 'REVOKED' },
  { label: 'Expired', value: 'EXPIRED' },
];

export default async function CertificatesPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: StatusFilter }> }) {
  const params = await searchParams;
  const q = params?.q?.trim() ?? '';
  const status = params?.status ?? '';
  let items: Certificate[] = [];
  let loadError = '';
  const actor = await readActorFromAccessToken();
  const canRevoke = actor?.permissions.includes('certificate.revoke') ?? false;
  const canRenew = actor?.permissions.includes('certificate.issue') ?? false;
  try {
    const result = await apiFetch<{ items: Certificate[] }>(
      `/certificates${buildQuery({ q, status })}`,
      { authenticated: true },
    );
    items = result.items;
  } catch (error) {
    if (error instanceof ApiError) loadError = error.message;
    else throw error;
  }

  const now = new Date();
  const validCount = items.filter((item) => item.status === 'VALID' && new Date(item.expiresAt) >= now).length;
  const expiredCount = items.filter((item) => item.status === 'EXPIRED' || new Date(item.expiresAt) < now).length;
  const appealCount = items.filter((item) => item.status === 'UNDER_APPEAL').length;
  const revokedCount = items.filter((item) => item.status === 'REVOKED').length;

  return (
    <div className="space-y-6">
      <header className="rounded-sm border border-ink-200 bg-white p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Certificate operations</p>
            <h1 className="mt-2 font-display text-4xl font-medium text-ink-950">Certificates</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600">
              Print approved certificates, record deliveries, renew validity, and support authorized officer barcode checks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/settings">
                <Printer className="mr-2 h-4 w-4" />
                Certificate template
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="/dashboard/reports/exports/certificates.xls">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={ShieldCheck} label="Valid" value={validCount} detail="Ready for delivery or scan" />
        <Metric icon={Gavel} label="Appeals" value={appealCount} detail="Awaiting review decision" />
        <Metric icon={CalendarDays} label="Expired" value={expiredCount} detail="Needs renewal review" />
        <Metric icon={ShieldAlert} label="Revoked" value={revokedCount} detail="No longer usable" />
      </section>

      <section className="rounded-sm border border-ink-200 bg-white p-4">
        <form action="/dashboard/certificates" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input name="q" defaultValue={q} className="pl-9" placeholder="Search by UID, handler name, or phone" />
            {status && <input type="hidden" name="status" value={status} />}
          </div>
          <div className="flex gap-2">
            <Button type="submit">Search</Button>
            {(q || status) && (
              <Button asChild type="button" variant="outline">
                <Link href="/dashboard/certificates">Clear</Link>
              </Button>
            )}
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <Button key={tab.value || 'all'} asChild size="sm" variant={status === tab.value ? 'default' : 'outline'}>
              <Link href={`/dashboard/certificates${buildQuery({ q, status: tab.value })}`}>{tab.label}</Link>
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-ink-200 bg-white">
        <div className="flex items-center gap-3 border-b border-ink-100 p-5">
          <BadgeCheck className="h-4 w-4 text-accent" />
          <h2 className="text-base font-semibold text-ink-900">Certificate registry</h2>
        </div>
        {loadError && <p className="p-5 text-sm text-danger">{loadError}</p>}
        {!loadError && items.length === 0 && <p className="p-5 text-sm text-ink-500">No certificates issued yet.</p>}
        <div className="grid gap-4 p-5">
          {items.map((item) => (
            <div key={item.id} className="grid gap-4 rounded-sm border border-ink-100 bg-white p-4 shadow-sm xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink-900">{item.handlerName}</p>
                    <p className="font-mono text-xs text-ink-500">{item.uid}</p>
                    <p className="text-xs text-ink-500">{item.tradeCategory || 'No category'}</p>
                  </div>
                  <Badge variant={statusVariant(item)}>
                    {displayStatus(item)}
                  </Badge>
                </div>
                {item.status === 'REVOKED' && (
                  <p className="mt-2 max-w-xl text-xs text-danger">
                    Revoked {item.revokedAt ? formatDate(item.revokedAt) : ''}{item.revokeReason ? ` - ${item.revokeReason}` : ''}
                  </p>
                )}
                {item.latestAppeal && (
                  <p className="mt-2 max-w-xl rounded-sm border border-warning/20 bg-warning/5 p-2 text-xs text-warning">
                    Appeal {formatAppealStatus(item.latestAppeal)} {formatDate(item.latestAppeal.performedAt)}
                    {item.latestAppeal.notes ? ` - ${item.latestAppeal.notes}` : ''}
                  </p>
                )}
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-500">
                  <Send className="h-3.5 w-3.5" />
                  {formatDelivery(item.latestDelivery)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <span className="inline-flex items-center gap-2 rounded-sm bg-ink-50 px-2.5 py-1 text-xs text-ink-600">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Expires {formatDate(item.expiresAt)}
                </span>
                <CertificateActions item={item} canRevoke={canRevoke} canRenew={canRenew} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-sm border border-ink-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <p className="mt-4 font-display text-4xl font-medium text-ink-950">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{detail}</p>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function displayStatus(item: Certificate): string {
  if (item.status === 'VALID' && new Date(item.expiresAt) < new Date()) return 'EXPIRED';
  if (item.status === 'UNDER_APPEAL') return 'UNDER APPEAL';
  return item.status;
}

function statusVariant(item: Certificate): React.ComponentProps<typeof Badge>['variant'] {
  const status = displayStatus(item);
  if (status === 'VALID') return 'success';
  if (status === 'EXPIRED') return 'warning';
  if (status === 'REVOKED') return 'danger';
  if (status === 'UNDER APPEAL') return 'warning';
  return 'default';
}

function buildQuery({ q, status }: { q?: string; status?: StatusFilter }): string {
  const params = new URLSearchParams();
  if (q?.trim()) params.set('q', q.trim());
  if (status) params.set('status', status);
  const text = params.toString();
  return text ? `?${text}` : '';
}

function formatDelivery(delivery: Certificate['latestDelivery']): string {
  if (!delivery) return 'No delivery recorded';
  return `${formatChannel(delivery.channel)} ${formatDeliveryStatus(delivery.deliveryStatus)} ${formatDate(delivery.performedAt)}`;
}

function formatChannel(channel: string): string {
  if (channel === 'WHATSAPP') return 'WhatsApp';
  return channel.charAt(0) + channel.slice(1).toLowerCase();
}

function formatDeliveryStatus(status: string): string {
  if (status === 'QUEUED') return 'queued';
  if (status === 'NEEDS_PROVIDER') return 'needs provider setup';
  if (status === 'MISSING_RECIPIENT') return 'missing recipient';
  return 'recorded';
}

function formatAppealStatus(appeal: NonNullable<Certificate['latestAppeal']>): string {
  if (appeal.channel === 'APPEAL_APPROVED') return 'approved';
  if (appeal.channel === 'APPEAL_REJECTED') return 'rejected';
  return 'submitted';
}
