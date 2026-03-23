import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/agents/[id]/pricing-checks
 * Returns the latest pricing check per skill for a given agent.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();

  // Resolve agent UUID (support both UUID and spec_id)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
  let agentId = id;

  if (!isUuid) {
    let decodedId: string;
    try {
      decodedId = decodeURIComponent(id);
    } catch {
      return NextResponse.json({ error: 'Invalid agent ID encoding' }, { status: 400 });
    }
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('spec_id', decodedId)
      .single();
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    agentId = agent.id;
  }

  // Fetch the most recent pricing check per skill using DISTINCT ON
  const { data: checks, error } = await supabase
    .from('pricing_checks')
    .select('skill_id, declared_amount, declared_currency, actual_amount, actual_currency, match, drift_percentage, checked_at')
    .eq('agent_id', agentId)
    .order('checked_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch pricing checks' }, { status: 500 });
  }

  // Deduplicate to latest per skill (client-side since Supabase JS doesn't support DISTINCT ON)
  const seen = new Set<string>();
  const latest = (checks ?? []).filter((c) => {
    if (seen.has(c.skill_id)) return false;
    seen.add(c.skill_id);
    return true;
  });

  return NextResponse.json({ checks: latest });
}
