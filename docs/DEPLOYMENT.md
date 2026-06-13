# Darbel Production Deployment Guide

This guide covers a standard self-hosted deployment with PostgreSQL, the NestJS backend, and the Next.js frontend.

## 1. Runtime Requirements

- Node.js 24 LTS or the Node version approved by the hosting platform.
- PostgreSQL 17 preferred, PostgreSQL 14+ acceptable.
- A process manager such as systemd, PM2, Docker, or the hosting platform's native service runner.
- Durable storage for uploaded handler documents and certificate templates.
- TLS termination in front of both frontend and backend.

## 2. Backend Environment

Create `backend/.env` from `backend/.env.example`.

Required production values:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://darbel_app:<password>@<host>:5432/darbel?schema=public&connection_limit=10
DATABASE_AUTH_URL=postgresql://darbel_auth:<password>@<host>:5432/darbel?schema=public&connection_limit=5
DATABASE_MIGRATOR_URL=postgresql://darbel_migrator:<password>@<host>:5432/darbel?schema=public
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY=<escaped-private-key>
JWT_PUBLIC_KEY=<escaped-public-key>
CORS_ORIGINS=https://<frontend-domain>
ENFORCE_TENANT_CONTEXT=true
```

For a first production cut, HS256 will boot, but RS256 is preferred because it separates signing and verification material.

## 3. Frontend Environment

Create `frontend/.env` from `frontend/.env.example`.

```env
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://<api-domain>/api/v1
```

The frontend stores auth tokens in HTTP-only cookies. In production, cookies are marked secure, so the site must be served over HTTPS.

## 4. Database Migration

Run migrations from the backend directory:

```powershell
cd backend
npm.cmd ci
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
```

Confirm the three database roles exist:

- `darbel_migrator`
- `darbel_app`
- `darbel_auth`

The app role must not bypass RLS. The migrator and auth roles have intentionally narrower, different duties.

## 5. Build

Backend:

```powershell
cd backend
npm.cmd ci
npm.cmd run build
```

Frontend:

```powershell
cd frontend
npm.cmd ci
npm.cmd run build
npm.cmd audit --audit-level=moderate
```

The frontend currently builds on Next.js 16.2.9 and should report zero npm audit vulnerabilities.

Container packaging is available through the production compose example:

```powershell
docker compose -f docker-compose.production.example.yml build
```

Before using it, copy and fill `backend/.env.production` and `frontend/.env.production`, then replace the sample `NEXT_PUBLIC_API_BASE_URL` build argument with the real API URL.

## 6. Start Commands

Backend:

```powershell
cd backend
npm.cmd run start:prod
```

Frontend:

```powershell
cd frontend
npm.cmd run start
```

The frontend default port is `3000`; backend default port is `4000`.

## 7. Reverse Proxy

Recommended public routes:

- `https://app.example.com` -> frontend `localhost:3000`
- `https://api.example.com/api/v1` -> backend `localhost:4000/api/v1`

Ensure the reverse proxy forwards:

- `Host`
- `X-Forwarded-Proto`
- `X-Forwarded-For`

## 8. Storage

Development uploads live in `backend/storage`, which is git-ignored.

For production:

- Mount `backend/storage` to durable disk, or replace local storage with S3-compatible object storage.
- Back up storage together with the database.
- Do not deploy ephemeral containers without a persistent volume for uploads.

## 9. Post-Deploy Smoke Test

1. Open the frontend login page.
2. Sign in as a tenant admin.
3. Create a test registration.
4. Record and approve payment.
5. Confirm UID issuance.
6. Collect medical sample and enter all test results.
7. Approve a FIT result.
8. Print certificate and scan the QR code.
9. Export registrations, medical screenings, and certificates.
10. Confirm audit log entries exist for the workflow.

## 10. Rollback

- Keep the previous frontend and backend build artifact.
- Database migrations are forward-only. If rollback is needed, restore the latest tested database backup into a new database and point services back to the previous release.
- Never edit already-applied migration files in production.
