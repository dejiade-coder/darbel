ALTER TABLE certificate_deliveries
    DROP CONSTRAINT IF EXISTS certificate_deliveries_channel_check;

ALTER TABLE certificate_deliveries
    ADD CONSTRAINT certificate_deliveries_channel_check
    CHECK (channel IN ('PRINT', 'EMAIL', 'WHATSAPP', 'APPEAL', 'APPEAL_APPROVED', 'APPEAL_REJECTED'));

ALTER TABLE certificate_deliveries
    DROP CONSTRAINT IF EXISTS certificate_deliveries_delivery_status_check;

ALTER TABLE certificate_deliveries
    ADD CONSTRAINT certificate_deliveries_delivery_status_check
    CHECK (delivery_status IN ('RECORDED', 'FAILED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'QUEUED', 'NEEDS_PROVIDER', 'MISSING_RECIPIENT'));

DROP POLICY IF EXISTS certificate_deliveries_insert ON certificate_deliveries;

CREATE POLICY certificate_deliveries_insert ON certificate_deliveries
    FOR INSERT TO darbel_app
    WITH CHECK (
        (
            tenant_id = current_app_tenant_id()
            AND (
                current_user_has_permission('certificate.deliver')
                OR current_user_has_permission('certificate.revoke')
                OR current_user_has_permission('certificate.issue')
            )
        )
        OR current_user_is_platform_admin()
    );
