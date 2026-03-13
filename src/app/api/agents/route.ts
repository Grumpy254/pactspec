import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { validateAgentSpec } from '@/lib/validator';
import { specsEqual } from '@/lib/spec-hash';
import type { AgentSpec } from '@/types/agent-spec';

// GET /api/agents?q=&tags=&verified=true
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') ?? '';
  const tagsParam = searchParams.get('tags');
  const verifiedParam = searchParams.get('verified');

  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);
  const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 50, 100);
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const supabase = await createClient();
  let query = supabase
    .from('agents')
    .select('*', { count: 'exact' })
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    // Keep only characters that cannot break PostgREST filter syntax.
    // Strips `.`, `(`, `)`, `,`, `*` which are PostgREST/LIKE metacharacters.
    const safe = q.replace(/[^a-zA-Z0-9 _\-@]/g, '').slice(0, 100);
    if (safe) {
      query = query.or(
        `name.ilike.%${safe}%,description.ilike.%${safe}%,provider_name.ilike.%${safe}%`
      );
    }
  }
  if (tagsParam) {
    const tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length > 0) query = query.overlaps('tags', tags);
  }
  if (verifiedParam === 'true') {
    query = query.eq('verified', true);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ agents: data, total: count, limit, offset });
}

// POST /api/agents — publish new agent spec
export async function POST(req: NextRequest) {
  const agentIdHeader = req.headers.get('x-agent-id');
  if (!agentIdHeader) {
    return NextResponse.json({ error: 'X-Agent-ID header required' }, { status: 401 });
  }
  // Basic format check — prevent trivially empty or oversized identifiers
  if (agentIdHeader.length < 4 || agentIdHeader.length > 128 || !/^[\w\-.@:]+$/.test(agentIdHeader)) {
    return NextResponse.json({ error: 'X-Agent-ID is invalid' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { valid, errors } = await validateAgentSpec(body);
  if (!valid) {
    return NextResponse.json({ error: 'Spec validation failed', errors }, { status: 400 });
  }

  const spec = body as AgentSpec;
  const supabase = createServiceRoleClient();

  const { data: existing, error: existingError } = await supabase
    .from('agents')
    .select('spec, verified, attestation_hash, verified_at')
    .eq('spec_id', spec.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const shouldResetVerification =
    existing != null && !specsEqual(existing.spec, spec);

  const upsertPayload: Record<string, unknown> = {
    spec_id: spec.id,
    name: spec.name,
    version: spec.version,
    description: spec.description ?? null,
    provider_name: spec.provider.name,
    provider_url: spec.provider.url ?? null,
    provider_did: spec.provider.did ?? null,
    endpoint_url: spec.endpoint.url,
    spec: spec,
    tags: spec.tags ?? [],
    updated_at: new Date().toISOString(),
  };

  if (shouldResetVerification) {
    upsertPayload.verified = false;
    upsertPayload.attestation_hash = null;
    upsertPayload.verified_at = null;
  }

  // Upsert agent — reset verification when spec changes
  const { data: agent, error } = await supabase
    .from('agents')
    .upsert(upsertPayload, { onConflict: 'spec_id', ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update normalized skills: upsert the new set (no duplicates via unique constraint),
  // then delete any rows that are no longer in the spec.
  if (agent && spec.skills.length > 0) {
    const skillRows = spec.skills.map((skill) => ({
      agent_id: agent.id,
      skill_id: skill.id,
      name: skill.name,
      description: skill.description ?? null,
      tags: skill.tags ?? [],
      input_schema: skill.inputSchema,
      output_schema: skill.outputSchema,
      pricing_model: skill.pricing?.model ?? null,
      pricing_amount: skill.pricing?.amount ?? null,
      pricing_currency: skill.pricing?.currency ?? null,
      pricing_protocol: skill.pricing?.protocol ?? null,
      test_suite_url: skill.testSuite?.url ?? null,
      sla_p99_ms: skill.sla?.p99LatencyMs ?? null,
      sla_uptime: skill.sla?.uptimeSLA ?? null,
    }));

    const { error: upsertError } = await supabase
      .from('skills')
      .upsert(skillRows, { onConflict: 'agent_id,skill_id' });
    if (upsertError) {
      return NextResponse.json({ error: 'Failed to save skills: ' + upsertError.message }, { status: 500 });
    }
    // Remove skills that were deleted from the spec
    await supabase
      .from('skills')
      .delete()
      .eq('agent_id', agent.id)
      .not('skill_id', 'in', `(${spec.skills.map((s) => `"${s.id}"`).join(',')})`);
  }

  return NextResponse.json({ agent }, { status: 201 });
}
