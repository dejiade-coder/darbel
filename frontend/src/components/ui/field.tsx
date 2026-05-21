import * as React from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  id?: string;
}

export function Field({ label, hint, error, required, className, children, id }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium uppercase tracking-wider text-ink-600"
        >
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-ink-500">{hint}</p>}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
