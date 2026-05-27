// src/components/trade-categories/FeeModal.tsx
'use client';

import { useState } from 'react';
import type { TradeCategoryWithFee } from '@/app/dashboard/trade-categories/actions';

interface FeeModalProps {
  isOpen: boolean;
  category: TradeCategoryWithFee | null;
  mode: 'set' | 'edit';
  onClose: () => void;
  onSubmit: (categoryId: string, amount: number) => Promise<void>;
  isLoading?: boolean;
}

export function FeeModal({
  isOpen,
  category,
  mode,
  onClose,
  onSubmit,
  isLoading = false,
}: FeeModalProps) {
  const [amount, setAmount] = useState(
    getFeeAmount(category?.fee)?.toString() || ''
  );
  const [error, setError] = useState('');

  if (!isOpen || !category) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Fee must be a positive number');
      return;
    }

    if (numAmount < 100) {
      setError('Fee must be at least ₦100');
      return;
    }

    try {
      await onSubmit(category.id, numAmount);
      setAmount('');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save fee'
      );
    }
  };

  const handleClose = () => {
    setAmount('');
    setError('');
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-sm w-full">
          {/* Header */}
          <div className="border-b border-neutral-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-neutral-900">
              {mode === 'set' ? 'Set Fee' : 'Update Fee'}
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              {getDisplayName(category)}
            </p>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {/* Amount input */}
            <div>
              <label
                htmlFor="fee-amount"
                className="block text-sm font-medium text-neutral-700 mb-1"
              >
                Fee Amount (NGN)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-neutral-600 font-medium">
                  ₦
                </span>
                <input
                  id="fee-amount"
                  type="number"
                  step="0.01"
                  min="100"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  placeholder="0.00"
                  disabled={isLoading}
                  className="w-full pl-8 pr-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-neutral-50 disabled:text-neutral-500"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Current fee info (edit mode) */}
            {mode === 'edit' && category.fee && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  Current fee: <strong>NGN {getFeeAmount(category.fee)?.toLocaleString()}</strong>
                </p>
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="border-t border-neutral-200 px-6 py-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? 'Saving...'
                : mode === 'set'
                  ? 'Set Fee'
                  : 'Update Fee'}
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
