/**
 * Trust tiers for agents.
 *
 * - none: Not verified at all.
 * - verified: Passed its own test suite recently. This is a HEALTH CHECK —
 *   the agent runs and responds correctly to its own tests. The agent controls
 *   both the endpoint and the test suite, so this does not prove quality.
 * - benchmarked: Scored on independent benchmark suites with known correct
 *   answers. The agent does not control the questions. This is the real trust signal.
 */
export type TrustTier = 'none' | 'verified' | 'benchmarked';

export interface VerificationAge {
  tier: TrustTier;
  label: string;
  fresh: boolean;
  daysAgo: number | null;
  color: 'emerald' | 'yellow' | 'gray' | 'red';
}

const FRESH_THRESHOLD_DAYS = 7;
const STALE_THRESHOLD_DAYS = 30;

export function getVerificationAge(agent: {
  verified?: boolean;
  verified_at?: string | null;
  last_validation_at?: string | null;
  last_validation_pass_rate?: number | null;
  benchmark_results?: Array<{ run_at?: string; runAt?: string }>;
}): VerificationAge {
  if (!agent.verified) {
    return { tier: 'none', label: 'Not verified', fresh: false, daysAgo: null, color: 'gray' };
  }

  const verifiedAt = agent.verified_at || agent.last_validation_at;
  if (!verifiedAt) {
    return { tier: 'verified', label: 'Verified (no date)', fresh: false, daysAgo: null, color: 'gray' };
  }

  const daysAgo = Math.floor((Date.now() - new Date(verifiedAt).getTime()) / (1000 * 60 * 60 * 24));

  const hasBenchmarks = agent.benchmark_results && agent.benchmark_results.length > 0;
  const tier: TrustTier = hasBenchmarks ? 'benchmarked' : 'verified';

  // Build label
  let label: string;
  if (daysAgo === 0) label = 'Verified today';
  else if (daysAgo === 1) label = 'Verified yesterday';
  else if (daysAgo <= STALE_THRESHOLD_DAYS) label = `Verified ${daysAgo}d ago`;
  else label = `Stale (${daysAgo}d ago)`;

  // Color: benchmarked agents get emerald if fresh, verified agents get yellow (it's just a health check)
  let color: 'emerald' | 'yellow' | 'gray' | 'red';
  if (daysAgo > STALE_THRESHOLD_DAYS) {
    color = 'red';
  } else if (hasBenchmarks && daysAgo <= FRESH_THRESHOLD_DAYS) {
    color = 'emerald';
  } else if (hasBenchmarks) {
    color = 'yellow';
  } else if (daysAgo <= FRESH_THRESHOLD_DAYS) {
    color = 'yellow'; // health check only — not emerald
  } else {
    color = 'yellow';
  }

  return { tier, label, fresh: !!hasBenchmarks && daysAgo <= FRESH_THRESHOLD_DAYS, daysAgo, color };
}

export function formatScoreAge(runAt: string): { label: string; fresh: boolean } {
  const daysAgo = Math.floor((Date.now() - new Date(runAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo === 0) return { label: 'today', fresh: true };
  if (daysAgo === 1) return { label: '1d ago', fresh: true };
  if (daysAgo <= 7) return { label: `${daysAgo}d ago`, fresh: true };
  if (daysAgo <= 30) return { label: `${daysAgo}d ago`, fresh: false };
  return { label: `${Math.floor(daysAgo / 30)}mo ago`, fresh: false };
}
