'use client';

import { useState, useEffect, use, useCallback } from 'react';
import type { AgentRow } from '@/types/agent-spec';
import { getVerificationAge, formatScoreAge } from '@/lib/trust-tier';

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

export default function AgentReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`/api/agents/${id}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([agentData]) => {
        if (agentData.agent) {
          setAgent(agentData.agent);
          // Fetch benchmarks
          fetch(`/api/benchmarks/results?agentId=${agentData.agent.id}`)
            .then((r) => r.json())
            .then((d) => setBenchmarks(d.results ?? []))
            .catch(() => {});
        } else {
          setError(agentData.error ?? 'Not found');
        }
      })
      .catch(() => setError('Failed to load agent'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">Loading verification report...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-red-400">{error || 'Agent not found'}</div>
      </div>
    );
  }

  const va = getVerificationAge(agent);

  const tierLabel =
    va.tier === 'production-validated' ? 'Production Validated' :
    va.tier === 'benchmarked' ? 'Benchmarked' :
    va.tier === 'recently-verified' ? 'Recently Verified' :
    va.tier === 'self-tested' ? 'Self-Tested' :
    'Not Verified';

  const tierColorMap = {
    emerald: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
    yellow: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    red: 'bg-red-900/50 text-red-400 border-red-800',
    gray: 'bg-gray-800/50 text-gray-400 border-gray-700',
  };

  function scoreBarColor(score: number): string {
    if (score >= 0.8) return 'bg-emerald-500';
    if (score >= 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  function scoreTextColor(score: number): string {
    if (score >= 0.8) return 'text-emerald-400';
    if (score >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  }

  const hasPricing = (agent.spec?.skills ?? []).some(
    (s) => s.pricing && s.pricing.model !== 'free'
  );

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-xs text-gray-600 uppercase tracking-widest mb-3">
            PactSpec Verification Report
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{agent.name}</h1>
          <div className="flex items-center justify-center gap-3 text-sm text-gray-400">
            <span className="font-mono">v{agent.version}</span>
            <span className="text-gray-700">|</span>
            <span>{agent.provider_name}</span>
          </div>
        </div>

        {/* Trust Tier — prominent */}
        <div className="text-center mb-10">
          <div className={`inline-flex items-center gap-2 text-lg px-6 py-2 rounded-full border ${tierColorMap[va.color]}`}>
            {va.tier !== 'none' && (
              <div className={`w-2.5 h-2.5 rounded-full ${
                va.color === 'emerald' ? 'bg-emerald-400' :
                va.color === 'yellow' ? 'bg-yellow-400' :
                va.color === 'red' ? 'bg-red-400' :
                'bg-gray-500'
              }`} />
            )}
            <span className="font-semibold">{tierLabel}</span>
          </div>
          <p className="text-sm text-gray-500 mt-3">{va.label}</p>
          {agent.attestation_hash && (
            <p className="text-xs text-gray-600 font-mono mt-2 break-all max-w-md mx-auto">
              SHA-256: {agent.attestation_hash}
            </p>
          )}
        </div>

        {/* Benchmark Scores */}
        {benchmarks.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-white mb-4">Benchmark Scores</h2>
            <div className="space-y-4">
              {benchmarks.map((r) => {
                const pct = r.score * 100;
                const age = formatScoreAge(r.run_at);
                return (
                  <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-white text-sm">{r.benchmarks.name}</h3>
                        <span className="text-xs text-gray-500">{r.benchmarks.domain} &middot; {r.benchmarks.publisher}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-bold font-mono ${scoreTextColor(r.score)}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2.5 mb-2">
                      <div
                        className={`h-2.5 rounded-full transition-all ${scoreBarColor(r.score)}`}
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{r.passed_count}/{r.total_count} tests passed</span>
                      <span className={age.fresh ? 'text-gray-500' : 'text-yellow-600'}>{age.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Runtime Telemetry */}
        {(agent.telemetry_total_invocations ?? 0) > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-white mb-4">Runtime Telemetry</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="space-y-3 mb-5">
                {([
                  { label: '24h success', value: agent.telemetry_success_rate_24h },
                  { label: '7d success', value: agent.telemetry_success_rate_7d },
                  { label: '30d success', value: agent.telemetry_success_rate_30d },
                ] as const).map(({ label, value }) => {
                  if (value == null) return null;
                  const pct = Math.round(value * 100);
                  const bar = pct > 95 ? 'bg-emerald-500' : pct > 80 ? 'bg-yellow-500' : 'bg-red-500';
                  const text = pct > 95 ? 'text-emerald-400' : pct > 80 ? 'text-yellow-400' : 'text-red-400';
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400">{label}</span>
                        <span className={`text-sm font-mono font-semibold ${text}`}>{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className={`h-2 rounded-full ${bar}`} style={{ width: `${Math.max(pct, 1)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {agent.telemetry_latency_p50_ms != null && (
                  <div className="bg-gray-950 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">p50 latency</div>
                    <div className="text-lg font-mono font-bold text-white">{agent.telemetry_latency_p50_ms}<span className="text-xs text-gray-500 ml-0.5">ms</span></div>
                  </div>
                )}
                {agent.telemetry_latency_p95_ms != null && (
                  <div className="bg-gray-950 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">p95 latency</div>
                    <div className="text-lg font-mono font-bold text-white">{agent.telemetry_latency_p95_ms}<span className="text-xs text-gray-500 ml-0.5">ms</span></div>
                  </div>
                )}
                <div className="bg-gray-950 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Invocations</div>
                  <div className="text-lg font-mono font-bold text-white">{(agent.telemetry_total_invocations ?? 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pricing */}
        {hasPricing && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-white mb-4">Pricing</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="space-y-3">
                {(agent.spec?.skills ?? []).filter((s) => s.pricing).map((skill) => (
                  <div key={skill.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{skill.name}</span>
                    <span className="text-sm text-indigo-400 font-mono">
                      {skill.pricing!.model === 'free'
                        ? 'Free'
                        : `${skill.pricing!.amount} ${skill.pricing!.currency}/${skill.pricing!.model}`}
                    </span>
                  </div>
                ))}
              </div>
              {agent.pricing_verified && (
                <div className="mt-3 text-xs text-emerald-400">Pricing verified on-chain</div>
              )}
            </div>
          </div>
        )}

        {/* Verify Yourself */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">Verify This Yourself</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-3">
              Run independent validation against this agent using the PactSpec CLI:
            </p>
            <pre className="bg-gray-950 rounded-lg p-4 text-sm text-indigo-400 font-mono overflow-x-auto">
              npx pactspec validate {agent.spec_id}
            </pre>
            <p className="text-xs text-gray-600 mt-3">
              This will fetch the agent&apos;s test suite and run it against the live endpoint.
              Results are independently verifiable.
            </p>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-between text-sm border-t border-gray-800 pt-6">
          <a
            href={`/agents/${id}`}
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            View full agent detail
          </a>
          <a
            href="/"
            className="text-gray-500 hover:text-gray-300"
          >
            PactSpec Registry
          </a>
        </div>
      </div>
    </div>
  );
}
