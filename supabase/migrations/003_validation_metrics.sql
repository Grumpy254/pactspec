-- Add per-run coverage metrics for validation runs
ALTER TABLE validation_runs
  ADD COLUMN test_count INTEGER,
  ADD COLUMN passed_count INTEGER,
  ADD COLUMN pass_rate NUMERIC;

ALTER TABLE validation_runs
  ADD CONSTRAINT validation_runs_pass_rate_range
  CHECK (pass_rate IS NULL OR (pass_rate >= 0 AND pass_rate <= 1));
