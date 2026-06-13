'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export default function DashboardError({
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
    <div className="space-y-5">
      <div className="rounded-sm border border-ink-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm bg-danger/10 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Recovery</p>
            <h1 className="mt-2 font-display text-3xl font-medium text-ink-950">This workspace view could not load</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">
              The failure has been contained so operators can recover without seeing a raw runtime screen.
            </p>
          </div>
        </div>
      </div>

      <Alert variant="danger" title="Action needed">
        Try again. If it repeats, use the reference below when reporting the issue.
      </Alert>

      {error.digest && (
        <p className="rounded-sm border border-ink-200 bg-ink-50 p-3 font-mono text-xs text-ink-600">
          Reference: {error.digest}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={reset}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
