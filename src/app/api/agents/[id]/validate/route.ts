import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { runValidation } from '@/lib/validator';
import type { AgentRow } from '@/types/agent-spec';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { skillId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.skillId !== 'string' || !body.skillId.trim()) {
    return NextResponse.json({ error: 'skillId is required and must be a non-empty string' }, { status: 400 });
  }

  const supabase = await createClient();      // reads
  const adminDb = createServiceRoleClient(); // writes

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
  let decodedId = id;
  if (!isUuid) {
    try { decodedId = decodeURIComponent(id); } catch {
      return NextResponse.json({ error: 'Invalid agent ID encoding' }, { status: 400 });
    }
  }
  const { data: agent, error } = isUuid
    ? await supabase.from('agents').select('*').eq('id', id).single()
    : await supabase.from('agents').select('*').eq('spec_id', decodedId).single();

  if (error || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Rate limit: one validation run per agent per 60 seconds
  const cooldownSince = new Date(Date.now() - 60_000).toISOString();
  const { count: recentRuns } = await adminDb
    .from('validation_runs')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agent.id)
    .gte('created_at', cooldownSince);
  if ((recentRuns ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Rate limit: one validation run per agent per minute' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  // Insert run record — capture insert error so we can still return a result
  const { data: run, error: runInsertError } = await adminDb
    .from('validation_runs')
    .insert({ agent_id: agent.id, skill_id: body.skillId, status: 'RUNNING' })
    .select()
    .single();

  if (runInsertError) {
    return NextResponse.json({ error: 'Failed to create validation run' }, { status: 500 });
  }

  let result;
  try {
    result = await runValidation(agent as AgentRow, body.skillId);
  } catch (err) {
    // Ensure run is never left in RUNNING state
    await adminDb
      .from('validation_runs')
      .update({ status: 'ERROR', error: (err as Error).message })
      .eq('id', run.id);
    return NextResponse.json({ error: 'Validation failed unexpectedly' }, { status: 500 });
  }

  const testCount = result.results.length;
  const passedCount = result.results.filter((r) => r.passed).length;
  const passRate = testCount > 0 ? passedCount / testCount : null;

  // Update run record
  const { error: runUpdateError } = await adminDb
    .from('validation_runs')
    .update({
      status: result.status,
      test_results: result.results,
      test_count: testCount,
      passed_count: passedCount,
      pass_rate: passRate,
      duration_ms: result.durationMs,
      error: result.error ?? null,
      attestation_hash: result.attestationHash ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', run.id);
  if (runUpdateError) {
    console.error('Failed to update validation run:', runUpdateError.message);
  }

  const now = new Date().toISOString();
  const agentUpdate: Record<string, unknown> = {
    last_validation_pass_rate: passRate,
    last_validation_test_count: testCount,
    last_validation_at: now,
    updated_at: now,
  };

  // If passed, mark agent verified with signature
  if (result.status === 'PASSED' && result.signature) {
    agentUpdate.verified = true;
    agentUpdate.attestation_hash = result.contentHash;
    agentUpdate.signature = result.signature;
    agentUpdate.verified_at = now;
  }
  const { error: agentUpdateError } = await adminDb.from('agents').update(agentUpdate).eq('id', agent.id);
  if (agentUpdateError) {
    console.error('Failed to update agent:', agentUpdateError.message);
  }

  // Prune old validation runs (fire-and-forget with error logging)
  adminDb.rpc('purge_old_validation_runs', { keep_per_agent: 20, max_age_days: 90 })
    .then(() => {}, (err) => console.error('Purge failed:', err));

  return NextResponse.json({ runId: run.id, ...result });
}
