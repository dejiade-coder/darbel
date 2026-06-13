CREATE TABLE medical_screenings (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    handler_registration_id  UUID NOT NULL REFERENCES handler_registrations(id) ON DELETE RESTRICT,
    status                   VARCHAR(40) NOT NULL DEFAULT 'SAMPLE_COLLECTED'
        CHECK (status IN ('SAMPLE_COLLECTED', 'RESULT_ENTERED', 'APPROVED', 'REJECTED')),
    sample_collected_by      UUID REFERENCES users(id),
    sample_collected_at      TIMESTAMPTZ,
    lab_result_summary       TEXT,
    fitness_status           VARCHAR(30)
        CHECK (fitness_status IS NULL OR fitness_status IN ('FIT', 'UNFIT', 'REQUIRES_REVIEW')),
    entered_by               UUID REFERENCES users(id),
    entered_at               TIMESTAMPTZ,
    reviewed_by              UUID REFERENCES users(id),
    reviewed_at              TIMESTAMPTZ,
    review_notes             TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (handler_registration_id)
);

CREATE INDEX idx_medical_screenings_tenant_status
    ON medical_screenings(tenant_id, status, created_at DESC);

CREATE TRIGGER trg_medical_screenings_updated_at
    BEFORE UPDATE ON medical_screenings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE medical_screenings ENABLE ROW LEVEL SECURITY;

CREATE POLICY medical_screenings_select ON medical_screenings
    FOR SELECT TO darbel_app
    USING (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('medical.view_results')
        )
        OR current_user_is_platform_admin()
    );

CREATE POLICY medical_screenings_insert ON medical_screenings
    FOR INSERT TO darbel_app
    WITH CHECK (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('medical.record_sample')
        )
        OR current_user_is_platform_admin()
    );

CREATE POLICY medical_screenings_update ON medical_screenings
    FOR UPDATE TO darbel_app
    USING (
        (
            tenant_id = current_app_tenant_id()
            AND (
                current_user_has_permission('medical.enter_result')
                OR current_user_has_permission('medical.approve_result')
            )
        )
        OR current_user_is_platform_admin()
    )
    WITH CHECK (
        (
            tenant_id = current_app_tenant_id()
            AND (
                current_user_has_permission('medical.enter_result')
                OR current_user_has_permission('medical.approve_result')
            )
        )
        OR current_user_is_platform_admin()
    );

CREATE TRIGGER trg_audit_medical_screenings
    AFTER INSERT OR UPDATE OR DELETE ON medical_screenings
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

GRANT SELECT, INSERT, UPDATE, DELETE ON medical_screenings TO darbel_app;

CREATE TABLE certificates (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    handler_registration_id  UUID NOT NULL REFERENCES handler_registrations(id) ON DELETE RESTRICT,
    medical_screening_id     UUID REFERENCES medical_screenings(id) ON DELETE SET NULL,
    uid                      VARCHAR(12) NOT NULL UNIQUE,
    status                   VARCHAR(30) NOT NULL DEFAULT 'VALID'
        CHECK (status IN ('VALID', 'EXPIRED', 'REVOKED')),
    issued_by                UUID REFERENCES users(id),
    issued_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at               TIMESTAMPTZ NOT NULL,
    revoked_by               UUID REFERENCES users(id),
    revoked_at               TIMESTAMPTZ,
    revoke_reason            TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (handler_registration_id, status)
);

CREATE INDEX idx_certificates_tenant_status
    ON certificates(tenant_id, status, issued_at DESC);

CREATE TRIGGER trg_certificates_updated_at
    BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY certificates_select ON certificates
    FOR SELECT TO darbel_app
    USING (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('certificate.view')
        )
        OR current_user_is_platform_admin()
    );

CREATE POLICY certificates_insert ON certificates
    FOR INSERT TO darbel_app
    WITH CHECK (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('certificate.issue')
        )
        OR current_user_is_platform_admin()
    );

CREATE POLICY certificates_update ON certificates
    FOR UPDATE TO darbel_app
    USING (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('certificate.revoke')
        )
        OR current_user_is_platform_admin()
    )
    WITH CHECK (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('certificate.revoke')
        )
        OR current_user_is_platform_admin()
    );

CREATE TRIGGER trg_audit_certificates
    AFTER INSERT OR UPDATE OR DELETE ON certificates
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

GRANT SELECT, INSERT, UPDATE, DELETE ON certificates TO darbel_app;

UPDATE handler_registrations
SET status = 'READY_FOR_SCREENING'
WHERE status = 'SUBMITTED_FOR_REVIEW'
  AND uid IS NOT NULL;
