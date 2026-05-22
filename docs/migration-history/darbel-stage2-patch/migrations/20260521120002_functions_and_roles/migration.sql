-- =============================================================================
-- Darbel migration 0003 — Helper functions and database roles
-- =============================================================================
-- This migration creates:
--   1. The 11 helper functions used by RLS and triggers
--   2. The set_updated_at trigger function and its bindings
--   3. The three database roles: darbel_app, darbel_auth, darbel_migrator
--   4. All GRANTs that establish the security boundaries
--
-- The two-role design (darbel_app + darbel_auth) is baked in from the start.
-- darbel_auth handles unauthenticated bootstrap flows with BYPASSRLS but
-- narrow GRANTs only on auth-related tables. darbel_app is RLS-enforced and
-- handles everything after authentication.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Session-context accessor functions
-- -----------------------------------------------------------------------------
-- Application sets these per-connection via SET LOCAL before each request:
--   SET LOCAL app.current_user_id = '...';
--   SET LOCAL app.current_tenant_id = '...';
--   SET LOCAL app.current_user_email = '...';
--   SET LOCAL app.request_id = '...';
--   SET LOCAL app.client_ip = '...';
--   SET LOCAL app.user_agent = '...';
-- Accessors return NULL when not set rather than raising — this allows
-- system jobs and the darbel_auth bootstrap flow to operate without context.

CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_app_tenant_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_app_user_email() RETURNS CITEXT AS $$
    SELECT NULLIF(current_setting('app.current_user_email', TRUE), '')::CITEXT;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_app_request_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.request_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_app_client_ip() RETURNS INET AS $$
    SELECT NULLIF(current_setting('app.client_ip', TRUE), '')::INET;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_app_user_agent() RETURNS TEXT AS $$
    SELECT NULLIF(current_setting('app.user_agent', TRUE), '');
$$ LANGUAGE SQL STABLE;


-- -----------------------------------------------------------------------------
-- 2. Permission-check helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_user_has_permission(p_permission_code VARCHAR)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE u.id = current_app_user_id()
          AND u.is_active = TRUE
          AND u.deleted_at IS NULL
          AND p.code = p_permission_code
    );
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_user_is_platform_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN tenants t ON t.id = u.tenant_id
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE u.id = current_app_user_id()
          AND t.is_platform_operator = TRUE
          AND r.code = 'SUPER_ADMIN'
          AND u.is_active = TRUE
          AND u.deleted_at IS NULL
    );
$$ LANGUAGE SQL STABLE;


-- -----------------------------------------------------------------------------
-- 3. updated_at maintenance trigger and bindings
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jurisdictions_updated_at
    BEFORE UPDATE ON jurisdictions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. Database roles
-- -----------------------------------------------------------------------------
-- Passwords here are placeholders. The setup script sets them per-environment.
-- Roles are created with NOLOGIN to prevent accidental use before passwords
-- are set; the setup script then runs ALTER ROLE ... LOGIN PASSWORD '...'.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'darbel_app') THEN
        CREATE ROLE darbel_app LOGIN PASSWORD 'change_me_in_setup_script' NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'darbel_migrator') THEN
        CREATE ROLE darbel_migrator LOGIN PASSWORD 'change_me_in_setup_script' BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'darbel_auth') THEN
        CREATE ROLE darbel_auth LOGIN PASSWORD 'change_me_in_setup_script' BYPASSRLS;
    END IF;
END$$;


-- -----------------------------------------------------------------------------
-- 5. darbel_app — application connection (NOBYPASSRLS, broad GRANTs)
-- -----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO darbel_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO darbel_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO darbel_app;

-- Audit log: triggers can INSERT via SECURITY DEFINER; app never writes directly
REVOKE UPDATE, DELETE ON audit_log FROM darbel_app;
REVOKE UPDATE, DELETE ON sensitive_access_log FROM darbel_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO darbel_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO darbel_app;


-- -----------------------------------------------------------------------------
-- 6. darbel_migrator — full DDL access (BYPASSRLS)
-- -----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO darbel_migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO darbel_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO darbel_migrator;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO darbel_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO darbel_migrator;


-- -----------------------------------------------------------------------------
-- 7. darbel_auth — bootstrap connection (BYPASSRLS, NARROW GRANTs)
-- -----------------------------------------------------------------------------
-- This role bypasses RLS so the auth flow can read users and write sessions
-- without policies for every "user not yet authenticated" edge case. The
-- security boundary is GRANTs, not policies: darbel_auth literally cannot
-- reference any table outside this list. A future Phase 2 table (handlers,
-- payments, medical results) is completely invisible.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM darbel_auth;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM darbel_auth;
REVOKE ALL ON SCHEMA public FROM darbel_auth;

GRANT USAGE ON SCHEMA public TO darbel_auth;

-- users: SELECT for credential check; UPDATE for failed-count, lock, last-login,
-- password change.
GRANT SELECT, UPDATE ON users TO darbel_auth;

-- tenants: read-only to join the active-tenant check during login.
GRANT SELECT ON tenants TO darbel_auth;

-- roles/permissions: read for permission set construction at token issue time.
GRANT SELECT ON roles            TO darbel_auth;
GRANT SELECT ON user_roles       TO darbel_auth;
GRANT SELECT ON role_permissions TO darbel_auth;
GRANT SELECT ON permissions      TO darbel_auth;

-- sessions: full lifecycle (issue, refresh, revoke).
GRANT SELECT, INSERT, UPDATE ON sessions TO darbel_auth;

-- login_attempts: append-only forensic record.
GRANT INSERT, SELECT ON login_attempts TO darbel_auth;

-- password_history: append on password change.
GRANT INSERT, SELECT ON password_history TO darbel_auth;

-- Sequences for any serial/bigserial columns above.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO darbel_auth;
