import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type {
  AgentRow,
  AgentSpecSkill,
  TestSuiteFile,
  TestResult,
  ValidationResult,
} from '@/types/agent-spec';
import { generateAttestationHash } from './attestation';

const ajv = new Ajv({ strict: false });
addFormats(ajv);

// ── SSRF protection ──────────────────────────────────────────────────────────
const BLOCKED_HOSTS = new Set([
  'localhost',
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  'metadata.google.internal',
  'metadata.google.internal.',
  '169.254.169.254',
]);

const BLOCKED_SUFFIXES = ['.local', '.internal'];

function ipv4ToInt(addr: string): number | null {
  const parts = addr.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isPrivateIpv4(addr: string): boolean {
  const int = ipv4ToInt(addr);
  if (int === null) return false;

  const inRange = (start: number, end: number) => int >= start && int <= end;
  return (
    inRange(0x0a000000, 0x0affffff) || // 10.0.0.0/8
    inRange(0x7f000000, 0x7fffffff) || // 127.0.0.0/8
    inRange(0xa9fe0000, 0xa9feffff) || // 169.254.0.0/16
    inRange(0xac100000, 0xac1fffff) || // 172.16.0.0/12
    inRange(0xc0a80000, 0xc0a8ffff) || // 192.168.0.0/16
    inRange(0x64400000, 0x647fffff) || // 100.64.0.0/10
    inRange(0xc0000000, 0xc00000ff) || // 192.0.0.0/24
    inRange(0xc0000200, 0xc00002ff) || // 192.0.2.0/24
    inRange(0xc6336400, 0xc63364ff) || // 198.51.100.0/24
    inRange(0xcb007100, 0xcb0071ff) || // 203.0.113.0/24
    inRange(0xc6120000, 0xc613ffff) || // 198.18.0.0/15
    inRange(0xe0000000, 0xffffffff) // multicast/reserved
  );
}

function isPrivateIpv6(addr: string): boolean {
  const normalized = addr.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true; // fe80::/10
  }
  if (normalized.startsWith('ff')) return true; // multicast
  if (normalized.startsWith('::ffff:')) {
    const ipv4 = normalized.slice('::ffff:'.length);
    return isPrivateIpv4(ipv4);
  }
  return false;
}

export function isPrivateIp(addr: string): boolean {
  const ipType = isIP(addr);
  if (ipType === 4) return isPrivateIpv4(addr);
  if (ipType === 6) return isPrivateIpv6(addr);
  return false;
}

function parseAllowlist(): string[] | null {
  const raw = process.env.VALIDATION_HOST_ALLOWLIST;
  if (!raw) return null;
  const hosts = raw.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  return hosts.length > 0 ? hosts : null;
}

function isHostAllowed(host: string, allowlist: string[]): boolean {
  return allowlist.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

async function resolveHost(host: string): Promise<string[]> {
  if (isIP(host)) return [host];
  const records = await lookup(host, { all: true });
  return records.map((record) => record.address);
}

export async function assertSafeUrl(rawUrl: string, label: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} must use http or https`);
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) throw new Error(`${label} must include a hostname`);
  if (BLOCKED_HOSTS.has(hostname) || BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error(`${label} host is not allowed`);
  }

  const allowlist = parseAllowlist();
  if (allowlist && !isHostAllowed(hostname, allowlist)) {
    throw new Error(`${label} host is not in allowlist`);
  }

  if (process.env.VALIDATION_ALLOW_PRIVATE_IPS === 'true') return;

  const addresses = await resolveHost(hostname);
  if (addresses.some((addr) => isPrivateIp(addr))) {
    throw new Error(`${label} resolves to a private or reserved address`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Resolve hostname to IP once, then fetch by IP to eliminate DNS rebinding window.
// The original Host header is preserved so the server can use virtual hosting.
async function resolveToIp(hostname: string, port: string, protocol: string): Promise<string> {
  if (isIP(hostname)) return hostname;
  const addresses = await resolveHost(hostname);
  const safe = addresses.find((a) => !isPrivateIp(a));
  if (!safe) throw new Error(`${hostname} resolves only to private addresses`);
  // Format IPv6 addresses with brackets
  return isIP(safe) === 6 ? `[${safe}]` : safe;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const parsed = new URL(url);
    const ip = await resolveToIp(parsed.hostname, parsed.port, parsed.protocol);
    const fetchUrl = `${parsed.protocol}//${ip}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}${parsed.search}`;
    const headers = new Headers(options.headers as HeadersInit | undefined);
    if (!headers.has('Host')) headers.set('Host', parsed.hostname);
    return await fetch(fetchUrl, { ...options, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function runValidation(
  agent: AgentRow,
  skillId: string
): Promise<ValidationResult> {
  const startTotal = Date.now();

  const skill: AgentSpecSkill | undefined = agent.spec.skills.find(
    (s) => s.id === skillId
  );
  if (!skill) {
    return { status: 'ERROR', results: [], durationMs: 0, error: `Skill '${skillId}' not found` };
  }

  if (!skill.testSuite?.url) {
    return { status: 'ERROR', results: [], durationMs: 0, error: 'Skill has no testSuite.url' };
  }

  // SSRF guard — check both URLs before making any network calls
  try {
    await assertSafeUrl(skill.testSuite.url, 'testSuite.url');
    await assertSafeUrl(agent.endpoint_url, 'endpoint.url');
  } catch (err) {
    return {
      status: 'ERROR',
      results: [],
      durationMs: Date.now() - startTotal,
      error: (err as Error).message,
    };
  }

  // Fetch test suite
  let suite: TestSuiteFile;
  try {
    const res = await fetchWithTimeout(skill.testSuite.url, {}, 10_000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    suite = await res.json();
  } catch (err) {
    return {
      status: 'ERROR',
      results: [],
      durationMs: Date.now() - startTotal,
      error: `Failed to fetch testSuite: ${(err as Error).message}`,
    };
  }

  const results: TestResult[] = [];

  for (const test of suite.tests) {
    const startMs = Date.now();
    const timeoutMs = test.timeoutMs ?? 15_000;

    try {
      const res = await fetchWithTimeout(
        agent.endpoint_url,
        {
          method: test.request.method ?? 'POST',
          headers: { 'Content-Type': 'application/json', ...(test.request.headers ?? {}) },
          body: test.request.body != null ? JSON.stringify(test.request.body) : undefined,
        },
        timeoutMs
      );

      const durationMs = Date.now() - startMs;
      const statusOk = res.status === test.expect.status;

      let schemaOk = true;
      let schemaError: string | undefined;

      if (test.expect.outputSchema && res.ok) {
        let body: unknown;
        try {
          body = await res.json();
        } catch {
          schemaOk = false;
          schemaError = 'Response body is not valid JSON';
        }
        if (schemaOk && body !== undefined) {
          const validate = ajv.compile(test.expect.outputSchema);
          schemaOk = validate(body) as boolean;
          if (!schemaOk) {
            schemaError = ajv.errorsText(validate.errors);
          }
        }
      }

      results.push({
        testId: test.id,
        passed: statusOk && schemaOk,
        durationMs,
        statusCode: res.status,
        error: !statusOk
          ? `Expected status ${test.expect.status}, got ${res.status}`
          : schemaError,
      });
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const isTimeout = (err as Error).name === 'AbortError';
      results.push({
        testId: test.id,
        passed: false,
        durationMs,
        error: isTimeout ? `Timeout after ${timeoutMs}ms` : (err as Error).message,
      });
    }
  }

  const allPassed = results.every((r) => r.passed);
  const timestamp = new Date().toISOString();
  const attestationHash = allPassed
    ? generateAttestationHash(agent.id, skillId, results, timestamp)
    : undefined;

  return {
    status: allPassed ? 'PASSED' : 'FAILED',
    results,
    attestationHash,
    durationMs: Date.now() - startTotal,
  };
}

// Validate an AgentSpec document against the canonical JSON Schema
export async function validateAgentSpec(spec: unknown): Promise<{ valid: boolean; errors: string[] }> {
  const schema = (await import('./schema/agent-spec.v1.json')).default;
  const validate = ajv.compile(schema);
  const valid = validate(spec) as boolean;
  return {
    valid,
    errors: valid ? [] : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`),
  };
}
