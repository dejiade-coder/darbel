import { NewRegistrationForm, type TradeCategoryOption } from './new-registration-form';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserPublic } from '@/lib/api/types';

export const metadata = { title: 'New registration' };

export default async function NewRegistrationPage() {
  const actor = await readActorFromAccessToken();

  let profile: UserPublic | null = null;
  let tradeCategories: TradeCategoryOption[] = [];
  try {
    const [profileResult, categoriesResult] = await Promise.all([
      apiFetch<UserPublic>('/users/me', { authenticated: true }),
      apiFetch<TradeCategoryOption[]>('/trade-categories?withFeeOnly=true', { authenticated: true }).catch(() => []),
    ]);
    profile = profileResult;
    tradeCategories = categoriesResult;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }

  return (
    <NewRegistrationForm
      registrar={{
        name: profile?.fullName ?? actor?.email ?? '',
        email: profile?.email ?? actor?.email ?? '',
        phone: profile?.phone ?? '',
        isActive: profile?.isActive ?? true,
      }}
      tradeCategories={tradeCategories}
    />
  );
}
