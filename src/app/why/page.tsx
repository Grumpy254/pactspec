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
          MCP is the dial tone.<br />PactSpec is the phone book.
        </h1>
        <p className="text-lg text-gray-400 leading-relaxed">
          MCP solves how agents get called. Nobody solved how agents get chosen —
          which one works, what it costs, who is accountable when it fails.
          That is the gap PactSpec fills.
        </p>
      </div>

      {/* The problem — orchestrator perspective */}
      <Section title="The problem every orchestrator will hit">
        <div className="space-y-6 text-sm text-gray-300 leading-relaxed">
          <p>
            When there are ten invoice-processing agents in the ecosystem, a developer can evaluate them manually.
            When there are a thousand, that stops working. Orchestrators need to select agents programmatically —
            and right now, there is no standard way to compare them.
          </p>
          <p>
            MCP tells your orchestrator <em>how</em> to invoke a tool. It says nothing about which tool to trust,
            what it will cost before you commit, or whether it passed any kind of verification.
            The result: orchestrators hardcode specific vendors, enterprises manually vet every agent they approve,
            and the &quot;agent economy&quot; stays fragmented.
          </p>
          <p>
            PactSpec is the standard that makes automated agent selection possible.
          </p>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Without PactSpec</p>
            <CodeBlock lang="js" code={`// Hardcoded — one vendor, no comparison
const res = await fetch(
  'https://api.vendor-a.com/invoice',
  { method: 'POST', body: ... }
);
// No idea what this costs until billed.
// No idea if it was verified.
// Cannot switch vendors without rewriting.`} />
          </div>
          <div className="bg-gray-900 border border-indigo-900/50 rounded-xl p-5">
            <p className="text-xs text-indigo-400 uppercase tracking-wide mb-3">With PactSpec</p>
            <CodeBlock lang="js" code={`import { search } from '@pactspec/sdk';

const { agents } = await search({
  q: 'invoice',
  verifiedOnly: true,
});

// agents[0].spec.skills[0].pricing
// → { model: 'per-invocation',
//     amount: 0.02, currency: 'USD' }
// agents[0].verified → true
// Switch vendors by changing one filter.`} />
          </div>
        </div>
      </Section>

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
              <CompareRow feature="Verified record (SHA-256 fingerprint)" openapi="✗ Not supported" mcp="✗ Not supported" pactspec="✓ Tamper-evident record; Ed25519 signing planned v1.1" />
              <CompareRow feature="Public registry" openapi="~ Swagger Hub (commercial)" mcp="✗ No standard registry" pactspec="✓ Open registry at pactspec.dev" />
              <CompareRow feature="Machine-readable discovery" openapi="~ Via OpenAPI portals" mcp="✗ Not supported" pactspec="✓ /api/agents.md for agent consumers" />
              <CompareRow feature="Payment protocol routing" openapi="✗ Not supported" mcp="✗ Not supported" pactspec="✓ x402, Stripe, none" />
            </tbody>
          </table>
        </div>
      </Section>

      {/* What verification proves — and doesn't */}
      <Section title="What a verified badge means — and doesn't">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-emerald-900/50 rounded-xl p-6">
            <p className="text-emerald-400 font-semibold text-sm mb-4">What it means</p>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">✓</span>
                The registry fetched the agent&apos;s published test suite
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">✓</span>
                The agent&apos;s endpoint passed every test in that suite at the time of verification
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">✓</span>
                The result is stored as a SHA-256 fingerprint that changes if the agent ID, skill, results, or timestamp changes
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">✓</span>
                The spec has not been modified since verification — spec hash is checked on every update
              </li>
            </ul>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 font-semibold text-sm mb-4">What it does not mean</p>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="text-gray-600 shrink-0">✗</span>
                It does not prove the test suite is comprehensive or adversarial
              </li>
              <li className="flex gap-2">
                <span className="text-gray-600 shrink-0">✗</span>
                It does not prove the agent will perform the same way tomorrow
              </li>
              <li className="flex gap-2">
                <span className="text-gray-600 shrink-0">✗</span>
                It is not a cryptographic signature — the registry is a trusted third party, not a trustless proof system. Ed25519 signing is planned for v1.1.
              </li>
              <li className="flex gap-2">
                <span className="text-gray-600 shrink-0">✗</span>
                Pricing amounts are self-declared metadata — not monitored or enforced by the registry
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* The three objections */}
      <Section title="The three objections — answered">
        <div className="space-y-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-indigo-400 font-mono text-sm mb-2">&ldquo;We already have OpenAPI&rdquo;</p>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              OpenAPI describes your HTTP surface. PactSpec declares your agent&apos;s <em>capabilities</em> — skills with
              typed inputs and outputs, pricing, and a test suite anyone can run to verify your claims.
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
              no verified records, and no registry. PactSpec is the layer that makes an agent
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
              own test suite, the registry records a SHA-256 fingerprint bound to your agent ID,
              skill, results, and timestamp. That record is permanent and tamper-evident — visible to every consumer
              who finds you in the registry — confirming your agent passed its declared tests at that point in time.
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
      "testSuite": {
        "url": "https://acme.com/tests/extract-line-items.json"
      }
    }
  ],
  "tags": ["finance", "document-processing"]
}`} />
      </Section>

      {/* MCP bridge */}
      <Section title="Already on MCP? Three lines.">
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          PactSpec is not a replacement for MCP. MCP handles invocation. PactSpec handles trust and
          discovery. If you already have an MCP server, you can publish a PactSpec and add an{' '}
          <code className="text-indigo-400 text-xs bg-gray-800 px-1 py-0.5 rounded">x-pactspec</code>{' '}
          extension to your existing tool manifest — no migration, no changes to your server.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-2">Your MCP tool manifest (unchanged)</p>
            <CodeBlock code={`{
  "name": "invoice-processor",
  "description": "Extracts line items",
  "inputSchema": { ... },
  "x-pactspec": {
    "registry": "https://pactspec.dev/api/agents/urn:pactspec:acme:invoice-processor",
    "verified": true
  }
}`} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">What consumers gain</p>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">✓</span>
                Pricing declaration visible before invocation
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">✓</span>
                Verified badge — passed its own test suite
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">✓</span>
                Discoverable in the registry without changing your MCP server
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">✓</span>
                Output schema — the one thing MCP doesn&apos;t define
              </li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-4">
          Full MCP integration guide: <a href="/interop/mcp" className="underline hover:text-gray-400">interop/mcp</a>
        </p>
      </Section>

      {/* Machine-readable discovery */}
      <Section title="The endpoint orchestrators actually read">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Every registered agent is available at a single machine-readable endpoint. An orchestrator
          can fetch this once and make informed routing decisions without any hardcoding.
        </p>
        <CodeBlock lang="bash" code={`GET https://pactspec.dev/api/agents.md

# PactSpec Registry
> schema: https://pactspec.dev/schema/v1.json
> updated: 2025-01-15T10:00:00Z
> total: 42

## Invoice Processor v1.2.0
id: urn:pactspec:acme:invoice-processor
endpoint: https://api.acme.com/agent
verified: YES (2025-01-14T09:00:00Z)
skills: extract-line-items, classify-document
pricing: 0.01 USD/per-invocation via stripe`} />
        <p className="text-xs text-gray-500 mt-3">
          Also available as JSON: <code className="text-gray-400">GET /api/agents?verified=true&amp;tags=invoice</code>
        </p>
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
