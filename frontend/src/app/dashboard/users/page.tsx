import Link from 'next/link';
import { Search, ShieldCheck, UserCheck, UserPlus, UsersRound, UserX } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserListResponse } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/layout/page-header';
import { formatDateTime } from '@/lib/utils';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Users' };

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: { q?: string; isActive?: string; cursor?: string; success?: string; error?: string };
}) {
  const actor = await readActorFromAccessToken();
  if (!actor) return null;

  const params = new URLSearchParams();
  if (searchParams?.q) params.set('q', searchParams.q);
  if (searchParams?.isActive) params.set('isActive', searchParams.isActive);
  if (searchParams?.cursor) params.set('cursor', searchParams.cursor);
  params.set('limit', '25');

  let data: UserListResponse | null = null;
  let error: string | null = null;
  try {
    data = await apiFetch<UserListResponse>(`/users?${params.toString()}`, {
      authenticated: true,
    });
  } catch (e) {
    error = e instanceof ApiError ? e.payload.message : 'Failed to load users';
  }

  const canCreate = actor.permissions.includes('user.create');
  const users = data?.items ?? [];
  const activeCount = users.filter((user) => user.isActive && !user.isLocked && !user.mustChangePassword).length;
  const pendingCount = users.filter((user) => user.mustChangePassword).length;
  const inactiveCount = users.filter((user) => !user.isActive || user.isLocked).length;
  const roleCount = new Set(users.flatMap((user) => user.roles.map((role) => role.code))).size;

  return (
    <>
      <PageHeader
        eyebrow="Identity"
        title="Users"
        description="People with access to this tenant. New users are created by tenant administrators and receive a forced password change on first sign-in."
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/dashboard/users/new">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite user
              </Link>
            </Button>
          ) : undefined
        }
      />

      {searchParams?.error && <Alert variant="danger">{searchParams.error}</Alert>}
      {searchParams?.success && <Alert variant="success">{searchParams.success}</Alert>}
      {error && (
        <Alert variant="danger" title="Could not load users">
          {error}
        </Alert>
      )}

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={UsersRound} label="Loaded users" value={String(users.length)} detail={data?.nextCursor ? 'More users available' : 'Current result set'} />
        <Metric icon={UserCheck} label="Active" value={String(activeCount)} detail="ready to sign in" />
        <Metric icon={ShieldCheck} label="Roles represented" value={String(roleCount)} detail="in this view" />
        <Metric icon={UserX} label="Needs attention" value={String(pendingCount + inactiveCount)} detail={`${pendingCount} pending, ${inactiveCount} inactive/locked`} warning={pendingCount + inactiveCount > 0} />
      </section>

      <section className="mb-4 rounded-sm border border-ink-200 bg-white p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]" action="/dashboard/users">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              name="q"
              defaultValue={searchParams?.q ?? ''}
              placeholder="Search by name or email"
              className="flex h-10 w-full rounded-sm border border-ink-200 bg-white pl-9 pr-3 text-sm placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          {searchParams?.isActive && <input type="hidden" name="isActive" value={searchParams.isActive} />}
          <Button type="submit" variant="outline">
            Search
          </Button>
          {(searchParams?.q || searchParams?.isActive) && (
            <Button asChild variant="ghost">
              <Link href="/dashboard/users">Clear</Link>
            </Button>
          )}
        </form>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
          <Button asChild variant={!searchParams?.isActive ? 'default' : 'outline'} size="sm">
            <Link href={usersHref({ q: searchParams?.q })}>All users</Link>
          </Button>
          <Button asChild variant={searchParams?.isActive === 'true' ? 'default' : 'outline'} size="sm">
            <Link href={usersHref({ q: searchParams?.q, isActive: 'true' })}>Active</Link>
          </Button>
          <Button asChild variant={searchParams?.isActive === 'false' ? 'default' : 'outline'} size="sm">
            <Link href={usersHref({ q: searchParams?.q, isActive: 'false' })}>Inactive</Link>
          </Button>
        </div>
      </section>

      {data && (
        <div className="overflow-hidden rounded-sm border border-ink-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50/40 text-left">
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Roles</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-ink-500">
                    No users match your search.
                  </td>
                </tr>
              )}
              {data.items.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-ink-100 transition-colors last:border-0 hover:bg-ink-50/40"
                >
                  <Td>
                    <Link
                      href={`/dashboard/users/${u.id}`}
                      className="font-medium text-ink-900 hover:text-accent hover:underline"
                    >
                      {u.fullName}
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-ink-700">{u.email}</span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r.code} variant="accent">
                          {r.displayName}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    {!u.isActive ? (
                      <Badge variant="danger">Inactive</Badge>
                    ) : u.isLocked ? (
                      <Badge variant="warning">Locked</Badge>
                    ) : u.mustChangePassword ? (
                      <Badge variant="warning">Pending first login</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </Td>
                  <Td>
                    <span className="text-ink-600">{formatDateTime(u.lastLoginAt)}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.nextCursor && (
        <div className="mt-4 text-right">
          <Button asChild variant="outline">
            <Link
              href={{
                pathname: '/dashboard/users',
                query: {
                  ...(searchParams?.q ? { q: searchParams.q } : {}),
                  ...(searchParams?.isActive ? { isActive: searchParams.isActive } : {}),
                  cursor: data.nextCursor,
                },
              }}
            >
              Load more
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  warning = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-sm border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Icon className={warning ? 'h-5 w-5 text-warning' : 'h-5 w-5 text-accent'} />
        <Badge variant={warning ? 'warning' : 'outline'}>{label}</Badge>
      </div>
      <p className="mt-4 font-display text-3xl font-medium text-ink-950">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{detail}</p>
    </div>
  );
}

function usersHref({ q, isActive }: { q?: string; isActive?: string }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (isActive) params.set('isActive', isActive);
  const query = params.toString();
  return query ? `/dashboard/users?${query}` : '/dashboard/users';
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}
