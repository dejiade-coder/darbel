'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api/server-client';

export async function createTenantAction(formData: FormData): Promise<void> {
  try {
    await apiFetch('/tenants', {
      method: 'POST',
      authenticated: true,
      body: {
        code: String(formData.get('code') ?? '').trim().toUpperCase(),
        legalName: String(formData.get('legalName') ?? '').trim(),
        displayName: String(formData.get('displayName') ?? '').trim(),
        contactEmail: String(formData.get('contactEmail') ?? '').trim(),
        contactPhone: String(formData.get('contactPhone') ?? '').trim(),
        adminName: String(formData.get('adminName') ?? '').trim(),
        adminEmail: String(formData.get('adminEmail') ?? '').trim(),
        adminPhone: String(formData.get('adminPhone') ?? '').trim(),
        initialPassword: String(formData.get('initialPassword') ?? ''),
      },
    });
    revalidatePath('/dashboard/tenants');
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Could not create tenant.';
    redirect(`/dashboard/tenants?error=${encodeURIComponent(message)}`);
  }
  redirect('/dashboard/tenants?success=Tenant%20created.%20Share%20the%20tenant%20admin%20password%20securely.');
}

export async function setTenantStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const isActive = formData.get('isActive') === 'true';
  try {
    await apiFetch(`/tenants/${encodeURIComponent(id)}/status`, { method: 'PATCH', authenticated: true, body: { isActive } });
    revalidatePath('/dashboard/tenants');
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Could not update tenant.';
    redirect(`/dashboard/tenants?error=${encodeURIComponent(message)}`);
  }
  redirect('/dashboard/tenants?success=Tenant%20status%20updated.');
}
