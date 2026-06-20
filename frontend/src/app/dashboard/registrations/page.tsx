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
  uid: string | null;
  status: 'DRAFT' | 'SUBMITTED_FOR_REVIEW' | 'READY_FOR_SCREENING' | 'CANCELLED';
  createdAt: string;
  submittedAt: string | null;
};

const statusStyles: Record<string, string> = {
  Draft: 'bg-ink-100 text-ink-700',
  'Submitted for review': 'bg-info/10 text-info',
  'Ready for screening': 'bg-success/10 text-success',
  Cancelled: 'bg-danger/10 text-danger',
};

const STATUS_TABS: Array<{ label: string; value: Registration['status'] | '' }> = [
  { label: 'All registrations', value: '' },
  { label: 'Drafts', value: 'DRAFT' },
  { label: 'Review', value: 'SUBMITTED_FOR_REVIEW' },
  { label: 'Ready', value: 'READY_FOR_SCREENING' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

type RegistrationsSearchParams = {
  q?: string;
  status?: Registration['status'];
};

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams?: RegistrationsSearchParams | Promise<RegistrationsSearchParams>;
}) {
  const params = await Promise.resolve(searchParams);
  let items: Registration[] = [];
  let loadError = '';
  const q = params?.q?.trim() ?? '';
  const statusFilter = params?.status;
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
  const readyCount = items.filter((item) => item.status === 'READY_FOR_SCREENING').length;
  const cancelledCount = items.filter((item) => item.status === 'CANCELLED').length;
  const missingDocs = items.filter((item) => item.status !== 'CANCELLED' && (!item.tradeCategory || !item.phone)).length;
  const activeCount = items.length - cancelledCount;

  return (
    <div className="space-y-6">
      <header className="rounded-sm border border-ink-200 bg-white p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Registration operations</p>
            <h1 className="mt-2 font-display text-4xl font-medium text-ink-950">
              Registrations
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600">
              Capture applicants, complete payment handoff, and prepare approved handlers for medical screening from one queue.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/registrations/new">
              <Plus className="mr-2 h-4 w-4" />
              New registration
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={ClipboardList} label="Active records" value={`${activeCount}`} detail="Saved registrations" />
        <Metric icon={Clock3} label="Drafts" value={`${draftCount}`} detail="Still being captured" />
        <Metric icon={FileWarning} label="Needs details" value={`${missingDocs}`} detail="Incomplete draft fields" />
        <Metric icon={BadgeCheck} label="Awaiting review" value={`${reviewCount}`} detail="Submitted by registrars" />
        <Metric icon={BadgeCheck} label="Ready" value={`${readyCount}`} detail="Payment approved" />
      </section>

      <section className="rounded-sm border border-ink-200 bg-white p-4">
        <form
          action="/dashboard/registrations"
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              name="q"
              defaultValue={q}
              className="pl-9"
              placeholder="Search by UID, name, phone, category, or business"
              aria-label="Search registrations"
            />
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              <Search className="mr-2 h-3.5 w-3.5" />
              Search
            </Button>
            {(q || statusFilter) && (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/registrations">Clear</Link>
              </Button>
            )}
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <Button key={tab.value || 'all'} asChild size="sm" variant={(statusFilter ?? '') === tab.value ? 'default' : 'outline'}>
              <Link href={buildRegistrationsHref({ q, status: tab.value || undefined })}>
                {tab.value && <Filter className="mr-2 h-3.5 w-3.5" />}
                {tab.label}
              </Link>
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-ink-200 bg-white">
        <div className="flex items-center gap-3 border-b border-ink-100 p-5">
          <ClipboardList className="h-4 w-4 text-accent" />
          <h2 className="text-base font-semibold text-ink-900">Registration queue</h2>
        </div>
        {loadError && <p className="p-5 text-sm text-danger">{loadError}</p>}
        {!loadError && items.length === 0 && (
          <p className="p-5 text-sm text-ink-500">
            {q || statusFilter ? 'No registrations match this filter.' : 'No registrations yet.'}
          </p>
        )}
        <div className="grid gap-4 p-5">
          {items.map((handler) => {
            const name = [handler.firstName, handler.lastName].filter(Boolean).join(' ') || 'Unnamed handler';
            const status = displayStatus(handler.status);
            return (
              <div key={handler.id} className="grid gap-4 rounded-sm border border-ink-100 bg-white p-4 shadow-sm xl:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{name}</p>
                      <p className="mt-1 font-mono text-xs text-ink-500">{handler.uid ?? handler.id}</p>
                      <p className="mt-1 text-xs text-ink-500">{handler.phone || 'No phone yet'}</p>
                    </div>
                    <span className={`rounded-sm px-2 py-1 text-xs font-medium ${statusStyles[status]}`}>
                      {status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-600">
                    <span className="rounded-sm bg-ink-50 px-2.5 py-1">{handler.tradeCategory || 'Not selected'}</span>
                    {handler.businessName && <span className="rounded-sm bg-ink-50 px-2.5 py-1">{handler.businessName}</span>}
                    <span className="rounded-sm bg-ink-50 px-2.5 py-1">Updated {formatDate(handler.submittedAt ?? handler.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  {handler.status === 'DRAFT' && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/registrations/${handler.id}`}>
                        Review draft
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/registrations/${handler.id}`}>
                      Open
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
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
  if (status === 'SUBMITTED_FOR_REVIEW') return 'Submitted for review';
  if (status === 'READY_FOR_SCREENING') return 'Ready for screening';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Draft';
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
