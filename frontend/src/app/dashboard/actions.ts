'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api/server-client';
import { clearAllAuthCookies, getRefreshToken } from '@/lib/auth/session';

export async function logoutAction(_formData: FormData): Promise<void> {
  const rt = await getRefreshToken();
  if (rt) {
    // Best-effort: revoke server-side. Even if it fails, clear local cookies.
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: { refreshToken: rt },
      });
    } catch {
      // Swallow — local clear is still authoritative
    }
  }
  await clearAllAuthCookies();
  redirect('/login');
}
