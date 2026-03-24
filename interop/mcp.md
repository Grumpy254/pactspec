# PactSpec <-> MCP Interoperability Guide

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) is a transport
and tool-invocation standard between AI models and tool servers. PactSpec is a
capability declaration and verification standard for AI agents.

They are **complementary, not competing**:

| Concern | MCP | PactSpec |
|---------|-----|-----------|
| How to call a tool | Yes | No |
| What a tool does (schema) | Partial | Yes |
| What it costs | No | Yes |
| SLA guarantees | No | Yes |
| Cryptographic verification | No | Yes |
| Machine-readable registry | No | Yes |

An MCP server can publish a PactSpec to make itself discoverable, priceable,
and verifiable - without changing any of its MCP implementation.

---

## Conceptual mapping

| MCP concept | PactSpec equivalent | Notes |
|-------------|---------------------|-------|
| `ServerInfo.name` | `name` | Direct |
| `ServerInfo.version` | `version` | Direct |
| `Tool.name` | `skills[].id` | Hyphenate for PactSpec id |
| `Tool.description` | `skills[].description` | Direct |
| `Tool.inputSchema` | `skills[].inputSchema` | JSON Schema - direct passthrough |
| *(none)* | `skills[].outputSchema` | MCP doesn't define output schema |
| Server transport URL | `endpoint.url` | The HTTP/SSE endpoint |
| *(none)* | `skills[].pricing` | PactSpec-only |
| *(none)* | `skills[].testSuite` | PactSpec-only |

---

## Pattern: MCP server with PactSpec declaration

An MCP server can serve its PactSpec at `/.well-known/pactspec.json`:

```
GET /.well-known/pactspec.json
```

This allows discovery without modifying the MCP protocol itself.

### Example PactSpec for an MCP server

MCP server with two tools (`read_file`, `write_file`):

```json
{
  "specVersion": "1.0.0",
  "id": "urn:pactspec:acme:filesystem-mcp",
  "name": "Filesystem MCP Server",
  "version": "1.0.0",
  "provider": { "name": "Acme", "url": "https://acme.ai" },
  "endpoint": {
    "url": "https://mcp.acme.ai",
    "auth": { "type": "bearer" }
  },
  "skills": [
    {
      "id": "read-file",
      "name": "Read File",
      "description": "Read the contents of a file at the given path.",
      "inputSchema": {
        "type": "object",
        "required": ["path"],
        "properties": { "path": { "type": "string" } }
      },
      "outputSchema": {
        "type": "object",
        "required": ["content"],
        "properties": { "content": { "type": "string" } }
      },
      "pricing": { "model": "free", "amount": 0, "currency": "USD" }
    },
    {
      "id": "write-file",
      "name": "Write File",
      "description": "Write content to a file at the given path.",
      "inputSchema": {
        "type": "object",
        "required": ["path", "content"],
        "properties": {
          "path": { "type": "string" },
          "content": { "type": "string" }
        }
      },
      "outputSchema": {
        "type": "object",
        "required": ["success"],
        "properties": { "success": { "type": "boolean" } }
      },
      "pricing": { "model": "free", "amount": 0, "currency": "USD" }
    }
  ]
}
```

---

## Converting MCP tool list -> PactSpec

### Using the CLI
```bash
pactspec from-mcp https://mcp.acme.ai --out pactspec.json
```

The CLI calls the MCP `tools/list` endpoint and generates a skeleton PactSpec.
You then fill in `pricing` and `testSuite` manually.

### Manual rules

1. Each MCP `Tool` -> one PactSpec `skill`
2. `Tool.name` -> `skill.id` (lowercase, hyphenated)
3. `Tool.inputSchema` -> `skill.inputSchema` (direct passthrough - MCP already uses JSON Schema)
4. Add `outputSchema` manually - MCP doesn't define this
5. Set `endpoint.url` to the MCP server's HTTP base URL

---

## Discovery flow (proposed)

```
AI agent wants to find a file-reading capability
        v
Queries PactSpec registry: GET /api/agents?q=filesystem
        v
Finds PactSpec for Filesystem MCP Server
        v
Reads endpoint.url + auth config
        v
Connects via standard MCP transport
        v
Invokes tools normally
```

PactSpec handles **discovery and trust**; MCP handles **invocation**.

---

## Key difference: outputSchema

MCP does not define the shape of tool responses. PactSpec requires `outputSchema`
for every skill. This is intentional - it enables:

1. Automated test suite generation
2. Response validation in the validator
3. Type-safe client generation

When migrating from MCP, define your `outputSchema` based on what your tool
actually returns. This is the most valuable addition PactSpec makes to the
MCP ecosystem.
