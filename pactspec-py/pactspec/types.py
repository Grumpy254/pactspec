"""PactSpec type definitions.

These types mirror the canonical TypeScript definitions in the PactSpec project
and can be used for type checking with mypy or pyright.
"""

from typing import Any, Dict, List, Literal, Optional

try:
    from typing import TypedDict
except ImportError:
    from typing_extensions import TypedDict


# --- Literal type aliases ---

AuthType = Literal["none", "bearer", "x-agent-id", "header"]
PricingModel = Literal["per-invocation", "per-token", "per-second", "free"]
PricingCurrency = Literal["USD", "USDC", "SOL"]
PricingProtocol = Literal["x402", "stripe", "none"]
TestSuiteType = Literal["http-roundtrip", "json-schema-validation"]


# --- Spec sub-types ---


class PactSpecPricing(TypedDict, total=False):
    """Pricing configuration for a skill."""

    model: PricingModel
    amount: float
    currency: PricingCurrency
    protocol: PricingProtocol


class PactSpecTestSuite(TypedDict, total=False):
    """Test suite reference for a skill."""

    url: str
    type: TestSuiteType


class PactSpecExample(TypedDict, total=False):
    """An input/output example for a skill."""

    description: str
    input: Any
    expectedOutput: Any


class PactSpecSkill(TypedDict, total=False):
    """A single skill (capability) within an agent spec."""

    id: str
    name: str
    description: str
    tags: List[str]
    inputSchema: Dict[str, Any]
    outputSchema: Dict[str, Any]
    pricing: PactSpecPricing
    testSuite: PactSpecTestSuite
    examples: List[PactSpecExample]


class PactSpecProvider(TypedDict, total=False):
    """Agent provider information."""

    name: str
    url: str
    contact: str


class PactSpecAuth(TypedDict, total=False):
    """Endpoint authentication configuration."""

    type: AuthType
    name: str
    header: str


class PactSpecEndpoint(TypedDict, total=False):
    """Agent endpoint configuration."""

    url: str
    auth: PactSpecAuth


class PactSpecDelegation(TypedDict, total=False):
    """Delegation metadata for wrapped/proxy agents."""

    delegatedFrom: str
    revenueShare: Dict[str, float]
    terms: str


class PactSpecLinks(TypedDict, total=False):
    """Links associated with an agent spec."""

    documentation: str
    repository: str


class PactSpec(TypedDict, total=False):
    """Top-level PactSpec document (v1.0.0)."""

    specVersion: Literal["1.0.0"]
    id: str
    name: str
    version: str
    description: str
    provider: PactSpecProvider
    endpoint: PactSpecEndpoint
    skills: List[PactSpecSkill]
    tags: List[str]
    license: str
    links: PactSpecLinks
    delegation: PactSpecDelegation


# --- Benchmark types ---


class Benchmark(TypedDict, total=False):
    """A benchmark definition for evaluating agent skills."""

    id: str
    name: str
    description: str
    domain: str
    version: str
    publisher: str
    publisherUrl: str
    testSuiteUrl: str
    testCount: int
    skill: str
    createdAt: str


class BenchmarkResult(TypedDict, total=False):
    """Result of running a benchmark against an agent."""

    id: str
    benchmarkId: str
    agentId: str
    score: float
    passedCount: int
    totalCount: int
    runAt: str
    attestationHash: str


# --- Test suite types ---


class TestCase(TypedDict, total=False):
    """A single test case within a test suite file."""

    id: str
    description: str
    request: Dict[str, Any]
    expect: Dict[str, Any]
    timeoutMs: int


class TestSuiteFile(TypedDict, total=False):
    """The test suite JSON file format agents publish at testSuite.url."""

    version: Literal["1.0"]
    skill: str
    tests: List[TestCase]


# --- Validation result types ---


class TestResult(TypedDict, total=False):
    """Result of a single test execution."""

    testId: str
    passed: bool
    durationMs: int
    error: str
    statusCode: int


class ValidationResult(TypedDict, total=False):
    """Result of a full validation run."""

    status: Literal["PASSED", "FAILED", "ERROR", "TIMEOUT"]
    results: List[TestResult]
    attestationHash: str
    durationMs: int
    error: str
