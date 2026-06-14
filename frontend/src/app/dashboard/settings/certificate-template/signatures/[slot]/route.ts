import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth/session';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export async function POST(request: Request, { params }: { params: Promise<{ slot: string }> }) {
  const token = await getAccessToken();
  if (!token) return NextResponse.redirect(new URL('/login?error=Please sign in to continue.', request.url));
  const { slot } = await params;
  const form = await request.formData();
  const res = await fetch(`${API_BASE}/tenant-settings/certificate-template/signatures/${encodeURIComponent(slot)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
    cache: 'no-store',
  });
  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return NextResponse.json(data, { status: res.status });
}
