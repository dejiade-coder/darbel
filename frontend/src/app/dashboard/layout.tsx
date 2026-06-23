import { redirect } from 'next/navigation';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserPublic } from '@/lib/api/types';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await readActorFromAccessToken();
  if (!actor) redirect('/login');

  // Refresh profile from server so we always have the latest fullName/permissions
  let profile: UserPublic | null = null;
  let brandName = 'Darbel';
  try {
    profile = await apiFetch<UserPublic>('/users/me', { authenticated: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      redirect('/login?error=Your session has expired. Please sign in again.');
    }
    // Fall through with claims-only context; the UI degrades gracefully.
  }
  try {
    const branding = await apiFetch<{ applicationName: string }>('/tenant-settings/branding', { authenticated: true });
    brandName = branding.applicationName || brandName;
  } catch {}

  return (
    <div className="flex min-h-screen bg-parchment">
      <div className="print:hidden">
        <Sidebar permissions={actor.permissions} brandName={brandName} />
      </div>
      <div className="flex flex-1 flex-col print:block print:w-full">
        <div className="print:hidden">
          <TopBar
            fullName={profile?.fullName ?? actor.email}
            email={actor.email}
            isPlatformOperator={actor.isPlatformOperator}
            mfaEnabled={profile?.mfaEnabled ?? false}
          />
        </div>
        <main className="flex-1 px-4 py-5 sm:px-8 sm:py-8 print:p-0">
          <div className="mx-auto max-w-7xl animate-fade-in print:max-w-none print:animate-none">{children}</div>
        </main>
      </div>
    </div>
  );
}
