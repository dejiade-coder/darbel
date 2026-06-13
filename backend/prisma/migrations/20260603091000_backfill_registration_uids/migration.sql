WITH approved_registrations AS (
    SELECT DISTINCT
        hr.id,
        CASE
            WHEN t.is_platform_operator THEN 'BBH'
            ELSE SUBSTRING(REGEXP_REPLACE(UPPER(t.code), '[^A-Z]', '', 'g') || 'XXX' FROM 1 FOR 3)
        END AS prefix
    FROM handler_registrations hr
    JOIN tenants t ON t.id = hr.tenant_id
    JOIN payments p ON p.handler_registration_id = hr.id
    WHERE p.status = 'APPROVED'
      AND hr.uid IS NULL
)
UPDATE handler_registrations hr
SET
    uid = ar.prefix || '-' ||
        SUBSTRING(TRANSLATE(UPPER(MD5(hr.id::TEXT)), '0189', 'ABCD') FROM 1 FOR 6) ||
        '-A',
    uid_issued_at = NOW(),
    uid_issued_by = (
        SELECT p.approved_by
        FROM payments p
        WHERE p.handler_registration_id = hr.id
          AND p.status = 'APPROVED'
        ORDER BY p.approved_at DESC NULLS LAST, p.recorded_at DESC
        LIMIT 1
    )
FROM approved_registrations ar
WHERE hr.id = ar.id;
