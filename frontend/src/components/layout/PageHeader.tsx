// src/components/layout/PageHeader.tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-1">
        <h1 className="text-3xl font-serif text-neutral-900">{title}</h1>
        {description && (
          <p className="text-neutral-600 mt-2 max-w-2xl">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
