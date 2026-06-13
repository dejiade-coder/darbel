import { NextResponse, type NextRequest } from 'next/server';

/**
 * Light gatekeeper for protected routes.
 *
 * It only checks for the presence of an access-token cookie. It does NOT
 * verify the token; the backend does that on every API call. The dashboard
 * layout still performs the authoritative profile check and redirects on 401.
 */
export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const hasAccess = req.cookies.has('darbel_at');

  if (pathname.startsWith('/dashboard') && !hasAccess) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'Please sign in to continue.');
    return NextResponse.redirect(url);
  }

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
