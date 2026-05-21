import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), "d MMM yyyy 'at' HH:mm");
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

/** Mask a UUID for compact display: 7a3b…f4e2 */
export function shortId(id: string | null): string {
  if (!id) return '—';
  if (id.length <= 12) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}
