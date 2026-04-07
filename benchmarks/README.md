# PactSpec Benchmarks

PactSpec does not author benchmarks. Domain experts do.

PactSpec is the **engine** — it runs benchmarks against live agent endpoints, scores the results, and signs them with the registry's Ed25519 key. But PactSpec does not write the test cases or decide the correct answers. That's your job.

## Who should publish benchmarks?

- **Medical coding professionals** who know ICD-11 codes
- **Security engineers** who know vulnerability classification
- **Lawyers** who know contract clause analysis
- **Data scientists** who know extraction accuracy
- Anyone with domain expertise and opinions about what "correct" looks like

## How it works

A benchmark is a JSON file hosted at any URL. It contains test cases with inputs and expected outputs. When an agent runs against your benchmark, the PactSpec registry:

1. Fetches your benchmark file from its URL
2. Sends each test input to the agent's endpoint
3. Checks the response against your expected output schema
4. Scores the agent (passed tests / total tests)
5. Signs the result with the registry's Ed25519 key

Your name stays on the benchmark. You control the expected answers. You can update the benchmark at any time by updating the file at your URL.

## Benchmark format

```json
{
  "version": "1.0",
  "benchmark": "your-benchmark-id",
  "name": "Your Benchmark Name",
  "description": "What this benchmark tests and why it matters.",
  "domain": "your-domain",
  "publisher": "Your Name or Organization",
  "publisherUrl": "https://your-site.com",
  "skill": "the-skill-id-this-tests",
  "source": "peer-reviewed",
  "sourceDescription": "How you created these test cases and verified the expected answers.",
  "sourceUrl": "https://link-to-your-methodology-or-data-source",
  "tests": [
    {
      "id": "test-001",
      "description": "What this test case checks",
      "request": {
        "method": "POST",
        "body": {
          "your": "input data"
        }
      },
      "expect": {
        "status": 200,
        "outputSchema": {
          "type": "object",
          "required": ["answer"],
          "properties": {
            "answer": { "type": "string", "const": "the correct answer" }
          }
        }
      }
    }
  ]
}
```

## Source types

| Source | What it means |
|--------|---------------|
| `peer-reviewed` | Expected answers reviewed by qualified professionals |
| `industry-standard` | Based on an established industry standard or certification |
| `community` | Community-contributed, not formally reviewed |
| `synthetic` | Generated test data, not validated by domain experts |

Benchmarks with `peer-reviewed` or `industry-standard` source are displayed without warnings. All others show a notice that expected answers have not been independently validated.

## Publishing a benchmark

1. Create a benchmark JSON file following the format above
2. Host it at a public URL you control
3. Submit it to the registry:

```bash
curl -X POST https://pactspec.dev/api/benchmarks \
  -H "Content-Type: application/json" \
  -d '{
    "benchmarkId": "your-benchmark-id",
    "name": "Your Benchmark Name",
    "description": "What it tests",
    "domain": "your-domain",
    "publisher": "Your Name",
    "publisherUrl": "https://your-site.com",
    "testSuiteUrl": "https://your-site.com/benchmark.json",
    "testCount": 20,
    "skill": "the-skill-id",
    "source": "peer-reviewed",
    "sourceDescription": "How you verified the answers"
  }'
```

## Example: a medical coding benchmark

A certified medical coder could publish a benchmark like this:

```json
{
  "version": "1.0",
  "benchmark": "icd11-primary-care-v1",
  "name": "ICD-11 Primary Care Coding",
  "description": "20 common primary care scenarios with verified ICD-11 codes.",
  "domain": "medical-coding",
  "publisher": "Jane Smith, CPC",
  "publisherUrl": "https://janesmith-coding.com",
  "skill": "medical-coding",
  "source": "peer-reviewed",
  "sourceDescription": "All codes verified against WHO ICD-11 2024-01 release by a certified professional coder (CPC). Clinical scenarios based on de-identified patient encounters.",
  "sourceUrl": "https://icd.who.int/browse/2024-01/mms/en",
  "tests": [...]
}
```

The key: **you** are the expert. **You** vouch for the correct answers. PactSpec just runs the tests.
