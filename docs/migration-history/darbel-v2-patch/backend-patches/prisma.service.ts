import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Two-connection PrismaService.
 *
 * - `this` (extends PrismaClient) → connects as `darbel_app` (RLS-enforced).
 *   Use this for all authenticated, tenant-scoped operations.
 *
 * - `this.auth` → connects as `darbel_auth` (BYPASSRLS, narrow grants).
 *   Use this for the login / refresh / logout / password-change flows where
 *   the user is not yet authenticated and RLS cannot stamp a tenant context.
 *
 * Design rationale: Postgres RLS based on `current_app_user_id` cannot
 * cleanly support the auth bootstrap problem — at login time there IS no
 * authenticated user. Rather than patching policies with "allow when
 * current_app_user_id IS NULL" exceptions for every mutation (which proved
 * brittle in v1), we use a separate role with BYPASSRLS scoped to ONLY the
 * tables required for auth. The security boundary is enforced via GRANTs
 * rather than policies: `darbel_auth` cannot reference any domain table.
 *
 * Both connections share the SAME database. Only the role / privilege scope
 * differs.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /** Second client: connects as `darbel_auth` (BYPASSRLS). */
  public readonly auth: PrismaClient;

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });

    // The auth client connects with DATABASE_AUTH_URL. We construct it here
    // because Prisma uses `datasourceUrl` to override the schema's `env(...)`.
    const authUrl = process.env.DATABASE_AUTH_URL;
    if (!authUrl) {
      // Fall back to migrator if AUTH not set (dev convenience only).
      this.logger.warn(
        'DATABASE_AUTH_URL not set; falling back to DATABASE_MIGRATOR_URL. ' +
          'Production must set DATABASE_AUTH_URL.',
      );
    }
    this.auth = new PrismaClient({
      datasourceUrl: authUrl || process.env.DATABASE_MIGRATOR_URL,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.auth.$connect();
    this.logger.log('Prisma connected (app + auth)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.auth.$disconnect();
  }

  /**
   * Run a callback within an `darbel_app` transaction stamped with the actor
   * context. RLS policies enforce tenant isolation; audit triggers attribute
   * changes to the actor.
   *
   * Use this for every authenticated, tenant-scoped operation.
   */
  async runWithContext<T>(
    ctx: ActorContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_user_id = '${safeUuid(ctx.userId)}'`,
      );
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${safeUuid(ctx.tenantId)}'`,
      );
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_user_email = '${safeText(ctx.userEmail)}'`,
      );
      await tx.$executeRawUnsafe(
        `SET LOCAL app.request_id = '${safeUuid(ctx.requestId)}'`,
      );
      if (ctx.clientIp) {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.client_ip = '${safeText(ctx.clientIp)}'`,
        );
      }
      if (ctx.userAgent) {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.user_agent = '${safeText(ctx.userAgent)}'`,
        );
      }
      return fn(tx);
    });
  }

  /**
   * Run a callback within a `darbel_auth` transaction. Use this for the
   * pre-authentication flows (login, refresh, logout, password change via
   * challenge token). RLS is bypassed because the role has BYPASSRLS, but the
   * role has only narrow table grants — it cannot reach domain data.
   *
   * Session variables (request_id, client_ip, user_agent) are still stamped
   * so the audit log can attribute the request.
   */
  async runAuth<T>(
    ctx: AnonymousContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.auth.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.request_id = '${safeUuid(ctx.requestId)}'`,
      );
      if (ctx.clientIp) {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.client_ip = '${safeText(ctx.clientIp)}'`,
        );
      }
      if (ctx.userAgent) {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.user_agent = '${safeText(ctx.userAgent)}'`,
        );
      }
      // If the actor's identity is known (e.g., refresh flow after we have
      // looked up the session), stamp it for audit attribution. RLS won't
      // care because we're on `darbel_auth` which bypasses RLS.
      if (ctx.userId) {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_user_id = '${safeUuid(ctx.userId)}'`,
        );
      }
      if (ctx.userEmail) {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_user_email = '${safeText(ctx.userEmail)}'`,
        );
      }
      return fn(tx);
    });
  }

  /**
   * Compatibility alias. v1 callers used `runAnonymous` for the same purpose
   * `runAuth` now serves. Keep both names to minimise churn.
   */
  async runAnonymous<T>(
    ctx: AnonymousContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.runAuth(ctx, fn);
  }
}

export interface ActorContext {
  userId: string;
  tenantId: string;
  userEmail: string;
  requestId: string;
  clientIp?: string;
  userAgent?: string;
}

export interface AnonymousContext {
  requestId: string;
  clientIp?: string;
  userAgent?: string;
  /** Optional: stamp actor identity after lookup (refresh / password-change) */
  userId?: string;
  userEmail?: string;
}

// -----------------------------------------------------------------------------
// Safe interpolation helpers. SET LOCAL does not accept bound parameters in
// the Postgres wire protocol, so we must interpolate. We refuse anything
// that does not match the strict expected shape.
// -----------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeUuid(value: string): string {
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid UUID for session context: ${redactPreview(value)}`);
  }
  return value;
}

function safeText(value: string): string {
  if (/['\n\r\t\x00-\x1f]/.test(value)) {
    throw new Error(`Invalid text for session context: contains forbidden characters`);
  }
  if (value.length > 512) {
    throw new Error('Session context value exceeds 512 chars');
  }
  return value;
}

function redactPreview(value: string): string {
  if (!value) return '<empty>';
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}
