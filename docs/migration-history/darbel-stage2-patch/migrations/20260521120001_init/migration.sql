-- =============================================================================
-- Darbel migration 0002 — Tables, indexes, foreign keys
-- =============================================================================
-- This migration corresponds to the structure declared in prisma/schema.prisma.
-- After this migration runs, all 13 tables exist with their indexes and FKs
-- but with NO RLS, NO triggers, NO data, NO custom roles. Those come later.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tenants & Jurisdictions
-- -----------------------------------------------------------------------------

CREATE TABLE jurisdictions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(10) NOT NULL UNIQUE,
    name            VARCHAR(120) NOT NULL,
    country_code    CHAR(2) NOT NULL,
    currency_code   CHAR(3) NOT NULL,
    phone_country_code VARCHAR(5) NOT NULL,
    timezone        VARCHAR(50) NOT NULL DEFAULT 'Africa/Lagos',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE jurisdictions IS
'Regulatory jurisdictions. Each tenant operates within a jurisdiction.';

CREATE TABLE tenants (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                     VARCHAR(20) NOT NULL UNIQUE,
    legal_name               VARCHAR(200) NOT NULL,
    display_name             VARCHAR(120) NOT NULL,
    jurisdiction_id          UUID NOT NULL REFERENCES jurisdictions(id),
    contact_email            CITEXT NOT NULL,
    contact_phone            VARCHAR(20),
    is_platform_operator     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active                BOOLEAN NOT NULL DEFAULT TRUE,
    payment_model            VARCHAR(20) NOT NULL DEFAULT 'FINANCE_APPROVAL'
        CHECK (payment_model IN ('FINANCE_APPROVAL', 'CHECKBOX_PAID')),
    checkbox_paid_threshold  NUMERIC(14,2),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tenants IS
'Client organizations consuming the Darbel platform. Branddarrow is itself a tenant flagged as is_platform_operator.';

CREATE INDEX idx_tenants_jurisdiction ON tenants(jurisdiction_id);
CREATE INDEX idx_tenants_active ON tenants(is_active) WHERE is_active = TRUE;

CREATE TABLE tenant_settings (
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    setting_key  VARCHAR(80) NOT NULL,
    setting_value JSONB NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by   UUID,
    PRIMARY KEY (tenant_id, setting_key)
);


-- -----------------------------------------------------------------------------
-- 2. Identity & Access Management
-- -----------------------------------------------------------------------------

CREATE TABLE permissions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(80) NOT NULL UNIQUE,
    module       VARCHAR(40) NOT NULL,
    description  TEXT NOT NULL,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permissions_module ON permissions(module);

CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(40) NOT NULL,
    display_name    VARCHAR(120) NOT NULL,
    description     TEXT,
    is_system_role  BOOLEAN NOT NULL DEFAULT FALSE,
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT roles_code_scope_unique UNIQUE NULLS NOT DISTINCT (code, tenant_id)
);

COMMENT ON TABLE roles IS
'Roles defined at platform level (system roles) or per-tenant. Code is unique within scope.';

CREATE INDEX idx_roles_tenant ON roles(tenant_id);

CREATE TABLE role_permissions (
    role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id  UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by     UUID,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    email               CITEXT NOT NULL,
    phone               VARCHAR(20),
    full_name           VARCHAR(200) NOT NULL,
    password_hash       TEXT NOT NULL,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret_enc      TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked           BOOLEAN NOT NULL DEFAULT FALSE,
    locked_until        TIMESTAMPTZ,
    failed_login_count  INT NOT NULL DEFAULT 0,
    last_login_at       TIMESTAMPTZ,
    last_login_ip       INET,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT users_tenant_email_unique UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(tenant_id, is_active) WHERE deleted_at IS NULL;

CREATE TABLE user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE password_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_history_user ON password_history(user_id, created_at DESC);

CREATE TABLE sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash  TEXT NOT NULL UNIQUE,
    ip_address          INET,
    user_agent          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ,
    last_used_at        TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user_active ON sessions(user_id)
    WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expires ON sessions(expires_at)
    WHERE revoked_at IS NULL;

CREATE TABLE login_attempts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email        CITEXT NOT NULL,
    tenant_id    UUID,
    ip_address   INET,
    user_agent   TEXT,
    success      BOOLEAN NOT NULL,
    failure_reason VARCHAR(80),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email_time
    ON login_attempts(email, attempted_at DESC);
CREATE INDEX idx_login_attempts_ip_time
    ON login_attempts(ip_address, attempted_at DESC);


-- -----------------------------------------------------------------------------
-- 3. Audit infrastructure (log tables only; triggers come later)
-- -----------------------------------------------------------------------------

CREATE TABLE audit_log (
    id            BIGSERIAL PRIMARY KEY,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id     UUID,
    actor_user_id UUID,
    actor_email   CITEXT,
    action        VARCHAR(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    table_name    VARCHAR(80) NOT NULL,
    record_id     TEXT NOT NULL,
    before_state  JSONB,
    after_state   JSONB,
    changed_fields TEXT[],
    ip_address    INET,
    user_agent    TEXT,
    request_id    UUID
);

CREATE INDEX idx_audit_tenant_time ON audit_log(tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_actor_time ON audit_log(actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id);

COMMENT ON TABLE audit_log IS
'Append-only audit trail. Populated by triggers. UPDATE/DELETE permissions must be revoked for all application roles.';

CREATE TABLE sensitive_access_log (
    id             BIGSERIAL PRIMARY KEY,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id      UUID NOT NULL,
    actor_user_id  UUID NOT NULL,
    accessed_table VARCHAR(80) NOT NULL,
    accessed_record_id TEXT NOT NULL,
    accessed_field VARCHAR(80) NOT NULL,
    purpose        TEXT,
    ip_address     INET,
    request_id     UUID
);

CREATE INDEX idx_sensitive_access_tenant_time
    ON sensitive_access_log(tenant_id, occurred_at DESC);
CREATE INDEX idx_sensitive_access_actor_time
    ON sensitive_access_log(actor_user_id, occurred_at DESC);
