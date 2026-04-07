# PactSpec

An open-source spec for AI agent trust. Declare what your agent does, prove it works, state what it costs.

**Registry:** [pactspec.dev](https://pactspec.dev)

## Quick start

```bash
npm install -g @pactspec/cli

pactspec init -i              # interactive setup
pactspec validate agent.json  # check against schema
pactspec test agent.json      # run test suite against live endpoint
pactspec publish agent.json --agent-id my-org
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

Verification expires after 7 days. Stale badges turn yellow, then red.

## Packages

| Package | Install | What it does |
|---|---|---|
| `@pactspec/cli` | `npm i -g @pactspec/cli` | CLI: init, validate, test, publish, verify, price, bulk-publish, from-mcp, from-openclaw |
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

5 additional domain-specific benchmarks (medical, legal, security, data extraction, summarization) are available in `benchmarks/unreviewed/` but their expected answers have not been validated by domain experts. We moved them out of the main directory after finding errors in the ICD-11 codes. Contributions from domain professionals welcome.

## API

```
GET  /api/agents                    Search/list agents
POST /api/agents                    Publish agent spec
GET  /api/agents/[id]               Get single agent
POST /api/agents/[id]/validate      Run validation
GET  /api/benchmarks                List benchmarks
POST /api/benchmarks/[id]/run       Run benchmark against agent
GET  /api/badge/[id]                SVG badge for README
GET  /api/agents.md                 Machine-readable registry
GET  /api/spec/v1                   JSON Schema
```

## OpenClaw

Convert OpenClaw skills to PactSpec:

```bash
pactspec from-openclaw https://clawhub.ai/skills/web-search
```

## Setup (development)

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

npm install
npm run dev
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
