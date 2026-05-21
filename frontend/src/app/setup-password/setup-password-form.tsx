'use client';

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface Props {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  initialError?: string;
}

const RULES = [
  { id: 'length', label: 'At least 12 characters', test: (s: string) => s.length >= 12 },
  { id: 'lower', label: 'A lowercase letter', test: (s: string) => /[a-z]/.test(s) },
  { id: 'upper', label: 'An uppercase letter', test: (s: string) => /[A-Z]/.test(s) },
  { id: 'digit', label: 'A digit', test: (s: string) => /\d/.test(s) },
  { id: 'symbol', label: 'A symbol', test: (s: string) => /[^A-Za-z0-9]/.test(s) },
];

export function SetupPasswordForm({ action, initialError }: Props) {
  const [error, setError] = useState<string | undefined>(initialError);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isPending, startTransition] = useTransition();

  const ruleResults = RULES.map((r) => ({ ...r, ok: r.test(password) }));
  const allOk = ruleResults.every((r) => r.ok);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = allOk && matches && !isPending;

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
        <Alert variant="danger" title="Could not set password">
          {error}
        </Alert>
      )}
      <Field label="New password" required>
        <Input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          maxLength={256}
          required
        />
      </Field>
      <Field label="Confirm new password" required>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={12}
          maxLength={256}
          required
        />
      </Field>

      <ul className="space-y-1.5 rounded-sm border border-ink-100 bg-ink-50/40 p-3">
        {ruleResults.map((r) => (
          <li
            key={r.id}
            className={cn(
              'flex items-center gap-2 text-xs',
              r.ok ? 'text-success' : 'text-ink-500',
            )}
          >
            {r.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            <span>{r.label}</span>
          </li>
        ))}
        <li
          className={cn(
            'flex items-center gap-2 text-xs',
            matches ? 'text-success' : 'text-ink-500',
          )}
        >
          {matches ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          <span>Both passwords match</span>
        </li>
      </ul>

      <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
        {isPending ? 'Saving…' : 'Save and continue'}
      </Button>
    </form>
  );
}
