# PactSpec — Honest Limitations

This document exists because credibility requires honesty. Here is exactly what PactSpec
does and does not provide today, and what is planned to address each gap.

---

## 1. Verification is not independent

**What happens:** When you run `pactspec verify`, the registry fetches the test suite
hosted at your `testSuite.url` and runs it against your endpoint. You wrote the tests,
you host the tests, and you control the endpoint. The registry re-runs them.

**What this means in practice:** A provider who wants a verified badge without
meaningful testing can write trivially passing tests (e.g., `expect: { status: 200 }`
with no output schema check). The badge proves the agent passed *a* test suite — not
that the test suite is rigorous.

**What partially mitigates this:** The test suite URL is public. Anyone can read it,
audit it, and judge whether the tests are meaningful. The badge links to the run record.

**What is planned:** Community-contributed test suites, adversarial test cases, and
eventually independent verification providers who can issue their own attestations.

---

## 2. The verified record is not a cryptographic signature

**What happens:** When all tests pass, the registry computes:

```
SHA-256(agentId + skillId + sortedTestResults + timestamp)
```

This hash is stored in the registry database and returned in API responses.

**What this means in practice:** This is a tamper-evident fingerprint — if any input
changes, the hash changes. But it is *not* a signature. The registry is a trusted third
party. If the registry database is compromised or the operator acts dishonestly, hashes
can be fabricated. You are trusting pactspec.dev in the same way you trust npm to serve
the packages you asked for.

**What is planned (v1.1):** Ed25519 signing of the attestation payload by a registry
keypair. The public key will be published so third parties can verify attestations
without trusting the database. This moves the trust model from "trust the database"
to "trust the signing key."

---

## 3. The registry is centralized

**What happens:** All agents are registered at pactspec.dev. All attestations are stored
in Supabase. All validation runs through the PactSpec validator.

**What this means in practice:** If pactspec.dev goes down, the registry is unavailable.
If it is compromised, attestation records could be modified. This is the same trust model
as npm, PyPI, or Docker Hub — a centralized authority you choose to trust.

**What partially mitigates this:** The spec itself is open. Anyone can run their own
registry. The `$id` in the schema is a URL, not an authority claim. The DID field on
providers gestures toward a decentralized future.

**What is planned:** A decentralized attestation layer using DID-based signing, allowing
providers to anchor their verified records independently of the PactSpec registry.

---

## 4. SLA and pricing declarations are unverified metadata

**What happens:** Providers declare `"p99LatencyMs": 3000` and
`"uptimeSLA": 0.999` in their spec. The registry stores and displays this.

**What this means in practice:** These are self-reported numbers with no monitoring,
no enforcement, and no penalties for violation. They are useful for discovery and
comparison, but they carry no legal or contractual weight.

**What is planned:** Optional integration with external monitoring providers (e.g.,
Better Uptime, Checkly) to display *measured* SLAs alongside declared ones. Consumers
will be able to see both.

---

## 5. X-Agent-ID is not real authentication

**What happens:** Publishing requires an `X-Agent-ID` header with a basic format check
(4–128 chars, alphanumeric). There is no account system, no email verification, no
OAuth.

**What this means in practice:** Anyone can publish an agent claiming to be from any
provider. The verified badge is the primary trust signal — an unverified agent with a
convincing name is just that, unverified.

**What is planned:** API key authentication with email verification for v1.1. Rate
limiting at the Vercel edge level.

---

## 6. No adoption yet

**What this means in practice:** PactSpec is currently a spec searching for adopters.
The registry exists, the tooling works, but no production agents are publishing
PactSpecs. The value of a registry scales with the number of agents in it.

**What is being done about it:** Targeted outreach to agent marketplace builders and
agent API providers. The tooling is designed to reduce the cost of adoption to under
30 minutes (CLI convert from OpenAPI, validate, publish).

---

## What the verified badge does mean

Despite the limitations above, a verified badge provides real signal:

- The agent endpoint was reachable and returned the expected HTTP status codes
- The response matched the declared output schema at the time of verification
- The spec has not been modified since verification (spec hash is checked on every update)
- The test suite is public and auditable by anyone

For consumers making automated decisions about which agents to use, this is meaningfully
better than no verification at all — as long as you also read the test suite.
