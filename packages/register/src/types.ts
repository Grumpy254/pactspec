/**
 * Configuration types for @pactspec/register.
 */

export interface PactSpecRegisterOptions {
  /** Human-readable name of the agent. */
  name: string;

  /** At least one skill the agent exposes. */
  skills: SkillConfig[];

  provider?: { name: string; url?: string; contact?: string };

  /** Semver version string. Default: `'1.0.0'` */
  version?: string;

  /** Short description. Auto-generated from skills when omitted. */
  description?: string;

  tags?: string[];

  /** Registry URL. Default: `'https://pactspec.dev'`, or `PACTSPEC_REGISTRY` env. */
  registry?: string;

  /** Unique agent identifier. Default: derived from provider name + agent name. */
  agentId?: string;

  /** Publish token. Falls back to `PACTSPEC_PUBLISH_TOKEN` env. */
  publishToken?: string;

  /** Whether to publish at all. Default: `true`. Set `false` for tests. */
  autoPublish?: boolean;

  /** Publish as soon as the server starts listening. Default: `true`. */
  publishOnStart?: boolean;

  /** Re-publish interval in ms. `0` means never. Default: `0`. */
  republishInterval?: number;

  /** Public base URL of the server. Auto-detected from the first request when omitted. */
  baseUrl?: string;

  /** Auth scheme advertised in the spec. Default: `{ type: 'none' }`. */
  auth?: { type: 'none' | 'bearer' | 'x-agent-id' | 'header'; name?: string };
}

export interface SkillConfig {
  id: string;
  name: string;
  description: string;
  /** Express route path (e.g. `'/api/process'`). */
  path: string;
  /** HTTP method. Default: `'POST'`. */
  method?: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  pricing?: {
    model: string;
    amount: number;
    currency: string;
    protocol?: string;
  };
  /** Remote test suite URL for validation. */
  testSuite?: { url: string };
  tags?: string[];
}

/** Minimal Express-compatible Request. */
export interface MinimalRequest {
  method?: string;
  url?: string;
  path?: string;
  protocol?: string;
  get?: (name: string) => string | undefined;
  headers?: Record<string, string | string[] | undefined>;
}

/** Minimal Express-compatible Response. */
export interface MinimalResponse {
  writeHead(statusCode: number, headers?: Record<string, string>): this;
  end(body?: string): void;
  setHeader?(name: string, value: string): void;
  json?(body: unknown): void;
  status?(code: number): MinimalResponse;
}

export type NextFunction = (err?: unknown) => void;

export interface PublishResult {
  success: boolean;
  agentUrl?: string;
  error?: string;
}
