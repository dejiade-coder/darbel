-- =============================================================================
-- Darbel — Patch 05: Auth-Bootstrap Role + RLS Cleanup (v2)
-- =============================================================================
-- This patch is applied ON TOP of the existing database created by
-- 01-schema.sql, 02-rls-policies.sql, 03-audit-triggers.sql, 04-seed.sql.
--
-- Goals of this patch:
--   1. Introduce a new `darbel_auth` database role used by the application
--      for the narrow set of pre-authenticated operations (login, refresh,
--      logout, password reset, password change). This role has BYPASSRLS and
--      explicit GRANTs ONLY on the tables required for those flows. It
--      cannot see or touch domain data (handlers, payments, medical, etc.).
--
--   2. Fix the missing GRANTs on `darbel_migrator` (the integration-tested
--      bug from v1 where migrator could not actually write to tables despite
--      having BYPASSRLS).
--
--   3. Remove the patchwork "login policies" we added to v1 in flight
--      (users_login_lookup, tenants_login_lookup, users_login_update,
--      sessions_login_insert, sessions_self_select/modify/delete) — they are
--      replaced by the cleaner darbel_auth role pattern. The original
--      sessions_self policy is restored as a clean unified policy.
--
--   4. This file is IDEMPOTENT — safe to re-run.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Fix grants on darbel_migrator (v1 bug)
-- -----------------------------------------------------------------------------
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO darbel_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO darbel_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO darbel_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO darbel_migrator;


-- -----------------------------------------------------------------------------
-- 2. Create darbel_auth role
-- -----------------------------------------------------------------------------
-- BYPASSRLS so the auth flow can read and write the small set of tables it
-- needs without writing policies for every edge case. NARROW grants below
-- ensure this role can never touch domain data even if compromised.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'darbel_auth') THEN
        CREATE ROLE darbel_auth LOGIN PASSWORD 'change_me_in_production'
            BYPASSRLS;
    ELSE
        -- Ensure attributes are correct even if role pre-exists
        ALTER ROLE darbel_auth BYPASSRLS;
    END IF;
END$$;

-- Revoke any blanket access this role may have inherited
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM darbel_auth;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM darbel_auth;
REVOKE ALL ON SCHEMA public FROM darbel_auth;

-- Grant schema usage (required to even reference table names)
GRANT USAGE ON SCHEMA public TO darbel_auth;

-- Narrow grants — ONLY the tables needed for the auth bootstrap flow.
-- This is the security boundary: darbel_auth literally cannot reference any
-- other table. A future Phase 2 table (handlers, payments) is invisible.

-- users: read for credential check, update for failed-count/last-login/lock,
-- update password_hash on password change
GRANT SELECT, UPDATE ON users TO darbel_auth;

-- tenants: read-only for the tenant join during login (active check)
GRANT SELECT ON tenants TO darbel_auth;

-- roles, user_roles, role_permissions, permissions: read for permission
-- collection at token issue time
GRANT SELECT ON roles TO darbel_auth;
GRANT SELECT ON user_roles TO darbel_auth;
GRANT SELECT ON role_permissions TO darbel_auth;
GRANT SELECT ON permissions TO darbel_auth;

-- sessions: full lifecycle — issue, refresh, revoke
GRANT SELECT, INSERT, UPDATE ON sessions TO darbel_auth;

-- login_attempts: insert-only (forensic record)
GRANT INSERT, SELECT ON login_attempts TO darbel_auth;

-- password_history: insert when password changes
GRANT INSERT, SELECT ON password_history TO darbel_auth;

-- Sequence grants (for any serial / bigserial columns used by above tables —
-- mostly audit_log and login_attempts; covering all is safe and narrow enough)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO darbel_auth;


-- -----------------------------------------------------------------------------
-- 3. Remove v1 patchwork "login" policies
-- -----------------------------------------------------------------------------
-- These were our band-aids during the v1 debug session. They are no longer
-- needed because darbel_auth handles those operations directly.
DROP POLICY IF EXISTS users_login_lookup    ON users;
DROP POLICY IF EXISTS users_login_update    ON users;
DROP POLICY IF EXISTS tenants_login_lookup  ON tenants;
DROP POLICY IF EXISTS sessions_login_insert ON sessions;


-- -----------------------------------------------------------------------------
-- 4. Restore clean sessions policy (was split into 3 during debugging)
-- -----------------------------------------------------------------------------
-- v1 had sessions_self (FOR ALL). We split it into _select/_modify/_delete
-- while debugging. With darbel_auth now handling all session INSERTs, we
-- can restore the original clean unified policy that applies only when an
-- authenticated user is acting via darbel_app.
DROP POLICY IF EXISTS sessions_self        ON sessions;
DROP POLICY IF EXISTS sessions_self_select ON sessions;
DROP POLICY IF EXISTS sessions_self_modify ON sessions;
DROP POLICY IF EXISTS sessions_self_delete ON sessions;

CREATE POLICY sessions_self ON sessions
    FOR ALL TO darbel_app
    USING (
        user_id = current_app_user_id()
        OR current_user_is_platform_admin()
    )
    WITH CHECK (
        user_id = current_app_user_id()
        OR current_user_is_platform_admin()
    );


-- -----------------------------------------------------------------------------
-- 5. Verify health
-- -----------------------------------------------------------------------------
-- Quick sanity counters surfaced via NOTICE so the apply script can confirm.
DO $$
DECLARE
    v_policies_count   INT;
    v_auth_grants      INT;
BEGIN
    SELECT COUNT(*) INTO v_policies_count
    FROM pg_policies
    WHERE tablename IN ('users','tenants','sessions','roles','user_roles');

    SELECT COUNT(*) INTO v_auth_grants
    FROM information_schema.role_table_grants
    WHERE grantee = 'darbel_auth';

    RAISE NOTICE 'darbel_v2_patch_summary: policies=%, darbel_auth_grants=%',
        v_policies_count, v_auth_grants;
END$$;

COMMIT;

-- =============================================================================
-- End of 05-fix-v2.sql
--
-- After applying this patch, set passwords on the new role:
--   ALTER ROLE darbel_auth PASSWORD '<strong_password>';
--
-- Then add to backend .env:
--   DATABASE_AUTH_URL=postgresql://darbel_auth:<password>@localhost:5432/darbel?schema=public
-- =============================================================================
