import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth/session';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export async function GET(request: Request) {
  const token = await getAccessToken();
  if (!token) return NextResponse.redirect(new URL('/login?error=Please sign in to continue.', request.url));
  const res = await fetch(`${API_BASE}/tenant-settings/certificate-template`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(request: Request) {
  const token = await getAccessToken();
  if (!token) return NextResponse.redirect(new URL('/login?error=Please sign in to continue.', request.url));
  const form = await request.formData();
  const res = await fetch(`${API_BASE}/tenant-settings/certificate-template`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
    cache: 'no-store',
  });
  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(request: Request) {
  const token = await getAccessToken();
  if (!token) return NextResponse.redirect(new URL('/login?error=Please sign in to continue.', request.url));
  const body = await request.json();
  const res = await fetch(`${API_BASE}/tenant-settings/certificate-template`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return NextResponse.json(data, { status: res.status });
}
