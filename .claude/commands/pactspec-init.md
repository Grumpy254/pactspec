Generate a PactSpec v1.0.0 spec file for the agent or API described in $ARGUMENTS (or the current file if no argument given).

## Steps

1. **Read the target file(s)** — look at the file path provided, or if none, scan the current directory for route handlers, API endpoints, or agent definitions. Focus on: input/output shapes, HTTP methods, paths, any pricing or auth already defined.

2. **Infer the spec** — from the code, extract:
   - What the agent does (name, description)
   - Each callable skill (the distinct operations it exposes)
   - The input and output JSON Schema for each skill (derive from TypeScript types, Zod schemas, Pydantic models, or function signatures if present — otherwise infer from variable names and logic)
   - Auth type (none / bearer / x-agent-id / header)
   - Pricing if any hint exists in the code (billing comments, env vars like PRICE_PER_CALL, etc.) — default to `free` if unclear

3. **Generate the PactSpec JSON** — use this structure:
   ```json
   {
     "specVersion": "1.0.0",
     "id": "urn:pactspec:<provider>:<agent-name>",
     "name": "<Human Name>",
     "version": "1.0.0",
     "description": "<one sentence, what it does and why it's useful>",
     "provider": {
       "name": "<provider>",
       "url": "<provider URL if found>",
       "contact": "<email if found>"
     },
     "endpoint": {
       "url": "<base URL — use placeholder if unknown: https://YOUR_DOMAIN/api/your-path>",
       "auth": { "type": "none" }
     },
     "skills": [
       {
         "id": "<kebab-case-id>",
         "name": "<Human Name>",
         "description": "<what it does, one sentence>",
         "tags": ["<relevant>", "<tags>"],
         "inputSchema": { <JSON Schema for request body> },
         "outputSchema": { <JSON Schema for response body> },
         "pricing": { "model": "free", "amount": 0, "currency": "USD" },
         "testSuite": {
           "url": "https://YOUR_DOMAIN/test-suites/<skill-id>.json",
           "type": "http-roundtrip"
         },
         "examples": [
           {
             "description": "<what this example shows>",
             "input": { <realistic example input> },
             "expectedOutput": { <realistic example output> }
           }
         ]
       }
     ],
     "tags": ["<relevant>", "<tags>"],
     "license": "MIT"
   }
   ```

4. **Write the file** — save as `<agent-name>.pactspec.json` next to the source file (or in an `agents/` folder if one exists).

5. **Tell the user** what you wrote and what they should fill in manually:
   - Replace `YOUR_DOMAIN` with their actual domain
   - Update `testSuite.url` once they've written the test suite file
   - Confirm pricing if the agent has costs
   - Run `pactspec validate <file>` to confirm it's valid before publishing

Do not ask clarifying questions — make your best inference from the code and produce a complete file. Leave `# TODO:` comments inline for anything genuinely unknowable from the code.
