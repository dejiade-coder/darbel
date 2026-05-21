import 'server-only';
import { cookies } from 'next/headers';
import {
  clearAllAuthCookies,
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
} from '../auth/session';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export interface ApiErrorPayload {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly payload: ApiErrorPayload,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  authenticated?: boolean;
  /** When true, do NOT attempt token refresh on 401. */
  noRefresh?: boolean;
  /** Pass through the inbound request id for log correlation. */
  requestId?: string;
}

/**
 * Server-side fetch wrapper. Used by route handlers and Server Components.
 *
 * - Authenticated calls add the Authorization header from the HTTP-only cookie.
 * - On 401 with a valid refresh token, attempts a single silent refresh and
 *   retries the original request once.
 * - Throws ApiError with the structured payload from the backend's
 *   GlobalExceptionFilter.
 */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const init = buildInit(opts);
  const url = `${API_BASE}${path}`;

  let res = await fetch(url, init);
  if (res.status === 401 && opts.authenticated && !opts.noRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await fetch(url, buildInit(opts));
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const ct = res.headers.get('content-type') ?? '';
  const data: unknown = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const payload: ApiErrorPayload =
      typeof data === 'object' && data !== null
        ? (data as ApiErrorPayload)
        : {
            statusCode: res.status,
            code: 'UNKNOWN_ERROR',
            message: typeof data === 'string' ? data : 'Request failed',
          };
    throw new ApiError(res.status, payload.code, payload, payload.message);
  }
  return data as T;
}

function buildInit(opts: RequestOptions): RequestInit {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (opts.requestId) headers['x-request-id'] = opts.requestId;
  if (opts.authenticated) {
    const at = getAccessToken();
    if (at) headers.authorization = `Bearer ${at}`;
  }
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
    cache: 'no-store',
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }
  return init;
}

/** Try once to use the refresh token to mint a new access token. */
async function tryRefresh(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
      cache: 'no-store',
    });
    if (!res.ok) {
      clearAllAuthCookies();
      return false;
    }
    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };
    setAuthCookies({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessExpiresIn: data.expiresIn,
    });
    return true;
  } catch {
    clearAllAuthCookies();
    return false;
  }
}

/** Type-safe accessor for the inbound request id from a route handler. */
export function getInboundRequestId(): string | undefined {
  return cookies().get('x-request-id')?.value;
}
