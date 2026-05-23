// src/app/dashboard/trade-categories/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FeeModal } from '@/components/trade-categories/FeeModal';
import { DeleteConfirmDialog } from '@/components/trade-categories/DeleteConfirmDialog';
import { TradeCategoryWithFee } from './actions';
import {
  listCategoriesAction,
  setFeeAction,
  updateFeeAction,
  deleteFeeAction,
} from './actions';

const SECTOR_COLORS = {
  FOOD: 'bg-amber-100 text-amber-800',
  PERSONAL_CARE: 'bg-purple-100 text-purple-800',
  CHILDCARE: 'bg-pink-100 text-pink-800',
};

const SECTOR_LABELS = {
  FOOD: 'Food',
  PERSONAL_CARE: 'Personal Care',
  CHILDCARE: 'Childcare',
};

// Safely get fee amount regardless of casing from API
function getFeeAmount(fee: any): number | undefined {
  if (!fee) return undefined;
  return fee.feeAmount ?? fee.fee_amount;
}

// Safely get validity period regardless of casing from API
function getValidityDays(category: any): number {
  return category.validityPeriodDays ?? category.validity_period_days ?? 365;
}

// Safely get display name regardless of casing from API
function getDisplayName(category: any): string {
  return category.displayName ?? category.display_name ?? '';
}

export default function TradeCategoriesPage() {
  const [categories, setCategories] = useState<TradeCategoryWithFee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
    const loadCategories = async () => {
      try {
        setIsLoading(true);
        const data = await listCategoriesAction();
        const sorted = [...data]
          .filter((c) => c && c.sector && getDisplayName(c))
          .sort((a, b) => {
            const sectorCmp = (a.sector || '').localeCompare(b.sector || '');
            if (sectorCmp !== 0) return sectorCmp;
            return getDisplayName(a).localeCompare(getDisplayName(b));
          });
        setCategories(sorted);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trade categories');
        setCategories([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadCategories();
  }, []);

  const handleFeeSubmit = async (categoryId: string, amount: number) => {
    setIsModalLoading(true);
    try {
      if (feeModal.mode === 'set') {
        await setFeeAction(categoryId, amount);
      } else {
        await updateFeeAction(categoryId, amount);
      }
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? { ...c, fee: { feeAmount: amount, currency: 'NGN' } as any }
            : c
        )
      );
      setFeeModal({ isOpen: false, category: null, mode: 'set' });
    } catch (err) {
      throw err;
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    setIsDeleteLoading(true);
    try {
      await deleteFeeAction(categoryId);
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, fee: undefined } : c))
      );
      setDeleteDialog({ isOpen: false, category: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete fee');
    } finally {
      setIsDeleteLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Trade Categories"
          description="Manage registration fees for each trade category in your jurisdiction."
        />

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="text-neutral-600">Loading categories...</div>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 bg-neutral-50 rounded-lg border border-neutral-200">
            <p className="text-neutral-600">No categories available</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wide">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wide">Sector</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wide">Validity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wide">Fee</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-neutral-700 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {categories.map((category) => {
                  const feeAmount = getFeeAmount(category.fee);
                  const hasFee = feeAmount !== undefined && feeAmount !== null;
                  return (
                    <tr key={category.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{getDisplayName(category)}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">{category.code}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded ${SECTOR_COLORS[category.sector]}`}>
                          {SECTOR_LABELS[category.sector]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-neutral-700">{getValidityDays(category)} days</p>
                      </td>
                      <td className="px-6 py-4">
                        {hasFee ? (
                          <p className="text-sm font-semibold text-neutral-900">
                            ₦{feeAmount!.toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-sm text-neutral-500 italic">Not set</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {!hasFee ? (
                            <button
                              onClick={() => setFeeModal({ isOpen: true, category, mode: 'set' })}
                              className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 rounded hover:bg-teal-100 transition-colors"
                            >
                              Set Fee
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => setFeeModal({ isOpen: true, category, mode: 'edit' })}
                                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                              >
                                Edit Fee
                              </button>
                              <button
                                onClick={() => setDeleteDialog({ isOpen: true, category })}
                                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
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
