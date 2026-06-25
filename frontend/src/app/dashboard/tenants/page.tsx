import type React from 'react';
import { Activity, BadgeCheck, Building2, ShieldCheck, Users } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import type { TenantPublic } from '@/lib/api/types';
import { createTenantAction, setTenantStatusAction } from './actions';

export const metadata = { title: 'Tenants' };

export default async function TenantsPage({ searchParams }: { searchParams?: Promise<{ error?: string; success?: string }> }) {
  const actor = await readActorFromAccessToken();
  const params = await searchParams;
  if (!actor?.permissions.includes('platform.manage')) return null;
  let tenants: TenantPublic[] = [];
  let loadError = '';

  try {
    tenants = await apiFetch<TenantPublic[]>('/tenants', { authenticated: true });
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : 'Could not load tenants.';
  }

  const activeTenants = tenants.filter((tenant) => tenant.isActive).length;
  const totalUsers = tenants.reduce((sum, tenant) => sum + tenant.userCount, 0);
  const totalRegistrations = tenants.reduce((sum, tenant) => sum + tenant.registrationCount, 0);
  const totalValidCertificates = tenants.reduce((sum, tenant) => sum + tenant.validCertificateCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Tenants" description="Provision, monitor, and manage the organizations that operate independently on Darbel." />
      {params?.error && <Alert variant="danger">{params.error}</Alert>}
      {params?.success && <Alert variant="success">{params.success}</Alert>}
      {loadError && <Alert variant="danger">{loadError}</Alert>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Building2} label="Active tenants" value={activeTenants} detail={`${tenants.length} total organizations`} />
        <Metric icon={Users} label="Officers" value={totalUsers} detail="Across all tenants" />
        <Metric icon={Activity} label="Registrations" value={totalRegistrations} detail="Platform intake volume" />
        <Metric icon={BadgeCheck} label="Valid certificates" value={totalValidCertificates} detail="Currently usable" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <form action={createTenantAction} className="space-y-4 rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-accent" />
            <div>
              <h2 className="font-semibold text-ink-900">New organization</h2>
              <p className="text-sm text-ink-600">Creates an isolated tenant and its first administrator.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Organization name"><Input name="legalName" required placeholder="Example Foods Ltd" /></Field>
            <Field label="Display name"><Input name="displayName" required placeholder="Example Foods" /></Field>
            <Field label="Tenant code"><Input name="code" required maxLength={20} placeholder="EXAMPLE" /></Field>
            <Field label="Organization email"><Input name="contactEmail" type="email" required placeholder="office@example.com" /></Field>
            <Field label="Organization phone"><Input name="contactPhone" placeholder="080..." /></Field>
          </div>
          <div className="border-t border-ink-100 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-ink-900">First tenant administrator</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name"><Input name="adminName" required placeholder="Admin name" /></Field>
              <Field label="Email"><Input name="adminEmail" type="email" required placeholder="admin@example.com" /></Field>
              <Field label="Phone"><Input name="adminPhone" placeholder="080..." /></Field>
              <Field label="Initial password"><Input name="initialPassword" type="password" minLength={12} required /></Field>
            </div>
          </div>
          <Button type="submit">Create tenant</Button>
        </form>

        <section className="overflow-hidden rounded-sm border border-ink-200 bg-white shadow-sm">
          <div className="border-b border-ink-100 p-5">
            <h2 className="font-semibold text-ink-900">Tenant monitor</h2>
            <p className="text-sm text-ink-600">Track staff, registration volume, payments, medical work, and certificates across every organization.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse text-sm">
              <thead className="bg-ink-50 text-left text-[10px] uppercase tracking-[0.16em] text-ink-500">
                <tr>
                  <Th>Organization</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Users</Th>
                  <Th className="text-right">Registrations</Th>
                  <Th className="text-right">Payments</Th>
                  <Th className="text-right">Medical</Th>
                  <Th className="text-right">Certificates</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-t border-ink-100 transition hover:bg-accent/5">
                    <Td>
                      <p className="font-semibold text-ink-900">{tenant.displayName}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{tenant.code} - {tenant.contactEmail}</p>
                    </Td>
                    <Td>
                      <span className={tenant.isActive ? 'rounded-sm bg-success/10 px-2 py-1 text-xs font-medium text-success' : 'rounded-sm bg-danger/10 px-2 py-1 text-xs font-medium text-danger'}>
                        {tenant.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </Td>
                    <Td className="text-right font-mono">{tenant.userCount}</Td>
                    <Td className="text-right font-mono">{tenant.registrationCount}</Td>
                    <Td className="text-right font-mono">{tenant.paymentCount}</Td>
                    <Td className="text-right font-mono">{tenant.medicalScreeningCount}</Td>
                    <Td className="text-right font-mono">{tenant.validCertificateCount}/{tenant.certificateCount}</Td>
                    <Td>
                      <form action={setTenantStatusAction} className="flex justify-end">
                        <input type="hidden" name="id" value={tenant.id} />
                        <input type="hidden" name="isActive" value={String(!tenant.isActive)} />
                        <Button type="submit" size="sm" variant={tenant.isActive ? 'outline' : 'default'}>
                          {tenant.isActive ? 'Suspend' : 'Activate'}
                        </Button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tenants.length === 0 && <div className="p-8 text-center text-sm text-ink-500">No tenants found.</div>}
          </div>
        </section>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: number; detail: string }) {
  return (
    <div className="rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <p className="mt-4 font-display text-4xl font-medium text-ink-950">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{detail}</p>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-4 py-3 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`align-middle px-4 py-3 text-ink-700 ${className}`}>{children}</td>;
}
