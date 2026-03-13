-- Agents registry
CREATE TABLE agents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id          TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  version          TEXT NOT NULL,
  description      TEXT,
  provider_name    TEXT NOT NULL,
  provider_url     TEXT,
  provider_did     TEXT,
  endpoint_url     TEXT NOT NULL,
  spec             JSONB NOT NULL,
  tags             TEXT[] DEFAULT '{}',
  verified         BOOLEAN DEFAULT FALSE,
  attestation_hash TEXT,
  verified_at      TIMESTAMPTZ,
  published_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agents_tags     ON agents USING GIN(tags);
CREATE INDEX idx_agents_verified ON agents(verified);
CREATE INDEX idx_agents_spec     ON agents USING GIN(spec);

-- Normalized skills for fast search/filter
CREATE TABLE skills (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID REFERENCES agents(id) ON DELETE CASCADE,
  skill_id         TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  tags             TEXT[] DEFAULT '{}',
  input_schema     JSONB,
  output_schema    JSONB,
  pricing_model    TEXT,
  pricing_amount   NUMERIC,
  pricing_currency TEXT,
  pricing_protocol TEXT,
  test_suite_url   TEXT,
  sla_p99_ms       INTEGER,
  sla_uptime       NUMERIC
);

-- Validation runs (audit trail)
CREATE TABLE validation_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID REFERENCES agents(id) ON DELETE CASCADE,
  skill_id         TEXT NOT NULL,
  status           TEXT CHECK (status IN ('PENDING','RUNNING','PASSED','FAILED','TIMEOUT','ERROR')),
  test_results     JSONB,
  duration_ms      INTEGER,
  error            TEXT,
  attestation_hash TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Row level security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_runs ENABLE ROW LEVEL SECURITY;

-- Public read access for registry data
CREATE POLICY "Public read agents" ON agents
  FOR SELECT USING (true);

CREATE POLICY "Public read skills" ON skills
  FOR SELECT USING (true);
