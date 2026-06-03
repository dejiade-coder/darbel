ALTER TABLE handler_registrations
  DROP CONSTRAINT IF EXISTS handler_registrations_status_check;

ALTER TABLE handler_registrations
  ADD CONSTRAINT handler_registrations_status_check
  CHECK (status IN ('DRAFT', 'SUBMITTED_FOR_REVIEW', 'CANCELLED'));
