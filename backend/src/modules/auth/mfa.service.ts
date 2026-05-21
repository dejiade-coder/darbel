import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import { AppConfigService } from '../../config/app-config.service';

/**
 * TOTP-based MFA. Secrets are AES-256-GCM encrypted at rest using a key
 * derived from JWT_SECRET. In production with RS256, switch this to a
 * dedicated MFA_ENCRYPTION_KEY environment variable.
 */
@Injectable()
export class MfaService {
  private readonly key: Buffer;

  constructor(private readonly config: AppConfigService) {
    authenticator.options = {
      window: this.config.get('MFA_WINDOW'),
    };
    // Derive a stable 32-byte key from the JWT secret. For production, replace
    // with a dedicated, rotated key managed via secret manager.
    const secret = this.config.get('JWT_SECRET') ?? 'darbel-fallback-key-do-not-use';
    this.key = crypto.createHash('sha256').update(`darbel-mfa::${secret}`).digest();
  }

  /**
   * Generate a new TOTP secret for enrollment.
   * Returns { secret, otpauthUrl } — secret is base32, otpauthUrl can be
   * encoded as QR for authenticator apps.
   */
  generateEnrollment(userLabel: string): { secret: string; otpauthUrl: string } {
    const secret = authenticator.generateSecret();
    const issuer = this.config.get('MFA_ISSUER');
    const otpauthUrl = authenticator.keyuri(userLabel, issuer, secret);
    return { secret, otpauthUrl };
  }

  /**
   * Verify a TOTP code against a (decrypted) secret.
   */
  verify(code: string, secret: string): boolean {
    try {
      return authenticator.verify({ token: code, secret });
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Secret encryption (at rest)
  // -----------------------------------------------------------------------
  encryptSecret(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: v1.<base64 iv>.<base64 tag>.<base64 ciphertext>
    return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
  }

  decryptSecret(encoded: string): string {
    const parts = encoded.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new Error('Malformed encrypted MFA secret');
    }
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const ciphertext = Buffer.from(parts[3], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return dec.toString('utf8');
  }
}
