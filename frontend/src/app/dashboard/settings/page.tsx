import { readActorFromAccessToken } from '@/lib/auth/claims';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserPublic } from '@/lib/api/types';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChangePasswordCard } from './change-password-card';
import { MfaCard } from './mfa-card';
import { changePasswordAction, startMfaEnrollAction, confirmMfaEnrollAction, disableMfaAction } from './actions';
import { Alert } from '@/components/ui/alert';

export const metadata = { title: 'My account' };

export default async function SettingsPage() {
  const actor = readActorFromAccessToken();
  if (!actor) return null;

  let me: UserPublic | null = null;
  let loadError: string | null = null;
  try {
    me = await apiFetch<UserPublic>('/users/me', { authenticated: true });
  } catch (e) {
    loadError = e instanceof ApiError ? e.payload.message : 'Could not load profile';
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="My account"
        description="Manage your password and multi-factor authentication. Changing your password signs out all other sessions."
      />

      {loadError && (
        <Alert variant="danger" title="Could not load profile">
          {loadError}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Read-only on Phase 1. Editing arrives in Phase 2.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Full name" value={me?.fullName ?? '—'} />
            <Row label="Email" value={actor.email} mono />
            <Row label="Phone" value={me?.phone ?? '—'} mono />
            <Row
              label="Roles"
              value={
                <div className="flex flex-wrap gap-1.5">
                  {me?.roles.map((r) => (
                    <Badge key={r.code} variant="accent">
                      {r.displayName}
                    </Badge>
                  )) ?? '—'}
                </div>
              }
            />
          </CardContent>
        </Card>

        <ChangePasswordCard action={changePasswordAction} />

        <MfaCard
          enabled={me?.mfaEnabled ?? false}
          startAction={startMfaEnrollAction}
          confirmAction={confirmMfaEnrollAction}
          disableAction={disableMfaAction}
        />
      </div>
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</span>
      <span className={mono ? 'font-mono text-ink-800' : 'text-ink-800'}>{value}</span>
    </div>
  );
}
