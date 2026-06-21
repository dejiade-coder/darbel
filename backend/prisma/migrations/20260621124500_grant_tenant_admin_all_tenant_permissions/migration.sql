-- Tenant administrators manage every operational capability within their own
-- tenant. platform.manage remains exclusive to the platform operator.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code <> 'platform.manage'
WHERE r.code = 'TENANT_ADMIN' AND r.tenant_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;
