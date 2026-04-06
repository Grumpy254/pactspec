'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AgentRow } from '@/types/agent-spec';
import { getVerificationAge } from '@/lib/trust-tier';

type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'pass-rate';

function getAgentPrice(agent: AgentRow): number {
  const skill = (agent.spec?.skills ?? []).find((s) => s.pricing);
  if (!skill?.pricing) return Infinity;
  if (skill.pricing.model === 'free') return 0;
  return skill.pricing.amount ?? Infinity;
}

function AgentCard({ agent, highlightPricing }: { agent: AgentRow; highlightPricing?: boolean }) {
  const skills = agent.spec?.skills ?? [];
  const pricingSkill = skills.find((s) => s.pricing);
  const hasPaidPricing = pricingSkill?.pricing && pricingSkill.pricing.model !== 'free';
  const isFree = pricingSkill?.pricing?.model === 'free';
  const passRate = agent.last_validation_pass_rate;

  return (
    <a
      href={`/agents/${agent.id}`}
      className={`block bg-gray-900 border rounded-xl p-5 hover:border-indigo-500 transition-colors ${
        agent.verified ? 'border-emerald-900/60' : 'border-gray-800'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="font-semibold text-white truncate">{agent.name}</h2>
            <span className="text-xs text-gray-500 font-mono shrink-0">v{agent.version}</span>
            {(() => {
              const va = getVerificationAge(agent);
              if (va.tier === 'none') return null;
              const colorMap = {
                emerald: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
                yellow: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
                red: 'bg-red-900/50 text-red-400 border-red-800',
                gray: 'bg-gray-800/50 text-gray-400 border-gray-700',
              };
              const tierLabel = va.tier === 'benchmarked' ? 'Benchmarked' : va.tier === 'recently-verified' ? 'Recently verified' : 'Self-tested';
              const tierColor = va.tier === 'benchmarked' ? 'text-indigo-400' : va.tier === 'recently-verified' ? 'text-emerald-400' : 'text-gray-500';
              return (
                <>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${colorMap[va.color]}`}>
                    {va.label}
                  </span>
                  <span className={`shrink-0 text-[10px] ${tierColor}`}>{tierLabel}</span>
                </>
              );
            })()}
            {isFree && (
              <span className="shrink-0 inline-flex items-center bg-emerald-900/40 text-emerald-300 text-xs font-medium px-2 py-0.5 rounded-full border border-emerald-800/50">
                Free
              </span>
            )}
            {hasPaidPricing && pricingSkill?.pricing && (
              <span className={`shrink-0 inline-flex items-center font-mono text-xs px-2 py-0.5 rounded-full border ${
                highlightPricing
                  ? 'bg-indigo-800/60 text-indigo-200 border-indigo-500'
                  : 'bg-indigo-900/40 text-indigo-300 border-indigo-800/50'
              }`}>
                {pricingSkill.pricing.amount} {pricingSkill.pricing.currency}/{pricingSkill.pricing.model.replace('per-', '')}
              </span>
            )}
            {hasPaidPricing && pricingSkill?.pricing?.protocol && pricingSkill.pricing.protocol !== 'none' && (
              <span className={`shrink-0 inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${
                highlightPricing
                  ? 'bg-violet-800/60 text-violet-200 border-violet-500'
                  : 'bg-violet-900/40 text-violet-400 border-violet-800/50'
              }`}>
                {pricingSkill.pricing.protocol}
              </span>
            )}
            {agent.pricing_drift_detected && (
              <span
                className="shrink-0 inline-flex items-center text-xs px-2 py-0.5 rounded-full border bg-red-900/50 text-red-400 border-red-800"
                title="Declared price does not match what the endpoint actually charges"
              >
                {'\u26A0'} Price drift
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 truncate">{agent.description ?? agent.spec_id}</p>
        </div>
        <span className="text-xs text-gray-600 shrink-0 mt-1">{agent.provider_name}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {skills.slice(0, 4).map((skill) => (
          <span
            key={skill.id}
            className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-mono"
          >
            {skill.id}
          </span>
        ))}
        {skills.length > 4 && (
          <span className="text-xs text-gray-600">+{skills.length - 4} more</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <div className="flex gap-2 flex-wrap">
          {(agent.tags ?? []).slice(0, 3).map((tag) => (
            <span key={tag} className="bg-gray-800/60 px-2 py-0.5 rounded">{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {passRate != null && (
            <span className="text-emerald-400 font-mono">{Math.round(passRate * 100)}% pass</span>
          )}
        </div>
      </div>
    </a>
  );
}

function MonetizedAgentCard({ agent }: { agent: AgentRow }) {
  const skills = agent.spec?.skills ?? [];
  const pricingSkill = skills.find((s) => s.pricing && s.pricing.model !== 'free');
  const pricing = pricingSkill?.pricing;

  return (
    <a
      href={`/agents/${agent.id}`}
      className="flex-shrink-0 w-[280px] bg-gray-900 border border-violet-800/40 rounded-xl p-4 hover:border-violet-500 transition-colors bg-gradient-to-br from-gray-900 to-violet-950/30"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white text-sm truncate">{agent.name}</h3>
        {(() => {
          const va = getVerificationAge(agent);
          if (va.tier === 'none') return null;
          const colorMap = {
            emerald: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
            yellow: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
            red: 'bg-red-900/50 text-red-400 border-red-800',
            gray: 'bg-gray-800/50 text-gray-400 border-gray-700',
          };
          return (
            <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${colorMap[va.color]}`}>
              {va.label}
            </span>
          );
        })()}
      </div>
      <p className="text-xs text-gray-500 mb-3 truncate">{agent.provider_name}</p>
      {pricing && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center font-mono text-xs text-violet-300 bg-violet-900/40 px-2 py-0.5 rounded border border-violet-800/50">
            {pricing.amount} {pricing.currency}/{pricing.model}
          </span>
          {pricing.protocol && pricing.protocol !== 'none' && (
            <span className="inline-flex items-center text-[10px] text-indigo-300 bg-indigo-900/40 px-1.5 py-0.5 rounded border border-indigo-800/50">
              {pricing.protocol}
            </span>
          )}
          {agent.pricing_drift_detected && (
            <span
              className="inline-flex items-center text-[10px] text-red-400 bg-red-900/50 px-1.5 py-0.5 rounded border border-red-800"
              title="Declared price does not match what the endpoint actually charges"
            >
              {'\u26A0'} Drift
            </span>
          )}
        </div>
      )}
    </a>
  );
}

export default function RegistryPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [pricingModel, setPricingModel] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minPassRate, setMinPassRate] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (verifiedOnly) params.set('verified', 'true');
      if (pricingModel) params.set('pricing_model', pricingModel);
      if (maxPrice) params.set('max_price', maxPrice);
      if (minPassRate) params.set('min_pass_rate', minPassRate);
      const res = await fetch(`/api/agents?${params}`);
      if (!res.ok) throw new Error(`Registry returned ${res.status}`);
      const data = await res.json();
      const sorted = [...(data.agents ?? [])].sort(
        (a: AgentRow, b: AgentRow) => Number(b.verified) - Number(a.verified)
      );
      setAgents(sorted);
      setTotal(data.total ?? 0);
    } catch (err) {
      setFetchError((err as Error).message ?? 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [q, verifiedOnly, pricingModel, maxPrice, minPassRate]);

  useEffect(() => {
    const t = setTimeout(fetchAgents, 300);
    return () => clearTimeout(t);
  }, [fetchAgents]);

  const sortedAgents = useMemo(() => {
    if (sortBy === 'relevance') return agents;
    const sorted = [...agents];
    switch (sortBy) {
      case 'price-asc':
        sorted.sort((a, b) => getAgentPrice(a) - getAgentPrice(b));
        break;
      case 'price-desc':
        sorted.sort((a, b) => {
          const pa = getAgentPrice(a);
          const pb = getAgentPrice(b);
          // Treat Infinity as lowest priority when sorting high-to-low
          if (pa === Infinity && pb === Infinity) return 0;
          if (pa === Infinity) return 1;
          if (pb === Infinity) return -1;
          return pb - pa;
        });
        break;
      case 'pass-rate':
        sorted.sort((a, b) => (b.last_validation_pass_rate ?? -1) - (a.last_validation_pass_rate ?? -1));
        break;
    }
    return sorted;
  }, [agents, sortBy]);

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-20 pt-12 animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs px-4 py-1.5 rounded-full mb-8 backdrop-blur-sm">
          Open Standard · v1.0.0
        </div>
        <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 tracking-tight leading-[1.1]">
          The open standard for<br />
          <span className="gradient-text">AI agent trust.</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-4">
          One JSON file declares what your agent does, proves it works, and states what it costs.
          No platform lock-in &mdash; validate offline, publish to any registry, or self-host.
        </p>
        <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed mb-10">
          Verification expires. Benchmarks re-run. When your agent degrades, you know before your users do.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <a
            href="/publish"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5"
          >
            Publish your agent
          </a>
          <a
            href="/spec"
            className="border border-white/[0.1] hover:border-white/[0.2] bg-white/[0.03] hover:bg-white/[0.06] text-gray-300 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:-translate-y-0.5"
          >
            Read the spec
          </a>
        </div>
      </div>

      {/* Live stats */}
      {!loading && (
        <div className="flex justify-center gap-10 mb-20 py-5 border-y border-white/[0.06] animate-fade-in-delay-1">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{total}</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">agents</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{agents.filter(a => a.verified).length}</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">verified</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{agents.filter(a => (a.spec?.skills ?? []).some(s => s.pricing && s.pricing.model !== 'free')).length}</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">priced</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">7</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">benchmarks</div>
          </div>
        </div>
      )}

      {/* Three pillars */}
      <div className="grid md:grid-cols-3 gap-5 mb-20 animate-fade-in-delay-2">
        <div className="glow-card bg-[#111117] border border-white/[0.06] rounded-2xl p-7 hover:border-emerald-500/30 transition-all duration-300">
          <div className="text-emerald-400 text-sm font-semibold mb-3 uppercase tracking-wider">Declare</div>
          <p className="text-gray-300 text-sm leading-relaxed mb-5">
            One JSON file describes skills, schemas, pricing, and test suites. Works offline. No platform required.
          </p>
          <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-gray-400 space-y-2 border border-white/[0.04]">
            <div><span className="text-gray-600">$</span> pactspec init</div>
            <div><span className="text-gray-600">$</span> pactspec validate agent.json</div>
            <div><span className="text-emerald-400">✓</span> Valid PactSpec v1.0.0</div>
          </div>
        </div>

        <div className="glow-card bg-[#111117] border border-white/[0.06] rounded-2xl p-7 hover:border-violet-500/30 transition-all duration-300">
          <div className="text-violet-400 text-sm font-semibold mb-3 uppercase tracking-wider">Verify</div>
          <p className="text-gray-300 text-sm leading-relaxed mb-5">
            Self-tests prove it runs. Benchmarks prove it&apos;s accurate. The registry runs both directly against the live endpoint &mdash; no self-reported metrics.
          </p>
          <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-gray-400 space-y-2 border border-white/[0.04]">
            <div><span className="text-gray-500">Self-tested:</span> <span className="text-emerald-400">✓ passed</span> <span className="text-gray-600">2d ago</span></div>
            <div><span className="text-gray-500">Benchmark:</span> <span className="text-emerald-400">94.7%</span> <span className="text-gray-600">medical-coding</span></div>
            <div><span className="text-gray-500">Attestation:</span> <span className="text-gray-500">sha256:a4f2...</span></div>
          </div>
        </div>

        <div className="glow-card bg-[#111117] border border-white/[0.06] rounded-2xl p-7 hover:border-indigo-500/30 transition-all duration-300">
          <div className="text-indigo-400 text-sm font-semibold mb-3 uppercase tracking-wider">Discover</div>
          <p className="text-gray-300 text-sm leading-relaxed mb-5">
            Search by capability, filter by quality and price. The registry is a discovery layer &mdash; agents are invoked directly at their own endpoints.
          </p>
          <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-gray-400 border border-white/[0.04]">
            <span className="text-gray-600">$</span> pactspec test agent.json<br />
            <span className="text-emerald-400">✓</span> 4/4 tests passed<br />
            <span className="text-gray-600">$</span> pactspec publish agent.json
          </div>
        </div>
      </div>

      {/* Registry */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-white">
          Registry
          {total > 0 && <span className="ml-2 text-sm text-gray-500 font-normal">{total} agents</span>}
        </h2>
        <a href="/api/agents.md" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-300 font-mono transition-colors">
          machine-readable ↗
        </a>
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search agents, providers, descriptions..."
          aria-label="Search agents"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[240px] bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <select
          value={pricingModel}
          onChange={(e) => setPricingModel(e.target.value)}
          aria-label="Pricing model filter"
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">Any pricing</option>
          <option value="free">Free</option>
          <option value="per-invocation">Per invocation</option>
          <option value="per-token">Per token</option>
          <option value="per-second">Per second</option>
        </select>
        <select
          value={minPassRate}
          onChange={(e) => setMinPassRate(e.target.value)}
          aria-label="Minimum pass rate filter"
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">Any coverage</option>
          <option value="0.8">{'>'}= 80%</option>
          <option value="0.9">{'>'}= 90%</option>
          <option value="0.95">{'>'}= 95%</option>
        </select>
        <input
          type="number"
          min="0"
          step="0.001"
          placeholder="Max price"
          aria-label="Maximum price filter"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className="w-36 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="accent-indigo-500"
          />
          Verified only
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          aria-label="Sort agents"
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="relevance">Sort by: Relevance</option>
          <option value="price-asc">Sort by: Price (low to high)</option>
          <option value="price-desc">Sort by: Price (high to low)</option>
          <option value="pass-rate">Sort by: Pass rate</option>
        </select>
      </div>

      {/* Agent list */}
      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading...</div>
      ) : fetchError ? (
        <div className="text-center text-red-400 py-20">{fetchError}</div>
      ) : agents.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="mb-2">No agents yet.</p>
          <a href="/publish" className="text-indigo-400 underline text-sm">
            Publish the first one &rarr;
          </a>
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} highlightPricing={!!pricingModel} />
          ))}
        </div>
      )}

      {/* Monetized Agents */}
      {(() => {
        const monetizedAgents = agents.filter((a) =>
          (a.spec?.skills ?? []).some((s) => s.pricing && s.pricing.model !== 'free')
        );
        if (monetizedAgents.length === 0) return null;
        return (
          <div className="mt-14">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white">Monetized Agents</h2>
              <p className="text-sm text-gray-500 mt-1">Agents with declared pricing and payment protocols</p>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin">
              {monetizedAgents.map((agent) => (
                <MonetizedAgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
