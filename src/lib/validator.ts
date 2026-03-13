import Ajv from 'ajv';
import addFormats from 'ajv-formats';
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

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
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
