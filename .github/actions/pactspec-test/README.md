# PactSpec Test Action

Runs `pactspec test` in CI.

## Example

```yaml
jobs:
  pactspec:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/pactspec-test
        with:
          spec: agents/my-agent.pactspec.json
          # Optional:
          # skill: extract-items
          # endpoint: https://api.example.com/agent
          # suite: tests/my-suite.json
          # timeout: 15000
          # cli-version: latest
```
