import { notFound } from 'next/navigation';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserPublic } from '@/lib/api/types';
import {
  NewRegistrationForm,
  type EditableRegistration,
} from '../new/new-registration-form';

export const metadata = { title: 'Edit registration' };

export default async function EditRegistrationPage({ params }: { params: { id: string } }) {
  const actor = readActorFromAccessToken();

  let profile: UserPublic | null = null;
  let registration: EditableRegistration | null = null;

  try {
    [profile, registration] = await Promise.all([
      apiFetch<UserPublic>('/users/me', { authenticated: true }),
      apiFetch<EditableRegistration>(`/registrations/${params.id}`, { authenticated: true }),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (!(e instanceof ApiError)) throw e;
  }

  if (!registration) notFound();

  return (
    <NewRegistrationForm
      registrar={{
        name: profile?.fullName ?? actor?.email ?? registration.registrarEmail,
        email: profile?.email ?? actor?.email ?? registration.registrarEmail,
        phone: profile?.phone ?? '',
        isActive: profile?.isActive ?? true,
      }}
      registration={registration}
    />
  );
}
