import { Building2, ShieldCheck, Users } from 'lucide-react';
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
  try { tenants = await apiFetch<TenantPublic[]>('/tenants', { authenticated: true }); }
  catch (error) { loadError = error instanceof ApiError ? error.message : 'Could not load tenants.'; }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Tenants" description="Provision and manage the organizations that operate independently on Darbel." />
      {params?.error && <Alert variant="danger">{params.error}</Alert>}
      {params?.success && <Alert variant="success">{params.success}</Alert>}
      {loadError && <Alert variant="danger">{loadError}</Alert>}
      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <form action={createTenantAction} className="space-y-4 rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-accent" /><div><h2 className="font-semibold text-ink-900">New organization</h2><p className="text-sm text-ink-600">Creates an isolated tenant and its first administrator.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Organization name"><Input name="legalName" required placeholder="Example Foods Ltd" /></Field>
            <Field label="Display name"><Input name="displayName" required placeholder="Example Foods" /></Field>
            <Field label="Tenant code"><Input name="code" required maxLength={20} placeholder="EXAMPLE" /></Field>
            <Field label="Organization email"><Input name="contactEmail" type="email" required placeholder="office@example.com" /></Field>
            <Field label="Organization phone"><Input name="contactPhone" placeholder="080..." /></Field>
          </div>
          <div className="border-t border-ink-100 pt-4"><div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /><h3 className="text-sm font-semibold text-ink-900">First tenant administrator</h3></div>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Full name"><Input name="adminName" required placeholder="Admin name" /></Field><Field label="Email"><Input name="adminEmail" type="email" required placeholder="admin@example.com" /></Field><Field label="Phone"><Input name="adminPhone" placeholder="080..." /></Field><Field label="Initial password"><Input name="initialPassword" type="password" minLength={12} required /></Field></div>
          </div>
          <Button type="submit">Create tenant</Button>
        </form>
        <section className="overflow-hidden rounded-sm border border-ink-200 bg-white shadow-sm"><div className="border-b border-ink-100 p-5"><h2 className="font-semibold text-ink-900">Organizations</h2><p className="text-sm text-ink-600">Each tenant has separate staff, operational records, fees, templates, and settings.</p></div><div className="divide-y divide-ink-100">{tenants.map((tenant) => <div key={tenant.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="font-semibold text-ink-900">{tenant.displayName}</p><p className="mt-1 text-xs text-ink-500">{tenant.code} · {tenant.contactEmail} · {tenant.userCount} users</p></div><form action={setTenantStatusAction}><input type="hidden" name="id" value={tenant.id} /><input type="hidden" name="isActive" value={String(!tenant.isActive)} /><Button type="submit" size="sm" variant={tenant.isActive ? 'outline' : 'default'}>{tenant.isActive ? 'Suspend' : 'Activate'}</Button></form></div>)}{tenants.length === 0 && <div className="p-8 text-center text-sm text-ink-500">No tenants found.</div>}</div></section>
      </section>
    </div>
  );
}
