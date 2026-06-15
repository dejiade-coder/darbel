'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Ban,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  FileUp,
  Mail,
  MapPin,
  Phone,
  Save,
  Send,
  Store,
  UserRound,
  UserPlus,
} from 'lucide-react';
import {
  cancelRegistrationAction,
  saveRegistrationAction,
  type EditableRegistrationStatus,
  type RegistrationStatus,
} from './actions';

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
  uid: string | null;
  uidIssuedAt: string | null;
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
  const [status, setStatus] = useState<RegistrationStatus>(registration?.status ?? 'DRAFT');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isEditing = Boolean(registration);
  const isBusy = isSaving || isSubmitting || isCancelling;
  const isCancelled = status === 'CANCELLED';
  const canCancel = Boolean(registrationId) && status === 'DRAFT';
  const fullName = useMemo(
    () => [form.firstName, form.lastName].filter(Boolean).join(' ') || 'New handler',
    [form.firstName, form.lastName],
  );
  const requiredFields = [form.firstName, form.lastName, form.phone, form.registrationDate, form.tradeCategory, form.address];
  const complete = requiredFields.filter((value) => String(value).trim()).length;
  const completion = Math.round((complete / requiredFields.length) * 100);

  useEffect(() => {
    if (registration) {
      setForm(fromRegistration(registration));
      setRegistrationId(registration.id);
      setStatus(registration.status);
      return;
    }
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      setForm((current) => ({ ...current, registrationDate: today() }));
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<FormState> & { registrationId?: string; status?: string };
      if (parsed.status && parsed.status !== 'DRAFT') {
        window.localStorage.removeItem(DRAFT_KEY);
        setForm((current) => ({ ...current, registrationDate: today() }));
        return;
      }
      setForm({ ...emptyForm, registrationDate: today(), ...parsed });
      setRegistrationId(parsed.registrationId);
      if (isRegistrationStatus(parsed.status)) setStatus(parsed.status);
      setNotice({ type: 'success', message: 'Draft restored from this browser.' });
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [registration]);

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
      setStatus(saved.status);
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, registrationId: savedId, status: saved.status }));
      setNotice({ type: 'success', message: 'Draft saved.' });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Failed to save draft.' });
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
      setNotice({ type: 'error', message: `Complete: ${missing.map(([label]) => label).join(', ')}.` });
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await saveRegistrationAction(toPayload('SUBMITTED_FOR_REVIEW'), registrationId);
      const savedId = saved.id || registrationId;
      if (!savedId) throw new Error('Registration saved without an ID.');
      setRegistrationId(savedId);
      setStatus(saved.status);
      window.localStorage.removeItem(DRAFT_KEY);
      window.location.href = `/dashboard/registrations/${savedId}#payment`;
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Failed to submit registration.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function cancelDraft() {
    if (!registrationId) return;
    setIsCancelling(true);
    try {
      const cancelled = await cancelRegistrationAction(registrationId);
      setStatus(cancelled.status);
      setShowCancelConfirm(false);
      window.localStorage.removeItem(DRAFT_KEY);
      setNotice({ type: 'success', message: 'Draft registration cancelled.' });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Failed to cancel draft.' });
    } finally {
      setIsCancelling(false);
    }
  }

  function toPayload(nextStatus: EditableRegistrationStatus) {
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
    <div className="rounded-[8px] border border-ink-200 bg-white p-5 shadow-sm md:p-7">
      <div>
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/dashboard/registrations" className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 hover:text-[#075b50]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Registrations
            </Link>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">
              {isEditing ? 'Update handler' : 'Applicant intake'}
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium text-ink-900">
              Registration
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">
              Capture the applicant once, then continue to payment in the same workflow.
            </p>
          </div>
          <div className="min-w-64 rounded-[8px] border border-ink-200 bg-ink-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-600">Completion</span>
              <span className="font-semibold text-ink-900">{completion}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-200">
              <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-3 text-xs text-ink-500">{complete} of {requiredFields.length} required fields complete</p>
          </div>
        </div>

        {notice && (
          <div className={`mb-6 rounded-[8px] px-4 py-3 text-sm font-medium ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {notice.message}
          </div>
        )}

        <form className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_310px]" onSubmit={(event) => event.preventDefault()}>
          <div className="space-y-8">
            <Panel title="Applicant details">
              <div className="grid gap-4 md:grid-cols-2">
                <PillField icon={UserRound} placeholder="First name" value={form.firstName} onChange={(value) => update('firstName', value)} />
                <PillField placeholder="Last name" value={form.lastName} onChange={(value) => update('lastName', value)} />
                <PillField icon={Phone} placeholder="Phone Number" value={form.phone} onChange={(value) => update('phone', value)} />
                <PillSelect value={form.gender} options={['Female', 'Male', 'Prefer not to say']} placeholder="Gender" onChange={(value) => update('gender', value)} />
                <PillField icon={Mail} type="email" placeholder="Email Address" value={form.email} onChange={(value) => update('email', value)} className="md:col-span-2" />
                <PillField icon={MapPin} placeholder="Address" value={form.address} onChange={(value) => update('address', value)} className="md:col-span-2" />
                <PillField icon={Store} placeholder="Business Name" value={form.businessName} onChange={(value) => update('businessName', value)} />
                <PillSelect icon={Briefcase} value={form.tradeCategory} options={tradeCategories} placeholder="Trade" onChange={(value) => update('tradeCategory', value)} />
                <PillField icon={CalendarDays} type="date" placeholder="Date" value={form.registrationDate} onChange={(value) => update('registrationDate', value)} />
                <label className="flex h-12 items-center gap-3 rounded-[8px] border border-ink-200 bg-ink-50 px-4 text-sm font-medium text-ink-800">
                  <input className="h-4 w-4 accent-[#0f766e]" type="checkbox" checked={form.passportPhoto} onChange={(event) => update('passportPhoto', event.target.checked)} />
                  <FileUp className="h-4 w-4" />
                  Passport photo received
                  {form.passportPhoto && <CheckCircle2 className="ml-auto h-4 w-4 text-[#0f766e]" />}
                </label>
              </div>
            </Panel>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={saveDraft} disabled={isBusy || isCancelled} className="inline-flex h-11 items-center justify-center rounded-[8px] border border-ink-300 px-5 text-sm font-semibold text-ink-700 transition hover:border-[#0f766e] hover:text-[#0f766e] disabled:opacity-60">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving' : 'Save Draft'}
              </button>
              <button type="button" onClick={submitForReview} disabled={isBusy || isCancelled} className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#0f766e] px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b5f59] disabled:opacity-60">
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Submitting' : 'Proceed to payment'}
              </button>
              {canCancel && (
                <button type="button" onClick={() => setShowCancelConfirm(true)} disabled={isBusy} className="inline-flex h-11 items-center justify-center rounded-[8px] border border-red-200 px-5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel
                </button>
              )}
              {isEditing && (
                <Link href="/dashboard/registrations/new" className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#0f766e]/30 bg-[#0f766e]/5 px-5 text-sm font-semibold text-[#0f766e] transition hover:bg-[#0f766e]/10">
                  <UserPlus className="mr-2 h-4 w-4" />
                  New registration
                </Link>
              )}
            </div>
          </div>

          <aside className="rounded-[8px] border border-ink-200 bg-ink-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f766e]">Summary</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink-900">{fullName}</h2>
            <div className="mt-5 space-y-4 text-sm">
              <Summary label="Status" value={displayStatus(status)} />
              <Summary label="UID" value={registration?.uid ?? 'After payment'} />
              <Summary label="Trade" value={form.tradeCategory || 'Not selected'} />
              <Summary label="Registrar" value={registrar.name || registrar.email || 'Current user'} />
              <Summary label="Validity" value="12 months" />
            </div>
          </aside>
        </form>
      </div>
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/40 px-4">
          <div className="w-full max-w-md rounded-[8px] border border-ink-200 bg-white p-5 shadow-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-600">Cancel draft</p>
            <h2 className="mt-2 font-display text-2xl font-medium text-ink-950">{fullName}</h2>
            <p className="mt-3 text-sm leading-6 text-ink-600">
              This will cancel the draft registration and remove the saved local draft from this browser.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setShowCancelConfirm(false)}
                className="inline-flex h-10 items-center justify-center rounded-[8px] border border-ink-300 px-4 text-sm font-semibold text-ink-700 transition hover:border-[#0f766e] hover:text-[#0f766e] disabled:opacity-60"
              >
                Keep draft
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={cancelDraft}
                className="inline-flex h-10 items-center justify-center rounded-[8px] bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-base font-semibold text-ink-900">{title}</h2>
      {children}
    </section>
  );
}

function PillField({
  icon: Icon,
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
}: {
  icon?: React.ElementType;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`relative block ${className}`}>
      {Icon && <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-11 w-full rounded-[8px] border border-ink-200 bg-white px-4 text-sm text-ink-900 placeholder:text-ink-400 outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 ${Icon ? 'pl-10' : ''}`}
      />
    </label>
  );
}

function PillSelect({
  icon: Icon,
  value,
  options,
  placeholder,
  onChange,
}: {
  icon?: React.ElementType;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block">
      {Icon && <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-11 w-full rounded-[8px] border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 ${Icon ? 'pl-10' : ''}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-ink-200 pb-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className="mt-1 text-ink-800">{value}</p>
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

function displayStatus(status: RegistrationStatus): string {
  if (status === 'SUBMITTED_FOR_REVIEW') return 'Submitted for review';
  if (status === 'READY_FOR_SCREENING') return 'Ready for screening';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Draft';
}

function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return value === 'DRAFT' || value === 'SUBMITTED_FOR_REVIEW' || value === 'READY_FOR_SCREENING' || value === 'CANCELLED';
}
