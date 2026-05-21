import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'info' | 'success' | 'warning' | 'danger';

const variantStyles: Record<Variant, { container: string; icon: React.ElementType }> = {
  info: { container: 'border-info/30 bg-info/5 text-info', icon: Info },
  success: { container: 'border-success/30 bg-success/5 text-success', icon: CheckCircle2 },
  warning: { container: 'border-warning/30 bg-warning/5 text-warning', icon: AlertCircle },
  danger: { container: 'border-danger/30 bg-danger/5 text-danger', icon: XCircle },
};

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: Variant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { container, icon: Icon } = variantStyles[variant];
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-sm border px-4 py-3 text-sm',
        container,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="flex-1">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={cn(title && 'mt-0.5', 'text-ink-700')}>{children}</div>}
      </div>
    </div>
  );
}
