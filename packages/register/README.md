# @pactspec/register

Zero-config Express middleware that auto-publishes your agent to the [PactSpec](https://pactspec.dev) registry on startup. One line of code, zero manual steps.

## Installation

```bash
npm install @pactspec/register
```

## Quick Start

```js
const express = require('express');
const { pactspec } = require('@pactspec/register');

const app = express();
app.use(express.json());

app.use(pactspec({
  name: 'Invoice Processing Agent',
  provider: { name: 'Acme Corp' },
  skills: [{
    id: 'process-invoice',
    name: 'Process Invoice',
    description: 'Extract line items from invoice images',
    path: '/api/process',
    inputSchema: { type: 'object', required: ['imageUrl'], properties: { imageUrl: { type: 'string' } } },
    outputSchema: { type: 'object', required: ['lineItems'], properties: { lineItems: { type: 'array' } } },
  }],
}));

app.post('/api/process', (req, res) => {
  res.json({ lineItems: [{ description: 'Widget', amount: 9.99 }] });
});

app.listen(3000);
// => PactSpec: Published to https://pactspec.dev/agents/acme-corp:invoice-processing-agent
```

That's it. Your agent is now discoverable on [pactspec.dev](https://pactspec.dev).

## How It Works

1. You add `app.use(pactspec({ ... }))` to your Express app.
2. When the server starts and receives its first request, the middleware detects the public base URL.
3. It builds a complete PactSpec JSON from your configuration.
4. It publishes the spec to the registry via `POST /api/agents`.
5. It serves the spec at `GET /.well-known/pactspec.json` for direct discovery.

If `baseUrl` is provided in the options, publishing happens immediately on startup without waiting for a request.

## Configuration Reference

```ts
app.use(pactspec({
  // ── Required ──────────────────────────────────────────────────────────
  name: 'My Agent',                     // Agent display name
  skills: [{ ... }],                    // At least one skill (see below)

  // ── Optional ──────────────────────────────────────────────────────────
  provider: {                           // Provider metadata
    name: 'Acme Corp',
    url: 'https://acme.com',
    contact: 'support@acme.com',
  },
  version: '1.0.0',                    // Spec version (default: '1.0.0')
  description: 'Does amazing things',  // Auto-generated from skills if omitted
  tags: ['invoicing', 'ocr'],          // Discovery tags

  // ── Registry ──────────────────────────────────────────────────────────
  registry: 'https://pactspec.dev',    // Registry URL (or PACTSPEC_REGISTRY env)
  agentId: 'acme-corp:my-agent',       // Auto-derived from provider + name if omitted
  publishToken: 'tok_...',             // Or set PACTSPEC_PUBLISH_TOKEN env

  // ── Behaviour ─────────────────────────────────────────────────────────
  autoPublish: true,                   // Set false to disable all publishing
  publishOnStart: true,                // Publish when server starts
  republishInterval: 0,               // Re-publish interval in ms (0 = never)

  // ── Endpoint ──────────────────────────────────────────────────────────
  baseUrl: 'https://api.acme.com',    // Auto-detected from first request if omitted
  auth: { type: 'bearer' },           // Auth scheme advertised in the spec
}));
```

### Skill Configuration

```ts
{
  id: 'process-invoice',               // Unique skill identifier
  name: 'Process Invoice',             // Human-readable name
  description: 'Extract line items',   // What the skill does
  path: '/api/process',                // Express route path
  method: 'POST',                      // HTTP method (default: 'POST')
  inputSchema: { ... },                // JSON Schema for request body
  outputSchema: { ... },               // JSON Schema for response body
  pricing: { ... },                    // Optional pricing (see below)
  testSuite: { url: '...' },           // Optional remote test suite URL
  tags: ['ocr'],                       // Optional skill-specific tags
}
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PACTSPEC_PUBLISH_TOKEN` | Authentication token for the registry | (none) |
| `PACTSPEC_REGISTRY` | Registry base URL | `https://pactspec.dev` |

Environment variables are used as fallbacks when the corresponding option is not set in code.

## `.well-known/pactspec.json`

The middleware automatically serves your agent spec at `GET /.well-known/pactspec.json`. This enables direct agent-to-agent discovery without the registry.

```bash
curl http://localhost:3000/.well-known/pactspec.json
```

## Disabling Auto-Publish

For testing or local development, disable publishing:

```js
app.use(pactspec({
  name: 'My Agent',
  skills: [{ ... }],
  autoPublish: false,   // No network calls — only serves .well-known
}));
```

The `.well-known/pactspec.json` endpoint still works even with `autoPublish: false`.

## Multiple Skills

```js
app.use(pactspec({
  name: 'Document AI',
  provider: { name: 'Acme Corp' },
  skills: [
    {
      id: 'extract-text',
      name: 'Extract Text',
      description: 'OCR text extraction from images',
      path: '/api/extract-text',
      inputSchema: { type: 'object', required: ['imageUrl'], properties: { imageUrl: { type: 'string' } } },
      outputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } },
    },
    {
      id: 'classify-document',
      name: 'Classify Document',
      description: 'Classify document type (invoice, receipt, contract, etc.)',
      path: '/api/classify',
      inputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } },
      outputSchema: { type: 'object', required: ['type', 'confidence'], properties: { type: { type: 'string' }, confidence: { type: 'number' } } },
    },
  ],
}));
```

## With Pricing

```js
app.use(pactspec({
  name: 'Premium OCR Agent',
  provider: { name: 'Acme Corp' },
  skills: [{
    id: 'ocr-extract',
    name: 'OCR Extract',
    description: 'High-accuracy OCR extraction',
    path: '/api/ocr',
    inputSchema: { type: 'object', required: ['imageUrl'], properties: { imageUrl: { type: 'string' } } },
    outputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } },
    pricing: {
      model: 'per-invocation',
      amount: 0.05,
      currency: 'USD',
      protocol: 'stripe',
    },
  }],
}));
```

## Programmatic Usage

You can use the spec builder and publisher directly without the middleware:

```ts
import { buildSpec, publishToRegistry } from '@pactspec/register';

const spec = buildSpec(options, 'https://api.acme.com');
const result = await publishToRegistry(spec, {
  registry: 'https://pactspec.dev',
  agentId: 'acme-corp:my-agent',
  publishToken: process.env.PACTSPEC_PUBLISH_TOKEN,
});

if (result.success) {
  console.log(`Published: ${result.agentUrl}`);
}
```

## Requirements

- Node.js >= 18 (uses native `fetch`)
- Zero runtime dependencies

## License

MIT
