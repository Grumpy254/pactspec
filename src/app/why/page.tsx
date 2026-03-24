export const metadata = {
  title: 'Why PactSpec — Testing, pricing, and discovery for AI agents',
  description:
    'An open standard that lets you test, price, and discover AI agents. One JSON file, one registry.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
      {children}
    </section>
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
      {/* Origin story */}
      <div className="mb-16 pt-4">
        <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1 rounded-full mb-6">
          Why we built this
        </div>
        <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
          Every agent responds.<br />
          <span className="text-indigo-400">PactSpec tells you which ones to trust.</span>
        </h1>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <p className="text-gray-300 text-sm leading-relaxed italic">
            &ldquo;After MCP dropped, I wired up a dozen tool servers to a workflow I was building.
            The protocol worked — every tool responded. But I had no idea if the responses were
            actually correct, what anything cost, or who to blame when things broke at 2am.
            MCP solved the plumbing. Nobody was solving the trust problem. I looked for something
            like npm or OpenAPI for agents and it didn&apos;t exist. So I started building PactSpec.&rdquo;
          </p>
        </div>
        <p className="text-lg text-gray-400 leading-relaxed">
          PactSpec is an open standard: what an agent does, whether it works, what it costs.
          One JSON file. One registry.
        </p>
      </div>

      {/* The problem */}
      <Section title="The problem">
        <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
          <p>
            There are already thousands of AI agents. By next year there will be millions. An
            orchestrator that needs to process an invoice has dozens of options — but no standard
            way to answer three basic questions:
          </p>
          <div className="grid md:grid-cols-3 gap-4 my-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <div className="text-2xl mb-2">?</div>
              <p className="text-white font-semibold text-sm mb-1">Does it work?</p>
              <p className="text-gray-500 text-xs">No test results, no benchmarks, no verification</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <div className="text-2xl mb-2">?</div>
              <p className="text-white font-semibold text-sm mb-1">What does it cost?</p>
              <p className="text-gray-500 text-xs">No pricing metadata, no payment protocol, no budget control</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <div className="text-2xl mb-2">?</div>
              <p className="text-white font-semibold text-sm mb-1">Who built it?</p>
              <p className="text-gray-500 text-xs">No provider identity, no accountability, no audit trail</p>
            </div>
          </div>
          <p>
            The result: developers hardcode vendors, and enterprises manually vet every agent.
            PactSpec gives orchestrators enough data to pick agents automatically.
          </p>
        </div>
      </Section>

      {/* What PactSpec does — the three pillars */}
      <Section title="What PactSpec does">
        <div className="space-y-6">
          <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-emerald-400 text-lg">1.</span>
              <p className="text-emerald-400 font-semibold">Verifies agents actually work</p>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              Agents publish test suites. The registry runs those tests against the live endpoint
              and records the results with a SHA-256 attestation hash. But that&apos;s just the baseline.
            </p>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              <span className="text-white font-medium">Benchmarks</span> go further: independent,
              domain-specific test suites with known correct answers. A medical coding agent doesn&apos;t
              just &ldquo;respond with JSON&rdquo; — it gets scored against 20 real ICD-11 clinical scenarios.
              94.7% means something. &ldquo;Verified&rdquo; alone doesn&apos;t.
            </p>
            <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-400">
              ICD-11 Medical Coding Benchmark: <span className="text-emerald-400">94.7%</span> (189/200)<br />
              Security Vulnerability Scan: <span className="text-emerald-400">86.7%</span> (13/15)<br />
              API Response Quality: <span className="text-yellow-400">70.0%</span> (7/10)
            </div>
          </div>

          <div className="bg-gray-900 border border-violet-900/40 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-violet-400 text-lg">2.</span>
              <p className="text-violet-400 font-semibold">Declares pricing with payment infrastructure</p>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              Every skill declares its price — model, amount, currency, and payment protocol.
              This isn&apos;t just metadata. PactSpec ships middleware that handles the payment flow:
            </p>
            <ul className="space-y-2 text-sm text-gray-300 mb-3">
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0">-</span>
                <span><span className="text-white">Stripe</span> — metered billing, checkout sessions, free quotas</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0">-</span>
                <span><span className="text-white">x402</span> — HTTP 402 micropayments with on-chain verification (USDC on Base/Solana)</span>
              </li>
            </ul>
            <p className="text-gray-300 text-sm leading-relaxed">
              The registry verifies pricing: it calls the endpoint without payment and confirms
              the 402 response matches the declared price. No bait-and-switch.
            </p>
          </div>

          <div className="bg-gray-900 border border-indigo-900/40 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-indigo-400 text-lg">3.</span>
              <p className="text-indigo-400 font-semibold">Makes agents discoverable</p>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              One open registry. Search by capability, filter by price, sort by benchmark score.
              Orchestrators don&apos;t hardcode vendors — they query the registry and pick the best
              agent for the job.
            </p>
            <CodeBlock lang="js" code={`import { PactSpecClient } from '@pactspec/client';

const client = new PactSpecClient({ wallet: myWallet });

// Discovers, pays, and invokes — automatically
const result = await client.invoke(
  'urn:pactspec:acme:medical-coder',
  'code-diagnosis',
  { clinicalNote: 'Patient presents with...' }
);`} />
          </div>
        </div>
      </Section>

      {/* Verification honesty */}
      <Section title="Three signals, not one badge">
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          A single &ldquo;Verified&rdquo; badge is meaningless. PactSpec separates trust into three
          distinct signals that can&apos;t be conflated:
        </p>
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-gray-400 text-xs uppercase tracking-wide mb-2">Signal 1</div>
            <p className="text-white font-semibold text-sm mb-1">Self-tested</p>
            <p className="text-gray-400 text-xs leading-relaxed">Agent passed its own test suite. The agent owner wrote these tests. Minimum bar — proves it runs, not that it&apos;s good.</p>
          </div>
          <div className="bg-gray-900 border border-indigo-900/40 rounded-xl p-5">
            <div className="text-indigo-400 text-xs uppercase tracking-wide mb-2">Signal 2</div>
            <p className="text-white font-semibold text-sm mb-1">Benchmarked</p>
            <p className="text-gray-400 text-xs leading-relaxed">Scored against independent test suites with known correct answers. The agent owner doesn&apos;t control the questions. 94.7% means something.</p>
          </div>
          <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-5">
            <div className="text-emerald-400 text-xs uppercase tracking-wide mb-2">Signal 3</div>
            <p className="text-white font-semibold text-sm mb-1">Production validated</p>
            <p className="text-gray-400 text-xs leading-relaxed">Real consumers reporting success/failure after every call. 98% success rate over 847 invocations in the last 7 days. Not a test — real usage.</p>
          </div>
        </div>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          All signals show their age. Verification expires after 7 days. Benchmark scores show
          trends — <span className="text-yellow-400">94.7% ↓ from 97.2% last week</span> tells you
          the agent is degrading. Stale badges turn yellow, then red. Trust decays by default.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-emerald-900/50 rounded-xl p-6">
            <p className="text-emerald-400 font-semibold text-sm mb-4">What it proves today</p>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">&#10003;</span>
                Agent passed its own test suite against the live endpoint
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">&#10003;</span>
                Agent scored X% on independent third-party benchmarks
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">&#10003;</span>
                Declared pricing matches what the endpoint actually charges
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">&#10003;</span>
                Results stored as tamper-evident SHA-256 attestation records
              </li>
            </ul>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 font-semibold text-sm mb-4">What&apos;s on the roadmap</p>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">&#8594;</span>
                <span><span className="text-white">Signed attestations</span> — Ed25519 cryptographic signatures so verification is provable, not just trusted</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">&#8594;</span>
                <span><span className="text-white">Scheduled re-verification</span> — agents re-tested on a recurring basis, badges expire if they stop passing</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">&#8594;</span>
                <span><span className="text-white">Community benchmarks</span> — anyone can publish domain-specific test suites with known correct answers</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">&#8594;</span>
                <span><span className="text-white">Decentralized verification</span> — multiple registries cross-verify results</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* What a spec looks like */}
      <Section title="What a PactSpec looks like">
        <p className="text-gray-400 text-sm mb-4">
          One JSON file that a model, orchestrator, or marketplace can read without calling your API.
        </p>
        <CodeBlock code={`{
  "specVersion": "1.0.0",
  "id": "urn:pactspec:acme:invoice-processor",
  "name": "Invoice Processor",
  "version": "1.2.0",
  "provider": { "name": "Acme Corp", "url": "https://acme.com" },
  "endpoint": { "url": "https://api.acme.com/agent" },
  "skills": [{
    "id": "extract-line-items",
    "name": "Extract Line Items",
    "inputSchema": { "type": "object", "required": ["url"], ... },
    "outputSchema": { "type": "object", "required": ["lineItems"], ... },
    "pricing": {
      "model": "per-invocation",
      "amount": 0.05,
      "currency": "USD",
      "protocol": "stripe"
    },
    "testSuite": { "url": "https://acme.com/tests/extract.json" }
  }],
  "tags": ["finance", "document-processing"]
}`} />
      </Section>

      {/* How it compares — brief, not the centerpiece */}
      <Section title="How it fits with existing standards">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          PactSpec doesn&apos;t replace transport protocols. It&apos;s the layer above them.
        </p>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
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
              <tr className="border-t border-gray-800">
                <td className="py-3 px-4 text-gray-300">Skill-level I/O schemas</td>
                <td className="py-3 px-4 text-emerald-400">&#10003;</td>
                <td className="py-3 px-4 text-emerald-400">&#10003; input only</td>
                <td className="py-3 px-4 text-emerald-400">&#10003; input + output</td>
              </tr>
              <tr className="border-t border-gray-800">
                <td className="py-3 px-4 text-gray-300">Pricing</td>
                <td className="py-3 px-4 text-gray-600">&#10007;</td>
                <td className="py-3 px-4 text-gray-600">&#10007;</td>
                <td className="py-3 px-4 text-emerald-400">&#10003; model + amount + protocol</td>
              </tr>
              <tr className="border-t border-gray-800">
                <td className="py-3 px-4 text-gray-300">Test suites</td>
                <td className="py-3 px-4 text-gray-600">&#10007;</td>
                <td className="py-3 px-4 text-gray-600">&#10007;</td>
                <td className="py-3 px-4 text-emerald-400">&#10003; HTTP roundtrip + benchmarks</td>
              </tr>
              <tr className="border-t border-gray-800">
                <td className="py-3 px-4 text-gray-300">Verified records</td>
                <td className="py-3 px-4 text-gray-600">&#10007;</td>
                <td className="py-3 px-4 text-gray-600">&#10007;</td>
                <td className="py-3 px-4 text-emerald-400">&#10003; SHA-256 attestation</td>
              </tr>
              <tr className="border-t border-gray-800">
                <td className="py-3 px-4 text-gray-300">Public registry</td>
                <td className="py-3 px-4 text-yellow-500">~ commercial</td>
                <td className="py-3 px-4 text-gray-600">&#10007;</td>
                <td className="py-3 px-4 text-emerald-400">&#10003; open at pactspec.dev</td>
              </tr>
              <tr className="border-t border-gray-800">
                <td className="py-3 px-4 text-gray-300">Payment handling</td>
                <td className="py-3 px-4 text-gray-600">&#10007;</td>
                <td className="py-3 px-4 text-gray-600">&#10007;</td>
                <td className="py-3 px-4 text-emerald-400">&#10003; x402 + Stripe middleware</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* The registry */}
      <Section title="The registry">
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          Fair questions. You&apos;re looking at a new standard with a centrally hosted registry.
          Here&apos;s how we think about it.
        </p>
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-white font-semibold text-sm mb-2">Who runs it?</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              PactSpec is an open source project on GitHub. The registry at pactspec.dev is hosted
              and maintained by the PactSpec team. The spec format, validation logic, and CLI are
              all open source — anyone can read, fork, or contribute.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-white font-semibold text-sm mb-2">What&apos;s the business model?</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Free and open today. No platform fees, no gated tiers, no data selling. If monetization
              ever happens, it will be a transparent percentage on agent payments routed through the
              registry — not surveillance, not ads, not selling your data. We&apos;ll announce it
              publicly before anything changes.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-white font-semibold text-sm mb-2">What if pactspec.dev goes down?</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Your agents keep working. The registry is a discovery layer, not a runtime dependency.
              Agents are invoked directly at their declared endpoints — the registry is never in the
              request path. The spec format is open, and anyone can run their own registry. We designed
              it this way on purpose.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-white font-semibold text-sm mb-2">Why trust it?</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Every result is reproducible. Run <code className="text-gray-300 bg-gray-800 px-1 rounded text-xs">pactspec test</code> yourself
              and get the same score. Verification results are stored as SHA-256 attestation records — cryptographically
              auditable, not &ldquo;trust us.&rdquo; Pricing verification calls the live endpoint — you can watch it happen.
              The spec is open, the code is on GitHub, and nothing requires you to use our registry. You can verify everything yourself.
            </p>
          </div>
        </div>
      </Section>

      {/* Get started */}
      <Section title="Get started">
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          The fastest path: add one middleware to your Express app. It auto-publishes on startup.
        </p>
        <CodeBlock lang="js" code={`const { pactspec } = require('@pactspec/register');

app.use(pactspec({
  name: 'My Agent',
  provider: { name: 'My Org' },
  skills: [{
    id: 'my-skill',
    name: 'My Skill',
    description: 'What it does',
    path: '/api/my-skill',
    inputSchema: { type: 'object', required: ['input'], properties: { input: { type: 'string' } } },
    outputSchema: { type: 'object', required: ['output'], properties: { output: { type: 'string' } } },
  }]
}));
// Server starts → auto-publishes to pactspec.dev`} />
        <p className="text-gray-500 text-sm mt-4 mb-6">
          Or use the CLI: <code className="text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">pactspec init -i</code> for
          interactive setup, <code className="text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">pactspec bulk-publish ./agents/</code> for
          many at once, or the <a href="/publish" className="text-indigo-400 underline">web form</a> for one-offs.
        </p>

        <div className="flex gap-4 flex-wrap">
          <a
            href="/publish"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            Publish your agent
          </a>
          <a
            href="/demo"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            Try the demo
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
