import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/server-client';

export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/dashboard/certificates', req.url));
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    certificateId?: string;
    reason?: string;
  };

  if (!body.certificateId) {
    return NextResponse.json({ message: 'Missing certificate id.' }, { status: 400 });
  }

  try {
    const result = await apiFetch(`/certificates/${body.certificateId}/appeal`, {
      method: 'PATCH',
      authenticated: true,
      body: { reason: body.reason ?? '' },
    });
    revalidatePath('/dashboard/certificates');
    revalidatePath('/dashboard/reports');
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : 'Failed to submit certificate appeal.';
    return NextResponse.json({ message }, { status });
  }
}
