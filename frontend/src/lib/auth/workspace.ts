export type RestrictedWorkspace = 'finance' | 'auditor' | 'finance_auditor' | null;

const RESTRICTED_ROLE_CODES = new Set(['FINANCE_OFFICER', 'AUDITOR']);

export function getRestrictedWorkspace(
  roleCodes: string[],
  isPlatformOperator = false,
): RestrictedWorkspace {
  if (isPlatformOperator || roleCodes.length === 0) return null;
  if (!roleCodes.every((code) => RESTRICTED_ROLE_CODES.has(code))) return null;

  const hasFinance = roleCodes.includes('FINANCE_OFFICER');
  const hasAuditor = roleCodes.includes('AUDITOR');
  if (hasFinance && hasAuditor) return 'finance_auditor';
  if (hasFinance) return 'finance';
  if (hasAuditor) return 'auditor';
  return null;
}

export function isWorkspaceRouteAllowed(
  pathname: string,
  workspace: RestrictedWorkspace,
): boolean {
  if (!workspace || pathname === '/dashboard') return true;
  if (pathname.startsWith('/dashboard/reports')) return true;
  if (workspace === 'finance' || workspace === 'finance_auditor') {
    if (pathname.startsWith('/dashboard/payments')) return true;
  }
  if (workspace === 'auditor' || workspace === 'finance_auditor') {
    if (pathname.startsWith('/dashboard/audit')) return true;
  }
  return false;
}
