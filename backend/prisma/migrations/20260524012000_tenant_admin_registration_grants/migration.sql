-- Allow tenant administrators to operate the first registration slice locally.
-- Dedicated REGISTRAR users already have these permissions from the seed data.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'TENANT_ADMIN'
  AND r.tenant_id IS NULL
  AND p.code IN ('handler.create', 'handler.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;
