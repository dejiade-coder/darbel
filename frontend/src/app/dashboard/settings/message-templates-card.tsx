'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Eye, MessageSquareText, Triangle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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

const TEMPLATE_SECTIONS: Array<{
  key: keyof Omit<MessageTemplates, 'updatedAt'>;
  title: string;
  detail: string;
  recommendedTokens: string[];
}> = [
  { key: 'paymentConfirmed', title: 'Payment Confirmed', detail: 'Sent after registrar payment approval.', recommendedTokens: ['{{handlerName}}', '{{uid}}'] },
  { key: 'uidIssued', title: 'UID Issued', detail: 'Sent when the handler UID is available.', recommendedTokens: ['{{handlerName}}', '{{uid}}'] },
  { key: 'medicalScreeningReady', title: 'Medical Screening Notice', detail: 'Sent when the handler should proceed to screening.', recommendedTokens: ['{{handlerName}}', '{{uid}}'] },
  { key: 'certificateReady', title: 'Certificate Ready', detail: 'Sent when a certificate is issued or shared.', recommendedTokens: ['{{handlerName}}', '{{uid}}'] },
];

const TOKENS = ['{{handlerName}}', '{{uid}}'];
const SAMPLE_VALUES: Record<string, string> = {
  '{{handlerName}}': 'Oladimeji Adegbite',
  '{{uid}}': 'BBH-SAMPLE-7',
};

export function MessageTemplatesCard({ initialTemplates, action }: Props) {
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<MessageTemplates>(initialTemplates);

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
              Standardize email and WhatsApp content. Available tokens: {'{{handlerName}}'} and {'{{uid}}'}. Printed certificates use the protected officer barcode for handler details.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-5">
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          <div className="rounded-sm border border-ink-100 bg-ink-50/60 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-900">Available tokens</p>
                <p className="mt-1 text-xs leading-5 text-ink-600">
                  Tokens are replaced automatically when a message is sent. Keep UID in every operational message so handlers and officers can identify the record.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TOKENS.map((token) => (
                  <code key={token} className="rounded-sm border border-ink-200 bg-white px-2 py-1 font-mono text-xs text-ink-700">{token}</code>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {TEMPLATE_SECTIONS.map((section) => {
              const template = templates[section.key];
              const tokenHealth = getTokenHealth(template, section.recommendedTokens);
              return (
                <section key={section.key} className="space-y-3 rounded-sm border border-ink-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{section.title}</p>
                      <p className="text-xs text-ink-500">{section.detail}</p>
                    </div>
                    <Badge variant={tokenHealth.missing.length ? 'warning' : 'success'}>
                      {tokenHealth.missing.length ? 'Check tokens' : 'Tokens OK'}
                    </Badge>
                  </div>
                  <TokenChecklist recommended={section.recommendedTokens} content={`${template.subject}\n${template.body}\n${template.whatsApp}`} />
                  <Field label="Email subject">
                    <Input
                      name={`${section.key}.subject`}
                      value={template.subject}
                      onChange={(event) => updateTemplate(section.key, 'subject', event.target.value)}
                      maxLength={160}
                    />
                  </Field>
                  <label className="grid gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">Email body</span>
                    <textarea
                      name={`${section.key}.body`}
                      value={template.body}
                      onChange={(event) => updateTemplate(section.key, 'body', event.target.value)}
                      rows={4}
                      maxLength={3000}
                      className="w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">WhatsApp text</span>
                    <textarea
                      name={`${section.key}.whatsApp`}
                      value={template.whatsApp}
                      onChange={(event) => updateTemplate(section.key, 'whatsApp', event.target.value)}
                      rows={3}
                      maxLength={1200}
                      className="w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                  <PreviewPanel template={template} />
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

  function updateTemplate(
    key: keyof Omit<MessageTemplates, 'updatedAt'>,
    field: keyof Template,
    value: string,
  ) {
    setTemplates((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [field]: value,
      },
    }));
  }
}

function TokenChecklist({ recommended, content }: { recommended: string[]; content: string }) {
  return (
    <div className="grid gap-2 rounded-sm border border-ink-100 bg-ink-50/50 p-3 sm:grid-cols-3">
      {recommended.map((token) => {
        const present = content.includes(token);
        return (
          <div key={token} className="flex items-center gap-2 text-xs text-ink-700">
            {present ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Triangle className="h-3.5 w-3.5 text-warning" />}
            <span className="font-mono">{token}</span>
          </div>
        );
      })}
    </div>
  );
}

function PreviewPanel({ template }: { template: Template }) {
  return (
    <div className="rounded-sm border border-ink-100 bg-ink-50/50 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Eye className="h-4 w-4 text-accent" />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Sample preview</p>
      </div>
      <div className="grid gap-3">
        <div className="rounded-sm border border-ink-100 bg-white p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500">Email</p>
          <p className="mt-1 text-sm font-semibold text-ink-900">{renderSample(template.subject) || 'No subject'}</p>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-ink-600">{renderSample(template.body) || 'No email body'}</p>
        </div>
        <div className="rounded-sm border border-ink-100 bg-white p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500">WhatsApp</p>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-ink-700">{renderSample(template.whatsApp) || 'No WhatsApp message'}</p>
        </div>
      </div>
    </div>
  );
}

function getTokenHealth(template: Template, recommended: string[]): { missing: string[] } {
  const content = `${template.subject}\n${template.body}\n${template.whatsApp}`;
  return { missing: recommended.filter((token) => !content.includes(token)) };
}

function renderSample(value: string): string {
  return TOKENS.reduce((text, token) => text.replaceAll(token, SAMPLE_VALUES[token] ?? token), value);
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
