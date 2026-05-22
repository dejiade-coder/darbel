# Darbel — Setup runbook

Step-by-step instructions for getting Darbel running on a fresh machine. Tested on Windows 10/11 with PowerShell 5.1 and PostgreSQL 17.

For an overview of what you are installing and why, see the [main README](../README.md).

---

## Prerequisites checklist

Before starting, confirm:

- [ ] **PostgreSQL 17** installed and running. Verify with `Get-Service postgresql*` — status should be `Running`.
- [ ] **Node.js 24+** and **npm 11+** installed. Verify with `node --version` and `npm --version`.
- [ ] **Git** installed and configured. Verify with `git --version`.
- [ ] You know your `postgres` superuser password.

---

## Part 1 — Database setup (one-time, as DBA)

These steps require the `postgres` superuser. They create the database, install Postgres extensions, and create the `darbel_migrator` role with the privileges needed to run migrations.

### 1.1 Create the database

```powershell
psql -U postgres -c "CREATE DATABASE darbel;"
```

### 1.2 Install Postgres extensions

Extensions require `CREATE` privilege on the database — a DBA-level operation. Migrations cannot install them, so we do this once now.

```powershell
psql -U postgres -d darbel -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

Expected output: `CREATE EXTENSION` three times.

### 1.3 Create the migrator role

This role runs migrations and has full DDL access. The other two roles (`darbel_app` and `darbel_auth`) will be created by the migrations themselves.

```powershell
psql -U postgres -c "CREATE ROLE darbel_migrator LOGIN PASSWORD 'migrator_pass_local_2026' BYPASSRLS;"
```

For production, use a strong randomly-generated password and update `.env` accordingly.

### 1.4 Grant schema privileges to migrator

```powershell
psql -U postgres -d darbel -c "GRANT ALL ON SCHEMA public TO darbel_migrator;"
```

This is critical — without `CREATE ON SCHEMA public`, the migrator cannot create the `_prisma_migrations` bookkeeping table.

---

## Part 2 — Application setup

### 2.1 Clone the repository

```powershell
cd C:\Users\<your-username>
git clone https://github.com/dejiade-coder/darbel.git
cd darbel
```

### 2.2 Install backend dependencies

```powershell
cd backend
npm install
```

Expect ~810 packages installed. Some `npm audit` warnings are normal for the upstream Node ecosystem and do not require attention during development.

### 2.3 Configure backend environment

Copy the template and customise:

```powershell
Copy-Item .env.example .env
```

Open `.env` in any editor and ensure the following lines exist with correct values:

```
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://darbel_app:app_pass_local_2026@localhost:5432/darbel?schema=public&connection_limit=10
DATABASE_MIGRATOR_URL=postgresql://darbel_migrator:migrator_pass_local_2026@localhost:5432/darbel?schema=public
DATABASE_AUTH_URL=postgresql://darbel_auth:auth_pass_local_2026@localhost:5432/darbel?schema=public

JWT_ALGORITHM=HS256
JWT_SECRET=darbel-local-dev-secret-key-very-long-not-for-prod-2026
JWT_ACCESS_TOKEN_TTL_SECONDS=900
JWT_REFRESH_TOKEN_TTL_SECONDS=604800
JWT_ISSUER=darbel
JWT_AUDIENCE=darbel-api

CORS_ORIGINS=http://localhost:3000
ENFORCE_TENANT_CONTEXT=true
```

For production, every password and the JWT secret must be replaced with strong random values.

### 2.4 Generate the Prisma client

```powershell
npx prisma generate
```

Expected: a "Generated Prisma Client" success message.

### 2.5 Deploy migrations

```powershell
$env:DATABASE_URL = "postgresql://darbel_migrator:migrator_pass_local_2026@localhost:5432/darbel?schema=public"
npx prisma migrate deploy
```

The temporary `DATABASE_URL` override routes Prisma through the migrator role for this command. After it completes, your terminal session will keep the override; the `.env` is untouched.

Expected output:
```
6 migrations found in prisma/migrations
Applying migration `20260521120000_extensions`
Applying migration `20260521120001_init`
Applying migration `20260521120002_functions_and_roles`
Applying migration `20260521120003_rls_and_triggers`
Applying migration `20260521120004_seed`
Applying migration `20260522010000_migrator_create_grant`
All migrations have been successfully applied.
```

### 2.6 Set passwords for the two roles created by migrations

The migrations created `darbel_app` and `darbel_auth` with placeholder passwords. Set them to match your `.env`:

```powershell
psql -U postgres -d darbel -c "ALTER ROLE darbel_app PASSWORD 'app_pass_local_2026';"
psql -U postgres -d darbel -c "ALTER ROLE darbel_auth PASSWORD 'auth_pass_local_2026';"
```

### 2.7 Install frontend dependencies

```powershell
cd ..\frontend
npm install
```

### 2.8 Configure frontend environment

```powershell
Copy-Item .env.example .env
```

The default values point at `http://localhost:4000/api/v1` which matches the backend. No edits needed for local development.

---

## Part 3 — Running Darbel

### 3.1 Start the backend (terminal 1)

```powershell
cd C:\Users\<your-username>\darbel\backend
npm run start:dev
```

Wait for these two lines:
```
Prisma connected (app + auth)
Darbel backend listening on :4000 (development)
```

This terminal stays occupied. Do not close it.

### 3.2 Start the frontend (terminal 2)

```powershell
cd C:\Users\<your-username>\darbel\frontend
npm run dev
```

Wait for `Ready in X.Xs` and `Local: http://localhost:3000`.

This terminal also stays occupied.

### 3.3 Verify with the smoke test (terminal 3, optional but recommended)

```powershell
cd C:\Users\<your-username>\darbel
$env:DARBEL_BOOTSTRAP_PASSWORD = "Blessing@22."
node docs\migration-history\darbel-v2-patch\scripts\smoke-test.js
```

Expected: `SMOKE TEST PASSED` after seven green checkmarks.

### 3.4 Sign in via the browser

Open `http://localhost:3000`. Sign in with:

- **Email:** `admin@branddarrow.com`
- **Password:** `Blessing@22.`

You should land on the dashboard. **Change this password immediately** if this is anything other than a throwaway local-development install.

---

## Troubleshooting

### "permission denied for schema public" during `prisma migrate deploy`

`darbel_migrator` is missing the schema CREATE grant. Run:

```powershell
psql -U postgres -d darbel -c "GRANT CREATE ON SCHEMA public TO darbel_migrator;"
```

Then retry.

### "permission denied to create extension"

Extensions must be created as `postgres` superuser, not by the migrator. Run Part 1 Step 1.2.

### Backend exits with "JWT_SECRET is required when JWT_ALGORITHM=HS256"

Your `.env` is missing the `JWT_SECRET=` line, or the value got cut from it by a botched edit. Verify with:

```powershell
Get-Content backend\.env | Select-String "JWT_SECRET"
```

### Login returns "An unexpected error occurred"

The most informative diagnosis is the backend log. Look at the terminal running `npm run start:dev` and find the most recent `ERROR` line. The stack trace identifies which database operation failed.

### Smoke test cannot find a working password

Probe explicitly:

```powershell
$env:DARBEL_BOOTSTRAP_PASSWORD = "<your_password>"
node docs\migration-history\darbel-v2-patch\scripts\smoke-test.js
```

If your password contains `$`, wrap it in single quotes: `$env:DARBEL_BOOTSTRAP_PASSWORD = 'Pa$$word'`.

---

## Operational notes

### Updating to a new version

```powershell
git pull
cd backend
npm install                                 # in case dependencies changed
$env:DATABASE_URL = "postgresql://darbel_migrator:migrator_pass_local_2026@localhost:5432/darbel?schema=public"
npx prisma migrate deploy                   # applies any new migrations
npx prisma generate                         # regenerates types
npm run start:dev                           # restart
```

### Backing up the database

```powershell
pg_dump -U postgres -d darbel -F c -f darbel-backup-$(Get-Date -Format yyyyMMdd).dump
```

### Restoring from backup

```powershell
psql -U postgres -c "DROP DATABASE IF EXISTS darbel;"
psql -U postgres -c "CREATE DATABASE darbel;"
pg_restore -U postgres -d darbel darbel-backup-YYYYMMDD.dump
```

After restoring, set role passwords (Part 2 Step 2.6) again if they have drifted.

---

## Production deployment notes

A few things change for production:

- **Strong passwords everywhere.** Replace every `_pass_local_2026` placeholder with a randomly-generated 32+ character password.
- **JWT algorithm = RS256.** Generate an RSA keypair and set `JWT_ALGORITHM=RS256`, `JWT_PRIVATE_KEY=...`, `JWT_PUBLIC_KEY=...`.
- **Secrets manager.** Do not store passwords in `.env` files. Use AWS Secrets Manager, Azure Key Vault, HashiCorp Vault, or equivalent.
- **TLS.** Postgres connections must use SSL. Append `&sslmode=require` to database URLs.
- **Hosting.** Nigerian providers (MainOne, Layer3, Galaxy Backbone) for data residency.
- **First-login password rotation.** Set `must_change_password=TRUE` for the bootstrap admin so the deployer is forced to choose a new password on first sign-in.
- **Monitoring.** Forward backend logs to a structured logging service (CloudWatch, Datadog, etc.). The Pino-based logger already produces JSON-structured output.

---

## Where to go from here

Once the system is running:

- Explore the dashboard: Users, Roles & Permissions, Audit log
- Read [`docs/stage1-audit.md`](stage1-audit.md) for the architectural baseline
- Read [`docs/migration-history/README.md`](migration-history/README.md) for the history of how the database security model was built
- For new development, follow the workflow in the main [`README.md`](../README.md)
