ALTER TABLE medical_screenings
  ADD COLUMN IF NOT EXISTS mantoux_result VARCHAR(30),
  ADD COLUMN IF NOT EXISTS mantoux_induration_mm INTEGER,
  ADD COLUMN IF NOT EXISTS hepatitis_b_result VARCHAR(30),
  ADD COLUMN IF NOT EXISTS hiv_result VARCHAR(30),
  ADD COLUMN IF NOT EXISTS widal_result VARCHAR(30),
  ADD COLUMN IF NOT EXISTS medical_officer_notes TEXT;

ALTER TABLE medical_screenings
  ADD CONSTRAINT medical_screenings_mantoux_result_check
  CHECK (mantoux_result IS NULL OR mantoux_result IN ('NEGATIVE', 'POSITIVE', 'INDETERMINATE', 'NOT_DONE'));

ALTER TABLE medical_screenings
  ADD CONSTRAINT medical_screenings_hepatitis_b_result_check
  CHECK (hepatitis_b_result IS NULL OR hepatitis_b_result IN ('NEGATIVE', 'POSITIVE', 'INDETERMINATE', 'NOT_DONE'));

ALTER TABLE medical_screenings
  ADD CONSTRAINT medical_screenings_hiv_result_check
  CHECK (hiv_result IS NULL OR hiv_result IN ('NEGATIVE', 'POSITIVE', 'INDETERMINATE', 'NOT_DONE'));

ALTER TABLE medical_screenings
  ADD CONSTRAINT medical_screenings_widal_result_check
  CHECK (widal_result IS NULL OR widal_result IN ('NEGATIVE', 'POSITIVE', 'INDETERMINATE', 'NOT_DONE'));

ALTER TABLE medical_screenings
  ADD CONSTRAINT medical_screenings_mantoux_induration_check
  CHECK (mantoux_induration_mm IS NULL OR (mantoux_induration_mm >= 0 AND mantoux_induration_mm <= 50));
