'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, CheckCircle2, FileUp, Save, Send, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveRegistrationAction, type RegistrationStatus } from './actions';

const DRAFT_KEY = 'darbel.registrationDraft';

const tradeCategories = [
  'Food Vendor',
  'Hairdresser',
  'Barber',
  'Creche',
  'Cook / Caterer',
  'Meat Handler',
  'Bakery Worker',
  'Restaurant Staff',
  'Market Food Stall',
];

type FormState = {
  registrationDate: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  gender: string;
  tradeCategory: string;
  businessName: string;
  address: string;
  passportPhoto: boolean;
};

const emptyForm: FormState = {
  registrationDate: '',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  gender: '',
  tradeCategory: '',
  businessName: '',
  address: '',
  passportPhoto: false,
};

type RegistrarContext = {
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
};

export type EditableRegistration = {
  id: string;
  registrarName: string;
  registrarEmail: string;
  registrarPhone: string | null;
  registrationDate: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  tradeCategory: string | null;
  businessName: string | null;
  businessAddress: string | null;
  passportPhotoReceived: boolean;
  status: RegistrationStatus;
};

export function NewRegistrationForm({
  registrar,
  registration,
}: {
  registrar: RegistrarContext;
  registration?: EditableRegistration;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [registrationId, setRegistrationId] = useState<string | undefined>(registration?.id);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [status, setStatus] = useState(registration?.status === 'SUBMITTED_FOR_REVIEW' ? 'Submitted for review' : 'Draft');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(registration);

  useEffect(() => {
    if (registration) {
      setForm(fromRegistration(registration));
      setRegistrationId(registration.id);
      setStatus(registration.status === 'SUBMITTED_FOR_REVIEW' ? 'Submitted for review' : 'Draft');
      return;
    }

    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      setForm((current) => ({
        ...current,
        registrationDate: today(),
      }));
      return;
    }
    try {
      setForm({
        ...emptyForm,
        registrationDate: today(),
        ...JSON.parse(raw),
      });
      const parsed = JSON.parse(raw) as { registrationId?: string; status?: string };
      setRegistrationId(parsed.registrationId);
      if (parsed.status) setStatus(parsed.status);
      setNotice({ type: 'success', message: 'Draft restored from this browser.' });
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [registration]);

  const fullName = useMemo(
    () => [form.firstName, form.lastName].filter(Boolean).join(' ') || 'Not entered',
    [form.firstName, form.lastName],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  async function saveDraft() {
    setIsSaving(true);
    try {
      const saved = await saveRegistrationAction(toPayload('DRAFT'), registrationId);
      const savedId = saved.id || registrationId;
      setRegistrationId(savedId);
      setStatus('Draft saved');
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ ...form, registrationId: savedId, status: 'Draft saved' }),
      );
      setNotice({ type: 'success', message: 'Draft saved to the backend database.' });
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save draft.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function submitForReview() {
    const missing = [
      ['First name', form.firstName],
      ['Last name', form.lastName],
      ['Phone number', form.phone],
      ['Registration date', form.registrationDate],
      ['Trade category', form.tradeCategory],
      ['Business address', form.address],
    ].filter(([, value]) => !String(value).trim());

    if (missing.length > 0) {
      setNotice({
        type: 'error',
        message: `Complete these fields before submitting: ${missing.map(([label]) => label).join(', ')}.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await saveRegistrationAction(toPayload('SUBMITTED_FOR_REVIEW'), registrationId);
      const savedId = saved.id || registrationId;
      setRegistrationId(savedId);
      setStatus('Submitted for review');
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ ...form, registrationId: savedId, status: 'Submitted for review' }),
      );
      setNotice({
        type: 'success',
        message: 'Registration submitted for review and saved to the backend database.',
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to submit registration.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function toPayload(nextStatus: RegistrationStatus) {
    return {
      registrationDate: form.registrationDate,
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      email: form.email,
      gender: form.gender,
      tradeCategory: form.tradeCategory,
      businessName: form.businessName,
      businessAddress: form.address,
      passportPhotoReceived: form.passportPhoto,
      status: nextStatus,
    };
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-ink-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link href="/dashboard/registrations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Registrations
            </Link>
          </Button>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Intake record</p>
          <h1 className="mt-1 font-display text-4xl font-medium text-ink-900">
            {isEditing ? 'Edit registration' : 'New registration'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            Capture a food handler record for review before payment and medical screening.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={saveDraft} disabled={isSaving || isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save draft'}
          </Button>
          <Button type="button" onClick={submitForReview} disabled={isSaving || isSubmitting}>
            <Send className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Submitting...' : 'Submit for review'}
          </Button>
        </div>
      </header>

      {notice && (
        <div
          className={`rounded-sm border p-4 text-sm ${
            notice.type === 'success'
              ? 'border-success/25 bg-success/5 text-success'
              : 'border-danger/25 bg-danger/5 text-danger'
          }`}
          role="status"
        >
          {notice.message}
        </div>
      )}

      <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]" onSubmit={(event) => event.preventDefault()}>
        <div className="space-y-6">
          <Section
            icon={CalendarDays}
            title="Registrar details"
            description="Captured automatically from the active logged-in user."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Registrar name" value={registrar.name || 'Current user'} />
              <ReadOnlyField label="Registrar email" value={registrar.email || 'Not available'} />
              <ReadOnlyField label="Registrar phone" value={registrar.phone || 'Not provided'} />
              <ReadOnlyField label="User status" value={registrar.isActive ? 'Active' : 'Inactive'} />
              <Field label="Registration date" id="registrationDate" type="date" value={form.registrationDate} onChange={(value) => update('registrationDate', value)} />
            </div>
          </Section>

          <Section
            icon={UserRound}
            title="Personal details"
            description="Basic identity details used for the handler registry."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="First name" id="firstName" value={form.firstName} onChange={(value) => update('firstName', value)} placeholder="Amina" />
              <Field label="Last name" id="lastName" value={form.lastName} onChange={(value) => update('lastName', value)} placeholder="Yusuf" />
              <Field label="Phone number" id="phone" value={form.phone} onChange={(value) => update('phone', value)} placeholder="+234 803 000 0000" />
              <Field label="Email address" id="email" type="email" value={form.email} onChange={(value) => update('email', value)} placeholder="handler@example.com" />
              <SelectField label="Gender" id="gender" value={form.gender} options={['Female', 'Male', 'Prefer not to say']} onChange={(value) => update('gender', value)} />
            </div>
          </Section>

          <Section
            icon={CalendarDays}
            title="Trade and location"
            description="Registration scope for jurisdiction, fee, and later medical routing."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Trade category" id="tradeCategory" value={form.tradeCategory} options={tradeCategories} onChange={(value) => update('tradeCategory', value)} />
              <Field label="Business name (optional)" id="businessName" value={form.businessName} onChange={(value) => update('businessName', value)} placeholder="Amina Catering Services" />
              <div className="md:col-span-2">
                <Label htmlFor="address">Business address</Label>
                <textarea
                  id="address"
                  rows={3}
                  value={form.address}
                  onChange={(event) => update('address', event.target.value)}
                  className="mt-2 w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                  placeholder="Shop number, street, market, area, city"
                />
              </div>
            </div>
          </Section>

          <Section
            icon={FileUp}
            title="Documents"
            description="Mark required documents during intake. Upload wiring can follow the backend storage slice."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <DocumentCheck label="Passport photo" checked={form.passportPhoto} onChange={(checked) => update('passportPhoto', checked)} />
            </div>
          </Section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-sm border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-ink-900">Registration summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Status" value={status} />
              <SummaryRow label="Registrar" value={registrar.name || registrar.email || 'Current user'} />
              <SummaryRow label="Date" value={form.registrationDate || 'Not selected'} />
              <SummaryRow label="Handler" value={fullName} />
              <SummaryRow label="Category" value={form.tradeCategory || 'Not selected'} />
              <SummaryRow label="Jurisdiction" value="Lagos" />
              <SummaryRow label="Validity" value="12 months" />
              <SummaryRow label="Estimated fee" value="From selected category" />
            </div>
          </div>

          <div className="rounded-sm border border-warning/25 bg-warning/5 p-5">
            <h2 className="text-sm font-semibold text-ink-900">Review checklist</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-700">
              <li>Identity details match submitted document.</li>
              <li>Trade category has an active tenant fee.</li>
              <li>Business address is complete enough for follow-up.</li>
            </ul>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-ink-200 bg-white">
      <div className="flex gap-3 border-b border-ink-100 p-5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm bg-accent/5 text-accent">
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <p className="mt-1 text-sm text-ink-500">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
}: {
  label: string;
  id: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2" />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-ink-800">{label}</p>
      <div className="mt-2 flex min-h-10 items-center rounded-sm border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
        {value}
      </div>
    </div>
  );
}

function SelectField({
  label,
  id,
  options,
  value,
  onChange,
}: {
  label: string;
  id: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 flex h-10 w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
      >
        <option value="" disabled>
          Select {label.toLowerCase()}
        </option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function DocumentCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-24 cursor-pointer flex-col justify-between rounded-sm border border-dashed border-ink-300 bg-ink-50 p-4 text-sm text-ink-700 hover:border-accent hover:bg-accent/5">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2 text-xs text-ink-500">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-ink-300 accent-accent"
        />
        <CheckCircle2 className={checked ? 'h-4 w-4 text-success' : 'hidden'} />
        Received
      </span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</span>
      <span className="max-w-[11rem] text-right text-ink-800">{value}</span>
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function fromRegistration(registration: EditableRegistration): FormState {
  return {
    registrationDate: registration.registrationDate || today(),
    firstName: registration.firstName ?? '',
    lastName: registration.lastName ?? '',
    phone: registration.phone ?? '',
    email: registration.email ?? '',
    gender: registration.gender ?? '',
    tradeCategory: registration.tradeCategory ?? '',
    businessName: registration.businessName ?? '',
    address: registration.businessAddress ?? '',
    passportPhoto: registration.passportPhotoReceived,
  };
}
