'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api/server-client';

export async function createTenantRoleAction(formData: FormData): Promise<void> {
  try {
    await apiFetch('/roles', {
      method: 'POST', authenticated: true,
      body: {
        code: String(formData.get('code') ?? '').trim().toUpperCase(),
        displayName: String(formData.get('displayName') ?? '').trim(),
        description: String(formData.get('description') ?? '').trim(),
        permissionCodes: formData.getAll('permissionCodes').map(String).filter(Boolean),
      },
    });
    revalidatePath('/dashboard/roles');
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Could not create role.';
    redirect(`/dashboard/roles?error=${encodeURIComponent(message)}`);
  }
  redirect('/dashboard/roles?success=Tenant%20role%20created.%20You%20can%20now%20assign%20it%20to%20a%20user.');
}
