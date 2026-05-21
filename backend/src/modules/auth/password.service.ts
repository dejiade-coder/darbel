import { Injectable } from '@nestjs/common';
import { Algorithm, hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { AppConfigService } from '../../config/app-config.service';
import {
  PasswordPolicyException,
  PasswordReuseException,
} from '../../common/errors/domain.exceptions';

interface PasswordHistoryEntry {
  passwordHash: string;
}

@Injectable()
export class PasswordService {
  constructor(private readonly config: AppConfigService) {}

  /**
   * Hashes a plaintext password using Argon2id with configured parameters.
   */
  async hash(plaintext: string): Promise<string> {
    return argonHash(plaintext, {
      algorithm: Algorithm.Argon2id,
      memoryCost: this.config.get('ARGON2_MEMORY_KB'),
      timeCost: this.config.get('ARGON2_ITERATIONS'),
      parallelism: this.config.get('ARGON2_PARALLELISM'),
    });
  }

  /**
   * Verifies a plaintext password against a stored hash.
   * Returns false on any failure (including malformed hashes) — never throws.
   */
  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argonVerify(hash, plaintext);
    } catch {
      return false;
    }
  }

  /**
   * Enforces password complexity. Throws on policy violation.
   */
  enforcePolicy(plaintext: string, contextualValues: string[] = []): void {
    const minLength = this.config.get('PASSWORD_MIN_LENGTH');
    if (plaintext.length < minLength) {
      throw new PasswordPolicyException(`Password must be at least ${minLength} characters`);
    }
    if (!/[a-z]/.test(plaintext)) {
      throw new PasswordPolicyException('Password must contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(plaintext)) {
      throw new PasswordPolicyException('Password must contain at least one uppercase letter');
    }
    if (!/\d/.test(plaintext)) {
      throw new PasswordPolicyException('Password must contain at least one digit');
    }
    if (!/[^A-Za-z0-9]/.test(plaintext)) {
      throw new PasswordPolicyException(
        'Password must contain at least one symbol',
      );
    }
    // Reject password equal to or containing the user's email local part / name
    const lower = plaintext.toLowerCase();
    for (const v of contextualValues) {
      if (v && v.length >= 4 && lower.includes(v.toLowerCase())) {
        throw new PasswordPolicyException(
          'Password must not contain your name or email',
        );
      }
    }
  }

  /**
   * Checks that a new password is not in the history. Throws on reuse.
   */
  async enforceHistory(
    plaintext: string,
    history: PasswordHistoryEntry[],
  ): Promise<void> {
    const historyCount = this.config.get('PASSWORD_HISTORY_COUNT');
    if (historyCount === 0 || history.length === 0) return;
    for (const entry of history.slice(0, historyCount)) {
      if (await this.verify(entry.passwordHash, plaintext)) {
        throw new PasswordReuseException(historyCount);
      }
    }
  }
}
