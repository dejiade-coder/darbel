import Link from 'next/link';
import type React from 'react';
import { ArrowLeft, Building2, ShieldCheck } from 'lucide-react';
import { SignupRequestForm } from './signup-request-form';

export const metadata = { title: 'Request access' };

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[#05383b] px-6 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <Link href="/login" className="inline-flex items-center text-sm font-medium text-white/75 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to login
          </Link>
          <p className="mt-10 text-[11px] uppercase tracking-[0.24em] text-white/55">Controlled onboarding</p>
          <h1 className="mt-3 font-display text-5xl font-medium leading-tight">Request Darbel access</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/75">
            Darbel is a compliance workspace, so accounts are created by authorized administrators. Submit your organization details and the platform team can provision the correct tenant and administrator safely.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-white/75">
            <Feature icon={Building2} title="New organization" text="Request a tenant workspace for a council, agency, or food-handler unit." />
            <Feature icon={ShieldCheck} title="Officer account" text="Ask your tenant administrator to invite you with the right role and permissions." />
          </div>
        </section>
        <SignupRequestForm />
      </div>
    </main>
  );
}

function Feature({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-sm border border-white/10 bg-white/5 p-4">
      <Icon className="mt-0.5 h-4 w-4 text-white" />
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 leading-6">{text}</p>
      </div>
    </div>
  );
}
