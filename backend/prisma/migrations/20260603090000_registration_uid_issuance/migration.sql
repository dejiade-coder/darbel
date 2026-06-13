ALTER TABLE handler_registrations
    ADD COLUMN uid VARCHAR(12),
    ADD COLUMN uid_issued_at TIMESTAMPTZ,
    ADD COLUMN uid_issued_by UUID REFERENCES users(id);

ALTER TABLE handler_registrations
    ADD CONSTRAINT handler_registrations_uid_unique UNIQUE (uid),
    ADD CONSTRAINT handler_registrations_uid_format_check
        CHECK (uid IS NULL OR uid ~ '^[A-Z]{3}-[A-Z2-7]{6}-[A-Z2-7]$');

CREATE INDEX idx_handler_registrations_uid
    ON handler_registrations(uid)
    WHERE uid IS NOT NULL;

COMMENT ON COLUMN handler_registrations.uid IS
'Tenant-scoped handler registration UID issued only after payment approval.';
