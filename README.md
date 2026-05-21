# Darbel

A multi-tenant SaaS platform for **food handler compliance management**.
Owned and operated by **Branddarrow Business Hub**. First deployment: Lagos, Nigeria.

> **Phase 1 — Foundation.** Identity, access, audit. Domain modules (registration, payments, medical, certificates, reports) land in subsequent phases. See architectural doc in `docs/01-architecture.md`.

---

## Repository structure

```
darbel/
├── docs/
│   └── 01-architecture.md          Master architectural reference
├── database/                       PostgreSQL schema and migrations
│   ├── 01-schema.sql               Tables, indexes, helper functions
│   ├── 02-rls-policies.sql         Row-Level Security + DB roles
│   ├── 03-audit-triggers.sql       Audit triggers + tamper protection
│   └── 04-seed.sql                 Jurisdictions, permissions, system roles,
│                                   Branddarrow tenant, bootstrap Super Admin
├── backend/                        NestJS 10 + TypeScript + Prisma
│   └── See backend/README.md
└── frontend/                       Next.js 14 + TypeScript + Tailwind
    └── See frontend/README.md
```

## Quickstart — run the whole stack locally

You need: PostgreSQL 16+, Node 20+, npm.

### 1. Database

```bash
cd database
createdb -U postgres darbel
psql -U postgres -d darbel -f 01-schema.sql
psql -U postgres -d darbel -f 02-rls-policies.sql
psql -U postgres -d darbel -f 03-audit-triggers.sql
psql -U postgres -d darbel -f 04-seed.sql
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL and JWT_SECRET (32+ chars)
npx prisma generate
DATABASE_MIGRATOR_URL="postgresql://darbel_migrator:..." npx ts-node scripts/set-bootstrap-password.ts
npm run start:dev
```

Backend listens on `http://localhost:4000/api/v1`.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend listens on `http://localhost:3000`.

## What is delivered

### Database (Phase 1)
- Multi-tenant schema with `tenant_id` on every domain table
- Row-Level Security policies on tenants, users, roles, audit
- Append-only audit log populated by database triggers
- Sensitive-data redaction in audit (passwords, MFA secrets, medical results)
- Separate `sensitive_access_log` table for sensitive medical field reads
- Two-role DB access model: `darbel_app` (NOBYPASSRLS) and `darbel_migrator` (BYPASSRLS)
- Pre-seeded: Lagos jurisdiction, 35 permissions, 9 system roles, Branddarrow tenant, Super Admin user

### Backend API (Phase 1)
- 30 endpoints under `/api/v1`
- Auth: login -> MFA -> forced password change -> access + refresh tokens
- TOTP-based MFA with AES-256-GCM encrypted secrets at rest
- Argon2id password hashing with policy and history enforcement
- JWT (HS256 dev / RS256 production) with refresh token rotation
- Permission-based access (RBAC) + Row-Level Security (ABAC)
- Tenant context stamping per transaction via `runWithContext()`
- Append-only audit query API (read-only)
- Structured logging with automatic redaction of credentials, tokens, MFA codes
- Rate limiting per IP, lockout on repeated failure

### Frontend (Phase 1)
- Next.js 14 App Router with Server Actions
- HTTP-only cookie auth (no token ever in client-side JavaScript)
- Login, MFA challenge, forced first-login password change flows
- Permission-aware sidebar
- Dashboard overview, users list, roles catalogue, audit log viewer
- Self-service account page: change password, enrol/disable MFA
- Edge middleware for fast anonymous-user redirect
- Restrained institutional design: Newsreader + IBM Plex, deep teal on parchment

## Verification

Both backend and frontend pass strict TypeScript compilation with zero errors. Production builds succeed.

```bash
cd backend  && npx tsc --noEmit && npm run build
cd frontend && npm run typecheck && npm run build
```

## Phase 1 numbers

|  | Files | LOC |
|---|---:|---:|
| Database (SQL) | 4 | 1,176 |
| Backend (NestJS) | 38 | 2,839 |
| Frontend (Next.js) | 38 | 2,644 |
| **Total** | **80** | **6,659** |

## What is NOT in Phase 1

Roadmap, in sequence:

- **Phase 2 — Registration**: Handler profile, trade categories, document uploads, UID generation, payment recording.
- **Phase 3 — Medical**: Test panel configuration, sample collection, lab result entry with "blind submit", medical officer approval, certificate issuance with QR verification.
- **Phase 4 — Payments**: Paystack / Flutterwave integration, finance approval workflow, refunds, reconciliation.
- **Phase 5 — Reports**: Excel and PDF exports, scheduled reports, compliance reports.
- **Phase 6 — Hardening**: Public certificate verification portal, renewal automation.

## Open items requiring operator input

1. JWT signing keys for production (RS256 with rotation)
2. Database role passwords managed via secret manager
3. First real tenant to onboard
4. Email / SMS provider account (Termii recommended for Nigeria) — Phase 2 dependency
5. Confirm Branddarrow Super Admin email
6. Hosting provider in Nigeria (MainOne / Layer3 / Galaxy Backbone)
7. Darbel brand assets (logo, palette refinement, certificate template style)

## Security posture summary

- Tenant isolation enforced at the database via RLS, not just at the application
- Audit is structural — database triggers fire on every change
- `audit_log` has UPDATE / DELETE blocked at both GRANT and trigger level
- Sensitive fields redacted before they reach the audit log
- Lab Technicians can write HIV results but not read them after submission
- Tokens never available to client-side JavaScript
- Password changes revoke every session for that user on every device
- MFA secrets AES-256-GCM encrypted at rest
- Failed login attempts throttled and lockout-tracked
- PII never URL-encoded
