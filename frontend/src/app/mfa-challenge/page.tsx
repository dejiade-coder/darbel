import { redirect } from 'next/navigation';
import { getChallengeCookie } from '@/lib/auth/session';
import { AuthShell } from '@/components/layout/auth-shell';
import { MfaForm } from './mfa-form';
import { verifyMfaAction } from './actions';

export const metadata = { title: 'Verify identity' };

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const challenge = await getChallengeCookie();
  if (!challenge || challenge.kind !== 'mfa_required') {
    redirect('/login');
  }
  return (
    <AuthShell
      title="Verify your identity"
      subtitle="Enter the 6-digit code from your authenticator app"
    >
      <MfaForm action={verifyMfaAction} initialError={searchParams?.error} />
    </AuthShell>
  );
}
