# PactSpec

**Open protocol standard for machine-readable AI agent capability declaration.**

PactSpec fills the gap between existing transport protocols (MCP, A2A) and a complete agent economy. No standard currently exists for machine-readable capability description with pricing, test suites, and tamper-evident verification records. This is it.

## What PactSpec adds that MCP/A2A don't

| Feature | MCP | A2A | PactSpec |
|---------|-----|-----|-----------|
| Skill-level I/O schemas | ✓ Tool inputSchema (JSON Schema on tool parameters) | Partial (skill descriptions, no machine-readable I/O schemas) | ✓ Per-skill inputSchema + outputSchema |
| Pricing declaration | ✗ | ✗ | ✓ Model, amount, currency, protocol |
| Executable test suite | ✗ | ✗ | ✓ HTTP roundtrip tests at a URL |
| SLA declarations | ✗ | ✗ | ✓ p99 latency, uptime |
| Verified badge (tamper-evident record) | ✗ | ✗ | ✓ SHA-256 fingerprint; Ed25519 signing planned v1.1 |
| Payment protocol routing | ✗ | ✗ | ✓ x402, Stripe, none |
| Public open registry | ✗ | ✗ | ✓ pactspec.dev |

## Schema

```
GET /api/spec/v1        -> canonical JSON Schema
GET /schema/v1.json     -> static CDN copy
```

## Governance and Policies

1. Governance: `GOVERNANCE.md`
2. Versioning: `VERSIONING.md`
3. IP and Patent Policy: `IP_POLICY.md`
4. RFC Template: `RFC_TEMPLATE.md`
5. Adopters: `ADOPTERS.md`

## Interoperability

1. OpenAPI mapping: `interop/openapi.md`
2. MCP mapping: `interop/mcp.md`

## Conformance

1. Conformance suite: `conformance/README.md`

## Registry API

```
GET  /api/agents                    List/search agents
POST /api/agents                    Publish new agent spec
GET  /api/agents/[id]               Get single agent
POST /api/agents/[id]/validate      Trigger validation run
GET  /api/agents.md                 Machine-readable Markdown registry
```

### Publish an agent

```bash
curl -X POST https://pactspec.dev/api/agents \
  -H "Content-Type: application/json" \
  -H "X-Agent-ID: my-agent" \
  -d @my-agent-spec.json
```

### Minimal valid spec

```json
{
  "specVersion": "1.0.0",
  "id": "urn:pactspec:acme:my-agent",
  "name": "My Agent",
  "version": "1.0.0",
  "provider": { "name": "Acme" },
  "endpoint": { "url": "https://api.acme.com/agent" },
  "skills": [{
    "id": "my-skill",
    "name": "My Skill",
    "description": "Does something useful",
    "inputSchema": { "type": "object" },
    "outputSchema": { "type": "object" }
  }]
}
```

## Validation & Attestation

When an agent publishes a `testSuite.url` for a skill, call:

```bash
curl -X POST https://pactspec.dev/api/agents/AGENT_ID/validate \
  -H "Content-Type: application/json" \
  -d '{"skillId": "my-skill"}'
```

PactSpec fetches the test suite, runs each test against the agent endpoint, and on pass:
- Sets `verified: true` on the agent
- Stores a SHA-256 fingerprint: `sha256(agentId + skillId + results + timestamp)` — a tamper-evident record that changes if any of those inputs change
- Stores an immutable validation run record

> **What this is and isn't:** The hash is a tamper-evident fingerprint stored in the registry database — not a cryptographic signature. It does not prove the registry ran the tests honestly; it proves the record has not been altered after the fact. Ed25519 signing by a registry keypair is planned for v1.1.

## SDK

```bash
npm install @pactspec/sdk
```

## CLI

```bash
npm install -g @pactspec/cli
pactspec validate my-agent.json
pactspec publish my-agent.json --agent-id my-org
```

## Stack

- Next.js 15 (App Router) + TypeScript
- Supabase (PostgreSQL)
- Vercel

## Setup

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY

# Optional: lock down validation to known hosts
# VALIDATION_HOST_ALLOWLIST=example.com,tests.example.com
# VALIDATION_ALLOW_PRIVATE_IPS=false

npx supabase db push   # run migrations
npm run dev
```

Note: migrations enable RLS. Server routes require `SUPABASE_SERVICE_ROLE_KEY` for writes.
