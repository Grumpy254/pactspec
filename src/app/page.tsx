'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AgentRow } from '@/types/agent-spec';

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
            {agent.verified && (
              <span className="shrink-0 inline-flex items-center gap-1 bg-emerald-900/50 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-800">
                Verified
              </span>
            )}
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
        {agent.verified && (
          <span className="shrink-0 inline-flex items-center gap-1 bg-emerald-900/50 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-800">
            Verified
          </span>
        )}
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
      <div className="text-center mb-14 pt-8">
        <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1 rounded-full mb-6">
          Open Protocol · v1.0.0
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-white mb-5 tracking-tight leading-tight">
          Know if your AI agent<br />
          <span className="text-indigo-400">actually works.</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-8">
          PactSpec runs tests against your live agent endpoint, scores it against domain-specific
          benchmarks, and tracks quality over time. When it breaks, you know before your users do.
          When it&apos;s good, you can prove it.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <a
            href="/publish"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Test your agent
          </a>
          <a
            href="/demo"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            See it in action
          </a>
        </div>
      </div>

      {/* Live stats */}
      {!loading && (
        <div className="flex justify-center gap-8 mb-14 py-4 border-y border-gray-800/50">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{total}</div>
            <div className="text-xs text-gray-500 mt-0.5">agents published</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{agents.filter(a => a.verified).length}</div>
            <div className="text-xs text-gray-500 mt-0.5">verified</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{agents.filter(a => (a.spec?.skills ?? []).some(s => s.pricing && s.pricing.model !== 'free')).length}</div>
            <div className="text-xs text-gray-500 mt-0.5">with pricing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">7</div>
            <div className="text-xs text-gray-500 mt-0.5">benchmark suites</div>
          </div>
        </div>
      )}

      {/* Three pillars */}
      <div className="grid md:grid-cols-3 gap-4 mb-14">
        <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-6">
          <div className="text-emerald-400 text-sm font-semibold mb-2 uppercase tracking-wide">Test</div>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Run your test suite against the live endpoint. Score against domain-specific benchmarks with known correct answers. Not &quot;it responds&quot; — it got the right answer.
          </p>
          <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-400">
            <span className="text-emerald-400">✓</span> 94.7% on ICD-11 Medical Coding<br />
            <span className="text-emerald-400">✓</span> 86.7% on Security Vulnerability Scan<br />
            <span className="text-yellow-400">!</span> 70.0% on API Response Quality
          </div>
        </div>

        <div className="bg-gray-900 border border-violet-900/40 rounded-xl p-6">
          <div className="text-violet-400 text-sm font-semibold mb-2 uppercase tracking-wide">Price</div>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Declare what your agent costs. The registry verifies the price matches what the endpoint actually charges. Consumers know the cost before they call.
          </p>
          <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-400 leading-relaxed">
            <span className="text-violet-300">0.05 USD</span>/invocation via <span className="text-indigo-300">stripe</span><br />
            <span className="text-emerald-400">✓</span> Pricing verified against live endpoint
          </div>
        </div>

        <div className="bg-gray-900 border border-indigo-900/40 rounded-xl p-6">
          <div className="text-indigo-400 text-sm font-semibold mb-2 uppercase tracking-wide">Discover</div>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Agents that pass get listed in the open registry. Search by capability, filter by quality score and price. Compare agents that do the same thing.
          </p>
          <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-400">
            <span className="text-gray-600">$</span> pactspec test agent.json<br />
            <span className="text-emerald-400">✓</span> 4/4 tests passed<br />
            <span className="text-gray-600">$</span> pactspec publish agent.json
          </div>
        </div>
      </div>

      {/* Monetized Agents */}
      {(() => {
        const monetizedAgents = agents.filter((a) =>
          (a.spec?.skills ?? []).some((s) => s.pricing && s.pricing.model !== 'free')
        );
        if (monetizedAgents.length === 0) return null;
        return (
          <div className="mb-14">
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
    </div>
  );
}
