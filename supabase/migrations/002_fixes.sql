-- Fix: add public SELECT policy for validation_runs (was missing, blocking all reads)
CREATE POLICY "Public read validation_runs" ON validation_runs
  FOR SELECT USING (true);

-- Fix: prevent duplicate skill rows for the same agent
ALTER TABLE skills ADD CONSTRAINT skills_agent_skill_unique UNIQUE (agent_id, skill_id);

-- Fix: name must not be null on skills (already NOT NULL in CREATE TABLE, belt-and-suspenders)
-- Already enforced by CREATE TABLE, nothing to do.

-- Fix: sla_uptime must be between 0 and 1
ALTER TABLE skills ADD CONSTRAINT skills_sla_uptime_range
  CHECK (sla_uptime IS NULL OR (sla_uptime >= 0 AND sla_uptime <= 1));

-- Fix: index for published_at ordering (used in every GET /api/agents query)
CREATE INDEX IF NOT EXISTS idx_agents_published_at ON agents(published_at DESC);

-- Fix: index for skills lookup by agent_id (FK traversal on cascade delete + join)
CREATE INDEX IF NOT EXISTS idx_skills_agent_id ON skills(agent_id);
