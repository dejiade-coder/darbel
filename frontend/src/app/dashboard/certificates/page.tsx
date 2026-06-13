import Link from 'next/link';
import { headers } from 'next/headers';
import { ExternalLink, Mail, MessageCircle, Printer, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api/server-client';

export const metadata = { title: 'Certificates' };

type Certificate = {
  id: string;
  uid: string;
  handlerName: string;
  tradeCategory: string | null;
  status: string;
  issuedAt: string;
  expiresAt: string;
};

export default async function CertificatesPage({ searchParams }: { searchParams?: { q?: string } }) {
  const q = searchParams?.q?.trim() ?? '';
  let items: Certificate[] = [];
  let loadError = '';
  const hdrs = await headers();
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
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  {item.status} - expires {formatDate(item.expiresAt)}
                </span>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/certificates/${encodeURIComponent(item.uid)}/print`}>
                    <Printer className="mr-2 h-3.5 w-3.5" />
                    Print
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/verify/${encodeURIComponent(item.uid)}`} target="_blank">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Verify
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={buildMailLink(item, origin)}>
                    <Mail className="mr-2 h-3.5 w-3.5" />
                    Email
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={buildWhatsAppLink(item, origin)} target="_blank">
                    <MessageCircle className="mr-2 h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                </Button>
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

function buildMailLink(item: Certificate, origin: string): string {
  const verifyUrl = `${origin}/verify/${encodeURIComponent(item.uid)}`;
  const subject = `Darbel certificate ${item.uid}`;
  const body = [
    `Hello ${item.handlerName},`,
    '',
    `Your Darbel compliance certificate is ready.`,
    `Certificate UID: ${item.uid}`,
    `Verify it here: ${verifyUrl}`,
  ].join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildWhatsAppLink(item: Certificate, origin: string): string {
  const verifyUrl = `${origin}/verify/${encodeURIComponent(item.uid)}`;
  const text = [
    `Darbel compliance certificate for ${item.handlerName}`,
    `UID: ${item.uid}`,
    `Verify: ${verifyUrl}`,
  ].join('\n');
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
