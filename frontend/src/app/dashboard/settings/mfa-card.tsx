'use client';

import { useState, useTransition } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Props {
  enabled: boolean;
  startAction: () => Promise<{ error?: string; secret?: string; otpauthUrl?: string }>;
  confirmAction: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: string } | void>;
  disableAction: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: string } | void>;
}

export function MfaCard({ enabled, startAction, confirmAction, disableAction }: Props) {
  const [enrollment, setEnrollment] = useState<{
    secret: string;
    otpauthUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  async function onStart() {
    setError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const r = await startAction();
      if (r.error) setError(r.error);
      else if (r.secret && r.otpauthUrl) {
        setEnrollment({ secret: r.secret, otpauthUrl: r.otpauthUrl });
      }
    });
  }

  async function onConfirm(formData: FormData) {
    setError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const r = await confirmAction(formData);
      if (r?.error) setError(r.error);
      if (r?.success) {
        setSuccess(r.success);
        setEnrollment(null);
      }
    });
  }

  async function onDisable(formData: FormData) {
    setError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const r = await disableAction(formData);
      if (r?.error) setError(r.error);
      if (r?.success) setSuccess(r.success);
    });
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Multi-factor authentication</CardTitle>
            <CardDescription>Add a second step to sign-in using an authenticator app.</CardDescription>
          </div>
          {enabled ? (
            <Badge variant="success" className="gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Enabled
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1.5">
              <ShieldOff className="h-3 w-3" />
              Disabled
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" className="mb-4">
            {success}
          </Alert>
        )}

        {enabled ? (
          <form action={onDisable} className="space-y-4">
            <p className="text-sm text-ink-600">
              To disable MFA, enter a current 6-digit code from your authenticator app to confirm.
            </p>
            <Field label="Authentication code" required>
              <Input
                name="code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123 456"
                className="font-mono tracking-[0.3em]"
                required
              />
            </Field>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? 'Disabling…' : 'Disable MFA'}
            </Button>
          </form>
        ) : enrollment ? (
          <form action={onConfirm} className="space-y-4">
            <p className="text-sm text-ink-700">
              Scan this otpauth URL into Google Authenticator, 1Password, or any compatible app —
              or enter the secret manually.
            </p>
            <div className="space-y-2 rounded-sm border border-ink-200 bg-ink-50/40 p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
                Secret (manual entry)
              </p>
              <p className="break-all font-mono text-sm text-ink-900">{enrollment.secret}</p>
              <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
                otpauth URL
              </p>
              <p className="break-all font-mono text-xs text-ink-600">{enrollment.otpauthUrl}</p>
            </div>
            <Field
              label="Enter the 6-digit code shown in your app"
              hint="The code refreshes every 30 seconds."
              required
            >
              <Input
                name="code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123 456"
                className="font-mono tracking-[0.3em]"
                autoFocus
                required
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Verifying…' : 'Enable MFA'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEnrollment(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-600">
              You will scan a code into an authenticator app, then enter the 6-digit code shown
              to confirm enrolment.
            </p>
            <Button onClick={onStart} disabled={isPending}>
              {isPending ? 'Starting…' : 'Enable MFA'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
