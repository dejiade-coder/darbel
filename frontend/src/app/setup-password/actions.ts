'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import { clearChallengeCookie, getChallengeCookie } from '@/lib/auth/session';

const Input = z.object({
  newPassword: z.string().min(12).max(256),
});

export async function setupPasswordAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const challenge = getChallengeCookie();
  if (!challenge || challenge.kind !== 'password_change_required') {
    redirect('/login');
  }

  const parsed = Input.safeParse({ newPassword: formData.get('newPassword') });
  if (!parsed.success) {
    return { error: 'Password does not meet the policy.' };
  }

  try {
    await apiFetch('/auth/password/first-change', {
      method: 'POST',
      body: {
        challengeToken: challenge.token,
        newPassword: parsed.data.newPassword,
      },
    });
    clearChallengeCookie();
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'VALIDATION_PASSWORD_POLICY') {
        return { error: e.payload.message };
      }
      if (e.code === 'VALIDATION_PASSWORD_REUSE') {
        return { error: 'You cannot reuse a recent password. Choose a different one.' };
      }
      if (e.code === 'AUTH_INVALID_CREDENTIALS') {
        clearChallengeCookie();
        redirect('/login?error=Your session expired. Please sign in again.');
      }
      return { error: e.payload.message };
    }
    return { error: 'Could not set the password at this time.' };
  }
  // Force fresh sign-in after password change
  redirect('/login?error=Your password has been updated. Please sign in.');
}
