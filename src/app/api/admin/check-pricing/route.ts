import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assertSafeUrl } from '@/lib/validator';
import { fetch as undiciFetch, Agent } from 'undici';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPrivateIp } from '@/lib/validator';
import type { AgentRow, AgentSpecSkill, AgentSpecPricing } from '@/types/agent-spec';

// ── Rate limiting (in-memory, once per hour) ────────────────────────────────

let lastRunAt = 0;
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

// ── SSRF-safe fetch (mirrors verify-pricing pattern) ────────────────────────

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

interface SkillCheckResult {
  agentId: string;
  agentName: string;
  skillId: string;
  protocol: string;
  declaredAmount: number;
  declaredCurrency: string;
  actualAmount: string | null;
  actualCurrency: string | null;
  match: boolean;
  driftPercentage: number | null;
  error?: string;
}

// ── Verification logic (same as verify-pricing route) ───────────────────────

function checkPricing(
  skill: AgentSpecSkill,
  pricing: AgentSpecPricing,
  status: number,
  body: Record<string, unknown>,
): { actualAmount: string | null; actualCurrency: string | null; match: boolean; error?: string } {
  if (status !== 402) {
    const error = status === 200
      ? 'Endpoint returned 200 without payment — not enforcing pricing'
      : `Expected 402, got ${status}`;
    return { actualAmount: null, actualCurrency: null, match: false, error };
  }

  const protocol = pricing.protocol ?? 'none';

  // Extract actual amount/currency based on protocol
  let actualAmount: string | null = null;
  let actualCurrency: string | null = null;

  if (protocol === 'x402') {
    actualAmount = String(body.maxAmountRequired ?? body.amount ?? body.price ?? '') || null;
    actualCurrency = String(body.asset ?? body.currency ?? body.token ?? '').toUpperCase() || null;
  } else if (protocol === 'stripe') {
    // Stripe may include checkout URL but not always inline amounts
    const hasStripeRef =
      typeof body.checkoutUrl === 'string' ||
      typeof body.checkout_url === 'string' ||
      typeof body.stripe === 'object';

    if (!hasStripeRef) {
      return { actualAmount: null, actualCurrency: null, match: false, error: '402 response missing checkoutUrl or Stripe reference' };
    }

    actualAmount = String(body.amount ?? body.price ?? '') || null;
    actualCurrency = String(body.currency ?? '').toUpperCase() || null;

    // 402 with Stripe reference but no inline amount — treat as match (partial verification)
    if (!actualAmount || !actualCurrency) {
      return { actualAmount, actualCurrency, match: true };
    }
  }

  if (actualAmount && actualCurrency) {
    const amountMatch = parseFloat(actualAmount) === pricing.amount;
    const currencyMatch = actualCurrency === pricing.currency.toUpperCase();
    const match = amountMatch && currencyMatch;
    return {
      actualAmount,
      actualCurrency,
      match,
      error: match ? undefined : `Declared ${pricing.amount} ${pricing.currency}, actual ${actualAmount} ${actualCurrency}`,
    };
  }

  return { actualAmount, actualCurrency, match: false, error: 'Could not extract actual pricing from 402 response' };
}

function computeDriftPercentage(declared: number, actual: string | null): number | null {
  if (!actual) return null;
  const actualNum = parseFloat(actual);
  if (isNaN(actualNum) || declared === 0) return null;
  return Math.abs(actualNum - declared) / declared * 100;
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth check
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!secret || secret !== process.env.PACTSPEC_PUBLISH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit
  const now = Date.now();
  if (now - lastRunAt < RATE_LIMIT_MS) {
    const retryAfterSec = Math.ceil((RATE_LIMIT_MS - (now - lastRunAt)) / 1000);
    return NextResponse.json(
      { error: 'Rate limited — batch pricing check runs at most once per hour' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }
  lastRunAt = now;

  const adminDb = createServiceRoleClient();

  // Fetch all agents
  const { data: agents, error: fetchError } = await adminDb
    .from('agents')
    .select('*');

  if (fetchError || !agents) {
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }

  // Filter to agents with priced skills (x402 or stripe)
  const pricedAgents = (agents as AgentRow[]).filter((agent) =>
    (agent.spec?.skills ?? []).some(
      (s) => s.pricing && (s.pricing.protocol === 'x402' || s.pricing.protocol === 'stripe')
    ),
  );

  const results: SkillCheckResult[] = [];
  let driftedCount = 0;

  for (const agent of pricedAgents) {
    // SSRF check
    let urlSafe = true;
    try {
      await assertSafeUrl(agent.endpoint_url, 'endpoint.url');
    } catch {
      urlSafe = false;
    }

    const skills = agent.spec?.skills ?? [];
    let agentDrifted = false;

    for (const skill of skills) {
      const pricing = skill.pricing;
      if (!pricing) continue;
      const protocol = pricing.protocol ?? 'none';
      if (protocol !== 'x402' && protocol !== 'stripe') continue;

      if (!urlSafe) {
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          skillId: skill.id,
          protocol,
          declaredAmount: pricing.amount,
          declaredCurrency: pricing.currency,
          actualAmount: null,
          actualCurrency: null,
          match: false,
          driftPercentage: null,
          error: 'Endpoint URL failed SSRF check',
        });
        agentDrifted = true;
        continue;
      }

      let status: number;
      let body: Record<string, unknown> = {};

      try {
        const res = await fetchWithTimeout(agent.endpoint_url, 10_000);
        status = res.status;
        try {
          body = (await res.json()) as Record<string, unknown>;
        } catch {
          // Non-JSON body — still check status
        }
      } catch (err) {
        const isTimeout = (err as Error).name === 'AbortError';
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          skillId: skill.id,
          protocol,
          declaredAmount: pricing.amount,
          declaredCurrency: pricing.currency,
          actualAmount: null,
          actualCurrency: null,
          match: false,
          driftPercentage: null,
          error: isTimeout ? 'Timeout after 10s' : (err as Error).message,
        });
        agentDrifted = true;
        continue;
      }

      const check = checkPricing(skill, pricing, status, body);
      const driftPct = computeDriftPercentage(pricing.amount, check.actualAmount);

      if (!check.match) agentDrifted = true;

      results.push({
        agentId: agent.id,
        agentName: agent.name,
        skillId: skill.id,
        protocol,
        declaredAmount: pricing.amount,
        declaredCurrency: pricing.currency,
        actualAmount: check.actualAmount,
        actualCurrency: check.actualCurrency,
        match: check.match,
        driftPercentage: driftPct,
        error: check.error,
      });

      // Record in pricing_checks table
      await adminDb.from('pricing_checks').insert({
        agent_id: agent.id,
        skill_id: skill.id,
        declared_amount: pricing.amount,
        declared_currency: pricing.currency,
        actual_amount: check.actualAmount,
        actual_currency: check.actualCurrency,
        match: check.match,
        drift_percentage: driftPct,
      });
    }

    // Update agent drift flag
    const checkTime = new Date().toISOString();
    await adminDb
      .from('agents')
      .update({
        pricing_drift_detected: agentDrifted,
        pricing_last_checked_at: checkTime,
        updated_at: checkTime,
      })
      .eq('id', agent.id);

    if (agentDrifted) driftedCount++;
  }

  return NextResponse.json({
    checked: pricedAgents.length,
    drifted: driftedCount,
    results,
  });
}
