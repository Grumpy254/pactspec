import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AgentRow } from '@/types/agent-spec';

// Strip newlines and escape characters that could break markdown structure
// or be interpreted as markdown syntax by downstream renderers.
function escapeMd(s: string): string {
  return s
    .replace(/[\r\n\t]/g, ' ')         // collapse whitespace
    .replace(/[`[\]\\]/g, (c) => `\\${c}`) // escape backtick, brackets, backslash
    .replace(/\s+/g, ' ')              // collapse multiple spaces
    .trim();
}

export async function GET() {
  const supabase = await createClient();
  const { data: agents, count, error } = await supabase
    .from('agents')
    .select('*, skills(*)', { count: 'exact' })
    .order('published_at', { ascending: false })
    .limit(200);

  if (error) {
    return new NextResponse(`# Registry unavailable\n\nFailed to load agents: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  const now = new Date().toISOString();
  const lines: string[] = [
    '# AgentSpec Registry',
    `> schema: https://agentspec.dev/schema/v1.json`,
    `> updated: ${now}`,
    `> total: ${count ?? 0}`,
    '',
  ];

  for (const agent of (agents ?? []) as AgentRow[]) {
    const skillIds = agent.spec.skills.map((s) => escapeMd(s.id)).join(', ');
    const tags = agent.tags.map(escapeMd).join(', ');

    // Summarise pricing from first skill that has it
    const pricingSkill = agent.spec.skills.find((s) => s.pricing);
    const pricingStr = pricingSkill?.pricing
      ? `${pricingSkill.pricing.amount} ${escapeMd(pricingSkill.pricing.currency)}/${escapeMd(pricingSkill.pricing.model)} via ${escapeMd(pricingSkill.pricing.protocol ?? 'none')}`
      : 'free';

    lines.push(`## ${escapeMd(agent.name)} v${escapeMd(agent.version)}`);
    lines.push(`id: ${escapeMd(agent.spec_id)}`);
    lines.push(`endpoint: ${escapeMd(agent.endpoint_url)}`);
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
