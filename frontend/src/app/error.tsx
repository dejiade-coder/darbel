'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-parchment px-6 py-10">
      <section className="mx-auto max-w-2xl rounded-sm border border-danger/25 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm bg-danger/10 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Something needs attention</p>
            <h1 className="mt-2 font-display text-3xl font-medium text-ink-950">This page could not finish loading</h1>
            <p className="mt-3 text-sm leading-6 text-ink-600">
              The app caught the problem before showing a raw error screen. Try again, or return to the dashboard and continue from there.
            </p>
            {error.digest && (
              <p className="mt-3 font-mono text-xs text-ink-500">Reference: {error.digest}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" onClick={reset}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Try again
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
