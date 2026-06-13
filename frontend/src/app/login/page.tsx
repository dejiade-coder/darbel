import { redirect } from 'next/navigation';
import { readActorFromAccessToken } from '@/lib/auth/claims';
import { LoginForm } from './login-form';
import { loginAction } from './actions';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const actor = await readActorFromAccessToken();
  if (actor) redirect('/dashboard');
  const params = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05383b] px-6 py-10">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(2,61,58,0.98)_0%,rgba(2,61,58,0.98)_49%,rgba(3,45,41,0.98)_50%,rgba(3,45,41,0.98)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_34%)]" />
      <section className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-white/60">Darbel Compliance</p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[0.02em] text-white drop-shadow-sm">
            User Login
          </h1>
        </div>
        <LoginForm action={loginAction} initialError={params?.error} />
        <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
          Authorised personnel only
        </p>
      </section>
    </main>
  );
}
