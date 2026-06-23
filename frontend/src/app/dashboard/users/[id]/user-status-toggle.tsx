'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserX } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { setUserStatusAction } from '../actions';

export function UserStatusToggle({
  userId,
  userName,
  isActive,
}: {
  userId: string;
  userName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nextState = !isActive;

  function changeStatus() {
    const action = nextState ? 'reactivate' : 'deactivate';
    const consequence = nextState
      ? 'They will be able to sign in again using their existing credentials.'
      : 'Their current sessions will be signed out immediately.';
    if (!window.confirm(`${action[0]!.toUpperCase()}${action.slice(1)} ${userName}? ${consequence}`)) return;

    startTransition(async () => {
      setError(null);
      const result = await setUserStatusAction(userId, nextState);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="border-t border-ink-100 pt-4">
      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
      <div className="rounded-sm border border-ink-100 bg-ink-50/60 p-3">
        <p className="text-sm font-medium text-ink-900">
          {isActive ? 'This account can currently sign in.' : 'This account is currently blocked from signing in.'}
        </p>
        <p className="mt-1 text-xs text-ink-600">
          {isActive
            ? 'Deactivation preserves roles and history while immediately ending the user\'s active sessions.'
            : 'Reactivation restores access with the existing roles and credentials.'}
        </p>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" variant={isActive ? 'destructive' : 'default'} onClick={changeStatus} disabled={pending}>
          {isActive ? <UserX className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          {pending ? 'Saving...' : isActive ? 'Set inactive' : 'Set active'}
        </Button>
      </div>
    </div>
  );
}
