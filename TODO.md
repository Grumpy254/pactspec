# PactSpec TODO

## Code Quality / Technical Debt

### Race Conditions (architectural)
- [ ] **TOCTOU in publish flow** — read-existing → decide-reset → upsert is not atomic. Two concurrent publishes of the same spec_id can interleave. Fix: advisory lock or a single stored procedure.
- [ ] **Rate limit TOCTOU** — the validation rate limit check (SELECT count) and insert are separate. Two concurrent requests can both pass. Fix: atomic INSERT with a unique partial index, or Redis-based rate limiter.

### CLI Edge Cases
- [ ] **SSE multi-line data parsing** — only captures last `data:` line instead of concatenating per SSE spec. Low risk (MCP servers send single-line events), but technically non-compliant.
- [ ] **OpenAPI path-level $ref** — converter doesn't resolve `$ref` at the path-item level (OpenAPI 3.x allows it). Currently silently skips those paths.
- [ ] **Skill ID collisions** — slugify can produce duplicate skill IDs (e.g., `"my tool"` and `"my-tool"` both → `"my-tool"`). Add deduplication with `-2`, `-3` suffix.
- [ ] **process.exit without flush** — `process.exit(1)` can truncate piped output. Low impact but technically incorrect. Use `process.exitCode = 1` where possible.

### Frontend
- [ ] **Pagination** — registry UI fetches first 50 agents with no next/prev controls. The API supports `limit`/`offset` but the UI never uses it.

---

## Pricing & Monetization (Major Gap)

Agent owners have almost no way to discover that pricing exists. Most will publish as free by default and never realize they can monetize.

### Discovery & Onboarding
- [ ] **Pricing onboarding in publish flow** — the /publish page is a raw JSON editor with no guidance. Add a step-by-step form or at minimum a sidebar explaining pricing options (free, per-invocation, per-token, per-second) and payment protocols (x402, stripe).
- [ ] **CLI `init` should prompt for pricing** — currently defaults to free silently. Interactive mode should ask: "Will this agent be free or paid?" and guide through model/amount/currency/protocol.
- [ ] **CLI `from-mcp` should warn about pricing** — prints warnings about outputSchema but says nothing about pricing. Add: "! All skills defaulted to free — edit pricing if you want to charge."
- [ ] **"How to monetize your agent" guide** — no docs exist for publishers who want to charge. Write a guide covering: choosing a pricing model, setting up Stripe/x402, what the registry does and doesn't enforce.

### Payment Protocol Implementation
- [ ] **x402 payment flow** — the spec declares x402 as a protocol but there's no implementation. Need: payment verification, 402 response handling, on-chain settlement integration.
- [ ] **Stripe integration** — same as x402. The protocol field exists but there's no Stripe checkout or billing integration.
- [ ] **Pricing verification** — LIMITATIONS.md acknowledges pricing is "unverified metadata with no enforcement." Future: optional webhook integration with payment providers to confirm declared pricing matches actual charges.

### Agent Sharing / Delegation
- [ ] **Agent lending/proxy model** — no concept of delegating agent access, multi-tenant ownership, or loaning agents to other orgs. Consider: sub-licensing, usage-based revenue sharing, proxy specs that wrap another agent's endpoint.

### Registry UX for Pricing
- [ ] **Price comparison view** — orchestrators can filter by max_price but there's no side-by-side comparison of agents that do the same thing at different price points.
- [ ] **Cost calculator** — for per-token or per-second pricing, help consumers estimate cost for their workload.
- [ ] **Free tier badge** — make it visually obvious which agents are free vs paid in the registry.

---

## Security (Deferred)

- [ ] **Ed25519 attestation signing** — planned for v1.1. Current SHA-256 hash is tamper-evident but not authenticity-proving. An HMAC with a server secret would be an intermediate step.
- [ ] **Per-publisher API keys** — current auth is a single shared secret (PACTSPEC_PUBLISH_SECRET). Need per-publisher keys so publishers can only modify their own specs.
- [ ] **Attestation HMAC** — current attestation hash is forgeable (all inputs are public). Use `createHmac('sha256', serverSecret)` for authenticity.
