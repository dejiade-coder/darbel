-- Tenant administrators oversee their own registration workflow. They can
-- record and approve payments without waiting for a separate finance role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('payment.record', 'payment.approve')
WHERE r.code = 'TENANT_ADMIN' AND r.tenant_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;
