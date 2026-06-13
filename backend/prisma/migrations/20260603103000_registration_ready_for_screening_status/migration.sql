ALTER TABLE handler_registrations
  DROP CONSTRAINT IF EXISTS handler_registrations_status_check;

ALTER TABLE handler_registrations
  ADD CONSTRAINT handler_registrations_status_check
  CHECK (status IN ('DRAFT', 'SUBMITTED_FOR_REVIEW', 'READY_FOR_SCREENING', 'CANCELLED'));

UPDATE handler_registrations hr
SET status = 'READY_FOR_SCREENING'
WHERE status = 'SUBMITTED_FOR_REVIEW'
  AND EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.handler_registration_id = hr.id
      AND p.status = 'APPROVED'
  );
