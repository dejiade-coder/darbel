import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './env.schema';

/**
 * Typed wrapper around NestJS ConfigService. Use this everywhere instead
 * of injecting ConfigService directly so that consumers get autocomplete
 * and strict typing.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly cs: ConfigService<AppConfig, true>) {}

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.cs.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get sensitivePermissions(): string[] {
    return this.get('SENSITIVE_PERMISSIONS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  get corsOrigins(): string[] {
    return this.get('CORS_ORIGINS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
