# Darbel

**A multi-tenant food handler compliance platform for Branddarrow Business Hub.**

Darbel digitises registration, statutory medical screening, payment approval, certificate issuance, public verification, and compliance reporting for food handlers across regulated jurisdictions. It is built Nigeria-first, designed multi-tenant from day one, and uses database row-level security plus full audit trails for sensitive regulatory and medical data.

---

## Status

**Current: End-to-end compliance workflow.**
Registration, payment approval, UID issuance, document upload, medical screening, certificate printing with QR verification, public verification, reports, exports, audit, and tenant certificate template upload are implemented.

**Production prep in progress.**
Deployment, backup/restore, UAT, notification integrations, and final operational hardening are being prepared.

---

## Architecture Summary

- **Backend** - NestJS 10 + TypeScript + Prisma + PostgreSQL 17
- **Frontend** - Next.js 16 App Router + TypeScript + Tailwind
- **Authentication** - Argon2id + JWT, refresh tokens, and TOTP MFA
- **Tenancy** - multi-tenant row-level security enforced at the database layer
- **Audit** - append-only audit log with database-level immutability triggers
- **File storage** - local development storage under `backend/storage`; use durable disk or S3-compatible storage in production
- **Background work** - planned for notification delivery and scheduled reminders

### Database Security Model

Darbel uses three Postgres roles with different security postures:

| Role | RLS | Purpose |
|---|---|---|
| `darbel_app` | enforced | All authenticated, tenant-scoped operations. Row-level security policies isolate tenants. |
| `darbel_auth` | bypassed | Pre-authentication flows only: login, refresh, logout, and password change. Narrow grants prevent domain-data access. |
| `darbel_migrator` | bypassed | Schema migrations and admin tasks. Full DDL access. |

The dual-role split for `darbel_app` and `darbel_auth` solves the auth-bootstrap problem cleanly. At login time there is no authenticated user, so RLS policies based on `current_app_user_id` cannot apply. `darbel_auth` connects only during auth flows and can access only the narrow set of tables auth requires.

---

## Repository Structure

```text
darbel/
├── README.md
├── backend/                      NestJS API
│   ├── src/
│   │   ├── modules/              auth, users, roles, audit, compliance modules
│   │   ├── database/             Prisma service and dual-client setup
│   │   ├── common/               guards, filters, decorators
│   │   └── config/               env validation and app config
│   ├── prisma/
│   │   ├── schema.prisma         table shapes and Prisma client source
│   │   └── migrations/           Prisma-managed migration history
│   └── scripts/                  bootstrap and admin scripts
├── frontend/                     Next.js app
│   └── src/
│       ├── app/                  routes and server actions
│       ├── components/           UI components
│       └── lib/                  API client, auth helpers, export helpers
├── docs/
│   ├── DEPLOYMENT.md             production deployment runbook
│   ├── BACKUP_RESTORE.md         backup and restore runbook
│   ├── OPERATIONS_READINESS.md   go-live checklist
│   ├── setup-runbook.md          fresh-install instructions
│   └── migration-history/        historical migration notes
└── database/                     legacy SQL kept for historical reference
```

---

## Prerequisites

- **PostgreSQL 17** or 14+
- **Node.js 24** and **npm 11**
- **Git**

For production you will also need:

- Durable storage for `backend/storage` or S3-compatible object storage
- SMTP/email provider and WhatsApp Business API credentials when notification delivery is enabled
- A backup location outside the application host

---

## Local Setup

The full walkthrough is in [docs/setup-runbook.md](docs/setup-runbook.md). Short version:

1. Install dependencies:

   ```powershell
   cd backend
   npm install
   cd ..\frontend
   npm install
   ```

2. Create the database and required Postgres extensions:

   ```powershell
   psql -U postgres -c "CREATE DATABASE darbel;"
   psql -U postgres -d darbel -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pg_trgm;"
   ```

3. Configure `backend/.env` from `backend/.env.example`, including `DATABASE_URL`, `DATABASE_AUTH_URL`, and `DATABASE_MIGRATOR_URL`.

4. Deploy migrations:

   ```powershell
   cd backend
   npx prisma migrate deploy
   ```

5. Start backend and frontend in separate terminals:

   ```powershell
   cd backend
   npm run start:dev
   ```

   ```powershell
   cd frontend
   npm run dev
   ```

6. Sign in at `http://localhost:3000`.

---

## Development Workflow

### Making Schema Changes

1. Edit `backend/prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name <descriptive_name>` from `backend`.
3. Hand-edit generated SQL when Prisma cannot infer RLS policies, custom functions, triggers, or seed data.
4. Commit the migration folder with the code that depends on it.

### Conventions

- **Source of truth for table shape:** `backend/prisma/schema.prisma`
- **Source of truth for policy and database behavior:** SQL inside `backend/prisma/migrations/`
- **Committed migrations are immutable.** Fix bugs with new migrations.
- **Never commit `.env` files.** Use `.env.example` as the template.

### Verification

Backend build:

```powershell
cd backend
npm run build
```

Frontend build:

```powershell
cd frontend
npm run build
```

Frontend audit:

```powershell
cd frontend
npm audit --audit-level=moderate
```

---

## Production Operations

- Deployment runbook: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Backup and restore runbook: [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md)
- Go-live checklist: [docs/OPERATIONS_READINESS.md](docs/OPERATIONS_READINESS.md)

---

## Security Notes

- Rotate all local placeholder passwords before deployment.
- Change the bootstrap admin password on first sign-in outside local development.
- Keep JWT and refresh-token secrets in the hosting environment, not source control.
- RLS is enforced by Postgres, not only by application code.
- The audit log is append-only and rejects updates/deletes through database triggers.
- `darbel_auth` cannot reach domain tables such as handlers, payments, medical results, certificates, or reports.

---

## License

Proprietary. Copyright 2026 Branddarrow Business Hub. All rights reserved.
