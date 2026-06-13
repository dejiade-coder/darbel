'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import { clearAllAuthCookies } from '@/lib/auth/session';

const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
});

export async function changePasswordAction(
  formData: FormData,
): Promise<{ error?: string; success?: string } | void> {
  const parsed = ChangePasswordInput.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
  });
  if (!parsed.success) {
    return { error: 'Provide both current and new password.' };
  }
  try {
    await apiFetch('/auth/password/change', {
      method: 'POST',
      body: parsed.data,
      authenticated: true,
    });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'AUTH_INVALID_CREDENTIALS') {
        return { error: 'Current password is incorrect.' };
      }
      if (e.code === 'VALIDATION_PASSWORD_POLICY') return { error: e.payload.message };
      if (e.code === 'VALIDATION_PASSWORD_REUSE') {
        return { error: 'You cannot reuse a recent password.' };
      }
      return { error: e.payload.message };
    }
    return { error: 'Could not change password.' };
  }
  // Backend revoked all sessions; clear cookies and force fresh login.
  await clearAllAuthCookies();
  redirect('/login?error=Password updated. Please sign in again with your new password.');
}

// -----------------------------------------------------------------------
// MFA enrollment
// -----------------------------------------------------------------------

export async function startMfaEnrollAction(): Promise<
  { error?: string; secret?: string; otpauthUrl?: string }
> {
  try {
    const data = await apiFetch<{ secret: string; otpauthUrl: string }>(
      '/auth/mfa/enroll/start',
      { method: 'POST', authenticated: true },
    );
    return { secret: data.secret, otpauthUrl: data.otpauthUrl };
  } catch (e) {
    return { error: e instanceof ApiError ? e.payload.message : 'Could not start MFA enrollment.' };
  }
}

const ConfirmMfaInput = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export async function confirmMfaEnrollAction(
  formData: FormData,
): Promise<{ error?: string; success?: string } | void> {
  const parsed = ConfirmMfaInput.safeParse({ code: formData.get('code') });
  if (!parsed.success) return { error: 'Enter the 6-digit code from your authenticator app.' };
  try {
    await apiFetch('/auth/mfa/enroll/confirm', {
      method: 'POST',
      body: parsed.data,
      authenticated: true,
    });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'AUTH_INVALID_CREDENTIALS') {
        return { error: 'That code is not valid. Try the latest code from your app.' };
      }
      return { error: e.payload.message };
    }
    return { error: 'Could not enable MFA.' };
  }
  revalidatePath('/dashboard/settings');
  return { success: 'Multi-factor authentication is now enabled.' };
}

export async function disableMfaAction(
  formData: FormData,
): Promise<{ error?: string; success?: string } | void> {
  const parsed = ConfirmMfaInput.safeParse({ code: formData.get('code') });
  if (!parsed.success) return { error: 'Enter the 6-digit code from your authenticator app.' };
  try {
    await apiFetch('/auth/mfa/disable', {
      method: 'POST',
      body: parsed.data,
      authenticated: true,
    });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'AUTH_INVALID_CREDENTIALS') {
        return { error: 'Invalid code.' };
      }
      return { error: e.payload.message };
    }
    return { error: 'Could not disable MFA.' };
  }
  revalidatePath('/dashboard/settings');
  return { success: 'Multi-factor authentication is disabled.' };
}
