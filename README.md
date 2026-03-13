# PactSpec

**Open protocol standard for machine-readable AI agent capability declaration.**

PactSpec fills the gap between existing transport protocols (MCP, A2A) and a complete agent economy. No standard currently exists for machine-readable capability description with pricing, test suites, and cryptographic attestation. This is it.

## What PactSpec adds that MCP/A2A don't

| Feature | MCP | A2A | PactSpec |
|---------|-----|-----|-----------|
| Skill-level I/O schemas | Partial | No | Yes |
| Pricing declaration | No | No | Yes |
| Test suite URL | No | No | Yes |
| SLA guarantees | No | No | Yes |
| Cryptographic attestation | No | No | Yes |

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
- Generates a `SHA-256` attestation hash: `sha256(agentId + skillId + results + timestamp)`
- Stores an immutable validation run record

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
