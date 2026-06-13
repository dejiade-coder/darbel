import { redirect } from 'next/navigation';
import { getChallengeCookie } from '@/lib/auth/session';
import { AuthShell } from '@/components/layout/auth-shell';
import { SetupPasswordForm } from './setup-password-form';
import { setupPasswordAction } from './actions';

export const metadata = { title: 'Set a new password' };

export default async function SetupPasswordPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const challenge = await getChallengeCookie();
  if (!challenge || challenge.kind !== 'password_change_required') {
    redirect('/login');
  }
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Before you continue, please replace the temporary password issued to you."
    >
      <SetupPasswordForm action={setupPasswordAction} initialError={searchParams?.error} />
    </AuthShell>
  );
}
