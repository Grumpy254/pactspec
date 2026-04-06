'use client';

import { useState, useEffect, use } from 'react';
import { formatScoreAge } from '@/lib/trust-tier';

interface BenchmarkRow {
  id: string;
  benchmark_id: string;
  name: string;
  description: string | null;
  domain: string;
  version: string;
  publisher: string;
  publisher_url: string | null;
  test_suite_url: string;
  test_count: number;
  skill: string;
  created_at: string;
  source?: string | null;
  source_description?: string | null;
  source_url?: string | null;
}

const VERIFIABLE_DOMAINS = new Set(['schema-validation', 'api-response-quality']);

function isUnreviewed(b: BenchmarkRow): boolean {
  return b.source !== 'peer-reviewed' && b.source !== 'industry-standard' && !VERIFIABLE_DOMAINS.has(b.domain);
}

interface LeaderboardEntry {
  id: string;
  benchmark_id: string;
  agent_id: string;
  score: number;
  passed_count: number;
  total_count: number;
  attestation_hash?: string;
  run_at: string;
  agent?: {
    name: string;
    provider_name: string;
    verified: boolean;
    spec_id: string;
  };
}

export default function BenchmarkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [benchmark, setBenchmark] = useState<BenchmarkRow | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runAgentId, setRunAgentId] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ score?: number; error?: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/benchmarks?domain=`).then((r) => r.json()),
      fetch(`/api/benchmarks/leaderboard?benchmarkId=${id}`).then((r) => r.json()).catch(() => ({ entries: [] })),
    ])
      .then(([bmData, lbData]) => {
        const found = (bmData.benchmarks ?? []).find(
          (b: BenchmarkRow) => b.benchmark_id === id
        );
        if (found) {
          setBenchmark(found);
        } else {
          setError('Benchmark not found');
        }
        setLeaderboard(lbData.entries ?? []);
      })
      .catch(() => setError('Failed to load benchmark'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRun() {
    if (!runAgentId.trim()) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(`/api/benchmarks/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: runAgentId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRunResult({ error: data.error });
      } else {
        setRunResult({ score: data.score });
        // Refresh leaderboard
        fetch(`/api/benchmarks/leaderboard?benchmarkId=${id}`)
          .then((r) => r.json())
          .then((d) => setLeaderboard(d.entries ?? []))
          .catch(() => {});
      }
    } catch {
      setRunResult({ error: 'Network error' });
    } finally {
      setRunning(false);
    }
  }

  function scoreColor(score: number): string {
    if (score >= 0.8) return 'text-emerald-400';
    if (score >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  }

  if (loading) return <div className="text-center text-gray-500 py-20">Loading...</div>;
  if (error || !benchmark) {
    return <div className="text-center text-red-400 py-20">{error || 'Benchmark not found'}</div>;
  }

  return (
    <div>
      <a href="/benchmarks" className="text-sm text-gray-500 hover:text-gray-300 mb-4 inline-block">
        &larr; Benchmarks
      </a>

      {/* Benchmark header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">{benchmark.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs bg-indigo-900/50 text-indigo-400 px-2 py-0.5 rounded">
                {benchmark.domain}
              </span>
              <span className="text-xs text-gray-500 font-mono">v{benchmark.version}</span>
              <span className="text-xs text-gray-500">
                skill: <span className="font-mono">{benchmark.skill}</span>
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold text-white font-mono">{benchmark.test_count}</div>
            <div className="text-xs text-gray-500">tests</div>
          </div>
        </div>
        {benchmark.description && (
          <p className="text-gray-400 mt-3">{benchmark.description}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span>
            Published by{' '}
            {benchmark.publisher_url ? (
              <a
                href={benchmark.publisher_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 underline"
              >
                {benchmark.publisher}
              </a>
            ) : (
              <span className="text-gray-300">{benchmark.publisher}</span>
            )}
          </span>
          <span>{new Date(benchmark.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Unreviewed warning */}
      {isUnreviewed(benchmark) && (
        <div className="bg-amber-950/30 border border-amber-900/40 rounded-xl p-5 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-amber-400 text-lg shrink-0">!</span>
            <div>
              <p className="text-amber-400 font-semibold text-sm mb-1">Unreviewed benchmark</p>
              <p className="text-sm text-amber-400/70 leading-relaxed">
                The expected answers in this benchmark have not been validated by a domain expert.
                {benchmark.source_description && (
                  <> Source: {benchmark.source_description}</>
                )}
                {' '}Scores should be treated as directional, not authoritative. If you have domain expertise and can review the test cases,{' '}
                <a
                  href="https://github.com/Grumpy254/pactspec/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-300 underline"
                >
                  we welcome contributions
                </a>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Run benchmark CTA */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
        <h3 className="text-sm font-semibold text-white mb-3">Run this benchmark on your agent</h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Agent ID (UUID or spec_id)"
            value={runAgentId}
            onChange={(e) => setRunAgentId(e.target.value)}
            className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleRun}
            disabled={running || !runAgentId.trim()}
            className="shrink-0 text-sm bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-5 py-2 rounded-lg transition-colors"
          >
            {running ? 'Running...' : 'Run Benchmark'}
          </button>
        </div>
        {runResult && (
          <div className={`mt-3 text-sm ${runResult.error ? 'text-red-400' : 'text-emerald-400'}`}>
            {runResult.error
              ? `Error: ${runResult.error}`
              : `Score: ${((runResult.score ?? 0) * 100).toFixed(1)}%`}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <h2 className="text-xl font-semibold text-white mb-4">Leaderboard</h2>
      {leaderboard.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500">
          No agents have been scored on this benchmark yet. Be the first!
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 w-12">#</th>
                <th className="text-left px-5 py-3">Agent</th>
                <th className="text-left px-5 py-3">Provider</th>
                <th className="text-right px-5 py-3">Score</th>
                <th className="text-right px-5 py-3">Passed</th>
                <th className="text-center px-5 py-3">Verified</th>
                <th className="text-right px-5 py-3">Run Date</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, idx) => (
                <tr
                  key={entry.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-5 py-3 text-sm text-gray-500 font-mono">{idx + 1}</td>
                  <td className="px-5 py-3">
                    <a
                      href={`/agents/${entry.agent_id}`}
                      className="text-sm text-white hover:text-indigo-400 transition-colors"
                    >
                      {entry.agent?.name ?? entry.agent_id}
                    </a>
                    {entry.agent?.spec_id && (
                      <div className="text-xs text-gray-600 font-mono">{entry.agent.spec_id}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {entry.agent?.provider_name ?? '—'}
                  </td>
                  <td className={`px-5 py-3 text-right text-lg font-bold font-mono ${scoreColor(entry.score)}`}>
                    {(entry.score * 100).toFixed(1)}%
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-400 font-mono">
                    {entry.passed_count}/{entry.total_count}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {entry.agent?.verified ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Verified" />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-gray-700" title="Not verified" />
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-xs" title={new Date(entry.run_at).toLocaleString()}>
                    {(() => {
                      const age = formatScoreAge(entry.run_at);
                      return <span className={age.fresh ? 'text-gray-500' : 'text-yellow-500'}>{age.label}</span>;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
