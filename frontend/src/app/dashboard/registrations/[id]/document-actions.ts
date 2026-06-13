'use server';

import { revalidatePath } from 'next/cache';
import { getAccessToken } from '@/lib/auth/session';
import { ApiError, type ApiErrorPayload } from '@/lib/api/server-client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export type DocumentType = 'PHOTOGRAPH' | 'GOVERNMENT_ID' | 'PRIOR_CERTIFICATE';

export type RegistrationDocument = {
  id: string;
  handlerRegistrationId: string;
  documentType: DocumentType;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: string;
  sha256Hash: string;
  uploadedBy: string;
  uploadedAt: string;
  notes: string | null;
};

export async function uploadDocumentAction(
  registrationId: string,
  formData: FormData,
): Promise<RegistrationDocument> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in before uploading a document.');
  }

  const res = await fetch(`${API_BASE}/registrations/${registrationId}/documents`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: formData,
    cache: 'no-store',
  });

  const contentType = res.headers.get('content-type') ?? '';
  const data: unknown = contentType.includes('application/json')
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const payload: ApiErrorPayload =
      typeof data === 'object' && data !== null
        ? (data as ApiErrorPayload)
        : {
            statusCode: res.status,
            code: 'UNKNOWN_ERROR',
            message: typeof data === 'string' ? data : 'Upload failed',
          };
    throw new ApiError(res.status, payload.code, payload, payload.message);
  }

  revalidatePath(`/dashboard/registrations/${registrationId}`);
  return data as RegistrationDocument;
}
