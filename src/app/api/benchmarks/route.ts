import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sanitizeSearchQuery } from '@/lib/search-sanitize';

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
  const publisherId = req.headers.get('x-agent-id');
  if (!publisherId) {
    return NextResponse.json({ error: 'X-Agent-ID header required' }, { status: 400 });
  }
  if (publisherId.length < 2 || publisherId.length > 128) {
    return NextResponse.json({ error: 'X-Agent-ID is invalid' }, { status: 400 });
  }

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

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch (err) {
    console.error('Service client init failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      },
      { onConflict: 'benchmark_id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    console.error('Benchmark upsert failed:', error.message);
    return NextResponse.json({ error: 'Failed to save benchmark' }, { status: 500 });
  }

  return NextResponse.json({ benchmark: data }, { status: 201 });
}
