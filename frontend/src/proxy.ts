import { NextResponse, type NextRequest } from 'next/server';
import { decodeJwt } from 'jose';
import { getRestrictedWorkspace, isWorkspaceRouteAllowed } from '@/lib/auth/workspace';

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

  if (pathname.startsWith('/dashboard') && hasAccess) {
    try {
      const token = req.cookies.get('darbel_at')?.value;
      if (token) {
        const payload = decodeJwt(token);
        const roleCodes = Array.isArray(payload.roles)
          ? payload.roles.filter((role): role is string => typeof role === 'string')
          : [];
        const workspace = getRestrictedWorkspace(roleCodes, Boolean(payload.platformOp));
        if (!isWorkspaceRouteAllowed(pathname, workspace)) {
          const url = req.nextUrl.clone();
          url.pathname = '/dashboard';
          url.searchParams.set('notice', 'This workspace is limited to your assigned responsibilities.');
          return NextResponse.redirect(url);
        }
      }
    } catch {
      // The backend remains the authorization authority. A malformed token will
      // be handled by the dashboard layout and API guard.
    }
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
