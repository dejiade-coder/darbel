import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-ink-200 bg-ink-50 text-ink-700',
        accent: 'border-accent/30 bg-accent/5 text-accent',
        success: 'border-success/30 bg-success/5 text-success',
        warning: 'border-warning/30 bg-warning/5 text-warning',
        danger: 'border-danger/30 bg-danger/5 text-danger',
        outline: 'border-ink-300 bg-transparent text-ink-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
