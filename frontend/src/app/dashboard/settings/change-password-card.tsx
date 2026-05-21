'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

interface Props {
  action: (formData: FormData) => Promise<{ error?: string; success?: string } | void>;
}

export function ChangePasswordCard({ action }: Props) {
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const r = await action(formData);
      if (r?.error) setError(r.error);
      if (r?.success) setSuccess(r.success);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>
          Choose a strong password. All other sessions will be ended.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}
          <Field label="Current password" required>
            <Input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </Field>
          <Field
            label="New password"
            hint="At least 12 characters, mixing case, digits and a symbol."
            required
          >
            <Input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={256}
              required
            />
          </Field>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
