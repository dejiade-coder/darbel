import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/server-client';

export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/dashboard/certificates', req.url));
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    certificateId?: string;
    decision?: 'APPROVE' | 'REJECT';
    notes?: string;
    validityDays?: number;
  };

  if (!body.certificateId) {
    return NextResponse.json({ message: 'Missing certificate id.' }, { status: 400 });
  }

  try {
    const result = await apiFetch(`/certificates/${body.certificateId}/appeal-review`, {
      method: 'PATCH',
      authenticated: true,
      body: {
        decision: body.decision ?? 'REJECT',
        notes: body.notes ?? '',
        validityDays: body.validityDays ?? 365,
      },
    });
    revalidatePath('/dashboard/certificates');
    revalidatePath('/dashboard/reports');
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : 'Failed to review certificate appeal.';
    return NextResponse.json({ message }, { status });
  }
}
