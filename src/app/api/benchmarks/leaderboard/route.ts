import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/benchmarks/leaderboard?benchmarkId=<id>
export async function GET(req: NextRequest) {
  const benchmarkId = req.nextUrl.searchParams.get('benchmarkId');
  if (!benchmarkId) {
    return NextResponse.json({ error: 'benchmarkId query param required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch results with agent info
  const { data: results, error } = await supabase
    .from('benchmark_results')
    .select('*, agents!inner(name, provider_name, verified, spec_id)')
    .eq('benchmark_id', benchmarkId)
    .order('score', { ascending: false });

  if (error) {
    console.error('GET /api/benchmarks/leaderboard error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }

  // Reshape: move agents join into an `agent` field
  const entries = (results ?? []).map((r: Record<string, unknown>) => {
    const { agents, ...rest } = r;
    return { ...rest, agent: agents };
  });

  return NextResponse.json(
    { entries },
    { headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=30' } }
  );
}
