-- =============================================================================
-- Darbel — Phase 1 Database Schema
-- Owner: Branddarrow Business Hub
-- Database: PostgreSQL 16
-- =============================================================================
-- This schema covers:
--   1. Extensions
--   2. Tenants & Jurisdictions
--   3. Identity & Access Management (Users, Roles, Permissions, Sessions, MFA)
--   4. Audit infrastructure (log tables; triggers in 03-audit-triggers.sql)
--
-- Domain modules (registration, payments, medical, certificates, reports) are
-- introduced in their respective phases and will reference the foundations here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS "citext";         -- case-insensitive text (emails)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- trigram search (handler lookup)


-- -----------------------------------------------------------------------------
-- 2. Tenants & Jurisdictions
-- -----------------------------------------------------------------------------

-- Jurisdictions are configurable; Lagos is seeded first but the schema permits
-- additional jurisdictions without code changes.
CREATE TABLE jurisdictions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(10) NOT NULL UNIQUE,          -- e.g. 'LAG', 'FCT'
    name            VARCHAR(120) NOT NULL,                 -- e.g. 'Lagos State'
    country_code    CHAR(2) NOT NULL,                      -- ISO 3166-1 alpha-2
    currency_code   CHAR(3) NOT NULL,                      -- ISO 4217
    phone_country_code VARCHAR(5) NOT NULL,                -- e.g. '+234'
    timezone        VARCHAR(50) NOT NULL DEFAULT 'Africa/Lagos',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE jurisdictions IS
'Regulatory jurisdictions. Each tenant operates within a jurisdiction.';

-- Tenants are client organizations. Branddarrow itself is tenant_id = the
-- special "platform" tenant created at bootstrap.
CREATE TABLE tenants (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                     VARCHAR(20) NOT NULL UNIQUE,  -- short code, e.g. 'LAGMOH'
    legal_name               VARCHAR(200) NOT NULL,
    display_name             VARCHAR(120) NOT NULL,
    jurisdiction_id          UUID NOT NULL REFERENCES jurisdictions(id),
    contact_email            CITEXT NOT NULL,
    contact_phone            VARCHAR(20),
    is_platform_operator     BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE only for Branddarrow
    is_active                BOOLEAN NOT NULL DEFAULT TRUE,
    -- Payment governance (Section 8 of architecture)
    payment_model            VARCHAR(20) NOT NULL DEFAULT 'FINANCE_APPROVAL'
        CHECK (payment_model IN ('FINANCE_APPROVAL', 'CHECKBOX_PAID')),
    checkbox_paid_threshold  NUMERIC(14,2),  -- above this, 4-eyes required
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tenants IS
'Client organizations consuming the Darbel platform. Branddarrow is itself a tenant flagged as is_platform_operator.';

CREATE INDEX idx_tenants_jurisdiction ON tenants(jurisdiction_id);
CREATE INDEX idx_tenants_active ON tenants(is_active) WHERE is_active = TRUE;

-- Per-tenant configurable settings (key-value, for future extensibility)
CREATE TABLE tenant_settings (
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    setting_key  VARCHAR(80) NOT NULL,
    setting_value JSONB NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by   UUID,
    PRIMARY KEY (tenant_id, setting_key)
);


-- -----------------------------------------------------------------------------
-- 3. Identity & Access Management
-- -----------------------------------------------------------------------------

-- Permissions are atomic capabilities. Roles are bundles of permissions.
-- This separation allows fine-grained permission edits per tenant in future.
CREATE TABLE permissions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(80) NOT NULL UNIQUE,
        -- e.g. 'handler.create', 'medical.approve', 'medical.view_sensitive'
    module       VARCHAR(40) NOT NULL,
        -- e.g. 'iam', 'registration', 'medical', 'payments'
    description  TEXT NOT NULL,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
        -- TRUE for permissions that grant access to sensitive medical data
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permissions_module ON permissions(module);

CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(40) NOT NULL,
    display_name    VARCHAR(120) NOT NULL,
    description     TEXT,
    is_system_role  BOOLEAN NOT NULL DEFAULT FALSE,
        -- System roles are managed by Branddarrow; tenants can have custom roles
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
        -- NULL means platform-wide role (system roles); else tenant-specific
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Either system role (tenant_id NULL) or tenant role (tenant_id NOT NULL)
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

-- Users are the human (or service) actors of the system.
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    email               CITEXT NOT NULL,
    phone               VARCHAR(20),
    full_name           VARCHAR(200) NOT NULL,
    password_hash       TEXT NOT NULL,           -- Argon2id encoded string
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret_enc      TEXT,                    -- TOTP secret, encrypted
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked           BOOLEAN NOT NULL DEFAULT FALSE,
    locked_until        TIMESTAMPTZ,
    failed_login_count  INT NOT NULL DEFAULT 0,
    last_login_at       TIMESTAMPTZ,
    last_login_ip       INET,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,             -- soft delete
    -- email unique within tenant
    CONSTRAINT users_tenant_email_unique UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(tenant_id, is_active) WHERE deleted_at IS NULL;

-- A user can have multiple roles, but within their tenant only.
CREATE TABLE user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID,
    PRIMARY KEY (user_id, role_id)
);

-- Password history (prevents reuse of last N)
CREATE TABLE password_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_history_user ON password_history(user_id, created_at DESC);

-- Refresh token sessions. Access tokens are stateless JWT and not stored.
CREATE TABLE sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash  TEXT NOT NULL UNIQUE,    -- SHA-256 of the opaque token
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

-- Login attempts for rate limiting and forensic review
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
-- 4. Audit infrastructure (log tables only; triggers in 03-audit-triggers.sql)
-- -----------------------------------------------------------------------------

-- Append-only audit log. Triggers populate it. No application role may
-- UPDATE or DELETE rows here.
CREATE TABLE audit_log (
    id            BIGSERIAL PRIMARY KEY,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id     UUID,
    actor_user_id UUID,
    actor_email   CITEXT,
    action        VARCHAR(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    table_name    VARCHAR(80) NOT NULL,
    record_id     TEXT NOT NULL,           -- text to accept UUID, BIGINT, etc.
    before_state  JSONB,
    after_state   JSONB,
    changed_fields TEXT[],                  -- list of field names that changed
    ip_address    INET,
    user_agent    TEXT,
    request_id    UUID                      -- correlate with application logs
);

CREATE INDEX idx_audit_tenant_time ON audit_log(tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_actor_time ON audit_log(actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id);

COMMENT ON TABLE audit_log IS
'Append-only audit trail. Populated by triggers. UPDATE/DELETE permissions must be revoked for all application roles.';

-- Sensitive data access log. Records every READ of sensitive medical fields.
-- Populated by application code (NestJS interceptor), not triggers, because
-- SELECT does not fire triggers in Postgres.
CREATE TABLE sensitive_access_log (
    id             BIGSERIAL PRIMARY KEY,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id      UUID NOT NULL,
    actor_user_id  UUID NOT NULL,
    accessed_table VARCHAR(80) NOT NULL,
    accessed_record_id TEXT NOT NULL,
    accessed_field VARCHAR(80) NOT NULL,
    purpose        TEXT,                    -- justification captured from UI
    ip_address     INET,
    request_id     UUID
);

CREATE INDEX idx_sensitive_access_tenant_time
    ON sensitive_access_log(tenant_id, occurred_at DESC);
CREATE INDEX idx_sensitive_access_actor_time
    ON sensitive_access_log(actor_user_id, occurred_at DESC);


-- -----------------------------------------------------------------------------
-- 5. Helper function: current actor context (used by RLS and triggers)
-- -----------------------------------------------------------------------------
-- Application sets these per-connection via SET LOCAL before each request:
--   SET LOCAL app.current_user_id = '...';
--   SET LOCAL app.current_tenant_id = '...';
--   SET LOCAL app.current_user_email = '...';
--   SET LOCAL app.request_id = '...';
--   SET LOCAL app.client_ip = '...';
--   SET LOCAL app.user_agent = '...';
-- These accessors return NULL if not set (rather than raising), to allow
-- system jobs and migrations to operate without context.

CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_app_tenant_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_app_user_email() RETURNS CITEXT AS $$
    SELECT NULLIF(current_setting('app.current_user_email', TRUE), '')::CITEXT;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_app_request_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.request_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_app_client_ip() RETURNS INET AS $$
    SELECT NULLIF(current_setting('app.client_ip', TRUE), '')::INET;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_app_user_agent() RETURNS TEXT AS $$
    SELECT NULLIF(current_setting('app.user_agent', TRUE), '');
$$ LANGUAGE SQL STABLE;

-- Helper: does the current user hold a given permission?
-- Used by RLS policies for module-level checks.
CREATE OR REPLACE FUNCTION current_user_has_permission(p_permission_code VARCHAR)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE u.id = current_app_user_id()
          AND u.is_active = TRUE
          AND u.deleted_at IS NULL
          AND p.code = p_permission_code
    );
$$ LANGUAGE SQL STABLE;

-- Helper: is the current user the platform Super Admin (Branddarrow)?
CREATE OR REPLACE FUNCTION current_user_is_platform_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN tenants t ON t.id = u.tenant_id
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE u.id = current_app_user_id()
          AND t.is_platform_operator = TRUE
          AND r.code = 'SUPER_ADMIN'
          AND u.is_active = TRUE
          AND u.deleted_at IS NULL
    );
$$ LANGUAGE SQL STABLE;


-- -----------------------------------------------------------------------------
-- 6. updated_at maintenance trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jurisdictions_updated_at
    BEFORE UPDATE ON jurisdictions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- End of 01-schema.sql
-- Next: 02-rls-policies.sql (Row-Level Security), 03-audit-triggers.sql
-- =============================================================================
