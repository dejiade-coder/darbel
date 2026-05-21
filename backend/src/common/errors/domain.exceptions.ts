import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for Darbel domain errors. Carries a machine-readable code
 * so the frontend can react without parsing messages.
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }
}

// Authentication
export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('AUTH_INVALID_CREDENTIALS', 'Invalid email or password', HttpStatus.UNAUTHORIZED);
  }
}

export class AccountLockedException extends DomainException {
  constructor(until: Date) {
    super(
      'AUTH_ACCOUNT_LOCKED',
      'Account temporarily locked due to failed login attempts',
      423 as HttpStatus, // HTTP 423 Locked
      { until: until.toISOString() },
    );
  }
}

export class AccountInactiveException extends DomainException {
  constructor() {
    super('AUTH_ACCOUNT_INACTIVE', 'Account is inactive', HttpStatus.FORBIDDEN);
  }
}

export class MfaRequiredException extends DomainException {
  constructor(challengeToken: string) {
    super(
      'AUTH_MFA_REQUIRED',
      'MFA verification required to complete login',
      HttpStatus.UNAUTHORIZED,
      { challengeToken },
    );
  }
}

export class InvalidMfaCodeException extends DomainException {
  constructor() {
    super('AUTH_INVALID_MFA', 'Invalid MFA code', HttpStatus.UNAUTHORIZED);
  }
}

export class PasswordChangeRequiredException extends DomainException {
  constructor() {
    super(
      'AUTH_PASSWORD_CHANGE_REQUIRED',
      'Password change required before continuing',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class InvalidRefreshTokenException extends DomainException {
  constructor() {
    super(
      'AUTH_INVALID_REFRESH_TOKEN',
      'Refresh token is invalid or has been revoked',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

// Authorization
export class InsufficientPermissionException extends DomainException {
  constructor(required: string[]) {
    super(
      'AUTHZ_INSUFFICIENT_PERMISSION',
      'You do not have the required permission for this action',
      HttpStatus.FORBIDDEN,
      { required },
    );
  }
}

export class TenantMismatchException extends DomainException {
  constructor() {
    super(
      'AUTHZ_TENANT_MISMATCH',
      'Resource belongs to a different tenant',
      HttpStatus.FORBIDDEN,
    );
  }
}

// Validation
export class PasswordPolicyException extends DomainException {
  constructor(reason: string) {
    super('VALIDATION_PASSWORD_POLICY', reason, HttpStatus.BAD_REQUEST);
  }
}

export class PasswordReuseException extends DomainException {
  constructor(historyCount: number) {
    super(
      'VALIDATION_PASSWORD_REUSE',
      `Password matches one of your last ${historyCount} passwords`,
      HttpStatus.BAD_REQUEST,
      { historyCount },
    );
  }
}

// Resources
export class ResourceNotFoundException extends DomainException {
  constructor(resource: string, identifier?: string) {
    super(
      'RESOURCE_NOT_FOUND',
      `${resource} not found`,
      HttpStatus.NOT_FOUND,
      identifier ? { resource, identifier } : { resource },
    );
  }
}

export class ResourceConflictException extends DomainException {
  constructor(message: string, details?: Record<string, unknown>) {
    super('RESOURCE_CONFLICT', message, HttpStatus.CONFLICT, details);
  }
}
