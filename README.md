# PactSpec

An open-source spec for AI agent trust. Declare what your agent does, prove it works, state what it costs.

**Registry:** [pactspec.dev](https://pactspec.dev) | **Docs:** [pactspec.dev/spec](https://pactspec.dev/spec)

## Quick start

```bash
npm install -g @pactspec/cli

pactspec init -i                     # interactive setup
pactspec validate agent.pactspec.json  # offline schema check
pactspec test agent.pactspec.json      # run tests against live endpoint
pactspec publish agent.pactspec.json --agent-id my-org
pactspec badge agent.pactspec.json     # get a README badge
```

First publish returns a **publisher key** — save it. You need it to update your agent:

```bash
pactspec publish agent.pactspec.json --agent-id my-org --publisher-key psk_...
```

Or auto-register from your Express app:

```javascript
const { pactspec } = require('@pactspec/register');

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
// Server starts → publishes to pactspec.dev
```

## What it does

PactSpec is an open-source specification for AI agent capability declaration. One JSON file per agent declares:

- **Skills** — what the agent does, with typed input/output schemas
- **Pricing** — what it costs (per-invocation, per-token, per-second) and how to pay (Stripe, x402)
- **Test suites** — HTTP tests the registry runs against the live endpoint
- **Benchmarks** — independent test suites with known correct answers

## Trust model

The registry runs all tests itself — no self-reported metrics.

| Tier | What it means | Badge color |
|------|---------------|-------------|
| **None** | Not verified | Gray |
| **Verified** | Passed its own test suite (health check — agent controls the tests) | Yellow |
| **Benchmarked** | Scored on independent benchmarks with known correct answers | Green |

Verification expires after 7 days. Stale badges turn yellow, then red. All results are signed with the registry's Ed25519 key — verify independently at [`/api/registry-key`](https://pactspec.dev/api/registry-key).

## Authentication

- **First publish**: No key needed. The registry generates a publisher key and returns it once.
- **Subsequent publishes**: Pass `X-Publisher-Key` header (or `--publisher-key` in CLI). You can only update agents you published.
- **Admin override**: `X-Publish-Token` header (shared secret for registry operators).

## CI / GitHub Action

Add to `.github/workflows/pactspec.yml` — auto-discovers all `*.pactspec.json` files:

```yaml
name: PactSpec
on:
  push:
    paths: ['**/*.pactspec.json']
  pull_request:
    paths: ['**/*.pactspec.json']

jobs:
  pactspec:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Grumpy254/pactspec/github-action@main
```

## Packages

| Package | Install | What it does |
|---|---|---|
| `@pactspec/cli` | `npm i -g @pactspec/cli` | CLI: init, validate, test, publish, verify, badge, price, bulk-publish, from-mcp, from-openclaw |
| `@pactspec/register` | `npm i @pactspec/register` | Auto-publish middleware for Express |
| `@pactspec/client` | `npm i @pactspec/client` | Consumer SDK with auto-payment handling |
| `@pactspec/sdk` | `npm i @pactspec/sdk` | JS SDK for registry interaction |
| `@pactspec/x402-middleware` | `npm i @pactspec/x402-middleware` | HTTP 402 micropayment middleware |
| `@pactspec/stripe-billing` | `npm i @pactspec/stripe-billing` | Stripe metered billing middleware |
| `pactspec` | `pip install pactspec` | Python SDK |
| `pactspec-langchain` | `pip install pactspec-langchain` | LangChain integration |
| `pactspec-crewai` | `pip install pactspec-crewai` | CrewAI integration |

## Benchmarks

2 verified benchmark suites with objectively correct answers:

- API Response Quality (10 tests)
- JSON Schema Validation (10 tests)

5 additional domain-specific benchmarks (medical, legal, security, data extraction, summarization) are in `benchmarks/unreviewed/` — their expected answers have not been validated by domain experts. We moved them after finding incorrect ICD-11 codes. Contributions from domain professionals welcome.

## API

```
GET  /api/agents                    Search/list agents
POST /api/agents                    Publish agent spec (returns publisher key on first publish)
GET  /api/agents/[id]               Get single agent
POST /api/agents/[id]/validate      Run validation (results signed with Ed25519)
GET  /api/benchmarks                List benchmarks
POST /api/benchmarks/[id]/run       Run benchmark against agent
GET  /api/badge/[id]                SVG badge for README
GET  /api/registry-key              Registry's Ed25519 public key (for signature verification)
GET  /api/agents.md                 Machine-readable registry
GET  /api/spec/v1                   JSON Schema
```

## Setup (development)

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# optional: REGISTRY_SIGNING_KEY (base64 Ed25519 private key — auto-generated in dev)

npm install
npm run dev
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
