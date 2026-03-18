Publish the PactSpec file at $ARGUMENTS (or the nearest *.pactspec.json in the current directory) to the PactSpec registry at https://pactspec.dev.

## Steps

1. **Find the spec file** — use the path in $ARGUMENTS if provided, otherwise search for `*.pactspec.json` files in the current directory and subdirectories. If multiple exist, list them and ask which one.

2. **Read and validate the spec** — run:
   ```
   pactspec validate <file>
   ```
   If validation fails, show the errors and fix them automatically if the issues are mechanical (missing required fields with obvious values, wrong field types, invalid URN format). Re-validate after fixing. If the spec is structurally broken or needs domain knowledge to fix, stop and explain what needs fixing.

3. **Check the endpoint is reachable** — make a quick HEAD or GET request to `spec.endpoint.url`. If it returns a non-2xx or connection error, warn the user:
   > ⚠ The endpoint at `<url>` doesn't appear to be reachable. Publishing will succeed but validation/attestation will fail until the endpoint is live. Continue? (y/n)
   If the user confirms, continue.

4. **Run test suites locally** — for each skill that has a `testSuite.url`, run:
   ```
   pactspec test <file> --skill <skill-id>
   ```
   If any tests fail, show the failures. Offer to continue publishing anyway (registry accepts unverified agents) but make clear the agent won't have a verified badge.

5. **Publish** — run:
   ```
   pactspec publish <file>
   ```
   Capture the output. On success, extract the agent ID and registry URL from the response.

6. **Request verification** — if tests passed in step 4, run:
   ```
   pactspec verify <agent-id> <skill-id>
   ```
   for each skill. Show the attestation hash on success.

7. **Report** — print a clean summary:
   ```
   ✓ Published: <agent name> v<version>
   ✓ Registry:  https://pactspec.dev/agents/<id>
   ✓ Verified:  <skill-id> (attestation: <hash-prefix>...)
   ```
   If the agent has multiple skills, show each skill's verification status.

## Notes

- The `pactspec` CLI must be installed: `npm install -g @pactspec/cli`
- No auth required to publish — the registry is open
- Verification requires the endpoint to be live and passing tests
- The `id` field in the spec (`urn:pactspec:provider:name`) must be unique in the registry — if a conflict error occurs, the agent already exists and should be updated instead
