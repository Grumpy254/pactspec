export const metadata = {
  title: 'PactSpec v1.0.0 — The Open Standard for AI Agent Trust',
  description:
    'A machine-readable JSON spec for declaring AI agent capabilities, pricing, and test suites. Use it standalone — no platform required.',
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
      {/* Header */}
      <div className="mb-16 pt-4">
        <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1 rounded-full mb-6">
          v1.0.0 &middot; JSON Schema Draft 2020-12
        </div>
        <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
          The PactSpec Standard
        </h1>
        <p className="text-lg text-gray-400 leading-relaxed mb-6">
          PactSpec is an open, machine-readable format for declaring what an AI agent does, proving it works, and stating what it costs. The spec is <strong className="text-white">completely standalone</strong> &mdash; you can use it without a registry, without a platform, without pactspec.dev.
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

      {/* On this page */}
      <nav className="mb-16 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">On this page</div>
        <ul className="space-y-2 text-sm">
          <li><a href="#minimal" className="text-indigo-400 hover:text-indigo-300 transition-colors">Minimal example</a></li>
          <li><a href="#structure" className="text-indigo-400 hover:text-indigo-300 transition-colors">Spec structure</a></li>
          <li><a href="#skills" className="text-indigo-400 hover:text-indigo-300 transition-colors">Skills, schemas &amp; tests</a></li>
          <li><a href="#pricing" className="text-indigo-400 hover:text-indigo-300 transition-colors">Pricing</a></li>
          <li><a href="#offline" className="text-indigo-400 hover:text-indigo-300 transition-colors">Offline validation</a></li>
          <li><a href="#discovery" className="text-indigo-400 hover:text-indigo-300 transition-colors">Discovery without a registry</a></li>
          <li><a href="#federation" className="text-indigo-400 hover:text-indigo-300 transition-colors">Federation &amp; custom registries</a></li>
          <li><a href="#interop" className="text-indigo-400 hover:text-indigo-300 transition-colors">Interoperability</a></li>
          <li><a href="#trust" className="text-indigo-400 hover:text-indigo-300 transition-colors">Trust boundaries</a></li>
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
        "properties": {
          "text": { "type": "string" }
        }
      },
      "outputSchema": {
        "type": "object",
        "required": ["summary"],
        "properties": {
          "summary": { "type": "string" }
        }
      }
    }
  ]
}`} />
        <p className="text-gray-500 text-xs mt-3">
          Save this as <code className="text-gray-400">agent.pactspec.json</code> and you have a complete, valid spec.
        </p>
      </Section>

      {/* Spec structure */}
      <Section id="structure" title="Spec structure">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Every PactSpec file is a JSON object with these top-level fields:
        </p>
        <div className="space-y-3">
          {[
            { field: 'specVersion', type: '"1.0.0"', desc: 'Schema version. Always "1.0.0" for v1 specs.' },
            { field: 'id', type: 'string', desc: 'Unique URN identifier. Format: urn:pactspec:{provider}:{agent-name}' },
            { field: 'name', type: 'string', desc: 'Human-readable agent name (max 100 chars).' },
            { field: 'version', type: 'string', desc: 'Semantic version of this agent (e.g. "2.1.0").' },
            { field: 'provider', type: 'object', desc: 'Who operates this agent. Required: name. Optional: url, contact.' },
            { field: 'endpoint', type: 'object', desc: 'Where to call this agent. Required: url. Optional: auth config.' },
            { field: 'skills', type: 'array', desc: 'What this agent can do. Each skill has typed I/O schemas.' },
            { field: 'description', type: 'string', desc: 'What this agent does (max 500 chars). Optional.' },
            { field: 'tags', type: 'string[]', desc: 'Searchable tags (e.g. "nlp", "medical"). Optional.' },
            { field: 'license', type: 'string', desc: 'SPDX license identifier. Optional.' },
            { field: 'delegation', type: 'object', desc: 'If this agent wraps another. Links to upstream spec ID. Optional.' },
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
          Bold fields are required. Full schema: <a href="/api/spec/v1" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">/api/spec/v1</a>
        </p>
      </Section>

      {/* Skills */}
      <Section id="skills" title="Skills, schemas & tests">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Each skill declares typed input and output using standard JSON Schema. Optionally, a <code className="text-gray-300">testSuite</code> URL points to a set of HTTP roundtrip tests that any validator can run against the live endpoint.
        </p>
        <CodeBlock code={`{
  "id": "classify-icd11",
  "name": "ICD-11 Medical Classifier",
  "description": "Maps clinical text to ICD-11 codes",
  "inputSchema": {
    "type": "object",
    "required": ["text"],
    "properties": {
      "text": { "type": "string", "maxLength": 5000 }
    }
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
        <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-5 mt-4">
          <p className="text-sm text-gray-300 font-medium mb-2">Test suites are portable</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            Test suites are hosted at any URL you control. The PactSpec CLI, any compatible registry, or your own CI pipeline can fetch and execute them. No vendor dependency.
          </p>
        </div>
      </Section>

      {/* Pricing */}
      <Section id="pricing" title="Pricing">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Skills can optionally declare pricing. This makes costs machine-readable &mdash; consumers know what they&apos;ll pay before they call.
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
          Supported currencies: USD, USDC, SOL. Supported protocols: stripe, x402, none.
        </p>
      </Section>

      {/* Offline validation */}
      <Section id="offline" title="Offline validation">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          The CLI validates specs entirely offline using the bundled JSON Schema. No network calls, no registry, no account.
        </p>
        <CodeBlock lang="bash" code={`# Install
npm install -g @pactspec/cli

# Create a spec interactively
pactspec init -i

# Validate offline — zero network calls
pactspec validate agent.pactspec.json

# Run tests against your live endpoint
pactspec test agent.pactspec.json

# Publishing is optional — only if you want registry discovery
pactspec publish agent.pactspec.json`} />
        <p className="text-gray-400 text-sm leading-relaxed mt-4">
          The SDK also validates offline:
        </p>
        <CodeBlock lang="typescript" code={`import { validate } from '@pactspec/sdk';

const result = validate(mySpec);
// { valid: true, errors: [] }
// No network calls. Uses bundled AJV schema.`} />
      </Section>

      {/* Discovery without a registry */}
      <Section id="discovery" title="Discovery without a registry">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Agents can be discovered directly using the <code className="text-gray-300">.well-known</code> convention &mdash; no registry needed.
        </p>
        <CodeBlock lang="bash" code={`# Any agent can serve its spec at a well-known path
GET https://api.acme.dev/.well-known/pactspec.json

# The @pactspec/register middleware does this automatically
npm install @pactspec/register`} />
        <CodeBlock lang="typescript" code={`import { pactspec } from '@pactspec/register';

app.use(pactspec({
  name: 'Acme Summarizer',
  provider: { name: 'Acme Corp' },
  skills: [{ /* ... */ }]
}));

// Now serves spec at GET /.well-known/pactspec.json
// Direct agent-to-agent discovery. No registry in the loop.`} />
      </Section>

      {/* Federation */}
      <Section id="federation" title="Federation & custom registries">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          The CLI and SDK default to pactspec.dev but accept any registry URL. You can run your own registry, use a private internal one, or skip registries entirely.
        </p>
        <CodeBlock lang="bash" code={`# Publish to pactspec.dev (default)
pactspec publish agent.json

# Publish to your own registry
pactspec publish agent.json --registry https://registry.internal.acme.dev

# Publish to multiple registries
pactspec publish agent.json --registry https://pactspec.dev
pactspec publish agent.json --registry https://registry.internal.acme.dev`} />
        <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-5 mt-4">
          <p className="text-sm text-gray-300 font-medium mb-2">The registry is a discovery layer, not a runtime dependency</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            Agents are always invoked directly at their declared endpoint URL. The registry is never in the request path. If a registry goes down, every agent keeps working.
          </p>
        </div>
      </Section>

      {/* Interoperability */}
      <Section id="interop" title="Interoperability">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          PactSpec is designed to complement existing protocols, not replace them.
        </p>
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-cyan-400 text-sm font-semibold">MCP</span>
              <span className="text-gray-600 text-xs">Model Context Protocol</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              MCP handles the transport &mdash; PactSpec adds what MCP doesn&apos;t: verification, pricing, and discovery. Declare your MCP server URL in the spec&apos;s <code className="text-gray-300">interop.mcp</code> field. The CLI can convert MCP tool definitions to PactSpec skills.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-cyan-400 text-sm font-semibold">OpenAPI</span>
              <span className="text-gray-600 text-xs">REST API specs</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Link your existing OpenAPI spec via <code className="text-gray-300">interop.openapi</code>. The CLI can scaffold a PactSpec file from an OpenAPI document.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-cyan-400 text-sm font-semibold">ACP</span>
              <span className="text-gray-600 text-xs">Agent Context Protocol</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              For session-based agents that maintain state across turns. Declare supported session types in <code className="text-gray-300">interop.acp</code>.
            </p>
          </div>
        </div>
      </Section>

      {/* Trust boundaries */}
      <Section id="trust" title="Trust boundaries">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          PactSpec is honest about what it can and can&apos;t verify. Understanding these boundaries helps you interpret trust signals correctly.
        </p>
        <div className="space-y-4">
          <div className="bg-gray-900 border border-yellow-900/50 rounded-xl p-5">
            <div className="text-yellow-400 text-sm font-semibold mb-2">Pricing verification is point-in-time</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Pricing drift detection works by calling the endpoint and comparing what it charges to what the spec declares. This is a point-in-time check &mdash; the endpoint controls actual pricing at call time. Drift detection catches accidental mismatches well, but is not a strong anti-fraud mechanism against a deliberately deceptive agent.
            </p>
          </div>
          <div className="bg-gray-900 border border-yellow-900/50 rounded-xl p-5">
            <div className="text-yellow-400 text-sm font-semibold mb-2">Delegation is self-declared</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Delegation chains are self-declared by the agent provider. The registry records the claim that one agent wraps another but does not independently verify the upstream relationship.
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
