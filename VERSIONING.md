# PactSpec Versioning Policy

## Spec versioning

The spec version is declared in every PactSpec document:

```json
{ "specVersion": "1.0.0" }
```

PactSpec follows [Semantic Versioning](https://semver.org):

| Version part | Meaning |
|---|---|
| `MAJOR` | Breaking change - existing valid docs may become invalid |
| `MINOR` | Backwards-compatible addition - new optional fields or capabilities |
| `PATCH` | Clarification or editorial fix - no semantic change |

---

## Compatibility guarantees

### Forwards compatibility
A validator built for `v1.x.x` MUST accept any valid `v1.y.x` document where `y >= x`.
New optional fields introduced in minor versions MUST be ignored by older validators.

### Backwards compatibility
A validator built for `v1.1.x` MUST still accept documents that only use `v1.0.x` fields.

### Breaking changes (MAJOR)
- Removing a field
- Changing a field from optional to required
- Narrowing an existing enum
- Changing validation semantics

---

## Deprecation policy

1. A field or behaviour is marked `@deprecated` in the schema with a note pointing to the replacement
2. It remains valid for at least **two minor releases** after deprecation
3. It is removed only in the next **MAJOR** release
4. A minimum **6-month notice** is given before any MAJOR release

---

## Multi-version support

The registry and validator support `specVersion` routing. When a new major version
ships, the previous major version enters **maintenance mode** (security fixes only)
for 12 months, then is archived.

| Status | Meaning |
|---|---|
| **Current** | Actively developed; all new features land here |
| **Maintenance** | Security and critical bug fixes only |
| **Archived** | No longer supported; docs preserved for reference |

---

## Extension points

Implementers may add custom fields prefixed with `x-`:

```json
{
  "skills": [{
    "id": "my-skill",
    "x-internal-id": "abc123"
  }]
}
```

`x-` fields MUST be ignored by conformant validators. They will never be claimed
by the core spec without a MAJOR version bump and RFC.
