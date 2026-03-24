# PactSpec <-> OpenAPI Interoperability Guide

OpenAPI describes HTTP APIs. PactSpec describes AI agent capabilities including
pricing, SLAs, and executable verification. They are complementary: an agent
with an OpenAPI spec can generate a PactSpec; a PactSpec can reference an
OpenAPI spec for detailed endpoint documentation.

---

## Conceptual mapping

| OpenAPI | PactSpec | Notes |
|---------|-----------|-------|
| `info.title` | `name` | Direct mapping |
| `info.version` | `version` | Must be semver in PactSpec |
| `info.contact` | `provider.contact` | Email field |
| `servers[0].url` | `endpoint.url` | Primary server URL |
| `securitySchemes.bearerAuth` | `endpoint.auth.type: "bearer"` | Simplified in PactSpec |
| `paths./foo.post` | `skills[].id` | One skill per logical operation |
| `paths./foo.post.requestBody.content.application/json.schema` | `skills[].inputSchema` | JSON Schema passthrough |
| `paths./foo.post.responses.200.content.application/json.schema` | `skills[].outputSchema` | JSON Schema passthrough |
| `info.description` | `description` | Direct mapping |
| `tags` | `skills[].tags` | Mapped per-operation |
| `info.license` | `license` | Direct mapping |
| `externalDocs.url` | `links.documentation` | Direct mapping |

---

## Fields with no OpenAPI equivalent

These are PactSpec-only and must be added manually:

| PactSpec field | Notes |
|----------------|-------|
| `skills[].pricing` | No OpenAPI equivalent - add via `x-pricing` extension first |
| `skills[].testSuite` | No OpenAPI equivalent |
| `attestations` | Registry-managed |

---

## Converting OpenAPI -> PactSpec

### Automated
```bash
pactspec convert openapi openapi.yaml --out pactspec.json
```

### Manual mapping rules

1. **One skill per `operationId`** (or per `tag` if you prefer coarser granularity)
2. **`inputSchema`** = the `requestBody` JSON Schema, or a merged object of all query/body parameters
3. **`outputSchema`** = the `200` response JSON Schema
4. **`id`** = `operationId` lowercased and hyphenated (e.g., `createInvoice` -> `create-invoice`)
5. **`endpoint.url`** = first entry in `servers[]`
6. **`provider.name`** = `info.contact.name` or `info.title`

### Example

OpenAPI:
```yaml
info:
  title: Invoice API
  version: 1.2.0
servers:
  - url: https://api.acme.ai
paths:
  /invoices/extract:
    post:
      operationId: extractLineItems
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [url]
              properties:
                url: { type: string, format: uri }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                required: [lineItems]
                properties:
                  lineItems: { type: array }
```

PactSpec:
```json
{
  "specVersion": "1.0.0",
  "id": "urn:pactspec:acme:invoice-api",
  "name": "Invoice API",
  "version": "1.2.0",
  "provider": { "name": "Acme" },
  "endpoint": { "url": "https://api.acme.ai" },
  "skills": [{
    "id": "extract-line-items",
    "name": "Extract Line Items",
    "description": "POST /invoices/extract",
    "inputSchema": {
      "type": "object",
      "required": ["url"],
      "properties": { "url": { "type": "string", "format": "uri" } }
    },
    "outputSchema": {
      "type": "object",
      "required": ["lineItems"],
      "properties": { "lineItems": { "type": "array" } }
    }
  }]
}
```

---

## Using `x-` extensions in OpenAPI to pre-populate PactSpec

Add these extensions to your OpenAPI spec so the conversion is fully automated:

```yaml
x-pactspec-pricing:
  model: per-invocation
  amount: 0.02
  currency: USD
  protocol: stripe

x-pactspec-test-suite:
  url: https://acme.ai/tests/extract-line-items.json
  type: http-roundtrip
```

---

## Referencing the OpenAPI spec from PactSpec

```json
{
  "links": {
    "documentation": "https://api.acme.ai/openapi.yaml"
  }
}
```
