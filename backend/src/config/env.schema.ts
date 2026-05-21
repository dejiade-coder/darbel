import { z } from 'zod';

/**
 * Environment schema. Validated at boot. If validation fails, the app
 * refuses to start. A misconfigured production service is worse than
 * a service that does not start.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_NAME: z.string().default('Darbel'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database connections — see prisma.service.ts for the two-role design
  DATABASE_URL: z.string().url(),
  DATABASE_AUTH_URL: z.string().url().optional(),
  DATABASE_MIGRATOR_URL: z.string().url().optional(),

  JWT_ALGORITHM: z.enum(['HS256', 'RS256']).default('HS256'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  JWT_ISSUER: z.string().default('darbel'),
  JWT_AUDIENCE: z.string().default('darbel-api'),

  ARGON2_MEMORY_KB: z.coerce.number().int().positive().default(65536),
  ARGON2_ITERATIONS: z.coerce.number().int().positive().default(3),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(4),

  MFA_ISSUER: z.string().default('Darbel'),
  MFA_WINDOW: z.coerce.number().int().nonnegative().default(1),

  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(12),
  PASSWORD_HISTORY_COUNT: z.coerce.number().int().nonnegative().default(5),
  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().int().positive().default(15),
  SENSITIVE_PERMISSIONS: z.string().default('medical.view_sensitive'),

  RATE_LIMIT_LOGIN_PER_MINUTE: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_DEFAULT_PER_MINUTE: z.coerce.number().int().positive().default(60),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  ENFORCE_TENANT_CONTEXT: z
    .string()
    .transform((v) => v.toLowerCase() === 'true')
    .default('true'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppConfig {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${issues}`);
  }

  const cfg = parsed.data;

  // Cross-field validation
  if (cfg.JWT_ALGORITHM === 'HS256' && !cfg.JWT_SECRET) {
    throw new Error('JWT_SECRET is required when JWT_ALGORITHM=HS256');
  }
  if (cfg.JWT_ALGORITHM === 'RS256' && (!cfg.JWT_PRIVATE_KEY || !cfg.JWT_PUBLIC_KEY)) {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required when JWT_ALGORITHM=RS256');
  }

  if (cfg.NODE_ENV === 'production') {
    if (!cfg.DATABASE_AUTH_URL) {
      throw new Error(
        'DATABASE_AUTH_URL is required in production for the auth bootstrap role',
      );
    }
    if (cfg.JWT_ALGORITHM === 'HS256') {
      // eslint-disable-next-line no-console
      console.warn(
        '[CONFIG WARNING] Running in production with HS256. RS256 is recommended.',
      );
    }
  }

  return cfg;
}
