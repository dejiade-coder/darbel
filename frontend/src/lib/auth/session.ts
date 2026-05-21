import 'server-only';
import { cookies } from 'next/headers';

/**
 * Server-side session management.
 *
 * Design rationale:
 * - Refresh token lives in an HTTP-only, Secure, SameSite=Lax cookie. JS code
 *   cannot read it; XSS cannot exfiltrate it; CSRF is mitigated by SameSite.
 * - Access token also lives in an HTTP-only cookie. The frontend never reads
 *   it; the Next.js server proxies authenticated calls to the backend, adding
 *   the Authorization header server-side. This way a compromised browser
 *   tab cannot leak the access token to a third party.
 * - Tokens are NEVER exposed to client-side JavaScript or localStorage.
 *
 * Trade-off acknowledged: this requires API calls to go through Next.js route
 * handlers (or Server Actions). The benefit — no token in JS, no exfiltration
 * surface — is worth the indirection for a system holding medical data.
 */

const ACCESS_TOKEN_COOKIE = 'darbel_at';
const REFRESH_TOKEN_COOKIE = 'darbel_rt';
const CHALLENGE_COOKIE = 'darbel_ch';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export type ChallengeKind = 'mfa_required' | 'password_change_required';

export function setAuthCookies(args: {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
}): void {
  const store = cookies();
  store.set(ACCESS_TOKEN_COOKIE, args.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: args.accessExpiresIn,
  });
  store.set(REFRESH_TOKEN_COOKIE, args.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 7,
  });
  // Clear any lingering challenge cookie on successful login
  store.set(CHALLENGE_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
}

export function setChallengeCookie(token: string, kind: ChallengeKind): void {
  const store = cookies();
  store.set(CHALLENGE_COOKIE, JSON.stringify({ token, kind }), {
    ...COOKIE_OPTIONS,
    maxAge: 300, // 5 minutes
  });
}

export function getChallengeCookie(): { token: string; kind: ChallengeKind } | null {
  const raw = cookies().get(CHALLENGE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token: string; kind: ChallengeKind };
    if (!parsed.token || !parsed.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearChallengeCookie(): void {
  cookies().set(CHALLENGE_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
}

export function getAccessToken(): string | null {
  return cookies().get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export function getRefreshToken(): string | null {
  return cookies().get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}

export function clearAllAuthCookies(): void {
  const store = cookies();
  store.set(ACCESS_TOKEN_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  store.set(REFRESH_TOKEN_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  store.set(CHALLENGE_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
}
