import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Request } from 'express';

/**
 * The actor attached to every authenticated request by JwtAuthGuard.
 */
export interface AuthenticatedActor {
  userId: string;
  tenantId: string;
  email: string;
  permissions: string[];
  isPlatformOperator: boolean;
  mfaVerified: boolean;
}

export type AuthenticatedRequest = Request & {
  actor?: AuthenticatedActor;
  requestId?: string;
};

/**
 * @CurrentUser() inside a controller method returns the authenticated actor.
 *
 *   @Get('me')
 *   me(@CurrentUser() actor: AuthenticatedActor) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedActor => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.actor) {
      throw new Error(
        'CurrentUser decorator used on an unauthenticated route. Apply JwtAuthGuard or use @Public.',
      );
    }
    return req.actor;
  },
);

/**
 * Mark a route as public (no authentication required).
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Require a permission to access this route. Multiple permissions = ALL required.
 *
 *   @Permissions('user.create')
 *   create() { ... }
 *
 *   @Permissions('user.update', 'user.view')
 *   update() { ... }  // requires BOTH
 */
export const PERMISSIONS_KEY = 'requiredPermissions';
export const Permissions = (...perms: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, perms);

/**
 * Mark a route as requiring MFA verification within the access token.
 * Used for sensitive operations.
 */
export const MFA_REQUIRED_KEY = 'mfaRequired';
export const RequireMfa = (): MethodDecorator & ClassDecorator =>
  SetMetadata(MFA_REQUIRED_KEY, true);
