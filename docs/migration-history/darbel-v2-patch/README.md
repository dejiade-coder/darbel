# Darbel v2 patch

This patch fixes the nine bugs identified during v1 integration testing and introduces a structural change: a dedicated `darbel_auth` database role for the pre-authentication flows.

## What changed and why

### The root cause of v1 failures

The v1 design tried to handle the "auth bootstrap problem" — the chicken-and-egg situation where a user is mid-login (so `current_app_user_id` is NULL) but the database still needs to read users, write sessions, and update lockout counters — by adding RLS policies with `current_app_user_id() IS NULL` exceptions. This pattern proved brittle: each new write in the auth flow needs a new policy, and Postgres's policy evaluation has subtleties that caused INSERTs to fail even when policies looked correct.

### The v2 fix

A separate database role, `darbel_auth`, handles pre-authentication operations. It has `BYPASSRLS` (so RLS does not block it) but has GRANTs only on a narrow set of tables: `users`, `tenants`, `sessions`, `login_attempts`, `password_history`, and the role/permission lookup tables. It explicitly **cannot** see any domain table (handlers, payments, medical, certificates). The security boundary is enforced via GRANTs rather than policies.

The application code path:

```
┌────────────────────────────────────────────────────────────────┐
│  Pre-authentication flows (login, refresh, logout, password)   │
│      → prisma.runAuth(...)                                     │
│      → connects as darbel_auth (BYPASSRLS, narrow grants)      │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  All authenticated, tenant-scoped operations                   │
│      → prisma.runWithContext(ctx, ...)                         │
│      → connects as darbel_app (RLS-enforced)                   │
│      → SET LOCAL stamps tenant context for policies and audit  │
└────────────────────────────────────────────────────────────────┘
```

### Bugs fixed

| v1 bug | Fix in v2 |
|---|---|
| `darbel_migrator` lacked table GRANTs | Added to v2 SQL patch |
| `RolesModule` didn't import `AuthModule` | Patched `roles.module.ts` |
| `AuditModule` didn't import `AuthModule` | Patched `audit.module.ts` |
| `AuthModule` didn't export `JwtModule` | Patched `auth.module.ts` |
| RLS blocked unauthenticated user lookup | `darbel_auth` handles it |
| RLS blocked unauthenticated tenant join | `darbel_auth` handles it |
| RLS blocked post-login user UPDATE | `darbel_auth` handles it |
| RLS blocked session INSERT | `darbel_auth` handles it |
| Architectural pattern was wrong | Two-role design replaces patchwork |

---

## Apply the patch

### Prerequisites

- Your v1 installation at `C:\Users\OLADIMEJI\darbel\` (untouched since last session)
- PostgreSQL running with the `darbel` database intact
- Both backend and frontend stopped (no running PowerShell windows)

### Step 1 — Extract this patch

If you received `darbel-v2-patch.zip`, extract it. The contents should look like:

```
darbel-v2-patch/
├── README.md (this file)
├── apply-patch.ps1
├── database/
│   └── 05-fix-v2.sql
├── backend-patches/
│   ├── auth.module.ts
│   ├── roles.module.ts
│   ├── audit.module.ts
│   ├── prisma.service.ts
│   └── env.schema.ts
└── scripts/
    └── smoke-test.js
```

Place the extracted folder anywhere you can find it; the script uses absolute paths.

### Step 2 — Run the apply script

Open a fresh PowerShell window. Navigate to the extracted patch folder:

```powershell
cd <path-to-extracted-patch-folder>
.\apply-patch.ps1
```

It will:
1. Verify your Darbel install
2. Apply `05-fix-v2.sql` to the database (you will be prompted for the `postgres` password)
3. Set the new `darbel_auth` role password
4. Copy the 5 patched backend files into place
5. Append `DATABASE_AUTH_URL` to your `.env`
6. Verify the patch landed

If any step fails, the script aborts and prints the error. Paste that into your Claude session for diagnosis.

### Step 3 — Regenerate the Prisma client

The schema itself is unchanged, but it is good practice:

```powershell
cd C:\Users\OLADIMEJI\darbel\backend
npx prisma generate
```

### Step 4 — Start the backend

```powershell
cd C:\Users\OLADIMEJI\darbel\backend
npm run start:dev
```

Wait for the line `Darbel backend listening on :4000 (development)`. Watch for any errors.

### Step 5 — Run the smoke test

In a second PowerShell window:

```powershell
cd <path-to-extracted-patch-folder>
node scripts\smoke-test.js
```

The smoke test exercises the full auth flow end-to-end. It will:

- Probe likely passwords from the v1 session (`Test1234567!`, `Darbel2026Admin!`, `MyDarbel2026!`)
- Handle forced password change if `must_change_password` is set
- Log in with the resulting password
- Fetch `/users/me`
- Log out cleanly

Expected final line:

```
  SMOKE TEST PASSED
```

If any step fails, the smoke test prints the failing step, the error, and instructions for what to share back.

If your bootstrap password is different from any candidate, run with an env var:

```powershell
$env:DARBEL_BOOTSTRAP_PASSWORD = "your_password_here"
node scripts\smoke-test.js
```

### Step 6 — Browser confirmation

After the smoke test passes:

```powershell
cd C:\Users\OLADIMEJI\darbel\frontend
npm run dev
```

Open `http://localhost:3000`. Sign in with:
- Email: `admin@branddarrow.com`
- Password: `DarbelLocal2026!` (the password the smoke test set)

You should land on the dashboard.

---

## If something fails

### Smoke test fails on a specific step

Paste the smoke test output and the last 30 lines of the backend log into your Claude conversation. The patch script's verification step also prints diagnostics — share those too.

### "darbel_auth role not found" errors

The SQL patch did not apply fully. Re-run it manually:

```powershell
psql -U postgres -d darbel -f database\05-fix-v2.sql
```

### Backend won't start with "DATABASE_AUTH_URL is required"

Check `.env` in `backend/` — the patch script should have appended this line:

```
DATABASE_AUTH_URL=postgresql://darbel_auth:auth_pass_local_2026@localhost:5432/darbel?schema=public
```

If it's missing, add it manually.

### Backend starts but smoke test gets a 500 on login

Backend log shows the cause. Most likely candidates:
- `DATABASE_AUTH_URL` password wrong → re-run the apply script which sets the role password
- `prisma.service.ts` not patched → check `Get-Content backend\src\database\prisma.service.ts | Select-String "public readonly auth"` returns a line

---

## Verification queries

If you want to confirm the v2 state manually:

```powershell
# Three roles should exist, with the right BYPASSRLS flags:
psql -U postgres -d darbel -c "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname LIKE 'darbel%';"
```

Expected:
```
   rolname     | rolbypassrls
---------------+--------------
 darbel_app      | f
 darbel_migrator | t
 darbel_auth     | t
```

```powershell
# darbel_auth should have grants on the narrow set of tables and NOTHING else:
psql -U postgres -d darbel -c "SELECT table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs FROM information_schema.role_table_grants WHERE grantee='darbel_auth' GROUP BY table_name ORDER BY table_name;"
```

Expected: rows for `users`, `tenants`, `sessions`, `login_attempts`, `password_history`, `roles`, `user_roles`, `role_permissions`, `permissions`. **No `audit_log`, no domain tables.**

```powershell
# No leftover v1 patchwork policies:
psql -U postgres -d darbel -c "SELECT policyname FROM pg_policies WHERE policyname IN ('users_login_lookup','tenants_login_lookup','users_login_update','sessions_login_insert');"
```

Expected: `(0 rows)`.

---

## After the patch passes

When the smoke test prints `SMOKE TEST PASSED`, Phase 1 is verified end-to-end. From there we can move to Phase 2 (Registration: handlers, trade categories, document uploads, UID issuance, payment recording) on a foundation we know works.
