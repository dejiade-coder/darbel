CREATE TABLE handler_documents (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    handler_registration_id  UUID NOT NULL REFERENCES handler_registrations(id) ON DELETE CASCADE,
    document_type            VARCHAR(40) NOT NULL
        CHECK (document_type IN ('PHOTOGRAPH', 'GOVERNMENT_ID', 'PRIOR_CERTIFICATE')),
    storage_key              TEXT NOT NULL,
    original_filename        TEXT,
    mime_type                VARCHAR(80) NOT NULL
        CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
    size_bytes               BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    sha256_hash              CHAR(64) NOT NULL,
    uploaded_by              UUID NOT NULL REFERENCES users(id),
    uploaded_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes                    TEXT
);

CREATE INDEX idx_handler_documents_registration
    ON handler_documents(handler_registration_id, uploaded_at DESC);

CREATE INDEX idx_handler_documents_tenant_uploaded
    ON handler_documents(tenant_id, uploaded_at DESC);

ALTER TABLE handler_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY handler_documents_select ON handler_documents
    FOR SELECT TO darbel_app
    USING (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('handler.view')
        )
        OR current_user_is_platform_admin()
    );

CREATE POLICY handler_documents_insert ON handler_documents
    FOR INSERT TO darbel_app
    WITH CHECK (
        (
            tenant_id = current_app_tenant_id()
            AND current_user_has_permission('handler.update')
        )
        OR current_user_is_platform_admin()
    );

CREATE TRIGGER trg_audit_handler_documents
    AFTER INSERT OR UPDATE OR DELETE ON handler_documents
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

GRANT SELECT, INSERT, UPDATE, DELETE ON handler_documents TO darbel_app;

COMMENT ON TABLE handler_documents IS
'Tenant-scoped uploaded document metadata for registration intake records.';
