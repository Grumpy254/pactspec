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

  if (!body.skillId) {
    return NextResponse.json({ error: 'skillId is required' }, { status: 400 });
  }

  const supabase = await createClient();      // reads
  const adminDb = createServiceRoleClient(); // writes

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
  const { data: agent, error } = isUuid
    ? await supabase.from('agents').select('*').eq('id', id).single()
    : await supabase.from('agents').select('*').eq('spec_id', decodeURIComponent(id)).single();

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
      { status: 429 }
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

  // Update run record
  await adminDb
    .from('validation_runs')
    .update({
      status: result.status,
      test_results: result.results,
      duration_ms: result.durationMs,
      error: result.error ?? null,
      attestation_hash: result.attestationHash ?? null,
    })
    .eq('id', run.id);

  // If passed, mark agent verified
  if (result.status === 'PASSED' && result.attestationHash) {
    await adminDb
      .from('agents')
      .update({
        verified: true,
        attestation_hash: result.attestationHash,
        verified_at: new Date().toISOString(),
      })
      .eq('id', agent.id);
  }

  return NextResponse.json({ runId: run.id, ...result });
}
