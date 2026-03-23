import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { assertSafeUrl } from '@/lib/validator';
import { fetch as undiciFetch, Agent } from 'undici';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPrivateIp } from '@/lib/validator';
import type { AgentRow, AgentSpecSkill, AgentSpecPricing } from '@/types/agent-spec';

// ── Timeout fetch (mirrors validator.ts pattern) ────────────────────────────

async function resolveSafeIp(hostname: string): Promise<string> {
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error(`Direct IP ${hostname} is not allowed`);
    return hostname;
  }
  const records = await lookup(hostname, { all: true });
  const safe = records.map((r) => r.address).find((a) => !isPrivateIp(a));
  if (!safe) throw new Error(`${hostname} resolves only to private addresses`);
  return safe;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const parsed = new URL(url);
    const pinnedIp = await resolveSafeIp(parsed.hostname);
    const family = isIP(pinnedIp) === 6 ? 6 : 4;

    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, _opts, cb) => {
          cb(null, [{ address: pinnedIp, family }]);
        },
      },
    });

    return await undiciFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: controller.signal,
      redirect: 'error',
      dispatcher,
    }) as unknown as Response;
  } finally {
    clearTimeout(timer);
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

interface SkillPricingResult {
  skillId: string;
  protocol: string;
  declared: { amount: number; currency: string };
  actual: { amount?: string; currency?: string } | null;
  match: boolean;
  status: 'VERIFIED' | 'MISMATCH' | 'ERROR' | 'SKIPPED';
  error?: string;
}

// ── x402 verification ───────────────────────────────────────────────────────

function verifyX402(
  skill: AgentSpecSkill,
  pricing: AgentSpecPricing,
  status: number,
  body: Record<string, unknown>,
): SkillPricingResult {
  const declared = { amount: pricing.amount, currency: pricing.currency };
  const base: Omit<SkillPricingResult, 'actual' | 'match' | 'status' | 'error'> = {
    skillId: skill.id,
    protocol: 'x402',
    declared,
  };

  if (status !== 402) {
    return {
      ...base,
      actual: null,
      match: false,
      status: 'ERROR',
      error: status === 200
        ? 'Endpoint returned 200 without payment — not enforcing pricing'
        : `Expected 402, got ${status}`,
    };
  }

  // x402 bodies typically include amount/maxAmountRequired and currency/asset
  const actualAmount = String(
    body.maxAmountRequired ?? body.amount ?? body.price ?? '',
  );
  const actualCurrency = String(
    body.asset ?? body.currency ?? body.token ?? '',
  ).toUpperCase();

  const actual = { amount: actualAmount || undefined, currency: actualCurrency || undefined };

  const amountMatch = actualAmount
    ? parseFloat(actualAmount) === pricing.amount
    : false;
  const currencyMatch = actualCurrency
    ? actualCurrency === pricing.currency.toUpperCase()
    : false;

  const match = amountMatch && currencyMatch;

  return {
    ...base,
    actual,
    match,
    status: match ? 'VERIFIED' : 'MISMATCH',
    error: match ? undefined : `Declared ${pricing.amount} ${pricing.currency}, actual ${actualAmount || '?'} ${actualCurrency || '?'}`,
  };
}

// ── Stripe verification ─────────────────────────────────────────────────────

function verifyStripe(
  skill: AgentSpecSkill,
  pricing: AgentSpecPricing,
  status: number,
  body: Record<string, unknown>,
): SkillPricingResult {
  const declared = { amount: pricing.amount, currency: pricing.currency };
  const base: Omit<SkillPricingResult, 'actual' | 'match' | 'status' | 'error'> = {
    skillId: skill.id,
    protocol: 'stripe',
    declared,
  };

  if (status !== 402) {
    return {
      ...base,
      actual: null,
      match: false,
      status: 'ERROR',
      error: status === 200
        ? 'Endpoint returned 200 without payment — not enforcing pricing'
        : `Expected 402, got ${status}`,
    };
  }

  const hasCheckoutUrl = typeof body.checkoutUrl === 'string' || typeof body.checkout_url === 'string';
  const hasStripeRef = typeof body.stripe === 'object' || hasCheckoutUrl;

  if (!hasStripeRef) {
    return {
      ...base,
      actual: null,
      match: false,
      status: 'ERROR',
      error: '402 response missing checkoutUrl or Stripe reference',
    };
  }

  // Amount verification if present in the 402 body
  const actualAmount = String(body.amount ?? body.price ?? '');
  const actualCurrency = String(body.currency ?? '').toUpperCase();
  const actual = { amount: actualAmount || undefined, currency: actualCurrency || undefined };

  if (actualAmount && actualCurrency) {
    const amountMatch = parseFloat(actualAmount) === pricing.amount;
    const currencyMatch = actualCurrency === pricing.currency.toUpperCase();
    const match = amountMatch && currencyMatch;
    return {
      ...base,
      actual,
      match,
      status: match ? 'VERIFIED' : 'MISMATCH',
      error: match ? undefined : `Declared ${pricing.amount} ${pricing.currency}, actual ${actualAmount} ${actualCurrency}`,
    };
  }

  // 402 with Stripe reference but no inline amount — partial verification
  return {
    ...base,
    actual,
    match: true,
    status: 'VERIFIED',
    error: undefined,
  };
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Look up agent (same pattern as validate route)
  const supabase = await createClient();
  const adminDb = createServiceRoleClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
  let decodedId = id;
  if (!isUuid) {
    try { decodedId = decodeURIComponent(id); } catch {
      return NextResponse.json({ error: 'Invalid agent ID encoding' }, { status: 400 });
    }
  }
  const { data: agent, error } = isUuid
    ? await supabase.from('agents').select('*').eq('id', id).single()
    : await supabase.from('agents').select('*').eq('spec_id', decodedId).single();

  if (error || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const typedAgent = agent as AgentRow;

  // SSRF protection on the endpoint URL
  try {
    await assertSafeUrl(typedAgent.endpoint_url, 'endpoint.url');
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  // Collect skills with pricing
  const skills = typedAgent.spec.skills ?? [];
  const results: SkillPricingResult[] = [];

  for (const skill of skills) {
    const pricing = skill.pricing;
    if (!pricing) continue;

    const protocol = pricing.protocol ?? 'none';

    // Skip non-verifiable pricing
    if (protocol === 'none' || pricing.model === 'free') {
      results.push({
        skillId: skill.id,
        protocol,
        declared: { amount: pricing.amount, currency: pricing.currency },
        actual: null,
        match: false,
        status: 'SKIPPED',
        error: protocol === 'none'
          ? 'Cannot verify out-of-band pricing'
          : 'Free tier — nothing to verify',
      });
      continue;
    }

    // Call the endpoint without payment headers
    let status: number;
    let body: Record<string, unknown> = {};

    try {
      const res = await fetchWithTimeout(typedAgent.endpoint_url, 10_000);
      status = res.status;
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // Non-JSON 402 body — still check status
      }
    } catch (err) {
      const isTimeout = (err as Error).name === 'AbortError';
      results.push({
        skillId: skill.id,
        protocol,
        declared: { amount: pricing.amount, currency: pricing.currency },
        actual: null,
        match: false,
        status: 'ERROR',
        error: isTimeout ? 'Timeout after 10s' : (err as Error).message,
      });
      continue;
    }

    if (protocol === 'x402') {
      results.push(verifyX402(skill, pricing, status, body));
    } else if (protocol === 'stripe') {
      results.push(verifyStripe(skill, pricing, status, body));
    }
  }

  const verified = results.length > 0 && results.every(
    (r) => r.status === 'VERIFIED' || r.status === 'SKIPPED'
  );

  // Update agent record with pricing_verified flag
  const now = new Date().toISOString();
  const { error: updateError } = await adminDb
    .from('agents')
    .update({
      pricing_verified: verified,
      pricing_verified_at: now,
      updated_at: now,
    })
    .eq('id', typedAgent.id);

  if (updateError) {
    console.error('Failed to update agent pricing_verified:', updateError.message);
  }

  return NextResponse.json({ results, verified });
}
