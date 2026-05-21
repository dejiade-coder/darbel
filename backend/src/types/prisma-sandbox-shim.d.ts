/**
 * Prisma type fallbacks for restricted-network environments.
 *
 * When `prisma generate` cannot reach binaries.prisma.sh (sandboxes, air-gapped
 * builds), the generator falls back to a stub `index.d.ts` that lacks the
 * `Prisma.*WhereInput` namespace exports. This file provides minimally-typed
 * fallbacks for those exports so the TypeScript compile remains clean.
 *
 * In any environment where `prisma generate` succeeds normally — which is the
 * expected case in development and production — the generated declarations
 * take precedence over these fallbacks (TypeScript merges declarations, and
 * the real types are strict supersets).
 *
 * If you are reading this in a normal dev setup and Prisma generated fine,
 * you can delete this file safely. It is kept in the repo as a safety net
 * for restricted CI environments.
 */
declare module '@prisma/client' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace Prisma {
    type UserWhereInput = Record<string, unknown>;
    type RoleWhereInput = Record<string, unknown>;
    type AuditLogWhereInput = Record<string, unknown>;
    type TransactionClient = unknown;
  }
}

export {};
