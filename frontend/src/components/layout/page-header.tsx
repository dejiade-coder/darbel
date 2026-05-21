interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-ink-200 pb-6">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-ink-500">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl font-medium text-ink-900">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-ink-600">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}
