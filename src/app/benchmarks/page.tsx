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

function isReviewed(b: BenchmarkRow): boolean {
  return b.source === 'peer-reviewed' || b.source === 'industry-standard';
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
      {/* Header — positions PactSpec as infrastructure, not author */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-white mb-2">Benchmarks</h1>
        <p className="text-gray-400 max-w-2xl leading-relaxed mb-6">
          PactSpec runs benchmarks. Domain experts write them.
        </p>
        <p className="text-gray-500 text-sm max-w-2xl leading-relaxed mb-6">
          A benchmark is a set of test cases with expected correct answers, published by someone
          with domain expertise. PactSpec runs the tests against live agent endpoints and signs
          the results. The score is only as good as the expert who wrote the expected answers.
        </p>

        {/* Publish CTA */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-7 max-w-2xl">
          <h2 className="text-white font-semibold text-lg mb-2">Publish a benchmark</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            If you&apos;re a domain expert — a medical coder, security engineer, lawyer, data scientist —
            you can publish a benchmark that holds AI agents accountable in your field.
            Your name stays on it. You control the expected answers.
          </p>
          <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-gray-400 space-y-1 mb-4 border border-white/[0.04]">
            <div><span className="text-gray-600">1.</span> Write a benchmark JSON file with test cases</div>
            <div><span className="text-gray-600">2.</span> Host it at any URL you control</div>
            <div><span className="text-gray-600">3.</span> POST to /api/benchmarks to register it</div>
            <div><span className="text-gray-600">4.</span> Agents run your benchmark, PactSpec signs the scores</div>
          </div>
          <details className="mt-4">
            <summary className="text-sm text-indigo-400 hover:text-indigo-300 cursor-pointer">Show submission command</summary>
            <pre className="mt-3 bg-black/40 rounded-xl p-4 font-mono text-xs text-gray-400 overflow-x-auto border border-white/[0.04]">{`curl -X POST https://pactspec.dev/api/benchmarks \\
  -H "Content-Type: application/json" \\
  -d '{
    "benchmarkId": "your-benchmark-id",
    "name": "Your Benchmark Name",
    "description": "What it tests and why",
    "domain": "your-domain",
    "version": "1.0.0",
    "publisher": "Your Name, Credentials",
    "publisherUrl": "https://your-site.com",
    "testSuiteUrl": "https://your-site.com/benchmark.json",
    "testCount": 20,
    "skill": "the-skill-id",
    "source": "peer-reviewed",
    "sourceDescription": "How you verified the answers",
    "sourceUrl": "https://link-to-reference"
  }'`}</pre>
            <p className="text-xs text-gray-600 mt-2">
              First submission returns a publisher key — save it. You need it to update the benchmark later.
              Full format docs on{' '}
              <a
                href="https://github.com/Grumpy254/pactspec/blob/main/benchmarks/README.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 underline"
              >
                GitHub
              </a>.
            </p>
          </details>
        </div>
      </div>

      {/* Authoritative sources by domain */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-white mb-2">Benchmarks needed</h2>
        <p className="text-sm text-gray-500 mb-5">
          These domains have authoritative reference sources that benchmarks should be built against. If you have expertise in any of these areas, the source material is public.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-sm font-semibold text-white mb-1">Medical Coding</div>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Map clinical text to diagnosis codes. Expected answers verifiable against the official classification.
            </p>
            <div className="space-y-1.5">
              <a href="https://icd.who.int/browse/2024-01/mms/en" target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 hover:text-indigo-300">WHO ICD-11 Browser (2024-01 release)</a>
              <a href="https://www.who.int/standards/classifications/classification-of-diseases" target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 hover:text-indigo-300">WHO ICD Classification Standards</a>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">Needs: certified medical coder (CPC, CCS, or equivalent)</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-sm font-semibold text-white mb-1">Security Vulnerability Detection</div>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Classify vulnerabilities by type and severity. Reference frameworks are public and well-documented.
            </p>
            <div className="space-y-1.5">
              <a href="https://attack.mitre.org/" target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 hover:text-indigo-300">MITRE ATT&amp;CK Framework</a>
              <a href="https://nvd.nist.gov/" target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 hover:text-indigo-300">NIST National Vulnerability Database</a>
              <a href="https://owasp.org/www-project-top-ten/" target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 hover:text-indigo-300">OWASP Top 10</a>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">Needs: security engineer or penetration tester</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-sm font-semibold text-white mb-1">Medical Lab Tests</div>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Map lab orders and results to standardized codes. LOINC is the universal standard for lab observations.
            </p>
            <div className="space-y-1.5">
              <a href="https://loinc.org/" target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 hover:text-indigo-300">LOINC (Logical Observation Identifiers)</a>
              <a href="https://loinc.org/search/" target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 hover:text-indigo-300">LOINC Search</a>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">Needs: clinical laboratory professional or informaticist</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-sm font-semibold text-white mb-1">Drug Interactions</div>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Identify dangerous drug combinations. Reference databases are used in clinical practice daily.
            </p>
            <div className="space-y-1.5">
              <a href="https://www.drugbank.com/" target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 hover:text-indigo-300">DrugBank</a>
              <a href="https://dailymed.nlm.nih.gov/dailymed/" target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 hover:text-indigo-300">DailyMed (FDA/NLM)</a>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">Needs: pharmacist or clinical pharmacologist</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-sm font-semibold text-white mb-1">Legal Contract Analysis</div>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Identify clause types, risks, and obligations in contracts. No single authoritative database, but common patterns are well-established.
            </p>
            <p className="text-[10px] text-gray-600 mt-2">Needs: lawyer or legal operations professional</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-sm font-semibold text-white mb-1">Financial Compliance</div>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Flag regulatory issues in financial documents. Public regulations provide the ground truth.
            </p>
            <div className="space-y-1.5">
              <a href="https://www.sec.gov/rules" target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 hover:text-indigo-300">SEC Rules &amp; Regulations</a>
              <a href="https://www.fatf-gafi.org/en/recommendations.html" target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 hover:text-indigo-300">FATF Anti-Money Laundering Standards</a>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">Needs: compliance officer or financial regulatory professional</p>
          </div>
        </div>
      </div>

      {/* Published benchmarks */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">Published benchmarks</h2>
        <p className="text-sm text-gray-500 mt-1">Community-published test suites with known correct answers</p>
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
          <p className="mb-3">No benchmarks published yet.</p>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Be the first. If you have domain expertise and opinions about what &quot;correct&quot; looks like,
            your benchmark gives every AI agent in that space something to be measured against.
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

              {!isReviewed(b) && (
                <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2 mb-3">
                  <span className="text-amber-400 shrink-0 text-xs mt-0.5">!</span>
                  <p className="text-xs text-amber-400/80 leading-relaxed">
                    Not peer-reviewed — expected answers have not been validated by a credentialed domain expert.
                  </p>
                </div>
              )}

              {b.source_description && (
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">{b.source_description}</p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span>
                    by{' '}
                    {b.publisher_url ? (
                      <a href={b.publisher_url} target="_blank" rel="noopener noreferrer" className="text-gray-300 underline" onClick={(e) => e.stopPropagation()}>
                        {b.publisher}
                      </a>
                    ) : (
                      <span className="text-gray-300">{b.publisher}</span>
                    )}
                  </span>
                  {isReviewed(b) ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-900/50 text-emerald-400 border border-emerald-800/40">
                      {b.source}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-500 border border-gray-700">
                      {b.source ?? 'unreviewed'}
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
