import { notFound } from 'next/navigation';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserPublic } from '@/lib/api/types';
import {
  NewRegistrationForm,
  type EditableRegistration,
  type TradeCategoryOption,
} from '../new/new-registration-form';
import { PaymentPanel, type RegistrationPayment } from './payment-panel';
import { DocumentPanel } from './document-panel';
import type { RegistrationDocument } from './document-actions';

export const metadata = { title: 'Edit registration' };

export default async function EditRegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await readActorFromAccessToken();

  let profile: UserPublic | null = null;
  let registration: EditableRegistration | null = null;
  let tradeCategories: TradeCategoryOption[] = [];
  let payments: RegistrationPayment[] = [];
  let documents: RegistrationDocument[] = [];

  try {
    const [profileResult, registrationResult, categoriesResult] = await Promise.all([
      apiFetch<UserPublic>('/users/me', { authenticated: true }),
      apiFetch<EditableRegistration>(`/registrations/${id}`, { authenticated: true }),
      apiFetch<TradeCategoryOption[]>('/trade-categories?withFeeOnly=true', { authenticated: true }).catch(() => []),
    ]);
    profile = profileResult;
    registration = registrationResult;
    tradeCategories = categoriesResult;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (!(e instanceof ApiError)) throw e;
  }

  if (!registration) notFound();

  if (actor?.permissions.includes('payment.view')) {
    try {
      const paymentsResult = await apiFetch<{ items: RegistrationPayment[]; nextCursor: string | null }>(
        `/payments?handlerRegistrationId=${id}`,
        { authenticated: true },
      );
      payments = Array.isArray(paymentsResult?.items) ? paymentsResult.items : [];
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
  }

  if (actor?.permissions.includes('handler.view')) {
    try {
      const documentsResult = await apiFetch<RegistrationDocument[]>(
        `/registrations/${id}/documents`,
        { authenticated: true },
      );
      documents = Array.isArray(documentsResult) ? documentsResult : [];
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
  }

  return (
    <div className="space-y-6">
      <NewRegistrationForm
        registrar={{
          name: profile?.fullName ?? actor?.email ?? registration.registrarEmail,
          email: profile?.email ?? actor?.email ?? registration.registrarEmail,
          phone: profile?.phone ?? '',
          isActive: profile?.isActive ?? true,
        }}
        registration={registration}
        tradeCategories={tradeCategories}
      />
      {actor?.permissions.includes('payment.view') && (
        <PaymentPanel
          registrationId={registration.id}
          registrationStatus={registration.status}
          canRecordPayment={actor.permissions.includes('payment.record')}
          canApprovePayment={actor.permissions.includes('payment.approve')}
          payments={payments}
          tradeCategory={registration.tradeCategory}
          tradeCategoryFee={resolveTradeCategoryFee(registration.tradeCategory, tradeCategories)}
        />
      )}
      {actor?.permissions.includes('handler.view') && (
        <DocumentPanel
          registrationId={registration.id}
          canUploadDocuments={actor.permissions.includes('handler.update')}
          documents={documents}
        />
      )}
      {actor?.permissions.includes('handler.create') && (
        <section className="flex flex-col gap-3 rounded-[8px] border border-ink-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Register another applicant</h2>
            <p className="mt-1 text-sm text-ink-600">
              Start a fresh registration and keep the intake queue moving.
            </p>
          </div>
          <Link
            href="/dashboard/registrations/new"
            className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#0f766e] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b5f59]"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            New registration
          </Link>
        </section>
      )}
    </div>
  );
}

function resolveTradeCategoryFee(
  tradeCategory: string | null,
  categories: TradeCategoryOption[],
): { amount: number; currency: string } | null {
  if (!tradeCategory) return null;
  const category = categories.find((item) => item.displayName === tradeCategory || item.code === tradeCategory);
  if (!category?.fee) return null;
  const amount = category.fee.feeAmount ?? (category.fee.amount ? Number(category.fee.amount) : undefined);
  if (!amount || !Number.isFinite(amount)) return null;
  return { amount, currency: category.fee.currency || 'NGN' };
}
