from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

from .validate import validate

DEFAULT_REGISTRY = "https://pactspec.dev"


@dataclass
class PublishResult:
    id: str
    spec_id: str
    verified: bool


@dataclass
class TestResult:
    test_id: str
    passed: bool
    duration_ms: int
    error: Optional[str] = None
    status_code: Optional[int] = None


@dataclass
class VerifyResult:
    run_id: str
    status: str  # PASSED | FAILED | ERROR
    results: List[TestResult] = field(default_factory=list)
    attestation_hash: Optional[str] = None
    duration_ms: int = 0
    error: Optional[str] = None


@dataclass
class AgentRecord:
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
    agents: List[AgentRecord]
    total: int
    limit: int
    offset: int


def _parse_agent(data: Dict[str, Any]) -> AgentRecord:
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


def publish(spec: Dict[str, Any], agent_id: str, registry: str = DEFAULT_REGISTRY) -> PublishResult:
    """Publish a PactSpec to the registry.

    Validates the spec locally before sending. Raises ValueError on invalid spec,
    raises httpx.HTTPStatusError on API errors.

    Args:
        spec: The PactSpec document as a dict.
        agent_id: Your agent identifier (X-Agent-ID header). Min 4 chars.
        registry: Registry base URL. Defaults to https://pactspec.dev.

    Returns:
        PublishResult with the registry UUID, spec URN, and verified status.

    Example:
        result = publish(my_spec, agent_id="my-agent@acme.com")
        print(result.id)
    """
    result = validate(spec)
    if not result.valid:
        raise ValueError(f"Invalid PactSpec: {'; '.join(result.errors)}")

    with httpx.Client(timeout=30) as client:
        res = client.post(
            f"{registry}/api/agents",
            json=spec,
            headers={"X-Agent-ID": agent_id, "Content-Type": "application/json"},
        )

    data = res.json()
    if not res.is_success or "agent" not in data:
        msg = data.get("error", f"Publish failed (HTTP {res.status_code})")
        errors = data.get("errors", [])
        detail = f": {'; '.join(errors)}" if errors else ""
        raise httpx.HTTPStatusError(f"{msg}{detail}", request=res.request, response=res)

    agent = data["agent"]
    return PublishResult(id=agent["id"], spec_id=agent["spec_id"], verified=agent.get("verified", False))


def verify(agent_id: str, skill_id: str, registry: str = DEFAULT_REGISTRY) -> VerifyResult:
    """Trigger a validation run for a skill on a published agent.

    Args:
        agent_id: Registry UUID or spec URN of the agent.
        skill_id: The skill ID to validate.
        registry: Registry base URL. Defaults to https://pactspec.dev.

    Returns:
        VerifyResult with status, per-test results, and attestation hash if passed.
    """
    with httpx.Client(timeout=120) as client:
        res = client.post(
            f"{registry}/api/agents/{agent_id}/validate",
            json={"skillId": skill_id},
            headers={"Content-Type": "application/json"},
        )

    data = res.json()
    if not res.is_success:
        raise httpx.HTTPStatusError(
            data.get("error", f"Verify failed (HTTP {res.status_code})"),
            request=res.request,
            response=res,
        )

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


def get_agent(agent_id: str, registry: str = DEFAULT_REGISTRY) -> AgentRecord:
    """Fetch a single agent from the registry by UUID or spec URN."""
    with httpx.Client(timeout=15) as client:
        res = client.get(f"{registry}/api/agents/{agent_id}")

    data = res.json()
    if not res.is_success or "agent" not in data:
        raise httpx.HTTPStatusError(
            data.get("error", f"Agent not found: {agent_id}"),
            request=res.request,
            response=res,
        )
    return _parse_agent(data["agent"])


def search(
    q: Optional[str] = None,
    verified_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    registry: str = DEFAULT_REGISTRY,
) -> SearchResult:
    """Search the PactSpec registry."""
    params: Dict[str, Any] = {"limit": limit, "offset": offset}
    if q:
        params["q"] = q
    if verified_only:
        params["verified"] = "true"

    with httpx.Client(timeout=15) as client:
        res = client.get(f"{registry}/api/agents", params=params)

    data = res.json()
    if not res.is_success:
        raise httpx.HTTPStatusError(
            data.get("error", f"Search failed (HTTP {res.status_code})"),
            request=res.request,
            response=res,
        )

    return SearchResult(
        agents=[_parse_agent(a) for a in data.get("agents", [])],
        total=data.get("total", 0),
        limit=data.get("limit", limit),
        offset=data.get("offset", offset),
    )


class PactSpecClient:
    """Convenience class for those who prefer an OOP interface.

    Example:
        client = PactSpecClient(agent_id="my-agent@acme.com")
        result = client.publish(my_spec)
        verification = client.verify(result.id, "my-skill")
    """

    def __init__(self, agent_id: Optional[str] = None, registry: str = DEFAULT_REGISTRY):
        self.agent_id = agent_id
        self.registry = registry

    def validate(self, spec: Any):
        from .validate import validate as _validate
        return _validate(spec)

    def publish(self, spec: Dict[str, Any], agent_id: Optional[str] = None) -> PublishResult:
        aid = agent_id or self.agent_id
        if not aid:
            raise ValueError("agent_id is required")
        return publish(spec, agent_id=aid, registry=self.registry)

    def verify(self, agent_id: str, skill_id: str) -> VerifyResult:
        return verify(agent_id, skill_id, registry=self.registry)

    def get_agent(self, agent_id: str) -> AgentRecord:
        return get_agent(agent_id, registry=self.registry)

    def search(self, q: Optional[str] = None, verified_only: bool = False,
               limit: int = 50, offset: int = 0) -> SearchResult:
        return search(q=q, verified_only=verified_only, limit=limit,
                      offset=offset, registry=self.registry)
