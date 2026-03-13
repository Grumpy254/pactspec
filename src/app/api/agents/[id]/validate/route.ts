import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = await createClient();

  const isUuid = /^[0-9a-f-]{36}$/.test(id);
  const { data: agent, error } = isUuid
    ? await supabase.from('agents').select('*').eq('id', id).single()
    : await supabase.from('agents').select('*').eq('spec_id', decodeURIComponent(id)).single();

  if (error || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Insert pending run
  const { data: run } = await supabase
    .from('validation_runs')
    .insert({ agent_id: agent.id, skill_id: body.skillId, status: 'RUNNING' })
    .select()
    .single();

  const result = await runValidation(agent as AgentRow, body.skillId);

  // Update run record
  await supabase
    .from('validation_runs')
    .update({
      status: result.status,
      test_results: result.results,
      duration_ms: result.durationMs,
      error: result.error ?? null,
      attestation_hash: result.attestationHash ?? null,
    })
    .eq('id', run?.id);

  // If passed, mark agent verified
  if (result.status === 'PASSED' && result.attestationHash) {
    await supabase
      .from('agents')
      .update({
        verified: true,
        attestation_hash: result.attestationHash,
        verified_at: new Date().toISOString(),
      })
      .eq('id', agent.id);
  }

  return NextResponse.json({ runId: run?.id, ...result });
}
