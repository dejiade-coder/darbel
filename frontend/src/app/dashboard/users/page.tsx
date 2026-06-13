import Link from 'next/link';
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
  searchParams?: { q?: string; cursor?: string };
}) {
  const actor = await readActorFromAccessToken();
  if (!actor) return null;

  const params = new URLSearchParams();
  if (searchParams?.q) params.set('q', searchParams.q);
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

  return (
    <>
      <PageHeader
        eyebrow="Identity"
        title="Users"
        description="People with access to this tenant. New users are created by tenant administrators and receive a forced password change on first sign-in."
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/dashboard/users/new">Invite user</Link>
            </Button>
          ) : undefined
        }
      />

      {error && (
        <Alert variant="danger" title="Could not load users">
          {error}
        </Alert>
      )}

      <form className="mb-4 flex max-w-md gap-2" action="/dashboard/users">
        <input
          name="q"
          defaultValue={searchParams?.q ?? ''}
          placeholder="Search by name or email"
          className="flex h-10 flex-1 rounded-sm border border-ink-200 bg-white px-3 text-sm placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

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
                query: { ...(searchParams?.q ? { q: searchParams.q } : {}), cursor: data.nextCursor },
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
