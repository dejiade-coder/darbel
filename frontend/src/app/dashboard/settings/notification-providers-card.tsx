'use client';

import { useState, useTransition } from 'react';
import { Mail, MessageCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export type NotificationProviders = {
  emailEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  smtpPasswordConfigured: boolean;
  emailFromName: string | null;
  emailFromAddress: string | null;
  whatsAppEnabled: boolean;
  whatsAppPhoneNumberId: string | null;
  whatsAppBusinessAccountId: string | null;
  whatsAppAccessTokenConfigured: boolean;
  whatsAppDefaultCountryCode: string;
  updatedAt: string | null;
};

type Props = {
  initialSettings: NotificationProviders;
  action: (formData: FormData) => Promise<{ error?: string; success?: string } | void>;
};

export function NotificationProvidersCard({ initialSettings, action }: Props) {
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
      if (result?.success) setSuccess(result.success);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Providers</CardTitle>
        <CardDescription>
          Configure tenant email and WhatsApp providers. Secrets are stored but never shown again after saving.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-5">
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          <section className="space-y-4 rounded-sm border border-ink-100 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-ink-900">SMTP Email</p>
                  <p className="text-xs text-ink-500">Used for certificate and applicant communication emails.</p>
                </div>
              </div>
              <Badge variant={initialSettings.emailEnabled ? 'success' : 'outline'}>
                {initialSettings.emailEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input name="emailEnabled" type="checkbox" defaultChecked={initialSettings.emailEnabled} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Enable email sending
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="SMTP host">
                <Input name="smtpHost" defaultValue={initialSettings.smtpHost ?? ''} placeholder="smtp.example.com" />
              </Field>
              <Field label="SMTP port">
                <Input name="smtpPort" type="number" min={1} max={65535} defaultValue={initialSettings.smtpPort ?? ''} placeholder="587" />
              </Field>
              <Field label="SMTP username">
                <Input name="smtpUsername" defaultValue={initialSettings.smtpUsername ?? ''} autoComplete="off" />
              </Field>
              <Field label={initialSettings.smtpPasswordConfigured ? 'SMTP password (configured)' : 'SMTP password'}>
                <Input name="smtpPassword" type="password" autoComplete="new-password" placeholder={initialSettings.smtpPasswordConfigured ? 'Leave blank to keep current password' : ''} />
              </Field>
              <Field label="From name">
                <Input name="emailFromName" defaultValue={initialSettings.emailFromName ?? ''} placeholder="Darbel Compliance" />
              </Field>
              <Field label="From email">
                <Input name="emailFromAddress" type="email" defaultValue={initialSettings.emailFromAddress ?? ''} placeholder="certificates@example.com" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input name="smtpSecure" type="checkbox" defaultChecked={initialSettings.smtpSecure} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Use secure SMTP connection
            </label>
          </section>

          <section className="space-y-4 rounded-sm border border-ink-100 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-ink-900">WhatsApp Business API</p>
                  <p className="text-xs text-ink-500">Prepared for direct certificate and screening notifications.</p>
                </div>
              </div>
              <Badge variant={initialSettings.whatsAppEnabled ? 'success' : 'outline'}>
                {initialSettings.whatsAppEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input name="whatsAppEnabled" type="checkbox" defaultChecked={initialSettings.whatsAppEnabled} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Enable WhatsApp sending
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Phone number ID">
                <Input name="whatsAppPhoneNumberId" defaultValue={initialSettings.whatsAppPhoneNumberId ?? ''} autoComplete="off" />
              </Field>
              <Field label="Business account ID">
                <Input name="whatsAppBusinessAccountId" defaultValue={initialSettings.whatsAppBusinessAccountId ?? ''} autoComplete="off" />
              </Field>
              <Field label={initialSettings.whatsAppAccessTokenConfigured ? 'Access token (configured)' : 'Access token'}>
                <Input name="whatsAppAccessToken" type="password" autoComplete="new-password" placeholder={initialSettings.whatsAppAccessTokenConfigured ? 'Leave blank to keep current token' : ''} />
              </Field>
              <Field label="Default country code">
                <Input name="whatsAppDefaultCountryCode" defaultValue={initialSettings.whatsAppDefaultCountryCode || '234'} placeholder="234" />
              </Field>
            </div>
          </section>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-ink-500">
              {initialSettings.updatedAt ? `Last updated ${formatDate(initialSettings.updatedAt)}` : 'No provider settings saved yet.'}
            </p>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save providers'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
