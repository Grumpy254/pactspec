# @pactspec/x402-middleware

HTTP 402 micropayment middleware for PactSpec agent endpoints. Lets agent owners gate their endpoints behind on-chain payments with zero runtime dependencies.

## Installation

```bash
npm install @pactspec/x402-middleware
```

## Quick start

```ts
import express from 'express';
import { x402Middleware, createSolanaVerifier } from '@pactspec/x402-middleware';

const app = express();

app.use('/api/agent', x402Middleware({
  payTo: 'So1anaWa11etAddressHere111111111111111111111',
  pricing: {
    amount: 1000,          // 0.001 USDC (6 decimal places)
    currency: 'USDC',
    network: 'solana-mainnet',
  },
  verifyPayment: createSolanaVerifier('https://api.mainnet-beta.solana.com'),
}));

app.post('/api/agent', (req, res) => {
  res.json({ result: 'You paid for this.' });
});

app.listen(3000);
```

## How the 402 flow works

1. **Client sends a request** to the agent endpoint without a payment header.
2. **Middleware responds with `402 Payment Required`** and a JSON body describing what to pay:
   ```json
   {
     "amount": 1000,
     "currency": "USDC",
     "network": "solana-mainnet",
     "payTo": "So1anaWa11etAddressHere111111111111111111111",
     "paymentId": "a1b2c3d4-...",
     "expiresAt": "2025-06-01T12:05:00.000Z"
   }
   ```
3. **Client makes an on-chain payment** for the specified amount to the `payTo` address.
4. **Client retries the original request** with an `X-Payment-Proof` header containing the transaction hash and payment ID:
   ```
   X-Payment-Proof: {"txHash":"5abc123...","paymentId":"a1b2c3d4-..."}
   ```
5. **Middleware verifies the transaction** and, if valid, passes the request through to the handler.

## Configuration

```ts
x402Middleware({
  // Required ----------------------------------------------------------------

  /** Wallet address that receives payments. */
  payTo: 'So1anaWa11et...',

  /** Pricing for this endpoint. */
  pricing: {
    amount: 1000,
    currency: 'USDC',           // 'USDC' | 'SOL'
    network: 'solana-mainnet',  // 'solana-mainnet' | 'solana-devnet' | 'base' | 'base-sepolia'
  },

  // Optional ----------------------------------------------------------------

  /** Custom payment verifier (see below). Defaults to mock verifier. */
  verifyPayment: myVerifier,

  /** Callback fired after a payment is verified. */
  onPaymentReceived: (payment) => {
    console.log('Paid:', payment.txHash, payment.amount);
  },

  /** Skip the payment gate for certain requests. */
  skipIf: (req) => req.url === '/api/agent/health',

  /** Challenge validity window in ms (default: 5 minutes). */
  challengeTtlMs: 300_000,

  /** How long to remember used payment IDs (default: 1 hour). */
  deduplicationTtlMs: 3_600_000,
});
```

### Skipping routes

OPTIONS requests (CORS preflight) are always passed through automatically. For other routes you want to keep free, use `skipIf`:

```ts
x402Middleware({
  // ...
  skipIf: (req) => {
    // Free health-check endpoint
    if (req.url === '/health') return true;
    // Free GET requests, charge only for POST
    if (req.method === 'GET') return true;
    return false;
  },
});
```

## Payment verifiers

All built-in verifiers use plain `fetch()` and JSON-RPC calls with zero external dependencies.

### Solana verifier

Verifies Solana transactions by calling `getTransaction` on a Solana JSON-RPC endpoint. Supports both native SOL transfers and USDC (SPL token) transfers.

```ts
import { x402Middleware, createSolanaVerifier } from '@pactspec/x402-middleware';

// USDC on Solana mainnet
app.use('/api/agent', x402Middleware({
  payTo: 'So1anaWa11etAddressHere111111111111111111111',
  pricing: { amount: 1000, currency: 'USDC', network: 'solana-mainnet' },
  verifyPayment: createSolanaVerifier('https://api.mainnet-beta.solana.com'),
}));

// SOL native transfer on devnet
app.use('/api/cheap', x402Middleware({
  payTo: 'So1anaWa11etAddressHere111111111111111111111',
  pricing: { amount: 100000, currency: 'SOL', network: 'solana-devnet' },
  verifyPayment: createSolanaVerifier('https://api.devnet.solana.com'),
}));
```

### Base verifier

Verifies transactions on Base network via `eth_getTransactionReceipt`. Supports USDC (ERC-20) and native ETH transfers. Pre-configured with the Base USDC contract address.

```ts
import { x402Middleware, createBaseVerifier } from '@pactspec/x402-middleware';

app.use('/api/agent', x402Middleware({
  payTo: '0xYourWalletAddress',
  pricing: { amount: 1000, currency: 'USDC', network: 'base' },
  verifyPayment: createBaseVerifier('https://mainnet.base.org'),
}));
```

### EVM verifier (any chain)

`createEthVerifier` works with any EVM-compatible chain. It accepts an optional second argument to override the USDC contract address for the target chain.

```ts
import { x402Middleware, createEthVerifier } from '@pactspec/x402-middleware';

// Base (same as createBaseVerifier)
const baseVerifier = createEthVerifier('https://mainnet.base.org');

// Ethereum mainnet (different USDC contract)
const ethVerifier = createEthVerifier(
  'https://eth.llamarpc.com',
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
);

// Arbitrum
const arbVerifier = createEthVerifier(
  'https://arb1.arbitrum.io/rpc',
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
);
```

### Mock verifier (development only)

Accepts any non-empty transaction hash without contacting a blockchain. Do not use in production.

```ts
import { x402Middleware, createMockVerifier } from '@pactspec/x402-middleware';

app.use('/api/agent', x402Middleware({
  payTo: 'anything',
  pricing: { amount: 1000, currency: 'USDC', network: 'solana-devnet' },
  verifyPayment: createMockVerifier(),
}));
```

### Custom verifier

You can also provide your own verifier function:

```ts
import { x402Middleware, PaymentVerifier } from '@pactspec/x402-middleware';

const myVerifier: PaymentVerifier = async (txHash, expected) => {
  // Your custom verification logic
  const tx = await fetchTransaction(txHash, expected.network);
  return (
    tx.finalized &&
    tx.recipient === expected.payTo &&
    tx.amount >= expected.amount
  );
};

app.use('/api/agent', x402Middleware({
  payTo: 'So1anaWa11et...',
  pricing: { amount: 1000, currency: 'USDC', network: 'solana-mainnet' },
  verifyPayment: myVerifier,
}));
```

## Framework compatibility

The middleware uses the standard `(req, res, next)` Connect/Express pattern. It works with:

- **Express** — `app.use(x402Middleware(opts))`
- **Fastify** — via [`@fastify/express`](https://github.com/fastify/fastify-express) or [`@fastify/middie`](https://github.com/fastify/middie)
- **Plain Node.js `http`** — call the middleware manually:
  ```ts
  import http from 'node:http';
  import { x402Middleware, createSolanaVerifier } from '@pactspec/x402-middleware';

  const gate = x402Middleware({
    payTo: 'So1anaWa11et...',
    pricing: { amount: 1000, currency: 'USDC', network: 'solana-mainnet' },
    verifyPayment: createSolanaVerifier('https://api.mainnet-beta.solana.com'),
  });

  http.createServer((req, res) => {
    gate(req, res, () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  }).listen(3000);
  ```

## Response headers

The 402 response includes these headers for programmatic consumption:

| Header | Example | Description |
|--------|---------|-------------|
| `X-Payment-Network` | `solana-mainnet` | Target blockchain network |
| `X-Payment-Currency` | `USDC` | Payment currency |

## Error responses

| Status | Meaning |
|--------|---------|
| `402` | Payment required or verification failed |
| `400` | Malformed `X-Payment-Proof` header |
| `409` | Payment ID already consumed (replay attempt) |
| `410` | Payment challenge expired or unknown |
| `500` | Verifier threw an unexpected error |

## License

MIT
