import { ShieldCheck, ShieldX } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export const metadata = { title: 'Verify certificate' };

type Verification = {
  uid: string;
  handlerName: string;
  tradeCategory: string | null;
  issuedAt: string;
  expiresAt: string;
  status: string;
};

export default async function VerifyPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  let result: Verification | null = null;
  try {
    const res = await fetch(`${API_BASE}/verify/${encodeURIComponent(uid)}`, { cache: 'no-store' });
    if (res.ok) result = (await res.json()) as Verification;
  } catch {
    result = null;
  }

  const valid = result?.status === 'VALID';
  return (
    <main className="min-h-screen bg-parchment bg-paper px-6 py-10">
      <section className="mx-auto max-w-xl rounded-sm border border-ink-200 bg-white p-6">
        <div className="flex items-center gap-3">
          {valid ? <ShieldCheck className="h-6 w-6 text-success" /> : <ShieldX className="h-6 w-6 text-danger" />}
          <h1 className="font-display text-3xl font-medium text-ink-900">Certificate verification</h1>
        </div>
        {!result && <p className="mt-6 text-sm text-danger">No certificate was found for this UID.</p>}
        {result && (
          <div className="mt-6 space-y-3 text-sm">
            <Row label="UID" value={result.uid} mono />
            <Row label="Handler" value={result.handlerName} />
            <Row label="Trade" value={result.tradeCategory || 'Not listed'} />
            <Row label="Status" value={result.status} />
            <Row label="Issued" value={formatDate(result.issuedAt)} />
            <Row label="Expires" value={formatDate(result.expiresAt)} />
          </div>
        )}
      </section>
    </main>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-100 pb-3">
      <span className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</span>
      <span className={mono ? 'font-mono text-ink-900' : 'text-ink-900'}>{value}</span>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
