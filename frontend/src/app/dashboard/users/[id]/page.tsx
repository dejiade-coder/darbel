import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { RolePublic, UserPublic } from '@/lib/api/types';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatDateTime } from '@/lib/utils';
import { assignRolesAction, resetUserPasswordAction, updateUserAction } from '../actions';
import { UserStatusToggle } from './user-status-toggle';

export const metadata = { title: 'User details' };

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: { error?: string; success?: string } | Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const actor = await readActorFromAccessToken();
  const [user, roles] = await Promise.all([fetchUser(id), fetchRoles()]);
  if (!user) notFound();
  const assigned = new Set(user.roles.map((role) => role.code));
  const isSelf = actor?.userId === user.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Users
          </Link>
        </Button>
        <StatusBadge user={user} />
      </div>

      <header className="rounded-sm border border-ink-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-sm bg-accent/10 text-accent">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Operator account</p>
              <h1 className="mt-1 font-display text-4xl font-medium text-ink-950">{user.fullName}</h1>
              <p className="mt-2 font-mono text-sm text-ink-600">{user.email}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <MiniMetric label="Roles" value={String(user.roles.length)} />
            <MiniMetric label="MFA" value={user.mfaEnabled ? 'Enabled' : 'Off'} />
            <MiniMetric label="Last sign-in" value={formatDateTime(user.lastLoginAt) ?? 'Never'} />
          </div>
        </div>
      </header>

      {resolvedSearchParams?.error && <Alert variant="danger">{resolvedSearchParams.error}</Alert>}
      {resolvedSearchParams?.success && <Alert variant="success">{resolvedSearchParams.success}</Alert>}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4 rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <BadgeCheck className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-ink-900">Profile and Status</h2>
              <p className="text-sm text-ink-600">Update basic operator details and active status.</p>
            </div>
          </div>
          <form action={updateUserAction} className="space-y-4">
            <input type="hidden" name="userId" value={user.id} />
            <Field label="Full name">
              <Input name="fullName" defaultValue={user.fullName} required minLength={2} maxLength={200} />
            </Field>
            <Field label="Phone">
              <Input name="phone" defaultValue={user.phone ?? ''} maxLength={20} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit">Save profile</Button>
            </div>
          </form>

          {isSelf ? (
            <div className="border-t border-ink-100 pt-4">
              <div className="rounded-sm border border-warning/25 bg-warning/5 p-3 text-sm text-warning">
                You are viewing your own account. Use another administrator account to deactivate this operator.
              </div>
            </div>
          ) : actor?.permissions.includes('user.update') ? <UserStatusToggle userId={user.id} userName={user.fullName} isActive={user.isActive} /> : null}
          {!isSelf && actor?.permissions.includes('user.reset_password') && (
            <form action={resetUserPasswordAction} className="border-t border-ink-100 pt-4">
              <input type="hidden" name="userId" value={user.id} />
              <Field label="Reissue temporary password">
                <Input name="temporaryPassword" type="password" minLength={12} required autoComplete="new-password" placeholder="New temporary password" />
              </Field>
              <p className="mt-2 text-xs text-ink-500">This revokes active sessions and requires a password change at the next sign-in. Copy the email above and this password before submitting.</p>
              <div className="mt-3 flex justify-end"><Button type="submit" variant="outline"><KeyRound className="mr-2 h-4 w-4" />Reissue credentials</Button></div>
            </form>
          )}
        </section>

        <section className="space-y-4 rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-ink-900">Roles and Permissions</h2>
              <p className="text-sm text-ink-600">Role changes affect what this operator can approve, screen, audit, and configure.</p>
            </div>
          </div>
          <form action={assignRolesAction} className="space-y-3">
            <input type="hidden" name="userId" value={user.id} />
            {roles.map((role) => (
              <label key={role.code} className="flex items-start justify-between gap-3 rounded-sm border border-ink-100 bg-ink-50/40 p-3">
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{role.displayName}</span>
                  <span className="mt-1 block font-mono text-xs text-ink-500">{role.code}</span>
                  {role.description && <span className="mt-1 block text-xs text-ink-600">{role.description}</span>}
                </span>
                <span className="flex items-center gap-2">
                  {role.isSystemRole && <Badge variant="outline">System</Badge>}
                  <input
                    name="roleCodes"
                    type="checkbox"
                    value={role.code}
                    defaultChecked={assigned.has(role.code)}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                </span>
              </label>
            ))}
            <div className="flex justify-end">
              <Button type="submit">
                <KeyRound className="mr-2 h-4 w-4" />
                Save roles
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

async function fetchUser(id: string): Promise<UserPublic | null> {
  try {
    return await apiFetch<UserPublic>(`/users/${encodeURIComponent(id)}`, { authenticated: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

async function fetchRoles(): Promise<RolePublic[]> {
  try {
    return await apiFetch<RolePublic[]>('/roles?includeSystem=true', { authenticated: true });
  } catch {
    return [];
  }
}

function StatusBadge({ user }: { user: UserPublic }) {
  if (!user.isActive) return <Badge variant="danger">Inactive</Badge>;
  if (user.isLocked) return <Badge variant="warning">Locked</Badge>;
  if (user.mustChangePassword) return <Badge variant="warning">Pending first login</Badge>;
  return <Badge variant="success">Active</Badge>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-ink-100 bg-ink-50/70 p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}
