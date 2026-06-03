CREATE TABLE payments (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    handler_registration_id  UUID NOT NULL REFERENCES handler_registrations(id) ON DELETE RESTRICT,
    amount                   NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency                 CHAR(3) NOT NULL DEFAULT 'NGN',
    method                   VARCHAR(30) NOT NULL
        CHECK (method IN ('CASH', 'BANK_TRANSFER', 'POS', 'ONLINE')),
    reference                VARCHAR(120),
    receipt_number           VARCHAR(120),
    status                   VARCHAR(40) NOT NULL DEFAULT 'RECORDED'
        CHECK (status IN ('RECORDED', 'APPROVED', 'VOIDED', 'REFUNDED')),
    paid_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by              UUID REFERENCES users(id),
    recorded_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by              UUID REFERENCES users(id),
    approved_at              TIMESTAMPTZ,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT payments_tenant_receipt_unique
        UNIQUE (tenant_id, receipt_number)
);

CREATE INDEX idx_payments_tenant_paid_at
    ON payments(tenant_id, paid_at DESC);

CREATE INDEX idx_payments_registration
    ON payments(handler_registration_id, paid_at DESC);

CREATE INDEX idx_payments_status
    ON payments(tenant_id, status);

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select ON payments
    FOR SELECT TO darbel_app
    USING (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('payment.view')
        )
        OR current_user_is_platform_admin()
    );

CREATE POLICY payments_insert ON payments
    FOR INSERT TO darbel_app
    WITH CHECK (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('payment.record')
        )
        OR current_user_is_platform_admin()
    );

CREATE POLICY payments_update ON payments
    FOR UPDATE TO darbel_app
    USING (
        (
            tenant_id = current_app_tenant_id()
            AND (
                current_user_has_permission('payment.approve')
                OR current_user_has_permission('payment.refund')
            )
        )
        OR current_user_is_platform_admin()
    )
    WITH CHECK (
        (
            tenant_id = current_app_tenant_id()
            AND (
                current_user_has_permission('payment.approve')
                OR current_user_has_permission('payment.refund')
            )
        )
        OR current_user_is_platform_admin()
    );

CREATE TRIGGER trg_audit_payments
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO darbel_app;

COMMENT ON TABLE payments IS
'Tenant-scoped registration payment records captured before medical screening.';
