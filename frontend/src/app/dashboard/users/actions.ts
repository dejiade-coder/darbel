'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserPublic } from '@/lib/api/types';

function resultParam(type: 'success' | 'error', message: string): string {
  return `${type}=${encodeURIComponent(message)}`;
}

export async function createUserAction(formData: FormData): Promise<void> {
  const roleCodes = formData.getAll('roleCodes').map(String).filter(Boolean);
  try {
    const created = await apiFetch<UserPublic>('/users', {
      method: 'POST',
      authenticated: true,
      body: {
        email: String(formData.get('email') ?? '').trim(),
        fullName: String(formData.get('fullName') ?? '').trim(),
        phone: String(formData.get('phone') ?? '').trim(),
        initialPassword: String(formData.get('initialPassword') ?? ''),
        mustChangePassword: formData.get('mustChangePassword') === 'on',
        roleCodes,
      },
    });
    revalidatePath('/dashboard/users');
    redirect(`/dashboard/users/${created.id}?${resultParam('success', 'User invited. Share the initial password securely.')}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof ApiError ? error.message : 'Could not invite user.';
    redirect(`/dashboard/users/new?${resultParam('error', message)}`);
  }
}

export async function updateUserAction(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  try {
    await apiFetch(`/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      authenticated: true,
      body: {
        fullName: String(formData.get('fullName') ?? '').trim(),
        phone: String(formData.get('phone') ?? '').trim(),
      },
    });
    revalidatePath('/dashboard/users');
    revalidatePath(`/dashboard/users/${userId}`);
    redirect(`/dashboard/users/${userId}?${resultParam('success', 'User profile updated.')}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof ApiError ? error.message : 'Could not update user.';
    redirect(`/dashboard/users/${userId}?${resultParam('error', message)}`);
  }
}

export async function setUserStatusAction(
  userId: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      authenticated: true,
      body: { isActive },
    });
    revalidatePath('/dashboard/users');
    revalidatePath(`/dashboard/users/${userId}`);
    return {};
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Could not update the account status.',
    };
  }
}

export async function assignRolesAction(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  const roleCodes = formData.getAll('roleCodes').map(String).filter(Boolean);
  try {
    await apiFetch(`/users/${encodeURIComponent(userId)}/roles`, {
      method: 'PUT',
      authenticated: true,
      body: { roleCodes },
    });
    revalidatePath('/dashboard/users');
    revalidatePath(`/dashboard/users/${userId}`);
    redirect(`/dashboard/users/${userId}?${resultParam('success', 'User roles updated.')}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof ApiError ? error.message : 'Could not update user roles.';
    redirect(`/dashboard/users/${userId}?${resultParam('error', message)}`);
  }
}

export async function deactivateUserAction(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  try {
    await apiFetch(`/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      authenticated: true,
    });
    revalidatePath('/dashboard/users');
    redirect(`/dashboard/users?${resultParam('success', 'User deactivated and active sessions revoked.')}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof ApiError ? error.message : 'Could not deactivate user.';
    redirect(`/dashboard/users/${userId}?${resultParam('error', message)}`);
  }
}

export async function resetUserPasswordAction(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  try {
    await apiFetch(`/users/${encodeURIComponent(userId)}/reset-password`, { method: 'POST', authenticated: true, body: { temporaryPassword: String(formData.get('temporaryPassword') ?? '') } });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Could not reset the password.';
    redirect(`/dashboard/users/${userId}?${resultParam('error', message)}`);
  }
  redirect(`/dashboard/users/${userId}?${resultParam('success', 'Temporary password issued. Share it securely; active sessions were revoked.')}`);
}

function isNextRedirect(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'digest' in error &&
    typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT');
}
