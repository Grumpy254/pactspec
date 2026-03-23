"""CrewAI tool wrappers for PactSpec agents.

Each PactSpec skill becomes a CrewAI BaseTool. The PactSpecTools class
provides discovery helpers to search the registry and load agents.
"""

from __future__ import annotations

import json
from typing import Any, Optional

import httpx
from crewai.tools import BaseTool
from pactspec.client import get_agent, search, AgentRecord
from pydantic import Field


DEFAULT_REGISTRY = "https://pactspec.dev"


class PactSpecTool(BaseTool):
    """A CrewAI tool backed by a single PactSpec agent skill.

    Sends the agent's input as a JSON POST to the skill endpoint
    and returns the response text.
    """

    name: str
    description: str
    endpoint: str = Field(exclude=True)
    skill_id: str = Field(exclude=True)
    auth_header: Optional[str] = Field(default=None, exclude=True)
    auth_value: Optional[str] = Field(default=None, exclude=True)

    def _run(self, input_text: str) -> str:
        """Execute the tool by calling the PactSpec agent endpoint.

        Args:
            input_text: A string that is either valid JSON or plain text.
                If valid JSON, it is sent as-is. Otherwise it is wrapped
                as ``{"input": "<text>"}``.

        Returns:
            The response body as a string.
        """
        try:
            body = json.loads(input_text)
        except (json.JSONDecodeError, TypeError):
            body = {"input": input_text}

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.auth_header and self.auth_value:
            headers[self.auth_header] = self.auth_value

        response = httpx.post(self.endpoint, json=body, headers=headers, timeout=30.0)

        if response.status_code == 402:
            return f"Payment required: {response.text}"
        response.raise_for_status()
        return response.text


def _build_tools_from_agent(
    agent: AgentRecord,
    max_price: float | None = None,
) -> list[PactSpecTool]:
    """Convert an AgentRecord into a list of PactSpecTool instances (one per skill)."""
    tools: list[PactSpecTool] = []
    spec: dict[str, Any] = agent.spec
    base_url: str = spec.get("endpoint", {}).get("url", agent.endpoint_url)

    for skill in spec.get("skills", []):
        # Apply price filter if requested
        if max_price is not None:
            pricing = skill.get("pricing", {})
            amount = pricing.get("amount")
            if amount is not None and amount > max_price:
                continue

        skill_id: str = skill.get("id", "")
        skill_name: str = skill.get("name", skill_id)
        skill_desc: str = skill.get("description", "")

        # Build a helpful description that includes the agent context
        description = f"[{agent.name}] {skill_desc}"
        if agent.verified:
            description = f"[Verified] {description}"

        # Determine the endpoint — use skill-level path if present
        endpoint = f"{base_url.rstrip('/')}"

        tools.append(
            PactSpecTool(
                name=f"pactspec_{agent.spec_id.replace(':', '_').replace('/', '_')}_{skill_id}",
                description=description,
                endpoint=endpoint,
                skill_id=skill_id,
            )
        )

    return tools


class PactSpecTools:
    """Discover PactSpec agents and create CrewAI tools.

    Use ``from_registry`` to search for agents or ``from_agent`` to load
    a specific agent by its spec ID or UUID.

    Example::

        tools = PactSpecTools.from_registry(query="medical coding", verified_only=True)
        agent = Agent(role="Coder", goal="Assign ICD-11 codes", tools=tools.get_tools())
    """

    def __init__(self, tools: list[PactSpecTool]) -> None:
        self._tools = tools

    @classmethod
    def from_registry(
        cls,
        query: str = "",
        verified_only: bool = False,
        max_price: float | None = None,
        limit: int = 20,
        registry: str = DEFAULT_REGISTRY,
    ) -> PactSpecTools:
        """Search the PactSpec registry and build tools from matching agents.

        Args:
            query: Free-text search query (e.g. "medical coding").
            verified_only: If True, only include verified agents.
            max_price: Maximum price per invocation. Skills above this are excluded.
            limit: Maximum number of agents to fetch.
            registry: PactSpec registry URL.

        Returns:
            A PactSpecTools instance containing one tool per matching skill.
        """
        result = search(
            q=query or None,
            verified_only=verified_only,
            limit=limit,
            registry=registry,
        )

        tools: list[PactSpecTool] = []
        for agent in result.agents:
            tools.extend(_build_tools_from_agent(agent, max_price=max_price))

        return cls(tools)

    @classmethod
    def from_agent(
        cls,
        spec_id: str,
        max_price: float | None = None,
        registry: str = DEFAULT_REGISTRY,
    ) -> PactSpecTools:
        """Load a specific agent and build tools from its skills.

        Args:
            spec_id: Registry UUID or spec URN (e.g. "pactspec:acme/medical-coder@1.0.0").
            max_price: Maximum price per invocation. Skills above this are excluded.
            registry: PactSpec registry URL.

        Returns:
            A PactSpecTools instance containing one tool per skill.
        """
        agent = get_agent(spec_id, registry=registry)
        tools = _build_tools_from_agent(agent, max_price=max_price)
        return cls(tools)

    def get_tools(self) -> list[PactSpecTool]:
        """Return the list of CrewAI tools."""
        return list(self._tools)

    def filter(
        self,
        name_contains: str | None = None,
        verified_only: bool = False,
    ) -> PactSpecTools:
        """Return a new PactSpecTools with a filtered subset of tools.

        Args:
            name_contains: Only include tools whose name contains this substring.
            verified_only: Only include tools from verified agents.

        Returns:
            A new PactSpecTools instance with the filtered tools.
        """
        filtered = self._tools
        if name_contains:
            filtered = [t for t in filtered if name_contains.lower() in t.name.lower()]
        if verified_only:
            filtered = [t for t in filtered if "[Verified]" in t.description]
        return PactSpecTools(filtered)

    def __len__(self) -> int:
        return len(self._tools)

    def __repr__(self) -> str:
        return f"PactSpecTools({len(self._tools)} tools)"
