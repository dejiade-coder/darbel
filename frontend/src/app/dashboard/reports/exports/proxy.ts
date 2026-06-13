import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth/session';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export async function proxyExport(
  request: Request,
  path: string,
  filename: string,
  contentType: string,
) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=Please sign in to continue.', request.url));
  }

  const search = new URL(request.url).search;
  const res = await fetch(`${API_BASE}${path}${search}`, {
    headers: {
      accept: contentType,
      authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });
  const body = await res.arrayBuffer();

  return new NextResponse(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? contentType,
      'content-disposition': res.ok
        ? `attachment; filename="${filename}"`
        : 'inline',
    },
  });
}
