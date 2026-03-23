export type TrustTier = 'none' | 'self-tested' | 'benchmarked' | 'recently-verified' | 'production-validated';

export interface VerificationAge {
  tier: TrustTier;
  label: string;           // "Verified 2 days ago" or "Stale (34 days)"
  fresh: boolean;           // true if within 7 days
  daysAgo: number | null;
  color: 'emerald' | 'yellow' | 'gray' | 'red';
}

const FRESH_THRESHOLD_DAYS = 7;
const STALE_THRESHOLD_DAYS = 30;
const PRODUCTION_MIN_INVOCATIONS = 100;
const PRODUCTION_MIN_SUCCESS_RATE = 0.9;

export function getVerificationAge(agent: {
  verified?: boolean;
  verified_at?: string | null;
  last_validation_at?: string | null;
  last_validation_pass_rate?: number | null;
  benchmark_results?: Array<{ run_at?: string; runAt?: string }>;
  telemetry_total_invocations?: number | null;
  telemetry_success_rate_30d?: number | null;
}): VerificationAge {
  // Not verified at all
  if (!agent.verified) {
    return { tier: 'none', label: 'Not verified', fresh: false, daysAgo: null, color: 'gray' };
  }

  const verifiedAt = agent.verified_at || agent.last_validation_at;
  if (!verifiedAt) {
    return { tier: 'self-tested', label: 'Verified (no date)', fresh: false, daysAgo: null, color: 'gray' };
  }

  const daysAgo = Math.floor((Date.now() - new Date(verifiedAt).getTime()) / (1000 * 60 * 60 * 24));

  // Check for production-validated tier first (highest tier)
  const hasProductionTelemetry =
    (agent.telemetry_total_invocations ?? 0) >= PRODUCTION_MIN_INVOCATIONS &&
    (agent.telemetry_success_rate_30d ?? 0) >= PRODUCTION_MIN_SUCCESS_RATE;

  // Determine tier
  const hasBenchmarks = agent.benchmark_results && agent.benchmark_results.length > 0;
  let tier: TrustTier = 'self-tested';
  if (hasBenchmarks) tier = 'benchmarked';
  if (daysAgo <= FRESH_THRESHOLD_DAYS) tier = 'recently-verified';
  if (hasProductionTelemetry) tier = 'production-validated';

  // Build label
  let label: string;
  if (daysAgo === 0) label = 'Verified today';
  else if (daysAgo === 1) label = 'Verified yesterday';
  else if (daysAgo <= FRESH_THRESHOLD_DAYS) label = `Verified ${daysAgo}d ago`;
  else if (daysAgo <= STALE_THRESHOLD_DAYS) label = `Verified ${daysAgo}d ago`;
  else label = `Stale (${daysAgo}d ago)`;

  // Color
  let color: 'emerald' | 'yellow' | 'gray' | 'red';
  if (hasProductionTelemetry) color = 'emerald';
  else if (daysAgo <= FRESH_THRESHOLD_DAYS) color = 'emerald';
  else if (daysAgo <= STALE_THRESHOLD_DAYS) color = 'yellow';
  else color = 'red';

  return { tier, label, fresh: daysAgo <= FRESH_THRESHOLD_DAYS || hasProductionTelemetry, daysAgo, color };
}

// Format a benchmark score age
export function formatScoreAge(runAt: string): { label: string; fresh: boolean } {
  const daysAgo = Math.floor((Date.now() - new Date(runAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo === 0) return { label: 'today', fresh: true };
  if (daysAgo === 1) return { label: '1d ago', fresh: true };
  if (daysAgo <= 7) return { label: `${daysAgo}d ago`, fresh: true };
  if (daysAgo <= 30) return { label: `${daysAgo}d ago`, fresh: false };
  return { label: `${Math.floor(daysAgo / 30)}mo ago`, fresh: false };
}
