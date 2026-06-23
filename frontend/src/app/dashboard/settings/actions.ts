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

export async function updateNotificationProvidersAction(
  formData: FormData,
): Promise<{ error?: string; success?: string } | void> {
  const smtpPortRaw = String(formData.get('smtpPort') ?? '').trim();
  try {
    await apiFetch('/tenant-settings/notification-providers', {
      method: 'PATCH',
      authenticated: true,
      body: {
        emailEnabled: formData.get('emailEnabled') === 'on',
        smtpHost: String(formData.get('smtpHost') ?? ''),
        smtpPort: smtpPortRaw ? Number(smtpPortRaw) : null,
        smtpSecure: formData.get('smtpSecure') === 'on',
        smtpUsername: String(formData.get('smtpUsername') ?? ''),
        smtpPassword: String(formData.get('smtpPassword') ?? ''),
        emailFromName: String(formData.get('emailFromName') ?? ''),
        emailFromAddress: String(formData.get('emailFromAddress') ?? ''),
        whatsAppEnabled: formData.get('whatsAppEnabled') === 'on',
        whatsAppPhoneNumberId: String(formData.get('whatsAppPhoneNumberId') ?? ''),
        whatsAppBusinessAccountId: String(formData.get('whatsAppBusinessAccountId') ?? ''),
        whatsAppAccessToken: String(formData.get('whatsAppAccessToken') ?? ''),
        whatsAppDefaultCountryCode: String(formData.get('whatsAppDefaultCountryCode') ?? ''),
      },
    });
  } catch (e) {
    return { error: e instanceof ApiError ? e.payload.message : 'Could not save notification providers.' };
  }
  revalidatePath('/dashboard/settings');
  return { success: 'Notification provider settings saved.' };
}

export async function updateMessageTemplatesAction(
  formData: FormData,
): Promise<{ error?: string; success?: string } | void> {
  try {
    await apiFetch('/tenant-settings/message-templates', {
      method: 'PATCH',
      authenticated: true,
      body: {
        paymentConfirmed: templateFromForm(formData, 'paymentConfirmed'),
        uidIssued: templateFromForm(formData, 'uidIssued'),
        medicalScreeningReady: templateFromForm(formData, 'medicalScreeningReady'),
        certificateReady: templateFromForm(formData, 'certificateReady'),
      },
    });
  } catch (e) {
    return { error: e instanceof ApiError ? e.payload.message : 'Could not save message templates.' };
  }
  revalidatePath('/dashboard/settings');
  return { success: 'Message templates saved.' };
}

export async function updateBrandingAction(formData: FormData): Promise<void> {
  try {
    await apiFetch('/tenant-settings/branding', { method: 'PATCH', authenticated: true, body: { applicationName: String(formData.get('applicationName') ?? ''), accentColor: String(formData.get('accentColor') ?? '') } });
  } catch (e) { redirect(`/dashboard/settings?error=${encodeURIComponent(e instanceof ApiError ? e.payload.message : 'Could not save branding.')}`); }
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');
  redirect('/dashboard/settings?success=Branding%20saved.%20Refresh%20the%20dashboard%20to%20see%20the%20new%20identity.');
}

function templateFromForm(formData: FormData, key: string) {
  return {
    subject: String(formData.get(`${key}.subject`) ?? ''),
    body: String(formData.get(`${key}.body`) ?? ''),
    whatsApp: String(formData.get(`${key}.whatsApp`) ?? ''),
  };
}
