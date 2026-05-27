// src/components/trade-categories/DeleteConfirmDialog.tsx
'use client';

import type { TradeCategoryWithFee } from '@/app/dashboard/trade-categories/actions';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  category: TradeCategoryWithFee | null;
  onClose: () => void;
  onConfirm: (categoryId: string) => Promise<void>;
  isLoading?: boolean;
}

export function DeleteConfirmDialog({
  isOpen,
  category,
  onClose,
  onConfirm,
  isLoading = false,
}: DeleteConfirmDialogProps) {
  if (!isOpen || !category) return null;

  const handleConfirm = async () => {
    try {
      await onConfirm(category.id);
      onClose();
    } catch (err) {
      // Error handling is done in parent component
      console.error('Delete failed:', err);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-sm w-full">
          {/* Header */}
          <div className="border-b border-neutral-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-neutral-900">
              Delete Fee
            </h2>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            <p className="text-sm text-neutral-700">
              Are you sure you want to delete the fee for{' '}
              <strong>{getDisplayName(category)}</strong>?
            </p>
            <p className="text-sm text-neutral-600 mt-2">
              Current fee: <strong>NGN {getFeeAmount(category.fee)?.toLocaleString()}</strong>
            </p>
            <p className="text-sm text-red-600 mt-3">
              This action cannot be undone. Handlers will no longer be able to
              register for this category until a new fee is set.
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-200 px-6 py-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Deleting...' : 'Delete Fee'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function getFeeAmount(fee: TradeCategoryWithFee['fee']): number | undefined {
  if (!fee) return undefined;
  return fee.feeAmount ?? (fee as { fee_amount?: number }).fee_amount;
}

function getDisplayName(category: TradeCategoryWithFee): string {
  return category.displayName ?? (category as { display_name?: string }).display_name ?? '';
}
