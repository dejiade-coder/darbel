-- =============================================================================
-- Darbel migration 0004 — Row-Level Security policies and audit triggers
-- =============================================================================
-- This migration:
--   1. Enables RLS on all sensitive tables
--   2. Creates all RLS policies (clean v2 design, no patchwork)
--   3. Creates the audit trigger function
--   4. Attaches audit triggers to protected tables
--   5. Locks audit_log and sensitive_access_log against tampering
--
-- The dual-role design from the prior migration means we do NOT need the
-- "login lookup" policies the v1 schema later required as patches. Pre-auth
-- flows go through darbel_auth (BYPASSRLS); post-auth flows go through
-- darbel_app and use these policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enable RLS on sensitive tables
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
ALTER TABLE jurisdictions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions       ENABLE ROW LEVEL SECURITY;

-- login_attempts is intentionally NOT under RLS — must be writable
-- pre-authentication. darbel_auth handles all writes; darbel_app has read
-- access for forensic queries via app-level authorization.


-- -----------------------------------------------------------------------------
-- 2. Policies — tenants
-- -----------------------------------------------------------------------------

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
-- 3. Policies — tenant_settings
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
-- 4. Policies — users
-- -----------------------------------------------------------------------------

CREATE POLICY users_select ON users
    FOR SELECT TO darbel_app
    USING (
        tenant_id = current_app_tenant_id()
        OR id = current_app_user_id()
        OR current_user_is_platform_admin()
    );

CREATE POLICY users_insert ON users
    FOR INSERT TO darbel_app
    WITH CHECK (
        (tenant_id = current_app_tenant_id()
            AND current_user_has_permission('user.create'))
        OR current_user_is_platform_admin()
    );

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

CREATE POLICY users_delete ON users
    FOR DELETE TO darbel_app
    USING (current_user_is_platform_admin());


-- -----------------------------------------------------------------------------
-- 5. Policies — roles
-- -----------------------------------------------------------------------------

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
-- 6. Policies — user_roles
-- -----------------------------------------------------------------------------

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
-- 7. Policies — sessions, password_history
-- -----------------------------------------------------------------------------
-- These policies apply only to darbel_app (RLS-enforced).
-- darbel_auth bypasses RLS and handles unauthenticated session creation.

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
-- 8. Policies — audit_log, sensitive_access_log
-- -----------------------------------------------------------------------------

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
-- 9. Policies — jurisdictions, permissions, role_permissions (reference data)
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- 10. The audit trigger function
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER so it can write to audit_log even from RLS-restricted roles.

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_before        JSONB;
    v_after         JSONB;
    v_changed       TEXT[];
    v_record_id     TEXT;
    v_tenant_id     UUID;
    v_field         TEXT;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_before := to_jsonb(OLD);
        v_after  := NULL;
        v_record_id := COALESCE(v_before->>'id', '');
    ELSIF (TG_OP = 'UPDATE') THEN
        v_before := to_jsonb(OLD);
        v_after  := to_jsonb(NEW);
        v_record_id := COALESCE(v_after->>'id', '');
        v_changed := ARRAY(
            SELECT key FROM jsonb_each(v_after)
            WHERE v_after->key IS DISTINCT FROM v_before->key
        );
    ELSE
        v_before := NULL;
        v_after  := to_jsonb(NEW);
        v_record_id := COALESCE(v_after->>'id', '');
    END IF;

    -- Determine tenant_id: prefer the row's own, fall back to session
    IF v_after IS NOT NULL AND v_after ? 'tenant_id' THEN
        v_tenant_id := NULLIF(v_after->>'tenant_id', '')::UUID;
    ELSIF v_before IS NOT NULL AND v_before ? 'tenant_id' THEN
        v_tenant_id := NULLIF(v_before->>'tenant_id', '')::UUID;
    ELSE
        v_tenant_id := current_app_tenant_id();
    END IF;

    -- Redact sensitive fields from audit_log payloads
    FOREACH v_field IN ARRAY ARRAY['password_hash', 'mfa_secret_enc',
                                    'refresh_token_hash',
                                    'hiv_result', 'hepatitis_b_result']
    LOOP
        IF v_before IS NOT NULL AND v_before ? v_field THEN
            v_before := jsonb_set(v_before, ARRAY[v_field], '"[REDACTED]"'::jsonb);
        END IF;
        IF v_after IS NOT NULL AND v_after ? v_field THEN
            v_after := jsonb_set(v_after, ARRAY[v_field], '"[REDACTED]"'::jsonb);
        END IF;
    END LOOP;

    INSERT INTO audit_log (
        tenant_id, actor_user_id, actor_email, action,
        table_name, record_id, before_state, after_state, changed_fields,
        ip_address, user_agent, request_id
    ) VALUES (
        v_tenant_id,
        current_app_user_id(),
        current_app_user_email(),
        TG_OP,
        TG_TABLE_NAME,
        v_record_id,
        v_before,
        v_after,
        v_changed,
        current_app_client_ip(),
        current_app_user_agent(),
        current_app_request_id()
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_audit_trigger() FROM PUBLIC;


-- -----------------------------------------------------------------------------
-- 11. Attach audit triggers to protected tables
-- -----------------------------------------------------------------------------
-- Convention: trigger name is trg_audit_<table>
-- Not audited: audit_log (recursion), sensitive_access_log (append-only),
-- login_attempts (high volume), sessions (high churn), password_history (event implied).

CREATE TRIGGER trg_audit_tenants
    AFTER INSERT OR UPDATE OR DELETE ON tenants
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_tenant_settings
    AFTER INSERT OR UPDATE OR DELETE ON tenant_settings
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_roles
    AFTER INSERT OR UPDATE OR DELETE ON roles
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_role_permissions
    AFTER INSERT OR UPDATE OR DELETE ON role_permissions
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_jurisdictions
    AFTER INSERT OR UPDATE OR DELETE ON jurisdictions
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_permissions
    AFTER INSERT OR UPDATE OR DELETE ON permissions
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- -----------------------------------------------------------------------------
-- 12. Tamper protection on audit_log and sensitive_access_log
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_audit_log_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only; % is not permitted', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER trg_audit_log_no_update
    BEFORE UPDATE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION fn_audit_log_immutable();

CREATE TRIGGER trg_audit_log_no_delete
    BEFORE DELETE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION fn_audit_log_immutable();

CREATE TRIGGER trg_sensitive_access_log_no_update
    BEFORE UPDATE ON sensitive_access_log
    FOR EACH STATEMENT EXECUTE FUNCTION fn_audit_log_immutable();

CREATE TRIGGER trg_sensitive_access_log_no_delete
    BEFORE DELETE ON sensitive_access_log
    FOR EACH STATEMENT EXECUTE FUNCTION fn_audit_log_immutable();
