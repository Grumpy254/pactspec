'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AgentRow } from '@/types/agent-spec';

function AgentCard({ agent }: { agent: AgentRow }) {
  const skills = agent.spec?.skills ?? [];
  const pricingSkill = skills.find((s) => s.pricing);
  const hasPaidPricing = pricingSkill?.pricing && pricingSkill.pricing.model !== 'free';

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
            {hasPaidPricing && pricingSkill?.pricing?.protocol && pricingSkill.pricing.protocol !== 'none' && (
              <span className="shrink-0 inline-flex items-center bg-violet-900/40 text-violet-400 text-xs px-2 py-0.5 rounded-full border border-violet-800/50">
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
          {agent.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="bg-gray-800/60 px-2 py-0.5 rounded">{tag}</span>
          ))}
        </div>
        {pricingSkill?.pricing && (
          <span className="font-mono text-indigo-400">
            {pricingSkill.pricing.model === 'free'
              ? 'Free'
              : `${pricingSkill.pricing.amount} ${pricingSkill.pricing.currency}/${pricingSkill.pricing.model}`}
          </span>
        )}
      </div>
    </a>
  );
}

export default function RegistryPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (verifiedOnly) params.set('verified', 'true');
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
  }, [q, verifiedOnly]);

  useEffect(() => {
    const t = setTimeout(fetchAgents, 300);
    return () => clearTimeout(t);
  }, [fetchAgents]);

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-14 pt-8">
        <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1 rounded-full mb-6">
          Open Protocol · v1.0.0
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-white mb-5 tracking-tight leading-tight">
          MCP connects agents.<br />
          <span className="text-indigo-400">PactSpec makes them trustworthy.</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-8">
          Before your orchestrator invokes an agent, it needs to know the agent works, what it costs,
          and who&apos;s accountable. PactSpec is the open standard for declaring, verifying, and
          discovering AI agent capabilities — the layer MCP and A2A don&apos;t cover.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <a
            href="/why"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Why PactSpec?
          </a>
          <a
            href="/publish"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Publish your agent
          </a>
          <a
            href="/api/agents.md"
            target="_blank"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors font-mono text-xs"
          >
            GET /api/agents.md
          </a>
        </div>
      </div>

      {/* Three audiences */}
      <div className="grid md:grid-cols-3 gap-4 mb-14">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-indigo-400 text-sm font-semibold mb-2 uppercase tracking-wide">For agent builders</div>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Publish a machine-readable spec in minutes. Declare your pricing, run your test suite, and earn a verified badge that any consumer can check.
          </p>
          <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-400">
            <span className="text-gray-600">$</span> pactspec publish pactspec.json<br />
            <span className="text-emerald-400">✓</span> Published · <span className="text-gray-500">pactspec.dev/agents/...</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-violet-400 text-sm font-semibold mb-2 uppercase tracking-wide">For orchestrators</div>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Query the registry programmatically. Select the cheapest verified agent that handles your task. No hardcoding, no manual vetting.
          </p>
          <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-400 leading-relaxed">
            <span className="text-blue-400">const</span> {`{ agents } =`} <span className="text-yellow-400">await</span> search{'({'}<br />
            {'  '}<span className="text-gray-300">verifiedOnly</span>: <span className="text-orange-400">true</span>, q: <span className="text-green-400">&quot;invoice&quot;</span><br />
            {'}'});
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-emerald-400 text-sm font-semibold mb-2 uppercase tracking-wide">For MCP users</div>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Already on MCP? Add three lines to your tool manifest. Your tools gain pricing, a verified badge, and registry discoverability with zero migration.
          </p>
          <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-400 leading-relaxed">
            <span className="text-gray-600">{'"x-pactspec"'}: {'{'}</span><br />
            {'  '}<span className="text-gray-300">&quot;registry&quot;</span>: <span className="text-green-400">&quot;pactspec.dev/...&quot;</span>,<br />
            {'  '}<span className="text-gray-300">&quot;verified&quot;</span>: <span className="text-orange-400">true</span><br />
            <span className="text-gray-600">{'}'}</span>
          </div>
        </div>
      </div>

      {/* Registry */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-white">
          Registry
          {total > 0 && <span className="ml-2 text-sm text-gray-500 font-normal">{total} agents</span>}
        </h2>
        <a href="/api/agents.md" target="_blank" className="text-xs text-gray-500 hover:text-gray-300 font-mono transition-colors">
          machine-readable ↗
        </a>
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search agents, providers, descriptions..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
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
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
