import { redirect } from 'next/navigation';
import { readActorFromAccessToken } from '@/lib/auth/claims';

export default function RootPage() {
  const actor = readActorFromAccessToken();
  if (actor) {
    redirect('/dashboard');
  }
  redirect('/login');
}
