import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AgentRow } from '@/types/agent-spec';

export async function GET() {
  const supabase = await createClient();
  const { data: agents, count } = await supabase
    .from('agents')
    .select('*, skills(*)', { count: 'exact' })
    .order('published_at', { ascending: false })
    .limit(200);

  const now = new Date().toISOString();
  const lines: string[] = [
    '# AgentSpec Registry',
    `> schema: https://agentspec.dev/schema/v1.json`,
    `> updated: ${now}`,
    `> total: ${count ?? 0}`,
    '',
  ];

  for (const agent of (agents ?? []) as AgentRow[]) {
    const skillIds = agent.spec.skills.map((s) => s.id).join(', ');
    const tags = agent.tags.join(', ');

    // Summarise pricing from first skill that has it
    const pricingSkill = agent.spec.skills.find((s) => s.pricing);
    const pricingStr = pricingSkill?.pricing
      ? `${pricingSkill.pricing.amount} ${pricingSkill.pricing.currency}/${pricingSkill.pricing.model} via ${pricingSkill.pricing.protocol ?? 'none'}`
      : 'free';

    lines.push(`## ${agent.name} v${agent.version}`);
    lines.push(`id: ${agent.spec_id}`);
    lines.push(`endpoint: ${agent.endpoint_url}`);
    lines.push(
      `verified: ${agent.verified ? `YES (${agent.verified_at})` : 'NO'}`
    );
    lines.push(`skills: ${skillIds}`);
    if (tags) lines.push(`tags: ${tags}`);
    lines.push(`pricing: ${pricingStr}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
