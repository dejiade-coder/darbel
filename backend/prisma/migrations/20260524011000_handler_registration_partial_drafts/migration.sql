-- Allow incomplete draft records while keeping submit validation in the API.

ALTER TABLE handler_registrations
    ALTER COLUMN first_name DROP NOT NULL,
    ALTER COLUMN last_name DROP NOT NULL,
    ALTER COLUMN phone DROP NOT NULL,
    ALTER COLUMN trade_category DROP NOT NULL,
    ALTER COLUMN business_address DROP NOT NULL;
