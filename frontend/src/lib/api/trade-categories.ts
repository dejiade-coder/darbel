// src/lib/api/trade-categories.ts
import { apiFetch } from './server-client';

export interface TradeCategory {
  id: string;
  code: string;
  display_name: string;
  sector: 'FOOD' | 'PERSONAL_CARE' | 'CHILDCARE';
  description?: string;
  validity_period_days: number;
  is_active: boolean;
}

export interface TradeCategoryFee {
  tenant_id: string;
  trade_category_id: string;
  fee_amount: number;
  currency: string;
  effective_from: string;
  updated_by: string;
  updated_at: string;
}

export interface TradeCategoryWithFee extends TradeCategory {
  fee?: TradeCategoryFee;
}

/**
 * List all trade categories for the jurisdiction with optional fee filtering.
 * Returns categories with their fees (if set for this tenant).
 */
export async function listTradeCategories(params?: {
  jurisdictionId?: string;
  hasFee?: boolean;
}): Promise<TradeCategoryWithFee[]> {
  const searchParams = new URLSearchParams();
  if (params?.jurisdictionId) {
    searchParams.append('jurisdictionId', params.jurisdictionId);
  }
  if (params?.hasFee !== undefined) {
    searchParams.append('hasFee', String(params.hasFee));
  }

  const query = searchParams.toString();
  const url = `/trade-categories${query ? `?${query}` : ''}`;

  return apiFetch<TradeCategoryWithFee[]>(url, { method: 'GET', authenticated: true });
}

/**
 * Set a fee for a category that doesn't yet have one for this tenant.
 * Returns 200 with the created fee object.
 */
export async function setTradeCategoryFee(
  tradeCategoryId: string,
  feeAmount: number
): Promise<TradeCategoryFee> {
  return apiFetch<TradeCategoryFee>('/trade-categories/fees', {
    method: 'POST',
    authenticated: true,
    body: {
      tradeCategoryId,
      feeAmount,
    },
  });
}

/**
 * Update an existing fee for a category.
 * Returns 200 with the updated fee object.
 */
export async function updateTradeCategoryFee(
  tradeCategoryId: string,
  newFeeAmount: number
): Promise<TradeCategoryFee> {
  return apiFetch<TradeCategoryFee>(
    `/trade-categories/fees/${tradeCategoryId}`,
    {
      method: 'PUT',
      authenticated: true,
      body: {
        feeAmount: newFeeAmount,
      },
    }
  );
}

/**
 * Delete a fee for a category.
 * Returns 204 No Content on success.
 */
export async function deleteTradeCategoryFee(
  tradeCategoryId: string
): Promise<void> {
  await apiFetch(`/trade-categories/fees/${tradeCategoryId}`, {
    method: 'DELETE',
    authenticated: true,
  });
}
