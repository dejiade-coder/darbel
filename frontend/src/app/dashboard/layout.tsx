import { redirect } from 'next/navigation';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserPublic } from '@/lib/api/types';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = readActorFromAccessToken();
  if (!actor) redirect('/login');

  // Refresh profile from server so we always have the latest fullName/permissions
  let profile: UserPublic | null = null;
  try {
    profile = await apiFetch<UserPublic>('/users/me', { authenticated: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      redirect('/login?error=Your session has expired. Please sign in again.');
    }
    // Fall through with claims-only context; the UI degrades gracefully.
  }

  return (
    <div className="flex min-h-screen bg-parchment">
      <Sidebar permissions={actor.permissions} />
      <div className="flex flex-1 flex-col">
        <TopBar
          fullName={profile?.fullName ?? actor.email}
          email={actor.email}
          isPlatformOperator={actor.isPlatformOperator}
          mfaEnabled={profile?.mfaEnabled ?? false}
        />
        <main className="flex-1 px-8 py-8">
          <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
