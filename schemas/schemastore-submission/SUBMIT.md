# SchemaStore Submission Guide

Follow these steps to submit the PactSpec schema to SchemaStore.

## 1. Fork and clone

```bash
gh repo fork SchemaStore/schemastore --clone
cd schemastore
```

## 2. Copy the schema

```bash
cp /path/to/agentspec/schemas/pactspec-v1.json src/schemas/json/pactspec.json
cp /Users/dave/Dev/agentspec/schemas/pactspec-v1.json src/schemas/json/pactspec.json
```

## 3. Add the catalog entry

Open `src/api/json/catalog.json` and add this entry alphabetically (find the "P" section):

```json
{
  "name": "PactSpec",
  "description": "AI agent capability declaration (pactspec.dev)",
  "fileMatch": ["*.pactspec.json", "*.pactspec.yaml"],
  "url": "https://json.schemastore.org/pactspec.json"
}
```

## 4. Add test files

```bash
mkdir -p src/test/pactspec
cp /path/to/agentspec/schemas/schemastore-submission/test/pactspec-minimal.json src/test/pactspec/
cp /path/to/agentspec/schemas/schemastore-submission/test/pactspec-full.json src/test/pactspec/
```

## 5. Verify locally

```bash
npm install
npm test
```

## 6. Commit and submit PR

```bash
git checkout -b add-pactspec-schema
git add src/schemas/json/pactspec.json src/api/json/catalog.json src/test/pactspec/
git commit -m "Add PactSpec schema (AI agent capability declaration)"
gh pr create --title "Add PactSpec schema (AI agent capability declaration)" --body "$(cat <<'EOF'
Adds JSON Schema for [PactSpec](https://pactspec.dev) (`.pactspec.json` / `.pactspec.yaml`).

PactSpec is an open-source spec for declaring AI agent capabilities, pricing, and test suites. The schema enables IDE autocomplete and validation for agent spec files.

- **Schema**: `src/schemas/json/pactspec.json` (Draft-07)
- **File match**: `*.pactspec.json`, `*.pactspec.yaml`
- **Tests**: `src/test/pactspec/` (minimal + full examples)
- **Project**: https://github.com/Grumpy254/pactspec
- **Docs**: https://pactspec.dev/spec
EOF
)"
```

## What happens after merge

Once merged, any VS Code or JetBrains user who creates a `.pactspec.json` file will automatically get:
- Autocomplete for all fields
- Validation errors for missing/invalid fields
- Hover documentation
