import type React from 'react';
import { AlertTriangle, KeyRound, Layers3, ShieldCheck, UsersRound } from 'lucide-react';
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

  const systemRoles = roles.filter((role) => role.isSystemRole);
  const tenantRoles = roles.filter((role) => !role.isSystemRole);
  const allPermissions = roles.flatMap((role) => role.permissions);
  const uniquePermissions = new Map(allPermissions.map((permission) => [permission.code, permission]));
  const sensitiveCount = Array.from(uniquePermissions.values()).filter((permission) => permission.isSensitive).length;
  const moduleSummaries = summarizeModules(roles);

  return (
    <>
      <PageHeader
        eyebrow="Access control"
        title="Roles & Permissions"
        description="Review what each operator role can do. Use this page during compliance review before assigning users to sensitive approval, screening, certificate, settings, and audit functions."
      />

      {error && (
        <Alert variant="danger" title="Could not load roles">
          {error}
        </Alert>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={UsersRound} label="Roles" value={String(roles.length)} detail={`${systemRoles.length} system, ${tenantRoles.length} tenant`} />
        <Metric icon={KeyRound} label="Permissions" value={String(uniquePermissions.size)} detail="unique permissions covered" />
        <Metric icon={AlertTriangle} label="Sensitive" value={String(sensitiveCount)} detail="requires careful assignment" warning={sensitiveCount > 0} />
        <Metric icon={Layers3} label="Modules" value={String(moduleSummaries.length)} detail="permission groups" />
      </section>

      <section className="mb-6 rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-accent" />
          <div>
            <h2 className="text-base font-semibold text-ink-900">Access Review Guidance</h2>
            <p className="mt-1 text-sm leading-6 text-ink-600">
              Assign only the roles needed for a person&apos;s operational duty. Pay extra attention to roles with sensitive permissions such as user administration, certificate revocation, audit access, tenant settings, and payment approval.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10 rounded-sm border border-ink-200 bg-white shadow-sm">
        <div className="border-b border-ink-100 p-5">
          <h2 className="font-display text-2xl font-medium text-ink-900">Module Coverage</h2>
          <p className="mt-1 text-sm text-ink-600">Where permissions are concentrated across the system.</p>
        </div>
        <div className="grid gap-0 divide-y divide-ink-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {moduleSummaries.map((module) => (
            <div key={module.module} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-sm font-semibold uppercase text-ink-900">{module.module}</p>
                <Badge variant={module.sensitiveCount ? 'warning' : 'outline'}>{module.permissionCount} permissions</Badge>
              </div>
              <p className="mt-2 text-sm text-ink-600">
                {module.roleCount} roles include this module
                {module.sensitiveCount ? `, ${module.sensitiveCount} sensitive permissions` : ''}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <SectionHeader title="System roles" detail="Branddarrow-managed role templates available to this tenant." />
        <div className="grid gap-4 lg:grid-cols-2">
          {systemRoles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      </section>

      {tenantRoles.length > 0 && (
        <section>
          <SectionHeader title="Tenant roles" detail="Tenant-defined role templates." />
          <div className="grid gap-4 lg:grid-cols-2">
            {tenantRoles.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>
        </section>
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

function SectionHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-2xl font-medium text-ink-900">{title}</h2>
      <p className="mt-1 text-sm text-ink-600">{detail}</p>
    </div>
  );
}

function RoleCard({ role }: { role: RolePublic }) {
  const byModule = groupBy(role.permissions, (permission) => permission.module);
  const moduleKeys = Object.keys(byModule).sort();
  const sensitivePermissions = role.permissions.filter((permission) => permission.isSensitive);

  return (
    <article className="rounded-sm border border-ink-200 bg-white shadow-sm">
      <div className="border-b border-ink-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-medium text-ink-900">{role.displayName}</h3>
            <p className="mt-1 font-mono text-xs text-ink-500">{role.code}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {role.isSystemRole && <Badge variant="outline">System</Badge>}
            <Badge>{role.permissions.length} permissions</Badge>
            {sensitivePermissions.length > 0 && <Badge variant="warning">{sensitivePermissions.length} sensitive</Badge>}
          </div>
        </div>
        {role.description && (
          <p className="mt-3 text-sm leading-6 text-ink-600">{role.description}</p>
        )}
      </div>
      <div className="space-y-4 px-5 py-4">
        {moduleKeys.map((module) => (
          <div key={module} className="rounded-sm border border-ink-100 bg-ink-50/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
                {module}
              </p>
              <Badge variant="outline">{byModule[module]!.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {byModule[module]!.map((permission) => (
                <Badge key={permission.code} variant={permission.isSensitive ? 'warning' : 'default'}>
                  <span className="font-mono text-[10px]">{permission.code}</span>
                  {permission.isSensitive && <span className="ml-1">sensitive</span>}
                </Badge>
              ))}
            </div>
          </div>
        ))}
        {role.permissions.length === 0 && (
          <p className="rounded-sm border border-ink-100 bg-ink-50/50 p-3 text-sm text-ink-500">No permissions assigned.</p>
        )}
      </div>
    </article>
  );
}

function summarizeModules(roles: RolePublic[]) {
  const byModule = new Map<string, { module: string; permissionCodes: Set<string>; sensitiveCodes: Set<string>; roleCodes: Set<string> }>();
  for (const role of roles) {
    for (const permission of role.permissions) {
      const current = byModule.get(permission.module) ?? {
        module: permission.module,
        permissionCodes: new Set<string>(),
        sensitiveCodes: new Set<string>(),
        roleCodes: new Set<string>(),
      };
      current.permissionCodes.add(permission.code);
      current.roleCodes.add(role.code);
      if (permission.isSensitive) current.sensitiveCodes.add(permission.code);
      byModule.set(permission.module, current);
    }
  }
  return Array.from(byModule.values())
    .map((module) => ({
      module: module.module,
      permissionCount: module.permissionCodes.size,
      sensitiveCount: module.sensitiveCodes.size,
      roleCount: module.roleCodes.size,
    }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    const value = key(item);
    if (!grouped[value]) grouped[value] = [];
    grouped[value]!.push(item);
  }
  return grouped;
}
