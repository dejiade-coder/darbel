/**
 * Type contracts that mirror the backend's response shapes. These are the
 * single source of truth on the frontend. Keep them in sync with the
 * backend DTOs.
 */

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  isPlatformOperator: boolean;
  roleCodes: string[];
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthenticatedUser;
}

export type LoginResponse =
  | { status: 'authenticated'; tokens: TokenPair }
  | { status: 'mfa_required'; challengeToken: string }
  | { status: 'password_change_required'; challengeToken: string };

export interface UserPublic {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  isLocked: boolean;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{ code: string; displayName: string }>;
}

export interface UserListResponse {
  items: UserPublic[];
  nextCursor: string | null;
}

export interface TenantPublic {
  id: string;
  code: string;
  legalName: string;
  displayName: string;
  contactEmail: string;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
  userCount: number;
}

export interface RolePublic {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  isSystemRole: boolean;
  tenantId: string | null;
  permissions: Array<{ code: string; module: string; isSensitive: boolean }>;
}

export interface PermissionPublic {
  code: string;
  module: string;
  description: string;
  isSensitive: boolean;
}

export interface AuditEntry {
  id: string;
  occurredAt: string;
  tenantId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  tableName: string;
  recordId: string;
  changedFields: string[];
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export interface AuditListResponse {
  items: AuditEntry[];
  nextCursor: string | null;
}

export interface AuditEntryDetail extends AuditEntry {
  beforeState: unknown;
  afterState: unknown;
}
