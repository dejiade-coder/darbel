'use client';

import { useState, useTransition } from 'react';
import type React from 'react';
import { AlertTriangle, CheckCircle2, Mail, MessageCircle } from 'lucide-react';
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
  const emailStatus = getEmailStatus(initialSettings);
  const whatsAppStatus = getWhatsAppStatus(initialSettings);

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

          <div className="grid gap-3 md:grid-cols-2">
            <ProviderSummary
              icon={Mail}
              title="Email readiness"
              status={emailStatus}
              detail={emailStatus.ready ? 'SMTP is ready for outbound certificate emails.' : emailStatus.missing.join(', ')}
            />
            <ProviderSummary
              icon={MessageCircle}
              title="WhatsApp readiness"
              status={whatsAppStatus}
              detail={whatsAppStatus.ready ? 'WhatsApp Business settings are ready for message delivery.' : whatsAppStatus.missing.join(', ')}
            />
          </div>

          <section className="space-y-4 rounded-sm border border-ink-100 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-ink-900">SMTP Email</p>
                  <p className="text-xs text-ink-500">Used for certificate and applicant communication emails.</p>
                </div>
              </div>
              <Badge variant={emailStatus.badgeVariant}>{emailStatus.label}</Badge>
            </div>
            <ProviderChecklist
              items={[
                { label: 'Enabled', ready: initialSettings.emailEnabled },
                { label: 'SMTP host', ready: Boolean(initialSettings.smtpHost) },
                { label: 'SMTP port', ready: Boolean(initialSettings.smtpPort) },
                { label: 'From email', ready: Boolean(initialSettings.emailFromAddress) },
                { label: 'Password saved', ready: initialSettings.smtpPasswordConfigured },
              ]}
            />
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input name="emailEnabled" type="checkbox" defaultChecked={initialSettings.emailEnabled} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Enable email sending
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="SMTP host">
                <Input name="smtpHost" defaultValue={initialSettings.smtpHost ?? ''} placeholder="smtp.example.com" autoComplete="off" />
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
            {!emailStatus.ready && initialSettings.emailEnabled && (
              <p className="rounded-sm border border-warning/25 bg-warning/5 p-3 text-xs leading-5 text-warning">
                Email is enabled but incomplete. Fill the missing fields above before relying on email delivery.
              </p>
            )}
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
              <Badge variant={whatsAppStatus.badgeVariant}>{whatsAppStatus.label}</Badge>
            </div>
            <ProviderChecklist
              items={[
                { label: 'Enabled', ready: initialSettings.whatsAppEnabled },
                { label: 'Phone number ID', ready: Boolean(initialSettings.whatsAppPhoneNumberId) },
                { label: 'Business account ID', ready: Boolean(initialSettings.whatsAppBusinessAccountId) },
                { label: 'Access token saved', ready: initialSettings.whatsAppAccessTokenConfigured },
                { label: 'Country code', ready: Boolean(initialSettings.whatsAppDefaultCountryCode) },
              ]}
            />
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
            {!whatsAppStatus.ready && initialSettings.whatsAppEnabled && (
              <p className="rounded-sm border border-warning/25 bg-warning/5 p-3 text-xs leading-5 text-warning">
                WhatsApp is enabled but incomplete. Add the missing Business API values before relying on WhatsApp delivery.
              </p>
            )}
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

type ProviderStatus = {
  ready: boolean;
  label: string;
  badgeVariant: React.ComponentProps<typeof Badge>['variant'];
  missing: string[];
};

function ProviderSummary({
  icon: Icon,
  title,
  status,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  status: ProviderStatus;
  detail: string;
}) {
  return (
    <div className="rounded-sm border border-ink-100 bg-ink-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-sm bg-white text-accent">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">{title}</p>
            <p className="mt-1 text-xs leading-5 text-ink-600">{detail}</p>
          </div>
        </div>
        <Badge variant={status.badgeVariant}>{status.label}</Badge>
      </div>
    </div>
  );
}

function ProviderChecklist({ items }: { items: Array<{ label: string; ready: boolean }> }) {
  return (
    <div className="grid gap-2 rounded-sm border border-ink-100 bg-ink-50/50 p-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs text-ink-700">
          {item.ready ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function getEmailStatus(settings: NotificationProviders): ProviderStatus {
  if (!settings.emailEnabled) {
    return {
      ready: false,
      label: 'Disabled',
      badgeVariant: 'outline',
      missing: ['Email sending is disabled'],
    };
  }
  const missing = [
    missingWhen(!settings.smtpHost, 'SMTP host'),
    missingWhen(!settings.smtpPort, 'SMTP port'),
    missingWhen(!settings.emailFromAddress, 'from email'),
    missingWhen(!settings.smtpPasswordConfigured, 'SMTP password'),
  ].filter(Boolean) as string[];
  return {
    ready: missing.length === 0,
    label: missing.length === 0 ? 'Ready' : 'Incomplete',
    badgeVariant: missing.length === 0 ? 'success' : 'warning',
    missing,
  };
}

function getWhatsAppStatus(settings: NotificationProviders): ProviderStatus {
  if (!settings.whatsAppEnabled) {
    return {
      ready: false,
      label: 'Disabled',
      badgeVariant: 'outline',
      missing: ['WhatsApp sending is disabled'],
    };
  }
  const missing = [
    missingWhen(!settings.whatsAppPhoneNumberId, 'phone number ID'),
    missingWhen(!settings.whatsAppBusinessAccountId, 'business account ID'),
    missingWhen(!settings.whatsAppAccessTokenConfigured, 'access token'),
    missingWhen(!settings.whatsAppDefaultCountryCode, 'default country code'),
  ].filter(Boolean) as string[];
  return {
    ready: missing.length === 0,
    label: missing.length === 0 ? 'Ready' : 'Incomplete',
    badgeVariant: missing.length === 0 ? 'success' : 'warning',
    missing,
  };
}

function missingWhen(condition: boolean, label: string): string | null {
  return condition ? label : null;
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
