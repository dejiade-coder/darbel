-- =============================================================================
-- Darbel migration 0009 - Handler registrations intake
-- =============================================================================
-- First durable registration slice. Stores handler intake records captured by
-- registrar users before payment and medical screening.
-- =============================================================================

CREATE TABLE handler_registrations (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    registrar_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    registrar_name           VARCHAR(200) NOT NULL,
    registrar_email          TEXT NOT NULL,
    registrar_phone          VARCHAR(20),
    registration_date        DATE NOT NULL DEFAULT CURRENT_DATE,

    first_name               VARCHAR(100) NOT NULL,
    last_name                VARCHAR(100) NOT NULL,
    phone                    VARCHAR(20) NOT NULL,
    email                    TEXT,
    gender                   VARCHAR(40),
    trade_category           VARCHAR(120) NOT NULL,
    business_name            VARCHAR(200),
    business_address         TEXT NOT NULL,
    passport_photo_received  BOOLEAN NOT NULL DEFAULT FALSE,

    status                   VARCHAR(40) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SUBMITTED_FOR_REVIEW')),

    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at             TIMESTAMPTZ,
    created_by               UUID REFERENCES users(id),
    updated_by               UUID REFERENCES users(id)
);

CREATE INDEX idx_handler_registrations_tenant_created
    ON handler_registrations(tenant_id, created_at DESC);

CREATE INDEX idx_handler_registrations_registrar
    ON handler_registrations(registrar_user_id, created_at DESC);

CREATE INDEX idx_handler_registrations_status
    ON handler_registrations(tenant_id, status);

CREATE TRIGGER trg_handler_registrations_updated_at
    BEFORE UPDATE ON handler_registrations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE handler_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY handler_registrations_select ON handler_registrations
    FOR SELECT TO darbel_app
    USING (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('handler.view')
        )
        OR current_user_is_platform_admin()
    )
;

CREATE POLICY handler_registrations_insert ON handler_registrations
    FOR INSERT TO darbel_app
    WITH CHECK (
        (
            tenant_id = current_app_tenant_id()
            AND registrar_user_id = current_app_user_id()
            AND current_user_has_permission('handler.create')
        )
        OR current_user_is_platform_admin()
    )
;

CREATE POLICY handler_registrations_update ON handler_registrations
    FOR UPDATE TO darbel_app
    USING (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('handler.update')
        )
        OR current_user_is_platform_admin()
    )
    WITH CHECK (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('handler.update')
        )
        OR current_user_is_platform_admin()
    )
;

CREATE TRIGGER trg_audit_handler_registrations
    AFTER INSERT OR UPDATE OR DELETE ON handler_registrations
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

GRANT SELECT, INSERT, UPDATE, DELETE ON handler_registrations TO darbel_app;

COMMENT ON TABLE handler_registrations IS
'Tenant-scoped handler registration intake records captured by active registrar users before payment and medical screening.';
