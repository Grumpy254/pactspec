import { NextRequest, NextResponse } from 'next/server';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { assertSafeUrl } from '@/lib/validator';
import { fetch as undiciFetch, Agent } from 'undici';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { isPrivateIp } from '@/lib/validator';
import { generateAttestationHash } from '@/lib/attestation';
import type { AgentRow, TestCase, TestSuiteFile, TestResult } from '@/types/agent-spec';

const ajv = new Ajv({ strict: false });
addFormats(ajv);

const MAX_SUITE_BYTES = 1_048_576; // 1 MB
const MAX_TESTS = 200; // benchmarks can be larger than skill test suites

async function resolveSafeIp(hostname: string): Promise<string> {
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error(`Direct IP ${hostname} is not allowed`);
    return hostname;
  }
  const records = await lookup(hostname, { all: true });
  const addresses = records.map((r) => r.address);
  const safe = addresses.find((a) => !isPrivateIp(a));
  if (!safe) throw new Error(`${hostname} resolves only to private addresses`);
  return safe;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const parsed = new URL(url);
    const pinnedIp = await resolveSafeIp(parsed.hostname);
    const family = isIP(pinnedIp) === 6 ? 6 : 4;

    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, _opts, cb) => {
          cb(null, [{ address: pinnedIp, family }]);
        },
      },
    });

    return await undiciFetch(url, {
      method: (options as RequestInit).method,
      headers: (options as RequestInit).headers as Record<string, string> | undefined,
      body: (options as RequestInit).body as string | undefined,
      signal: controller.signal,
      redirect: 'error',
      dispatcher,
    }) as unknown as Response;
  } finally {
    clearTimeout(timer);
  }
}

function runSingleTest(
  test: TestCase,
  responseStatus: number,
  responseBody: unknown,
): { passed: boolean; error?: string } {
  // Check status code
  if (responseStatus !== test.expect.status) {
    return { passed: false, error: `Expected status ${test.expect.status}, got ${responseStatus}` };
  }

  // Check output schema
  if (test.expect.outputSchema) {
    const validate = ajv.compile(test.expect.outputSchema);
    const valid = validate(responseBody) as boolean;
    if (!valid) {
      return {
        passed: false,
        error: `Schema validation failed: ${ajv.errorsText(validate.errors)}`,
      };
    }
  }

  return { passed: true };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: benchmarkId } = await params;

  let body: { agentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.agentId !== 'string' || !body.agentId.trim()) {
    return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
  }

  const supabase = await createClient();
  const adminDb = createServiceRoleClient();

  // Fetch the benchmark
  const { data: benchmark, error: bmError } = await supabase
    .from('benchmarks')
    .select('*')
    .eq('benchmark_id', benchmarkId)
    .single();

  if (bmError || !benchmark) {
    return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 });
  }

  // Fetch the agent
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(body.agentId);
  const agentQuery = isUuid
    ? supabase.from('agents').select('*').eq('id', body.agentId).single()
    : supabase.from('agents').select('*').eq('spec_id', body.agentId).single();

  const { data: agent, error: agentError } = await agentQuery;
  if (agentError || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const agentRow = agent as AgentRow;

  // Rate limit: one benchmark run per agent per 60 seconds
  const cooldownSince = new Date(Date.now() - 60_000).toISOString();
  const { count: recentRuns } = await adminDb
    .from('benchmark_results')
    .select('id', { count: 'exact', head: true })
    .eq('benchmark_id', benchmarkId)
    .eq('agent_id', agentRow.id)
    .gte('run_at', cooldownSince);

  if ((recentRuns ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Rate limit: one benchmark run per agent per minute' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  // SSRF guard
  try {
    await assertSafeUrl(benchmark.test_suite_url, 'testSuiteUrl');
    await assertSafeUrl(agentRow.endpoint_url, 'endpoint.url');
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  // Fetch test suite
  let suite: TestSuiteFile;
  try {
    const res = await fetchWithTimeout(benchmark.test_suite_url, {}, 15_000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_SUITE_BYTES) {
      throw new Error(`Test suite exceeds ${MAX_SUITE_BYTES / 1024}KB limit`);
    }
    suite = JSON.parse(text) as TestSuiteFile;
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch test suite: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  if (!Array.isArray(suite.tests) || suite.tests.length === 0) {
    return NextResponse.json({ error: 'Test suite has no tests' }, { status: 400 });
  }
  if (suite.tests.length > MAX_TESTS) {
    return NextResponse.json(
      { error: `Test suite exceeds ${MAX_TESTS} test limit (got ${suite.tests.length})` },
      { status: 400 }
    );
  }

  // Run each test
  const results: (TestResult & { description?: string })[] = [];
  const startTotal = Date.now();

  for (const test of suite.tests) {
    const startMs = Date.now();
    const timeoutMs = Math.min(test.timeoutMs ?? 15_000, 30_000);

    try {
      const res = await fetchWithTimeout(
        agentRow.endpoint_url,
        {
          method: test.request.method ?? 'POST',
          headers: { 'Content-Type': 'application/json', ...(test.request.headers ?? {}) },
          body: test.request.body != null ? JSON.stringify(test.request.body) : undefined,
        },
        timeoutMs
      );

      const durationMs = Date.now() - startMs;

      let responseBody: unknown;
      try {
        responseBody = await res.json();
      } catch {
        responseBody = undefined;
      }

      const { passed, error } = runSingleTest(test, res.status, responseBody);

      results.push({
        testId: test.id,
        description: test.description,
        passed,
        durationMs,
        statusCode: res.status,
        error,
      });
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const isTimeout = (err as Error).name === 'AbortError';
      results.push({
        testId: test.id,
        description: test.description,
        passed: false,
        durationMs,
        error: isTimeout ? `Timeout after ${timeoutMs}ms` : (err as Error).message,
      });
    }
  }

  const totalDurationMs = Date.now() - startTotal;
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const score = totalCount > 0 ? passedCount / totalCount : 0;

  // Generate attestation hash
  const timestamp = new Date().toISOString();
  const attestationHash = generateAttestationHash(
    agentRow.id,
    `benchmark:${benchmarkId}`,
    results.map(({ testId, passed, durationMs, error, statusCode }) => ({
      testId,
      passed,
      durationMs,
      error,
      statusCode,
    })),
    timestamp
  );

  // Upsert result
  const { data: resultRow, error: upsertError } = await adminDb
    .from('benchmark_results')
    .upsert(
      {
        benchmark_id: benchmarkId,
        agent_id: agentRow.id,
        score,
        passed_count: passedCount,
        total_count: totalCount,
        attestation_hash: attestationHash,
        run_at: timestamp,
      },
      { onConflict: 'benchmark_id,agent_id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (upsertError) {
    console.error('Benchmark result upsert failed:', upsertError.message);
    return NextResponse.json({ error: 'Failed to save benchmark result' }, { status: 500 });
  }

  return NextResponse.json({
    resultId: resultRow.id,
    benchmarkId,
    agentId: agentRow.id,
    score,
    passedCount,
    totalCount,
    attestationHash,
    durationMs: totalDurationMs,
    results,
  });
}
