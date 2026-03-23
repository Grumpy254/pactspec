export const metadata = {
  title: 'Pricing — Monetize your agent with PactSpec',
  description:
    'PactSpec is the only agent protocol with built-in pricing declarations. Declare your pricing model, choose a payment protocol, and let orchestrators discover what your agent costs before they call it.',
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

function ModelCard({
  name,
  tag,
  description,
  example,
  accent,
}: {
  name: string;
  tag: string;
  description: string;
  example: string;
  accent: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${accent}`}>{tag}</span>
        <h3 className="text-white font-semibold text-sm">{name}</h3>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-4 flex-1">{description}</p>
      <code className="text-xs text-gray-500 font-mono bg-gray-950 rounded px-3 py-2 block">{example}</code>
    </div>
  );
}

function ProtocolCard({
  name,
  description,
  details,
  accent,
}: {
  name: string;
  description: string;
  details: string[];
  accent: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className={`font-semibold text-sm mb-2 ${accent}`}>{name}</h3>
      <p className="text-gray-400 text-sm leading-relaxed mb-4">{description}</p>
      <ul className="space-y-2">
        {details.map((d, i) => (
          <li key={i} className="flex gap-2 text-xs text-gray-500">
            <span className="text-gray-600 shrink-0">&mdash;</span>
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="mb-16 pt-4">
        <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1 rounded-full mb-6">
          Agent Pricing
        </div>
        <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
          Monetize your agent.
        </h1>
        <p className="text-lg text-gray-400 leading-relaxed">
          Declare what your agent costs, verify it charges what it says, and collect payment
          automatically. PactSpec handles the full lifecycle: pricing metadata in the spec,
          verification at publish time, and middleware that gates requests behind real payments.
        </p>
      </div>

      {/* Pricing Models */}
      <Section title="Pricing models">
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          Every skill in your spec can declare its own pricing model. Pick the one that matches how your agent consumes resources.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <ModelCard
            name="Free"
            tag="free"
            description="Open access, no cost. Good for public utilities, demos, or open-source agents that want registry visibility without charging."
            example={'"model": "free", "amount": 0, "currency": "USD"'}
            accent="text-emerald-400 border-emerald-800 bg-emerald-950"
          />
          <ModelCard
            name="Per-invocation"
            tag="per-invocation"
            description="Charge a flat fee every time the skill is called. The simplest model -- predictable for both publisher and consumer."
            example={'"model": "per-invocation", "amount": 0.02, "currency": "USD"'}
            accent="text-indigo-400 border-indigo-800 bg-indigo-950"
          />
          <ModelCard
            name="Per-token"
            tag="per-token"
            description="Charge per token processed. Designed for LLM-backed agents where cost scales with input and output length."
            example={'"model": "per-token", "amount": 0.00003, "currency": "USD"'}
            accent="text-yellow-400 border-yellow-800 bg-yellow-950"
          />
          <ModelCard
            name="Per-second"
            tag="per-second"
            description="Charge per second of compute time. Suited for agents that run long tasks -- video processing, simulations, training jobs."
            example={'"model": "per-second", "amount": 0.001, "currency": "USD"'}
            accent="text-purple-400 border-purple-800 bg-purple-950"
          />
        </div>
      </Section>

      {/* Payment Protocols */}
      <Section title="Payment protocols">
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          The pricing model says <em>what</em> you charge. The payment protocol says <em>how</em> you get paid.
          PactSpec supports three protocols today.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <ProtocolCard
            name="Stripe"
            description="Traditional billing. The path of least resistance for most publishers."
            details={[
              'Card payments and invoicing',
              'Metered billing via usage records',
              'Familiar dashboard and payouts',
              'Currencies: USD',
            ]}
            accent="text-indigo-400"
          />
          <ProtocolCard
            name="x402"
            description="HTTP-native micropayments. A single header turns any API call into a paid request."
            details={[
              'Payment via HTTP 402 flow',
              'Crypto settlement (USDC, SOL)',
              'No accounts or subscriptions',
              'Sub-cent transactions are viable',
            ]}
            accent="text-emerald-400"
          />
          <ProtocolCard
            name="None"
            description="Out-of-band billing. For enterprise agreements, free tiers, or agents that handle payments themselves."
            details={[
              'No payment at invocation time',
              'Enterprise contracts and invoicing',
              'Internal / private agents',
              'Pricing still visible in the registry',
            ]}
            accent="text-gray-400"
          />
        </div>
      </Section>

      {/* How It Works */}
      <Section title="How it works">
        <div className="space-y-6">
          <div className="flex gap-4 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-400 text-xs flex items-center justify-center font-bold">1</span>
            <div>
              <p className="text-white text-sm font-medium mb-1">Add pricing to your spec</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Each skill gets its own <code className="text-indigo-400 text-xs bg-gray-800 px-1 py-0.5 rounded">pricing</code> object
                with a model, amount, currency, and protocol.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-400 text-xs flex items-center justify-center font-bold">2</span>
            <div>
              <p className="text-white text-sm font-medium mb-1">Publish to the registry</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Run <code className="text-indigo-400 text-xs bg-gray-800 px-1 py-0.5 rounded">pactspec publish</code> and
                your pricing becomes part of your public agent record.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-400 text-xs flex items-center justify-center font-bold">3</span>
            <div>
              <p className="text-white text-sm font-medium mb-1">The registry verifies your pricing</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                On publish, the registry calls your endpoint without payment and confirms the 402
                response matches your declared price. No bait-and-switch. Orchestrators can filter
                and sort by cost, compare providers, and make budget-aware routing decisions.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-400 text-xs flex items-center justify-center font-bold">4</span>
            <div>
              <p className="text-white text-sm font-medium mb-1">Middleware handles payments</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Drop in <code className="text-indigo-400 text-xs bg-gray-800 px-1 py-0.5 rounded">@pactspec/stripe-billing</code> or{' '}
                <code className="text-indigo-400 text-xs bg-gray-800 px-1 py-0.5 rounded">@pactspec/x402-middleware</code> to
                gate requests behind real payments. Or use{' '}
                <code className="text-indigo-400 text-xs bg-gray-800 px-1 py-0.5 rounded">@pactspec/client</code> on
                the consumer side to discover, pay, and invoke agents in one call.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-xs text-gray-500 mb-3">Example: a skill with per-invocation pricing via Stripe</p>
          <CodeBlock code={`{
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
    "amount": 0.02,
    "currency": "USD",
    "protocol": "stripe"
  }
}`} />
        </div>
      </Section>

      {/* What's Enforced */}
      <Section title="What&apos;s enforced — and what&apos;s not">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-emerald-900/50 rounded-xl p-6">
            <p className="text-emerald-400 font-semibold text-sm mb-4">What the registry does today</p>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">&#10003;</span>
                Validates your pricing schema on publish (model, amount, currency, protocol)
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">&#10003;</span>
                Verifies pricing by calling your endpoint without payment and checking the 402 response matches your declared price
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">&#10003;</span>
                Makes pricing discoverable and comparable across every agent in the registry
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">&#10003;</span>
                Enables filtering and sorting by pricing model, amount, and protocol
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 shrink-0">&#10003;</span>
                Exposes pricing in both the JSON API and the machine-readable agents.md endpoint
              </li>
            </ul>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 font-semibold text-sm mb-4">What the registry does not do</p>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="text-gray-600 shrink-0">&#10007;</span>
                Does not process or intermediate payments between consumer and publisher
              </li>
              <li className="flex gap-2">
                <span className="text-gray-600 shrink-0">&#10007;</span>
                Does not enforce rate limits or usage caps on behalf of publishers
              </li>
            </ul>
            <p className="text-xs text-gray-600 mt-4 leading-relaxed">
              Payment collection happens between the consumer and the agent directly, using
              whichever protocol the agent declares. The registry verifies the pricing is honest
              but does not sit in the payment path.
            </p>
          </div>
        </div>
      </Section>

      {/* Delegation */}
      <Section title="Agent Delegation & Revenue Sharing">
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          Wrap an existing agent with your own endpoint, add your own markup or value, and split
          revenue with the upstream provider. Delegation lets organizations &ldquo;loan out&rdquo;
          their agents to partners who resell or bundle them under their own brand.
        </p>

        <div className="space-y-6 mb-8">
          <div className="flex gap-4 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-900 border border-cyan-700 text-cyan-400 text-xs flex items-center justify-center font-bold">1</span>
            <div>
              <p className="text-white text-sm font-medium mb-1">Upstream publishes their agent</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                The original agent owner publishes their spec to the registry as usual.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-900 border border-cyan-700 text-cyan-400 text-xs flex items-center justify-center font-bold">2</span>
            <div>
              <p className="text-white text-sm font-medium mb-1">Downstream creates a delegated spec</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                A partner publishes their own spec with a{' '}
                <code className="text-cyan-400 text-xs bg-gray-800 px-1 py-0.5 rounded">delegation</code>{' '}
                block pointing to the upstream agent&rsquo;s spec ID, along with revenue share terms.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-900 border border-cyan-700 text-cyan-400 text-xs flex items-center justify-center font-bold">3</span>
            <div>
              <p className="text-white text-sm font-medium mb-1">Both agents appear in the registry</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Consumers can see the delegation chain and choose either the original or the
                delegated version. The registry shows the upstream relationship transparently.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-3">Example: a delegated agent with 70/30 revenue split</p>
        <CodeBlock code={`{
  "delegation": {
    "delegatedFrom": "urn:pactspec:acme:original-agent",
    "revenueShare": {
      "upstream": 70,
      "downstream": 30
    },
    "terms": "https://acme.com/delegation-terms"
  }
}`} />

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-8">
          <p className="text-gray-400 font-semibold text-sm mb-4">What delegation enables</p>
          <ul className="space-y-3 text-sm text-gray-300">
            <li className="flex gap-2">
              <span className="text-cyan-400 shrink-0">&#10003;</span>
              Resellers wrap an upstream agent with their own endpoint and branding
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 shrink-0">&#10003;</span>
              Revenue share percentages are declared in the spec and visible in the registry
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 shrink-0">&#10003;</span>
              Consumers see the full delegation chain for transparency
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 shrink-0">&#10003;</span>
              Link to a delegation agreement URL for legal terms
            </li>
          </ul>
          <p className="text-xs text-gray-600 mt-4 leading-relaxed">
            Revenue share declarations are metadata today. Automated revenue splitting via payment
            middleware is planned for a future release.
          </p>
        </div>
      </Section>

      {/* The toolchain */}
      <Section title="The toolchain">
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          Pricing declarations are useful on their own. But PactSpec also ships the middleware to
          act on them.
        </p>
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-white font-semibold text-sm mb-2">@pactspec/register</p>
            <p className="text-gray-400 text-xs leading-relaxed">
              Express middleware that auto-publishes your spec to the registry on server startup.
              Add it once and your agent stays discoverable with zero manual publishing.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-white font-semibold text-sm mb-2">@pactspec/stripe-billing</p>
            <p className="text-gray-400 text-xs leading-relaxed">
              Middleware that gates requests behind Stripe metered billing. Handles customer
              lookup, subscription checks, free quotas, and usage reporting.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-white font-semibold text-sm mb-2">@pactspec/client</p>
            <p className="text-gray-400 text-xs leading-relaxed">
              Consumer SDK. Discovers agents from the registry, reads pricing, handles payment
              (Stripe or x402), and invokes the skill — all in one call.
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section title="Ready to publish your pricing?">
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          Add a <code className="text-indigo-400 text-xs bg-gray-800 px-1 py-0.5 rounded">pricing</code> block
          to any skill in your spec, publish to the registry, and your agent becomes instantly
          discoverable with verified, machine-readable pricing.
        </p>
        <div className="flex gap-4">
          <a
            href="/publish"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            Publish your agent
          </a>
          <a
            href="/guides/stripe-setup"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            Stripe setup guide
          </a>
          <a
            href="/demo"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            x402 demo
          </a>
        </div>
      </Section>
    </div>
  );
}
