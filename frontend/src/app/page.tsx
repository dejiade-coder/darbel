import { redirect } from 'next/navigation';
import { readActorFromAccessToken } from '@/lib/auth/claims';

export default async function RootPage() {
  const actor = await readActorFromAccessToken();
  if (actor) {
    redirect('/dashboard');
  }
  redirect('/login');
}
