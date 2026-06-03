INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'payment.record',
    'payment.approve',
    'payment.checkbox_paid',
    'payment.refund',
    'payment.view'
)
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;
