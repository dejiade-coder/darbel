'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import {
  clearChallengeCookie,
  getChallengeCookie,
  setAuthCookies,
} from '@/lib/auth/session';
import type { TokenPair } from '@/lib/api/types';

const Input = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export async function verifyMfaAction(formData: FormData): Promise<{ error?: string } | void> {
  const challenge = await getChallengeCookie();
  if (!challenge || challenge.kind !== 'mfa_required') {
    redirect('/login');
  }

  const parsed = Input.safeParse({ code: formData.get('code') });
  if (!parsed.success) {
    return { error: 'Enter the 6-digit code shown in your authenticator app.' };
  }

  try {
    const tokens = await apiFetch<TokenPair>('/auth/mfa/verify', {
      method: 'POST',
      body: {
        challengeToken: challenge.token,
        code: parsed.data.code,
      },
    });
    await setAuthCookies({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpiresIn: tokens.expiresIn,
    });
    await clearChallengeCookie();
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'AUTH_INVALID_MFA') {
        return { error: 'That code is not valid. Try again with the latest code from your app.' };
      }
      if (e.code === 'AUTH_INVALID_CREDENTIALS') {
        await clearChallengeCookie();
        redirect('/login?error=Session expired. Please sign in again.');
      }
      return { error: e.payload.message };
    }
    return { error: 'Unable to verify the code at this time.' };
  }
  redirect('/dashboard');
}
