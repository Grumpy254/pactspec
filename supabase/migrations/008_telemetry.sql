-- Individual telemetry events from consumers
CREATE TABLE telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'timeout', 'error')),
  latency_ms INTEGER,
  reported_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert telemetry" ON telemetry_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read telemetry" ON telemetry_events FOR SELECT USING (true);

CREATE INDEX idx_telemetry_agent_reported ON telemetry_events(agent_id, reported_at DESC);
CREATE INDEX idx_telemetry_agent_skill ON telemetry_events(agent_id, skill_id);

-- Aggregated telemetry summary per agent (updated periodically or on-demand)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS telemetry_success_rate_24h NUMERIC,
  ADD COLUMN IF NOT EXISTS telemetry_success_rate_7d NUMERIC,
  ADD COLUMN IF NOT EXISTS telemetry_success_rate_30d NUMERIC,
  ADD COLUMN IF NOT EXISTS telemetry_latency_p50_ms INTEGER,
  ADD COLUMN IF NOT EXISTS telemetry_latency_p95_ms INTEGER,
  ADD COLUMN IF NOT EXISTS telemetry_total_invocations INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS telemetry_updated_at TIMESTAMPTZ;

-- Function to recompute telemetry summary for one agent
CREATE OR REPLACE FUNCTION compute_agent_telemetry(target_agent_id UUID)
RETURNS VOID AS $$
DECLARE
  total_24h INTEGER;
  success_24h INTEGER;
  total_7d INTEGER;
  success_7d INTEGER;
  total_30d INTEGER;
  success_30d INTEGER;
  p50 INTEGER;
  p95 INTEGER;
  total_all INTEGER;
BEGIN
  -- 24h
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'success')
  INTO total_24h, success_24h
  FROM telemetry_events
  WHERE agent_id = target_agent_id AND reported_at > NOW() - INTERVAL '24 hours';

  -- 7d
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'success')
  INTO total_7d, success_7d
  FROM telemetry_events
  WHERE agent_id = target_agent_id AND reported_at > NOW() - INTERVAL '7 days';

  -- 30d
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'success')
  INTO total_30d, success_30d
  FROM telemetry_events
  WHERE agent_id = target_agent_id AND reported_at > NOW() - INTERVAL '30 days';

  -- Latency percentiles (last 7d, success only)
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms),
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)
  INTO p50, p95
  FROM telemetry_events
  WHERE agent_id = target_agent_id AND reported_at > NOW() - INTERVAL '7 days' AND status = 'success' AND latency_ms IS NOT NULL;

  -- Total all time
  SELECT COUNT(*) INTO total_all FROM telemetry_events WHERE agent_id = target_agent_id;

  -- Update agent
  UPDATE agents SET
    telemetry_success_rate_24h = CASE WHEN total_24h > 0 THEN success_24h::NUMERIC / total_24h ELSE NULL END,
    telemetry_success_rate_7d = CASE WHEN total_7d > 0 THEN success_7d::NUMERIC / total_7d ELSE NULL END,
    telemetry_success_rate_30d = CASE WHEN total_30d > 0 THEN success_30d::NUMERIC / total_30d ELSE NULL END,
    telemetry_latency_p50_ms = p50,
    telemetry_latency_p95_ms = p95,
    telemetry_total_invocations = total_all,
    telemetry_updated_at = NOW()
  WHERE id = target_agent_id;
END;
$$ LANGUAGE plpgsql;

-- Retention: keep only last 90 days of telemetry
CREATE OR REPLACE FUNCTION purge_old_telemetry(max_age_days INT DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM telemetry_events WHERE reported_at < NOW() - make_interval(days := max_age_days);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;
