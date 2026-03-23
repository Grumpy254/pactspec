# Show HN: PactSpec — test your AI agents against real benchmarks, not just "it responds"

After MCP dropped, I wired up a dozen tool servers to a workflow I was building. The protocol worked — every tool responded. But I had no idea if the responses were actually correct, what anything cost, or who to blame when things broke at 2am.

I looked for something that could answer: "is my AI agent actually working in production?" Not "does it return JSON" — does it get the right answer? How does it compare to alternatives? Is it getting worse over time?

Nothing existed. So I built PactSpec.

## What it does

You write a test suite for your agent (or use one of ours). PactSpec runs it against the live endpoint and gives you a score.

```bash
npm install -g @pactspec/cli

pactspec test my-agent.json --skill extract-invoices
# ✓ test-001 (120ms)
# ✓ test-002 (95ms)
# ✗ test-003 — expected "8A80.0", got "G43.909"
# 2 passed, 1 failed
```

But the real value is benchmarks — domain-specific test suites with known correct answers:

- **ICD-11 Medical Coding** — 20 scenarios with real WHO codes. Does your agent return `8A80.0` for tension headache, or something wrong?
- **Security Vulnerability Scanning** — 15 code snippets with OWASP-pattern vulnerabilities. Does your agent find the SQL injection?
- **Legal Contract Review** — 15 clauses with known risk levels. Does your agent flag the unlimited liability clause as high-risk?
- **Data Extraction** — 15 unstructured texts. Can your agent pull the right invoice number, the right price, the right name?

An agent that scores 94.7% on the medical coding benchmark is meaningfully different from one that scores 41%. That distinction didn't exist before.

## How it works

1. **Write a spec** — a JSON file declaring your agent's skills, endpoint, and test suite URL
2. **Run tests** — `pactspec test` or `pactspec verify` runs the suite against your live endpoint
3. **Get scored** — pass rates, benchmark scores, SHA-256 attestation records
4. **Get listed** — agents that pass get published to the open registry at [pactspec.dev](https://pactspec.dev)

Or skip the spec file entirely — add one middleware to your Express app:

```javascript
const { pactspec } = require('@pactspec/register');

app.use(pactspec({
  name: 'My Agent',
  provider: { name: 'My Org' },
  skills: [{ id: 'my-skill', path: '/api/skill', ... }]
}));
// Server starts → auto-publishes to pactspec.dev
```

## What else it does (once you're in)

Testing is the entry point. But a PactSpec also declares:

**Pricing** — what the agent costs per invocation/token/second. The registry verifies the price matches what the endpoint actually charges (calls it without payment, checks the 402 response). Middleware packages handle payment for Stripe and x402 (HTTP 402 micropayments).

**Discovery** — the registry at pactspec.dev lets orchestrators search by capability, filter by price and quality score, and compare agents programmatically. LangChain and CrewAI integrations let frameworks query the registry automatically:

```python
from pactspec_langchain import PactSpecToolkit

toolkit = PactSpecToolkit.from_registry(
    query="invoice processing",
    verified_only=True,
    max_price=0.10,
)
```

## What's honest

- Test suites are written by agent owners. They can be easy. That's why benchmarks exist — independent test suites with known correct answers that you can't game without actually being good.
- Benchmarks we ship are synthetic (real classification codes, synthetic scenarios). We label them as such. We built the format so peer-reviewed benchmarks from domain experts are distinct from ours.
- The registry is centrally hosted. The spec is open, code is on GitHub, anyone can run their own. We designed it so the registry is a discovery layer, not a runtime dependency.
- PactSpec doesn't process payments. Money flows directly between consumer and agent.

## What's shipped

This isn't a spec proposal. Everything is live:

- **Registry:** [pactspec.dev](https://pactspec.dev)
- **CLI:** `npm install -g @pactspec/cli` (validate, test, publish, verify, benchmarks)
- **npm:** `@pactspec/register`, `@pactspec/client`, `@pactspec/x402-middleware`, `@pactspec/stripe-billing`
- **PyPI:** `pactspec`, `pactspec-langchain`, `pactspec-crewai`
- **GitHub:** [github.com/Grumpy254/pactspec](https://github.com/Grumpy254/pactspec)
- **Demo:** [pactspec.dev/demo](https://pactspec.dev/demo) (interactive x402 payment flow)

## Looking for

- **Early adopters** — if you're building AI agents and want to know if they actually work, `pactspec init -i` gets you started in 2 minutes
- **Benchmark contributors** — if you have domain expertise (medical, legal, security, finance), your benchmarks are the most valuable thing you can contribute
- **Framework integrators** — the LangChain and CrewAI plugins exist, happy to help with others
