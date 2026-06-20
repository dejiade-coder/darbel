'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Banknote, Layers3, Search, Settings2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { DeleteConfirmDialog } from '@/components/trade-categories/DeleteConfirmDialog';
import { FeeModal } from '@/components/trade-categories/FeeModal';
import type { TradeCategoryWithFee } from './actions';
import { deleteFeeAction, listCategoriesAction, setFeeAction, updateFeeAction } from './actions';

const SECTOR_LABELS: Record<TradeCategoryWithFee['sector'], string> = {
  FOOD: 'Food',
  PERSONAL_CARE: 'Personal Care',
  CHILDCARE: 'Childcare',
};

export default function TradeCategoriesPage() {
  const [categories, setCategories] = useState<TradeCategoryWithFee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('');

  const [feeModal, setFeeModal] = useState<{
    isOpen: boolean;
    category: TradeCategoryWithFee | null;
    mode: 'set' | 'edit';
  }>({ isOpen: false, category: null, mode: 'set' });
  const [isModalLoading, setIsModalLoading] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    category: TradeCategoryWithFee | null;
  }>({ isOpen: false, category: null });
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  useEffect(() => {
    void loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setIsLoading(true);
      const data = await listCategoriesAction();
      setCategories(
        [...data]
          .filter((category) => category?.isActive !== false)
          .sort((a, b) => a.sector.localeCompare(b.sector) || a.displayName.localeCompare(b.displayName)),
      );
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trade categories.');
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const token = query.trim().toLowerCase();
    return categories.filter((category) => {
      const matchesSector = !sector || category.sector === sector;
      const matchesQuery =
        !token ||
        category.displayName.toLowerCase().includes(token) ||
        category.code.toLowerCase().includes(token) ||
        (category.description ?? '').toLowerCase().includes(token);
      return matchesSector && matchesQuery;
    });
  }, [categories, query, sector]);

  const configuredCount = categories.filter((category) => hasFee(category)).length;
  const missingCount = categories.length - configuredCount;
  const totalFeeValue = categories.reduce((sum, category) => sum + (getFeeAmount(category.fee) ?? 0), 0);
  const coverage = categories.length ? Math.round((configuredCount / categories.length) * 100) : 0;

  async function handleFeeSubmit(categoryId: string, amount: number) {
    setIsModalLoading(true);
    try {
      if (feeModal.mode === 'set') {
        await setFeeAction(categoryId, amount);
      } else {
        await updateFeeAction(categoryId, amount);
      }
      setCategories((current) =>
        current.map((category) =>
          category.id === categoryId
            ? {
                ...category,
                fee: {
                  tenantId: category.fee?.tenantId ?? '',
                  tradeCategoryId: categoryId,
                  feeAmount: amount,
                  currency: 'NGN',
                  effectiveFrom: new Date().toISOString(),
                  updatedBy: category.fee?.updatedBy ?? '',
                  updatedAt: new Date().toISOString(),
                },
              }
            : category,
        ),
      );
      setFeeModal({ isOpen: false, category: null, mode: 'set' });
    } finally {
      setIsModalLoading(false);
    }
  }

  async function handleDelete(categoryId: string) {
    setIsDeleteLoading(true);
    try {
      await deleteFeeAction(categoryId);
      setCategories((current) => current.map((category) => (category.id === categoryId ? { ...category, fee: null } : category)));
      setDeleteDialog({ isOpen: false, category: null });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete fee.');
    } finally {
      setIsDeleteLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Tenant setup"
          title="Trade Categories"
          description="Manage registration fees for each trade category. Missing fees block smooth onboarding because handlers cannot be priced consistently."
        />

        {error && <Alert variant="danger">{error}</Alert>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Layers3} label="Categories" value={String(categories.length)} detail="active categories" />
          <Metric icon={BadgeCheck} label="Fee coverage" value={`${coverage}%`} detail={`${configuredCount} configured`} />
          <Metric icon={AlertTriangle} label="Missing fees" value={String(missingCount)} detail="need attention" warning={missingCount > 0} />
          <Metric icon={Banknote} label="Total listed fees" value={formatCurrency(totalFeeValue)} detail="across configured categories" />
        </section>

        <section className="rounded-sm border border-ink-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search category, code, or description"
                className="h-10 w-full rounded-sm border border-ink-200 bg-white pl-9 pr-3 text-sm placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <select
              value={sector}
              onChange={(event) => setSector(event.target.value)}
              className="h-10 rounded-sm border border-ink-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="">All sectors</option>
              {Object.entries(SECTOR_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {(query || sector) && (
              <Button type="button" variant="ghost" onClick={() => { setQuery(''); setSector(''); }}>
                Clear
              </Button>
            )}
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-sm border border-ink-200 bg-white p-10 text-center text-sm text-ink-500">Loading categories...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-sm border border-ink-200 bg-white p-10 text-center text-sm text-ink-500">No categories match this view.</div>
        ) : (
          <div className="overflow-hidden rounded-sm border border-ink-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50/40 text-left">
                  <Th>Category</Th>
                  <Th>Sector</Th>
                  <Th>Validity</Th>
                  <Th>Fee</Th>
                  <Th>Readiness</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((category) => {
                  const feeAmount = getFeeAmount(category.fee);
                  const feeReady = hasFee(category);
                  return (
                    <tr key={category.id} className="border-b border-ink-100 transition-colors last:border-0 hover:bg-ink-50/40">
                      <Td>
                        <p className="font-medium text-ink-900">{category.displayName}</p>
                        <p className="mt-1 font-mono text-xs text-ink-500">{category.code}</p>
                        {category.description && <p className="mt-1 max-w-md text-xs text-ink-500">{category.description}</p>}
                      </Td>
                      <Td>
                        <Badge variant="accent">{SECTOR_LABELS[category.sector] ?? category.sector}</Badge>
                      </Td>
                      <Td>
                        <span className="text-ink-700">{category.validityPeriodDays} days</span>
                      </Td>
                      <Td>
                        {feeReady ? (
                          <div>
                            <p className="font-semibold text-ink-900">{formatCurrency(feeAmount ?? 0)}</p>
                            <p className="mt-1 text-xs text-ink-500">{category.fee?.currency ?? 'NGN'}</p>
                          </div>
                        ) : (
                          <span className="text-sm italic text-ink-400">Not set</span>
                        )}
                      </Td>
                      <Td>
                        <Badge variant={feeReady ? 'success' : 'warning'}>{feeReady ? 'Ready' : 'Fee missing'}</Badge>
                      </Td>
                      <Td align="right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant={feeReady ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => setFeeModal({ isOpen: true, category, mode: feeReady ? 'edit' : 'set' })}
                          >
                            <Settings2 className="mr-2 h-3.5 w-3.5" />
                            {feeReady ? 'Edit fee' : 'Set fee'}
                          </Button>
                          {feeReady && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteDialog({ isOpen: true, category })}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FeeModal
        isOpen={feeModal.isOpen}
        category={feeModal.category}
        mode={feeModal.mode}
        onClose={() => setFeeModal({ isOpen: false, category: null, mode: 'set' })}
        onSubmit={handleFeeSubmit}
        isLoading={isModalLoading}
      />

      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        category={deleteDialog.category}
        onClose={() => setDeleteDialog({ isOpen: false, category: null })}
        onConfirm={handleDelete}
        isLoading={isDeleteLoading}
      />
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

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'} text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500`}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <td className={`px-4 py-3 align-top ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</td>;
}

function getFeeAmount(fee: TradeCategoryWithFee['fee']): number | undefined {
  return fee?.feeAmount;
}

function hasFee(category: TradeCategoryWithFee): boolean {
  const amount = getFeeAmount(category.fee);
  return amount !== undefined && amount !== null && amount > 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value);
}
