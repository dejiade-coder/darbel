// src/app/dashboard/trade-categories/actions.ts
'use server';

import { cookies } from 'next/headers';

const API_BASE_URL = 'http://localhost:4000/api/v1';

export interface TradeCategoryWithFee {
  id: string;
  code: string;
  displayName: string;
  sector: 'FOOD' | 'PERSONAL_CARE' | 'CHILDCARE';
  description?: string;
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
  };
}

async function apiCall(
  endpoint: string,
  options: { method: string; body?: unknown } = { method: 'GET' }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get('darbel_at')?.value;

  console.log('[Server Action] Calling:', endpoint);
  console.log('[Server Action] Has token:', !!token);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  console.log('[Server Action] Full URL:', url);

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  console.log('[Server Action] Status:', response.status);

  if (response.status === 204) return null;

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.log('[Server Action] Error body:', errorData);
    throw new Error(
      errorData.message || `Request failed with status ${response.status}`
    );
  }

  const data = await response.json();
  console.log('[Server Action] Response data:', JSON.stringify(data).slice(0, 200));
  return data;
}

export async function listCategoriesAction(): Promise<TradeCategoryWithFee[]> {
  console.log('[listCategoriesAction] Called');
  try {
    const result = await apiCall('/trade-categories');
    console.log('[listCategoriesAction] Got', Array.isArray(result) ? result.length : 0, 'items');
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('[listCategoriesAction] Failed:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to load categories'
    );
  }
}

export async function setFeeAction(
  categoryId: string,
  amount: number
): Promise<void> {
  console.log('[setFeeAction] Called:', categoryId, amount);
  try {
    await apiCall(`/trade-categories/${categoryId}/fee`, {
      method: 'PUT',
      body: { feeAmount: amount },
    });
  } catch (error) {
    console.error('[setFeeAction] Failed:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to set fee'
    );
  }
}

export async function updateFeeAction(
  categoryId: string,
  amount: number
): Promise<void> {
  try {
    await apiCall(`/trade-categories/${categoryId}/fee`, {
      method: 'PUT',
      body: { feeAmount: amount },
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to update fee'
    );
  }
}

export async function deleteFeeAction(categoryId: string): Promise<void> {
  console.log('[deleteFeeAction] Called:', categoryId);
  try {
    await apiCall(`/trade-categories/fees/${categoryId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('[deleteFeeAction] Failed:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to delete fee'
    );
  }
}
