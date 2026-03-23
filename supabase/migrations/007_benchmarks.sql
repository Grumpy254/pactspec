-- Benchmarks: standardized test suites published by third-party evaluators
CREATE TABLE benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  domain TEXT NOT NULL,
  version TEXT NOT NULL,
  publisher TEXT NOT NULL,
  publisher_url TEXT,
  test_suite_url TEXT NOT NULL,
  test_count INTEGER NOT NULL,
  skill TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read benchmarks" ON benchmarks FOR SELECT USING (true);

-- Benchmark results: agent scores against benchmarks
CREATE TABLE benchmark_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_id TEXT NOT NULL REFERENCES benchmarks(benchmark_id),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 1),
  passed_count INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  attestation_hash TEXT,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(benchmark_id, agent_id)
);

ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read benchmark_results" ON benchmark_results FOR SELECT USING (true);

CREATE INDEX idx_benchmark_results_agent ON benchmark_results(agent_id);
CREATE INDEX idx_benchmark_results_score ON benchmark_results(benchmark_id, score DESC);
CREATE INDEX idx_benchmarks_domain ON benchmarks(domain);
