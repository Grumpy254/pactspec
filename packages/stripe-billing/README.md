# @pactspec/stripe-billing

Stripe payment integration for PactSpec agents. Adds metered billing, checkout sessions, and usage reporting to any Express-style HTTP agent endpoint.

**Zero runtime dependencies.** All Stripe API calls use the built-in `fetch()` API with direct HTTP requests to `https://api.stripe.com/v1/`. The `stripe` npm package is not required (but can be used alongside this library if you prefer).

## Installation

```bash
npm install @pactspec/stripe-billing
```

## Quick Start: Per-Invocation Billing

```ts
import express from 'express';
import { stripeBillingMiddleware } from '@pactspec/stripe-billing';

const app = express();

app.use('/api/agent', stripeBillingMiddleware({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  pricing: { model: 'per-invocation', amount: 1, currency: 'usd' },
  lookupCustomer: async (req) => req.headers['x-stripe-customer'] ?? null,
  stripePriceId: 'price_abc123',  // enables auto-generated checkout URLs in 402 responses
  freeQuota: 100,                 // first 100 calls are free per customer
}));

app.post('/api/agent', (req, res) => {
  res.json({ result: 'Hello from the agent' });
});
```

When a request arrives without a valid Stripe customer or subscription, the middleware returns:

```json
{
  "error": "Payment required",
  "message": "A valid Stripe subscription or checkout session is required to access this agent.",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_...",
  "sessionId": "cs_..."
}
```

## Setting Up Stripe Products and Prices

Before using this package, create a Stripe Product and Price in your Stripe Dashboard or via the API:

```bash
# Create a product
curl https://api.stripe.com/v1/products \
  -u sk_test_YOUR_KEY: \
  -d name="My Agent - Per Invocation"

# Create a metered price (for per-invocation billing)
curl https://api.stripe.com/v1/prices \
  -u sk_test_YOUR_KEY: \
  -d product=prod_XXX \
  -d currency=usd \
  -d unit_amount=1 \
  -d "recurring[interval]=month" \
  -d "recurring[usage_type]=metered"
```

Use the resulting `price_XXX` ID as `stripePriceId` in the middleware options.

## Customer Identification

The middleware identifies customers in this order:

1. **`X-Stripe-Customer` header** — the Stripe customer ID directly (`cus_...`)
2. **`Authorization: Bearer cs_...` header** — a Stripe Checkout Session ID; the middleware verifies it and extracts the customer
3. **`lookupCustomer` callback** — your custom logic to map any request attribute to a Stripe customer ID

## Metered Billing for Per-Token Pricing

For agents that charge per token, set `model: 'per-token'` and include a `X-Token-Count` response header:

```ts
app.use('/api/agent', stripeBillingMiddleware({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  pricing: { model: 'per-token', amount: 1, currency: 'usd' },
  lookupCustomer: async (req) => req.headers['x-stripe-customer'] ?? null,
  onUsageReported: (record) => {
    console.log(`Reported ${record.quantity} tokens for ${record.customerId}`);
  },
}));

app.post('/api/agent', (req, res) => {
  const tokens = 150;
  res.setHeader('X-Token-Count', tokens);
  res.json({ result: '...', tokenCount: tokens });
});
```

The middleware reads the `X-Token-Count` header from the response after it finishes and reports that quantity to Stripe.

## Free Quota Configuration

The `freeQuota` option lets each customer make N free invocations before billing kicks in. Usage is tracked in-memory per process.

```ts
stripeBillingMiddleware({
  // ...
  freeQuota: 50,  // 50 free calls per customer
})
```

Notes:
- Free quota resets when the process restarts (in-memory tracking)
- Free quota is checked before subscription verification, so free-tier users don't need a Stripe subscription
- For persistent quota tracking, use the `onUsageReported` callback to store usage in your database

## Checkout Flow for New Customers

Generate a Checkout Session programmatically:

```ts
import { createCheckoutSession, verifyCheckoutSession } from '@pactspec/stripe-billing';

// Create a session
const { url, sessionId } = await createCheckoutSession({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  priceId: 'price_abc123',
  successUrl: 'https://yourapp.com/success?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: 'https://yourapp.com/cancel',
  mode: 'subscription',
  metadata: { agentId: 'urn:pactspec:acme:my-agent' },
});

// Redirect the user to `url`...

// Later, verify the session completed
const paid = await verifyCheckoutSession(sessionId, process.env.STRIPE_SECRET_KEY!);
```

## Usage Reporting (Direct)

For advanced use cases, report usage directly:

```ts
import { reportUsage, getUsageSummary } from '@pactspec/stripe-billing';

// Report 1 unit of usage
await reportUsage({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  subscriptionItemId: 'si_abc123',
  quantity: 1,
});

// Report token-based usage
await reportUsage({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  subscriptionItemId: 'si_abc123',
  quantity: 350,  // 350 tokens
});

// Get usage summary
const summary = await getUsageSummary('cus_abc123', {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
});
console.log(summary.items);
```

## PactSpec Spec Declaration

Reference Stripe billing in your PactSpec agent spec:

```json
{
  "skills": [{
    "id": "my-skill",
    "name": "My Skill",
    "description": "A billable skill",
    "inputSchema": { "type": "object" },
    "outputSchema": { "type": "object" },
    "pricing": {
      "model": "per-invocation",
      "amount": 1,
      "currency": "USD",
      "protocol": "stripe"
    }
  }]
}
```

## API Reference

### `stripeBillingMiddleware(options)`

Returns an Express-compatible middleware function.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `stripeSecretKey` | `string` | Yes | Stripe secret key |
| `pricing` | `BillingPricing` | Yes | `{ model, amount, currency }` |
| `lookupCustomer` | `(req) => Promise<string \| null>` | Yes | Maps request to Stripe customer ID |
| `onUsageReported` | `(record: UsageRecord) => void` | No | Callback after usage is reported |
| `freeQuota` | `number` | No | Free invocations per customer (default: 0) |
| `stripePriceId` | `string` | No | Price ID for auto-generated checkout URLs |
| `checkoutSuccessUrl` | `string` | No | Redirect URL after successful checkout |
| `checkoutCancelUrl` | `string` | No | Redirect URL if checkout is cancelled |

### `createCheckoutSession(options)`

Creates a Stripe Checkout Session. Returns `{ url, sessionId }`.

### `verifyCheckoutSession(sessionId, stripeSecretKey)`

Returns `true` if the session is paid and complete.

### `reportUsage(options)`

Reports usage to Stripe for a metered subscription item.

### `getUsageSummary(customerId, options)`

Returns usage summary across all subscription items for a customer.

## License

MIT
