export const metadata = {
  title: 'Stripe Setup Guide — Accept payments for your PactSpec agent',
  description:
    'Step-by-step guide to accepting real Stripe payments for your AI agent using PactSpec and the @pactspec/stripe-billing middleware.',
};

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <pre
      className={`language-${lang} bg-gray-900 border border-gray-800 rounded-xl p-5 text-xs text-gray-300 overflow-auto font-mono leading-relaxed`}
    >
      {code}
    </pre>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="flex items-center gap-4 mb-5">
        <span className="shrink-0 w-8 h-8 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-400 text-sm flex items-center justify-center font-bold">
          {number}
        </span>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      <div className="pl-12">{children}</div>
    </section>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-indigo-400 text-xs bg-gray-800 px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

export default function StripeSetupGuidePage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="mb-16 pt-4">
        <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1 rounded-full mb-6">
          Guide
        </div>
        <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
          Accept Stripe payments for your agent
        </h1>
        <p className="text-lg text-gray-400 leading-relaxed">
          This guide walks you through charging for agent API calls with Stripe.
          You&apos;ll end up with an Express server that gates requests behind metered
          billing and a published PactSpec spec with pricing.
        </p>
      </div>

      {/* Prerequisites */}
      <section className="mb-14">
        <h2 className="text-xl font-bold text-white mb-5">Prerequisites</h2>
        <ul className="space-y-3 text-sm text-gray-300">
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">&#10003;</span>
            <span>
              A Stripe account &mdash;{' '}
              <a
                href="https://dashboard.stripe.com/register"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 underline hover:text-indigo-300"
              >
                sign up at stripe.com
              </a>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">&#10003;</span>
            <span>
              Node.js 18+ and an Express (or Express-compatible) HTTP endpoint
              for your agent
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">&#10003;</span>
            <span>
              A PactSpec spec with pricing declared (or you will create one in
              this guide)
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">&#10003;</span>
            <span>
              The{' '}
              <InlineCode>pactspec</InlineCode> CLI installed &mdash;{' '}
              <InlineCode>npm install -g pactspec</InlineCode>
            </span>
          </li>
        </ul>
      </section>

      {/* Step 1 */}
      <Step number={1} title="Create your Stripe product and price">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Every billable agent needs a Stripe <strong className="text-white">Product</strong> (what
          you are selling) and a <strong className="text-white">Price</strong> (how much it costs).
          For metered per-invocation billing, create a recurring price with{' '}
          <InlineCode>usage_type=metered</InlineCode>.
        </p>
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          You can do this in the{' '}
          <a
            href="https://dashboard.stripe.com/products"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 underline hover:text-indigo-300"
          >
            Stripe Dashboard
          </a>{' '}
          or via the API. Here is the API approach using curl:
        </p>
        <CodeBlock
          code={`# Create a product
curl https://api.stripe.com/v1/products \\
  -u sk_test_YOUR_KEY: \\
  -d name="Medical Coding Agent" \\
  -d description="ICD-11 coding per invocation"

# Response includes: "id": "prod_abc123"

# Create a metered price ($0.05 per invocation, billed monthly)
curl https://api.stripe.com/v1/prices \\
  -u sk_test_YOUR_KEY: \\
  -d product=prod_abc123 \\
  -d unit_amount=5 \\
  -d currency=usd \\
  -d "recurring[interval]=month" \\
  -d "recurring[usage_type]=metered"

# Response includes: "id": "price_xyz789"`}
        />
        <div className="bg-gray-900 border border-yellow-900/50 rounded-xl p-4 mt-4">
          <p className="text-yellow-400 text-xs font-semibold mb-1">Note</p>
          <p className="text-gray-400 text-xs leading-relaxed">
            <InlineCode>unit_amount</InlineCode> is in the smallest currency
            unit (cents for USD). So <InlineCode>5</InlineCode> means $0.05.
            Use your test-mode secret key (<InlineCode>sk_test_...</InlineCode>)
            while developing.
          </p>
        </div>
      </Step>

      {/* Step 2 */}
      <Step number={2} title="Install the middleware">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          The <InlineCode>@pactspec/stripe-billing</InlineCode> package
          provides Express-compatible middleware that handles customer
          identification, subscription verification, and usage reporting. It has
          zero runtime dependencies and talks to the Stripe API directly via{' '}
          <InlineCode>fetch()</InlineCode>.
        </p>
        <CodeBlock code={`npm install @pactspec/stripe-billing express`} />
      </Step>

      {/* Step 3 */}
      <Step number={3} title="Add billing to your Express app">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Wrap your agent endpoint with <InlineCode>stripeBillingMiddleware</InlineCode>.
          The middleware runs before your handler: it checks for a valid Stripe
          customer and subscription, lets the request through if paid, and
          reports usage to Stripe after the response finishes.
        </p>
        <CodeBlock
          lang="js"
          code={`import express from 'express';
import { stripeBillingMiddleware } from '@pactspec/stripe-billing';

const app = express();
app.use(express.json());

// Stripe billing middleware — gates requests behind payment
app.use(
  '/api/agent',
  stripeBillingMiddleware({
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripePriceId: process.env.STRIPE_PRICE_ID,
    pricing: {
      model: 'per-invocation',
      amount: 5,       // 5 cents
      currency: 'usd',
    },
    lookupCustomer: async (req) => {
      return req.headers['x-stripe-customer'] || null;
    },
    freeQuota: 10,  // first 10 calls free per customer
    checkoutSuccessUrl: 'https://yourapp.com/success?session_id={CHECKOUT_SESSION_ID}',
    checkoutCancelUrl: 'https://yourapp.com/cancel',
    onUsageReported: (record) => {
      console.log(\`Billed \${record.quantity} unit(s) for \${record.customerId}\`);
    },
  })
);

// Your actual agent logic
app.post('/api/agent', (req, res) => {
  const { code_description } = req.body;
  // ... your agent logic here ...
  res.json({
    icd11_code: 'BA00',
    description: 'Essential hypertension',
    confidence: 0.95,
  });
});

app.listen(3001, () => {
  console.log('Agent running on http://localhost:3001');
});`}
        />
        <p className="text-gray-400 text-sm leading-relaxed mt-4">
          When an unauthenticated request arrives, the middleware returns a{' '}
          <InlineCode>402 Payment Required</InlineCode> response with a Stripe
          Checkout URL:
        </p>
        <CodeBlock
          lang="json"
          code={`{
  "error": "Payment required",
  "message": "A valid Stripe subscription or checkout session is required to access this agent.",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
  "sessionId": "cs_test_..."
}`}
        />
      </Step>

      {/* Step 4 */}
      <Step number={4} title="Update your PactSpec spec">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Add a <InlineCode>pricing</InlineCode> block to each skill in your
          spec. This makes your pricing discoverable in the registry so
          orchestrators know what your agent costs before calling it.
        </p>
        <CodeBlock
          lang="json"
          code={`{
  "pactspec": "1.0",
  "id": "urn:pactspec:yourorg:medical-coder",
  "name": "Medical Coding Agent",
  "version": "1.0.0",
  "description": "Maps clinical descriptions to ICD-11 codes",
  "url": "https://yourapp.com/api/agent",
  "skills": [
    {
      "id": "code-diagnosis",
      "name": "Code Diagnosis",
      "description": "Returns an ICD-11 code for a clinical description",
      "inputSchema": {
        "type": "object",
        "required": ["code_description"],
        "properties": {
          "code_description": { "type": "string" }
        }
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "icd11_code": { "type": "string" },
          "description": { "type": "string" },
          "confidence": { "type": "number" }
        }
      },
      "pricing": {
        "model": "per-invocation",
        "amount": 0.05,
        "currency": "USD",
        "protocol": "stripe"
      }
    }
  ]
}`}
        />
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mt-4">
          <p className="text-gray-300 text-xs font-semibold mb-1">Field reference</p>
          <ul className="space-y-1 text-xs text-gray-400">
            <li>
              <InlineCode>model</InlineCode> &mdash; one of{' '}
              <InlineCode>free</InlineCode>, <InlineCode>per-invocation</InlineCode>,{' '}
              <InlineCode>per-token</InlineCode>, or <InlineCode>per-second</InlineCode>
            </li>
            <li>
              <InlineCode>amount</InlineCode> &mdash; the price in the currency&apos;s
              standard unit (e.g. 0.05 = five cents USD)
            </li>
            <li>
              <InlineCode>currency</InlineCode> &mdash; ISO 4217 currency code
            </li>
            <li>
              <InlineCode>protocol</InlineCode> &mdash;{' '}
              <InlineCode>stripe</InlineCode>, <InlineCode>x402</InlineCode>, or{' '}
              <InlineCode>none</InlineCode>
            </li>
          </ul>
        </div>
      </Step>

      {/* Step 5 */}
      <Step number={5} title="Publish and verify">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Use the PactSpec CLI to publish your spec to the registry. The
          registry validates your pricing schema on publish.
        </p>
        <CodeBlock
          code={`# Publish your spec
pactspec publish medical-coder.pactspec.json --agent-id yourorg

# Verify it appears in the registry
pactspec info yourorg/medical-coder`}
        />
        <p className="text-gray-400 text-sm leading-relaxed mt-4">
          After publishing, your agent appears in the{' '}
          <a href="/" className="text-indigo-400 underline hover:text-indigo-300">
            PactSpec registry
          </a>{' '}
          with its pricing visible to every orchestrator.
        </p>
      </Step>

      {/* Step 6 */}
      <Step number={6} title="Test the payment flow">
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Walk through the complete payment lifecycle using curl and Stripe test
          mode.
        </p>

        <p className="text-white text-sm font-medium mb-2">
          A. Call without payment &mdash; get 402
        </p>
        <CodeBlock
          code={`curl -X POST http://localhost:3001/api/agent \\
  -H "Content-Type: application/json" \\
  -d '{"code_description": "high blood pressure"}'

# Response: 402
# {
#   "error": "Payment required",
#   "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
#   "sessionId": "cs_test_..."
# }`}
        />

        <p className="text-white text-sm font-medium mb-2 mt-6">
          B. Complete the Stripe Checkout
        </p>
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Open the <InlineCode>checkoutUrl</InlineCode> from the 402 response
          in your browser. Use Stripe test card{' '}
          <InlineCode>4242 4242 4242 4242</InlineCode> with any future
          expiration date and any CVC.
        </p>

        <p className="text-white text-sm font-medium mb-2 mt-6">
          C. Call with your Stripe customer ID &mdash; get result
        </p>
        <CodeBlock
          code={`# After checkout, Stripe assigns a customer ID (cus_...).
# Find it in your Stripe Dashboard or from the checkout session.

curl -X POST http://localhost:3001/api/agent \\
  -H "Content-Type: application/json" \\
  -H "X-Stripe-Customer: cus_abc123" \\
  -d '{"code_description": "high blood pressure"}'

# Response: 200
# {
#   "icd11_code": "BA00",
#   "description": "Essential hypertension",
#   "confidence": 0.95
# }`}
        />

        <p className="text-white text-sm font-medium mb-2 mt-6">
          D. Or use the checkout session ID directly
        </p>
        <CodeBlock
          code={`curl -X POST http://localhost:3001/api/agent \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer cs_test_..." \\
  -d '{"code_description": "high blood pressure"}'

# The middleware verifies the session and extracts the customer automatically.`}
        />

        <div className="bg-gray-900 border border-emerald-900/50 rounded-xl p-4 mt-6">
          <p className="text-emerald-400 text-xs font-semibold mb-1">
            Verify usage in Stripe
          </p>
          <p className="text-gray-400 text-xs leading-relaxed">
            After a successful call, check your{' '}
            <a
              href="https://dashboard.stripe.com/test/subscriptions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 underline hover:text-indigo-300"
            >
              Stripe Dashboard
            </a>{' '}
            under Subscriptions. You should see a usage record reported for the
            customer&apos;s metered subscription item.
          </p>
        </div>
      </Step>

      {/* What happens under the hood */}
      <section className="mb-14">
        <h2 className="text-xl font-bold text-white mb-5">
          What happens under the hood
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <ol className="space-y-4 text-sm text-gray-300">
            <li className="flex gap-3">
              <span className="text-indigo-400 font-mono shrink-0">1.</span>
              <span>
                Request arrives at your endpoint. The middleware checks for a
                Stripe customer via{' '}
                <InlineCode>X-Stripe-Customer</InlineCode> header,{' '}
                <InlineCode>Authorization: Bearer cs_...</InlineCode> header, or
                your custom <InlineCode>lookupCustomer</InlineCode> callback.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-indigo-400 font-mono shrink-0">2.</span>
              <span>
                If no customer is found, the middleware returns 402 with a
                Stripe Checkout URL (if <InlineCode>stripePriceId</InlineCode>{' '}
                is configured).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-indigo-400 font-mono shrink-0">3.</span>
              <span>
                If a customer is found but within the free quota, the request
                proceeds without checking for a subscription.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-indigo-400 font-mono shrink-0">4.</span>
              <span>
                Past the free quota, the middleware verifies the customer has an
                active Stripe subscription. No subscription means another 402.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-indigo-400 font-mono shrink-0">5.</span>
              <span>
                The request proceeds to your handler. After the response
                finishes, the middleware reports one usage unit to Stripe via the{' '}
                <InlineCode>usage_records</InlineCode> API.
              </span>
            </li>
          </ol>
        </div>
      </section>

      {/* Going to production */}
      <section className="mb-14">
        <h2 className="text-xl font-bold text-white mb-5">
          Going to production
        </h2>
        <ul className="space-y-3 text-sm text-gray-300">
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">&#10003;</span>
            Switch from <InlineCode>sk_test_</InlineCode> to your live secret
            key <InlineCode>sk_live_</InlineCode>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">&#10003;</span>
            Create a live-mode Product and Price in Stripe (test-mode objects do
            not carry over)
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">&#10003;</span>
            Store your Stripe keys in environment variables or a secrets
            manager &mdash; never commit them to source control
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">&#10003;</span>
            For persistent usage tracking across restarts, use the{' '}
            <InlineCode>onUsageReported</InlineCode> callback to write usage to
            your database
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">&#10003;</span>
            Set up{' '}
            <a
              href="https://docs.stripe.com/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 underline hover:text-indigo-300"
            >
              Stripe webhooks
            </a>{' '}
            to handle subscription cancellations and payment failures
          </li>
        </ul>
      </section>

      {/* CTA */}
      <section className="mb-14">
        <h2 className="text-xl font-bold text-white mb-5">Next steps</h2>
        <div className="flex flex-wrap gap-4">
          <a
            href="/pricing"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            Explore pricing models
          </a>
          <a
            href="/publish"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            Publish your agent
          </a>
          <a
            href="https://github.com/Grumpy254/pactspec/tree/main/examples/stripe-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            View example on GitHub
          </a>
        </div>
      </section>
    </div>
  );
}
