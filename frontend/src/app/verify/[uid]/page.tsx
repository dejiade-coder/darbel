import Link from 'next/link';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Officer scan required' };

export default async function VerifyPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;

  return (
    <main className="grid min-h-screen place-items-center bg-parchment bg-paper px-6 py-10">
      <section className="w-full max-w-xl rounded-sm border border-ink-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Authorized officers only</p>
            <h1 className="mt-1 font-display text-3xl font-medium text-ink-950">Certificate scan is protected</h1>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-ink-600">
          Handler details are only visible inside the Darbel officer workspace. Sign in with an authorized account, then scan the barcode or open the officer scan record for this UID.
        </p>
        <div className="mt-5 rounded-sm border border-ink-100 bg-ink-50/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">Certificate UID</p>
          <p className="mt-1 font-mono text-sm font-semibold text-ink-900">{uid.toUpperCase()}</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/login?redirect=/dashboard/certificates/${encodeURIComponent(uid)}/scan`}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Officer sign in
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Back to login</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
