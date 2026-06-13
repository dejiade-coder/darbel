-- Tenant admins own operational certificate control for their tenant.
-- Auditors remain read-only; medical officers already hold certificate.issue.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'TENANT_ADMIN'
  AND p.code IN ('certificate.issue', 'certificate.revoke', 'certificate.deliver')
ON CONFLICT DO NOTHING;
