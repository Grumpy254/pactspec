-- Pricing drift detection: track declared vs actual prices over time
CREATE TABLE pricing_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  declared_amount NUMERIC,
  declared_currency TEXT,
  actual_amount TEXT,
  actual_currency TEXT,
  match BOOLEAN NOT NULL,
  drift_percentage NUMERIC,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pricing_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pricing_checks" ON pricing_checks FOR SELECT USING (true);
CREATE INDEX idx_pricing_checks_agent ON pricing_checks(agent_id, checked_at DESC);

-- Add drift flag to agents
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS pricing_drift_detected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pricing_last_checked_at TIMESTAMPTZ;
