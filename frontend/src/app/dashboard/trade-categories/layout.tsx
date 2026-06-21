import { redirect } from 'next/navigation';
import { readActorFromAccessToken } from '@/lib/auth/claims';

export default async function TradeCategoriesLayout({ children }: { children: React.ReactNode }) {
  const actor = await readActorFromAccessToken();
  if (!actor?.permissions.includes('trade.set_fee')) redirect('/dashboard');
  return children;
}
