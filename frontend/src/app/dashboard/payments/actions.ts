'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api/server-client';

export async function approvePaymentFromListAction(formData: FormData): Promise<void> {
  const paymentId = String(formData.get('paymentId') ?? '');
  if (!paymentId) {
    throw new Error('Missing payment id.');
  }

  try {
    await apiFetch(`/payments/${paymentId}/approve`, {
      method: 'PATCH',
      authenticated: true,
    });
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'Failed to approve payment.';
    redirect(`/dashboard/payments?paymentError=${encodeURIComponent(message)}`);
  }

  revalidatePath('/dashboard/payments');
  const registrationId = String(formData.get('registrationId') ?? '');
  if (registrationId) {
    revalidatePath(`/dashboard/registrations/${registrationId}`);
  }
}
