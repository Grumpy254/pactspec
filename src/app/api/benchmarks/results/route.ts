import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/benchmarks/results?agentId=<uuid>&benchmarkId=<id>
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const agentId = searchParams.get('agentId');
  const benchmarkId = searchParams.get('benchmarkId');

  if (!agentId && !benchmarkId) {
    return NextResponse.json({ error: 'agentId or benchmarkId query param required' }, { status: 400 });
  }

  const supabase = await createClient();

  let query = supabase
    .from('benchmark_results')
    .select('*, benchmarks!inner(name, domain, publisher, version, test_count)')
    .order('score', { ascending: false });

  if (agentId) {
    query = query.eq('agent_id', agentId);
  }
  if (benchmarkId) {
    query = query.eq('benchmark_id', benchmarkId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('GET /api/benchmarks/results error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch benchmark results' }, { status: 500 });
  }

  return NextResponse.json(
    { results: data },
    { headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=30' } }
  );
}
