INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'medical.record_sample',
  'medical.enter_result',
  'medical.approve_result'
)
WHERE r.code IN ('SUPER_ADMIN', 'TENANT_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'medical.record_sample',
  'medical.enter_result'
)
WHERE r.code = 'MEDICAL_OFFICER'
ON CONFLICT DO NOTHING;
