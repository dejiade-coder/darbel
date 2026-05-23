-- =============================================================================
-- Darbel migration 0007 (Slice 1a) — Trade categories foundation
-- =============================================================================
-- Adds:
--   1. trade_categories table — platform-managed list per jurisdiction
--   2. trade_category_fees table — tenant-controlled fee per category
--   3. RLS policies isolating per-tenant fee access
--   4. Audit triggers on both tables
--   5. Permission codes: category.manage, trade.set_fee
--   6. Role grants for SUPER_ADMIN and TENANT_ADMIN
--   7. Seed of 10 Lagos categories across 3 sectors
--
-- This is Phase 2 Slice 1 — the foundation for the Registration module.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. trade_categories — platform-managed reference data per jurisdiction
-- -----------------------------------------------------------------------------

CREATE TABLE trade_categories (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id       UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE RESTRICT,
    code                  VARCHAR(40) NOT NULL,
    display_name          VARCHAR(120) NOT NULL,
    sector                VARCHAR(20) NOT NULL
        CHECK (sector IN ('FOOD', 'PERSONAL_CARE', 'CHILDCARE')),
    description           TEXT,
    validity_period_days  INT NOT NULL DEFAULT 365
        CHECK (validity_period_days BETWEEN 30 AND 1825),
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT trade_categories_jurisdiction_code_unique
        UNIQUE (jurisdiction_id, code)
);

CREATE INDEX idx_trade_categories_jurisdiction
    ON trade_categories(jurisdiction_id);
CREATE INDEX idx_trade_categories_active
    ON trade_categories(jurisdiction_id, is_active) WHERE is_active = TRUE;

COMMENT ON TABLE trade_categories IS
'Platform-managed trade categories per jurisdiction. Categories represent the types of personal-service work that require certification — food handlers (cooks, vendors, butchers), personal care workers (barbers, hairdressers), and childcare workers. Validity period is regulatory and platform-set; fees are tenant-set via trade_category_fees.';

CREATE TRIGGER trg_trade_categories_updated_at
    BEFORE UPDATE ON trade_categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. trade_category_fees — tenant-controlled fee per (tenant, category)
-- -----------------------------------------------------------------------------

CREATE TABLE trade_category_fees (
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trade_category_id  UUID NOT NULL REFERENCES trade_categories(id) ON DELETE CASCADE,
    fee_amount         NUMERIC(14,2) NOT NULL CHECK (fee_amount >= 0),
    currency           CHAR(3) NOT NULL DEFAULT 'NGN',
    effective_from     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by         UUID REFERENCES users(id),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, trade_category_id)
);

CREATE INDEX idx_trade_category_fees_tenant
    ON trade_category_fees(tenant_id);

COMMENT ON TABLE trade_category_fees IS
'Tenant-controlled fee for each trade_category. Absence of a row means the tenant has not yet set a price for that category — Registrars in that tenant cannot register handlers in that category until the TENANT_ADMIN sets the fee. The fee is a bundled price covering registration plus medical test (Phase 3).';


-- -----------------------------------------------------------------------------
-- 3. RLS policies
-- -----------------------------------------------------------------------------

ALTER TABLE trade_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_category_fees   ENABLE ROW LEVEL SECURITY;

-- 3a. trade_categories — readable by any tenant whose jurisdiction matches.
-- Platform admin can read all and modify any.
CREATE POLICY trade_categories_select ON trade_categories
    FOR SELECT TO darbel_app
    USING (
        jurisdiction_id IN (
            SELECT t.jurisdiction_id
            FROM tenants t
            WHERE t.id = current_app_tenant_id()
        )
        OR current_user_is_platform_admin()
    );

CREATE POLICY trade_categories_modify ON trade_categories
    FOR ALL TO darbel_app
    USING (current_user_is_platform_admin())
    WITH CHECK (current_user_is_platform_admin());

-- 3b. trade_category_fees — strict per-tenant isolation
CREATE POLICY trade_category_fees_select ON trade_category_fees
    FOR SELECT TO darbel_app
    USING (
        tenant_id = current_app_tenant_id()
        OR current_user_is_platform_admin()
    );

CREATE POLICY trade_category_fees_modify ON trade_category_fees
    FOR ALL TO darbel_app
    USING (
        (tenant_id = current_app_tenant_id()
            AND current_user_has_permission('trade.set_fee'))
        OR current_user_is_platform_admin()
    )
    WITH CHECK (
        (tenant_id = current_app_tenant_id()
            AND current_user_has_permission('trade.set_fee'))
        OR current_user_is_platform_admin()
    );


-- -----------------------------------------------------------------------------
-- 4. Audit triggers on both tables
-- -----------------------------------------------------------------------------

CREATE TRIGGER trg_audit_trade_categories
    AFTER INSERT OR UPDATE OR DELETE ON trade_categories
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_trade_category_fees
    AFTER INSERT OR UPDATE OR DELETE ON trade_category_fees
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- -----------------------------------------------------------------------------
-- 5. New permission codes
-- -----------------------------------------------------------------------------

INSERT INTO permissions (code, module, description, is_sensitive) VALUES
    ('category.manage', 'trade_categories', 'Create or modify trade categories (platform-level)',                FALSE),
    ('trade.set_fee',   'trade_categories', 'Set or update fees for trade categories within own tenant',          FALSE)
ON CONFLICT (code) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 6. Role grants
-- -----------------------------------------------------------------------------

-- SUPER_ADMIN gets category.manage (platform-level operation)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND r.tenant_id IS NULL
  AND p.code = 'category.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- TENANT_ADMIN gets trade.set_fee (tenant-level operation)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'TENANT_ADMIN'
  AND r.tenant_id IS NULL
  AND p.code = 'trade.set_fee'
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 7. GRANT new tables to darbel_app
-- -----------------------------------------------------------------------------
-- darbel_app has default INSERT/SELECT/UPDATE/DELETE on all tables in
-- public schema (set up in Phase 1 migration 0003). New tables inherit
-- via ALTER DEFAULT PRIVILEGES, but we are explicit here for clarity.

GRANT SELECT, INSERT, UPDATE, DELETE ON trade_categories    TO darbel_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON trade_category_fees TO darbel_app;


-- -----------------------------------------------------------------------------
-- 8. Seed Lagos trade categories (10 rows across 3 sectors)
-- -----------------------------------------------------------------------------

INSERT INTO trade_categories (
    jurisdiction_id, code, display_name, sector, description, validity_period_days
)
SELECT
    j.id, v.code, v.display_name, v.sector, v.description, v.validity_period_days
FROM jurisdictions j
CROSS JOIN (VALUES
    -- FOOD sector
    ('STREET_VENDOR',    'Street Food Vendor',           'FOOD',
     'Mobile or stationary street-level food vendors serving prepared food directly to consumers.',
     365),
    ('RESTAURANT_COOK',  'Restaurant Cook',              'FOOD',
     'Cooks and chefs in restaurants, casual-dining, and fine-dining establishments.',
     365),
    ('HOTEL_KITCHEN',    'Hotel Kitchen Staff',          'FOOD',
     'Hotel kitchen workers including chefs, cooks, and stewards.',
     365),
    ('BAKERY_WORKER',    'Bakery Worker',                'FOOD',
     'Workers in bakeries and pastry shops handling dough, baking, and finished products.',
     365),
    ('CATERING_SERVICE', 'Catering Service Personnel',   'FOOD',
     'Caterers serving events, conferences, and contract food service.',
     365),
    ('MEAT_PROCESSOR',   'Meat Processor / Butcher',     'FOOD',
     'Butchers and meat processing workers. Higher risk profile — 180-day validity.',
     180),
    ('FOOD_VENDOR',      'Food Vendor (general)',        'FOOD',
     'General food vendors not classified under more specific categories.',
     365),

    -- PERSONAL_CARE sector
    ('BARBER',           'Barber',                       'PERSONAL_CARE',
     'Barbers performing haircuts and shaving services.',
     365),
    ('HAIRDRESSER',      'Hairdresser',                  'PERSONAL_CARE',
     'Hairdressers providing styling, coloring, and chemical treatment services.',
     365),

    -- CHILDCARE sector
    ('CRECHE_WORKER',    'Creche Worker',                'CHILDCARE',
     'Workers in creches and daycare centers caring for infants and young children.',
     365)
) AS v(code, display_name, sector, description, validity_period_days)
WHERE j.code = 'LAG'
ON CONFLICT (jurisdiction_id, code) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 9. Verification (NOTICE)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
    v_categories INT;
    v_perms      INT;
    v_policies   INT;
BEGIN
    SELECT COUNT(*) INTO v_categories
    FROM trade_categories tc
    JOIN jurisdictions j ON j.id = tc.jurisdiction_id
    WHERE j.code = 'LAG';

    SELECT COUNT(*) INTO v_perms
    FROM permissions WHERE code IN ('category.manage', 'trade.set_fee');

    SELECT COUNT(*) INTO v_policies
    FROM pg_policies WHERE tablename IN ('trade_categories', 'trade_category_fees');

    RAISE NOTICE 'slice1_summary: lagos_categories=%, new_permissions=%, policies=%',
        v_categories, v_perms, v_policies;
END$$;

-- Expected on a fresh apply against an empty Phase 1 install:
--   lagos_categories=10, new_permissions=2, policies=4
