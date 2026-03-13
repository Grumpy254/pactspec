-- Enable RLS on all tables
ALTER TABLE agents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills          ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_runs ENABLE ROW LEVEL SECURITY;

-- Public read access (registry is open)
CREATE POLICY "agents_select_public"
  ON agents FOR SELECT USING (true);

CREATE POLICY "skills_select_public"
  ON skills FOR SELECT USING (true);

CREATE POLICY "validation_runs_select_public"
  ON validation_runs FOR SELECT USING (true);

-- Writes restricted to service role only (bypasses RLS automatically)
-- Anon key gets no INSERT/UPDATE/DELETE access
