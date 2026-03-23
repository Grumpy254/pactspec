# pactspec

Official Python SDK for [PactSpec](https://pactspec.dev) -- validate, publish, and verify AI agent capability specs.

## Installation

```bash
pip install pactspec
```

## Quick start

### Validate a spec offline

```python
from pactspec import validate_spec

spec = {
    "specVersion": "1.0.0",
    "id": "urn:pactspec:acme:summarizer",
    "name": "Summarizer Agent",
    "version": "1.0.0",
    "provider": {"name": "Acme Corp"},
    "endpoint": {"url": "https://api.acme.com/summarize"},
    "skills": [
        {
            "id": "summarize",
            "name": "Summarize Text",
            "description": "Summarizes input text",
            "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}}},
            "outputSchema": {"type": "object", "properties": {"summary": {"type": "string"}}},
        }
    ],
}

result = validate_spec(spec)
if result.valid:
    print("Spec is valid!")
else:
    for err in result.errors:
        print(f"  - {err}")
```

### Publish to the registry

```python
from pactspec import PactSpecClient

client = PactSpecClient(agent_id="my-agent@acme.com")
pub = client.publish(spec)
print(f"Published: {pub.id} (spec_id: {pub.spec_id})")
```

### Verify a skill

```python
verification = client.verify(pub.id, "summarize")
print(f"Status: {verification.status}")
for tr in verification.results:
    status = "PASS" if tr.passed else "FAIL"
    print(f"  [{status}] {tr.test_id} ({tr.duration_ms}ms)")
```

### Search the registry

```python
from pactspec import search

results = search(q="summarize", verified_only=True)
for agent in results.agents:
    print(f"{agent.name} v{agent.version} - {agent.spec_id}")
```

## API reference

### `validate_spec(spec) -> ValidateResult`

Validate a PactSpec document against the v1 JSON schema. Offline, no network calls.

- **Returns:** `ValidateResult` with `.valid` (bool) and `.errors` (list of strings).

### `PactSpecClient`

```python
client = PactSpecClient(
    agent_id="my-agent@acme.com",   # default agent ID for publish
    registry="https://pactspec.dev", # registry URL (default)
    publish_token="tok_...",         # optional auth token
    timeout=30,                      # HTTP timeout in seconds
)
```

| Method | Description |
|---|---|
| `client.validate(spec)` | Validate a spec offline |
| `client.publish(spec)` | Validate + publish to the registry |
| `client.verify(agent_id, skill_id)` | Trigger a verification run |
| `client.get_agent(agent_id)` | Fetch an agent by UUID or spec URN |
| `client.search(q=..., verified_only=...)` | Search the registry |

### Module-level functions

The same operations are available as standalone functions:

```python
from pactspec import publish, verify, get_agent, search

result = publish(spec, agent_id="my-agent@acme.com")
verification = verify(result.id, "my-skill")
agent = get_agent(result.id)
results = search(q="coding", verified_only=True)
```

### Exceptions

| Exception | When |
|---|---|
| `PactSpecError` | Base class for all SDK errors |
| `PactSpecValidationError` | Spec fails local schema validation |
| `PactSpecAPIError` | Registry API returns an error |
| `PactSpecNotFoundError` | Agent not found (404) |

All exceptions include `.status_code` (int or None) and `.details` (list of strings).

### Types

The `pactspec.types` module provides TypedDict definitions matching the canonical TypeScript types:

- `PactSpec`, `PactSpecSkill`, `PactSpecPricing`, `PactSpecProvider`, `PactSpecEndpoint`
- `PactSpecAuth`, `PactSpecTestSuite`, `PactSpecExample`, `PactSpecLinks`, `PactSpecDelegation`
- `Benchmark`, `BenchmarkResult`

These are useful for type checking with mypy or pyright.

## SDK vs CLI

| | Python SDK | CLI (`pactspec`) |
|---|---|---|
| **Use when** | Building Python apps, CI pipelines, programmatic access | Quick one-off commands, shell scripts |
| **Install** | `pip install pactspec` | `npm i -g pactspec` |
| **Validation** | `validate_spec(spec)` | `pactspec validate spec.json` |
| **Publishing** | `client.publish(spec)` | `pactspec publish spec.json` |
| **Output** | Python objects | JSON / human-readable text |

## License

MIT
