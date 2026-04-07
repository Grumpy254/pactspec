# Unreviewed Benchmarks

These benchmark suites have expected answers that have **not been validated by domain experts**. They were moved out of the main benchmarks directory after we found incorrect ICD-11 codes in the medical coding benchmark — codes assigned to wrong chapters (e.g., diabetes codes in the respiratory chapter).

The test infrastructure works correctly. The problem is the expected answers themselves, which need review by professionals in each domain:

- **medical-coding-icd11-v1.json** — Needs review by a certified medical coder. Multiple ICD-11 codes are in the wrong chapter.
- **legal-contract-review-v1.json** — Needs review by a lawyer familiar with contract analysis.
- **security-vulnerability-scan-v1.json** — Needs review by a security engineer.
- **data-extraction-v1.json** — Needs review for extraction accuracy.
- **text-summarization-v1.json** — Summarization quality is inherently subjective.

## Contributing

If you have domain expertise and want to help fix these benchmarks, please open a PR or issue at [github.com/Grumpy254/pactspec](https://github.com/Grumpy254/pactspec/issues). Even reviewing and correcting a single benchmark would be a significant contribution.

Once a benchmark's expected answers are validated by a domain professional, it will be moved back to the main `benchmarks/` directory with `source` updated to `peer-reviewed`.
