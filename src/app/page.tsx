'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AgentRow } from '@/types/agent-spec';

function AgentCard({ agent }: { agent: AgentRow }) {
  const skills = agent.spec?.skills ?? [];
  const pricingSkill = skills.find((s) => s.pricing);

  return (
    <a
      href={`/agents/${agent.id}`}
      className="block bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-indigo-500 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-semibold text-white truncate">{agent.name}</h2>
            <span className="text-xs text-gray-500 font-mono shrink-0">v{agent.version}</span>
            {agent.verified && (
              <span className="shrink-0 inline-flex items-center gap-1 bg-emerald-900/50 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-800">
                Verified
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

      {(agent.tags.length > 0 || pricingSkill?.pricing) && (
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
      )}
    </a>
  );
}

export default function RegistryPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (verifiedOnly) params.set('verified', 'true');
    const res = await fetch(`/api/agents?${params}`);
    const data = await res.json();
    setAgents(data.agents ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [q, verifiedOnly]);

  useEffect(() => {
    const t = setTimeout(fetchAgents, 300);
    return () => clearTimeout(t);
  }, [fetchAgents]);

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-12 pt-8">
        <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1 rounded-full mb-6">
          Open Protocol Standard
        </div>
        <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">
          AgentSpec
        </h1>
        <p className="text-xl text-indigo-400 font-mono mb-3">
          Pricing. Test suites. Attestation. In one spec.
        </p>
        <p className="text-gray-400 max-w-xl mx-auto">
          The machine-readable capability standard MCP and A2A don&apos;t cover.
          Discover, verify, and transact with AI agents.
        </p>
        <div className="flex justify-center gap-4 mt-6">
          <a
            href="/publish"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Publish Agent
          </a>
          <a
            href="/api/spec/v1"
            target="_blank"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            View Schema
          </a>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Registered Agents', value: total },
          { label: 'Schema Version', value: 'v1.0.0' },
          { label: 'Protocol', value: 'Open' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
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
      ) : agents.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="mb-4">No agents found.</p>
          <a href="/publish" className="text-indigo-400 underline">Publish the first one</a>
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
