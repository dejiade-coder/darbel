# Darbel

**A multi-tenant food handler compliance platform for Branddarrow Business Hub.**

Darbel digitises the registration, statutory medical screening, and certification of food handlers across regulated jurisdictions. Built Nigeria-first, designed multi-tenant from day one, with row-level security and full audit trails appropriate for the medical and regulatory data it carries.

---

## Status

**Phase 1 (current): Identity, access, audit, dashboard.**
Working, verified end-to-end, in active development. Single-tenant in production (Branddarrow as Tenant 1).

**Phase 2 (next): Registration module.**
Handler profiles, trade categories, document uploads, UID generation, payment recording.

**Phase 3: Medical screening.**
Sample collection, lab result entry with role-based blind submission, medical officer approval, certificate issuance with QR verification.

**Phase 4–5: Payments hardening, reports, public verification portal.**

---

## Architecture summary

- **Backend** — NestJS 10 + TypeScript + Prisma + PostgreSQL 17
- **Frontend** — Next.js 14 (App Router) + TypeScript + Tailwind
- **Authentication** — Argon2id + JWT (HS256 dev / RS256 prod) + TOTP MFA with AES-256-GCM secret storage
- **Tenancy** — Multi-tenant with row-level security enforced at the database layer
- **Audit** — Append-only audit log with database-level immutability triggers
- **File storage** — MinIO (S3-compatible) for documents and certificates
- **Background work** — BullMQ + Redis for async jobs

### Database security model

Darbel uses three Postgres roles with different security postures:

| Role | RLS | Purpose |
|---|---|---|
| `darbel_app` | enforced | All authenticated, tenant-scoped operations. Row-Level Security policies isolate tenants. |
| `darbel_auth` | bypassed | Pre-authentication flows only (login, refresh, logout, password change). Narrow `GRANT`s prevent access to any domain data. |
| `darbel_migrator` | bypassed | Schema migrations and admin tasks. Full DDL access. |

The dual-role split for `darbel_app` and `darbel_auth` solves the auth-bootstrap problem cleanly: at login time there is no authenticated user, so RLS policies based on `current_app_user_id` cannot apply. `darbel_auth` connects only during the login flow and has access only to the narrow set of tables auth requires.

---

## Repository structure

```
darbel/
├── README.md                     ← you are here
├── backend/                      ← NestJS API
│   ├── src/
│   │   ├── modules/              ← auth, users, roles, audit, health
│   │   ├── database/             ← Prisma service (dual-client)
│   │   ├── common/               ← guards, filters, decorators
│   │   └── config/               ← env validation, app config
│   ├── prisma/
│   │   ├── schema.prisma         ← table shapes (source of truth)
│   │   └── migrations/           ← Prisma-managed migration history
│   └── scripts/                  ← bootstrap and admin scripts
├── frontend/                     ← Next.js app
│   ├── src/
│   │   ├── app/                  ← routes (login, dashboard, settings)
│   │   ├── components/           ← UI library
│   │   └── lib/                  ← API client, auth helpers
├── docs/
│   ├── stage1-audit.md           ← Phase 1 consolidation baseline
│   ├── setup-runbook.md          ← fresh-install instructions
│   └── migration-history/        ← v1→v2→consolidation journey
└── database/                     ← legacy SQL (kept for historical reference)
```

---

## Prerequisites

- **PostgreSQL 17** (or 14+) running locally with superuser access
- **Node.js 24** and **npm 11**
- **Git** for source control

For Phase 2 onwards you will also need:
- Redis (for BullMQ)
- MinIO or S3-compatible storage
- Termii account (for SMS/email in Nigeria)

---

## Fresh install — getting Darbel running locally

The full step-by-step is in [`docs/setup-runbook.md`](docs/setup-runbook.md). Short version:

1. **Clone the repo and install dependencies:**

   ```powershell
   git clone https://github.com/dejiade-coder/darbel.git
   cd darbel/backend && npm install
   cd ../frontend && npm install
   ```

2. **Create the database and grant initial privileges:**

   ```powershell
   psql -U postgres -c "CREATE DATABASE darbel;"
   psql -U postgres -d darbel -c "GRANT ALL ON SCHEMA public TO postgres;"
   psql -U postgres -d darbel -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pg_trgm;"
   ```

3. **Create the three database roles** (passwords are local-dev placeholders; rotate for production):

   ```powershell
   psql -U postgres -c "CREATE ROLE darbel_migrator LOGIN PASSWORD 'migrator_pass_local_2026' BYPASSRLS;"
   psql -U postgres -d darbel -c "GRANT ALL ON SCHEMA public TO darbel_migrator;"
   ```

4. **Configure environment variables** (`backend/.env`):

   ```
   DATABASE_URL=postgresql://darbel_app:app_pass_local_2026@localhost:5432/darbel?schema=public
   DATABASE_MIGRATOR_URL=postgresql://darbel_migrator:migrator_pass_local_2026@localhost:5432/darbel?schema=public
   DATABASE_AUTH_URL=postgresql://darbel_auth:auth_pass_local_2026@localhost:5432/darbel?schema=public
   JWT_SECRET=darbel-local-dev-secret-key-very-long-not-for-prod-2026
   JWT_ALGORITHM=HS256
   ```

5. **Deploy the schema:**

   ```powershell
   cd backend
   npx prisma migrate deploy
   ```

   This runs the six migration files in order. Migrations 0002 and 0006 create the remaining two roles (`darbel_app` and `darbel_auth`) and configure their permissions.

6. **Set role passwords to match `.env`:**

   ```powershell
   psql -U postgres -d darbel -c "ALTER ROLE darbel_app PASSWORD 'app_pass_local_2026'; ALTER ROLE darbel_auth PASSWORD 'auth_pass_local_2026';"
   ```

7. **Start backend and frontend in separate terminals:**

   ```powershell
   cd backend && npm run start:dev
   cd frontend && npm run dev
   ```

8. **Sign in** at `http://localhost:3000` as `admin@branddarrow.com` / `Blessing@22.`

For a full walkthrough with troubleshooting, see [`docs/setup-runbook.md`](docs/setup-runbook.md).

---

## Development workflow

### Making schema changes

1. Edit `backend/prisma/schema.prisma` to update table shapes.
2. Run `npx prisma migrate dev --name <descriptive_name>` — this generates a new migration folder under `prisma/migrations/`.
3. For Postgres-specific changes (RLS policies, custom functions, triggers, seed data), hand-edit the generated `migration.sql` to add the SQL Prisma cannot infer from the schema alone.
4. Commit the migration folder alongside any code changes that depend on it.

### Conventions

- **Source of truth for table shape:** `schema.prisma`
- **Source of truth for behaviour and policy:** hand-written SQL inside `prisma/migrations/`
- **Migration files are immutable once committed.** Bugs are fixed by adding a new migration, not editing an old one.
- **Never commit `.env` files.** The repo's `.gitignore` enforces this. Use `.env.example` as the template.

### Running the smoke test

The auth flow has an end-to-end smoke test that exercises login, password change, profile fetch, and logout against the running backend:

```powershell
$env:DARBEL_BOOTSTRAP_PASSWORD = "<your_password>"
node docs/migration-history/darbel-v2-patch/scripts/smoke-test.js
```

A passing run proves the entire auth stack is functioning before you touch a browser. It is the regression test that catches the kind of integration bugs that type-checking alone misses.

---

## Security notes

- **All passwords in this repo are placeholders for local development.** Rotate them before any deployment that handles real data.
- **The bootstrap admin password (`Blessing@22.`) is known.** Change it on first sign-in to any non-local environment.
- **RLS is enforced at the database layer**, not the application layer. Even if backend code forgets to filter by tenant, Postgres will refuse to return cross-tenant rows.
- **The audit log is append-only.** Triggers on `audit_log` refuse all `UPDATE` and `DELETE` statements regardless of who is running them.
- **`darbel_auth` cannot reach domain tables.** Even if a vulnerability exposed the auth-flow connection, an attacker could not read handler records, payment data, or medical results — those tables are completely invisible to that role.

---

## Contributing

This is a closed-source commercial project. If you have access:

- All work flows through pull requests on `main`
- Migrations are reviewed for both schema correctness and security implications
- Run the smoke test before requesting review
- Update `docs/` for any architectural changes

---

## Acknowledgements

- Built by Sean Olabode Badiru (Branddarrow Business Hub) with Claude (Anthropic) as engineering pair.
- The dual-role database security model was developed iteratively across three integration-test sessions in May 2026; see [`docs/migration-history/`](docs/migration-history/) for the journey.

---

## License

Proprietary. © 2026 Branddarrow Business Hub. All rights reserved.
