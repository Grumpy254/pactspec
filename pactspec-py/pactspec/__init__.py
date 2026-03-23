"""PactSpec Python SDK — validate, publish, and verify AI agent capability specs.

Quick start::

    from pactspec import validate_spec, PactSpecClient

    # Validate locally
    result = validate_spec(my_spec)

    # Publish to registry
    client = PactSpecClient(agent_id="my-agent@acme.com")
    pub = client.publish(my_spec)
"""

from .validate import validate_spec, validate, ValidateResult
from .client import (
    PactSpecClient,
    publish,
    verify,
    get_agent,
    search,
    PublishResult,
    VerifyResult,
    AgentRecord,
    SearchResult,
    TestResult,
    PactSpecError,
    PactSpecValidationError,
    PactSpecAPIError,
    PactSpecNotFoundError,
)
from .types import (
    PactSpec,
    PactSpecSkill,
    PactSpecPricing,
    PactSpecProvider,
    PactSpecEndpoint,
    PactSpecAuth,
    PactSpecTestSuite,
    PactSpecExample,
    PactSpecLinks,
    PactSpecDelegation,
    Benchmark,
    BenchmarkResult,
)

__version__ = "0.1.0"
__all__ = [
    # Validation
    "validate_spec",
    "validate",
    "ValidateResult",
    # Client
    "PactSpecClient",
    "publish",
    "verify",
    "get_agent",
    "search",
    # Result types
    "PublishResult",
    "VerifyResult",
    "AgentRecord",
    "SearchResult",
    "TestResult",
    # Exceptions
    "PactSpecError",
    "PactSpecValidationError",
    "PactSpecAPIError",
    "PactSpecNotFoundError",
    # Spec types
    "PactSpec",
    "PactSpecSkill",
    "PactSpecPricing",
    "PactSpecProvider",
    "PactSpecEndpoint",
    "PactSpecAuth",
    "PactSpecTestSuite",
    "PactSpecExample",
    "PactSpecLinks",
    "PactSpecDelegation",
    "Benchmark",
    "BenchmarkResult",
]
