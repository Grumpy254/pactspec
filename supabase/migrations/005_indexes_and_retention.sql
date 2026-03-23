-- Index on last_validation_pass_rate for min_pass_rate filter queries
CREATE INDEX IF NOT EXISTS idx_agents_last_validation_pass_rate
  ON agents(last_validation_pass_rate)
  WHERE last_validation_pass_rate IS NOT NULL;

-- Index on validation_runs for rate-limit check (agent_id + created_at)
CREATE INDEX IF NOT EXISTS idx_validation_runs_agent_created
  ON validation_runs(agent_id, created_at DESC);

-- Deduplicate skills before adding unique constraint
DELETE FROM skills a USING skills b
  WHERE a.agent_id = b.agent_id AND a.skill_id = b.skill_id AND a.id > b.id;

-- Unique constraint on skills (agent_id, skill_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_agent_skill
  ON skills(agent_id, skill_id);

-- Fix nullable foreign keys
ALTER TABLE skills ALTER COLUMN agent_id SET NOT NULL;
ALTER TABLE validation_runs ALTER COLUMN agent_id SET NOT NULL;

-- Add NOT NULL to validation_runs.status with a default
ALTER TABLE validation_runs ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE validation_runs ALTER COLUMN status SET NOT NULL;

-- Add updated_at to validation_runs for tracking status changes
ALTER TABLE validation_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Public read policy on validation_runs (RLS is enabled but had no SELECT policy)
CREATE POLICY "Public read validation_runs" ON validation_runs
  FOR SELECT USING (true);

-- Drop unused GIN index on full spec JSONB column (no query uses @> or ? on spec)
DROP INDEX IF EXISTS idx_agents_spec;

-- Replace low-selectivity boolean index with a partial index for verified agents
DROP INDEX IF EXISTS idx_agents_verified;
CREATE INDEX idx_agents_verified_sorted ON agents(published_at DESC) WHERE verified = true;

-- Auto-update updated_at on agents table
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER validation_runs_updated_at
  BEFORE UPDATE ON validation_runs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Retention: purge old validation runs keeping the latest N per agent
-- AND removing anything beyond that which is also older than max_age_days.
-- The top N runs are always preserved regardless of age.
CREATE OR REPLACE FUNCTION purge_old_validation_runs(
  keep_per_agent INT DEFAULT 20,
  max_age_days INT DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM validation_runs
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY created_at DESC) AS rn,
             created_at
      FROM validation_runs
    ) ranked
    WHERE rn > keep_per_agent
      AND created_at < NOW() - make_interval(days := max_age_days)
  );
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;
