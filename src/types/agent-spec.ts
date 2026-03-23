export type AuthType = 'none' | 'bearer' | 'x-agent-id' | 'header';
export type PricingModel = 'per-invocation' | 'per-token' | 'per-second' | 'free';
export type PricingCurrency = 'USD' | 'USDC' | 'SOL';
export type PricingProtocol = 'x402' | 'stripe' | 'none';
export type TestSuiteType = 'http-roundtrip' | 'json-schema-validation';

export interface AgentSpecPricing {
  model: PricingModel;
  amount: number;
  currency: PricingCurrency;
  protocol?: PricingProtocol;
}

export interface AgentSpecTestSuite {
  url: string;
  type?: TestSuiteType;
}

export interface AgentSpecExample {
  description?: string;
  input: unknown;
  expectedOutput: unknown;
}

export interface AgentSpecSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  examples?: AgentSpecExample[];
  pricing?: AgentSpecPricing;
  testSuite?: AgentSpecTestSuite;
}

export interface AgentSpecProvider {
  name: string;
  url?: string;
  contact?: string;
}

export interface AgentSpecEndpoint {
  url: string;
  auth?: {
    type: AuthType;
    name?: string;   // header name for type: 'header'
  };
}

export interface AgentSpecDelegation {
  delegatedFrom?: string;      // spec_id of the upstream agent being wrapped
  revenueShare?: {
    upstream: number;           // percentage to upstream (0-100)
    downstream: number;         // percentage kept by this agent (0-100)
  };
  terms?: string;               // URL to delegation agreement/terms
}

export interface AgentSpec {
  specVersion: '1.0.0';
  id: string;
  name: string;
  version: string;
  description?: string;
  provider: AgentSpecProvider;
  endpoint: AgentSpecEndpoint;
  skills: AgentSpecSkill[];
  tags?: string[];
  license?: string;
  links?: {
    documentation?: string;
    repository?: string;
  };
  delegation?: AgentSpecDelegation;
}

// Benchmark types
export interface Benchmark {
  id: string;                    // e.g., "aapc-medical-coding-v2"
  name: string;                  // "AAPC Medical Coding Benchmark v2"
  description: string;
  domain: string;                // "medical-coding", "legal-review", "security-audit"
  version: string;
  publisher: string;             // who published this benchmark
  publisherUrl?: string;
  testSuiteUrl: string;          // URL to the test suite JSON
  testCount: number;
  skill: string;                 // which skill type this benchmarks
  createdAt: string;
  // Source provenance — distinguishes synthetic benchmarks from peer-reviewed ones
  source?: 'synthetic' | 'peer-reviewed' | 'industry-standard' | 'community';
  sourceDescription?: string;    // e.g., "Synthetic scenarios using real WHO ICD-11 codes"
  sourceUrl?: string;            // URL to the authoritative source
  sourceLicense?: string;        // license of the source data
}

export interface BenchmarkResult {
  id: string;
  benchmarkId: string;
  agentId: string;
  score: number;                 // 0-1 (percentage of tests passed)
  passedCount: number;
  totalCount: number;
  runAt: string;
  attestationHash?: string;
}

// DB row types
export interface AgentRow {
  id: string;
  spec_id: string;
  name: string;
  version: string;
  description: string | null;
  provider_name: string;
  provider_url: string | null;
  endpoint_url: string;
  spec: AgentSpec;
  tags: string[];
  verified: boolean;
  attestation_hash: string | null;
  verified_at: string | null;
  last_validation_pass_rate?: number | null;
  last_validation_test_count?: number | null;
  last_validation_at?: string | null;
  delegated_from?: string | null;
  pricing_verified?: boolean;
  pricing_verified_at?: string | null;
  pricing_drift_detected?: boolean;
  pricing_last_checked_at?: string | null;
  published_at: string;
  updated_at: string;
  benchmark_results?: BenchmarkResult[];
  telemetry_success_rate_24h?: number | null;
  telemetry_success_rate_7d?: number | null;
  telemetry_success_rate_30d?: number | null;
  telemetry_latency_p50_ms?: number | null;
  telemetry_latency_p95_ms?: number | null;
  telemetry_total_invocations?: number | null;
  telemetry_updated_at?: string | null;
}

// Test suite format agents publish at testSuite.url
export interface TestCase {
  id: string;
  description?: string;
  request: {
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  expect: {
    status: number;
    outputSchema?: Record<string, unknown>;
  };
  timeoutMs?: number;
}

export interface TestSuiteFile {
  version: '1.0';
  skill: string;
  tests: TestCase[];
}

// Validation result
export interface TestResult {
  testId: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  statusCode?: number;
}

export interface ValidationResult {
  status: 'PASSED' | 'FAILED' | 'ERROR' | 'TIMEOUT';
  results: TestResult[];
  attestationHash?: string;
  durationMs: number;
  error?: string;
}
