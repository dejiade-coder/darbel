import { redirect } from 'next/navigation';
import { readActorFromAccessToken } from '@/lib/auth/claims';

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  const actor = await readActorFromAccessToken();
  if (!actor?.permissions.includes('user.create')) redirect('/dashboard');
  return children;
}
