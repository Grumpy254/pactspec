# PactSpec Conformance Test Suite

This directory contains the canonical test vectors for PactSpec v1 validators.
A conformant validator MUST accept all documents in `valid/` and MUST reject all
documents in `invalid/` with a meaningful error.

## Structure

```
conformance/
  valid/            # Documents that MUST be accepted
  invalid/          # Documents that MUST be rejected (with expected error hint)
```

## Running against your validator

```bash
# Using the PactSpec CLI (planned)
pactspec conformance --validator https://your-validator/api/validate

# Using the hosted registry validator (planned)
pactspec conformance --validator https://pactspec.dev/api/spec/validate
```

Exit code 0 = all tests passed. Exit code 1 = one or more failures.

## Test vector naming

`valid/` files are named `{feature}.json`.
`invalid/` files are named `{rule-violated}.json`.

## Adding test vectors

Open a PR. All new vectors require:
- A comment in the JSON (or a `.md` companion file) explaining what is being tested
- For `invalid/`: the expected validation error keyword (e.g., `required`, `pattern`, `const`)
