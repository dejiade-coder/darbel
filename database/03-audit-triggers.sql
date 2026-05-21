-- =============================================================================
-- Darbel — Audit Triggers
-- Captures every INSERT, UPDATE, DELETE on protected tables.
-- The trigger function is SECURITY DEFINER so it can write to audit_log even
-- when the calling role is restricted.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The audit trigger function
-- -----------------------------------------------------------------------------
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
    -- Determine before/after state
    IF (TG_OP = 'DELETE') THEN
        v_before := to_jsonb(OLD);
        v_after  := NULL;
        v_record_id := COALESCE(v_before->>'id', '');
    ELSIF (TG_OP = 'UPDATE') THEN
        v_before := to_jsonb(OLD);
        v_after  := to_jsonb(NEW);
        v_record_id := COALESCE(v_after->>'id', '');
        -- Compute list of changed fields
        v_changed := ARRAY(
            SELECT key FROM jsonb_each(v_after)
            WHERE v_after->key IS DISTINCT FROM v_before->key
        );
        -- If nothing actually changed (e.g. only updated_at by trigger), still
        -- record it; the changed_fields array tells the story.
    ELSE  -- INSERT
        v_before := NULL;
        v_after  := to_jsonb(NEW);
        v_record_id := COALESCE(v_after->>'id', '');
    END IF;

    -- Determine tenant_id: prefer the row's own tenant_id; fall back to session
    IF v_after ? 'tenant_id' THEN
        v_tenant_id := NULLIF(v_after->>'tenant_id', '')::UUID;
    ELSIF v_before ? 'tenant_id' THEN
        v_tenant_id := NULLIF(v_before->>'tenant_id', '')::UUID;
    ELSE
        v_tenant_id := current_app_tenant_id();
    END IF;

    -- Redact sensitive fields from before/after state in audit_log.
    -- We still record THAT they changed via changed_fields, but the values
    -- themselves are never written to audit_log. The sensitive_access_log
    -- tracks actual reads of those values.
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

-- Lock down the function: only postgres role owns it; app role executes it
-- via the trigger, not directly.
REVOKE EXECUTE ON FUNCTION fn_audit_trigger() FROM PUBLIC;


-- -----------------------------------------------------------------------------
-- Attach audit triggers to protected tables
-- -----------------------------------------------------------------------------
-- Convention: trigger name is trg_audit_<table>
-- We do NOT audit:
--   - audit_log itself (would cause recursion)
--   - sensitive_access_log (append-only, has its own purpose)
--   - login_attempts (high-volume; meaningful events lifted into audit_log
--     by application code on relevant transitions like lockout)
--   - sessions (high-churn; session lifecycle is logged at app layer)
--   - password_history (its existence already implies password change events)

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
-- Tamper protection on audit_log itself
-- -----------------------------------------------------------------------------
-- A trigger that raises an exception on any UPDATE or DELETE attempt.
-- Combined with the GRANT revocation in 02-rls-policies.sql, this gives
-- defense in depth.
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

-- =============================================================================
-- End of 03-audit-triggers.sql
-- =============================================================================
