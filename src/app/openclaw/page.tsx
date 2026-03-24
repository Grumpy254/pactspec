'use client';

import { useState, useEffect } from 'react';

interface OpenClawSkill {
  name: string;
  description: string;
  author: string;
  tags: string[];
  toolCount: number;
  clawHubUrl: string;
  githubUrl: string;
  pactSpecGenerated: boolean;
}

function SkillCard({ skill }: { skill: OpenClawSkill }) {
  const [showCommand, setShowCommand] = useState(false);
  const slug = skill.clawHubUrl.split('/').pop() ?? '';
  const command = `pactspec from-openclaw https://clawhub.ai/skills/${slug}`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-indigo-500/50 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-base">{skill.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">by {skill.author}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
            {skill.toolCount} tools
          </span>
          {skill.pactSpecGenerated ? (
            <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full">
              PactSpec available
            </span>
          ) : (
            <span className="text-xs bg-gray-800/60 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">
              Not yet converted
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-4 leading-relaxed">{skill.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {skill.tags.map((tag) => (
          <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowCommand(!showCommand)}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          Generate PactSpec
        </button>
        <a
          href={skill.clawHubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          ClawHub
        </a>
        <a
          href={skill.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          GitHub
        </a>
      </div>

      {showCommand && (
        <div className="mt-3 bg-gray-950 border border-gray-800 rounded-lg p-3 font-mono text-xs text-gray-300">
          <span className="text-gray-600">$</span> {command}
        </div>
      )}
    </div>
  );
}

export default function OpenClawPage() {
  const [skills, setSkills] = useState<OpenClawSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        const res = await fetch(`/api/openclaw?${params}`);
        if (!res.ok) throw new Error(`Failed to load skills`);
        const data = await res.json();
        setSkills(data.skills ?? []);
      } catch {
        setSkills([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-16 pt-8">
        <div className="inline-flex items-center gap-2 bg-orange-950/60 border border-orange-800/50 text-orange-300 text-xs px-3 py-1 rounded-full mb-6">
          OpenClaw Integration
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 tracking-tight leading-tight">
          Verify OpenClaw Skills<br />
          <span className="text-indigo-400">with PactSpec</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-4">
          13,700+ community skills. No way to know which ones work.
          PactSpec adds verification.
        </p>
        <p className="text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
          OpenClaw skills use informal SKILL.md files. PactSpec adds typed schemas,
          test suites, and benchmarks so you can actually verify they work.
        </p>
      </div>

      {/* How it works */}
      <div className="mb-16">
        <h2 className="text-xl font-semibold text-white mb-6 text-center">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-indigo-400 text-sm font-semibold mb-1 uppercase tracking-wide">Step 1</div>
            <div className="font-mono text-sm text-orange-300 bg-gray-950 rounded-lg px-3 py-2 mb-3">
              pactspec from-openclaw &lt;skill-url&gt;
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Converts a SKILL.md to a full PactSpec with typed input/output schemas, tool definitions, and metadata.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-indigo-400 text-sm font-semibold mb-1 uppercase tracking-wide">Step 2</div>
            <div className="text-sm text-white font-medium mb-3 mt-2">Add endpoint &amp; tests</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Point the spec at your live endpoint URL. Add a test suite that exercises the skill&apos;s tools with real inputs and expected outputs.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-indigo-400 text-sm font-semibold mb-1 uppercase tracking-wide">Step 3</div>
            <div className="text-sm text-white font-medium mb-3 mt-2">Publish &amp; benchmark</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Publish to the PactSpec registry. Get a verified badge, a quality score, and continuous re-testing so trust never goes stale.
            </p>
          </div>
        </div>
      </div>

      {/* Popular skills */}
      <div className="mb-16">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Popular OpenClaw Skills</h2>
            <p className="text-sm text-gray-500 mt-1">Convert any of these to a verifiable PactSpec in one command</p>
          </div>
        </div>

        <div className="mb-5">
          <input
            type="text"
            placeholder="Search skills..."
            aria-label="Search OpenClaw skills"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-16">Loading skills...</div>
        ) : skills.length === 0 ? (
          <div className="text-center text-gray-500 py-16">No matching skills found.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {skills.map((skill) => (
              <SkillCard key={skill.name} skill={skill} />
            ))}
          </div>
        )}
      </div>

      {/* Code example */}
      <div className="mb-16">
        <h2 className="text-xl font-semibold text-white mb-5 text-center">Example: convert and publish</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl mx-auto">
          <div className="font-mono text-sm text-gray-300 space-y-3">
            <div>
              <span className="text-gray-600"># Convert any OpenClaw skill to PactSpec</span>
            </div>
            <div>
              <span className="text-gray-500">$</span>{' '}
              <span className="text-orange-300">pactspec from-openclaw</span>{' '}
              <span className="text-indigo-300">https://clawhub.ai/skills/web-search</span>
            </div>
            <div className="text-emerald-400 pl-2">
              Generated web-search.pactspec.json (4 tools, 12 test cases)
            </div>
            <div className="mt-2 pt-3 border-t border-gray-800">
              <span className="text-gray-600"># Or from a local SKILL.md</span>
            </div>
            <div>
              <span className="text-gray-500">$</span>{' '}
              <span className="text-orange-300">pactspec from-openclaw</span>{' '}
              <span className="text-gray-300">./my-skill/SKILL.md</span>{' '}
              <span className="text-gray-500">--endpoint</span>{' '}
              <span className="text-indigo-300">http://localhost:3000</span>
            </div>
            <div className="text-emerald-400 pl-2">
              Generated my-skill.pactspec.json with endpoint http://localhost:3000
            </div>
            <div className="mt-2 pt-3 border-t border-gray-800">
              <span className="text-gray-600"># Test and publish</span>
            </div>
            <div>
              <span className="text-gray-500">$</span>{' '}
              <span className="text-orange-300">pactspec test</span>{' '}
              <span className="text-gray-300">web-search.pactspec.json</span>
            </div>
            <div className="text-emerald-400 pl-2">4/4 tests passed</div>
            <div>
              <span className="text-gray-500">$</span>{' '}
              <span className="text-orange-300">pactspec publish</span>{' '}
              <span className="text-gray-300">web-search.pactspec.json</span>
            </div>
            <div className="text-emerald-400 pl-2">
              Published to registry. Verified badge granted.
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center border border-gray-800 rounded-xl p-10 bg-gradient-to-br from-gray-900 to-indigo-950/20">
        <h2 className="text-2xl font-bold text-white mb-3">Have an OpenClaw skill?</h2>
        <p className="text-gray-400 mb-6">Convert it to a verifiable PactSpec in one command.</p>
        <div className="flex justify-center gap-3 flex-wrap">
          <a
            href="/publish"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Publish your spec
          </a>
          <a
            href="https://github.com/Grumpy254/pactspec"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Install the CLI
          </a>
        </div>
      </div>
    </div>
  );
}
