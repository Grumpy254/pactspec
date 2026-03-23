"""PactSpec registry client — publish, verify, and search agent specs."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

from .validate import validate, ValidateResult

DEFAULT_REGISTRY = "https://pactspec.dev"
DEFAULT_TIMEOUT = 30


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class PactSpecError(Exception):
    """Base exception for all PactSpec SDK errors."""

    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[List[str]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or []


class PactSpecValidationError(PactSpecError):
    """Raised when a spec fails local schema validation."""

    pass


class PactSpecAPIError(PactSpecError):
    """Raised when the PactSpec registry API returns an error."""

    pass


class PactSpecNotFoundError(PactSpecAPIError):
    """Raised when a requested agent is not found in the registry."""

    pass


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------


@dataclass
class PublishResult:
    """Result of publishing a spec to the registry."""

    id: str
    spec_id: str
    verified: bool


@dataclass
class TestResult:
    """Result of a single test within a verification run."""

    test_id: str
    passed: bool
    duration_ms: int
    error: Optional[str] = None
    status_code: Optional[int] = None


@dataclass
class VerifyResult:
    """Result of a skill verification run."""

    run_id: str
    status: str  # PASSED | FAILED | ERROR
    results: List[TestResult] = field(default_factory=list)
    attestation_hash: Optional[str] = None
    duration_ms: int = 0
    error: Optional[str] = None


@dataclass
class AgentRecord:
    """An agent record as stored in the registry."""

    id: str
    spec_id: str
    name: str
    version: str
    description: Optional[str]
    provider_name: str
    endpoint_url: str
    spec: Dict[str, Any]
    tags: List[str]
    verified: bool
    attestation_hash: Optional[str]
    verified_at: Optional[str]
    published_at: str


@dataclass
class SearchResult:
    """Paginated search results from the registry."""

    agents: List[AgentRecord]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse_agent(data: Dict[str, Any]) -> AgentRecord:
    """Parse a raw API response dict into an AgentRecord."""
    return AgentRecord(
        id=data["id"],
        spec_id=data["spec_id"],
        name=data["name"],
        version=data["version"],
        description=data.get("description"),
        provider_name=data["provider_name"],
        endpoint_url=data["endpoint_url"],
        spec=data["spec"],
        tags=data.get("tags", []),
        verified=data.get("verified", False),
        attestation_hash=data.get("attestation_hash"),
        verified_at=data.get("verified_at"),
        published_at=data["published_at"],
    )


def _raise_api_error(res: httpx.Response, fallback_message: str) -> None:
    """Extract error info from an API response and raise PactSpecAPIError."""
    try:
        data = res.json()
    except Exception:
        raise PactSpecAPIError(fallback_message, status_code=res.status_code)

    msg = data.get("error", fallback_message)
    details = data.get("errors", [])
    if res.status_code == 404:
        raise PactSpecNotFoundError(msg, status_code=404, details=details)
    raise PactSpecAPIError(
        f"{msg}{': ' + '; '.join(details) if details else ''}",
        status_code=res.status_code,
        details=details,
    )


# ---------------------------------------------------------------------------
# Module-level convenience functions
# ---------------------------------------------------------------------------


def publish(
    spec: Dict[str, Any],
    agent_id: str,
    registry: str = DEFAULT_REGISTRY,
    publish_token: Optional[str] = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> PublishResult:
    """Publish a PactSpec to the registry.

    Validates the spec locally before sending.

    Args:
        spec: The PactSpec document as a dict.
        agent_id: Your agent identifier (X-Agent-ID header). Min 4 chars.
        registry: Registry base URL. Defaults to https://pactspec.dev.
        publish_token: Optional bearer token for authenticated publishing.
        timeout: HTTP request timeout in seconds.

    Returns:
        PublishResult with the registry UUID, spec URN, and verified status.

    Raises:
        PactSpecValidationError: If the spec fails local schema validation.
        PactSpecAPIError: If the registry returns an error.

    Example::

        result = publish(my_spec, agent_id="my-agent@acme.com")
        print(result.id)
    """
    result = validate(spec)
    if not result.valid:
        raise PactSpecValidationError(
            f"Invalid PactSpec: {'; '.join(result.errors)}",
            details=result.errors,
        )

    headers: Dict[str, str] = {
        "X-Agent-ID": agent_id,
        "Content-Type": "application/json",
    }
    if publish_token:
        headers["Authorization"] = f"Bearer {publish_token}"

    with httpx.Client(timeout=timeout) as client:
        res = client.post(f"{registry}/api/agents", json=spec, headers=headers)

    if not res.is_success:
        _raise_api_error(res, f"Publish failed (HTTP {res.status_code})")

    data = res.json()
    if "agent" not in data:
        _raise_api_error(res, "Publish failed: unexpected response format")

    agent = data["agent"]
    return PublishResult(
        id=agent["id"],
        spec_id=agent["spec_id"],
        verified=agent.get("verified", False),
    )


def verify(
    agent_id: str,
    skill_id: str,
    registry: str = DEFAULT_REGISTRY,
    timeout: float = 120,
) -> VerifyResult:
    """Trigger a validation run for a skill on a published agent.

    Args:
        agent_id: Registry UUID or spec URN of the agent.
        skill_id: The skill ID to validate.
        registry: Registry base URL. Defaults to https://pactspec.dev.
        timeout: HTTP request timeout in seconds. Defaults to 120 for long-running validations.

    Returns:
        VerifyResult with status, per-test results, and attestation hash if passed.

    Raises:
        PactSpecAPIError: If the registry returns an error.
    """
    with httpx.Client(timeout=timeout) as client:
        res = client.post(
            f"{registry}/api/agents/{agent_id}/validate",
            json={"skillId": skill_id},
            headers={"Content-Type": "application/json"},
        )

    if not res.is_success:
        _raise_api_error(res, f"Verify failed (HTTP {res.status_code})")

    data = res.json()
    return VerifyResult(
        run_id=data.get("runId", ""),
        status=data.get("status", "ERROR"),
        results=[
            TestResult(
                test_id=r["testId"],
                passed=r["passed"],
                duration_ms=r["durationMs"],
                error=r.get("error"),
                status_code=r.get("statusCode"),
            )
            for r in data.get("results", [])
        ],
        attestation_hash=data.get("attestationHash"),
        duration_ms=data.get("durationMs", 0),
        error=data.get("error"),
    )


def get_agent(
    agent_id: str,
    registry: str = DEFAULT_REGISTRY,
    timeout: float = DEFAULT_TIMEOUT,
) -> AgentRecord:
    """Fetch a single agent from the registry by UUID or spec URN.

    Args:
        agent_id: Registry UUID or spec URN.
        registry: Registry base URL.
        timeout: HTTP request timeout in seconds.

    Returns:
        AgentRecord with the agent's full details.

    Raises:
        PactSpecNotFoundError: If the agent does not exist.
        PactSpecAPIError: On other API errors.
    """
    with httpx.Client(timeout=timeout) as client:
        res = client.get(f"{registry}/api/agents/{agent_id}")

    if not res.is_success:
        _raise_api_error(res, f"Agent not found: {agent_id}")

    data = res.json()
    if "agent" not in data:
        raise PactSpecAPIError(f"Agent not found: {agent_id}", status_code=res.status_code)
    return _parse_agent(data["agent"])


def search(
    q: Optional[str] = None,
    verified_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    registry: str = DEFAULT_REGISTRY,
    timeout: float = DEFAULT_TIMEOUT,
) -> SearchResult:
    """Search the PactSpec registry.

    Args:
        q: Free-text search query.
        verified_only: If True, only return verified agents.
        limit: Maximum number of results (1-100).
        offset: Pagination offset.
        registry: Registry base URL.
        timeout: HTTP request timeout in seconds.

    Returns:
        SearchResult with matching agents and pagination metadata.

    Raises:
        PactSpecAPIError: If the registry returns an error.
    """
    params: Dict[str, Any] = {"limit": limit, "offset": offset}
    if q:
        params["q"] = q
    if verified_only:
        params["verified"] = "true"

    with httpx.Client(timeout=timeout) as client:
        res = client.get(f"{registry}/api/agents", params=params)

    if not res.is_success:
        _raise_api_error(res, f"Search failed (HTTP {res.status_code})")

    data = res.json()
    return SearchResult(
        agents=[_parse_agent(a) for a in data.get("agents", [])],
        total=data.get("total", 0),
        limit=data.get("limit", limit),
        offset=data.get("offset", offset),
    )


# ---------------------------------------------------------------------------
# OOP Client
# ---------------------------------------------------------------------------


class PactSpecClient:
    """Object-oriented client for the PactSpec registry.

    Holds default configuration (agent_id, registry URL, publish token)
    so you don't have to pass them on every call.

    Example::

        client = PactSpecClient(agent_id="my-agent@acme.com")
        result = client.publish(my_spec)
        verification = client.verify(result.id, "my-skill")
    """

    def __init__(
        self,
        agent_id: Optional[str] = None,
        registry: str = DEFAULT_REGISTRY,
        publish_token: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        """Initialise the client.

        Args:
            agent_id: Default agent identifier for publish calls.
            registry: Registry base URL. Defaults to https://pactspec.dev.
            publish_token: Optional bearer token for authenticated publishing.
            timeout: Default HTTP timeout in seconds.
        """
        self.agent_id = agent_id
        self.registry = registry
        self.publish_token = publish_token
        self.timeout = timeout

    def validate(self, spec: Any) -> ValidateResult:
        """Validate a spec locally against the PactSpec v1 JSON schema.

        Args:
            spec: The spec document as a dict.

        Returns:
            ValidateResult with ``valid`` flag and ``errors`` list.
        """
        return validate(spec)

    def publish(
        self,
        spec: Dict[str, Any],
        agent_id: Optional[str] = None,
        publish_token: Optional[str] = None,
    ) -> PublishResult:
        """Publish a spec to the registry.

        Args:
            spec: The PactSpec document as a dict.
            agent_id: Override the default agent_id for this call.
            publish_token: Override the default publish_token for this call.

        Returns:
            PublishResult with registry id, spec_id, and verified status.

        Raises:
            ValueError: If no agent_id is available.
            PactSpecValidationError: If the spec is invalid.
            PactSpecAPIError: On registry errors.
        """
        aid = agent_id or self.agent_id
        if not aid:
            raise ValueError("agent_id is required — pass it to PactSpecClient() or to publish()")
        token = publish_token or self.publish_token
        return publish(spec, agent_id=aid, registry=self.registry, publish_token=token, timeout=self.timeout)

    def verify(self, agent_id: str, skill_id: str) -> VerifyResult:
        """Trigger a verification run for a skill.

        Args:
            agent_id: Registry UUID or spec URN of the agent.
            skill_id: The skill ID to validate.

        Returns:
            VerifyResult with status and per-test results.

        Raises:
            PactSpecAPIError: On registry errors.
        """
        return verify(agent_id, skill_id, registry=self.registry, timeout=max(self.timeout, 120))

    def get_agent(self, agent_id: str) -> AgentRecord:
        """Fetch a single agent from the registry.

        Args:
            agent_id: Registry UUID or spec URN.

        Returns:
            AgentRecord with the agent's full details.

        Raises:
            PactSpecNotFoundError: If the agent does not exist.
            PactSpecAPIError: On other API errors.
        """
        return get_agent(agent_id, registry=self.registry, timeout=self.timeout)

    def search(
        self,
        q: Optional[str] = None,
        verified_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> SearchResult:
        """Search the registry for agents.

        Args:
            q: Free-text search query.
            verified_only: If True, only return verified agents.
            limit: Maximum number of results.
            offset: Pagination offset.

        Returns:
            SearchResult with matching agents and pagination metadata.

        Raises:
            PactSpecAPIError: On registry errors.
        """
        return search(
            q=q,
            verified_only=verified_only,
            limit=limit,
            offset=offset,
            registry=self.registry,
            timeout=self.timeout,
        )
