import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sanitizeSearchQuery } from '@/lib/search-sanitize';
import { generatePublisherKey, hashKey } from '@/lib/publisher-keys';

function isAdminToken(req: NextRequest): boolean {
  const secret = process.env.PACTSPEC_PUBLISH_SECRET;
  if (!secret) return false;
  const token = req.headers.get('x-publish-token');
  if (!token || token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

// GET /api/benchmarks?domain=medical-coding
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const domain = searchParams.get('domain');
  const q = searchParams.get('q') ?? '';

  const supabase = await createClient();
  let query = supabase
    .from('benchmarks')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (domain) {
    query = query.eq('domain', domain);
  }
  if (q) {
    const escaped = sanitizeSearchQuery(q);
    if (escaped) {
      query = query.or(
        `name.ilike.%${escaped}%,description.ilike.%${escaped}%,publisher.ilike.%${escaped}%`
      );
    }
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('GET /api/benchmarks error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch benchmarks' }, { status: 500 });
  }

  return NextResponse.json(
    { benchmarks: data, total: count },
    { headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=30' } }
  );
}

// POST /api/benchmarks — publish a new benchmark
export async function POST(req: NextRequest) {
  let body: {
    benchmarkId?: string;
    name?: string;
    description?: string;
    domain?: string;
    version?: string;
    publisher?: string;
    publisherUrl?: string;
    testSuiteUrl?: string;
    testCount?: number;
    skill?: string;
    source?: string;
    sourceDescription?: string;
    sourceUrl?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  const required = ['benchmarkId', 'name', 'domain', 'version', 'publisher', 'testSuiteUrl', 'testCount', 'skill'] as const;
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  if (typeof body.testCount !== 'number' || body.testCount < 1) {
    return NextResponse.json({ error: 'testCount must be a positive number' }, { status: 400 });
  }

  // Validate URL format
  try {
    const url = new URL(body.testSuiteUrl!);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Must use http or https');
    }
  } catch {
    return NextResponse.json({ error: 'testSuiteUrl must be a valid HTTP(S) URL' }, { status: 400 });
  }

  // Validate source if provided
  const validSources = ['synthetic', 'peer-reviewed', 'industry-standard', 'community'];
  if (body.source && !validSources.includes(body.source)) {
    return NextResponse.json({ error: `source must be one of: ${validSources.join(', ')}` }, { status: 400 });
  }

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

  // Check if benchmark already exists
  const { data: existing } = await supabase
    .from('benchmarks')
    .select('publisher_id')
    .eq('benchmark_id', body.benchmarkId)
    .maybeSingle();

  let publisherId: string | null = null;
  let newPublisherKey: string | null = null;

  if (admin) {
    publisherId = existing?.publisher_id ?? null;
  } else if (publisherKeyHeader) {
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

    if (existing?.publisher_id && existing.publisher_id !== publisherId) {
      return NextResponse.json(
        { error: 'This benchmark is owned by another publisher.' },
        { status: 403 }
      );
    }
  } else {
    if (existing?.publisher_id) {
      return NextResponse.json(
        { error: 'This benchmark is owned by a publisher. Provide X-Publisher-Key header to update it.' },
        { status: 403 }
      );
    }

    const { rawKey, keyHash } = generatePublisherKey();
    const { data: newPublisher, error: pubError } = await supabase
      .from('publishers')
      .insert({ api_key_hash: keyHash, name: body.publisher! })
      .select()
      .single();

    if (pubError || !newPublisher) {
      console.error('Failed to create publisher:', pubError?.message);
      return NextResponse.json({ error: 'Failed to create publisher' }, { status: 500 });
    }

    publisherId = newPublisher.id;
    newPublisherKey = rawKey;
  }

  const { data, error } = await supabase
    .from('benchmarks')
    .upsert(
      {
        benchmark_id: body.benchmarkId,
        name: body.name,
        description: body.description ?? null,
        domain: body.domain,
        version: body.version,
        publisher: body.publisher,
        publisher_url: body.publisherUrl ?? null,
        test_suite_url: body.testSuiteUrl,
        test_count: body.testCount,
        skill: body.skill,
        source: body.source ?? 'community',
        source_description: body.sourceDescription ?? null,
        source_url: body.sourceUrl ?? null,
        publisher_id: publisherId,
      },
      { onConflict: 'benchmark_id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    console.error('Benchmark upsert failed:', error.message);
    return NextResponse.json({ error: 'Failed to save benchmark' }, { status: 500 });
  }

  const response: Record<string, unknown> = { benchmark: data };
  if (newPublisherKey) {
    response.publisherKey = newPublisherKey;
    response.message = 'Save this key — it is shown only once. You need it to update this benchmark.';
  }

  return NextResponse.json(response, { status: 201 });
}
