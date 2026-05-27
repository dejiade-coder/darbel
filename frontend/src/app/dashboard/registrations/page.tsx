import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Clock3,
  FileWarning,
  Filter,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch, ApiError } from '@/lib/api/server-client';

export const metadata = { title: 'Registrations' };

type Registration = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  tradeCategory: string | null;
  businessName: string | null;
  status: 'DRAFT' | 'SUBMITTED_FOR_REVIEW';
  createdAt: string;
  submittedAt: string | null;
};

const statusStyles: Record<string, string> = {
  Draft: 'bg-ink-100 text-ink-700',
  'Submitted for review': 'bg-info/10 text-info',
};

type RegistrationsSearchParams = {
  q?: string;
  status?: Registration['status'];
};

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams?: RegistrationsSearchParams;
}) {
  let items: Registration[] = [];
  let loadError = '';
  const q = searchParams?.q?.trim() ?? '';
  const statusFilter = searchParams?.status;
  const apiParams = new URLSearchParams();
  if (q) apiParams.set('q', q);
  if (statusFilter) apiParams.set('status', statusFilter);
  const apiPath = `/registrations${apiParams.size ? `?${apiParams.toString()}` : ''}`;

  try {
    const result = await apiFetch<{ items: Registration[]; nextCursor: string | null }>(
      apiPath,
      { authenticated: true },
    );
    items = result.items;
  } catch (e) {
    if (e instanceof ApiError) {
      loadError = e.message;
    } else {
      throw e;
    }
  }

  const draftCount = items.filter((item) => item.status === 'DRAFT').length;
  const reviewCount = items.filter((item) => item.status === 'SUBMITTED_FOR_REVIEW').length;
  const missingDocs = items.filter((item) => !item.tradeCategory || !item.phone).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-ink-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Phase 2</p>
          <h1 className="mt-1 font-display text-4xl font-medium text-ink-900">
            Registrations
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            Intake, review, and prepare food handler records before payment and medical screening.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/registrations/new">
            <Plus className="mr-2 h-4 w-4" />
            New registration
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={ClipboardList} label="Active records" value={`${items.length}`} detail="Saved registrations" />
        <Metric icon={Clock3} label="Drafts" value={`${draftCount}`} detail="Still being captured" />
        <Metric icon={FileWarning} label="Needs details" value={`${missingDocs}`} detail="Incomplete draft fields" />
        <Metric icon={BadgeCheck} label="Awaiting review" value={`${reviewCount}`} detail="Submitted by registrars" />
      </section>

      <section className="rounded-sm border border-ink-200 bg-white">
        <form
          action="/dashboard/registrations"
          className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              name="q"
              defaultValue={q}
              className="pl-9"
              placeholder="Search by name, phone, category, or business"
              aria-label="Search registrations"
            />
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" size="sm">
              <Search className="mr-2 h-3.5 w-3.5" />
              Search
            </Button>
            <Button asChild variant={statusFilter === 'DRAFT' ? 'default' : 'outline'} size="sm">
              <Link href={buildRegistrationsHref({ q, status: 'DRAFT' })}>
                <Filter className="mr-2 h-3.5 w-3.5" />
                Drafts
              </Link>
            </Button>
            <Button asChild variant={statusFilter === 'SUBMITTED_FOR_REVIEW' ? 'default' : 'outline'} size="sm">
              <Link href={buildRegistrationsHref({ q, status: 'SUBMITTED_FOR_REVIEW' })}>
                <Filter className="mr-2 h-3.5 w-3.5" />
                Review
              </Link>
            </Button>
            {(q || statusFilter) && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/registrations">Clear</Link>
              </Button>
            )}
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-[0.14em] text-ink-500">
              <tr>
                <th className="px-5 py-3 font-medium">Handler</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Updated</th>
                <th className="px-5 py-3 text-right font-medium">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loadError && (
                <tr>
                  <td className="px-5 py-8 text-sm text-danger" colSpan={5}>
                    {loadError}
                  </td>
                </tr>
              )}
              {!loadError && items.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-sm text-ink-500" colSpan={5}>
                    {q || statusFilter ? 'No registrations match this filter.' : 'No registrations yet.'}
                  </td>
                </tr>
              )}
              {items.map((handler) => {
                const name = [handler.firstName, handler.lastName].filter(Boolean).join(' ') || 'Unnamed handler';
                const status = displayStatus(handler.status);
                return (
                <tr key={handler.id} className="hover:bg-ink-50/70">
                  <td className="px-5 py-4">
                    <p className="font-medium text-ink-900">{name}</p>
                    <p className="mt-1 font-mono text-xs text-ink-500">{handler.id}</p>
                    <p className="mt-1 text-xs text-ink-500">{handler.phone || 'No phone yet'}</p>
                  </td>
                  <td className="px-5 py-4 text-ink-700">{handler.tradeCategory || 'Not selected'}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-sm px-2 py-1 text-xs font-medium ${statusStyles[status]}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-600">{formatDate(handler.submittedAt ?? handler.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <Button asChild variant="ghost" size="icon" aria-label={`Open ${name}`}>
                      <Link href={`/dashboard/registrations/${handler.id}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <WorkflowStep n="1" title="Intake" detail="Capture identity, address, trade category, and first document checks." />
        <WorkflowStep n="2" title="Payment" detail="Confirm the tenant fee before moving the handler to medical screening." />
        <WorkflowStep n="3" title="Medical handoff" detail="Prepare the record for lab collection and officer review in Phase 3." />
      </section>
    </div>
  );
}

function displayStatus(status: Registration['status']): string {
  return status === 'SUBMITTED_FOR_REVIEW' ? 'Submitted for review' : 'Draft';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function buildRegistrationsHref({
  q,
  status,
}: {
  q?: string;
  status?: Registration['status'];
}): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  const query = params.toString();
  return `/dashboard/registrations${query ? `?${query}` : ''}`;
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-sm border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
        <Icon className="h-4 w-4 text-accent" strokeWidth={1.6} />
      </div>
      <p className="mt-3 font-display text-3xl font-medium text-ink-900">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{detail}</p>
    </div>
  );
}

function WorkflowStep({ n, title, detail }: { n: string; title: string; detail: string }) {
  return (
    <div className="rounded-sm border border-ink-200 bg-white p-4">
      <Badge variant="outline" className="font-mono">
        {n}
      </Badge>
      <h2 className="mt-3 text-sm font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 text-sm text-ink-600">{detail}</p>
    </div>
  );
}
