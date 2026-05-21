import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { RolePublic } from '@/lib/api/types';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';

export const metadata = { title: 'Roles & Permissions' };

export default async function RolesPage() {
  let roles: RolePublic[] = [];
  let error: string | null = null;
  try {
    roles = await apiFetch<RolePublic[]>('/roles?includeSystem=true', {
      authenticated: true,
    });
  } catch (e) {
    error = e instanceof ApiError ? e.payload.message : 'Failed to load roles';
  }

  // Sort: system roles first
  const systemRoles = roles.filter((r) => r.isSystemRole);
  const tenantRoles = roles.filter((r) => !r.isSystemRole);

  return (
    <>
      <PageHeader
        eyebrow="Access control"
        title="Roles & Permissions"
        description="Roles bundle permissions. System roles are managed by Branddarrow and cannot be modified per tenant. Tenant-defined roles will be configurable in a later release."
      />

      {error && (
        <Alert variant="danger" title="Could not load roles">
          {error}
        </Alert>
      )}

      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl font-medium text-ink-900">System roles</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {systemRoles.map((r) => (
            <RoleCard key={r.id} role={r} />
          ))}
        </div>
      </section>

      {tenantRoles.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-xl font-medium text-ink-900">Tenant roles</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {tenantRoles.map((r) => (
              <RoleCard key={r.id} role={r} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function RoleCard({ role }: { role: RolePublic }) {
  const byModule = groupBy(role.permissions, (p) => p.module);
  const moduleKeys = Object.keys(byModule).sort();

  return (
    <article className="rounded-sm border border-ink-200 bg-white">
      <div className="border-b border-ink-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-medium text-ink-900">{role.displayName}</h3>
          <div className="flex gap-1.5">
            {role.isSystemRole && <Badge variant="outline">System</Badge>}
            <Badge>{role.permissions.length} permissions</Badge>
          </div>
        </div>
        <p className="mt-1 font-mono text-xs text-ink-500">{role.code}</p>
        {role.description && (
          <p className="mt-2 text-sm text-ink-600">{role.description}</p>
        )}
      </div>
      <div className="space-y-4 px-5 py-4">
        {moduleKeys.map((mod) => (
          <div key={mod}>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
              {mod}
            </p>
            <div className="flex flex-wrap gap-1">
              {byModule[mod]!.map((p) => (
                <Badge key={p.code} variant={p.isSensitive ? 'warning' : 'default'}>
                  <span className="font-mono text-[10px]">{p.code}</span>
                  {p.isSensitive && <span className="ml-1">·sensitive</span>}
                </Badge>
              ))}
            </div>
          </div>
        ))}
        {role.permissions.length === 0 && (
          <p className="text-sm text-ink-500">No permissions assigned.</p>
        )}
      </div>
    </article>
  );
}

function groupBy<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    if (!out[k]) out[k] = [];
    out[k]!.push(item);
  }
  return out;
}
