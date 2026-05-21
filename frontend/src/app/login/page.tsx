import { redirect } from 'next/navigation';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { LoginForm } from './login-form';
import { loginAction } from './actions';
import { AuthShell } from '@/components/layout/auth-shell';

export const metadata = { title: 'Sign in' };

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const actor = readActorFromAccessToken();
  if (actor) redirect('/dashboard');

  return (
    <AuthShell
      title="Sign in"
      subtitle="Darbel — Food Handler Compliance Platform"
    >
      <LoginForm action={loginAction} initialError={searchParams?.error} />
    </AuthShell>
  );
}
