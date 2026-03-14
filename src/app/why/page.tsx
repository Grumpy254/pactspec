export const metadata = {
  title: 'Why PactSpec — The case for a machine-readable agent standard',
  description:
    'OpenAPI describes HTTP APIs. MCP connects tools to models. PactSpec declares what an agent can do, what it costs, and whether it works.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
      {children}
    </section>
  );
}

function CompareRow({
  feature,
  openapi,
  mcp,
  pactspec,
}: {
  feature: string;
  openapi: string;
  mcp: string;
  pactspec: string;
}) {
  const tick = 'text-emerald-400';
  const cross = 'text-gray-600';
  const partial = 'text-yellow-500';

  function cell(val: string) {
    const isYes = val.startsWith('✓');
    const isNo = val.startsWith('✗');
    return (
      <td className={`py-3 px-4 text-sm ${isYes ? tick : isNo ? cross : partial}`}>
        {val}
      </td>
    );
  }

  return (
    <tr className="border-t border-gray-800">
      <td className="py-3 px-4 text-sm text-gray-300">{feature}</td>
      {cell(openapi)}
      {cell(mcp)}
      {cell(pactspec)}
    </tr>
  );
}

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  return (
    <pre className={`language-${lang} bg-gray-900 border border-gray-800 rounded-xl p-5 text-xs text-gray-300 overflow-auto font-mono leading-relaxed`}>
      {code}
    </pre>
  );
}

export default function WhyPage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="mb-16 pt-4">
        <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1 rounded-full mb-6">
          Why PactSpec?
        </div>
        <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
          The gap OpenAPI, MCP, and A2A don&apos;t fill
        </h1>
        <p className="text-lg text-gray-400 leading-relaxed">
          Every major agent protocol solves one piece of the puzzle.
          None of them answers the questions an agent consumer actually needs:
          <span className="text-white"> what can this agent do, what does it cost, can I trust it, and how do I know it works?</span>
        </p>
      </div>

      {/* Comparison table */}
      <Section title="How the standards compare">
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-left">
            <thead className="bg-gray-900">
              <tr>
                <th className="py-3 px-4 text-xs text-gray-500 uppercase tracking-wide">Feature</th>
                <th className="py-3 px-4 text-xs text-gray-500 uppercase tracking-wide">OpenAPI</th>
                <th className="py-3 px-4 text-xs text-gray-500 uppercase tracking-wide">MCP</th>
                <th className="py-3 px-4 text-xs text-indigo-400 uppercase tracking-wide">PactSpec</th>
              </tr>
            </thead>
            <tbody>
              <CompareRow feature="HTTP endpoint description" openapi="✓ Core use case" mcp="~ Via tools" pactspec="✓ Required" />
              <CompareRow feature="Input / output schemas" openapi="✓ Request/response" mcp="✓ Tool inputSchema" pactspec="✓ Per-skill" />
              <CompareRow feature="Pricing metadata" openapi="✗ Not supported" mcp="✗ Not supported" pactspec="✓ Model, amount, currency, protocol" />
              <CompareRow feature="Executable test suite" openapi="✗ Not supported" mcp="✗ Not supported" pactspec="✓ HTTP roundtrip tests at a URL" />
              <CompareRow feature="Cryptographic attestation" openapi="✗ Not supported" mcp="✗ Not supported" pactspec="✓ SHA-256 hash bound to agent + results" />
              <CompareRow feature="SLA declarations" openapi="✗ Not supported" mcp="✗ Not supported" pactspec="✓ p99 latency, uptime guarantee" />
              <CompareRow feature="Public registry" openapi="~ Swagger Hub (commercial)" mcp="✗ No standard registry" pactspec="✓ Open registry at pactspec.dev" />
              <CompareRow feature="Machine-readable discovery" openapi="~ Via OpenAPI portals" mcp="✗ Not supported" pactspec="✓ /api/agents.md for agent consumers" />
              <CompareRow feature="Payment protocol routing" openapi="✗ Not supported" mcp="✗ Not supported" pactspec="✓ x402, Stripe, none" />
            </tbody>
          </table>
        </div>
      </Section>

      {/* The three objections */}
      <Section title="The three objections — answered">
        <div className="space-y-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-indigo-400 font-mono text-sm mb-2">&ldquo;We already have OpenAPI&rdquo;</p>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              OpenAPI describes your HTTP surface. PactSpec declares your agent&apos;s <em>capabilities</em> — skills with
              typed inputs and outputs, pricing, SLAs, and a test suite anyone can run to verify your claims.
              They&apos;re complementary: convert your OpenAPI to PactSpec in one command and gain the registry,
              attestation, and discovery layer on top.
            </p>
            <CodeBlock lang="bash" code={`pactspec convert openapi my-api.yaml -o pactspec.json
pactspec validate pactspec.json
pactspec publish pactspec.json --agent-id my-agent@acme.com`} />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-indigo-400 font-mono text-sm mb-2">&ldquo;MCP already does this&rdquo;</p>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              MCP solves tool invocation between a model and a server at runtime. It has no pricing, no test suites,
              no SLAs, no attestation, and no registry. PactSpec is the layer that makes an agent
              <em> discoverable and trustworthy before</em> it is ever invoked — the capability declaration
              that sits above the transport layer.
            </p>
            <p className="text-gray-500 text-xs">Convert your MCP tool manifest:</p>
            <CodeBlock lang="bash" code={`pactspec convert mcp server-manifest.json -o pactspec.json`} />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-indigo-400 font-mono text-sm mb-2">&ldquo;Why would I publish my agent here?&rdquo;</p>
            <p className="text-gray-300 text-sm leading-relaxed">
              The verified badge is a trust signal other registries don&apos;t offer. When your agent passes its
              own test suite, the registry issues a cryptographic attestation hash bound to your agent ID,
              skill, results, and timestamp. That hash is permanent proof — visible to every consumer
              who finds you in the registry — that your agent did what it claims, at that point in time.
            </p>
          </div>
        </div>
      </Section>

      {/* What the spec looks like */}
      <Section title="What a PactSpec looks like">
        <p className="text-gray-400 text-sm mb-4">
          A single JSON file that a model, an orchestrator, or a marketplace can read without calling your API.
        </p>
        <CodeBlock code={`{
  "specVersion": "1.0.0",
  "id": "urn:pactspec:acme:invoice-processor",
  "name": "Invoice Processor",
  "version": "1.2.0",
  "provider": { "name": "Acme Corp", "url": "https://acme.com" },
  "endpoint": { "url": "https://api.acme.com/agent" },
  "skills": [
    {
      "id": "extract-line-items",
      "name": "Extract Line Items",
      "description": "Extracts structured line items from invoice PDFs",
      "inputSchema": {
        "type": "object",
        "required": ["url"],
        "properties": { "url": { "type": "string", "format": "uri" } }
      },
      "outputSchema": {
        "type": "object",
        "required": ["lineItems"],
        "properties": {
          "lineItems": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "description": { "type": "string" },
                "amount": { "type": "number" }
              }
            }
          }
        }
      },
      "pricing": {
        "model": "per-invocation",
        "amount": 0.01,
        "currency": "USD",
        "protocol": "stripe"
      },
      "sla": { "p99LatencyMs": 3000, "uptimeSLA": 0.999 },
      "testSuite": {
        "url": "https://acme.com/tests/extract-line-items.json"
      }
    }
  ],
  "tags": ["finance", "document-processing"]
}`} />
      </Section>

      {/* Get started */}
      <Section title="Get started in 2 minutes">
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-400 text-xs flex items-center justify-center font-bold">1</span>
            <div>
              <p className="text-white text-sm font-medium mb-1">Install the CLI</p>
              <CodeBlock lang="bash" code="npm install -g @pactspec/cli" />
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-400 text-xs flex items-center justify-center font-bold">2</span>
            <div>
              <p className="text-white text-sm font-medium mb-1">Generate a spec or convert from OpenAPI</p>
              <CodeBlock lang="bash" code={`pactspec init
# or
pactspec convert openapi my-api.yaml`} />
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-400 text-xs flex items-center justify-center font-bold">3</span>
            <div>
              <p className="text-white text-sm font-medium mb-1">Validate and publish</p>
              <CodeBlock lang="bash" code={`pactspec validate pactspec.json
pactspec publish pactspec.json --agent-id you@yourorg.com`} />
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-400 text-xs flex items-center justify-center font-bold">4</span>
            <div>
              <p className="text-white text-sm font-medium mb-1">Get verified</p>
              <CodeBlock lang="bash" code="pactspec verify <agent-id> <skill-id>" />
            </div>
          </div>
        </div>

        <div className="mt-10 flex gap-4">
          <a
            href="/publish"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            Publish your agent
          </a>
          <a
            href="/"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            Browse the registry
          </a>
        </div>
      </Section>
    </div>
  );
}
