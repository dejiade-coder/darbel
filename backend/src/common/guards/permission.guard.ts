import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuthenticatedRequest,
  MFA_REQUIRED_KEY,
  PERMISSIONS_KEY,
} from '../decorators/auth.decorators';
import {
  InsufficientPermissionException,
  MfaRequiredException,
} from '../errors/domain.exceptions';

/**
 * Enforces @Permissions and @RequireMfa metadata. Runs AFTER JwtAuthGuard.
 *
 * Platform operators (Branddarrow Super Admins) bypass permission checks
 * at the tenant boundary because their permissions are platform-scoped.
 * Tenant-level routes still verify their permissions normally.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const mfaRequired = this.reflector.getAllAndOverride<boolean>(MFA_REQUIRED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required && !mfaRequired) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const actor = req.actor;
    if (!actor) {
      // Should not happen if JwtAuthGuard ran first. Fail closed.
      throw new InsufficientPermissionException(required ?? []);
    }

    if (mfaRequired && !actor.mfaVerified) {
      throw new MfaRequiredException('');
    }

    if (required && required.length > 0) {
      const has = required.every((p) => actor.permissions.includes(p));
      if (!has) {
        throw new InsufficientPermissionException(required);
      }
    }

    return true;
  }
}
