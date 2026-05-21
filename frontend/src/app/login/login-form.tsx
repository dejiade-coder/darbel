'use client';

import { useFormStatus } from 'react-dom';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';

interface LoginFormProps {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  initialError?: string;
}

export function LoginForm({ action, initialError }: LoginFormProps) {
  const [error, setError] = useState<string | undefined>(initialError);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {error && (
        <Alert variant="danger" title="Sign-in failed">
          {error}
        </Alert>
      )}
      <Field label="Email" required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          maxLength={254}
        />
      </Field>
      <Field label="Password" required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={1}
          maxLength={256}
        />
      </Field>
      <SubmitButton isPending={isPending} />
    </form>
  );
}

function SubmitButton({ isPending }: { isPending: boolean }) {
  const { pending } = useFormStatus();
  const busy = pending || isPending;
  return (
    <Button type="submit" className="w-full" size="lg" disabled={busy}>
      {busy ? 'Verifying…' : 'Continue'}
    </Button>
  );
}
