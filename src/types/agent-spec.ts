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
    header?: string;
  };
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
  published_at: string;
  updated_at: string;
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
