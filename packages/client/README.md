# @pactspec/client

PactSpec client with automatic payment handling for x402 and Stripe. Zero runtime dependencies.

## Installation

```bash
npm install @pactspec/client
```

## Basic usage (free agent)

```typescript
import { PactSpecClient } from '@pactspec/client';

const client = new PactSpecClient();

const result = await client.invoke('my-org/my-agent', 'summarize', {
  text: 'Long document text here...',
});

console.log(result.data);   // agent response
console.log(result.paid);   // false
```

## Auto-payment with x402 (crypto)

Provide a `WalletAdapter` to enable automatic on-chain payments when an agent returns HTTP 402.

```typescript
import { PactSpecClient, MockWallet } from '@pactspec/client';

// Use MockWallet for development; replace with a real adapter in production
const client = new PactSpecClient({
  wallet: new MockWallet(),
  maxPaymentAmount: 100_000, // refuse to pay more than this per call
});

const result = await client.invoke('my-org/paid-agent', 'analyze', {
  data: [1, 2, 3],
});

if (result.paid) {
  console.log(`Paid ${result.paymentAmount} ${result.paymentCurrency}`);
  console.log(`Payment ID: ${result.paymentId}`);
}
```

### Implementing a real WalletAdapter

```typescript
import type { WalletAdapter, PaymentRequest } from '@pactspec/client';

class MyWallet implements WalletAdapter {
  async pay(options: PaymentRequest): Promise<string> {
    // Execute the on-chain transfer and return the tx hash
    const txHash = await myBlockchainSdk.transfer({
      to: options.payTo,
      amount: options.amount,
      currency: options.currency,
      network: options.network,
    });
    return txHash;
  }

  async getAddress(): Promise<string> {
    return myBlockchainSdk.getAddress();
  }
}
```

## Auto-payment with Stripe

For Stripe-based agents, provide a customer ID or session resolver.

```typescript
const client = new PactSpecClient({
  stripeCustomerId: 'cus_xxxxxxxxxxxxx',
});

// Or use a dynamic session resolver
const client2 = new PactSpecClient({
  stripeSessionResolver: async () => {
    const session = await fetch('/api/create-checkout-session', {
      method: 'POST',
    });
    const { sessionId } = await session.json();
    return sessionId;
  },
});
```

## Budget limits

Control spending with `maxPaymentAmount` and `maxPaymentCurrency`. If a payment
challenge exceeds the budget, a `PaymentRefusedError` is thrown instead of paying.

```typescript
const client = new PactSpecClient({
  wallet: new MockWallet(),
  maxPaymentAmount: 50_000,    // max 50,000 units per call
  maxPaymentCurrency: 'USDC',  // only pay in USDC
});
```

## Manual payment control

Disable auto-pay globally or per invocation.

```typescript
// Disable globally
const client = new PactSpecClient({
  wallet: new MockWallet(),
  autoPayEnabled: false,
});

// Or use invokeWithoutPayment for a single call
try {
  const result = await client.invokeWithoutPayment('my-org/agent', 'skill', {});
} catch (err) {
  if (err instanceof PaymentRequiredError) {
    console.log('Payment needed:', err.challenge);
    // Handle payment manually
  }
}
```

## Discovery

```typescript
const client = new PactSpecClient();

// Search for agents
const { agents, total } = await client.search({
  query: 'medical coding',
  tags: ['healthcare'],
  limit: 10,
});

// Get a specific agent spec
const agent = await client.getAgent('my-org/my-agent');
console.log(agent.skills.map((s) => s.id));
```

## Error handling

```typescript
import {
  PactSpecClient,
  AgentNotFoundError,
  SkillNotFoundError,
  PaymentRequiredError,
  PaymentRefusedError,
  PaymentFailedError,
  InvocationError,
} from '@pactspec/client';

try {
  const result = await client.invoke('org/agent', 'skill', input);
} catch (err) {
  if (err instanceof AgentNotFoundError) {
    // Agent not in registry
  } else if (err instanceof SkillNotFoundError) {
    // Skill ID doesn't exist on the agent
  } else if (err instanceof PaymentRequiredError) {
    // 402 returned and auto-pay is disabled
    console.log(err.challenge);
  } else if (err instanceof PaymentRefusedError) {
    // Payment exceeds budget limit
    console.log(`Limit: ${err.maxPaymentAmount}`);
  } else if (err instanceof PaymentFailedError) {
    // Wallet or Stripe error during payment
  } else if (err instanceof InvocationError) {
    // Non-402 HTTP error from the agent
    console.log(`Status: ${err.status}`, err.body);
  }
}
```

## API Reference

### `PactSpecClient`

| Method | Description |
|---|---|
| `invoke(specId, skillId, input)` | Call an agent skill with auto-payment |
| `invokeWithoutPayment(specId, skillId, input)` | Call without auto-payment |
| `getAgent(specId)` | Fetch an agent spec from the registry |
| `search(options)` | Search the registry |
| `clearCache()` | Clear the in-memory spec cache |

### `ClientOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `registry` | `string` | `https://pactspec.dev` | Registry base URL |
| `wallet` | `WalletAdapter` | - | Wallet for x402 payments |
| `stripeCustomerId` | `string` | - | Stripe customer ID |
| `stripeSessionResolver` | `() => Promise<string>` | - | Async Stripe session resolver |
| `maxPaymentAmount` | `number` | - | Max payment per call |
| `maxPaymentCurrency` | `string` | - | Only pay in this currency |
| `autoPayEnabled` | `boolean` | `true` | Enable/disable auto-payment |
