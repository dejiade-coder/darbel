export type RestrictedWorkspace =
  | 'finance'
  | 'auditor'
  | 'finance_auditor'
  | 'inspector'
  | 'medical'
  | 'lab'
  | 'medical_lab'
  | null;

const RESTRICTED_ROLE_CODES = new Set([
  'FINANCE_OFFICER',
  'AUDITOR',
  'INSPECTOR',
  'MEDICAL_OFFICER',
  'LAB_TECHNICIAN',
]);

export function getRestrictedWorkspace(
  roleCodes: string[],
  isPlatformOperator = false,
): RestrictedWorkspace {
  if (isPlatformOperator || roleCodes.length === 0) return null;
  if (!roleCodes.every((code) => RESTRICTED_ROLE_CODES.has(code))) return null;

  const hasFinance = roleCodes.includes('FINANCE_OFFICER');
  const hasAuditor = roleCodes.includes('AUDITOR');
  const hasInspector = roleCodes.includes('INSPECTOR');
  const hasMedical = roleCodes.includes('MEDICAL_OFFICER');
  const hasLab = roleCodes.includes('LAB_TECHNICIAN');

  if (hasFinance && hasAuditor) return 'finance_auditor';
  if (hasFinance) return 'finance';
  if (hasAuditor) return 'auditor';
  if (hasMedical && hasLab) return 'medical_lab';
  if (hasMedical) return 'medical';
  if (hasLab) return 'lab';
  if (hasInspector) return 'inspector';
  return null;
}

export function isWorkspaceRouteAllowed(
  pathname: string,
  workspace: RestrictedWorkspace,
): boolean {
  if (!workspace || pathname === '/dashboard') return true;
  if (workspace === 'finance' || workspace === 'finance_auditor') {
    if (pathname.startsWith('/dashboard/payments')) return true;
    if (pathname.startsWith('/dashboard/reports')) return true;
  }
  if (workspace === 'auditor' || workspace === 'finance_auditor') {
    if (pathname.startsWith('/dashboard/payments')) return true;
    if (pathname.startsWith('/dashboard/medical')) return true;
    if (pathname.startsWith('/dashboard/certificates')) return true;
    if (pathname.startsWith('/dashboard/reports')) return true;
  }
  if (workspace === 'inspector') {
    if (pathname.startsWith('/dashboard/certificates')) return true;
  }
  if (workspace === 'medical' || workspace === 'lab' || workspace === 'medical_lab') {
    if (pathname.startsWith('/dashboard/medical')) return true;
    if (pathname.startsWith('/dashboard/reports')) return true;
  }
  return false;
}
