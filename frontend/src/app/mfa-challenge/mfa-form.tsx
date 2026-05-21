'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';

interface MfaFormProps {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  initialError?: string;
}

export function MfaForm({ action, initialError }: MfaFormProps) {
  const [error, setError] = useState<string | undefined>(initialError);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const r = await action(formData);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {error && (
        <Alert variant="danger" title="Verification failed">
          {error}
        </Alert>
      )}
      <Field label="Authentication code" required>
        <Input
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          pattern="\d{6}"
          maxLength={6}
          placeholder="123 456"
          className="font-mono text-lg tracking-[0.3em] text-center"
          required
        />
      </Field>
      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? 'Verifying…' : 'Verify and continue'}
      </Button>
      <div className="pt-2 text-center">
        <Link
          href="/login"
          className="text-xs text-ink-500 underline-offset-2 hover:text-accent hover:underline"
        >
          Use a different account
        </Link>
      </div>
    </form>
  );
}
