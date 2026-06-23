import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AppConfigService } from '../../config/app-config.service';

export interface AccessTokenClaims {
  userId: string;
  tenantId: string;
  email: string;
  roleCodes: string[];
  permissions: string[];
  isPlatformOperator: boolean;
  mfaVerified: boolean;
}

export interface ChallengeTokenClaims {
  userId: string;
  tenantId: string;
  email: string;
  purpose: 'mfa_challenge' | 'password_change_required';
}

/**
 * Issues and verifies tokens.
 * - Access tokens: short-lived JWT, contain all claims
 * - Refresh tokens: opaque random tokens; only their SHA-256 hash is stored
 * - Challenge tokens: short-lived JWT used between login step 1 and MFA step
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async issueAccessToken(claims: AccessTokenClaims): Promise<{
    accessToken: string;
    expiresAt: Date;
  }> {
    const ttl = this.config.get('JWT_ACCESS_TOKEN_TTL_SECONDS');
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const accessToken = await this.jwt.signAsync(
      {
        sub: claims.userId,
        tid: claims.tenantId,
        email: claims.email,
        roles: claims.roleCodes,
        perms: claims.permissions,
        platformOp: claims.isPlatformOperator,
        mfa: claims.mfaVerified,
      },
      {
        expiresIn: ttl,
        issuer: this.config.get('JWT_ISSUER'),
        audience: this.config.get('JWT_AUDIENCE'),
      },
    );
    return { accessToken, expiresAt };
  }

  /**
   * Generates an opaque refresh token and returns both the raw token (for the
   * client) and its hash (for the database). The raw token never goes to disk.
   */
  generateRefreshToken(): { rawToken: string; hash: string; expiresAt: Date } {
    const rawBytes = crypto.randomBytes(48);
    // base64url-safe
    const rawToken = rawBytes.toString('base64url');
    const hash = this.hashRefreshToken(rawToken);
    const ttl = this.config.get('JWT_REFRESH_TOKEN_TTL_SECONDS');
    const expiresAt = new Date(Date.now() + ttl * 1000);
    return { rawToken, hash, expiresAt };
  }

  hashRefreshToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  async issueChallengeToken(claims: ChallengeTokenClaims): Promise<string> {
    return this.jwt.signAsync(
      {
        sub: claims.userId,
        tid: claims.tenantId,
        email: claims.email,
        purpose: claims.purpose,
      },
      {
        expiresIn: 300, // 5 minutes — enough to complete MFA step
        issuer: this.config.get('JWT_ISSUER'),
        audience: this.config.get('JWT_AUDIENCE'),
      },
    );
  }

  async verifyChallengeToken(
    token: string,
    expectedPurpose: ChallengeTokenClaims['purpose'],
  ): Promise<ChallengeTokenClaims> {
    const payload = await this.jwt.verifyAsync<{
      sub: string;
      tid: string;
      email: string;
      purpose: string;
    }>(token, {
      issuer: this.config.get('JWT_ISSUER'),
      audience: this.config.get('JWT_AUDIENCE'),
    });
    if (payload.purpose !== expectedPurpose) {
      throw new Error('Challenge token has wrong purpose');
    }
    return {
      userId: payload.sub,
      tenantId: payload.tid,
      email: payload.email,
      purpose: payload.purpose,
    };
  }
}
