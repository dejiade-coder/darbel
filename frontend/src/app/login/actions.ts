'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import { setAuthCookies, setChallengeCookie } from '@/lib/auth/session';
import type { LoginResponse } from '@/lib/api/types';

const LoginInput = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});

export type LoginFormState = { error?: string };

export async function loginAction(
  _prevState: LoginFormState | void,
  formData: FormData,
): Promise<LoginFormState | void> {
  const parsed = LoginInput.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: 'Please provide a valid email and password.' };
  }

  let result: LoginResponse;
  try {
    result = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: parsed.data,
    });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'AUTH_ACCOUNT_LOCKED') {
        return {
          error: 'Account is temporarily locked due to repeated failed attempts. Try again later.',
        };
      }
      if (e.code === 'AUTH_ACCOUNT_INACTIVE') {
        return { error: 'This account is not active. Contact your administrator.' };
      }
      if (e.code === 'AUTH_INVALID_CREDENTIALS') {
        return { error: 'The email or password is incorrect.' };
      }
      return { error: e.payload.message };
    }
    return { error: 'Unable to reach the authentication service.' };
  }

  if (result.status === 'authenticated') {
    await setAuthCookies({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      accessExpiresIn: result.tokens.expiresIn,
    });
    redirect('/dashboard');
  }
  if (result.status === 'mfa_required') {
    await setChallengeCookie(result.challengeToken, 'mfa_required');
    redirect('/mfa-challenge');
  }
  if (result.status === 'password_change_required') {
    await setChallengeCookie(result.challengeToken, 'password_change_required');
    redirect('/setup-password');
  }
}
