import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schemaJson from './schema.json';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthType = 'none' | 'bearer' | 'x-agent-id' | 'header';
export type PricingModel = 'per-invocation' | 'per-token' | 'per-second' | 'free';
export type PricingCurrency = 'USD' | 'USDC' | 'SOL';
export type PricingProtocol = 'x402' | 'stripe' | 'none';

export interface AgentSpecPricing {
  model: PricingModel;
  amount: number;
  currency: PricingCurrency;
  protocol?: PricingProtocol;
}

export interface AgentSpecSLA {
  p50LatencyMs?: number;
  p99LatencyMs?: number;
  uptimeSLA?: number;
  maxConcurrency?: number;
}

export interface AgentSpecSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  pricing?: AgentSpecPricing;
  sla?: AgentSpecSLA;
  testSuite?: { url: string; type?: 'http-roundtrip' | 'json-schema-validation' };
  examples?: Array<{ description?: string; input: unknown; expectedOutput: unknown }>;
}

export interface AgentSpec {
  specVersion: '1.0.0';
  id: string;
  name: string;
  version: string;
  description?: string;
  provider: { name: string; url?: string; did?: string; contact?: string };
  endpoint: { url: string; auth?: { type: AuthType; header?: string } };
  skills: AgentSpecSkill[];
  tags?: string[];
  license?: string;
  links?: { documentation?: string; repository?: string };
}

export interface AgentRecord {
  id: string;
  specId: string;
  name: string;
  version: string;
  description: string | null;
  providerName: string;
  endpointUrl: string;
  spec: AgentSpec;
  tags: string[];
  verified: boolean;
  attestationHash: string | null;
  verifiedAt: string | null;
  publishedAt: string;
}

export interface TestResult {
  testId: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  statusCode?: number;
}

// ── Validate ──────────────────────────────────────────────────────────────────

const ajv = new Ajv({ strict: false });
addFormats(ajv);
const compiledSchema = ajv.compile(schemaJson);

export interface ValidateResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate an AgentSpec document against the canonical v1 schema.
 * Synchronous — no network calls.
 */
export function validate(spec: unknown): ValidateResult {
  const valid = compiledSchema(spec) as boolean;
  return {
    valid,
    errors: valid
      ? []
      : (compiledSchema.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`),
  };
}

// ── Registry client ───────────────────────────────────────────────────────────

const DEFAULT_REGISTRY = 'https://agentspec.dev';

export interface PublishOptions {
  /** X-Agent-ID header — identifies the publisher. Min 4 chars, max 128. */
  agentId: string;
  /** Registry base URL. Defaults to https://agentspec.dev */
  registry?: string;
}

export interface PublishResult {
  /** Registry UUID for this agent */
  id: string;
  /** Spec URN e.g. urn:agent:acme:my-agent */
  specId: string;
  /** Whether the agent is currently verified */
  verified: boolean;
}

/**
 * Publish an AgentSpec to the registry.
 * Validates the spec locally before sending.
 * Throws on validation failure or network/HTTP error.
 */
export async function publish(spec: AgentSpec, options: PublishOptions): Promise<PublishResult> {
  const { valid, errors } = validate(spec);
  if (!valid) throw new Error(`Invalid AgentSpec: ${errors.join('; ')}`);

  const registry = options.registry ?? DEFAULT_REGISTRY;
  const res = await fetch(`${registry}/api/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-ID': options.agentId,
    },
    body: JSON.stringify(spec),
  });

  const data = await res.json() as {
    agent?: { id: string; spec_id: string; verified: boolean };
    error?: string;
    errors?: string[];
  };

  if (!res.ok || !data.agent) {
    const msg = data.error ?? `Publish failed (HTTP ${res.status})`;
    const detail = data.errors?.length ? `: ${data.errors.join('; ')}` : '';
    throw new Error(`${msg}${detail}`);
  }

  return { id: data.agent.id, specId: data.agent.spec_id, verified: data.agent.verified };
}

export interface VerifyOptions {
  /** Registry base URL. Defaults to https://agentspec.dev */
  registry?: string;
}

export interface VerifyResult {
  runId: string;
  status: 'PASSED' | 'FAILED' | 'ERROR';
  attestationHash?: string;
  results: TestResult[];
  durationMs: number;
  error?: string;
}

/**
 * Trigger a validation run for a skill on a published agent.
 * Throws on HTTP error. Returns the full run result including per-test details.
 */
export async function verify(
  agentId: string,
  skillId: string,
  options?: VerifyOptions
): Promise<VerifyResult> {
  const registry = options?.registry ?? DEFAULT_REGISTRY;
  const res = await fetch(
    `${registry}/api/agents/${encodeURIComponent(agentId)}/validate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId }),
    }
  );

  const data = await res.json() as VerifyResult & { error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? `Verify failed (HTTP ${res.status})`);
  }

  return data;
}

/**
 * Fetch a single agent from the registry by UUID or spec URN.
 */
export async function getAgent(
  agentId: string,
  options?: { registry?: string }
): Promise<AgentRecord> {
  const registry = options?.registry ?? DEFAULT_REGISTRY;
  const res = await fetch(`${registry}/api/agents/${encodeURIComponent(agentId)}`);
  const data = await res.json() as { agent?: Record<string, unknown>; error?: string };

  if (!res.ok || !data.agent) {
    throw new Error(data.error ?? `Agent not found: ${agentId}`);
  }

  const a = data.agent;
  return {
    id: a.id as string,
    specId: a.spec_id as string,
    name: a.name as string,
    version: a.version as string,
    description: a.description as string | null,
    providerName: a.provider_name as string,
    endpointUrl: a.endpoint_url as string,
    spec: a.spec as AgentSpec,
    tags: a.tags as string[],
    verified: a.verified as boolean,
    attestationHash: a.attestation_hash as string | null,
    verifiedAt: a.verified_at as string | null,
    publishedAt: a.published_at as string,
  };
}

/**
 * Search the registry.
 */
export interface SearchOptions {
  q?: string;
  verifiedOnly?: boolean;
  limit?: number;
  offset?: number;
  registry?: string;
}

export interface SearchResult {
  agents: AgentRecord[];
  total: number;
  limit: number;
  offset: number;
}

export async function search(options?: SearchOptions): Promise<SearchResult> {
  const registry = options?.registry ?? DEFAULT_REGISTRY;
  const params = new URLSearchParams();
  if (options?.q) params.set('q', options.q);
  if (options?.verifiedOnly) params.set('verified', 'true');
  if (options?.limit != null) params.set('limit', String(options.limit));
  if (options?.offset != null) params.set('offset', String(options.offset));

  const res = await fetch(`${registry}/api/agents?${params}`);
  const data = await res.json() as {
    agents?: Record<string, unknown>[];
    total?: number;
    limit?: number;
    offset?: number;
    error?: string;
  };

  if (!res.ok) throw new Error(data.error ?? `Search failed (HTTP ${res.status})`);

  const agents: AgentRecord[] = (data.agents ?? []).map((a) => ({
    id: a.id as string,
    specId: a.spec_id as string,
    name: a.name as string,
    version: a.version as string,
    description: a.description as string | null,
    providerName: a.provider_name as string,
    endpointUrl: a.endpoint_url as string,
    spec: a.spec as AgentSpec,
    tags: a.tags as string[],
    verified: a.verified as boolean,
    attestationHash: a.attestation_hash as string | null,
    verifiedAt: a.verified_at as string | null,
    publishedAt: a.published_at as string,
  }));

  return {
    agents,
    total: data.total ?? 0,
    limit: data.limit ?? agents.length,
    offset: data.offset ?? 0,
  };
}

// ── AgentSpecClient class ─────────────────────────────────────────────────────

export interface ClientOptions {
  /** Registry base URL. Defaults to https://agentspec.dev */
  registry?: string;
  /** Default X-Agent-ID used for publish calls */
  agentId?: string;
}

/**
 * Convenience class for those who prefer an OOP interface.
 *
 * @example
 * const client = new AgentSpecClient({ agentId: 'my-agent@acme.com' });
 * const { valid } = client.validate(mySpec);
 * const { id } = await client.publish(mySpec);
 * const result = await client.verify(id, 'my-skill');
 */
export class AgentSpecClient {
  private registry: string;
  private agentId?: string;

  constructor(options?: ClientOptions) {
    this.registry = options?.registry ?? DEFAULT_REGISTRY;
    this.agentId = options?.agentId;
  }

  validate(spec: unknown): ValidateResult {
    return validate(spec);
  }

  async publish(spec: AgentSpec, agentId?: string): Promise<PublishResult> {
    const id = agentId ?? this.agentId;
    if (!id) throw new Error('agentId is required (pass it to the constructor or publish call)');
    return publish(spec, { registry: this.registry, agentId: id });
  }

  async verify(agentId: string, skillId: string): Promise<VerifyResult> {
    return verify(agentId, skillId, { registry: this.registry });
  }

  async getAgent(agentId: string): Promise<AgentRecord> {
    return getAgent(agentId, { registry: this.registry });
  }

  async search(options?: Omit<SearchOptions, 'registry'>): Promise<SearchResult> {
    return search({ ...options, registry: this.registry });
  }
}
