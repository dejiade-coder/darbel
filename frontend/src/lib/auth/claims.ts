import 'server-only';
import { decodeJwt } from 'jose';
import { getAccessToken } from './session';

export interface ActorClaims {
  userId: string;
  tenantId: string;
  email: string;
  permissions: string[];
  isPlatformOperator: boolean;
  mfaVerified: boolean;
  expiresAt: number;
}

/**
 * Decode (NOT verify) the access token to extract claims for UI gating.
 *
 * Verification is the backend's responsibility — every API call goes through
 * the backend's JwtAuthGuard. The frontend only reads claims to decide what
 * to render. Trusting a decoded JWT for *rendering* is fine; trusting it for
 * *authorization* would not be. The backend re-checks everything.
 */
export function readActorFromAccessToken(): ActorClaims | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = decodeJwt(token);
    if (!payload.sub || !payload.exp) return null;
    return {
      userId: payload.sub as string,
      tenantId: (payload.tid as string) ?? '',
      email: (payload.email as string) ?? '',
      permissions: ((payload.perms as string[]) ?? []),
      isPlatformOperator: Boolean(payload.platformOp),
      mfaVerified: Boolean(payload.mfa),
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

export function hasPermission(claims: ActorClaims | null, code: string): boolean {
  return claims?.permissions?.includes(code) ?? false;
}

export function hasAnyPermission(claims: ActorClaims | null, codes: string[]): boolean {
  if (!claims) return false;
  return codes.some((c) => claims.permissions.includes(c));
}
