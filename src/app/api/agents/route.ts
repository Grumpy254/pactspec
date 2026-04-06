import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { validateAgentSpec } from '@/lib/validator';
import { specsEqual } from '@/lib/spec-hash';
import type { AgentSpec } from '@/types/agent-spec';
import { sanitizeSearchQuery } from '@/lib/search-sanitize';
import { generatePublisherKey, hashKey } from '@/lib/publisher-keys';

function isAdminToken(req: NextRequest): boolean {
  const secret = process.env.PACTSPEC_PUBLISH_SECRET;
  if (!secret) return false;
  const token = req.headers.get('x-publish-token');
  if (!token || token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

// GET /api/agents?q=&tags=&verified=true
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') ?? '';
  const tagsParam = searchParams.get('tags');
  const verifiedParam = searchParams.get('verified');
  const pricingModel = searchParams.get('pricing_model');
  const rawMaxPrice = searchParams.get('max_price');
  const rawMinPassRate = searchParams.get('min_pass_rate');

  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 50, 100));
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  if (pricingModel && !['free', 'per-invocation', 'per-token', 'per-second'].includes(pricingModel)) {
    return NextResponse.json({ error: 'Invalid pricing_model' }, { status: 400 });
  }

  let maxPrice: number | null = null;
  if (rawMaxPrice != null) {
    const parsed = Number(rawMaxPrice);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json({ error: 'max_price must be a positive number' }, { status: 400 });
    }
    maxPrice = parsed;
  }
  let minPassRate: number | null = null;
  if (rawMinPassRate != null) {
    const parsed = Number(rawMinPassRate);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      return NextResponse.json({ error: 'min_pass_rate must be between 0 and 1' }, { status: 400 });
    }
    minPassRate = parsed;
  }
  const hasPricingFilter = Boolean(pricingModel) || maxPrice != null;

  const supabase = await createClient();
  let query = supabase
    .from('agents')
    .select(hasPricingFilter ? '*, skills!inner(*)' : '*', { count: 'exact' })
    .order('verified', { ascending: false })
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    const escaped = sanitizeSearchQuery(q);
    if (escaped) {
      query = query.or(
        `name.ilike.%${escaped}%,description.ilike.%${escaped}%,provider_name.ilike.%${escaped}%`
      );
    }
  }
  if (tagsParam) {
    const tags = tagsParam.split(',').map((t) => t.trim().replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50)).filter(Boolean);
    if (tags.length > 0) query = query.overlaps('tags', tags);
  }
  if (verifiedParam === 'true') {
    query = query.eq('verified', true);
  }
  if (pricingModel) {
    query = query.eq('skills.pricing_model', pricingModel);
  }
  if (maxPrice != null) {
    query = query.lte('skills.pricing_amount', maxPrice);
  }
  if (minPassRate != null) {
    query = query.gte('last_validation_pass_rate', minPassRate);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('GET /api/agents error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }

  return NextResponse.json(
    { agents: data, total: count, limit, offset },
    { headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=30' } }
  );
}

// POST /api/agents — publish new agent spec
export async function POST(req: NextRequest) {
  const agentIdHeader = req.headers.get('x-agent-id');
  if (!agentIdHeader) {
    return NextResponse.json({ error: 'X-Agent-ID header required' }, { status: 400 });
  }
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

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch (err) {
    console.error('Service client init failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // --- Publisher authentication ---
  const admin = isAdminToken(req);
  const publisherKeyHeader = req.headers.get('x-publisher-key');

  // Look up existing agent to check ownership
  const { data: existing, error: existingError } = await supabase
    .from('agents')
    .select('spec, verified, attestation_hash, verified_at, publisher_id')
    .eq('spec_id', spec.id)
    .maybeSingle();

  if (existingError) {
    console.error('Agent lookup failed:', existingError.message);
    return NextResponse.json({ error: 'Failed to check existing agent' }, { status: 500 });
  }

  let publisherId: string | null = null;
  let newPublisherKey: string | null = null;

  if (admin) {
    // Admin token bypasses publisher key requirement
    publisherId = existing?.publisher_id ?? null;
  } else if (publisherKeyHeader) {
    // Authenticate with publisher key
    const keyHash = hashKey(publisherKeyHeader);
    const { data: publisher } = await supabase
      .from('publishers')
      .select('id')
      .eq('api_key_hash', keyHash)
      .single();

    if (!publisher) {
      return NextResponse.json({ error: 'Invalid X-Publisher-Key' }, { status: 403 });
    }

    publisherId = publisher.id;

    // Ownership check: if agent exists and belongs to a different publisher, reject
    if (existing?.publisher_id && existing.publisher_id !== publisherId) {
      return NextResponse.json(
        { error: 'This agent is owned by another publisher. You can only update agents you published.' },
        { status: 403 }
      );
    }
  } else {
    // No key provided — create a new publisher
    if (existing?.publisher_id) {
      // Agent exists and has an owner — require their key
      return NextResponse.json(
        { error: 'This agent is owned by a publisher. Provide X-Publisher-Key header to update it.' },
        { status: 403 }
      );
    }

    // First-time publish: create publisher and return key
    const { rawKey, keyHash } = generatePublisherKey();
    const { data: newPublisher, error: pubError } = await supabase
      .from('publishers')
      .insert({ api_key_hash: keyHash, name: spec.provider.name })
      .select()
      .single();

    if (pubError || !newPublisher) {
      console.error('Failed to create publisher:', pubError?.message);
      return NextResponse.json({ error: 'Failed to create publisher' }, { status: 500 });
    }

    publisherId = newPublisher.id;
    newPublisherKey = rawKey;
  }

  // --- Build upsert payload ---
  let shouldResetVerification = false;
  try {
    shouldResetVerification = existing != null && !specsEqual(existing.spec as AgentSpec, spec);
  } catch (err) {
    console.error('specsEqual failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const upsertPayload: Record<string, unknown> = {
    spec_id: spec.id,
    name: spec.name,
    version: spec.version,
    description: spec.description ?? null,
    provider_name: spec.provider.name,
    provider_url: spec.provider.url ?? null,
    endpoint_url: spec.endpoint.url,
    spec: spec,
    tags: spec.tags ?? [],
    updated_at: new Date().toISOString(),
    publisher_id: publisherId,
  };

  if (spec.delegation?.delegatedFrom) {
    upsertPayload.delegated_from = spec.delegation.delegatedFrom;
  }

  if (shouldResetVerification) {
    upsertPayload.verified = false;
    upsertPayload.attestation_hash = null;
    upsertPayload.verified_at = null;
  }

  const { data: agent, error } = await supabase
    .from('agents')
    .upsert(upsertPayload, { onConflict: 'spec_id', ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    console.error('Agent upsert failed:', error.message);
    return NextResponse.json({ error: 'Failed to save agent' }, { status: 500 });
  }

  // Update normalized skills
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
    }));

    const { error: upsertError } = await supabase
      .from('skills')
      .upsert(skillRows, { onConflict: 'agent_id,skill_id' });
    if (upsertError) {
      console.error('Skill upsert failed:', upsertError.message);
      return NextResponse.json({ error: 'Failed to save skills' }, { status: 500 });
    }
    const currentSkillIds = spec.skills.map((s) => s.id);
    const { error: deleteError } = await supabase
      .from('skills')
      .delete()
      .eq('agent_id', agent.id)
      .not('skill_id', 'in', `(${currentSkillIds.map((id) => JSON.stringify(id)).join(',')})`);
    if (deleteError) {
      console.error('Failed to delete stale skills:', deleteError.message);
    }
  }

  // Build response — include publisher key on first publish
  const response: Record<string, unknown> = { agent };
  if (newPublisherKey) {
    response.publisherKey = newPublisherKey;
    response.message = 'Save this key — it is shown only once. You need it to update or republish this agent.';
  }

  return NextResponse.json(response, { status: 201 });
}
