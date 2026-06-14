import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth/session';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export async function GET(request: Request, { params }: { params: Promise<{ slot: string }> }) {
  const token = await getAccessToken();
  if (!token) return NextResponse.redirect(new URL('/login?error=Please sign in to continue.', request.url));
  const { slot } = await params;
  const res = await fetch(`${API_BASE}/tenant-settings/certificate-template/signatures/${encodeURIComponent(slot)}/file`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return new NextResponse(await res.arrayBuffer(), {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': res.headers.get('content-disposition') ?? 'inline',
      'cache-control': 'no-store, max-age=0',
    },
  });
}
