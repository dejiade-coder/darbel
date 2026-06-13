'use client';

import { useFormStatus } from 'react-dom';
import { useState, useTransition } from 'react';
import { LockKeyhole, UserRound } from 'lucide-react';

interface LoginFormProps {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  initialError?: string;
}

export function LoginForm({ action, initialError }: LoginFormProps) {
  const [error, setError] = useState<string | undefined>(initialError);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="mx-auto w-full max-w-[340px] space-y-7">
      {error && (
        <div className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-center text-sm font-medium text-white shadow-sm">
          {error}
        </div>
      )}

      <label className="relative block">
        <span className="sr-only">Email</span>
        <span className="absolute -left-1 top-1/2 z-10 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#092530] shadow-[0_8px_20px_rgba(0,0,0,0.22)]">
          <UserRound className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          maxLength={254}
          placeholder="Username"
          className="h-12 w-full rounded-full border-0 bg-[#6f898f]/75 pl-[4.5rem] pr-6 text-[15px] font-medium text-white placeholder:text-[#19343b] outline-none ring-1 ring-white/5 transition focus:bg-[#78949a]/85 focus:ring-2 focus:ring-white/70"
        />
      </label>

      <label className="relative block">
        <span className="sr-only">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={1}
          maxLength={256}
          placeholder="Password"
          className="h-12 w-full rounded-full border-0 bg-[#6f898f]/75 pl-6 pr-[4.5rem] text-[15px] font-medium text-white placeholder:text-[#19343b] outline-none ring-1 ring-white/5 transition focus:bg-[#78949a]/85 focus:ring-2 focus:ring-white/70"
        />
        <span className="absolute -right-1 top-1/2 z-10 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#092530] shadow-[0_8px_20px_rgba(0,0,0,0.22)]">
          <LockKeyhole className="h-6 w-6" strokeWidth={1.9} />
        </span>
      </label>

      <SubmitButton isPending={isPending} />
    </form>
  );
}

function SubmitButton({ isPending }: { isPending: boolean }) {
  const { pending } = useFormStatus();
  const busy = pending || isPending;
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-14 h-12 w-full rounded-full bg-white text-base font-black uppercase tracking-[0.04em] text-[#092530] shadow-[0_10px_26px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-white/95 disabled:translate-y-0 disabled:opacity-70"
    >
      {busy ? 'Verifying...' : 'Login'}
    </button>
  );
}
