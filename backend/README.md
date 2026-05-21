# Darbel Backend

NestJS 10 + TypeScript + Prisma + PostgreSQL.

This is the Phase 1 backend: auth, users, roles, audit. No business modules yet (registration, payments, medical, certificates, reports) — those are Phase 2 onward.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the database and apply SQL migrations
#    Two ways:
#    a) Use psql directly:
psql -U darbel_migrator -d darbel -f ../database/01-schema.sql
psql -U darbel_migrator -d darbel -f ../database/02-rls-policies.sql
psql -U darbel_migrator -d darbel -f ../database/03-audit-triggers.sql
psql -U darbel_migrator -d darbel -f ../database/04-seed.sql

#    b) Or use the helper script (requires pg npm package — installed by npm install):
DATABASE_MIGRATOR_URL=postgresql://... node scripts/apply-sql.js

# 3. Set bootstrap admin password (replaces placeholder seed hash)
DATABASE_MIGRATOR_URL=postgresql://... npx ts-node scripts/set-bootstrap-password.ts

# 4. Generate Prisma client
npm run prisma:generate

# 5. Copy env file
cp .env.example .env
# Edit .env, set DATABASE_URL (use darbel_app role, NOT migrator) and JWT_SECRET

# 6. Run
npm run start:dev
```

## How the layers fit together

```
  HTTP request
       │
       ▼
  ┌────────────────────────────────────────────┐
  │  RequestIdMiddleware (assigns request UUID) │
  └────────────────────────────────────────────┘
       │
       ▼
  ┌────────────────────────────────────────────┐
  │  ThrottlerGuard (rate limit)                │
  └────────────────────────────────────────────┘
       │
       ▼
  ┌────────────────────────────────────────────┐
  │  JwtAuthGuard (sets req.actor)              │
  └────────────────────────────────────────────┘
       │
       ▼
  ┌────────────────────────────────────────────┐
  │  PermissionGuard (checks @Permissions)      │
  └────────────────────────────────────────────┘
       │
       ▼
  ┌────────────────────────────────────────────┐
  │  Controller method                          │
  │    │                                        │
  │    └─► Service: prisma.runWithContext(...)  │
  │           │                                 │
  │           ▼                                 │
  │  ┌─────────────────────────────────────┐   │
  │  │  BEGIN;                              │   │
  │  │  SET LOCAL app.current_user_id...    │   │
  │  │  SET LOCAL app.current_tenant_id...  │   │
  │  │  <queries run with RLS active>       │   │
  │  │  <audit triggers populate audit_log> │   │
  │  │  COMMIT;                             │   │
  │  └─────────────────────────────────────┘   │
  └────────────────────────────────────────────┘
       │
       ▼
  HTTP response (with x-request-id header)
```

## Endpoints (Phase 1)

| Method | Path | Auth | Permission |
|---|---|---|---|
| GET  | /api/v1/health/live          | public | — |
| GET  | /api/v1/health/ready         | public | — |
| POST | /api/v1/auth/login           | public | — |
| POST | /api/v1/auth/mfa/verify      | public | — |
| POST | /api/v1/auth/refresh         | public | — |
| POST | /api/v1/auth/logout          | public | — |
| POST | /api/v1/auth/password/first-change | public (challenge token) | — |
| POST | /api/v1/auth/password/change | JWT | — |
| POST | /api/v1/auth/mfa/enroll/start | JWT | — |
| POST | /api/v1/auth/mfa/enroll/confirm | JWT | — |
| POST | /api/v1/auth/mfa/disable     | JWT | — |
| GET  | /api/v1/users/me             | JWT | — |
| GET  | /api/v1/users                | JWT | `user.view` |
| GET  | /api/v1/users/:id            | JWT | `user.view` |
| POST | /api/v1/users                | JWT | `user.create` |
| PATCH| /api/v1/users/:id            | JWT | `user.update` |
| PUT  | /api/v1/users/:id/roles      | JWT | `user.assign_role` |
| DELETE| /api/v1/users/:id           | JWT | `user.deactivate` |
| GET  | /api/v1/roles                | JWT | `role.view` |
| GET  | /api/v1/roles/permissions    | JWT | `role.view` |
| GET  | /api/v1/audit                | JWT | `audit.view` |
| GET  | /api/v1/audit/:id            | JWT | `audit.view` |

## Critical security notes

1. **`darbel_app` MUST NOT have `BYPASSRLS`.** Verify with:
   ```sql
   SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'darbel_app';
   ```
   `rolbypassrls` must be `f`.

2. **The application always uses `prisma.runWithContext()` (or `runAnonymous()`).** Direct calls like `prisma.user.findMany()` outside a context wrapper will be visible (RLS will block them because session vars are not set). This is intentional.

3. **`audit_log` and `sensitive_access_log` UPDATE/DELETE are blocked at both the GRANT and trigger level.** Defense in depth.

4. **Password change revokes all sessions.** This is a strict policy: changing your password logs you out of every device.

5. **JWT_SECRET is for development only.** Production must use RS256 with key rotation.

## Open items (carried from architecture)

1. Real JWT signing keys (RS256) for non-dev environments
2. Real database role passwords (managed by secret manager)
3. First real tenant onboarding (currently only Branddarrow exists)
4. Email/SMS provider integration (Termii) — deferred to Phase 2 (for handler notifications)

## Tests

Phase 1 ships endpoints; integration tests against a real Postgres are in Phase 1.5 once the database is provisioned in a CI environment. Add `test/auth.e2e-spec.ts` etc. The unit-test scaffolding (`jest`) is configured but no specs are committed yet.
