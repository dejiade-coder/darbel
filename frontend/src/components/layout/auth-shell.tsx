import { ShieldCheck } from 'lucide-react';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-parchment bg-paper">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-12">
        {/* Brand */}
        <header className="mb-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent text-parchment">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-display text-lg font-medium leading-none text-ink-900">
              Darbel
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-ink-500">
              Branddarrow Business Hub
            </p>
          </div>
        </header>

        {/* Card */}
        <section className="animate-fade-in rounded-sm border border-ink-200 bg-white shadow-[0_1px_0_0_rgba(14,17,22,0.04),0_8px_24px_-12px_rgba(14,17,22,0.10)]">
          <div className="border-b border-ink-100 px-7 py-6">
            <h1 className="font-display text-2xl font-medium text-ink-900">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
            )}
          </div>
          <div className="px-7 py-7">{children}</div>
        </section>

        <footer className="mt-auto pt-12 text-center text-[11px] text-ink-400">
          <p className="font-mono">
            Confidential. Authorised personnel only.
          </p>
        </footer>
      </div>
    </main>
  );
}
