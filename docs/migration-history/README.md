# Migration history

This folder preserves the journey from Phase 1's initial hand-written SQL through to the consolidated Prisma-managed migrations that live in `backend/prisma/migrations/`. It exists for institutional memory: anyone reading the codebase a year from now can see what changed, why, and what was learned.

If you are setting up Darbel for the first time, **you do not need this folder.** Use [`docs/setup-runbook.md`](../setup-runbook.md) instead. This is reference material.

---

## The journey, in five chapters

### Chapter 1 — Phase 1 v1: hand-written SQL

Originally shipped in May 2026 as four hand-written SQL files run sequentially by the operator:

- `database/01-schema.sql` — 13 tables, indexes, FKs, custom functions, basic triggers
- `database/02-rls-policies.sql` — RLS enabled, roles created (`darbel_app`, `darbel_migrator`), all policies
- `database/03-audit-triggers.sql` — audit trigger function, table bindings, immutability triggers
- `database/04-seed.sql` — Lagos jurisdiction, 35 permissions, 9 roles, 76 grants, Branddarrow tenant, bootstrap admin

The legacy files remain in `database/` at the repository root for reference.

**v1 worked for the table layer**, but ran into structural problems when the auth flow needed to mutate user state from an unauthenticated context (login). The next chapter explains.

### Chapter 2 — Bugs discovered through integration testing

During the first end-to-end verification, **nine real bugs** surfaced. They were not caught by `tsc --noEmit` because they were integration-level, not type-level. They are catalogued here as a lesson on the limits of type-checking:

| # | Layer | Symptom | Fix |
|---|---|---|---|
| 1 | DB grants | `darbel_migrator` could not write tables | `GRANT ALL ... TO darbel_migrator` |
| 2 | NestJS module | `RolesModule` did not import `AuthModule` | added import |
| 3 | NestJS module | `AuditModule` did not import `AuthModule` | added import |
| 4 | NestJS module | `AuthModule` did not export `JwtModule` | added re-export |
| 5 | RLS | unauthenticated user lookup blocked | initially patched; later replaced by `darbel_auth` role |
| 6 | RLS | unauthenticated tenant join blocked | same |
| 7 | RLS | post-login user UPDATE blocked | same |
| 8 | RLS | session INSERT blocked even with login policy | same — structural |
| 9 | Architecture | RLS-during-login pattern was wrong | replaced with dual database role design |

The first iteration (`darbel-v1-patches/`, not preserved separately because it was layered through the chat) added "unauthenticated login policies" as patches. They worked for individual mutations but the pattern did not scale — every new operation in the auth flow needed its own patchwork policy.

### Chapter 3 — v2: dual database role architecture

The structural fix introduced `darbel_auth` — a database role with `BYPASSRLS` but extremely narrow GRANTs (only on users, tenants, sessions, login_attempts, password_history, and the IAM tables needed to construct a permission set at token-issue time). It cannot reach any domain table.

The PrismaService grew a second client (`this.auth`) using `DATABASE_AUTH_URL`. Pre-authentication flows go through `prisma.runAuth()`; post-authentication flows continue through `prisma.runWithContext()` (which uses `darbel_app`, RLS-enforced).

The artifacts that delivered this change are in `darbel-v2-patch/`:

- `database/05-fix-v2.sql` — created `darbel_auth`, dropped the v1 patchwork login policies, restored the clean `sessions_self` policy
- `backend-patches/` — five patched backend files (`prisma.service.ts`, `auth.module.ts`, `roles.module.ts`, `audit.module.ts`, `env.schema.ts`)
- `scripts/smoke-test.js` — the programmatic end-to-end auth flow exercise
- `apply-patch.js` — Node script that applied everything

After v2, the smoke test passed cleanly. Phase 1 was verifiably working.

### Chapter 4 — Stage 2: Prisma migration consolidation

v1 + v2 in source control meant a fresh clone could not reproduce the install without applying both in the right order with manual interventions — fragile. Stage 2 (May 22, 2026) consolidated everything into five canonical Prisma-managed migration files:

- `20260521120000_extensions` — pgcrypto, citext, pg_trgm
- `20260521120001_init` — 13 tables, indexes, foreign keys
- `20260521120002_functions_and_roles` — 11 helper functions, three roles, GRANTs (clean v2 design from the start, no patchwork)
- `20260521120003_rls_and_triggers` — 25 RLS policies, 8 audit triggers, 4 immutability triggers, audit trigger function
- `20260521120004_seed` — Lagos jurisdiction, 35 permissions, 9 roles, 76 role-permissions, Branddarrow tenant, bootstrap admin (pinned IDs and hash from the existing live database)

The Stage 2 patch (`darbel-stage2-patch/`) baselined these against the live database using `npx prisma migrate resolve --applied` — telling Prisma "these are already in your database" without re-running any DDL.

A tenth bug surfaced during this stage: `darbel_migrator` had never been granted `CREATE ON SCHEMA public`, so it could not create the `_prisma_migrations` bookkeeping table. The Stage 2 script granted it live; Stage 3 added it to the migration history properly.

### Chapter 5 — Stage 3: verification against scratch database

To prove the migrations actually reproduce the install, Stage 3 (May 22, 2026) created a scratch database `darbel_scratch`, ran `npx prisma migrate deploy` against it, and compared the result to the live database. After fixing one verification-script counting bug, parity was byte-identical:

- Same 25 RLS policies (same names, same `qual`, same `with_check`)
- Same 10 triggers (8 audit + 2 immutability triggers on `audit_log` + the trigger on `sensitive_access_log` which surfaced as additional immutability)
- Same 11 custom helper functions

A new migration `20260522010000_migrator_create_grant` folded the missing `GRANT CREATE` into history.

An eleventh bug surfaced and was documented (not fixed in migrations, because it is correctly a DBA responsibility): `CREATE EXTENSION` requires database-level CREATE privilege which the migrator role does not have. The fresh-install runbook now explicitly calls out that extensions must be created by `postgres` superuser before `prisma migrate deploy` runs.

The Stage 3 patch (`darbel-stage3-patch/`) contains the verification script and the new migration.

---

## What lives in this folder

```
docs/migration-history/
├── README.md                        ← this file
├── darbel-v2-patch/                 ← Chapter 3 artifacts
│   ├── README.md
│   ├── apply-patch.js
│   ├── database/
│   │   └── 05-fix-v2.sql
│   ├── backend-patches/
│   │   ├── auth.module.ts
│   │   ├── audit.module.ts
│   │   ├── env.schema.ts
│   │   ├── prisma.service.ts
│   │   └── roles.module.ts
│   └── scripts/
│       └── smoke-test.js
├── darbel-stage2-patch/             ← Chapter 4 artifacts
│   ├── apply-stage2.js
│   └── migrations/
│       ├── migration_lock.toml
│       ├── 20260521120000_extensions/migration.sql
│       ├── 20260521120001_init/migration.sql
│       ├── 20260521120002_functions_and_roles/migration.sql
│       ├── 20260521120003_rls_and_triggers/migration.sql
│       └── 20260521120004_seed/migration.sql
└── darbel-stage3-patch/             ← Chapter 5 artifacts
    ├── apply-stage3.js
    └── migrations/
        └── 20260522010000_migrator_create_grant/migration.sql
```

The Stage 2 and Stage 3 migration files inside this folder are duplicates of what is in `backend/prisma/migrations/` — kept here for completeness so the patch archives are self-contained. The active source of truth for migrations remains `backend/prisma/migrations/`.

---

## Why preserve all this?

Three reasons:

1. **Institutional memory.** If Sean leaves Darbel (or Branddarrow scales the team), the next engineer sees not just the working system but how it was built, including the wrong turns.

2. **Pattern instruction.** Phase 2, Phase 3, and beyond will face similar "schema vs RLS vs application boundary" decisions. The patterns documented here (especially the dual-role design) are the answer.

3. **Honest engineering.** Pretending the path was clean when it was not invites the next engineer to make the same mistakes. Naming bugs and their structural fixes makes the codebase humbler and more correct.

---

## The smoke test, surfaced explicitly

The smoke test in `darbel-v2-patch/scripts/smoke-test.js` is **not** archived material. It remains the only end-to-end regression test for the auth flow. Run it after any change to auth, user, or session logic:

```powershell
$env:DARBEL_BOOTSTRAP_PASSWORD = "<your_password>"
node docs\migration-history\darbel-v2-patch\scripts\smoke-test.js
```

Eventually it should be promoted to a proper Jest e2e test under `backend/test/`. Until that happens, this script is the canonical verification.
