import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware: light gatekeeper for protected routes.
 *
 * It only checks for the presence of an access-token cookie. It does NOT
 * verify the token (the backend does that on every API call). The point is
 * to redirect anonymous users away from /dashboard quickly, without a
 * round-trip to the API just to render a redirect.
 *
 * The /dashboard layout does the authoritative check (calls /users/me) and
 * will redirect to /login on any 401 — so this middleware can be permissive.
 */
export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const hasAccess = req.cookies.has('darbel_at');

  // Protect /dashboard/*
  if (pathname.startsWith('/dashboard') && !hasAccess) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'Please sign in to continue.');
    return NextResponse.redirect(url);
  }

  // Bounce already-authenticated users away from auth pages
  if ((pathname === '/login' || pathname === '/') && hasAccess) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*'],
};
