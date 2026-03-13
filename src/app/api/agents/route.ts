import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateAgentSpec } from '@/lib/validator';
import type { AgentSpec } from '@/types/agent-spec';

// GET /api/agents?q=&tags=&verified=true
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') ?? '';
  const tagsParam = searchParams.get('tags');
  const verifiedParam = searchParams.get('verified');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const supabase = await createClient();
  let query = supabase
    .from('agents')
    .select('*', { count: 'exact' })
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,provider_name.ilike.%${q}%`);
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
  // Basic auth — X-Agent-ID header required
  const agentIdHeader = req.headers.get('x-agent-id');
  if (!agentIdHeader) {
    return NextResponse.json({ error: 'X-Agent-ID header required' }, { status: 401 });
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
  const supabase = await createClient();

  // Upsert agent
  const { data: agent, error } = await supabase
    .from('agents')
    .upsert(
      {
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
      },
      { onConflict: 'spec_id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Upsert normalized skills
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

    // Delete old skills first then insert fresh
    await supabase.from('skills').delete().eq('agent_id', agent.id);
    await supabase.from('skills').insert(skillRows);
  }

  return NextResponse.json({ agent }, { status: 201 });
}
