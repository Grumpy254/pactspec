import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerificationAge } from '@/lib/trust-tier';

// Approximate character width for DejaVu Sans at 11px
function textWidth(text: string): number {
  // ~6.5px per character is a good approximation for shields.io style badges
  return Math.round(text.length * 6.5 + 10);
}

function generateBadgeSvg(leftText: string, rightText: string, rightColor: string): string {
  const leftWidth = textWidth(leftText);
  const rightWidth = textWidth(rightText);
  const totalWidth = leftWidth + rightWidth;
  const leftCenter = Math.round(leftWidth / 2);
  const rightCenter = Math.round(leftWidth + rightWidth / 2);

  // Escape XML entities
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a"><rect width="${totalWidth}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#a)">
    <rect width="${leftWidth}" height="20" fill="#555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${escXml(rightColor)}"/>
    <rect width="${totalWidth}" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${leftCenter}" y="15" fill="#010101" fill-opacity=".3">${escXml(leftText)}</text>
    <text x="${leftCenter}" y="14">${escXml(leftText)}</text>
    <text x="${rightCenter}" y="15" fill="#010101" fill-opacity=".3">${escXml(rightText)}</text>
    <text x="${rightCenter}" y="14">${escXml(rightText)}</text>
  </g>
</svg>`;
}

function scoreColor(score: number): string {
  if (score >= 0.8) return '#4c1';
  if (score >= 0.5) return '#dfb317';
  return '#e05d44';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const style = req.nextUrl.searchParams.get('style');
  const benchmarkParam = req.nextUrl.searchParams.get('benchmark');

  const supabase = await createClient();

  // Look up agent by UUID or spec_id
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
  let decodedId = id;
  if (!isUuid) {
    try { decodedId = decodeURIComponent(id); } catch {
      const svg = generateBadgeSvg('PactSpec', 'error', '#e05d44');
      return new NextResponse(svg, {
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' },
      });
    }
  }

  const { data: agent, error } = isUuid
    ? await supabase.from('agents').select('*').eq('id', id).single()
    : await supabase.from('agents').select('*').eq('spec_id', decodedId).single();

  if (error || !agent) {
    const svg = generateBadgeSvg('PactSpec', 'not found', '#9f9f9f');
    return new NextResponse(svg, {
      status: 404,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=60' },
    });
  }

  const headers = {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=300',
  };

  // Style: benchmark — show a specific benchmark score
  if (style === 'benchmark' && benchmarkParam) {
    const { data: result } = await supabase
      .from('benchmark_results')
      .select('score, benchmarks(name)')
      .eq('agent_id', agent.id)
      .eq('benchmark_id', benchmarkParam)
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    if (result && typeof result.score === 'number') {
      const pct = (result.score * 100).toFixed(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const benchName = (result as any).benchmarks?.name ?? benchmarkParam;
      // Shorten benchmark name if too long
      const shortName = benchName.length > 20 ? benchName.slice(0, 18) + '..' : benchName;
      const svg = generateBadgeSvg('PactSpec', `${pct}% ${shortName}`, scoreColor(result.score));
      return new NextResponse(svg, { headers });
    }

    const svg = generateBadgeSvg('PactSpec', 'no data', '#9f9f9f');
    return new NextResponse(svg, { headers });
  }

  // Default: verification status badge
  const va = getVerificationAge(agent);

  if (va.tier === 'none') {
    const svg = generateBadgeSvg('PactSpec', 'unverified', '#9f9f9f');
    return new NextResponse(svg, { headers });
  }

  // Map trust-tier colors to badge hex colors
  const colorMap: Record<string, string> = {
    emerald: '#4c1',
    yellow: '#dfb317',
    red: '#e05d44',
    gray: '#9f9f9f',
  };
  const badgeColor = colorMap[va.color] ?? '#9f9f9f';

  // Build right-side text from the verification label
  let rightText = va.label.toLowerCase();
  // Clean up for badge display
  if (rightText.startsWith('verified ')) {
    rightText = rightText.replace('verified ', 'verified ');
  }
  if (rightText.startsWith('stale ')) {
    rightText = rightText.replace('stale ', 'stale ');
  }

  const svg = generateBadgeSvg('PactSpec', rightText, badgeColor);
  return new NextResponse(svg, { headers });
}
