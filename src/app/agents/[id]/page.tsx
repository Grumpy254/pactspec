'use client';

import { useState, useEffect, use } from 'react';
import type { AgentRow, AgentSpecSkill } from '@/types/agent-spec';

function SkillPanel({ skill, agentId }: { skill: AgentSpecSkill; agentId: string }) {
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
          </div>
        )}
        {skill.testSuite?.url && (
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

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.agent) setAgent(d.agent);
        else setError(d.error ?? 'Not found');
      })
      .catch(() => setError('Failed to load agent'))
      .finally(() => setLoading(false));
  }, [id]);

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
              {agent.verified && (
                <span className="inline-flex items-center gap-1 bg-emerald-900/50 text-emerald-400 text-sm px-3 py-0.5 rounded-full border border-emerald-800">
                  Verified
                </span>
              )}
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
          {agent.provider_url && (
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
            {agent.verified_at && (
              <p className="text-xs text-gray-500 mt-1">
                Verified at {new Date(agent.verified_at).toLocaleString()}
              </p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Tamper-evident record — changes if agent ID, skill, results, or timestamp changes. Not a cryptographic signature.
            </p>
          </div>
        </div>
      )}

      {/* Tags */}
      {agent.tags.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-8">
          {agent.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Skills */}
      <h2 className="text-xl font-semibold text-white mb-4">Skills</h2>
      <div className="space-y-4 mb-10">
        {agent.spec.skills.map((skill) => (
          <SkillPanel key={skill.id} skill={skill} agentId={agent.id} />
        ))}
      </div>

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
