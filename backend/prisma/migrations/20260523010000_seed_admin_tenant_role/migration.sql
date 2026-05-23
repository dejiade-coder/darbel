-- =============================================================================
-- Darbel migration 0008 — Bootstrap admin gets TENANT_ADMIN within Branddarrow
-- =============================================================================
-- Bug #15 fix: bootstrap admin (admin@branddarrow.com) was only assigned
-- platform-level SUPER_ADMIN in Phase 1 seed (migration 0004), but
-- TENANT_ADMIN role holds the trade.set_fee permission needed in Slice 1c.
--
-- Architectural rationale: the bootstrap admin of Branddarrow operates in
-- two capacities simultaneously:
--   - Platform operator (SUPER_ADMIN, tenant_id NULL) — manages Darbel platform
--   - Tenant operator (TENANT_ADMIN, tenant_id = Branddarrow) — runs Branddarrow
--
-- Bug #16 correction: user_roles columns are 'assigned_at' and 'assigned_by',
-- not 'granted_at' and 'granted_by'. My earlier migration used the wrong
-- column names. This corrected version uses the real schema.
--
-- Idempotent via ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
SELECT
    u.id,
    r.id,
    NOW(),
    u.id            -- self-assigned (bootstrap chicken-and-egg)
FROM users u
CROSS JOIN roles r
WHERE u.email = 'admin@branddarrow.com'
  AND r.code = 'TENANT_ADMIN'
  AND r.tenant_id IS NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

DO $$
DECLARE
    v_admin_roles INT;
BEGIN
    SELECT COUNT(*) INTO v_admin_roles
    FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.email = 'admin@branddarrow.com';

    RAISE NOTICE 'bootstrap_admin_roles_count = %', v_admin_roles;
    -- Expected: 2 (SUPER_ADMIN + TENANT_ADMIN). If 1, the INSERT did not match.
END$$;
