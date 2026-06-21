-- =============================================================================
-- Darbel migration 0005 — Seed data
-- =============================================================================
-- Bootstraps:
--   1. Lagos jurisdiction (1 row)
--   2. Permissions (35 rows)
--   3. System roles (9 rows)
--   4. Role-permission grants (76 rows)
--   5. Branddarrow tenant (1 row)
--   6. Bootstrap Super Admin user (1 row)
--   7. user_roles assignment (1 row)
--
-- IDs are pinned to match the existing production install so that:
--   - Foreign-key references in already-existing audit_log rows remain valid
--   - The bootstrap admin password from the existing install continues to work
--   - A fresh install produces an identical primary-key topology
--
-- The Argon2id hash is the one currently in the live database. It accepts
-- the password 'Blessing@22.'. CHANGE IT IMMEDIATELY in production by signing
-- in and using the password change flow; the hash is non-reversible but its
-- presence in this file means anyone with repo access can attempt offline
-- brute force.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Lagos jurisdiction (id pinned)
-- -----------------------------------------------------------------------------

INSERT INTO jurisdictions (id, code, name, country_code, currency_code,
                            phone_country_code, timezone)
VALUES
    ('6f75aa86-c264-41c4-88a9-b1007228ce57',
     'LAG', 'Lagos State', 'NG', 'NGN', '+234', 'Africa/Lagos')
ON CONFLICT (code) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. Permissions (35 rows)
-- -----------------------------------------------------------------------------

INSERT INTO permissions (code, module, description, is_sensitive) VALUES
    -- Platform / tenant administration
    ('platform.manage',          'platform',    'Manage the Darbel platform (Branddarrow only)',     FALSE),
    ('tenant.update_own',        'tenants',     'Update own tenant settings',                        FALSE),
    ('tenant.view',              'tenants',     'View tenant details',                               FALSE),

    -- User management
    ('user.create',              'iam',         'Create new users',                                  FALSE),
    ('user.update',              'iam',         'Update users in own tenant',                        FALSE),
    ('user.deactivate',          'iam',         'Deactivate users in own tenant',                    FALSE),
    ('user.assign_role',         'iam',         'Assign or revoke roles',                            FALSE),
    ('user.view',                'iam',         'View user list and details',                        FALSE),
    ('user.reset_password',      'iam',         'Trigger password reset for any user',               FALSE),

    -- Role and permission management
    ('role.manage',              'iam',         'Create or modify roles within tenant',              FALSE),
    ('role.view',                'iam',         'View role definitions',                             FALSE),

    -- Audit
    ('audit.view',               'audit',       'View audit logs for own tenant',                    FALSE),
    ('audit.export',             'audit',       'Export audit logs',                                 FALSE),

    -- Registration (Phase 2 — declared now so role bundles are complete)
    ('handler.create',           'registration','Register new food handlers',                        FALSE),
    ('handler.update',           'registration','Update handler records',                            FALSE),
    ('handler.view',             'registration','View handler records',                              FALSE),
    ('handler.deactivate',       'registration','Deactivate handler records',                        FALSE),

    -- Payments (Phase 2)
    ('payment.record',           'payments',    'Record payment transactions',                       FALSE),
    ('payment.approve',          'payments',    'Approve payments (Finance Approval model)',         FALSE),
    ('payment.checkbox_paid',    'payments',    'Mark as paid via checkbox (no gateway)',            FALSE),
    ('payment.refund',           'payments',    'Approve refunds',                                   FALSE),
    ('payment.view',             'payments',    'View payment records',                              FALSE),

    -- Medical (Phase 3)
    ('medical.record_sample',    'medical',     'Record sample collection',                          FALSE),
    ('medical.enter_result',     'medical',     'Enter test results (lab technician)',               FALSE),
    ('medical.approve_result',   'medical',     'Approve test results (medical officer)',            FALSE),
    ('medical.view_results',     'medical',     'View non-sensitive test results',                   FALSE),
    ('medical.view_sensitive',   'medical',     'View sensitive results (HIV, Hep B)',               TRUE),

    -- Certificates (Phase 3)
    ('certificate.issue',        'certificates','Issue certificates',                                FALSE),
    ('certificate.revoke',       'certificates','Revoke certificates',                               FALSE),
    ('certificate.view',         'certificates','View certificate records',                          FALSE),
    ('certificate.verify_public','certificates','Public verification endpoint',                      FALSE),

    -- Reports (Phase 4)
    ('report.view',              'reports',     'View standard reports',                             FALSE),
    ('report.export_excel',      'reports',     'Export reports to Excel',                           FALSE),
    ('report.export_pdf',        'reports',     'Export reports to PDF',                             FALSE),
    ('report.compliance',        'reports',     'Generate compliance reports',                       FALSE)
ON CONFLICT (code) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 3. System roles (9 rows; tenant_id NULL = platform-wide)
-- -----------------------------------------------------------------------------

INSERT INTO roles (code, display_name, description, is_system_role, tenant_id) VALUES
    ('SUPER_ADMIN',     'Super Admin',     'Branddarrow platform-level administrator',                        TRUE, NULL),
    ('TENANT_ADMIN',    'Tenant Admin',    'Tenant-level administrator',                                      TRUE, NULL),
    ('REGISTRAR',       'Registrar',       'Registers food handlers and records initial details',             TRUE, NULL),
    ('MEDICAL_OFFICER', 'Medical Officer', 'Reviews and approves medical test results',                       TRUE, NULL),
    ('LAB_TECHNICIAN',  'Lab Technician',  'Enters laboratory test results',                                  TRUE, NULL),
    ('FINANCE_OFFICER', 'Finance Officer', 'Processes payments and approves refunds',                         TRUE, NULL),
    ('AUDITOR',         'Auditor',         'Read-only access for audit and compliance review',                TRUE, NULL),
    ('INSPECTOR',       'Inspector',       'Field officer who verifies certificates',                         TRUE, NULL),
    ('HANDLER',         'Handler',         'Self-service access for food handlers to their own records',      TRUE, NULL)
ON CONFLICT (code, tenant_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 4. Role-permission grants (76 rows total)
-- -----------------------------------------------------------------------------

WITH role_grants(role_code, permission_code) AS (VALUES
    -- SUPER_ADMIN (13 permissions)
    ('SUPER_ADMIN', 'platform.manage'),
    ('SUPER_ADMIN', 'tenant.update_own'),
    ('SUPER_ADMIN', 'tenant.view'),
    ('SUPER_ADMIN', 'user.create'),
    ('SUPER_ADMIN', 'user.update'),
    ('SUPER_ADMIN', 'user.deactivate'),
    ('SUPER_ADMIN', 'user.assign_role'),
    ('SUPER_ADMIN', 'user.view'),
    ('SUPER_ADMIN', 'user.reset_password'),
    ('SUPER_ADMIN', 'role.manage'),
    ('SUPER_ADMIN', 'role.view'),
    ('SUPER_ADMIN', 'audit.view'),
    ('SUPER_ADMIN', 'audit.export'),

    -- TENANT_ADMIN (22 permissions; full tenant control, no platform-level)
    ('TENANT_ADMIN', 'tenant.update_own'),
    ('TENANT_ADMIN', 'tenant.view'),
    ('TENANT_ADMIN', 'user.create'),
    ('TENANT_ADMIN', 'user.update'),
    ('TENANT_ADMIN', 'user.deactivate'),
    ('TENANT_ADMIN', 'user.assign_role'),
    ('TENANT_ADMIN', 'user.view'),
    ('TENANT_ADMIN', 'user.reset_password'),
    ('TENANT_ADMIN', 'role.manage'),
    ('TENANT_ADMIN', 'role.view'),
    ('TENANT_ADMIN', 'audit.view'),
    ('TENANT_ADMIN', 'audit.export'),
    ('TENANT_ADMIN', 'handler.view'),
    ('TENANT_ADMIN', 'payment.record'),
    ('TENANT_ADMIN', 'payment.approve'),
    ('TENANT_ADMIN', 'payment.view'),
    ('TENANT_ADMIN', 'medical.view_results'),
    ('TENANT_ADMIN', 'medical.view_sensitive'),
    ('TENANT_ADMIN', 'certificate.view'),
    ('TENANT_ADMIN', 'report.view'),
    ('TENANT_ADMIN', 'report.export_excel'),
    ('TENANT_ADMIN', 'report.export_pdf'),
    ('TENANT_ADMIN', 'report.compliance'),

    -- REGISTRAR (6 permissions)
    ('REGISTRAR', 'handler.create'),
    ('REGISTRAR', 'handler.update'),
    ('REGISTRAR', 'handler.view'),
    ('REGISTRAR', 'payment.record'),
    ('REGISTRAR', 'payment.view'),
    ('REGISTRAR', 'user.view'),

    -- MEDICAL_OFFICER (7 permissions)
    ('MEDICAL_OFFICER', 'handler.view'),
    ('MEDICAL_OFFICER', 'medical.approve_result'),
    ('MEDICAL_OFFICER', 'medical.view_results'),
    ('MEDICAL_OFFICER', 'medical.view_sensitive'),
    ('MEDICAL_OFFICER', 'certificate.issue'),
    ('MEDICAL_OFFICER', 'certificate.view'),
    ('MEDICAL_OFFICER', 'user.view'),

    -- LAB_TECHNICIAN (4 permissions; cannot view sensitive after submission)
    ('LAB_TECHNICIAN', 'handler.view'),
    ('LAB_TECHNICIAN', 'medical.record_sample'),
    ('LAB_TECHNICIAN', 'medical.enter_result'),
    ('LAB_TECHNICIAN', 'medical.view_results'),

    -- FINANCE_OFFICER (8 permissions; NO medical permissions by design)
    ('FINANCE_OFFICER', 'handler.view'),
    ('FINANCE_OFFICER', 'payment.record'),
    ('FINANCE_OFFICER', 'payment.approve'),
    ('FINANCE_OFFICER', 'payment.checkbox_paid'),
    ('FINANCE_OFFICER', 'payment.refund'),
    ('FINANCE_OFFICER', 'payment.view'),
    ('FINANCE_OFFICER', 'report.view'),
    ('FINANCE_OFFICER', 'report.export_excel'),

    -- AUDITOR (13 permissions; read everything in tenant, modify nothing)
    -- Note: AUDITOR does NOT get medical.view_sensitive by default. Tenants
    -- can grant it via a custom role if compliance requires it.
    ('AUDITOR', 'tenant.view'),
    ('AUDITOR', 'user.view'),
    ('AUDITOR', 'role.view'),
    ('AUDITOR', 'handler.view'),
    ('AUDITOR', 'payment.view'),
    ('AUDITOR', 'medical.view_results'),
    ('AUDITOR', 'certificate.view'),
    ('AUDITOR', 'audit.view'),
    ('AUDITOR', 'audit.export'),
    ('AUDITOR', 'report.view'),
    ('AUDITOR', 'report.export_excel'),
    ('AUDITOR', 'report.export_pdf'),
    ('AUDITOR', 'report.compliance'),

    -- INSPECTOR (3 permissions; field verifier — minimal access)
    ('INSPECTOR', 'certificate.verify_public'),
    ('INSPECTOR', 'certificate.view'),
    ('INSPECTOR', 'handler.view'),

    -- HANDLER (1 permission; self-service — bound by RLS to own records)
    ('HANDLER', 'certificate.view')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_grants rg
JOIN roles r       ON r.code = rg.role_code AND r.tenant_id IS NULL
JOIN permissions p ON p.code = rg.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 5. Branddarrow platform tenant (id pinned to match existing install)
-- -----------------------------------------------------------------------------

INSERT INTO tenants (
    id, code, legal_name, display_name, jurisdiction_id,
    contact_email, contact_phone, is_platform_operator, is_active,
    payment_model
)
SELECT
    'f483a25a-3481-4476-90ad-65fa1fd30565',
    'BRANDDARROW',
    'Branddarrow Business Hub',
    'Branddarrow',
    j.id,
    'admin@branddarrow.com',
    NULL,
    TRUE,
    TRUE,
    'FINANCE_APPROVAL'
FROM jurisdictions j
WHERE j.code = 'LAG'
ON CONFLICT (code) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 6. Bootstrap Super Admin (id and hash pinned to match live install)
-- -----------------------------------------------------------------------------
-- Password 'Blessing@22.' (production should rotate immediately).
-- must_change_password=FALSE matches the current live state.

INSERT INTO users (
    id, tenant_id, email, full_name, password_hash,
    must_change_password, is_active
)
SELECT
    '37a76063-116a-4f84-b3d3-0f3b81afa03d',
    t.id,
    'admin@branddarrow.com',
    'Platform Administrator',
    '$argon2id$v=19$m=65536,t=3,p=4$ZdUsbulGn+HvwzCl4F4OZw$uKT39RBfj1mCcgRD/6qIUWHqvelfnOIK1uOnSno7yJo',
    FALSE,
    TRUE
FROM tenants t
WHERE t.code = 'BRANDDARROW'
ON CONFLICT (tenant_id, email) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 7. user_roles assignment (admin → SUPER_ADMIN)
-- -----------------------------------------------------------------------------

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN tenants t ON t.id = u.tenant_id AND t.code = 'BRANDDARROW'
JOIN roles r ON r.code = 'SUPER_ADMIN' AND r.tenant_id IS NULL
WHERE u.email = 'admin@branddarrow.com'
ON CONFLICT (user_id, role_id) DO NOTHING;


-- =============================================================================
-- End of seed migration
--
-- Expected row counts after this migration runs against an empty schema:
--   jurisdictions     : 1
--   permissions       : 35
--   roles             : 9
--   role_permissions  : 76
--   tenants           : 1
--   users             : 1
--   user_roles        : 1
-- =============================================================================
