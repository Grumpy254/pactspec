# PactSpec Security Policy

This is the initial security policy for PactSpec. It will evolve as the spec and registry mature.

## Reporting vulnerabilities

Please do **not** open public GitHub issues for security vulnerabilities.
Email: security@pactspec.dev (or open a private GitHub advisory).

We will acknowledge within 48 hours and aim to resolve critical issues within 7 days.

---

## Threat Model

### 1. SSRF via user-supplied URLs

**Threat:** An attacker publishes a spec with `testSuite.url` or `endpoint.url`
pointing to internal services (`169.254.169.254`, `10.x.x.x`, `localhost`).
When the validator fetches these, it can exfiltrate cloud metadata, credentials,
or probe internal network topology.

**Mitigations implemented:**
- URL scheme allowlist: only `http:` and `https:` are accepted
- Hostname blocklist: `localhost`, `0.0.0.0`, `metadata.google.internal`, etc.
- Private IP range checks across all RFC-1918 and reserved ranges (IPv4 + IPv6)
- DNS resolution at validation time: hostname resolved to IPs, each checked against private ranges
- **DNS rebinding protection:** hostname resolved once to a safe IP; fetches use undici with a pinned DNS lookup callback so the TCP connection goes to the pre-resolved IP while the URL hostname is preserved for TLS SNI and certificate validation
- Optional `VALIDATION_HOST_ALLOWLIST` for locked-down deployments

**Residual risk:** Publicly routable IPs that are later re-assigned to private infrastructure. Mitigated by allowlisting in production.

---

### 2. Malicious test suite content

**Threat:** An attacker crafts a `testSuite.url` that returns a malformed JSON
payload designed to crash the validator (ReDoS, memory exhaustion, prototype pollution).

**Mitigations implemented:**
- Fetch timeout: 10s for test suite fetch, 15s per test case
- Response body parsed with standard `JSON.parse` (no eval)
- Ajv schema compilation is cached; schemas are not eval'd
- Test suite size is implicitly bounded by timeout

**Recommended:** Add explicit response body size limit (e.g., 1MB) — tracked as #TODO.

---

### 3. Attestation replay

**Threat:** An attacker copies a valid attestation hash from one agent/skill and
applies it to a different one to falsely claim verification.

**Mitigations implemented:**
- Attestation hash is `SHA256(agentId + skillId + testResults + timestamp)`
- `agentId` and `skillId` are bound into the hash — replay to a different agent or skill produces a different hash
- Hash is stored with `verified_at` timestamp in the database
- Attestation is invalidated when the spec content changes (via spec hash comparison)

**Residual risk:** An attacker who controls both the agent endpoint and a passing
test suite can generate a legitimate attestation for arbitrary behaviour not
covered by the tests. This is a conformance problem, not a security problem —
mitigated by requiring meaningful test suites.

---

### 4. Spec tampering

**Threat:** A published spec is modified after attestation, leaving a verified
badge on a spec that was never validated.

**Mitigations implemented:**
- Every `POST /api/agents` computes a SHA-256 spec hash and compares it to the stored version
- If the spec content changes, `verified`, `attestation_hash`, and `verified_at` are cleared
- The agent must re-run validation to regain the verified badge

---

### 5. Registry abuse / spam

**Threat:** Automated bots flood the registry with fake agents, polluting search results.

**Current state:** `X-Agent-ID` header provides minimal friction. Rate limiting is not yet implemented.

**Planned mitigations:**
- Per-IP rate limiting at Vercel edge (planned)
- API key auth with registration (planned for v1.1)
- Verified badge as the primary trust signal — unverified agents are clearly marked

---

### 6. Validation run DoS

**Threat:** An attacker triggers repeated validation runs against a slow agent
endpoint, causing the validator to exhaust connections or run up serverless costs.

**Mitigations implemented:**
- Per-test timeout (default 15s, configurable in test suite)
- Total validation run bounded by sum of test timeouts

**Planned:** Rate limit validation runs per agent per hour.

---

## Attestation format

```
attestation_hash = SHA256(
  agentId         // UUID from registry
  + skillId       // skill identifier string
  + JSON(results) // sorted, deterministic test result array
  + timestamp     // ISO 8601 UTC
)
```

The hash is stored in the `agents` table and returned in API responses.

**What this is:**
- A tamper-evident fingerprint bound to a specific agent, skill, result set, and point in time.
- If any of those four inputs change, the hash changes — so a modified record is detectable by recomputing the hash from its components.
- The hash is stored by the PactSpec registry, a centralized service. Trust in the record depends on trust in the registry database (Supabase with RLS; only the service role can write attestation data).

**What this is NOT:**
- It is NOT a cryptographic signature. There is no private key, no PKI, no chain of trust.
- A third party cannot verify that "PactSpec ran these tests" without trusting the registry database — they can only verify that the stored hash matches the stored inputs.
- It does not prove the test suite is comprehensive or adversarial.
- SLA fields (`p99LatencyMs`, `uptimeSLA`) are self-declared metadata in the spec — they are not monitored or enforced by the registry.

**Planned (v1.1):** Ed25519 signature over the attestation payload, signed by a registry keypair. Third parties will be able to verify attestations using the registry's public key, without trusting the database. This makes attestations portable and independently verifiable.

---

## Safe validation deployment

For production deployments handling untrusted agent submissions:

1. Set `VALIDATION_HOST_ALLOWLIST` to known-safe test hosts
2. Run the validator in an isolated worker with no access to internal VPC
3. Set egress rules to block `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`
4. Cap serverless function memory and execution time
