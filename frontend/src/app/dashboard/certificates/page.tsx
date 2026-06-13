import { headers } from 'next/headers';
import { Send, Search, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
    performedAt: string;
  } | null;
};

export default async function CertificatesPage({ searchParams }: { searchParams?: { q?: string } }) {
  const q = searchParams?.q?.trim() ?? '';
  let items: Certificate[] = [];
  let loadError = '';
  const hdrs = await headers();
  const actor = await readActorFromAccessToken();
  const canRevoke = actor?.permissions.includes('certificate.revoke') ?? false;
  const canRenew = actor?.permissions.includes('certificate.issue') ?? false;
  const host = hdrs.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;
  try {
    const result = await apiFetch<{ items: Certificate[] }>(
      `/certificates${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      { authenticated: true },
    );
    items = result.items;
  } catch (error) {
    if (error instanceof ApiError) loadError = error.message;
    else throw error;
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-ink-200 pb-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Phase 3</p>
        <h1 className="mt-1 font-display text-4xl font-medium text-ink-900">Certificates</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-600">Issued compliance certificates and verification UIDs.</p>
      </header>
      <form action="/dashboard/certificates" className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input name="q" defaultValue={q} className="pl-9" placeholder="Search by UID, name, or phone" />
      </form>
      <section className="rounded-sm border border-ink-200 bg-white">
        {loadError && <p className="p-5 text-sm text-danger">{loadError}</p>}
        {!loadError && items.length === 0 && <p className="p-5 text-sm text-ink-500">No certificates issued yet.</p>}
        <div className="divide-y divide-ink-100">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-ink-900">{item.handlerName}</p>
                <p className="font-mono text-xs text-ink-500">{item.uid}</p>
                <p className="text-xs text-ink-500">{item.tradeCategory || 'No category'}</p>
                {item.status === 'REVOKED' && (
                  <p className="mt-2 max-w-xl text-xs text-danger">
                    Revoked {item.revokedAt ? formatDate(item.revokedAt) : ''}{item.revokeReason ? ` - ${item.revokeReason}` : ''}
                  </p>
                )}
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-500">
                  <Send className="h-3.5 w-3.5" />
                  {formatDelivery(item.latestDelivery)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className={item.status === 'REVOKED' ? 'h-4 w-4 text-danger' : 'h-4 w-4 text-success'} />
                  {item.status} - expires {formatDate(item.expiresAt)}
                </span>
                <CertificateActions item={item} origin={origin} canRevoke={canRevoke} canRenew={canRenew} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatDelivery(delivery: Certificate['latestDelivery']): string {
  if (!delivery) return 'No delivery recorded';
  return `${formatChannel(delivery.channel)} recorded ${formatDate(delivery.performedAt)}`;
}

function formatChannel(channel: string): string {
  if (channel === 'WHATSAPP') return 'WhatsApp';
  return channel.charAt(0) + channel.slice(1).toLowerCase();
}
