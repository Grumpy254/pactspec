# Stripe Agent Example

A minimal Express server that uses `@pactspec/stripe-billing` to accept real Stripe payments for an AI agent endpoint.

## Setup

1. **Install dependencies**

```bash
npm install express @pactspec/stripe-billing
```

2. **Create a Stripe Product and metered Price**

Use the [Stripe Dashboard](https://dashboard.stripe.com/products) or the API:

```bash
# Create product
curl https://api.stripe.com/v1/products \
  -u sk_test_YOUR_KEY: \
  -d name="Medical Coding Agent"

# Create metered price ($0.05/invocation)
curl https://api.stripe.com/v1/prices \
  -u sk_test_YOUR_KEY: \
  -d product=prod_XXX \
  -d unit_amount=5 \
  -d currency=usd \
  -d "recurring[interval]=month" \
  -d "recurring[usage_type]=metered"
```

3. **Set environment variables**

```bash
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_PRICE_ID=price_...
```

4. **Run the server**

```bash
node server.js
```

## Test the payment flow

**Call without payment (returns 402 with checkout URL):**

```bash
curl -X POST http://localhost:3001/api/agent \
  -H "Content-Type: application/json" \
  -d '{"code_description": "high blood pressure"}'
```

**Complete checkout**, then call with your customer ID:

```bash
curl -X POST http://localhost:3001/api/agent \
  -H "Content-Type: application/json" \
  -H "X-Stripe-Customer: cus_abc123" \
  -d '{"code_description": "high blood pressure"}'
```

## Files

| File | Description |
|------|-------------|
| `server.js` | Express server with Stripe billing middleware |
| `agent.pactspec.json` | PactSpec spec with pricing declaration |

## Publish to the registry

```bash
pactspec publish agent.pactspec.json --agent-id example
```
