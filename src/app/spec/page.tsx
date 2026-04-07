export const metadata = {
  title: 'PactSpec — An Open-Source Spec for AI Agent Trust',
  description:
    'An open-source spec for declaring AI agent capabilities, proving they work, and stating what they cost. One JSON file. No platform lock-in.',
};

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  return (
    <pre className={`language-${lang} bg-gray-900 border border-gray-800 rounded-xl p-5 text-xs text-gray-300 overflow-auto font-mono leading-relaxed`}>
      {code}
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-16 scroll-mt-24">
      <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
      {children}
    </section>
  );
}

export default function SpecPage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Origin + pitch */}
      <div className="mb-16 pt-4">
        <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1 rounded-full mb-6">
          v1.0.0 &middot; Open Source
        </div>
        <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
          Every agent responds.<br />
          <span className="text-indigo-400">PactSpec tells you which ones to trust.</span>
        </h1>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <p className="text-gray-300 text-sm leading-relaxed italic">
            &ldquo;After MCP dropped, I wired up a dozen tool servers to a workflow I was building.
            The protocol worked &mdash; every tool responded. But I had no idea if the responses were
            actually correct, what anything cost, or who to blame when things broke at 2am.
            MCP solved the plumbing. Nobody was solving the trust problem. So I started building PactSpec.&rdquo;
          </p>
        </div>
        <p className="text-lg text-gray-400 leading-relaxed mb-6">
          PactSpec is an open, machine-readable format for declaring what an AI agent does, proving it works, and stating what it costs. The spec is <strong className="text-white">completely standalone</strong> &mdash; validate offline, publish to any registry, or self-host.
        </p>
        <div className="flex gap-3 flex-wrap">
          <a
            href="/api/spec/v1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            JSON Schema
          </a>
          <a
            href="https://github.com/Grumpy254/pactspec"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center border border-white/[0.1] hover:border-white/[0.2] bg-white/[0.03] text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>

      {/* The problem */}
      <Section id="problem" title="The problem">
        <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
          <p>
            There are already thousands of AI agents. By next year there will be millions. An
            orchestrator that needs to process an invoice has dozens of options &mdash; but no standard
            way to answer three basic questions:
          </p>
          <div className="grid md:grid-cols-3 gap-4 my-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <p className="text-white font-semibold text-sm mb-1">Does it work?</p>
              <p className="text-gray-500 text-xs">No test results, no benchmarks, no verification</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <p className="text-white font-semibold text-sm mb-1">What does it cost?</p>
              <p className="text-gray-500 text-xs">No pricing metadata, no payment protocol</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <p className="text-white font-semibold text-sm mb-1">Who built it?</p>
              <p className="text-gray-500 text-xs">No provider identity, no audit trail</p>
            </div>
          </div>
        </div>
      </Section>

      {/* On this page */}
      <nav className="mb-16 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">The spec</div>
        <ul className="space-y-2 text-sm columns-2">
          <li><a href="#minimal" className="text-indigo-400 hover:text-indigo-300 transition-colors">Minimal example</a></li>
          <li><a href="#structure" className="text-indigo-400 hover:text-indigo-300 transition-colors">Spec structure</a></li>
          <li><a href="#skills" className="text-indigo-400 hover:text-indigo-300 transition-colors">Skills, schemas &amp; tests</a></li>
          <li><a href="#pricing" className="text-indigo-400 hover:text-indigo-300 transition-colors">Pricing</a></li>
          <li><a href="#offline" className="text-indigo-400 hover:text-indigo-300 transition-colors">Offline validation</a></li>
          <li><a href="#discovery" className="text-indigo-400 hover:text-indigo-300 transition-colors">Discovery</a></li>
          <li><a href="#federation" className="text-indigo-400 hover:text-indigo-300 transition-colors">Federation</a></li>
          <li><a href="#interop" className="text-indigo-400 hover:text-indigo-300 transition-colors">Interoperability</a></li>
          <li><a href="#trust" className="text-indigo-400 hover:text-indigo-300 transition-colors">Trust boundaries</a></li>
          <li><a href="#faq" className="text-indigo-400 hover:text-indigo-300 transition-colors">FAQ</a></li>
        </ul>
      </nav>

      {/* Minimal example */}
      <Section id="minimal" title="Minimal example">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          A valid PactSpec file only needs seven fields. Everything else is optional.
        </p>
        <CodeBlock code={`{
  "specVersion": "1.0.0",
  "id": "urn:pactspec:acme:summarizer",
  "name": "Acme Summarizer",
  "version": "1.0.0",
  "provider": { "name": "Acme Corp" },
  "endpoint": { "url": "https://api.acme.dev/summarize" },
  "skills": [
    {
      "id": "summarize",
      "name": "Summarize Text",
      "description": "Summarizes input text to a concise paragraph",
      "inputSchema": {
        "type": "object",
        "required": ["text"],
        "properties": { "text": { "type": "string" } }
      },
      "outputSchema": {
        "type": "object",
        "required": ["summary"],
        "properties": { "summary": { "type": "string" } }
      }
    }
  ]
}`} />
        <p className="text-gray-500 text-xs mt-3">
          Save as <code className="text-gray-400">agent.pactspec.json</code>. That&apos;s a complete, valid spec.
        </p>
      </Section>

      {/* Spec structure */}
      <Section id="structure" title="Spec structure">
        <div className="space-y-3">
          {[
            { field: 'specVersion', type: '"1.0.0"', desc: 'Schema version.' },
            { field: 'id', type: 'string', desc: 'URN identifier: urn:pactspec:{provider}:{agent-name}' },
            { field: 'name', type: 'string', desc: 'Human-readable name (max 100 chars).' },
            { field: 'version', type: 'string', desc: 'Semver (e.g. "2.1.0").' },
            { field: 'provider', type: 'object', desc: 'Who operates this agent. Required: name.' },
            { field: 'endpoint', type: 'object', desc: 'Where to call it. Required: url.' },
            { field: 'skills', type: 'array', desc: 'What it does. Typed I/O schemas per skill.' },
            { field: 'description', type: 'string', desc: 'What the agent does. Optional.' },
            { field: 'tags', type: 'string[]', desc: 'Searchable tags. Optional.' },
            { field: 'delegation', type: 'object', desc: 'If this wraps another agent. Optional.' },
            { field: 'interop', type: 'object', desc: 'MCP, ACP, or OpenAPI metadata. Optional.' },
          ].map(({ field, type, desc }) => (
            <div key={field} className="flex gap-4 items-start bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
              <code className="text-indigo-400 text-sm font-mono shrink-0 w-28">{field}</code>
              <code className="text-gray-500 text-xs shrink-0 w-20">{type}</code>
              <span className="text-gray-400 text-sm">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-gray-500 text-xs mt-4">
          Full schema: <a href="/api/spec/v1" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">/api/spec/v1</a>
        </p>
      </Section>

      {/* Skills */}
      <Section id="skills" title="Skills, schemas & tests">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Each skill declares typed input and output using JSON Schema. A <code className="text-gray-300">testSuite</code> URL points to HTTP roundtrip tests any validator can run against the live endpoint.
        </p>
        <CodeBlock code={`{
  "id": "classify-icd11",
  "name": "ICD-11 Medical Classifier",
  "description": "Maps clinical text to ICD-11 codes",
  "inputSchema": {
    "type": "object",
    "required": ["text"],
    "properties": { "text": { "type": "string", "maxLength": 5000 } }
  },
  "outputSchema": {
    "type": "object",
    "required": ["code", "description"],
    "properties": {
      "code": { "type": "string" },
      "description": { "type": "string" },
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
    }
  },
  "testSuite": {
    "url": "https://api.acme.dev/tests/classify-icd11.json",
    "type": "http-roundtrip"
  }
}`} />
      </Section>

      {/* Pricing */}
      <Section id="pricing" title="Pricing">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Skills can declare pricing. Consumers know what they&apos;ll pay before they call. The registry verifies the declared price matches what the endpoint actually charges.
        </p>
        <CodeBlock code={`"pricing": {
  "model": "per-invocation",
  "amount": 0.05,
  "currency": "USD",
  "protocol": "stripe"
}`} />
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[
            { model: 'free', desc: 'No cost' },
            { model: 'per-invocation', desc: 'Flat fee per call' },
            { model: 'per-token', desc: 'LLM-style token billing' },
            { model: 'per-second', desc: 'For long-running tasks' },
          ].map(({ model, desc }) => (
            <div key={model} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
              <code className="text-violet-400 text-sm font-mono">{model}</code>
              <p className="text-gray-500 text-xs mt-1">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-gray-500 text-xs mt-4">
          Currencies: USD, USDC, SOL. Protocols: stripe, x402, none.
        </p>
        <p className="text-gray-400 text-sm leading-relaxed mt-4">
          PactSpec ships middleware that handles the payment flow:
          <span className="text-white"> Stripe</span> (metered billing, checkout sessions, free quotas) and
          <span className="text-white"> x402</span> (HTTP 402 micropayments with on-chain verification on Base/Solana).
        </p>
      </Section>

      {/* Offline validation */}
      <Section id="offline" title="Offline validation">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          The CLI validates entirely offline. No network, no registry, no account.
        </p>
        <CodeBlock lang="bash" code={`npm install -g @pactspec/cli

pactspec init -i                    # interactive setup
pactspec validate agent.pactspec.json  # offline schema check
pactspec test agent.pactspec.json      # run tests against live endpoint
pactspec publish agent.pactspec.json   # optional — for registry discovery
pactspec badge agent.pactspec.json     # get a README badge (copies to clipboard)`} />
      </Section>

      {/* Discovery */}
      <Section id="discovery" title="Discovery without a registry">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Agents can serve their spec at <code className="text-gray-300">/.well-known/pactspec.json</code> for direct discovery.
        </p>
        <CodeBlock lang="typescript" code={`import { pactspec } from '@pactspec/register';

app.use(pactspec({
  name: 'Acme Summarizer',
  provider: { name: 'Acme Corp' },
  skills: [{ /* ... */ }]
}));
// Serves spec at GET /.well-known/pactspec.json
// Direct agent-to-agent discovery. No registry needed.`} />
      </Section>

      {/* Federation */}
      <Section id="federation" title="Federation & custom registries">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          The CLI defaults to pactspec.dev but accepts any registry URL.
        </p>
        <CodeBlock lang="bash" code={`pactspec publish agent.json
pactspec publish agent.json --registry https://registry.internal.acme.dev`} />
        <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-5 mt-4">
          <p className="text-sm text-gray-300 font-medium mb-2">The registry is a discovery layer, not a runtime dependency</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            Agents are invoked directly at their endpoint URL. The registry is never in the request path. If it goes down, every agent keeps working.
          </p>
        </div>
      </Section>

      {/* Interoperability */}
      <Section id="interop" title="Interoperability">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          PactSpec complements existing protocols &mdash; it doesn&apos;t replace them.
        </p>
        <div className="overflow-x-auto rounded-xl border border-gray-800 mb-6">
          <table className="w-full text-left">
            <thead className="bg-gray-900">
              <tr>
                <th className="py-3 px-4 text-xs text-gray-500 uppercase tracking-wide">Capability</th>
                <th className="py-3 px-4 text-xs text-gray-500 uppercase tracking-wide">OpenAPI</th>
                <th className="py-3 px-4 text-xs text-gray-500 uppercase tracking-wide">MCP</th>
                <th className="py-3 px-4 text-xs text-indigo-400 uppercase tracking-wide">PactSpec</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                ['Skill-level I/O schemas', '\u2713', '\u2713 input only', '\u2713 input + output'],
                ['Pricing', '\u2717', '\u2717', '\u2713 model + amount + protocol'],
                ['Test suites', '\u2717', '\u2717', '\u2713 HTTP roundtrip tests'],
                ['Verified records', '\u2717', '\u2717', '\u2713 Ed25519 signed results'],
                ['Public registry', '~ commercial', '\u2717', '\u2713 open'],
                ['Payment handling', '\u2717', '\u2717', '\u2713 x402 + Stripe'],
              ].map(([cap, openapi, mcp, pactspec]) => (
                <tr key={cap} className="border-t border-gray-800">
                  <td className="py-3 px-4 text-gray-300">{cap}</td>
                  <td className={`py-3 px-4 ${openapi?.startsWith('\u2713') ? 'text-emerald-400' : openapi?.startsWith('~') ? 'text-yellow-500' : 'text-gray-600'}`}>{openapi}</td>
                  <td className={`py-3 px-4 ${mcp?.startsWith('\u2713') ? 'text-emerald-400' : 'text-gray-600'}`}>{mcp}</td>
                  <td className="py-3 px-4 text-emerald-400">{pactspec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <span className="text-cyan-400 text-sm font-semibold">MCP</span>
            <span className="text-gray-600 text-xs ml-2">Model Context Protocol</span>
            <p className="text-sm text-gray-400 leading-relaxed mt-2">
              MCP handles transport. PactSpec adds verification, pricing, and discovery. The CLI can convert MCP tool definitions to PactSpec skills.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <span className="text-cyan-400 text-sm font-semibold">OpenAPI</span>
            <p className="text-sm text-gray-400 leading-relaxed mt-2">
              Link your existing OpenAPI spec via <code className="text-gray-300">interop.openapi</code>. The CLI can scaffold a PactSpec from an OpenAPI document.
            </p>
          </div>
        </div>
      </Section>

      {/* Trust boundaries */}
      <Section id="trust" title="Trust boundaries">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          PactSpec is honest about what it can and can&apos;t verify.
        </p>
        <div className="space-y-4">
          <div className="bg-gray-900 border border-yellow-900/50 rounded-xl p-5">
            <div className="text-yellow-400 text-sm font-semibold mb-2">Pricing verification is point-in-time</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              The registry calls the endpoint and compares what it charges to what the spec declares. This catches accidental mismatches but is not a strong anti-fraud mechanism.
            </p>
          </div>
          <div className="bg-gray-900 border border-yellow-900/50 rounded-xl p-5">
            <div className="text-yellow-400 text-sm font-semibold mb-2">Delegation is self-declared</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              The registry records that one agent wraps another but does not independently verify the upstream relationship.
            </p>
          </div>
          <div className="bg-gray-900 border border-emerald-900/50 rounded-xl p-5">
            <div className="text-emerald-400 text-sm font-semibold mb-2">Verification is registry-run</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Health checks and benchmarks are executed by the registry directly against the live endpoint. No self-reported metrics. Benchmarks are authored by domain experts, not PactSpec. Every result is reproducible &mdash; run <code className="text-gray-300">pactspec test</code> yourself and get the same score.
            </p>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" title="FAQ">
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-white font-semibold text-sm mb-2">What if pactspec.dev goes down?</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Your agents keep working. The registry is a discovery layer, not a runtime dependency. Agents are invoked directly at their endpoints. The spec is open, and anyone can run their own registry.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-white font-semibold text-sm mb-2">Why trust it?</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Every result is reproducible. Run <code className="text-gray-300 bg-gray-800 px-1 rounded text-xs">pactspec test</code> yourself.
              Results are signed with Ed25519 — verify with the public key at <code className="text-gray-300 bg-gray-800 px-1 rounded text-xs">/api/registry-key</code>. The spec is open, the code is on GitHub, and nothing requires you to use our registry.
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <div className="border-t border-white/[0.06] pt-12 mt-16 text-center">
        <p className="text-gray-400 text-sm mb-6">
          The spec is open. The schema is public. Use it however you want.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <a
            href="/publish"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            Publish an agent
          </a>
          <a
            href="/api/spec/v1"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/[0.1] hover:border-white/[0.2] bg-white/[0.03] text-gray-300 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Download schema
          </a>
          <a
            href="https://github.com/Grumpy254/pactspec"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/[0.1] hover:border-white/[0.2] bg-white/[0.03] text-gray-300 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
