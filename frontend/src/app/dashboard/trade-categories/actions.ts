'use server';

import { apiFetch, ApiError } from '@/lib/api/server-client';

export interface TradeCategoryWithFee {
  id: string;
  code: string;
  displayName: string;
  sector: 'FOOD' | 'PERSONAL_CARE' | 'CHILDCARE';
  description?: string | null;
  validityPeriodDays: number;
  isActive: boolean;
  fee?: {
    tenantId: string;
    tradeCategoryId: string;
    feeAmount: number;
    currency: string;
    effectiveFrom: string;
    updatedBy: string;
    updatedAt: string;
  } | null;
}

export async function listCategoriesAction(): Promise<TradeCategoryWithFee[]> {
  try {
    return await apiFetch<TradeCategoryWithFee[]>('/trade-categories', { authenticated: true });
  } catch (error) {
    throw new Error(error instanceof ApiError ? error.message : 'Failed to load trade categories.');
  }
}

export async function setFeeAction(categoryId: string, amount: number): Promise<void> {
  await saveFee(categoryId, amount, 'Failed to set fee.');
}

export async function updateFeeAction(categoryId: string, amount: number): Promise<void> {
  await saveFee(categoryId, amount, 'Failed to update fee.');
}

export async function deleteFeeAction(categoryId: string): Promise<void> {
  try {
    await apiFetch(`/trade-categories/${encodeURIComponent(categoryId)}/fee`, {
      method: 'DELETE',
      authenticated: true,
    });
  } catch (error) {
    throw new Error(error instanceof ApiError ? error.message : 'Failed to delete fee.');
  }
}

async function saveFee(categoryId: string, amount: number, fallback: string): Promise<void> {
  try {
    await apiFetch(`/trade-categories/${encodeURIComponent(categoryId)}/fee`, {
      method: 'PUT',
      authenticated: true,
      body: { feeAmount: amount },
    });
  } catch (error) {
    throw new Error(error instanceof ApiError ? error.message : fallback);
  }
}
