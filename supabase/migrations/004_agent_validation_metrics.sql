-- Store latest validation summary on agents for filtering
ALTER TABLE agents
  ADD COLUMN last_validation_pass_rate NUMERIC,
  ADD COLUMN last_validation_test_count INTEGER,
  ADD COLUMN last_validation_at TIMESTAMPTZ;

ALTER TABLE agents
  ADD CONSTRAINT agents_last_validation_pass_rate_range
  CHECK (last_validation_pass_rate IS NULL OR (last_validation_pass_rate >= 0 AND last_validation_pass_rate <= 1));
