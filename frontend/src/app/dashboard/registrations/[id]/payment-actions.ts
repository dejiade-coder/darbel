'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api/server-client';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'POS' | 'ONLINE';

export type PaymentResult = {
  id: string;
  handlerRegistrationId: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  receiptNumber: string | null;
  status: string;
  paidAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  registrationUid?: string | null;
};

export async function recordPaymentAction(payload: {
  handlerRegistrationId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  receiptNumber?: string;
  paidAt?: string;
  notes?: string;
}): Promise<PaymentResult> {
  const result = await apiFetch<PaymentResult>('/payments', {
    method: 'POST',
    authenticated: true,
    body: {
      ...payload,
      currency: 'NGN',
      paidAt: payload.paidAt ? new Date(`${payload.paidAt}T12:00:00.000Z`).toISOString() : undefined,
    },
  });

  if (!result?.id) {
    throw new Error('The backend did not return a recorded payment. Please try again.');
  }

  revalidatePath(`/dashboard/registrations/${payload.handlerRegistrationId}`);
  revalidatePath('/dashboard/payments');
  return result;
}

export async function approvePaymentAction(payload: {
  paymentId: string;
  handlerRegistrationId: string;
}): Promise<PaymentResult> {
  const result = await apiFetch<PaymentResult>(`/payments/${payload.paymentId}/approve`, {
    method: 'PATCH',
    authenticated: true,
  });

  if (!result?.id) {
    throw new Error('The backend did not return an approved payment. Please try again.');
  }

  revalidatePath(`/dashboard/registrations/${payload.handlerRegistrationId}`);
  revalidatePath('/dashboard/payments');
  return result;
}

export async function registrarApprovePaymentAction(payload: {
  paymentId: string;
  handlerRegistrationId: string;
}): Promise<PaymentResult> {
  const result = await apiFetch<PaymentResult>(`/payments/${payload.paymentId}/registrar-approve`, {
    method: 'PATCH',
    authenticated: true,
  });

  if (!result?.id) {
    throw new Error('The backend did not return an approved payment. Please try again.');
  }

  revalidatePath(`/dashboard/registrations/${payload.handlerRegistrationId}`);
  revalidatePath('/dashboard/payments');
  revalidatePath('/dashboard/medical');
  return result;
}
