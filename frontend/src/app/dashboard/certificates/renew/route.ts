import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/server-client';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    certificateId?: string;
    validityDays?: number;
  };

  if (!body.certificateId) {
    return NextResponse.json({ message: 'Missing certificate id.' }, { status: 400 });
  }

  try {
    const result = await apiFetch(`/certificates/${body.certificateId}/renew`, {
      method: 'PATCH',
      authenticated: true,
      body: { validityDays: body.validityDays ?? 365 },
    });
    revalidatePath('/dashboard/certificates');
    revalidatePath('/dashboard/reports');
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : 'Failed to renew certificate.';
    return NextResponse.json({ message }, { status });
  }
}
