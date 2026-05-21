-- =============================================================================
-- Darbel — Row-Level Security Policies
-- Enforces tenant isolation and sensitive data access at the database layer.
-- =============================================================================
-- IMPORTANT: RLS only applies to roles that do NOT have BYPASSRLS attribute.
-- The application connects with a role 'darbel_app' that does NOT bypass RLS.
-- Migrations run as 'darbel_migrator' which DOES bypass RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Application & migration roles
-- -----------------------------------------------------------------------------
-- These would normally be created by the DBA; included here for completeness.
-- Adjust passwords via environment-managed secrets in production.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'darbel_app') THEN
        CREATE ROLE darbel_app LOGIN PASSWORD 'change_me_in_production'
            NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'darbel_migrator') THEN
        CREATE ROLE darbel_migrator LOGIN PASSWORD 'change_me_in_production'
            BYPASSRLS;
    END IF;
END$$;

-- Application gets standard CRUD on domain tables but NOT on audit_log
GRANT USAGE ON SCHEMA public TO darbel_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO darbel_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO darbel_app;

-- Audit log: app can INSERT only (triggers do this anyway); never UPDATE/DELETE
REVOKE UPDATE, DELETE ON audit_log FROM darbel_app;
REVOKE UPDATE, DELETE ON sensitive_access_log FROM darbel_app;

-- Default privileges for future tables (re-applied after every migration)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO darbel_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO darbel_app;


-- -----------------------------------------------------------------------------
-- Enable RLS on tenant-scoped tables
-- -----------------------------------------------------------------------------
ALTER TABLE tenants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensitive_access_log   ENABLE ROW LEVEL SECURITY;

-- Jurisdictions and permissions are platform-level reference data: readable
-- by all authenticated users, writable only by platform admin.
ALTER TABLE jurisdictions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions       ENABLE ROW LEVEL SECURITY;

-- login_attempts is intentionally NOT under RLS at this stage; it must be
-- writable before a user is authenticated (i.e. before tenant context exists).
-- Access to its data is controlled by application logic.


-- -----------------------------------------------------------------------------
-- Policies — tenants
-- -----------------------------------------------------------------------------
-- A user sees only their own tenant. Platform admin sees all.
CREATE POLICY tenants_select ON tenants
    FOR SELECT TO darbel_app
    USING (
        id = current_app_tenant_id()
        OR current_user_is_platform_admin()
    );

CREATE POLICY tenants_insert ON tenants
    FOR INSERT TO darbel_app
    WITH CHECK (current_user_is_platform_admin());

CREATE POLICY tenants_update ON tenants
    FOR UPDATE TO darbel_app
    USING (
        (id = current_app_tenant_id() AND current_user_has_permission('tenant.update_own'))
        OR current_user_is_platform_admin()
    )
    WITH CHECK (
        (id = current_app_tenant_id() AND current_user_has_permission('tenant.update_own'))
        OR current_user_is_platform_admin()
    );

CREATE POLICY tenants_delete ON tenants
    FOR DELETE TO darbel_app
    USING (current_user_is_platform_admin());


-- -----------------------------------------------------------------------------
-- Policies — tenant_settings
-- -----------------------------------------------------------------------------
CREATE POLICY tenant_settings_all ON tenant_settings
    FOR ALL TO darbel_app
    USING (
        tenant_id = current_app_tenant_id()
        OR current_user_is_platform_admin()
    )
    WITH CHECK (
        tenant_id = current_app_tenant_id()
        OR current_user_is_platform_admin()
    );


-- -----------------------------------------------------------------------------
-- Policies — users
-- -----------------------------------------------------------------------------
-- A user can be seen by others in the same tenant; the user can always see
-- their own record. Platform admin sees all.
CREATE POLICY users_select ON users
    FOR SELECT TO darbel_app
    USING (
        tenant_id = current_app_tenant_id()
        OR id = current_app_user_id()
        OR current_user_is_platform_admin()
    );

-- Only tenant admins (and platform admin) can create users
CREATE POLICY users_insert ON users
    FOR INSERT TO darbel_app
    WITH CHECK (
        (tenant_id = current_app_tenant_id()
            AND current_user_has_permission('user.create'))
        OR current_user_is_platform_admin()
    );

-- Users can update their own profile; tenant admins update any in tenant;
-- platform admin updates any user.
CREATE POLICY users_update ON users
    FOR UPDATE TO darbel_app
    USING (
        id = current_app_user_id()
        OR (tenant_id = current_app_tenant_id()
            AND current_user_has_permission('user.update'))
        OR current_user_is_platform_admin()
    )
    WITH CHECK (
        id = current_app_user_id()
        OR (tenant_id = current_app_tenant_id()
            AND current_user_has_permission('user.update'))
        OR current_user_is_platform_admin()
    );

-- Users cannot be hard-deleted; the application performs soft delete by
-- setting deleted_at. Hard delete reserved for platform admin only.
CREATE POLICY users_delete ON users
    FOR DELETE TO darbel_app
    USING (current_user_is_platform_admin());


-- -----------------------------------------------------------------------------
-- Policies — roles
-- -----------------------------------------------------------------------------
-- System roles (tenant_id NULL) are visible to everyone; tenant roles only to
-- members of that tenant.
CREATE POLICY roles_select ON roles
    FOR SELECT TO darbel_app
    USING (
        tenant_id IS NULL
        OR tenant_id = current_app_tenant_id()
        OR current_user_is_platform_admin()
    );

CREATE POLICY roles_modify ON roles
    FOR ALL TO darbel_app
    USING (
        (tenant_id = current_app_tenant_id()
            AND current_user_has_permission('role.manage'))
        OR (tenant_id IS NULL AND current_user_is_platform_admin())
    )
    WITH CHECK (
        (tenant_id = current_app_tenant_id()
            AND current_user_has_permission('role.manage'))
        OR (tenant_id IS NULL AND current_user_is_platform_admin())
    );


-- -----------------------------------------------------------------------------
-- Policies — user_roles
-- -----------------------------------------------------------------------------
-- A user_role row is accessible if the underlying user is in your tenant.
CREATE POLICY user_roles_select ON user_roles
    FOR SELECT TO darbel_app
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = user_roles.user_id
              AND (u.tenant_id = current_app_tenant_id()
                   OR u.id = current_app_user_id()
                   OR current_user_is_platform_admin())
        )
    );

CREATE POLICY user_roles_modify ON user_roles
    FOR ALL TO darbel_app
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = user_roles.user_id
              AND ((u.tenant_id = current_app_tenant_id()
                    AND current_user_has_permission('user.assign_role'))
                   OR current_user_is_platform_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = user_roles.user_id
              AND ((u.tenant_id = current_app_tenant_id()
                    AND current_user_has_permission('user.assign_role'))
                   OR current_user_is_platform_admin())
        )
    );


-- -----------------------------------------------------------------------------
-- Policies — sessions, password_history
-- -----------------------------------------------------------------------------
-- A user sees and manages only their own sessions.
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

CREATE POLICY password_history_self ON password_history
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
-- Policies — audit_log, sensitive_access_log
-- -----------------------------------------------------------------------------
-- Audit logs are tenant-scoped. Auditors and platform admin can read.
-- INSERT is performed by triggers (SECURITY DEFINER), so the app does not
-- INSERT directly, but the policy permits it for completeness.
CREATE POLICY audit_log_select ON audit_log
    FOR SELECT TO darbel_app
    USING (
        (tenant_id = current_app_tenant_id()
            AND current_user_has_permission('audit.view'))
        OR current_user_is_platform_admin()
    );

CREATE POLICY audit_log_insert ON audit_log
    FOR INSERT TO darbel_app
    WITH CHECK (TRUE);  -- triggers bypass RLS via SECURITY DEFINER anyway

CREATE POLICY sensitive_access_log_select ON sensitive_access_log
    FOR SELECT TO darbel_app
    USING (
        (tenant_id = current_app_tenant_id()
            AND current_user_has_permission('audit.view'))
        OR current_user_is_platform_admin()
    );

CREATE POLICY sensitive_access_log_insert ON sensitive_access_log
    FOR INSERT TO darbel_app
    WITH CHECK (
        tenant_id = current_app_tenant_id()
        OR current_user_is_platform_admin()
    );


-- -----------------------------------------------------------------------------
-- Policies — jurisdictions, permissions, role_permissions
-- -----------------------------------------------------------------------------
-- Reference data: read by all authenticated, write by platform admin.
CREATE POLICY jurisdictions_select ON jurisdictions
    FOR SELECT TO darbel_app
    USING (TRUE);

CREATE POLICY jurisdictions_modify ON jurisdictions
    FOR ALL TO darbel_app
    USING (current_user_is_platform_admin())
    WITH CHECK (current_user_is_platform_admin());

CREATE POLICY permissions_select ON permissions
    FOR SELECT TO darbel_app
    USING (TRUE);

CREATE POLICY permissions_modify ON permissions
    FOR ALL TO darbel_app
    USING (current_user_is_platform_admin())
    WITH CHECK (current_user_is_platform_admin());

CREATE POLICY role_permissions_select ON role_permissions
    FOR SELECT TO darbel_app
    USING (
        EXISTS (
            SELECT 1 FROM roles r
            WHERE r.id = role_permissions.role_id
              AND (r.tenant_id IS NULL
                   OR r.tenant_id = current_app_tenant_id()
                   OR current_user_is_platform_admin())
        )
    );

CREATE POLICY role_permissions_modify ON role_permissions
    FOR ALL TO darbel_app
    USING (
        EXISTS (
            SELECT 1 FROM roles r
            WHERE r.id = role_permissions.role_id
              AND ((r.tenant_id = current_app_tenant_id()
                    AND current_user_has_permission('role.manage'))
                   OR (r.tenant_id IS NULL AND current_user_is_platform_admin()))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM roles r
            WHERE r.id = role_permissions.role_id
              AND ((r.tenant_id = current_app_tenant_id()
                    AND current_user_has_permission('role.manage'))
                   OR (r.tenant_id IS NULL AND current_user_is_platform_admin()))
        )
    );

-- =============================================================================
-- End of 02-rls-policies.sql
-- =============================================================================
