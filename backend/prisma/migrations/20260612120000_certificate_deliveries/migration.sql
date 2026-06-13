CREATE TABLE certificate_deliveries (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    certificate_id     UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    channel            VARCHAR(20) NOT NULL
        CHECK (channel IN ('PRINT', 'EMAIL', 'WHATSAPP')),
    delivery_status    VARCHAR(30) NOT NULL DEFAULT 'RECORDED'
        CHECK (delivery_status IN ('RECORDED', 'FAILED')),
    recipient          TEXT,
    delivery_url       TEXT,
    message_preview    TEXT,
    performed_by       UUID REFERENCES users(id),
    performed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata           JSONB
);

CREATE INDEX idx_certificate_deliveries_tenant_time
    ON certificate_deliveries(tenant_id, performed_at DESC);

CREATE INDEX idx_certificate_deliveries_certificate_time
    ON certificate_deliveries(certificate_id, performed_at DESC);

ALTER TABLE certificate_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY certificate_deliveries_select ON certificate_deliveries
    FOR SELECT TO darbel_app
    USING (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('certificate.view')
        )
        OR current_user_is_platform_admin()
    );

CREATE POLICY certificate_deliveries_insert ON certificate_deliveries
    FOR INSERT TO darbel_app
    WITH CHECK (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('certificate.deliver')
        )
        OR current_user_is_platform_admin()
    );

CREATE TRIGGER trg_audit_certificate_deliveries
    AFTER INSERT OR UPDATE OR DELETE ON certificate_deliveries
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

GRANT SELECT, INSERT ON certificate_deliveries TO darbel_app;

INSERT INTO permissions (code, module, description, is_sensitive)
VALUES ('certificate.deliver', 'certificates', 'Record certificate print, email, and WhatsApp delivery actions', FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code = 'certificate.deliver'
  AND r.code IN ('TENANT_ADMIN', 'MEDICAL_OFFICER')
ON CONFLICT DO NOTHING;
