# Contributing to PactSpec

PactSpec is an open protocol. Contributions are welcome.

## How to contribute

1. **Fork the repo** and create a branch from `main`
2. **Make your changes** — code, docs, benchmarks, conformance tests
3. **Run tests** — `npx tsx --test src/lib/*.test.ts`
4. **Run type check** — `npx tsc --noEmit`
5. **Submit a PR** against `main`

## What we're looking for

- **Benchmark suites** — domain-specific test suites with known correct answers. See `benchmarks/` for examples. If you have domain expertise (medical coding, legal, security, etc.), your benchmarks are especially valuable.
- **Framework integrations** — LangChain, CrewAI, AutoGen, or any orchestrator that could query the PactSpec registry.
- **Bug fixes** — especially in the validator, CLI, or API routes.
- **Conformance tests** — expand `conformance/valid/` and `conformance/invalid/` to cover edge cases.
- **Documentation** — improve guides, fix typos, add examples.

## Publishing benchmarks

Benchmarks are JSON files in `benchmarks/`. Each benchmark should include:

- `source` field: `synthetic`, `peer-reviewed`, `industry-standard`, or `community`
- `sourceDescription`: honest description of where the test data comes from
- `sourceUrl`: link to the authoritative source (if applicable)

If your benchmark uses data from peer-reviewed sources, include the citation. If it's synthetic, say so.

## Registry edits

The registry at pactspec.dev is a database, not a file. To publish or update an agent:

- Use the CLI: `pactspec publish agent.json --agent-id your-org`
- Use the web form: https://pactspec.dev/publish
- Use the SDK: `@pactspec/register` middleware or `@pactspec/sdk`

Agent owners can update their own specs by republishing with the same `spec_id`. There is no manual approval process for publishing.

## Code style

- TypeScript for all web and CLI code
- No unnecessary dependencies
- Tests for security-critical code
- Don't add comments explaining obvious code

## Questions?

Open an issue: https://github.com/Grumpy254/pactspec/issues
