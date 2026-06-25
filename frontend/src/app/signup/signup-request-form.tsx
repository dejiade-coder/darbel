'use client';

import { useState } from 'react';
import type React from 'react';
import { Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SignupRequestForm() {
  const [sent, setSent] = useState(false);

  function submit(formData: FormData) {
    const organization = String(formData.get('organization') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const message = String(formData.get('message') ?? '').trim();
    const body = [
      `Organization: ${organization}`,
      `Requester: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || 'Not provided'}`,
      '',
      message || 'Please create a Darbel tenant/access request for this organization.',
    ].join('\n');
    const href = `mailto:admin@branddarrow.com?subject=${encodeURIComponent(`Darbel access request - ${organization || name}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setSent(true);
  }

  return (
    <form action={submit} className="rounded-sm border border-white/15 bg-white p-6 text-ink-900 shadow-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#05383b] text-white">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-medium">Signup request</h2>
          <p className="text-sm text-ink-500">A platform administrator will complete account creation.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Organization"><input name="organization" required placeholder="EHSD" className={fieldClassName} /></Field>
        <Field label="Full name"><input name="name" required placeholder="Applicant name" className={fieldClassName} /></Field>
        <Field label="Email"><input name="email" type="email" required placeholder="name@example.com" className={fieldClassName} /></Field>
        <Field label="Phone"><input name="phone" placeholder="080..." className={fieldClassName} /></Field>
      </div>
      <label className="mt-3 grid gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">Request note</span>
        <textarea name="message" rows={4} className="rounded-sm border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15" placeholder="Tell us what access you need." />
      </label>
      {sent && <p className="mt-3 text-sm text-success">Your email client should open with the request ready to send.</p>}
      <Button type="submit" className="mt-5 w-full">
        <Send className="mr-2 h-4 w-4" />
        Prepare request
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactElement<HTMLInputElement> }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">{label}</span>
      {children}
    </label>
  );
}

const fieldClassName = 'rounded-sm border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15';
