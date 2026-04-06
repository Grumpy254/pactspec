'use client';

import { useState, useEffect } from 'react';

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

// Domains where expected answers can be objectively verified by anyone
const VERIFIABLE_DOMAINS = new Set(['schema-validation', 'api-response-quality']);

function needsExpertReview(b: BenchmarkRow): boolean {
  return b.source !== 'peer-reviewed' && b.source !== 'industry-standard' && !VERIFIABLE_DOMAINS.has(b.domain);
}

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('');
  const [domains, setDomains] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (domain) params.set('domain', domain);

    fetch(`/api/benchmarks?${params}`)
      .then((r) => r.json())
      .then((d) => {
        const items = d.benchmarks ?? [];
        setBenchmarks(items);
        // Build domain list from all benchmarks (first load)
        if (!domain && items.length > 0) {
          const unique = [...new Set(items.map((b: BenchmarkRow) => b.domain))] as string[];
          setDomains(unique.sort());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [domain]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Benchmarks</h1>
        <p className="text-gray-400 max-w-2xl leading-relaxed mb-3">
          Benchmarks are test suites with expected correct answers. The registry runs them
          against live agent endpoints and signs the results. Scores are only as good as the
          expected answers — which is why source provenance matters.
        </p>
        <p className="text-gray-500 text-sm max-w-2xl leading-relaxed mb-3">
          Benchmarks marked <span className="text-emerald-400">verified</span> have objectively
          checkable answers (e.g., schema validation) or have been reviewed by domain experts.
          Benchmarks marked <span className="text-amber-400">unreviewed</span> use synthetic test
          data that has not been validated by a domain professional. Scores from unreviewed
          benchmarks should be treated as directional, not authoritative.
        </p>
      </div>

      {/* Domain filter */}
      {domains.length > 0 && (
        <div className="mb-6">
          <select
            value={domain}
            onChange={(e) => { setDomain(e.target.value); setLoading(true); }}
            className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading benchmarks...</div>
      ) : benchmarks.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="mb-2">No benchmarks published yet</p>
          <p className="text-sm text-gray-600">
            Publish a benchmark via the API: POST /api/benchmarks
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {benchmarks.map((b) => (
            <a
              key={b.id}
              href={`/benchmarks/${b.benchmark_id}`}
              className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h2 className="text-lg font-semibold text-white">{b.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs bg-indigo-900/50 text-indigo-400 px-2 py-0.5 rounded">
                      {b.domain}
                    </span>
                    <span className="text-xs text-gray-500">v{b.version}</span>
                    <span className="text-xs text-gray-500">
                      skill: <span className="font-mono">{b.skill}</span>
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold text-white font-mono">{b.test_count}</div>
                  <div className="text-xs text-gray-500">tests</div>
                </div>
              </div>

              {b.description && (
                <p className="text-sm text-gray-400 mb-3">{b.description}</p>
              )}

              {needsExpertReview(b) && (
                <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2 mb-3">
                  <span className="text-amber-400 shrink-0 text-xs mt-0.5">!</span>
                  <p className="text-xs text-amber-400/80 leading-relaxed">
                    Unreviewed — expected answers have not been validated by a domain expert. Scores are directional, not authoritative.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span>
                    Published by <span className="text-gray-300">{b.publisher}</span>
                  </span>
                  {needsExpertReview(b) ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-900/40 text-amber-400 border border-amber-800/40">
                      unreviewed
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-900/50 text-emerald-400 border border-emerald-800/40">
                      {b.source === 'peer-reviewed' ? 'peer-reviewed' : b.source === 'industry-standard' ? 'industry-standard' : 'verified'}
                    </span>
                  )}
                </div>
                <span>{new Date(b.created_at).toLocaleDateString()}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
