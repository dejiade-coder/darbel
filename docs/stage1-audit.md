# Stage 1 audit — Phase 1 consolidation

**Date:** 2026-05-21
**Goal:** Establish baseline before migrating Darbel's hand-written SQL into Prisma-managed migrations.
**Outcome:** Audit complete. Installation is healthy. Stage 2 can proceed when ready.

---

## Why we are doing this

Phase 1 of Darbel shipped with a v1 SQL set (`database/01-schema.sql` through `04-seed.sql`) that required a v2 patch (`05-fix-v2.sql`) to actually work — the v2 patch introduced the `darbel_auth` role and reorganised RLS for the unauthenticated login flow.

A fresh clone of the repo today cannot reproduce the working state without applying both v1 and v2 in the right order, with manual interventions. This is technical debt. The fix is to consolidate everything into one set of Prisma-managed migrations so:

1. A new developer (or a CI environment) can run `npx prisma migrate deploy` once and get exactly the state we have now
2. Future schema changes follow a standard, traceable workflow
3. The v1/v2 split is dissolved — no more "apply patch on top of patch"

---

## Design decision

**Source of truth = `schema.prisma`** for tables, columns, indexes, and relations.

Hand-written SQL migrations sit alongside Prisma-generated migrations under `prisma/migrations/`, and own everything Prisma does not natively understand:

- Row-Level Security policies
- Custom database roles (`darbel_app`, `darbel_auth`, `darbel_migrator`)
- Audit triggers and trigger functions
- Custom helper functions (`current_app_user_id()`, etc.)
- Postgres GRANTs and REVOKEs
- Seed data

Both flow through Prisma's migration tracking via the `_prisma_migrations` table.

---

## Current state of the installation

### Tables present (13)

```
audit_log, jurisdictions, login_attempts, password_history,
permissions, role_permissions, roles, sensitive_access_log,
sessions, tenant_settings, tenants, user_roles, users
```

All match what `schema.prisma` declares. No drift.

### Custom helper functions (11)

These will live in a hand-written migration:

```
current_app_client_ip          current_user_has_permission
current_app_request_id         current_user_is_platform_admin
current_app_tenant_id          fn_audit_log_immutable
current_app_user_agent         fn_audit_trigger
current_app_user_email         set_updated_at
current_app_user_id
```

### Custom roles (3)

| Role | BYPASSRLS | CANLOGIN | Purpose |
|---|---|---|---|
| `darbel_app` | false | true | Authenticated, tenant-scoped operations. RLS-enforced. |
| `darbel_auth` | true | true | Pre-authentication flows (login, refresh, logout, password change). Narrow GRANTs only on auth-related tables. |
| `darbel_migrator` | true | true | Migrations and admin scripts. Full DDL access. |

### Postgres extensions in use

- `pgcrypto` — `gen_random_uuid`, password hashing helpers
- `citext` — case-insensitive email
- `pg_trgm` — trigram indexes for fuzzy search

### RLS policies

Present on all sensitive tables. Not enumerated here in full; will be captured verbatim into a hand-written migration during Stage 2.

### Seed data present

| Object | Count |
|---|---|
| Jurisdictions | 1 (Lagos) |
| Permissions | 35 |
| Roles | 9 (SUPER_ADMIN, TENANT_ADMIN, REGISTRAR, MEDICAL_OFFICER, LAB_TECHNICIAN, FINANCE_OFFICER, AUDITOR, INSPECTOR, HANDLER) |
| Tenants | 1 (Branddarrow) |
| Users | 1 (admin@branddarrow.com — Super Admin) |

---

## Stage 2 plan (do next session)

Produce four migration files under `backend/prisma/migrations/`:

| File | Owner | Contents |
|---|---|---|
| `0001_init/migration.sql` | Prisma-generated | Extensions, tables, indexes, foreign keys, enums |
| `0002_functions_and_roles/migration.sql` | Hand-written | 11 helper functions, 3 custom roles, GRANTs |
| `0003_rls_and_triggers/migration.sql` | Hand-written | RLS policies on all sensitive tables, audit triggers, audit log immutability |
| `0004_seed/migration.sql` | Hand-written | Jurisdictions, permissions, roles, role_permissions, bootstrap tenant + admin |

Then mark all four as already-applied against the live database using `npx prisma migrate resolve --applied <name>`. This tells Prisma "the database is at this state" without re-running anything destructive.

Verification step: Drop a scratch database, run `npx prisma migrate deploy` against it, then run the smoke test against that scratch database. It must pass identically.

---

## Risks for Stage 2

1. **Wrong baseline marker.** If we `resolve --applied` a migration before its SQL is actually in the database, Prisma will think the schema is ahead of reality, and future migrations will fail mysteriously. Mitigation: verify the database state matches each migration file before marking applied.

2. **Checksum drift.** Once committed, manual migrations cannot be edited. If we need to fix a bug in `0002_functions_and_roles/migration.sql` later, we must write `0005_fix_xyz/migration.sql` rather than editing in place. This is normal Prisma discipline but worth remembering.

3. **Postgres-version-specific syntax.** All SQL in the new migrations must work on Postgres 17 (your current version) and ideally on 14+ (lowest reasonable cloud-DB version). We will test against the scratch DB.

---

## What is NOT changing

- The live database (`darbel` on localhost). Stage 2 only adds Prisma's metadata; it does not re-run schema-altering SQL.
- The application code. Backend and frontend stay exactly as they are.
- The bootstrap admin credentials (`admin@branddarrow.com` / `Blessing@22.`).
- The v2 patch folder (`C:\Users\OLADIMEJI\Downloads\darbel-v2-patch\`). After Stage 5, it gets moved into `docs/migration-history/` for archival.

---

## How to resume

Next session, the conversation prompt is: **"continue Phase 1 consolidation, start Stage 2."** I will read this document and we pick up exactly where we left off. No re-explaining the v1/v2 history or the design decision — they are captured here.

Estimated time to complete Stages 2 through 5: 2-3 focused hours.
