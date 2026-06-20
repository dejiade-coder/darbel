import Link from 'next/link';
import { ArrowLeft, KeyRound, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { RolePublic } from '@/lib/api/types';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createUserAction } from '../actions';

export const metadata = { title: 'Invite user' };

export default async function NewUserPage({
  searchParams,
}: {
  searchParams?: { error?: string; success?: string } | Promise<{ error?: string; success?: string }>;
}) {
  const params = await Promise.resolve(searchParams);
  let roles: RolePublic[] = [];
  let loadError = '';
  try {
    roles = await apiFetch<RolePublic[]>('/roles?includeSystem=true', { authenticated: true });
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : 'Could not load roles.';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Users
          </Link>
        </Button>
      </div>

      <header className="rounded-sm border border-ink-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-sm bg-accent/10 text-accent">
            <UserPlus className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Identity access</p>
            <h1 className="mt-1 font-display text-4xl font-medium text-ink-950">Invite User</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600">
              Create an operator account, assign their role, and require a password change on first sign-in.
            </p>
          </div>
        </div>
      </header>

      {params?.error && <Alert variant="danger">{params.error}</Alert>}
      {params?.success && <Alert variant="success">{params.success}</Alert>}
      {loadError && <Alert variant="danger">{loadError}</Alert>}

      <form action={createUserAction} className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4 rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-ink-900">Account Details</h2>
              <p className="text-sm text-ink-600">Use an official email address where possible.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Full name">
              <Input name="fullName" required minLength={2} maxLength={200} placeholder="Jane Officer" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" required maxLength={254} placeholder="jane@example.com" />
            </Field>
            <Field label="Phone">
              <Input name="phone" maxLength={20} placeholder="080..." />
            </Field>
            <Field label="Initial password">
              <Input name="initialPassword" type="password" required minLength={12} maxLength={256} autoComplete="new-password" />
            </Field>
          </div>
          <label className="flex items-center gap-2 rounded-sm border border-ink-100 bg-ink-50/60 p-3 text-sm text-ink-800">
            <input name="mustChangePassword" type="checkbox" defaultChecked className="h-4 w-4 accent-[hsl(var(--primary))]" />
            Require password change on first sign-in
          </label>
          <div className="rounded-sm border border-warning/25 bg-warning/5 p-3 text-xs leading-5 text-warning">
            Share the initial password through a separate secure channel. The password is never shown again after saving.
          </div>
        </section>

        <section className="space-y-4 rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-ink-900">Role Assignment</h2>
              <p className="text-sm text-ink-600">Choose at least one role for this operator.</p>
            </div>
          </div>
          <div className="space-y-2">
            {roles.map((role) => (
              <label key={role.code} className="flex items-start justify-between gap-3 rounded-sm border border-ink-100 bg-ink-50/40 p-3">
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{role.displayName}</span>
                  <span className="mt-1 block font-mono text-xs text-ink-500">{role.code}</span>
                </span>
                <span className="flex items-center gap-2">
                  {role.isSystemRole && <Badge variant="outline">System</Badge>}
                  <input name="roleCodes" type="checkbox" value={role.code} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit">
              <KeyRound className="mr-2 h-4 w-4" />
              Create user
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}
