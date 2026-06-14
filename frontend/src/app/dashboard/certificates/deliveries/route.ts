import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/server-client';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    certificateId?: string;
    channel?: string;
    recipient?: string | null;
    deliveryUrl?: string | null;
    verificationUrl?: string | null;
    messagePreview?: string | null;
  };

  if (!body.certificateId) {
    return NextResponse.json({ message: 'Missing certificate id.' }, { status: 400 });
  }

  try {
    const result = await apiFetch(`/certificates/${body.certificateId}/deliveries`, {
      method: 'POST',
      authenticated: true,
      body: {
        channel: body.channel,
        recipient: body.recipient ?? '',
        deliveryUrl: body.deliveryUrl ?? '',
        verificationUrl: body.verificationUrl ?? '',
        messagePreview: body.messagePreview ?? '',
      },
    });
    revalidatePath('/dashboard/certificates');
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : 'Failed to record delivery.';
    return NextResponse.json({ message }, { status });
  }
}
