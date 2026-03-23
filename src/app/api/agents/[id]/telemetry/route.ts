import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { AgentRow } from '@/types/agent-spec';

const VALID_STATUSES = ['success', 'failure', 'timeout', 'error'] as const;
const RATE_LIMIT_MAX = 100; // max events per agent per minute

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { skillId?: string; status?: string; latencyMs?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate skillId
  if (typeof body.skillId !== 'string' || !body.skillId.trim()) {
    return NextResponse.json({ error: 'skillId is required and must be a non-empty string' }, { status: 400 });
  }

  // Validate status
  if (!body.status || !VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate latencyMs
  if (body.latencyMs !== undefined && body.latencyMs !== null) {
    if (!Number.isInteger(body.latencyMs) || body.latencyMs <= 0) {
      return NextResponse.json({ error: 'latencyMs must be a positive integer' }, { status: 400 });
    }
  }

  // Look up agent (UUID or spec_id — same pattern as validate route)
  const supabase = await createClient();
  const adminDb = createServiceRoleClient();

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

  // Rate limit: max 100 events per agent per minute
  const cooldownSince = new Date(Date.now() - 60_000).toISOString();
  const { count: recentEvents } = await adminDb
    .from('telemetry_events')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agent.id)
    .gte('reported_at', cooldownSince);

  if ((recentEvents ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: `Rate limit: max ${RATE_LIMIT_MAX} telemetry events per agent per minute` },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  // Insert telemetry event
  const { error: insertError } = await adminDb
    .from('telemetry_events')
    .insert({
      agent_id: agent.id,
      skill_id: body.skillId.trim(),
      status: body.status,
      latency_ms: body.latencyMs ?? null,
    });

  if (insertError) {
    console.error('Failed to insert telemetry event:', insertError.message);
    return NextResponse.json({ error: 'Failed to record telemetry' }, { status: 500 });
  }

  // Fire-and-forget: recompute agent telemetry summary
  adminDb.rpc('compute_agent_telemetry', { target_agent_id: agent.id })
    .then(() => {}, (err) => console.error('Telemetry recompute failed:', err));

  return NextResponse.json({ recorded: true });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
  let decodedId = id;
  if (!isUuid) {
    try { decodedId = decodeURIComponent(id); } catch {
      return NextResponse.json({ error: 'Invalid agent ID encoding' }, { status: 400 });
    }
  }

  const { data: agent, error } = isUuid
    ? await supabase
        .from('agents')
        .select('telemetry_success_rate_24h, telemetry_success_rate_7d, telemetry_success_rate_30d, telemetry_latency_p50_ms, telemetry_latency_p95_ms, telemetry_total_invocations, telemetry_updated_at')
        .eq('id', id)
        .single()
    : await supabase
        .from('agents')
        .select('telemetry_success_rate_24h, telemetry_success_rate_7d, telemetry_success_rate_30d, telemetry_latency_p50_ms, telemetry_latency_p95_ms, telemetry_total_invocations, telemetry_updated_at')
        .eq('spec_id', decodedId)
        .single();

  if (error || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      successRate24h: agent.telemetry_success_rate_24h,
      successRate7d: agent.telemetry_success_rate_7d,
      successRate30d: agent.telemetry_success_rate_30d,
      latencyP50Ms: agent.telemetry_latency_p50_ms,
      latencyP95Ms: agent.telemetry_latency_p95_ms,
      totalInvocations: agent.telemetry_total_invocations,
      updatedAt: agent.telemetry_updated_at,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=60',
      },
    }
  );
}
