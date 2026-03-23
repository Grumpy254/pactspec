'use client';

import { useState, useEffect, use, useCallback } from 'react';
import type { AgentRow, AgentSpecSkill } from '@/types/agent-spec';
import { getVerificationAge, formatScoreAge } from '@/lib/trust-tier';

interface PricingVerifyResult {
  skillId: string;
  protocol: string;
  declared: { amount: number; currency: string };
  actual: { amount?: string; currency?: string } | null;
  match: boolean;
  status: 'VERIFIED' | 'MISMATCH' | 'ERROR' | 'SKIPPED';
  error?: string;
}

interface PricingDriftInfo {
  pricing_drift_detected?: boolean;
  pricing_last_checked_at?: string | null;
}

interface LatestPricingCheck {
  skill_id: string;
  declared_amount: number | null;
  actual_amount: string | null;
  drift_percentage: number | null;
  match: boolean;
  checked_at: string;
}

function SkillPanel({ skill, agentId, pricingResult, driftInfo, latestCheck }: { skill: AgentSpecSkill; agentId: string; pricingResult?: PricingVerifyResult; driftInfo?: PricingDriftInfo; latestCheck?: LatestPricingCheck }) {
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{ status: string; attestationHash?: string; error?: string } | null>(null);

  async function triggerValidation() {
    setValidating(true);
    setResult(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ status: 'ERROR', error: 'Network error — could not reach registry' });
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-semibold text-white">{skill.name}</h3>
          <span className="text-xs text-gray-500 font-mono">{skill.id}</span>
        </div>
        {skill.testSuite?.url && (
          <button
            onClick={triggerValidation}
            disabled={validating}
            className="shrink-0 text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {validating ? 'Running...' : 'Run Validation'}
          </button>
        )}
      </div>

      <p className="text-sm text-gray-400 mb-4">{skill.description}</p>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {skill.pricing && (
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Pricing</span>
            <p className="text-indigo-400 font-mono mt-0.5">
              {skill.pricing.model === 'free'
                ? 'Free'
                : `${skill.pricing.amount} ${skill.pricing.currency}/${skill.pricing.model}`}
              {skill.pricing.protocol && skill.pricing.protocol !== 'none' && (
                <span className="text-gray-500 ml-1">via {skill.pricing.protocol}</span>
              )}
            </p>
            {pricingResult && (
              <span
                className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                  pricingResult.status === 'VERIFIED'
                    ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
                    : pricingResult.status === 'SKIPPED'
                    ? 'bg-gray-800 text-gray-500'
                    : 'bg-red-900/50 text-red-400 border border-red-800'
                }`}
                title={pricingResult.error ?? ''}
              >
                {pricingResult.status === 'VERIFIED'
                  ? 'Pricing verified'
                  : pricingResult.status === 'SKIPPED'
                  ? 'Pricing unverified'
                  : 'Pricing unverified'}
              </span>
            )}
            {/* Pricing drift detection badges */}
            {driftInfo?.pricing_drift_detected && latestCheck && !latestCheck.match && (
              <div className="mt-2">
                <span className="inline-block text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-400 border border-red-800 font-medium">
                  Price drift detected
                </span>
                <p className="text-xs text-red-400/80 mt-1">
                  Declared: ${skill.pricing?.amount ?? '?'} | Last checked: ${latestCheck.actual_amount ?? '?'}
                  {latestCheck.drift_percentage != null && ` (${latestCheck.drift_percentage.toFixed(0)}% drift)`}
                </p>
                <button
                  onClick={() => {
                    fetch(`/api/agents/${agentId}/verify-pricing`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                  }}
                  className="text-xs text-red-400 underline mt-1 hover:text-red-300"
                >
                  Re-check pricing
                </button>
              </div>
            )}
            {driftInfo?.pricing_last_checked_at && !driftInfo.pricing_drift_detected && (
              <div className="mt-2">
                <span className="inline-block text-xs px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/50">
                  Price verified {'\u2713'}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Checked {new Date(driftInfo.pricing_last_checked_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        )}
        {skill.testSuite?.url && /^https?:\/\//.test(skill.testSuite.url) && (
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Test Suite</span>
            <a
              href={skill.testSuite.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 text-xs underline mt-0.5 block truncate"
            >
              {skill.testSuite.url}
            </a>
          </div>
        )}
      </div>

      {skill.tags && skill.tags.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {skill.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{tag}</span>
          ))}
        </div>
      )}

      {/* I/O schemas */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <details className="group">
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">inputSchema</summary>
          <pre className="mt-2 text-xs bg-gray-950 rounded p-3 overflow-auto text-gray-300 max-h-40">
            {JSON.stringify(skill.inputSchema, null, 2)}
          </pre>
        </details>
        <details className="group">
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">outputSchema</summary>
          <pre className="mt-2 text-xs bg-gray-950 rounded p-3 overflow-auto text-gray-300 max-h-40">
            {JSON.stringify(skill.outputSchema, null, 2)}
          </pre>
        </details>
      </div>

      {/* Validation result */}
      {result && (
        <div
          className={`mt-4 p-4 rounded-lg border text-sm ${
            result.status === 'PASSED'
              ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
              : 'bg-red-950 border-red-800 text-red-300'
          }`}
        >
          <p className="font-medium mb-1">
            Validation: <span className="font-mono">{result.status}</span>
          </p>
          {result.attestationHash && (
            <p className="text-xs font-mono text-emerald-500 break-all">
              Verified record: {result.attestationHash}
            </p>
          )}
          {result.error && <p className="text-xs">{result.error}</p>}
        </div>
      )}
    </div>
  );
}

interface BenchmarkResultRow {
  id: string;
  benchmark_id: string;
  agent_id: string;
  score: number;
  passed_count: number;
  total_count: number;
  attestation_hash?: string;
  run_at: string;
  benchmarks: {
    name: string;
    domain: string;
    publisher: string;
    version: string;
    test_count: number;
  };
}

function BenchmarkResultsSection({ agentId }: { agentId: string }) {
  const [results, setResults] = useState<BenchmarkResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState<string | null>(null);

  const fetchResults = useCallback(() => {
    fetch(`/api/benchmarks/results?agentId=${agentId}`)
      .then((r) => r.json())
      .then((d) => setResults(d.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  async function rerun(benchmarkId: string) {
    setRerunning(benchmarkId);
    try {
      await fetch(`/api/benchmarks/${benchmarkId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      fetchResults();
    } catch {
      // ignore
    } finally {
      setRerunning(null);
    }
  }

  function scoreColor(score: number): string {
    if (score >= 0.8) return 'text-emerald-400';
    if (score >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  }

  function barColor(score: number): string {
    if (score >= 0.8) return 'bg-emerald-500';
    if (score >= 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  if (loading) return null;

  return (
    <div className="mb-10">
      <h2 className="text-xl font-semibold text-white mb-4">Benchmark Results</h2>
      {results.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
          <p className="text-gray-500 mb-2">No benchmarks run yet</p>
          <a
            href="/benchmarks"
            className="text-indigo-400 hover:text-indigo-300 text-sm underline"
          >
            Browse available benchmarks
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {results.map((r) => (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-white text-sm">{r.benchmarks.name}</h3>
                  <span className="text-xs text-gray-500">{r.benchmarks.domain}</span>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold font-mono ${scoreColor(r.score)}`}>
                    {(r.score * 100).toFixed(1)}%
                  </span>
                  {r.run_at && (() => {
                    const age = formatScoreAge(r.run_at);
                    return (
                      <div className={`text-[10px] font-mono ${age.fresh ? 'text-emerald-500' : 'text-yellow-500'}`}>
                        {age.label}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Score bar */}
              <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
                <div
                  className={`h-2 rounded-full transition-all ${barColor(r.score)}`}
                  style={{ width: `${Math.max(r.score * 100, 1)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {r.passed_count}/{r.total_count} tests passed
                </span>
                <span>by {r.benchmarks.publisher}</span>
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-600" title={new Date(r.run_at).toLocaleString()}>
                  {(() => {
                    const age = formatScoreAge(r.run_at);
                    return <span className={age.fresh ? 'text-gray-500' : 'text-yellow-600'}>{age.label}</span>;
                  })()}
                </span>
                <button
                  onClick={() => rerun(r.benchmark_id)}
                  disabled={rerunning === r.benchmark_id}
                  className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 px-3 py-1 rounded-lg transition-colors"
                >
                  {rerunning === r.benchmark_id ? 'Running...' : 'Re-run'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifyingPricing, setVerifyingPricing] = useState(false);
  const [pricingResults, setPricingResults] = useState<PricingVerifyResult[]>([]);
  const [latestPricingChecks, setLatestPricingChecks] = useState<LatestPricingCheck[]>([]);

  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d.agent) {
          setAgent(d.agent);
          // Fetch latest pricing checks for this agent
          if (d.agent.pricing_last_checked_at) {
            fetch(`/api/agents/${d.agent.id}/pricing-checks`)
              .then((r) => r.ok ? r.json() : null)
              .then((data) => { if (data?.checks) setLatestPricingChecks(data.checks); })
              .catch(() => {});
          }
        } else {
          setError(d.error ?? 'Not found');
        }
      })
      .catch(() => setError('Failed to load agent'))
      .finally(() => setLoading(false));
  }, [id]);

  const hasPricedSkills = (agent?.spec?.skills ?? []).some(
    (s) => s.pricing && s.pricing.protocol && s.pricing.protocol !== 'none' && s.pricing.model !== 'free'
  );

  async function triggerPricingVerify() {
    if (!agent) return;
    setVerifyingPricing(true);
    setPricingResults([]);
    try {
      const res = await fetch(`/api/agents/${agent.id}/verify-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.results) setPricingResults(data.results);
    } catch {
      // silently fail — no results shown
    } finally {
      setVerifyingPricing(false);
    }
  }

  if (loading) return <div className="text-center text-gray-500 py-20">Loading...</div>;
  if (error || !agent) {
    return <div className="text-center text-red-400 py-20">{error || 'Agent not found'}</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/" className="text-sm text-gray-500 hover:text-gray-300 mb-4 inline-block">
          &larr; Registry
        </a>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-white">{agent.name}</h1>
              <span className="text-gray-500 font-mono">v{agent.version}</span>
              {(() => {
                const va = getVerificationAge(agent);
                if (va.tier === 'none') return null;
                const colorMap = {
                  emerald: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
                  yellow: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
                  red: 'bg-red-900/50 text-red-400 border-red-800',
                  gray: 'bg-gray-800/50 text-gray-400 border-gray-700',
                };
                const tierLabel = va.tier === 'production-validated' ? 'Production validated' : va.tier === 'benchmarked' ? 'Benchmarked' : va.tier === 'recently-verified' ? 'Recently verified' : 'Self-tested';
                const tierColor = va.tier === 'production-validated' ? 'text-emerald-300' : va.tier === 'benchmarked' ? 'text-indigo-400' : va.tier === 'recently-verified' ? 'text-emerald-400' : 'text-gray-500';
                return (
                  <>
                    <span className={`inline-flex items-center gap-1 text-sm px-3 py-0.5 rounded-full border ${colorMap[va.color]}`}>
                      {va.label}
                    </span>
                    <span className={`text-xs ${tierColor}`}>{tierLabel}</span>
                  </>
                );
              })()}
            </div>
            <p className="text-gray-400">{agent.description ?? agent.spec_id}</p>
          </div>
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Provider</div>
          <div className="text-sm text-white font-medium">{agent.provider_name}</div>
          {agent.provider_url && /^https?:\/\//.test(agent.provider_url) && (
            <a href={agent.provider_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-400 underline mt-0.5 block truncate">
              {agent.provider_url}
            </a>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Endpoint</div>
          <div className="text-xs text-gray-300 font-mono break-all">{agent.endpoint_url}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Spec ID</div>
          <div className="text-xs text-gray-300 font-mono break-all">{agent.spec_id}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Published</div>
          <div className="text-sm text-gray-300">
            {new Date(agent.published_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Attestation */}
      {agent.attestation_hash && (
        <div className="bg-gray-900 border border-emerald-900 rounded-xl p-4 mb-8 flex items-start gap-3">
          <div className="shrink-0 w-2 h-2 rounded-full bg-emerald-400 mt-1.5" />
          <div>
            <p className="text-sm text-emerald-400 font-medium mb-1">Verified Record (SHA-256 fingerprint)</p>
            <p className="text-xs text-gray-400 font-mono break-all">{agent.attestation_hash}</p>
            {agent.verified_at && (() => {
              const va = getVerificationAge(agent);
              const ageColor = va.color === 'emerald' ? 'text-emerald-400' : va.color === 'yellow' ? 'text-yellow-400' : va.color === 'red' ? 'text-red-400' : 'text-gray-500';
              return (
                <p className="text-xs text-gray-500 mt-1">
                  <span className={ageColor}>{va.label}</span>
                  {' '}— {new Date(agent.verified_at).toLocaleString()}
                </p>
              );
            })()}
            <p className="text-xs text-gray-600 mt-1">
              Tamper-evident record — changes if agent ID, skill, results, or timestamp changes. Not a cryptographic signature.
            </p>
          </div>
        </div>
      )}

      {/* Delegation */}
      {agent.spec?.delegation?.delegatedFrom && (
        <div className="bg-gray-900 border border-cyan-900 rounded-xl p-4 mb-8 flex items-start gap-3">
          <div className="shrink-0 w-2 h-2 rounded-full bg-cyan-400 mt-1.5" />
          <div className="min-w-0">
            <p className="text-sm text-cyan-400 font-medium mb-1">Delegated Agent</p>
            <p className="text-sm text-gray-300">
              Delegates from:{' '}
              <span className="font-mono text-xs text-cyan-300 break-all">
                {agent.spec.delegation.delegatedFrom}
              </span>
            </p>
            {agent.spec.delegation.revenueShare && (
              <p className="text-xs text-gray-400 mt-1">
                Revenue share: {agent.spec.delegation.revenueShare.upstream}% upstream / {agent.spec.delegation.revenueShare.downstream}% this agent
              </p>
            )}
            {agent.spec.delegation.terms && /^https?:\/\//.test(agent.spec.delegation.terms) && (
              <a
                href={agent.spec.delegation.terms}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 underline mt-1 inline-block"
              >
                Delegation terms
              </a>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {(agent.tags ?? []).length > 0 && (
        <div className="flex gap-2 flex-wrap mb-8">
          {(agent.tags ?? []).map((tag) => (
            <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Skills */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Skills</h2>
        {hasPricedSkills && (
          <button
            onClick={triggerPricingVerify}
            disabled={verifyingPricing}
            className="text-xs bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {verifyingPricing ? 'Verifying...' : 'Verify Pricing'}
          </button>
        )}
      </div>
      <div className="space-y-4 mb-10">
        {(agent.spec?.skills ?? []).map((skill) => (
          <SkillPanel
            key={skill.id}
            skill={skill}
            agentId={agent.id}
            pricingResult={pricingResults.find((r) => r.skillId === skill.id)}
            driftInfo={{
              pricing_drift_detected: agent.pricing_drift_detected,
              pricing_last_checked_at: agent.pricing_last_checked_at,
            }}
            latestCheck={latestPricingChecks.find((c) => c.skill_id === skill.id)}
          />
        ))}
      </div>

      {/* Benchmark Results */}
      <BenchmarkResultsSection agentId={agent.id} />

      {/* Runtime Performance (Telemetry) */}
      {(agent.telemetry_total_invocations ?? 0) > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-white mb-4">Runtime Performance</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            {/* Success rate bars */}
            <div className="space-y-4 mb-6">
              {([
                { label: '24h', value: agent.telemetry_success_rate_24h },
                { label: '7d', value: agent.telemetry_success_rate_7d },
                { label: '30d', value: agent.telemetry_success_rate_30d },
              ] as const).map(({ label, value }) => {
                if (value == null) return null;
                const pct = Math.round(value * 100);
                const barColor = pct > 95 ? 'bg-emerald-500' : pct > 80 ? 'bg-yellow-500' : 'bg-red-500';
                const textColor = pct > 95 ? 'text-emerald-400' : pct > 80 ? 'text-yellow-400' : 'text-red-400';
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-400">Success rate ({label})</span>
                      <span className={`text-sm font-mono font-semibold ${textColor}`}>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Latency + invocations */}
            <div className="grid grid-cols-3 gap-4">
              {agent.telemetry_latency_p50_ms != null && (
                <div className="bg-gray-950 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Latency p50</div>
                  <div className="text-lg font-mono font-bold text-white">{agent.telemetry_latency_p50_ms}<span className="text-xs text-gray-500 ml-0.5">ms</span></div>
                </div>
              )}
              {agent.telemetry_latency_p95_ms != null && (
                <div className="bg-gray-950 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Latency p95</div>
                  <div className="text-lg font-mono font-bold text-white">{agent.telemetry_latency_p95_ms}<span className="text-xs text-gray-500 ml-0.5">ms</span></div>
                </div>
              )}
              <div className="bg-gray-950 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Total invocations</div>
                <div className="text-lg font-mono font-bold text-white">{(agent.telemetry_total_invocations ?? 0).toLocaleString()}</div>
              </div>
            </div>

            {/* Last updated */}
            {agent.telemetry_updated_at && (
              <div className="mt-4 text-xs text-gray-600">
                Last updated: {(() => {
                  const mins = Math.floor((Date.now() - new Date(agent.telemetry_updated_at).getTime()) / 60000);
                  if (mins < 1) return 'just now';
                  if (mins === 1) return '1 minute ago';
                  if (mins < 60) return `${mins} minutes ago`;
                  const hours = Math.floor(mins / 60);
                  if (hours === 1) return '1 hour ago';
                  if (hours < 24) return `${hours} hours ago`;
                  return `${Math.floor(hours / 24)} days ago`;
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw spec */}
      <details>
        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-300 mb-2">
          Raw spec JSON
        </summary>
        <pre className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-xs text-gray-300 overflow-auto max-h-96 font-mono">
          {JSON.stringify(agent.spec, null, 2)}
        </pre>
      </details>
    </div>
  );
}
