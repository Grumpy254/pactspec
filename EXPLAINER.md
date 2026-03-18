# PactSpec — Complete Reference

> This document is a complete technical and conceptual reference for PactSpec. It is written for the person who built it and wants a single place that explains every decision, every field, every line of code, and every threat. It assumes you are comfortable reading TypeScript and SQL, but explains every concept in plain English before diving into implementation detail.

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [What PactSpec Is](#2-what-pactspec-is)
3. [The Spec Format — Every Field Explained](#3-the-spec-format--every-field-explained)
4. [The Test Suite Format](#4-the-test-suite-format)
5. [How Validation Works — Step by Step](#5-how-validation-works--step-by-step)
6. [Attestation — What It Is and Why It Matters](#6-attestation--what-it-is-and-why-it-matters)
7. [SSRF Protection — Deep Dive](#7-ssrf-protection--deep-dive)
8. [The Database — What's Stored and Why](#8-the-database--whats-stored-and-why)
9. [The API — Every Endpoint](#9-the-api--every-endpoint)
10. [The SDK — JS/TS and Python](#10-the-sdk--jsts-and-python)
11. [The CLI — Every Command](#11-the-cli--every-command)
12. [Security Model — The Full Picture](#12-security-model--the-full-picture)
13. [Governance and the Standard](#13-governance-and-the-standard)
14. [The Roadmap](#14-the-roadmap)

---

## 1. The Problem

### What is an AI agent?

An AI agent is a program that can take actions on your behalf — browsing the web, reading documents, sending emails, querying databases, calling APIs — in response to natural language instructions. Unlike a simple chatbot that just produces text, an agent has *tools*: it can do things in the world, not just describe them.

When people talk about agents in the context of software systems, they typically mean a service that exposes an HTTP endpoint. You send it a request containing a task description and some input data. It processes that input, possibly calling other services along the way, and returns a structured response. An agent might be an invoice processor (you send it a PDF, it extracts structured data), a code reviewer (you send it a pull request diff, it returns comments), or a research assistant (you send it a query, it returns a report with citations).

The key thing to understand is that agents are *services*. They run somewhere, they have endpoints, they cost money to call, they have latency characteristics, and they can fail. As with any service, the people who want to use them need to know what they do, how to call them, and whether they can be trusted.

### What protocols exist today?

Several standards are relevant to the AI agent space, and it is worth being precise about what each one actually solves.

**MCP (Model Context Protocol)** is a standard developed by Anthropic for connecting AI models to tools and data sources. It defines how a language model running locally can call out to a tool server — for example, asking a file system tool to read a file, or a database tool to run a query. MCP is primarily about the *invocation protocol*: the message format, the transport layer, how tools advertise their parameters to the model that is calling them. It is a runtime communication standard. It does not address pricing, independent verification, or third-party discovery. You cannot browse an MCP directory and find "all agents that process invoices, verified, under $0.01 per call."

**A2A (Agent-to-Agent protocol)** is a standard, also from Google, focused on how agents communicate with each other: how one agent delegates a task to another, how tasks are streamed, how results are returned. Like MCP, it is a transport and invocation standard. It solves "how does an agent call another agent" but not "how do I know what that agent actually does, what it costs, or whether it works."

**OpenAPI** is a well-established standard for describing HTTP REST APIs. You can describe any HTTP endpoint's parameters, responses, authentication, and servers using OpenAPI. Tooling is mature and widespread. However, OpenAPI was designed for traditional software APIs, not AI agents specifically. It has no concept of pricing models, no concept of per-invocation costs, no native support for decentralized identity (DIDs), no concept of a test suite that a third party can run to verify the agent works, and no concept of attestation. When you have an OpenAPI spec, you know what HTTP calls to make — but you still do not know whether the service actually behaves as described.

### The specific gap

None of these protocols answer the question a *buyer* or *orchestrator* asks before deciding to use an agent:

- What can this agent actually do, in unambiguous machine-readable terms?
- What does it cost to call, and how do I pay?
- Has anyone verified that it behaves as described?
- If my orchestration system calls it automatically, can I trust the response format?
- If the spec changes, do I know the verification is still valid?

This is the gap PactSpec fills. It is not competing with MCP or A2A — it is complementary. An agent can use MCP for its internal tool connections, use A2A for agent-to-agent communication, and publish a PactSpec so that discovery, pricing, and trust can happen *before* any invocation.

### Why this gap matters economically

The missing standard becomes an economic problem as soon as you try to build a marketplace or an automated procurement system for agents.

Consider an orchestration platform that wants to route tasks to the best available agent. To do this automatically, it needs to:

1. Discover agents that match the task type
2. Compare their pricing
3. Know their expected latency
4. Trust that they will return a response in the promised format
5. Know if any of them have been independently verified to actually work

Without a standard for capability declaration, every agent has its own documentation format, its own pricing page, its own (possibly outdated) changelog. Automated routing is impossible. Human curation is required at every step.

With a standard, an orchestrator can fetch a machine-readable spec, compare it against task requirements, check the verified flag, pick the cheapest verified agent, and dispatch the task — all without human involvement.

The same logic applies to agent marketplaces, enterprise procurement ("which agents are approved for use with our data?"), compliance auditing ("show me all agents we've called this month and their verification status"), and payment automation (if the pricing is machine-readable and the payment protocol is specified, an orchestrator can pay for agent calls without a human approving each transaction).

---

## 2. What PactSpec Is

### One-sentence definition

PactSpec is a machine-readable JSON document format that declares what an AI agent can do, what it costs, what its performance commitments are, and how to verify that it behaves as described.

### The analogy

Think about the label on a jar of food. Before you buy it, the label tells you: the ingredients (what is in it), the nutritional information (what you get), the manufacturer (who made it), the expiry date (when it might stop being good), and a certification badge if it has passed independent quality checks. You do not need to open the jar to get this information. You do not need to phone the manufacturer. The label is standardized — it works the same way on every product — so you can compare products from different manufacturers side by side.

A PactSpec is that label, but for an AI agent. Before your system calls the agent, the spec tells you: what tasks it handles (skills), what inputs and outputs each skill expects (schemas), what it costs (pricing), and whether it has been independently verified to actually work (attestation). The format is standardized, so an orchestrator or marketplace can process specs from thousands of different agents using the same code.

### What PactSpec is NOT

PactSpec is not an invocation protocol. It does not specify the message format for calling the agent. The agent's endpoint can use any format it wants — REST, JSON-RPC, GraphQL, a custom protocol. PactSpec's job is to describe that endpoint and its capabilities, not to define how it communicates.

PactSpec is not a runtime communication standard. It does not handle streaming, task delegation, or agent-to-agent coordination. Those are MCP and A2A's jobs.

PactSpec is not an agent runtime. It does not run agents, host them, or manage their infrastructure.

PactSpec is not a payment processor. It specifies pricing metadata and names a payment protocol (like x402 or Stripe), but it does not process the payment. The payment happens at invocation time, outside of PactSpec.

### The four things every PactSpec provides

Every valid PactSpec document provides exactly four categories of information:

**1. Capability declaration.** The `skills` array describes what the agent can do. Each skill has a human-readable name and description, machine-readable input and output schemas, and optional examples. This is the "what" — it tells any software reading the spec exactly what the agent does and what data shapes it consumes and produces.

**2. Pricing.** Each skill can declare its pricing model (flat fee per call, per token, per second of execution, or free), the amount and currency (USD, USDC, or SOL), and the payment protocol (x402 for on-chain micropayments, Stripe for card payments, or none). This makes pricing machine-readable — an orchestrator can compare costs across agents or trigger automatic payment.

**3. Test suites.** Each skill can point to a URL that hosts a test suite — a JSON file containing sample requests and the expected responses. Any third party can fetch this test suite and run the tests against the agent's endpoint. PactSpec's registry does this automatically when you request verification.

**4. Verified record.** When a skill's test suite is fetched and every test passes, the registry generates a SHA-256 hash binding the agent's identity, the skill ID, the test results, and a timestamp. This tamper-evident fingerprint is stored in the database and returned in API responses. If the spec changes, the record is cleared and the agent must re-verify. (Note: this is a hash stored by a centralized registry, not a cryptographic signature — see Section 6 for the full scope.)

---

## 3. The Spec Format — Every Field Explained

A PactSpec document is a JSON object. Here is a complete annotated example, followed by detailed explanation of every field.

```json
{
  "specVersion": "1.0.0",
  "id": "urn:pactspec:acme:invoice-processor",
  "name": "Acme Invoice Processor",
  "version": "2.1.0",
  "description": "Extracts structured data from invoice PDFs and images.",
  "provider": {
    "name": "Acme Corp",
    "url": "https://acme.example",
    "contact": "agents@acme.example"
  },
  "endpoint": {
    "url": "https://api.acme.example/agents/invoice",
    "auth": {
      "type": "bearer"
    }
  },
  "skills": [
    {
      "id": "extract-invoice",
      "name": "Extract Invoice Data",
      "description": "Parses an invoice document and returns structured line items, totals, and vendor information.",
      "tags": ["finance", "extraction", "ocr"],
      "inputSchema": {
        "type": "object",
        "required": ["documentUrl"],
        "properties": {
          "documentUrl": {
            "type": "string",
            "format": "uri",
            "description": "Public URL of a PDF or image file"
          },
          "currency": {
            "type": "string",
            "enum": ["USD", "EUR", "GBP"]
          }
        }
      },
      "outputSchema": {
        "type": "object",
        "required": ["vendor", "total", "lineItems"],
        "properties": {
          "vendor": { "type": "string" },
          "total": { "type": "number" },
          "currency": { "type": "string" },
          "lineItems": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "description": { "type": "string" },
                "amount": { "type": "number" }
              }
            }
          }
        }
      },
      "examples": [
        {
          "description": "Simple two-line invoice",
          "input": { "documentUrl": "https://acme.example/samples/invoice-001.pdf" },
          "expectedOutput": {
            "vendor": "Office Supplies Ltd",
            "total": 142.50,
            "currency": "USD",
            "lineItems": [
              { "description": "Paper A4", "amount": 25.00 },
              { "description": "Pens box", "amount": 117.50 }
            ]
          }
        }
      ],
      "pricing": {
        "model": "per-invocation",
        "amount": 0.005,
        "currency": "USD",
        "protocol": "stripe"
      },
      "testSuite": {
        "url": "https://acme.example/agents/invoice/tests.json",
        "type": "http-roundtrip"
      }
    }
  ],
  "tags": ["finance", "documents", "extraction"],
  "license": "commercial",
  "links": {
    "documentation": "https://docs.acme.example/invoice-agent",
    "repository": "https://github.com/acme/invoice-agent"
  }
}
```

### `specVersion`

**What it is:** A string that identifies which version of the PactSpec format this document uses. Currently the only valid value is `"1.0.0"`.

**Why it exists:** Versioning at the top level of the document means any parser can immediately know whether it understands this format. If PactSpec v2 introduces breaking changes, parsers can detect the version and route to the correct code path. Using `const: "1.0.0"` in the JSON Schema means validation will fail immediately if someone submits a spec with a mismatched version.

**Required:** Yes.

### `id`

**What it is:** A globally unique identifier for this agent, expressed as a URN (Uniform Resource Name).

**Why it exists:** An `id` that is globally unique means any two systems can refer to the same agent without collision. A UUID works for uniqueness, but URNs encode human-readable meaning and are stable across deployments.

**The URN format:** The pattern is `urn:pactspec:<org>:<agent>`.

A URN is a type of URI (like a URL) but it names something rather than locating it. The structure is `urn:<namespace>:<namespace-specific-string>`. In PactSpec's case:

- `urn` — the URI scheme for all URNs, defined by internet standards
- `pactspec` — the namespace, identifying that this URN belongs to PactSpec
- `<org>` — a slug for your organization (e.g., `acme`, `openai`, `my-startup`). Must match `[a-z0-9-]+`
- `<agent>` — a slug for this specific agent (e.g., `invoice-processor`, `code-reviewer`). Must match `[a-z0-9-]+`

So `urn:pactspec:acme:invoice-processor` means: "the agent named 'invoice-processor', published by the organization 'acme', in the PactSpec namespace."

The full regex enforced by the schema is: `^urn:pactspec:[a-z0-9-]+:[a-z0-9-]+$`

This is also the `spec_id` stored in the database's natural key column. When you re-publish an updated spec with the same `id`, the registry upserts — updating the existing record rather than creating a duplicate.

**Required:** Yes.

### `name`

**What it is:** A human-readable display name for the agent. Maximum 100 characters.

**Why it exists:** The `id` is a machine identifier; `name` is what gets shown in UIs, search results, and listings. "Acme Invoice Processor" is more useful to a human browsing the registry than `urn:pactspec:acme:invoice-processor`.

**Required:** Yes.

### `version`

**What it is:** A semantic version string in the format `MAJOR.MINOR.PATCH` (e.g., `"2.1.0"`).

**Why it exists:** Agents evolve. If an orchestrator has been using version 1.x of an agent and the agent publishes a spec for version 2.0 with breaking changes to the skill's input schema, the orchestrator needs to know. The version field, combined with the spec hash comparison on upsert, means the registry can detect when a spec has changed and clear the verification badge accordingly.

The schema enforces the three-part number format with the regex `^\d+\.\d+\.\d+$`.

**Required:** Yes.

### `description`

**What it is:** A free-text description of what the agent does overall. Maximum 500 characters.

**Why it exists:** Used in search (the API does `ilike` matching on `description`), shown in listings, and helps human readers and LLMs understand the agent's purpose quickly.

**Required:** No (optional).

### `provider`

**What it is:** An object identifying who built and operates this agent.

**Why it exists:** In a world of many agents from many organizations, provenance matters. A buyer in a marketplace wants to know who is behind an agent before trusting it with their data. The provider block answers that question.

**Fields:**

- `name` (required): The organization or individual's name. e.g., `"Acme Corp"`.
- `url` (optional): A URI pointing to the provider's website. Stored in `provider_url` in the database and returned in search results.
- `contact` (optional): An email address for support or security contact. Must be a valid email format.

**Required:** The `provider` object itself is required; only `name` is required within it.

### `endpoint`

**What it is:** The network address of the agent and how to authenticate to it.

**Why it exists:** Skills describe what the agent can do; the endpoint tells you where and how to call it. The registry does not call the endpoint directly during publishing — but the validator does during a validation run, sending test cases to this URL.

**Fields:**

- `url` (required): The base URL of the agent's HTTP endpoint. Must be a valid URI. e.g., `"https://api.acme.example/agents/invoice"`. This is subject to SSRF safety checks during validation.
- `auth` (optional): An object describing how to authenticate.
  - `type`: One of `"none"`, `"bearer"`, `"x-agent-id"`, or `"header"`.
    - `none`: No authentication required. Fine for public or demo agents.
    - `bearer`: Standard HTTP Bearer token auth (`Authorization: Bearer <token>`). The caller is expected to have a token.
    - `x-agent-id`: Uses the `X-Agent-ID` header pattern from the PactSpec publish flow — the caller sends their identifier in this header.
    - `header`: A custom header is used for auth. The `header` field names which header.
  - `header`: Only relevant when `type` is `"header"`. Specifies the header name, e.g., `"X-Api-Key"`.

**Required:** The `endpoint` object is required; only `url` is required within it.

### `skills`

**What it is:** An array of skill objects, each describing one thing the agent can do. At least one skill is required.

**Why it exists:** Most agents can do more than one thing. An invoice agent might have an `extract-invoice` skill and a `classify-document` skill. The skills array lets you describe all capabilities in a single spec, each with its own schema, pricing, and test suite.

Each skill is an object with the following fields:

#### `skills[].id`

**What it is:** A short, stable machine identifier for this skill within this agent. Must match `[a-z0-9-]+` (lowercase letters, digits, hyphens only).

**Why it exists:** The `skillId` is used throughout the system — in validation runs, in the skills table, in the attestation hash, in the CLI's verify command. It needs to be stable (so re-publishing the same skill doesn't lose its history), unique within the agent, and safe to use in URLs.

**Example:** `"extract-invoice"`, `"classify-document"`, `"summarize"`

**Required:** Yes.

#### `skills[].name`

**What it is:** A human-readable name for this skill. e.g., `"Extract Invoice Data"`.

**Required:** Yes.

#### `skills[].description`

**What it is:** A sentence or short paragraph explaining what this skill does, what inputs it expects, and what output it returns.

**Why it matters:** This is what an LLM-based orchestrator will read to decide whether to use this skill. It is also searchable in the registry. Write it to be unambiguous.

**Required:** Yes.

#### `skills[].tags`

**What it is:** An array of strings categorizing this skill. e.g., `["finance", "extraction", "ocr"]`.

**Why it exists:** The registry supports filtering agents by tags. If a skill is tagged `["finance", "pdf"]`, then a search for agents with `tags=finance` will find it. Tags are stored in the normalized `skills` table in the database.

**Required:** No.

#### `skills[].inputSchema`

**What it is:** A JSON Schema object describing the shape of the input data for this skill.

**Why it exists:** This is one of the most important fields in a PactSpec. Without a machine-readable input schema, an orchestrator cannot know what data to send to the skill, cannot validate its own request before sending, and cannot automatically map data from one agent to another.

**JSON Schema in brief:** JSON Schema is a vocabulary for describing the shape of JSON data. The key constructs are:

- `"type": "object"` — the value must be a JSON object (key-value pairs)
- `"type": "string"` — the value must be a string
- `"type": "number"` — the value must be a number
- `"type": "array"` — the value must be an array
- `"type": "boolean"` — the value must be true or false
- `"properties"` — an object where each key is a property name and each value is a schema for that property
- `"required"` — an array of property names that must be present
- `"format"` — a hint about the string format, e.g., `"uri"`, `"email"`, `"date-time"`
- `"enum"` — the value must be one of a specific list

Example inputSchema for a skill that takes a URL and an optional currency:

```json
{
  "type": "object",
  "required": ["documentUrl"],
  "properties": {
    "documentUrl": {
      "type": "string",
      "format": "uri"
    },
    "currency": {
      "type": "string",
      "enum": ["USD", "EUR", "GBP"]
    }
  }
}
```

This schema says: the input must be an object with a `documentUrl` property that is a URI string, and an optional `currency` property that must be one of the three listed values.

The validator uses AJV (Another JSON Validator) to check actual response bodies against the outputSchema during test runs.

**Required:** Yes.

#### `skills[].outputSchema`

**What it is:** A JSON Schema object describing the shape of the output data from this skill.

**Why it exists:** An orchestrator needs to know what it will get back before deciding to use a skill. If the output schema says there will be a `lineItems` array with `amount` fields, the orchestrator can plan downstream data processing. During validation runs, each test case's response body is validated against this schema (or against a per-test override schema if provided in the test suite file).

**Required:** Yes.

#### `skills[].examples`

**What it is:** An array of example input/output pairs showing the skill in action.

**Why it exists:** Examples serve two purposes. First, they help human readers and LLM-based orchestrators understand what the skill does concretely. Second, they can serve as documentation. They are not executed by the registry — they are illustrative, not normative.

Each example has:
- `description` (optional): What this example demonstrates.
- `input`: An actual input value (any JSON — the schema does not constrain the type here, just that it's present).
- `expectedOutput`: An actual output value.

**Required:** No.

#### `skills[].pricing`

**What it is:** An object declaring the cost of calling this skill.

**Why it exists:** Making pricing machine-readable enables automated cost comparison, budget enforcement, and payment routing. An orchestrator can reject skills that exceed a budget limit, or automatically choose the cheapest verified agent for a given task type.

**Fields:**

- `model` (required): How the cost is calculated. One of:
  - `"per-invocation"`: A flat fee every time you call the skill, regardless of how long it takes or how much data is involved. Most common for simple API-style agents. e.g., `0.005 USD` per call.
  - `"per-token"`: Cost is proportional to the number of tokens processed (both input and output). This matches how most LLM providers charge. e.g., `0.000002 USD` per token.
  - `"per-second"`: Cost is proportional to the execution time. Suitable for long-running tasks where compute time varies significantly.
  - `"free"`: No charge. The skill is free to call.
- `amount` (required): The numeric amount per unit. Must be >= 0. e.g., `0.005`.
- `currency` (required): The currency for the amount. One of:
  - `"USD"`: US Dollars. Settled via traditional payment rails (Stripe, etc.).
  - `"USDC"`: USD Coin, a stablecoin on Ethereum and other blockchains. One USDC = one US dollar, but settled on-chain. Used with the x402 protocol.
  - `"SOL"`: Solana's native token. Also used with x402.
- `protocol` (optional): The payment mechanism. One of:
  - `"x402"`: A proposed standard for HTTP-native micropayments. The server responds with HTTP 402 Payment Required when a caller has not paid, the caller pays on-chain, and retries. Well-suited for agent marketplaces using USDC or SOL.
  - `"stripe"`: Standard card/invoice billing through Stripe's platform.
  - `"none"`: Payment is handled out-of-band (subscription, enterprise agreement, etc.) or the skill is free.

**Required:** The `pricing` object is optional per skill. If present, `model`, `amount`, and `currency` are all required.

#### `skills[].testSuite`

**What it is:** A pointer to a JSON file that contains the tests used to verify this skill.

**Why it exists:** This is the bridge between specification and verification. Any spec can claim any behavior. The test suite is executable evidence that the agent actually behaves as claimed at the time of verification. The PactSpec registry can fetch this URL, run the tests, and record a verified result if they all pass.

**Fields:**

- `url` (required): The public URL where the test suite JSON file is hosted. Must be an HTTPS URL (in production). Subject to SSRF safety checks before the validator fetches it.
- `type` (optional): The test execution strategy. Currently two values are recognized:
  - `"http-roundtrip"`: Each test sends an HTTP request to the agent endpoint and checks the response status and body. This is the fully live validation strategy.
  - `"json-schema-validation"`: Validates only that the test outputs conform to the declared output schema, without making live HTTP calls. Lighter-weight, useful for early development.

**Required:** No (but without it, the registry cannot verify the skill and the agent cannot earn the verified badge).

---

### Top-level optional fields

#### `tags`

**What it is:** An array of strings at the agent level (not the skill level), categorizing the agent as a whole. e.g., `["finance", "documents", "extraction"]`.

**Why it exists:** Agents can be searched by tags in the registry. The `GET /api/agents?tags=finance,ocr` endpoint returns agents whose `tags` array overlaps with the requested tags. The database stores tags as a PostgreSQL `TEXT[]` array with a GIN index for fast overlap queries.

#### `license`

**What it is:** A string describing the license under which the agent is offered. e.g., `"commercial"`, `"MIT"`, `"Apache-2.0"`, `"proprietary"`.

**Why it exists:** In enterprise procurement, buyers need to know the terms under which they are allowed to use an agent. A machine-readable license field lets procurement systems filter out agents with incompatible licenses.

#### `links`

**What it is:** An object with optional URIs for documentation and source code.

**Fields:**

- `documentation`: URL to the agent's human-facing documentation.
- `repository`: URL to the agent's source code repository.

**Why it exists:** Transparency. A buyer evaluating a verified agent wants to be able to read the docs and, if the code is open, audit the source.

---

## 4. The Test Suite Format

The test suite is a separate JSON file that the agent operator hosts at a public URL — the URL referenced by `skills[].testSuite.url` in the spec. It is fetched by the PactSpec registry at validation time.

### Why a separate file rather than embedded in the spec?

The test suite is not part of the spec itself for several important reasons:

1. **Size:** A test suite can contain many tests, each with a full request body and expected response. Embedding dozens of tests in every spec would make specs large and expensive to store and transfer.
2. **Updatability:** The operator can update their test suite without re-publishing the entire spec. If a new test case is added, the operator just updates the hosted JSON file. The next validation run picks it up.
3. **Separation of concerns:** The spec describes capabilities; the test suite is an implementation artifact. Keeping them separate makes the spec cleaner and more focused.
4. **Hosting flexibility:** The test suite can be hosted anywhere — GitHub, a CDN, the agent's own server, an S3 bucket. It just needs to be publicly accessible over HTTPS.

### The test suite file format

```json
{
  "version": "1.0",
  "skill": "extract-invoice",
  "tests": [
    {
      "id": "basic-pdf",
      "description": "Extract data from a simple PDF invoice",
      "request": {
        "method": "POST",
        "headers": {
          "Authorization": "Bearer test-token-123"
        },
        "body": {
          "documentUrl": "https://acme.example/test-assets/invoice-001.pdf"
        }
      },
      "expect": {
        "status": 200,
        "outputSchema": {
          "type": "object",
          "required": ["vendor", "total"],
          "properties": {
            "vendor": { "type": "string" },
            "total": { "type": "number" }
          }
        }
      },
      "timeoutMs": 10000
    },
    {
      "id": "missing-url",
      "description": "Reject a request with no documentUrl",
      "request": {
        "method": "POST",
        "body": {}
      },
      "expect": {
        "status": 400
      },
      "timeoutMs": 3000
    }
  ]
}
```

### Every field in the test suite

**`version`** (string, required): The version of the test suite format. Currently `"1.0"`. Allows the format to evolve without breaking existing test suites.

**`skill`** (string, required): The `id` of the skill this test suite covers. e.g., `"extract-invoice"`. When the validator fetches the test suite, it verifies that the tests are for the skill being validated.

**`tests`** (array, required): The list of test cases. Must have at least one test. The registry imposes a hard limit of 50 tests per suite (to limit validator execution time and prevent abuse).

Each test case in the `tests` array:

**`tests[].id`** (string, required): A short identifier for this test case. Must be unique within the file. e.g., `"basic-pdf"`, `"missing-url"`, `"large-invoice"`. This ID appears in validation results, so choose names that are meaningful when you read them in a report.

**`tests[].description`** (string, optional): Human-readable explanation of what this test checks. Shows up in test result output.

**`tests[].request`** (object, required): The HTTP request to send to the agent's endpoint.

- `method` (string): The HTTP method. Defaults to `"POST"` if omitted. Most agent skills use POST since they take a JSON body.
- `headers` (object, optional): Additional HTTP headers to include in the request. These are merged with the default `Content-Type: application/json` header. Use this for auth headers: `{ "Authorization": "Bearer test-token-123" }`.
- `body` (any, optional): The request body. If present, it is JSON-serialized and sent with `Content-Type: application/json`. If absent, no body is sent.

**`tests[].expect`** (object, required): What the validator should verify about the response.

- `status` (integer, required): The expected HTTP status code. e.g., `200`, `201`, `400`, `404`. The test passes only if the actual response status matches this exactly.
- `outputSchema` (object, optional): A JSON Schema to validate the response body against. If present, the validator reads the response body as JSON and runs the schema validation. If the body is not valid JSON, or if it does not match the schema, the test fails. If absent, the validator only checks the status code.

**`tests[].timeoutMs`** (integer, optional): How long to wait for this test's response before marking it as failed with a timeout. Defaults to 15,000ms (15 seconds) if not specified. Set this lower for tests that expect fast responses (e.g., `3000` for validation-error tests that should fail quickly), and higher for tests that involve heavy processing.

### Hard limits enforced by the validator

- **1MB maximum size:** The test suite file is capped at 1,048,576 bytes. If the file is larger, the validation run errors immediately.
- **50 test maximum:** If the `tests` array has more than 50 entries, the validation run errors immediately.
- **10 second fetch timeout:** The HTTP fetch to retrieve the test suite file itself is limited to 10 seconds.
- **15 second default per-test timeout:** Each test case has a default 15-second timeout, overridable per test with `timeoutMs`.

---

## 5. How Validation Works — Step by Step

Validation is the process by which the PactSpec registry confirms that an agent's skill actually behaves as described in the spec. It is initiated by a `POST` request to `/api/agents/:id/validate` with a `skillId` in the body.

Here is the complete sequence, start to finish.

### Step 1: Parse the request

The endpoint receives a POST with a JSON body like `{ "skillId": "extract-invoice" }`. If the body is not valid JSON, or if `skillId` is missing, the endpoint returns a 400 error immediately.

The `:id` parameter in the URL can be either a UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`) or a spec URN (e.g., `urn:pactspec:acme:invoice-processor`). The code detects which one it is with a UUID regex, and routes the database lookup accordingly.

### Step 2: Load the agent from the database

Using the anon Supabase client (read-only access), the agent row is loaded from the database. If no agent matches the `id` or `spec_id`, the endpoint returns 404.

### Step 3: Rate limit check

To prevent abuse — either automated hammering of the validator or accidental double-triggers — the system checks whether a validation run has been created for this agent within the last 60 seconds.

It queries the `validation_runs` table for any row with `agent_id = <this agent>` and `created_at >= now() - 60 seconds`. If any such row exists, it returns HTTP 429 (Too Many Requests) with the message "Rate limit: one validation run per agent per minute."

This rate limit is per-agent, not per-caller. One validation run per agent per minute is the current limit.

### Step 4: Create a validation run record

A new row is inserted into the `validation_runs` table with `status = 'RUNNING'`. This serves multiple purposes:
- It is the anchor for the rate limit check (the next request in 60 seconds will find this row)
- It records the run for audit purposes even if the validator crashes
- The `run.id` is returned in the response so the caller can track this specific run

The service-role client is used for this write (the anon key cannot write).

### Step 5: SSRF safety checks

Before making any outbound network calls, the validator runs `assertSafeUrl()` on both URLs that will be fetched:
1. `skill.testSuite.url` — the test suite file
2. `agent.endpoint_url` — the agent's live endpoint

If either URL fails the safety check, the validation run is marked ERROR and the function returns immediately. The SSRF protection is detailed fully in Section 7. In brief, it checks:

- The scheme must be `https://` (or `http://` only if `VALIDATION_ALLOW_HTTP=true`)
- The hostname must not be in the blocked list (localhost, 169.254.169.254, etc.)
- The hostname must not end in `.local` or `.internal`
- If `VALIDATION_HOST_ALLOWLIST` is set, the hostname must be in that list
- The hostname is resolved to IP addresses; each IP is checked against private ranges

### Step 6: Fetch the test suite

The validator fetches the test suite JSON file from `skill.testSuite.url`. This fetch uses `fetchWithTimeout` which:

- Sets a 10-second timeout using `AbortController`
- Resolves the hostname to a safe IP once (the `resolveSafeIp` function)
- Creates an undici `Agent` dispatcher with a custom DNS lookup callback that always returns the pre-resolved IP
- Sends the actual HTTP request via undici using this pinned dispatcher

The hostname-pinning via undici prevents DNS rebinding attacks. The TLS handshake still uses the original hostname (for SNI and certificate validation), but the TCP connection goes to the pre-resolved IP and cannot be redirected by a DNS change mid-request.

After fetching, the response body is read as text. If it exceeds 1MB, validation errors. The text is parsed as JSON. If that fails (malformed JSON), validation errors. If the `tests` array is missing, empty, or over 50 items, validation errors.

### Step 7: Run each test

For each test case in the test suite (up to 50), the validator sends an HTTP request to the agent's `endpoint_url`.

The request is constructed as:
- Method: `test.request.method ?? 'POST'`
- Headers: `{ 'Content-Type': 'application/json', ...test.request.headers }`
- Body: `JSON.stringify(test.request.body)` if body is present

This request also goes through `fetchWithTimeout` with the undici IP-pinning dispatcher, so the same SSRF protections apply to the agent endpoint as to the test suite fetch.

The per-test timeout defaults to 15,000ms but can be overridden in the test case with `timeoutMs`.

### Step 8: Check the response status

The actual HTTP response status is compared to `test.expect.status`. If they do not match, the test fails and the error is recorded: `"Expected status 200, got 500"`.

### Step 9: Validate the response body against the schema

If `test.expect.outputSchema` is present and the HTTP request succeeded (i.e., the response status indicates success), the validator reads the response body as JSON and runs AJV schema validation against it.

If the body is not valid JSON, the test fails with `"Response body is not valid JSON"`.

If the body is valid JSON but fails schema validation, the test fails with AJV's error message (e.g., `"/total must be number"`).

If the body passes schema validation, `schemaOk` is true.

A test passes if and only if both `statusOk` (status matched) and `schemaOk` (schema validation passed or no schema was specified) are true.

### Step 10: Collect results

Each test produces a `TestResult` object:
```typescript
{
  testId: string;        // from test.id
  passed: boolean;       // true iff statusOk && schemaOk
  durationMs: number;    // wall-clock time for this test
  statusCode?: number;   // actual HTTP status received
  error?: string;        // description of failure, if any
}
```

If a network error or timeout occurs, the test catches the error and records it: if the error is an `AbortError`, it records `"Timeout after Xms"`, otherwise it records the error message.

### Step 11: Determine overall status

After all tests have run, `allPassed = results.every(r => r.passed)`.

If all tests passed, an attestation hash is generated (see Section 6).

The `ValidationResult` is:
```typescript
{
  status: allPassed ? 'PASSED' : 'FAILED',
  results: [...],          // array of TestResult
  attestationHash?: string, // only if PASSED
  durationMs: number        // total wall-clock time
}
```

### Step 12: Update the database

The validation run record is updated with the final status, test results, duration, and attestation hash (if applicable).

If the run PASSED and an attestation hash was generated, the `agents` table is also updated:
- `verified = true`
- `attestation_hash = <the hash>`
- `verified_at = <current timestamp>`

If the run failed or errored, none of these fields are set. A previously verified agent retains its verification until the spec changes (at which point it is cleared by the publish flow).

### Step 13: Return the result

The API returns the full result object:
```json
{
  "runId": "uuid-of-the-run",
  "status": "PASSED",
  "attestationHash": "a4f3b2...",
  "results": [
    { "testId": "basic-pdf", "passed": true, "durationMs": 743, "statusCode": 200 },
    { "testId": "missing-url", "passed": true, "durationMs": 51, "statusCode": 400 }
  ],
  "durationMs": 801
}
```

---

## 6. Attestation — What It Is and Why It Matters

### What the verified record means

Attestation means "I was present when this event happened, and here is evidence that I witnessed it." PactSpec's attestation is a SHA-256 hash stored in the registry database — a tamper-evident fingerprint that changes if any of the bound inputs change.

In PactSpec's context, the attestation hash answers the question: "At this specific point in time, did this specific agent's skill pass this specific set of tests?"

> **Honest scope:** The hash is stored by a centralized registry. Trust in the record depends on trust in the registry. It is not a cryptographic signature — there is no private key, no PKI, no chain of trust. The planned v1.1 upgrade adds Ed25519 signing so third parties can verify attestations without trusting the database.

### The exact formula

The attestation hash is computed as:

```
attestation_hash = SHA-256(stableStringify({
  agentId: <UUID from registry>,
  skillId: <skill id string>,
  results: <test results sorted by testId>,
  timestamp: <ISO 8601 UTC timestamp>
}))
```

Let us unpack each component:

**`agentId`:** The UUID assigned to this agent by the registry. This is the UUID primary key in the `agents` table — not the spec URN. Using the registry UUID (rather than the spec URN) means the hash is bound to this exact registration instance.

**`skillId`:** The string ID of the skill that was tested. This binds the hash to a specific skill, not just the agent overall.

**`results` (sorted):** The array of `TestResult` objects, sorted by `testId` alphabetically. Sorting is critical for determinism — if JavaScript's array ordering or insertion order were used, two identical test runs might produce results in different orders, generating different hashes. By sorting on `testId`, the same set of tests always produces the same order.

**`timestamp`:** An ISO 8601 UTC timestamp string like `"2025-03-13T14:22:01.000Z"`. This records *when* the tests were run. It is also the reason you cannot replay an old attestation hash against a new run — the timestamp will differ, producing a completely different hash.

### Why stableStringify is used instead of JSON.stringify

JavaScript's built-in `JSON.stringify` does not guarantee the order of keys in an object. If you call `JSON.stringify({ b: 2, a: 1 })`, you might get `{"b":2,"a":1}` or `{"a":1,"b":2}` depending on the JavaScript engine and the order in which properties were added to the object. If the key order varies between runs, the hash varies even if the data is identical.

`stableStringify` (defined in both `attestation.ts` and `spec-hash.ts`) solves this by recursively sorting the keys of every nested object alphabetically before serializing. It is not using `JSON.stringify` on the whole object — it builds the string manually, sorting keys at every level. Arrays are preserved in their original order (since array order is meaningful), but object keys are always sorted.

This ensures that `{ agentId: "x", skillId: "y" }` and `{ skillId: "y", agentId: "x" }` produce the same string, and therefore the same hash.

### What the hash proves and what it does not prove

**What it proves:**
- At `timestamp`, the PactSpec registry fetched the test suite at the URL in the spec, ran all tests against the agent's endpoint, and every test passed.
- The hash is bound to this specific `agentId` (registry UUID) and `skillId`. Copying the hash to a different agent record produces a hash mismatch, not a valid attestation.
- The spec content is unchanged since the attestation was issued. If the spec changes (detected by comparing spec hashes on the next publish), the attestation is cleared.

**What it does not prove:**
- That the agent behaves correctly for *all* inputs, not just the test inputs. The tests only cover what the test suite tests. An agent could pass all declared tests and still behave incorrectly for edge cases not covered by those tests.
- That the agent behaved this way before the attestation timestamp or will behave this way in the future.
- That the test suite was designed by an independent party. An agent operator who controls both the agent endpoint and the test suite can write tests that the agent will always pass, regardless of whether the agent works for real-world inputs.

The attestation is a tamper-evident fingerprint, not a guarantee of correctness. It is meaningful as a baseline signal — unverified agents may not even be runnable; verified agents have at least demonstrated they can accept the declared input format and return the declared output format.

### Why it's not a signature (and what that means)

A cryptographic signature is produced using a private key. Only someone with that private key can produce the signature. Anyone with the corresponding public key can verify that the signature was produced by the key holder.

SHA-256 is a hash function, not a signature scheme. Anyone who knows the inputs can compute the same hash. The hash stored in the database is produced by the PactSpec registry service, but a third party cannot independently verify that "the PactSpec registry produced this hash" — they can only verify that the hash matches the inputs. If someone modifies the database directly and inserts a different hash with matching inputs, the modification is undetectable by the hash alone.

The current security relies on the registry database being trustworthy (Supabase with RLS — only the service role can write attestation data, and only the validator code path issues attestations).

### The planned v1.1 Ed25519 signature upgrade

The planned upgrade (tracked in the security doc as "Planned (v1.1)") is to produce an Ed25519 signature over the attestation payload, using a registry keypair, and return that signature alongside the hash.

Ed25519 is an elliptic curve signature algorithm. The registry would hold a private key. The signature would be `Ed25519Sign(privateKey, attestationPayload)`. Anyone with the registry's public key (published openly) could verify that `Ed25519Verify(publicKey, signature, attestationPayload) == true` — proving the PactSpec registry was the one that computed the attestation, without trusting the database.

This makes attestations portable and independently verifiable, which is necessary for attestations to be used as trust signals across organizations.

### How spec tampering is detected

Every time an agent spec is re-published (`POST /api/agents`), the server:

1. Loads the current spec from the database.
2. Computes `hashSpec(existing.spec)` using the same `stableStringify` + SHA-256 mechanism.
3. Computes `hashSpec(newSpec)` for the incoming spec.
4. Compares the two hashes using `specsEqual()`.

If the hashes differ, the spec has changed. The server then sets `verified = false`, `attestation_hash = null`, and `verified_at = null` in the upsert payload — clearing the verification badge before writing the new spec.

This means a spec change immediately invalidates the old attestation, and the agent cannot retain a verified badge from a spec that is no longer current. The operator must re-trigger validation to get a new attestation for the updated spec.

---

## 7. SSRF Protection — Deep Dive

### What SSRF is

SSRF stands for Server-Side Request Forgery. It is an attack where a malicious user tricks a server into making an HTTP request to an unintended destination — typically to an internal service that the attacker cannot reach directly.

Here is a concrete attack scenario. Imagine you have deployed the PactSpec registry on a cloud server. Your cloud provider (like AWS or GCP) makes instance metadata available at a special IP address — `169.254.169.254` on AWS. By making a request to `http://169.254.169.254/latest/meta-data/iam/security-credentials/my-role`, any process running on the server can retrieve AWS credentials. This is by design for legitimate cloud processes, but it means that if your server makes HTTP requests on behalf of user input, a malicious user can supply `http://169.254.169.254/...` as a URL and your server will fetch it, potentially exposing credentials.

In PactSpec's case, the validator makes two outbound HTTP requests based on URLs supplied by the user who published the agent:
1. The test suite URL (`skill.testSuite.url`)
2. The agent endpoint URL (`agent.endpoint_url`)

Both of these URLs come from user input. Without protection, an attacker could set either URL to `http://169.254.169.254/latest/meta-data/...` and the validator would fetch it, sending the response (containing cloud credentials) back to the attacker.

### Why it's especially dangerous here

Normal web applications have SSRF risks, but they are somewhat mitigated by the fact that the application typically makes requests to a known, limited set of external services. PactSpec's validator is inherently designed to make requests to arbitrary user-supplied URLs — that is its entire purpose. This makes SSRF not just a risk but a fundamental design challenge.

Every layer of protection described below is necessary because a sophisticated attacker will attempt to bypass each layer individually.

### Layer 1: Scheme allowlist

The first check is the URL scheme. Only `https:` is accepted. `http:` is blocked by default and only permitted if `VALIDATION_ALLOW_HTTP=true` is set in the environment (intended for local development only).

This blocks:
- `file://` URLs (which would read files from the validator's filesystem)
- `ftp://`, `gopher://`, `dict://` (less common but potentially exploitable protocols)
- `javascript://` and other unusual schemes

Any scheme that is not `https:` (or `http:` with the dev flag) throws: `"<label> must use https"`.

### Layer 2: Hostname blocklist

After parsing the URL, the hostname is extracted and checked against a hardcoded `BLOCKED_HOSTS` set:

```
localhost
0.0.0.0
127.0.0.1
::1
metadata.google.internal
metadata.google.internal.    (trailing dot variant)
169.254.169.254
```

Additionally, any hostname ending in `.local` or `.internal` is blocked via `BLOCKED_SUFFIXES`.

The `metadata.google.internal` and `169.254.169.254` entries block Google Cloud's metadata server. AWS's metadata server is at `169.254.169.254` as well. The `.local` suffix blocks mDNS hostnames on local networks. The `.internal` suffix blocks common naming conventions for internal services.

If the hostname matches any blocked entry, the check throws: `"<label> host is not allowed"`.

### Layer 3: Private IP range checks

Even if the hostname doesn't match the blocklist, it might resolve to a private IP. The `isPrivateIpv4` function converts an IPv4 address to a 32-bit integer and checks whether it falls in any of these ranges:

| Range | CIDR | Description |
|---|---|---|
| `10.x.x.x` | `10.0.0.0/8` | RFC-1918 private range (class A) |
| `127.x.x.x` | `127.0.0.0/8` | Loopback addresses |
| `169.254.x.x` | `169.254.0.0/16` | Link-local (AWS/GCP metadata) |
| `172.16.x.x–172.31.x.x` | `172.16.0.0/12` | RFC-1918 private range (class B) |
| `192.168.x.x` | `192.168.0.0/16` | RFC-1918 private range (class C) |
| `100.64.x.x–100.127.x.x` | `100.64.0.0/10` | Shared address space (carrier-grade NAT) |
| `192.0.0.x` | `192.0.0.0/24` | IETF protocol assignments |
| `192.0.2.x` | `192.0.2.0/24` | TEST-NET-1 (documentation) |
| `198.51.100.x` | `198.51.100.0/24` | TEST-NET-2 (documentation) |
| `203.0.113.x` | `203.0.113.0/24` | TEST-NET-3 (documentation) |
| `198.18.x–198.19.x` | `198.18.0.0/15` | Network benchmarking |
| `224.x.x.x–255.x.x.x` | `224.0.0.0/4+` | Multicast and reserved |

**RFC-1918** refers to the Internet Engineering Task Force document that reserved these three IP ranges for private networks: `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`. Any device on a private network (your home router, your company's internal servers) will have an IP in one of these ranges. These IPs are not routable on the public internet — but they are reachable from a server running on the same private network.

### Layer 4: IPv6 private range checks

The `isPrivateIpv6` function checks IPv6 equivalents:

- `::` and `::1` — loopback (equivalent of 127.0.0.1)
- `fc00::/7` — Unique Local Addresses (addresses starting with `fc` or `fd`) — the IPv6 equivalent of RFC-1918 private ranges
- `fe80::/10` — Link-Local addresses (starts with `fe8`, `fe9`, `fea`, `feb`)
- `ff00::/8` — Multicast addresses (starts with `ff`)

### Layer 5: IPv4-mapped IPv6 bypass prevention

This is a particularly subtle attack vector. IPv6 has a special notation for expressing IPv4 addresses in IPv6 form: `::ffff:x.y.z.w`. So `::ffff:127.0.0.1` is IPv4 localhost expressed as IPv6. Similarly, `::ffff:7f00:1` is the same address in compact hex form (7f = 127, 00 = 0, 0001 = 0.1).

Without specific handling of this form, an attacker could bypass an IPv4 blocklist by supplying a URL that resolves to `::ffff:169.254.169.254` (the metadata server in IPv6 form), which would pass naive checks for IPv4 private ranges.

The `isPrivateIpv6` function handles both forms:

```typescript
if (normalized.startsWith('::ffff:')) {
  const rest = normalized.slice('::ffff:'.length);
  // Dotted-decimal form: ::ffff:127.0.0.1
  if (rest.includes('.')) return isPrivateIpv4(rest);
  // Hex colon form: ::ffff:7f00:1 — convert to dotted-decimal
  const hexParts = rest.split(':');
  if (hexParts.length === 2) {
    const hi = parseInt(hexParts[0], 16);
    const lo = parseInt(hexParts[1], 16);
    const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateIpv4(dotted);
  }
  return true; // Unrecognised ::ffff: form — block to be safe
}
```

The hex conversion works by treating the two 16-bit hex parts as the high and low words of an IPv4 address. For `::ffff:7f00:1`: `0x7f00` = 32512, high byte = 0x7f = 127, low byte = 0x00 = 0. `0x0001` = 1, high byte = 0x00 = 0, low byte = 0x01 = 1. Result: `127.0.0.1`. Then `isPrivateIpv4("127.0.0.1")` returns true. Blocked.

For any `::ffff:` form that doesn't match the two expected sub-patterns, the function returns `true` (block it) rather than `false` (allow it). When in doubt, block.

### Layer 6: DNS resolution check

Even if the hostname passes the blocklist and blocksuffix checks, the hostname is resolved to actual IP addresses using Node's `dns/promises` `lookup` with `all: true` (which returns all A and AAAA records). Each resolved IP is checked against `isPrivateIp`. If any resolved IP is private, the check throws.

This handles the case where someone registers a public domain name that resolves to a private IP — for example, `attacker.example` → `10.0.0.1`. The hostname passes the string-based checks, but the IP check catches it.

### Layer 7: DNS rebinding prevention

DNS rebinding is a sophisticated attack that exploits the time between DNS resolution and TCP connection.

Here is the attack: An attacker controls a domain `attacker.evil`. They set its TTL (time-to-live) to a very short value (1 second). When the validator resolves `attacker.evil`, it gets back a public IP (e.g., `1.2.3.4`) — which passes all the private IP checks. The validator notes the IP is safe. In the time between the DNS check and when the actual TCP connection is made, the attacker changes the DNS record for `attacker.evil` to point to `169.254.169.254` (the metadata server). When the TCP connection is actually established, it goes to the metadata server. The DNS check saw a safe IP; the connection went to a dangerous one.

**How undici IP-pinning prevents this:**

The `resolveSafeIp` function resolves the hostname once and picks the first non-private IP. Then `fetchWithTimeout` creates an undici `Agent` with a custom `connect.lookup` function:

```typescript
const dispatcher = new Agent({
  connect: {
    lookup: (_hostname, _opts, cb) => {
      cb(null, [{ address: pinnedIp, family }]);
    },
  },
});
```

The `lookup` callback is what undici calls when it needs to resolve a hostname to an IP. By overriding this callback to always return `pinnedIp` (the pre-resolved safe IP), we ensure that no matter what DNS says at connection time, the TCP connection goes to the IP we already verified. The DNS resolver is bypassed entirely for this connection.

Crucially, the URL passed to `undiciFetch` still contains the original hostname. This means TLS handshake still uses the hostname for SNI (Server Name Indication) and certificate validation. The certificate must still be valid for the original hostname. Only the TCP connection is pinned — HTTPS security is unaffected.

### Layer 8: VALIDATION_HOST_ALLOWLIST

For production deployments, the environment variable `VALIDATION_HOST_ALLOWLIST` can be set to a comma-separated list of allowed hostnames. If this variable is set, only hostnames on the list (or subdomains of list entries) will be accepted.

Example: `VALIDATION_HOST_ALLOWLIST=tests.acme.com,testbed.example.org`

This means `tests.acme.com` and `api.tests.acme.com` are allowed, but anything else is rejected with `"<label> host is not in allowlist"`.

This is the recommended configuration for production deployments where all test agents are under known domains.

### Layer 9: VALIDATION_ALLOW_PRIVATE_IPS

For local development (running the registry on your laptop against locally-hosted test agents), setting `VALIDATION_ALLOW_PRIVATE_IPS=true` skips all IP range checks. Combined with `VALIDATION_ALLOW_HTTP=true`, this allows the validator to fetch `http://localhost:3001/tests.json` and send test requests to `http://localhost:8080/agent`.

These flags should never be set in production.

---

## 8. The Database — What's Stored and Why

The registry uses a PostgreSQL database managed by Supabase. There are three tables, plus Row Level Security policies. The schema is in two migration files.

### The `agents` table

This is the primary registry table. Each row represents one published agent spec.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NOT NULL | Primary key. Auto-generated with `gen_random_uuid()`. This is the "registry UUID" — stable, auto-assigned, used in API URLs. |
| `spec_id` | TEXT | NOT NULL UNIQUE | The spec's URN from the `id` field, e.g., `urn:pactspec:acme:invoice-processor`. The natural key. |
| `name` | TEXT | NOT NULL | Human-readable agent name (from `spec.name`). Stored separately for fast search queries (no need to dereference JSONB). |
| `version` | TEXT | NOT NULL | Semver string (from `spec.version`). |
| `description` | TEXT | NULL | Agent description (from `spec.description`). Nullable because description is optional. |
| `provider_name` | TEXT | NOT NULL | Provider's name (from `spec.provider.name`). Stored separately for fast search by provider. |
| `provider_url` | TEXT | NULL | Provider URL. |
| `endpoint_url` | TEXT | NOT NULL | The agent's HTTP endpoint URL. Stored separately so the validator can access it without parsing the full JSONB spec. |
| `spec` | JSONB | NOT NULL | The complete spec document as a JSONB blob. This is the source of truth for the full spec. JSONB means it is stored in a binary format that supports efficient querying, indexing, and traversal. |
| `tags` | TEXT[] | DEFAULT '{}' | Array of tag strings. Stored as a PostgreSQL native array (not inside the JSONB) for efficient `@>` (contains) and `&&` (overlaps) operations. |
| `verified` | BOOLEAN | DEFAULT FALSE | True if the agent has a current passing attestation. |
| `attestation_hash` | TEXT | NULL | The SHA-256 attestation hash from the last passing validation run. |
| `verified_at` | TIMESTAMPTZ | NULL | When the last passing validation run completed. |
| `published_at` | TIMESTAMPTZ | DEFAULT NOW() | When the agent was first published. Does not change on upsert. |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | When the agent was last updated (any re-publish). |

**Why JSONB for `spec`?** The full spec needs to be stored so:
1. The validator can read the complete spec (skills, test suite URLs, etc.) without re-parsing it from individual columns.
2. The spec hash comparison on publish (`specsEqual()`) needs the full spec.
3. The API can return the full spec to callers who want the complete document.
4. The GIN index on `spec` enables queries like "find all agents whose spec contains the word 'invoice'" directly in the JSONB.

**Why duplicate columns (`name`, `provider_name`, `endpoint_url`, etc.) if the spec is in JSONB?** PostgreSQL can extract values from JSONB, but text searches and indexes on JSONB fields are less efficient than on plain text columns. The redundant columns allow fast `ilike` search queries (`name.ilike.%invoice%`) using standard B-tree indexes. It is a denormalization trade-off: a bit of extra storage for a lot of query performance.

**Why `spec_id` as the natural key?** The spec URN is the identifier chosen by the spec author. Two different publishes of the same agent (updates, re-deploys) should map to the same registry record. Using `spec_id` as a unique constraint enables the upsert pattern: `INSERT ... ON CONFLICT (spec_id) DO UPDATE`.

**Indexes:**

- `idx_agents_tags` — GIN index on the `tags` column. GIN (Generalized Inverted Index) is PostgreSQL's index type for array columns. It allows efficient `@>` (array contains) and `&&` (array overlaps) operations. Without this, searching for agents by tag would require a full table scan.
- `idx_agents_verified` — Regular B-tree index on `verified`. Used when filtering by `verified=true`.
- `idx_agents_spec` — GIN index on the `spec` JSONB column. Allows searching within the JSONB document. Expensive to maintain but enables rich queries.
- `idx_agents_published_at` — B-tree index on `published_at DESC`. Added in migration 002. Every `GET /api/agents` query orders by `published_at` descending, so this index is used in virtually every list query.

### The `skills` table

This table stores a normalized, flat representation of each skill from each published agent.

**Why normalize skills separately from the JSONB?** The `spec` JSONB column contains all skills as nested objects. To search for "all agents with a skill tagged 'finance' that costs less than $0.01 per invocation," you would need a complex JSONB query. By normalizing skills into their own table, these queries become straightforward SQL.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NOT NULL | Primary key. |
| `agent_id` | UUID | NOT NULL | Foreign key to `agents.id`. Cascades on delete — if an agent is deleted, its skills are deleted. |
| `skill_id` | TEXT | NOT NULL | The skill's `id` field from the spec. e.g., `"extract-invoice"`. |
| `name` | TEXT | NOT NULL | Skill name. |
| `description` | TEXT | NULL | Skill description. |
| `tags` | TEXT[] | DEFAULT '{}' | Skill-level tags. |
| `input_schema` | JSONB | NULL | The full inputSchema as JSONB. |
| `output_schema` | JSONB | NULL | The full outputSchema as JSONB. |
| `pricing_model` | TEXT | NULL | e.g., `"per-invocation"`. |
| `pricing_amount` | NUMERIC | NULL | The numeric amount. |
| `pricing_currency` | TEXT | NULL | e.g., `"USD"`. |
| `pricing_protocol` | TEXT | NULL | e.g., `"stripe"`. |
| `test_suite_url` | TEXT | NULL | The skill's test suite URL, if any. |

**The unique constraint:** `skills_agent_skill_unique UNIQUE (agent_id, skill_id)` — added in migration 002. Prevents duplicate skill rows for the same agent. Used by the upsert on publish to update existing skill rows rather than creating new ones.

**The cascade delete:** `agent_id UUID REFERENCES agents(id) ON DELETE CASCADE` — if an agent row is deleted, all its skill rows are automatically deleted. No orphaned skill rows.

**Indexes:**

- `idx_skills_agent_id` — B-tree index on `agent_id`. Added in migration 002. Used when deleting skills for an agent (the cascade) and when joining `agents` with `skills`.

### The `validation_runs` table

This is an append-only audit log of every validation run ever triggered. Runs are never updated once completed — only the `status` column changes from `RUNNING` to its final state.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NOT NULL | Primary key. |
| `agent_id` | UUID | NOT NULL | Foreign key to `agents.id`. Cascades on delete. |
| `skill_id` | TEXT | NOT NULL | The skill that was validated. |
| `status` | TEXT | NULL | State machine: `PENDING` → `RUNNING` → `PASSED` or `FAILED` or `TIMEOUT` or `ERROR`. Enforced by a CHECK constraint. |
| `test_results` | JSONB | NULL | Array of `TestResult` objects as JSONB. Stored for historical record and debugging. |
| `duration_ms` | INTEGER | NULL | Total time for the validation run in milliseconds. |
| `error` | TEXT | NULL | Error message, if status is `ERROR`. |
| `attestation_hash` | TEXT | NULL | The attestation hash, if status is `PASSED`. |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | When the run was created. Used for the rate limit query. |

**The status state machine:** A run is inserted with `status = 'RUNNING'`. It transitions to:
- `PASSED` — all tests passed
- `FAILED` — at least one test failed
- `ERROR` — the validation could not run (SSRF block, fetch failure, malformed test suite, etc.)
- `TIMEOUT` — a future state; not yet explicitly triggered by the current code but reserved in the check constraint
- `PENDING` — reserved for future async validation queue

**Why is `PENDING` in the check constraint if nothing uses it?** Schema-first thinking: the reserved state costs nothing and makes future async queuing possible without a migration.

### Row Level Security (RLS)

RLS is a PostgreSQL feature that lets you define access policies at the database level. Every query is automatically filtered by these policies, regardless of which application code runs the query.

PactSpec uses two Supabase clients with different access levels:

1. **Anon client** (`createClient()`): Uses the Supabase anon key. Subject to RLS policies. Intended for reads.
2. **Service role client** (`createServiceRoleClient()`): Uses the service role key. Bypasses RLS entirely. Can read and write anything. Used for publishes, validation run writes, and agent updates.

The RLS policies in the current schema are:

```sql
CREATE POLICY "Public read agents" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read skills" ON skills FOR SELECT USING (true);
CREATE POLICY "Public read validation_runs" ON validation_runs FOR SELECT USING (true);
```

The `USING (true)` means "allow if this condition is true — and true is always true." So any authenticated or unauthenticated user can read from all three tables. No RLS policy exists for INSERT/UPDATE/DELETE with the anon key, which means those operations are blocked for the anon client. Only the service role key (bypasses RLS) can write.

This design means: the registry is publicly readable (anyone can browse agents) but only the server-side application code (which holds the service role key) can write. There is no path for an unauthenticated browser request to insert fake agents directly into the database.

---

## 9. The API — Every Endpoint

### GET /api/agents

**What it does:** Lists and searches published agents in the registry.

**Who calls it:** Browser UIs, CLI tools, orchestration systems discovering agents, anyone building on top of the registry.

**Parameters (query string):**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | empty | Full-text search query. Matched against `name`, `description`, and `provider_name` using case-insensitive `ilike`. Sanitized: only `[a-zA-Z0-9 _\-@]` characters are passed to the query; metacharacters are stripped. Max 100 characters after sanitization. |
| `tags` | string | — | Comma-separated list of tags. Returns agents whose `tags` array overlaps with any of the supplied tags. e.g., `tags=finance,documents` returns agents tagged with finance or documents. |
| `verified` | `"true"` | — | If `"true"`, returns only agents with `verified = true`. |
| `limit` | integer | 50 | Maximum number of results. Capped at 100. |
| `offset` | integer | 0 | Number of records to skip (for pagination). |

**Why `q` is sanitized:** The query string is passed to PostgREST's `ilike` filter using string interpolation (`%${safe}%`). PostgREST has its own query syntax with special characters like `.`, `(`, `)`, `,`, `*`. If a user supplied `q=test*test`, the `*` could be interpreted as PostgREST syntax. The sanitization strips these characters before constructing the filter.

**Returns:**
```json
{
  "agents": [...],
  "total": 47,
  "limit": 50,
  "offset": 0
}
```

`total` is the count of all matching records (before pagination), useful for building "page X of Y" UIs. `agents` is the array of full agent rows from the database.

**Auth required:** None. Public read.

---

### POST /api/agents

**What it does:** Publishes a new agent spec, or updates an existing one if the `id` already exists in the registry.

**Who calls it:** Agent operators publishing their specs. The CLI `pactspec publish` command. The SDK's `publish()` function.

**Headers required:**

- `X-Agent-ID` (required): A string identifying the publisher. Must be 4–128 characters, matching `[\w\-.@:]+`. This is stored nowhere and provides no real authentication — it is a speed bump to prevent trivially empty submissions. Real authentication (API keys) is planned for v1.1.

**Body:** A PactSpec JSON document.

**What happens:**

1. The `X-Agent-ID` header is checked for presence and format.
2. The body is parsed as JSON.
3. The spec is validated against the canonical JSON Schema using `validateAgentSpec()`.
4. The registry looks up any existing agent with the same `spec_id`.
5. If a match exists, spec hashes are compared with `specsEqual()`. If different, `verified`, `attestation_hash`, and `verified_at` will be cleared in the upsert.
6. The agent row is upserted (`INSERT ... ON CONFLICT (spec_id) DO UPDATE`).
7. Skills are upserted into the `skills` table (by `agent_id, skill_id`).
8. Skills that are no longer in the spec are deleted.

**Returns:** HTTP 201 with `{ "agent": <full agent row> }`.

**Errors:**
- 401 if `X-Agent-ID` is missing
- 400 if `X-Agent-ID` format is invalid
- 400 if the JSON is malformed
- 400 if the spec fails schema validation (with an `errors` array)
- 500 on database errors

---

### GET /api/agents/[id]

**What it does:** Retrieves a single agent by its registry UUID or its spec URN.

**Who calls it:** Anyone who wants the full details of a specific agent. The SDK's `getAgent()`. The CLI's verify command (to confirm an agent exists before running validation).

**Path parameter:** `id` can be either:
- A UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`) — checked with regex
- A URL-encoded spec URN (e.g., `urn%3Apactspec%3Aacme%3Ainvoice-processor`) — decoded with `decodeURIComponent`

Both resolve to the same agent row. The response includes the joined `skills` rows (`*, skills(*)`), so callers get the full normalized skill data alongside the JSONB spec.

**Returns:** `{ "agent": <full agent row including skills array> }` or 404.

**Auth required:** None. Public read.

---

### POST /api/agents/[id]/validate

**What it does:** Triggers a validation run for a specific skill of a specific agent. Fetches the skill's test suite, runs all tests against the agent's endpoint, and if all pass, issues an attestation hash and marks the agent verified.

**Who calls it:** Agent operators after publishing a spec to earn the verified badge. The CLI `pactspec verify` command. The SDK's `verify()` function.

**Path parameter:** Agent UUID or spec URN (same routing logic as the GET endpoint).

**Body:** `{ "skillId": "extract-invoice" }`

**What happens:** The full validation flow described in Section 5.

**Returns:**
```json
{
  "runId": "uuid",
  "status": "PASSED",
  "attestationHash": "a4f3b2...",
  "results": [...],
  "durationMs": 1234
}
```

**Status values in the response:**
- `PASSED` — all tests passed, attestation issued, agent marked verified
- `FAILED` — one or more tests failed, results contain details
- `ERROR` — validation could not run (see `error` field for reason)

**Errors:**
- 400 if `skillId` is missing
- 404 if agent not found
- 429 if a validation run was triggered within the last 60 seconds

---

### GET /api/agents.md

**What it does:** Returns a markdown-formatted listing of all agents in the registry. Returns up to 200 agents, ordered by `published_at` descending.

**Who calls it:** This endpoint is designed to be consumed by LLM-based systems — orchestrators and agents that can read text to discover capabilities. A plain text markdown document is easier for an LLM to parse than raw JSON, and the URL path ending in `.md` signals the format.

**Why this exists:** When an LLM orchestrator needs to discover which agents are available, it can make a single GET to `/api/agents.md` and read a structured list. No JSON parsing, no schema knowledge required. The response is human and machine readable.

**Format of the response:**

```markdown
# PactSpec Registry
> schema: https://pactspec.dev/schema/v1.json
> updated: 2025-03-13T14:22:01.000Z
> total: 42

## Acme Invoice Processor v2.1.0
id: urn:pactspec:acme:invoice-processor
endpoint: https://api.acme.example/agents/invoice
verified: YES (2025-03-10T09:00:00.000Z)
skills: extract-invoice, classify-document
tags: finance, documents
pricing: 0.005 USD/per-invocation via stripe

---
```

Each agent gets a section with its name as a heading, key fields as plain-text key-value pairs, and a horizontal rule separator.

**Sanitization:** The `escapeMd` function strips newlines, tabs, backticks, square brackets, and backslashes from all user-supplied strings before inserting them into the markdown. This prevents a malicious agent name or description from injecting markdown syntax that could confuse parsers or renderers.

**Caching:** The response includes `Cache-Control: public, max-age=60` — it is publicly cacheable for 60 seconds. This reduces database load since this endpoint could be polled frequently.

**CORS:** `Access-Control-Allow-Origin: *` — any origin can fetch this.

**Content-Type:** `text/markdown; charset=utf-8`

---

### GET /api/spec/v1

**What it does:** Serves the canonical PactSpec v1 JSON Schema document.

**Who calls it:** Any validator that wants to check a spec against the official schema. The CLI bundles the schema locally, but this endpoint provides the authoritative hosted version.

**Why this exists:** Tooling authors building their own validators, linters, or IDE plugins need a stable URL to fetch the canonical schema from. `https://pactspec.dev/schema/v1.json` is that URL. The `$id` field in the schema itself references this URL, creating a self-describing schema.

**Caching:** `Cache-Control: public, max-age=3600` — cacheable for 1 hour. The schema does not change between versions.

**CORS:** `Access-Control-Allow-Origin: *`

**Content-Type:** `application/schema+json` — the IANA-registered MIME type for JSON Schema documents.

**Static generation:** The route has `export const dynamic = 'force-static'`, which tells Next.js to pre-render this route at build time into a static file rather than executing it on every request. This is appropriate since the schema never changes at runtime.

---

## 10. The SDK — JS/TS and Python

### Why use the SDK instead of raw API calls?

Both SDKs do two things that raw `fetch` calls do not:

1. **Local validation before network:** The `validate()` function runs the spec against the JSON Schema locally, without a network call. This catches spec errors immediately — before you send a broken spec to the registry, which would require a network round-trip to discover the error.

2. **Typed results and error handling:** The SDKs return typed objects with consistent error handling. The TypeScript SDK throws typed errors; the Python SDK raises `ValueError` for spec validation failures and `httpx.HTTPStatusError` for API errors.

### JavaScript/TypeScript SDK

The TypeScript SDK is in `/Users/dave/Dev/agentspec/sdk/src/index.ts`. It is compiled to CommonJS and distributed as `@pactspec/sdk`.

#### Functions

**`validate(spec: unknown): ValidateResult`**

Validates any value against the PactSpec v1 JSON Schema. Synchronous — no network calls. Uses AJV with the bundled schema (the schema is imported at build time, not fetched at runtime).

Returns `{ valid: boolean, errors: string[] }`. If `valid` is false, `errors` is an array of human-readable error strings like `"/skills/0/id must match pattern \"^[a-z0-9-]+$\""`.

```typescript
import { validate } from '@pactspec/sdk';

const result = validate(mySpec);
if (!result.valid) {
  console.error(result.errors);
}
```

**`publish(spec: PactSpec, options: PublishOptions): Promise<PublishResult>`**

Validates the spec locally, then POSTs it to the registry. Throws if validation fails. Throws if the API returns an error.

`PublishOptions`:
- `agentId` (required): The X-Agent-ID header value.
- `registry` (optional): Registry base URL. Defaults to `https://pactspec.dev`.

`PublishResult`:
- `id`: Registry UUID for the agent.
- `specId`: The spec URN.
- `verified`: Whether the agent is currently verified.

**`verify(agentId: string, skillId: string, options?: VerifyOptions): Promise<VerifyResult>`**

Triggers a validation run. `agentId` can be either a UUID or a spec URN.

`VerifyResult`:
- `runId`: UUID of the validation run record.
- `status`: `'PASSED' | 'FAILED' | 'ERROR'`
- `attestationHash`: The attestation hash string, if status is PASSED.
- `results`: Array of `TestResult` objects.
- `durationMs`: Total run time.
- `error`: Error message, if any.

**`getAgent(agentId: string, options?): Promise<AgentRecord>`**

Fetches a single agent by UUID or spec URN. Returns a camelCase `AgentRecord` (the SDK normalizes snake_case database column names to camelCase).

**`search(options?: SearchOptions): Promise<SearchResult>`**

Searches the registry. Options: `q`, `verifiedOnly`, `limit`, `offset`, `registry`.

#### The PactSpecClient class

For those who prefer an object-oriented interface with shared configuration:

```typescript
import { PactSpecClient } from '@pactspec/sdk';

const client = new PactSpecClient({
  registry: 'https://pactspec.dev',
  agentId: 'my-agent@acme.com',
});

// Validate locally
const { valid, errors } = client.validate(mySpec);

// Publish
const { id, specId } = await client.publish(mySpec);

// Verify
const result = await client.verify(id, 'extract-invoice');

// Get specific agent
const agent = await client.getAgent('urn:pactspec:acme:invoice-processor');

// Search
const { agents } = await client.search({ q: 'invoice', verifiedOnly: true });
```

The class stores `registry` and `agentId` as instance properties. All method calls use those defaults but accept overrides per call. This pattern is useful when integrating PactSpec into a larger application that needs multiple clients with different configurations.

---

### Python SDK

The Python SDK is in `/Users/dave/Dev/agentspec/pactspec-py/`. It uses `httpx` for HTTP calls and `jsonschema` for validation.

#### Functions

**`validate(spec: Any) -> ValidateResult`**

Validates a dict against the PactSpec v1 schema. Synchronous. Uses `jsonschema.Draft202012Validator` (the Python implementation of JSON Schema Draft 2020-12, which is the same version the TypeScript SDK uses).

Returns a `ValidateResult` dataclass with `valid: bool` and `errors: List[str]`.

**`publish(spec: Dict, agent_id: str, registry: str = DEFAULT_REGISTRY) -> PublishResult`**

Validates locally, then posts to the registry. Raises `ValueError` if the spec is invalid. Raises `httpx.HTTPStatusError` on API errors.

Returns a `PublishResult` dataclass with `id`, `spec_id`, and `verified`.

```python
from pactspec import publish

result = publish(my_spec, agent_id="my-agent@acme.com")
print(result.id)
```

**`verify(agent_id: str, skill_id: str, registry: str = DEFAULT_REGISTRY) -> VerifyResult`**

Triggers a validation run. Uses a 120-second timeout (validation can take a while if tests are slow).

Returns a `VerifyResult` dataclass.

**`get_agent(agent_id: str, registry: str = DEFAULT_REGISTRY) -> AgentRecord`**

Fetches a single agent. Returns an `AgentRecord` dataclass.

**`search(q=None, verified_only=False, limit=50, offset=0, registry=DEFAULT_REGISTRY) -> SearchResult`**

Searches the registry. Returns a `SearchResult` dataclass with `agents: List[AgentRecord]`, `total`, `limit`, `offset`.

#### The PactSpecClient class

```python
from pactspec import PactSpecClient

client = PactSpecClient(agent_id="my-agent@acme.com")

result = client.validate(my_spec)
publish_result = client.publish(my_spec)
verify_result = client.verify(publish_result.id, "extract-invoice")
agent = client.get_agent("urn:pactspec:acme:invoice-processor")
search_result = client.search(q="invoice", verified_only=True)
```

---

## 11. The CLI — Every Command

Install globally:

```bash
npm install -g @pactspec/cli
```

After installation, the `pactspec` command is available.

---

### `pactspec init`

**What it does:** Generates a skeleton PactSpec JSON file in the current directory. The skeleton has all required fields filled in with placeholder values, so you can edit it to match your agent.

**Options:**
- `-o, --out <file>` — output filename, default `pactspec.json`

**Example:**
```bash
pactspec init
# Creates pactspec.json with a skeleton spec

pactspec init --out my-agent.json
# Creates my-agent.json
```

**What the generated file looks like:**
```json
{
  "specVersion": "1.0.0",
  "id": "urn:pactspec:your-org:your-agent",
  "name": "Your Agent Name",
  "version": "1.0.0",
  "description": "Describe what your agent does.",
  "provider": {
    "name": "Your Organization",
    "url": "https://your-org.example",
    "contact": "hello@your-org.example"
  },
  "endpoint": {
    "url": "https://api.your-org.example/agent",
    "auth": { "type": "bearer" }
  },
  "skills": [
    {
      "id": "your-skill",
      "name": "Your Skill",
      "description": "Describe what this skill does.",
      "inputSchema": {
        "type": "object",
        "required": ["input"],
        "properties": { "input": { "type": "string" } }
      },
      "outputSchema": {
        "type": "object",
        "required": ["output"],
        "properties": { "output": { "type": "string" } }
      },
      "pricing": { "model": "free", "amount": 0, "currency": "USD" }
    }
  ],
  "tags": []
}
```

After running `init`, the CLI prints `✓ Created pactspec.json` and suggests the next step: `pactspec validate pactspec.json`.

---

### `pactspec validate <file>`

**What it does:** Validates a PactSpec JSON file against the v1 schema. Local only — no network calls.

**Arguments:** Path to a JSON file.

**What it checks:** Everything the JSON Schema specifies. All required fields present. All fields of the correct type. URN format for `id`. Semver format for `version`. URI format for endpoint URL. Pricing enum values.

**Output on success:**
```
✓ Valid PactSpec document
```

**Output on failure:**
```
✗ Validation failed:
  /id must match pattern "^urn:pactspec:[a-z0-9-]+:[a-z0-9-]+$"
  /skills/0/inputSchema must be object
```

Each error shows the JSON path (e.g., `/skills/0/inputSchema`) and a human-readable message from AJV.

The CLI exits with code 0 on success and code 1 on failure, making it suitable for use in CI pipelines.

---

### `pactspec publish <file>`

**What it does:** Validates the spec locally, then posts it to the PactSpec registry. On success, prints the registry UUID and the agent's registry URL.

**Arguments:** Path to a JSON file.

**Options:**
- `-r, --registry <url>` — registry base URL, default `https://pactspec.dev`
- `-k, --agent-id <id>` — your agent identifier (the `X-Agent-ID` header). Required.

**Example:**
```bash
pactspec publish pactspec.json --agent-id my-agent@acme.com
# Publishing to https://pactspec.dev...
# ✓ Published: 550e8400-e29b-41d4-a716-446655440000
#   https://pactspec.dev/agents/550e8400-e29b-41d4-a716-446655440000
```

If the spec fails local validation, the command errors before making any network call. If the publish API returns validation errors, they are printed individually.

The CLI exits with code 0 on success and code 1 on failure.

---

### `pactspec verify <agent-id> <skill-id>`

**What it does:** Triggers a validation run for a specific skill on a published agent and waits for the result. Prints per-test results and the attestation hash if the run passes.

**Arguments:**
- `<agent-id>` — the registry UUID or the spec URN (URL-encoded if it contains colons)
- `<skill-id>` — the skill ID to validate

**Options:**
- `-r, --registry <url>` — registry base URL, default `https://pactspec.dev`

**Example on success:**
```
Running validation for urn:pactspec:acme:invoice-processor / extract-invoice...
✓ Validation PASSED
  Attestation: a4f3b2c1d5e6...
```

**Example on failure:**
```
Running validation for urn:pactspec:acme:invoice-processor / extract-invoice...
✗ Validation FAILED
  ✓ basic-pdf (743ms)
  ✗ missing-url (51ms) — Expected status 400, got 200
```

The CLI exits with code 0 if validation passed, code 1 if it failed or errored.

---

### `pactspec conformance`

**What it does:** Runs a conformance test suite against the local schema. Reads JSON files from the `conformance/valid/` and `conformance/invalid/` directories and verifies that the schema accepts valid specs and rejects invalid ones.

**Options:**
- `-r, --registry <url>` — unused for the actual conformance check but available for future use

**How it works:**
- Reads every `.json` file from `conformance/valid/` and checks that the schema accepts it. If a valid spec is rejected, that is a test failure.
- Reads every `.json` file from `conformance/invalid/` and checks that the schema rejects it. If an invalid spec is accepted, that is a test failure.

**Output:**
```
✓ valid/minimal.json
✓ valid/full.json
✓ invalid/missing-id.json — correctly rejected
✓ invalid/bad-version.json — correctly rejected

4 passed  0 failed
```

The conformance suite is the regression test for the schema itself. If you add a new validation rule to the schema, you add a corresponding test case to `conformance/invalid/` to prove the rule is enforced.

---

### `pactspec convert <format> <file>`

**What it does:** Converts an existing API description document (OpenAPI or MCP) into a PactSpec skeleton. The result is a starting point — you will need to review and fill in details that the source format does not capture.

**Arguments:**
- `<format>` — `openapi` or `mcp`
- `<file>` — path to the source document (JSON or YAML; YAML is supported via the `yaml` package)

**Options:**
- `-o, --out <file>` — output filename, default `pactspec.json`

#### convert openapi

The OpenAPI converter does the following mapping:

| OpenAPI field | PactSpec field |
|---|---|
| `info.title` | `name`, and the base for the spec `id` slug |
| `info.version` | `version` (normalized to semver with `toSemver()`) |
| `info.description` | `description` |
| `servers[0].url` | `endpoint.url` and `provider.url` origin |
| Each `paths[path][method]` operation | One skill |
| `operationId` (or `method + path`) | `skills[].id` (slugified) |
| `summary` (or `operationId`) | `skills[].name` |
| `description` | `skills[].description` |
| `requestBody.content.application/json.schema` | `skills[].inputSchema` |
| `responses.200.content.application/json.schema` | `skills[].outputSchema` |
| GET parameters | `skills[].inputSchema.properties` |

What gets lost (and generates warnings):
- Authentication details (OpenAPI security schemes are not mapped to `endpoint.auth`)
- Pricing (OpenAPI has no pricing concept — all skills get `free` as placeholder)
- Test suites (must be written by hand)
- Operations with non-JSON request bodies
- Operations missing a 200/201 response schema

The converter slugifies the operation's `operationId` or `method + path` string (lowercased, non-alphanumeric characters replaced with hyphens) to produce the skill ID. Skill IDs must match `[a-z0-9-]+`, so the slugify function handles the conversion.

#### convert mcp

The MCP converter maps an MCP tool manifest to PactSpec. MCP manifests vary in format, so the converter handles both the "tools list" format and the "server info" format.

| MCP field | PactSpec field |
|---|---|
| `name` or `serverName` | `name` |
| `version` | `version` (normalized to semver) |
| `url` or `endpoint` | `endpoint.url` |
| Each `tools[i]` entry | One skill |
| `tools[i].name` | `skills[].name` and `skills[].id` (slugified) |
| `tools[i].description` | `skills[].description` |
| `tools[i].inputSchema` or `tools[i].parameters` | `skills[].inputSchema` |

MCP does not define an output schema concept, so every generated skill gets `outputSchema: { "type": "object", "description": "MCP tool output — define outputSchema manually" }` and a warning is always emitted: `"MCP outputSchema is not defined in the protocol — review each skill's outputSchema before publishing"`.

After converting, always run `pactspec validate <output-file>` and review the warnings before publishing.

---

## 12. Security Model — The Full Picture

### The threat landscape

PactSpec is a public registry where anyone can publish an agent spec by making an HTTP request. The registry then makes further HTTP requests based on the URLs in those specs (during validation). This creates several attack surfaces.

### Threat 1: Publishing fake agents (spam and impersonation)

**What an attacker can do:** Submit specs with fabricated provider names, claiming to be `"OpenAI"` or `"Anthropic"`, with real-looking endpoints but misleading descriptions. Flood the registry with thousands of fake entries to pollute search results.

**Current mitigations:**
- `X-Agent-ID` header required (4–128 chars, `[\w\-.@:]+` format). Trivial friction — does not prevent determined abuse, but stops bots that don't read the docs.
- Verified badge as the trust signal: anyone can publish, but only agents that pass their own tests earn the verified badge. Unverified agents are clearly marked in all API responses.
- The registry is append-only from the public's perspective (via the anon key). An attacker cannot overwrite or delete another agent's record by guessing their `spec_id` — they can only upsert the record for that `spec_id`, and if the verification flag exists on the old record and the spec hash is unchanged, it is preserved.

**Planned mitigations:**
- Per-IP rate limiting at the Vercel edge
- API key authentication for publish (v1.1)

### Threat 2: SSRF via user-supplied URLs

Fully covered in Section 7. The multi-layer protection means an attacker who controls both a domain and its DNS resolution cannot redirect the validator to internal services.

**Residual risk:** A public IP that is later re-assigned to private infrastructure. Mitigated by using `VALIDATION_HOST_ALLOWLIST` in production.

### Threat 3: Attestation replay

**What an attacker can do:** Copy a valid attestation hash from one agent's record in the database and insert it into a different agent's record, fraudulently claiming that the second agent is verified.

**Mitigations:**
- The attestation hash is computed as `SHA256(agentId + skillId + results + timestamp)`. The `agentId` is the registry UUID — specific to this agent's database row. A hash from agent A cannot be valid for agent B, because the `agentId` in the preimage differs.
- The hash is stored with `verified_at`. A third party checking an attestation can verify that the hash matches the preimage (agentId, skillId, results, timestamp) without trusting the database — they just need the components, not the private key.
- Spec changes clear the attestation. Even if an attacker somehow acquired a valid hash for agent A's current spec, changing that spec would clear the hash.

**Residual risk:** An attacker who controls the agent endpoint and the test suite can write tests that the agent will always pass. The attestation proves "the agent passes these specific tests" — not "the agent is useful or trustworthy in general." This is a conformance problem, not a security problem.

### Threat 4: Spec tampering

**What an attacker can do:** An operator publishes a spec, earns a verified badge, then modifies the spec (to claim capabilities the agent doesn't have) while retaining the verified badge.

**Mitigations:**
- Every re-publish (`POST /api/agents`) computes a SHA-256 hash of the full spec using `stableStringify` (key-sorted, deterministic) and compares it to the stored hash.
- If the hashes differ, the verification fields are cleared before the upsert is written. The agent cannot retain a verified badge from a different version of its spec.
- The operator must re-trigger validation to get a new attestation for the modified spec.

### Threat 5: Malicious test suite content

**What an attacker can do:** Craft a test suite URL that returns a response designed to crash the validator — extremely large JSON, deeply nested structures that cause exponential memory usage, or content designed to trigger ReDoS (Regular Expression Denial of Service) in AJV.

**Mitigations:**
- **1MB body cap:** The test suite fetch is limited to 1,048,576 bytes. Larger responses cause an immediate error.
- **50 test limit:** Limits total execution time regardless of test complexity.
- **10-second fetch timeout:** The test suite file itself must be delivered within 10 seconds.
- **Standard JSON.parse:** No `eval`, no `Function()` constructor. Standard JSON parsing cannot execute arbitrary code.
- **AJV schema caching:** AJV compiles schemas once and caches them. However, each test case can supply a different `outputSchema`, so for test suites with many unique schemas, AJV does multiple compilations. This is bounded by the 50-test limit.

### Threat 6: Validation run DoS

**What an attacker can do:** Repeatedly trigger validation runs against a slow agent, exhausting the validator's connection pool or running up serverless execution costs.

**Mitigations:**
- **Per-agent rate limit:** One validation run per agent per 60 seconds. This is enforced in the database by counting recent `validation_runs` rows.
- **Per-test timeout:** Each test has a default 15-second timeout, configurable down to as low as 1ms per test. The maximum execution time for a full run is bounded by `sum(timeoutMs)` across all 50 tests.

**Planned:** Per-agent-per-hour rate limit (stricter than per-minute).

### The trust hierarchy

PactSpec has two trust levels for agents in the registry:

**Unverified agent:**
- Anyone can publish one by POSTing a spec with any `X-Agent-ID` header.
- The spec is stored in the registry and searchable.
- `verified = false` in all API responses.
- No attestation hash.
- Meaning: "Someone claimed this agent exists with these capabilities. We have not checked."

**Verified agent:**
- Has passed all tests in its declared test suite, for at least one skill.
- `verified = true` in all API responses.
- Has an `attestation_hash` and `verified_at`.
- The verification is tied to the current spec — changing the spec clears it.
- Meaning: "At `verified_at`, this agent's skill passed the tests it published. The spec has not changed since."

What verification does not mean: that the agent is safe, that its test suite is comprehensive, that the agent was written by whom the `provider` field claims, or that it will continue to work in the future.

---

## 13. Governance and the Standard

### Who owns PactSpec now

PactSpec is currently under the "Stewardship" model — one founding steward (the project creator, Dave) maintains the spec, coordinates releases, and has final decision-making authority. This is the practical model for early-stage standards work where one person has the clearest vision and the most context.

The governance document lives at `/Users/dave/Dev/agentspec/GOVERNANCE.md`.

### The RFC process

RFC stands for Request for Comments — a tradition in internet standards for proposing and debating changes through structured documents. PactSpec uses an RFC process for spec changes:

1. Anyone can propose a change by opening an RFC document.
2. The community discusses and iterates on the RFC.
3. If consensus is reached, the steward accepts it.
4. If consensus is not reached, the steward makes the final call.

**What requires an RFC:** Any change that affects wire compatibility (i.e., a change to what a valid PactSpec document looks like) or changes the `specVersion`. Adding a new optional field is potentially wire-compatible (old validators ignore unknown fields), but still worth an RFC for documentation and ecosystem awareness.

**What does not require an RFC:** Bug fixes to reference implementations, documentation updates, adding conformance test cases.

### Versioning

PactSpec follows semantic versioning for the spec itself:

- **Backwards-compatible additions** (new optional fields, new allowed enum values): These are minor version bumps. Old validators that follow the robustness principle ("be liberal in what you accept") will continue to work with new specs.
- **Breaking changes** (removing required fields, changing types, making optional fields required, changing validation behavior): These are major version bumps and require a new `specVersion` value in the schema. This is why `specVersion` exists as a required field — validators can immediately detect a spec from a newer major version.

The current version is `1.0.0`. The next planned set of changes (Ed25519 signatures, API keys, extended test suite format) will be versioned as `1.1.0` if backwards-compatible, or `2.0.0` if breaking.

### IP policy

The PactSpec specification and schema are licensed under Apache 2.0. This means:

- Anyone can use, distribute, modify, and build products based on the spec.
- If you distribute a modified version of the spec, you must include the Apache 2.0 license and attribution.
- Patent non-assertion: Apache 2.0 includes a patent grant — contributors to PactSpec implicitly grant users a royalty-free license to any patents they hold that cover the spec. This prevents a contributor from contributing to the spec, having it widely adopted, and then suing adopters for patent infringement.

The reference implementations (registry, SDK, CLI) are licensed under MIT, which is more permissive — no attribution requirement when distributing modified versions.

### Path to a multi-vendor working group

The trigger for transitioning from stewardship to a multi-vendor working group is three or more production adopters. An adopter is defined as a production system that publishes PactSpec or consumes it in production (not just evaluation or experimentation).

When this threshold is reached, the steward will initiate the formation of a working group. The working group would include representatives from each adopting organization, use the same RFC process, and require broader consensus (not just steward sign-off) for spec changes.

This is the standard path for successful open standards — start with a small team for speed and coherence, then open governance as adoption grows and multiple parties have interests to protect.

Production adopters are listed in `ADOPTERS.md`.

---

## 14. The Roadmap

### What is live today

- PactSpec v1.0.0 schema (`agent-spec.v1.json`)
- Public registry at `https://pactspec.dev`
- Full validation flow: fetch test suite → run tests → issue attestation
- Multi-layer SSRF protection with undici IP-pinning
- SHA-256 attestation hashes
- Spec hash comparison on every publish (tamper detection)
- `GET /api/agents` — search by text, tags, verified flag, pagination
- `POST /api/agents` — publish with upsert and skill sync
- `GET /api/agents/[id]` — fetch by UUID or spec URN
- `POST /api/agents/[id]/validate` — validation run with per-agent rate limiting
- `GET /api/agents.md` — markdown listing for LLM consumption
- `GET /api/spec/v1` — canonical schema endpoint
- TypeScript SDK (`@pactspec/sdk`) with `validate`, `publish`, `verify`, `getAgent`, `search`, `PactSpecClient`
- Python SDK (`pactspec-py`) with equivalent functions and `PactSpecClient` class
- CLI (`@pactspec/cli`) with `init`, `validate`, `publish`, `verify`, `conformance`, `convert openapi`, `convert mcp`
- Conformance test suite in `conformance/valid/` and `conformance/invalid/`

### What is planned

**Ed25519 attestation signatures (v1.1):**
The most important planned change. The registry will sign attestation payloads with an Ed25519 private key. Third parties will be able to verify attestations using the registry's public key, without trusting the database. This makes attestations portable — you can embed the attestation hash and signature in your own systems, and anyone can verify them.

**Rate limiting at the Vercel edge:**
Per-IP rate limiting on the publish endpoint, implemented at the edge before requests reach the Next.js application layer. This protects against registry flooding attacks.

**API key authentication:**
A proper API key system for the publish endpoint. Publishers register an API key, include it in requests, and the registry validates it. This replaces the current `X-Agent-ID` header placeholder. API keys will enable per-publisher quotas, revocation, and audit logging.

**Python SDK on PyPI:**
The Python SDK currently exists in source form. Publishing it to PyPI (`pip install pactspec`) is a near-term goal for broader Python ecosystem adoption.

**Stricter per-hour validation rate limit:**
The current 1-per-60-seconds rate limit prevents rapid hammering but allows 60 validation runs per hour. A per-hour limit (e.g., 10 per hour per agent) will be added to further protect validator resources.

**VALIDATION_ALLOW_HTTP cleanup:**
This flag is currently required for local development. A better developer experience would be a local validator that uses HTTP natively, without needing to configure a prod environment variable.

### Adoption milestones

- **1 production adopter:** Validate the publish/verify workflow under real conditions. Identify any friction in the spec format from real-world usage.
- **3 production adopters:** Trigger the multi-vendor working group transition. The spec gains external stakeholders.
- **PyPI and npm published:** Lower the barrier to adoption for Python and Node.js ecosystems.
- **DID-based provider verification (v1.1):** Allow providers to include a `provider.did` field anchored to a DID document for cryptographic identity verification. Not in v1 — DID resolution is a non-trivial dependency. The planned path is `did:web` (HTTP-based resolution) as a first step.
- **Marketplace integration:** A consumer-facing marketplace UI that lets developers browse verified agents, inspect their specs, and try them out.

---

*This document reflects PactSpec as implemented at the time of writing. The canonical source of truth for the spec format is `/Users/dave/Dev/agentspec/src/lib/schema/agent-spec.v1.json`. The canonical source of truth for the validation logic is `/Users/dave/Dev/agentspec/src/lib/validator.ts`.*
