import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../config/app-config.service';
import {
  AuthenticatedActor,
  AuthenticatedRequest,
  IS_PUBLIC_KEY,
} from '../decorators/auth.decorators';

interface AccessTokenPayload {
  sub: string;
  tid: string;
  email: string;
  perms: string[];
  platformOp: boolean;
  mfa: boolean;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Public routes bypass auth
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        issuer: this.config.get('JWT_ISSUER'),
        audience: this.config.get('JWT_AUDIENCE'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const actor: AuthenticatedActor = {
      userId: payload.sub,
      tenantId: payload.tid,
      email: payload.email,
      permissions: payload.perms ?? [],
      isPlatformOperator: payload.platformOp ?? false,
      mfaVerified: payload.mfa ?? false,
    };
    request.actor = actor;
    return true;
  }
}

function extractBearerToken(req: AuthenticatedRequest): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
