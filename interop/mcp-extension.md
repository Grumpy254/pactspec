# Using PactSpec as an MCP Extension

MCP (Model Context Protocol) has significant adoption. Rather than competing with it,
PactSpec can be layered on top of an existing MCP tool manifest using the `x-pactspec`
extension field. This lets MCP adopters gain pricing, test suite, and registry
discovery without migrating away from MCP.

---

## The pattern

MCP tool manifests support arbitrary extension fields prefixed with `x-`. A PactSpec
reference can be embedded in any MCP server's tool definitions:

```json
{
  "name": "invoice-processor",
  "description": "Extracts line items from invoice PDFs",
  "inputSchema": {
    "type": "object",
    "required": ["url"],
    "properties": {
      "url": { "type": "string", "description": "URL of the invoice PDF" }
    }
  },
  "x-pactspec": {
    "id": "urn:pactspec:acme:invoice-processor",
    "registry": "https://pactspec.dev/api/agents/urn:pactspec:acme:invoice-processor",
    "skill": "extract-line-items",
    "verified": true,
    "verificationUrl": "https://pactspec.dev/api/agents/urn:pactspec:acme:invoice-processor"
  }
}
```

The `x-pactspec` block tells any consumer that:
1. This tool has a full PactSpec published at the registry
2. It has been verified (or not)
3. Pricing and test suite details can be fetched from the registry URL

---

## What this enables

**For MCP server authors:**
- Publish once to PactSpec, reference it from your existing MCP manifest
- No changes to your MCP implementation
- Gain a verified badge visible to registry consumers

**For MCP client authors (orchestrators, marketplaces):**
- Detect `x-pactspec` and fetch the full capability declaration
- Surface pricing before invoking a tool
- Show verified status to end users
- Build procurement flows on top of existing MCP tool discovery

**For the PactSpec ecosystem:**
- Distribution through MCP's existing adoption without requiring migration
- MCP server count becomes a potential adoption vector

---

## Conversion

Convert an existing MCP tool manifest to a full PactSpec:

```bash
pactspec convert mcp my-mcp-manifest.json -o pactspec.json
```

The converter maps:
| MCP field | PactSpec field |
|---|---|
| `server.name` | `name` |
| `server.version` | `version` |
| `server.url` / `server.endpoint` | `endpoint.url` |
| `tools[].name` | `skills[].id` (slugified) |
| `tools[].description` | `skills[].description` |
| `tools[].inputSchema` | `skills[].inputSchema` |
| *(not in MCP)* | `skills[].outputSchema` — must be added manually |
| *(not in MCP)* | `skills[].pricing` — must be added manually |
| *(not in MCP)* | `skills[].testSuite` — must be added manually |

The converter emits warnings for every field that requires manual completion.

---

## What MCP provides that PactSpec doesn't (and vice versa)

| Concern | MCP | PactSpec |
|---|---|---|
| Runtime tool invocation protocol | ✓ | ✗ |
| Streaming / SSE responses | ✓ | ✗ |
| Tool parameter schemas | ✓ | ✓ |
| Output schemas | ✗ | ✓ |
| Pricing metadata | ✗ | ✓ |
| Executable test suite | ✗ | ✓ |
| Verified record | ✗ | ✓ |
| Public registry / discovery | ✗ | ✓ |
| Payment protocol routing | ✗ | ✓ |

They are complementary. MCP handles invocation. PactSpec handles declaration and trust.
