import { notFound } from 'next/navigation';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserPublic } from '@/lib/api/types';
import {
  NewRegistrationForm,
  type EditableRegistration,
} from '../new/new-registration-form';
import { PaymentPanel, type RegistrationPayment } from './payment-panel';

export const metadata = { title: 'Edit registration' };

export default async function EditRegistrationPage({ params }: { params: { id: string } }) {
  const actor = readActorFromAccessToken();

  let profile: UserPublic | null = null;
  let registration: EditableRegistration | null = null;
  let payments: RegistrationPayment[] = [];

  try {
    const [profileResult, registrationResult] = await Promise.all([
      apiFetch<UserPublic>('/users/me', { authenticated: true }),
      apiFetch<EditableRegistration>(`/registrations/${params.id}`, { authenticated: true }),
    ]);
    profile = profileResult;
    registration = registrationResult;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (!(e instanceof ApiError)) throw e;
  }

  if (!registration) notFound();

  if (actor?.permissions.includes('payment.view')) {
    try {
      const paymentsResult = await apiFetch<{ items: RegistrationPayment[]; nextCursor: string | null }>(
        `/payments?handlerRegistrationId=${params.id}`,
        { authenticated: true },
      );
      payments = paymentsResult.items;
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
      />
      {actor?.permissions.includes('payment.view') && (
        <PaymentPanel
          registrationId={registration.id}
          registrationStatus={registration.status}
          canRecordPayment={actor.permissions.includes('payment.record')}
          payments={payments}
        />
      )}
    </div>
  );
}
