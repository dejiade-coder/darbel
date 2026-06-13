'use client';

import { useState, useTransition } from 'react';
import { MessageSquareText } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type Template = {
  subject: string;
  body: string;
  whatsApp: string;
};

export type MessageTemplates = {
  paymentConfirmed: Template;
  uidIssued: Template;
  medicalScreeningReady: Template;
  certificateReady: Template;
  updatedAt: string | null;
};

type Props = {
  initialTemplates: MessageTemplates;
  action: (formData: FormData) => Promise<{ error?: string; success?: string } | void>;
};

const TEMPLATE_SECTIONS: Array<{ key: keyof Omit<MessageTemplates, 'updatedAt'>; title: string; detail: string }> = [
  { key: 'paymentConfirmed', title: 'Payment Confirmed', detail: 'Sent after registrar payment approval.' },
  { key: 'uidIssued', title: 'UID Issued', detail: 'Sent when the handler UID is available.' },
  { key: 'medicalScreeningReady', title: 'Medical Screening Notice', detail: 'Sent when the handler should proceed to screening.' },
  { key: 'certificateReady', title: 'Certificate Ready', detail: 'Sent when a certificate is issued or shared.' },
];

export function MessageTemplatesCard({ initialTemplates, action }: Props) {
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
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <MessageSquareText className="h-4 w-4 text-accent" />
          <div>
            <CardTitle>Applicant Message Templates</CardTitle>
            <CardDescription>
              Standardize email and WhatsApp content. Available tokens: {'{{handlerName}}'}, {'{{uid}}'}, {'{{verificationUrl}}'}.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-5">
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          <div className="grid gap-4 xl:grid-cols-2">
            {TEMPLATE_SECTIONS.map((section) => {
              const template = initialTemplates[section.key];
              return (
                <section key={section.key} className="space-y-3 rounded-sm border border-ink-100 p-4">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{section.title}</p>
                    <p className="text-xs text-ink-500">{section.detail}</p>
                  </div>
                  <Field label="Email subject">
                    <Input name={`${section.key}.subject`} defaultValue={template.subject} maxLength={160} />
                  </Field>
                  <label className="grid gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">Email body</span>
                    <textarea
                      name={`${section.key}.body`}
                      defaultValue={template.body}
                      rows={4}
                      maxLength={3000}
                      className="w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">WhatsApp text</span>
                    <textarea
                      name={`${section.key}.whatsApp`}
                      defaultValue={template.whatsApp}
                      rows={3}
                      maxLength={1200}
                      className="w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                </section>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-ink-500">
              {initialTemplates.updatedAt ? `Last updated ${formatDate(initialTemplates.updatedAt)}` : 'Default templates are currently active.'}
            </p>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save templates'}
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
