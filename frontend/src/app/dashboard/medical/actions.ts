'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api/server-client';

export async function collectSampleAction(formData: FormData): Promise<void> {
  try {
    await apiFetch('/medical-screenings', {
      method: 'POST',
      authenticated: true,
      body: { handlerRegistrationId: String(formData.get('handlerRegistrationId') ?? '') },
    });
    revalidatePath('/dashboard/medical');
  } catch (error) {
    redirectWithMedicalError(error);
  }
}

export async function enterResultAction(formData: FormData): Promise<void> {
  const id = String(formData.get('screeningId') ?? '');
  try {
    await apiFetch(`/medical-screenings/${id}/result`, {
      method: 'PATCH',
      authenticated: true,
      body: {
        labResultSummary: String(formData.get('labResultSummary') ?? ''),
        mantouxResult: String(formData.get('mantouxResult') ?? 'NOT_DONE'),
        mantouxIndurationMm: nullableNumber(formData.get('mantouxIndurationMm')),
        hepatitisBResult: String(formData.get('hepatitisBResult') ?? 'NOT_DONE'),
        hivResult: String(formData.get('hivResult') ?? 'NOT_DONE'),
        widalResult: String(formData.get('widalResult') ?? 'NOT_DONE'),
        medicalOfficerNotes: String(formData.get('medicalOfficerNotes') ?? ''),
        fitnessStatus: String(formData.get('fitnessStatus') ?? 'REQUIRES_REVIEW'),
      },
    });
    revalidatePath('/dashboard/medical');
  } catch (error) {
    redirectWithMedicalError(error);
  }
}

export async function reviewScreeningAction(formData: FormData): Promise<void> {
  const id = String(formData.get('screeningId') ?? '');
  try {
    await apiFetch(`/medical-screenings/${id}/review`, {
      method: 'PATCH',
      authenticated: true,
      body: {
        approved: String(formData.get('approved')) === 'true',
        reviewNotes: String(formData.get('reviewNotes') ?? ''),
      },
    });
    revalidatePath('/dashboard/medical');
    revalidatePath('/dashboard/certificates');
  } catch (error) {
    redirectWithMedicalError(error);
  }
}

function nullableNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').trim();
  return text ? Number(text) : null;
}

function redirectWithMedicalError(error: unknown): never {
  const message = error instanceof ApiError ? error.message : 'Medical action failed';
  redirect(`/dashboard/medical?medicalError=${encodeURIComponent(message)}`);
}
