'use server';

import { apiFetch } from '@/lib/api/server-client';

export type RegistrationStatus = 'DRAFT' | 'SUBMITTED_FOR_REVIEW';

export type RegistrationPayload = {
  registrationDate: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  gender?: string;
  tradeCategory: string;
  businessName?: string;
  businessAddress: string;
  passportPhotoReceived: boolean;
  status: RegistrationStatus;
};

export type RegistrationResult = {
  id: string;
  status: RegistrationStatus;
  registrarName: string;
  registrarEmail: string;
  registrationDate: string;
  firstName: string;
  lastName: string;
  tradeCategory: string;
  updatedAt: string;
  submittedAt: string | null;
};

export async function saveRegistrationAction(
  payload: RegistrationPayload,
  id?: string,
): Promise<RegistrationResult> {
  const path = id ? `/registrations/${id}` : '/registrations';
  const method = id ? 'PATCH' : 'POST';

  const result = await apiFetch<RegistrationResult>(path, {
    method,
    authenticated: true,
    body: payload,
  });

  if (!result?.id) {
    throw new Error('The backend did not return a saved registration. Please try again.');
  }

  return result;
}
