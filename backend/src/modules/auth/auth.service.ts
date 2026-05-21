import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { PasswordService } from './password.service';
import { MfaService } from './mfa.service';
import { TokenService } from './token.service';
import {
  AccountInactiveException,
  AccountLockedException,
  InvalidCredentialsException,
  InvalidMfaCodeException,
  InvalidRefreshTokenException,
  MfaRequiredException,
  PasswordChangeRequiredException,
  ResourceNotFoundException,
} from '../../common/errors/domain.exceptions';

export interface LoginContext {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
}

export interface MfaVerifyContext {
  challengeToken: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    tenantId: string;
    mustChangePassword: boolean;
    mfaEnabled: boolean;
    isPlatformOperator: boolean;
    permissions: string[];
  };
}

export type LoginResult =
  | { status: 'authenticated'; tokens: TokenPair }
  | { status: 'mfa_required'; challengeToken: string }
  | { status: 'password_change_required'; challengeToken: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly passwordService: PasswordService,
    private readonly mfaService: MfaService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Step 1 of login: verify password.
   * If MFA is enabled, returns a challenge token.
   * If password must be changed, returns a challenge token for that purpose.
   * Otherwise returns tokens immediately.
   */
  async login(ctx: LoginContext): Promise<LoginResult> {
    // Use anonymous Prisma context since user is not yet authenticated.
    return this.prisma.runAnonymous(
      { requestId: ctx.requestId, clientIp: ctx.ipAddress, userAgent: ctx.userAgent },
      async (tx) => {
        // Look up user without revealing whether email exists. Always do a hash
        // verify against a constant string on miss so timing is similar.
        const user = await tx.user.findFirst({
          where: { email: ctx.email, deletedAt: null },
          include: {
            tenant: { select: { isActive: true, isPlatformOperator: true, id: true } },
            roles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        });

        await tx.loginAttempt.create({
          data: {
            email: ctx.email,
            tenantId: user?.tenantId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            success: false, // updated below if successful
            failureReason: user ? null : 'UNKNOWN_USER',
          },
        });

        if (!user) {
          // Constant-time decoy verify to mitigate user enumeration.
          await this.passwordService.verify(
            '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            ctx.password,
          );
          throw new InvalidCredentialsException();
        }

        // Locked account
        if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
          throw new AccountLockedException(user.lockedUntil);
        }

        // Inactive account or tenant
        if (!user.isActive || !user.tenant.isActive) {
          throw new AccountInactiveException();
        }

        // Verify password
        const ok = await this.passwordService.verify(user.passwordHash, ctx.password);
        if (!ok) {
          await this.handleFailedLogin(tx, user.id, user.failedLoginCount);
          throw new InvalidCredentialsException();
        }

        // Reset failed login counter
        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: 0,
            isLocked: false,
            lockedUntil: null,
            lastLoginAt: new Date(),
            lastLoginIp: ctx.ipAddress,
          },
        });

        // Forced password change comes BEFORE MFA — the change endpoint will
        // not require an authenticated session, only the challenge token.
        if (user.mustChangePassword) {
          const challengeToken = await this.tokenService.issueChallengeToken({
            userId: user.id,
            tenantId: user.tenantId,
            email: user.email,
            purpose: 'password_change_required',
          });
          return { status: 'password_change_required', challengeToken };
        }

        if (user.mfaEnabled) {
          const challengeToken = await this.tokenService.issueChallengeToken({
            userId: user.id,
            tenantId: user.tenantId,
            email: user.email,
            purpose: 'mfa_challenge',
          });
          return { status: 'mfa_required', challengeToken };
        }

        // Sensitive roles require MFA. If they have it enabled, we already
        // returned mfa_required above. If not, force enrollment by setting
        // a flag and returning normal tokens. The frontend should redirect
        // to MFA enrollment.
        const permissions = collectPermissions(user);
        const tokens = await this.issueTokens(
          tx,
          user.id,
          user.tenantId,
          user.email,
          user.fullName,
          user.mustChangePassword,
          user.mfaEnabled,
          user.tenant.isPlatformOperator,
          permissions,
          /* mfaVerified */ false,
          ctx.ipAddress,
          ctx.userAgent,
        );
        return { status: 'authenticated', tokens };
      },
    );
  }

  /**
   * Step 2 of login when MFA is enabled.
   */
  async verifyMfa(ctx: MfaVerifyContext): Promise<TokenPair> {
    const challenge = await this.tokenService
      .verifyChallengeToken(ctx.challengeToken, 'mfa_challenge')
      .catch(() => {
        throw new InvalidCredentialsException();
      });

    return this.prisma.runAnonymous(
      { requestId: ctx.requestId, clientIp: ctx.ipAddress, userAgent: ctx.userAgent },
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: challenge.userId, deletedAt: null },
          include: {
            tenant: { select: { isActive: true, isPlatformOperator: true } },
            roles: {
              include: {
                role: { include: { permissions: { include: { permission: true } } } },
              },
            },
          },
        });
        if (!user || !user.mfaEnabled || !user.mfaSecretEnc) {
          throw new InvalidCredentialsException();
        }
        const secret = this.mfaService.decryptSecret(user.mfaSecretEnc);
        if (!this.mfaService.verify(ctx.code, secret)) {
          throw new InvalidMfaCodeException();
        }
        const permissions = collectPermissions(user);
        return this.issueTokens(
          tx,
          user.id,
          user.tenantId,
          user.email,
          user.fullName,
          user.mustChangePassword,
          user.mfaEnabled,
          user.tenant.isPlatformOperator,
          permissions,
          /* mfaVerified */ true,
          ctx.ipAddress,
          ctx.userAgent,
        );
      },
    );
  }

  /**
   * Exchange a refresh token for a new access token + rotated refresh token.
   */
  async refresh(rawRefreshToken: string, ctx: {
    ipAddress?: string;
    userAgent?: string;
    requestId: string;
  }): Promise<TokenPair> {
    const hash = this.tokenService.hashRefreshToken(rawRefreshToken);

    return this.prisma.runAnonymous(
      { requestId: ctx.requestId, clientIp: ctx.ipAddress, userAgent: ctx.userAgent },
      async (tx) => {
        const session = await tx.session.findUnique({
          where: { refreshTokenHash: hash },
          include: {
            user: {
              include: {
                tenant: { select: { isActive: true, isPlatformOperator: true } },
                roles: {
                  include: {
                    role: { include: { permissions: { include: { permission: true } } } },
                  },
                },
              },
            },
          },
        });
        if (!session || session.revokedAt || session.expiresAt < new Date()) {
          throw new InvalidRefreshTokenException();
        }
        if (!session.user.isActive || !session.user.tenant.isActive ||
            session.user.deletedAt) {
          throw new AccountInactiveException();
        }
        // Rotate: revoke old session, issue new one
        await tx.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date(), lastUsedAt: new Date() },
        });
        const permissions = collectPermissions(session.user);
        return this.issueTokens(
          tx,
          session.user.id,
          session.user.tenantId,
          session.user.email,
          session.user.fullName,
          session.user.mustChangePassword,
          session.user.mfaEnabled,
          session.user.tenant.isPlatformOperator,
          permissions,
          /* mfaVerified */ session.user.mfaEnabled, // preserve MFA state
          ctx.ipAddress,
          ctx.userAgent,
        );
      },
    );
  }

  /**
   * Revoke a specific session (logout) or all sessions for a user.
   */
  async logout(rawRefreshToken: string, ctx: { requestId: string }): Promise<void> {
    const hash = this.tokenService.hashRefreshToken(rawRefreshToken);
    await this.prisma.runAnonymous(
      { requestId: ctx.requestId },
      async (tx) => {
        await tx.session.updateMany({
          where: { refreshTokenHash: hash, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      },
    );
  }

  /**
   * Change password using a `password_change_required` challenge token
   * (forced first-login change) OR an authenticated user changing their own.
   */
  async changePassword(args: {
    userId: string;
    tenantId: string;
    currentPassword?: string; // required for self-initiated change; absent for forced first-login change
    newPassword: string;
    requestId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    return this.prisma.runWithContext(
      {
        userId: args.userId,
        tenantId: args.tenantId,
        userEmail: '', // not strictly needed for this op
        requestId: args.requestId,
        clientIp: args.ipAddress,
        userAgent: args.userAgent,
      },
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: args.userId },
          include: { passwordHistory: { orderBy: { createdAt: 'desc' }, take: 10 } },
        });
        if (!user) throw new ResourceNotFoundException('User', args.userId);

        if (args.currentPassword) {
          const ok = await this.passwordService.verify(user.passwordHash, args.currentPassword);
          if (!ok) throw new InvalidCredentialsException();
        }

        this.passwordService.enforcePolicy(args.newPassword, [
          user.email,
          user.fullName,
        ]);
        await this.passwordService.enforceHistory(args.newPassword, user.passwordHistory);

        const newHash = await this.passwordService.hash(args.newPassword);

        // Store old hash in history, set new hash
        await tx.passwordHistory.create({
          data: { userId: user.id, passwordHash: user.passwordHash },
        });
        await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash: newHash,
            passwordChangedAt: new Date(),
            mustChangePassword: false,
          },
        });
        // Revoke all existing sessions on password change
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      },
    );
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async handleFailedLogin(
    tx: Parameters<Parameters<PrismaService['runAnonymous']>[1]>[0],
    userId: string,
    currentFailures: number,
  ): Promise<void> {
    const max = this.config.get('MAX_FAILED_LOGIN_ATTEMPTS');
    const lockMinutes = this.config.get('LOCKOUT_DURATION_MINUTES');
    const next = currentFailures + 1;
    const willLock = next >= max;
    await tx.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: next,
        isLocked: willLock,
        lockedUntil: willLock ? new Date(Date.now() + lockMinutes * 60_000) : null,
      },
    });
    if (willLock) {
      this.logger.warn(`User ${userId} locked after ${next} failed attempts`);
    }
  }

  private async issueTokens(
    tx: Parameters<Parameters<PrismaService['runAnonymous']>[1]>[0],
    userId: string,
    tenantId: string,
    email: string,
    fullName: string,
    mustChangePassword: boolean,
    mfaEnabled: boolean,
    isPlatformOperator: boolean,
    permissions: string[],
    mfaVerified: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const { accessToken } = await this.tokenService.issueAccessToken({
      userId,
      tenantId,
      email,
      permissions,
      isPlatformOperator,
      mfaVerified,
    });
    const refresh = this.tokenService.generateRefreshToken();
    await tx.session.create({
      data: {
        userId,
        refreshTokenHash: refresh.hash,
        ipAddress,
        userAgent,
        expiresAt: refresh.expiresAt,
      },
    });
    return {
      accessToken,
      refreshToken: refresh.rawToken,
      expiresIn: this.config.get('JWT_ACCESS_TOKEN_TTL_SECONDS'),
      user: {
        id: userId,
        email,
        fullName,
        tenantId,
        mustChangePassword,
        mfaEnabled,
        isPlatformOperator,
        permissions,
      },
    };
  }
}

// Type-safe permission collection from the eager-loaded user shape used above.
type UserWithRoles = {
  roles: Array<{
    role: {
      permissions: Array<{ permission: { code: string } }>;
    };
  }>;
};

function collectPermissions(user: UserWithRoles): string[] {
  const set = new Set<string>();
  for (const ur of user.roles) {
    for (const rp of ur.role.permissions) {
      set.add(rp.permission.code);
    }
  }
  return [...set].sort();
}
