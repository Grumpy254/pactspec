"""PactSpec LangChain toolkit — discover agents from the registry and use them as tools."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence

from pactspec import PactSpecClient, AgentRecord

from .tools import PactSpecTool
from .types import AgentMetadata, SkillMetadata, SkillPricing

logger = logging.getLogger(__name__)


def _extract_tools_from_agent(
    agent: AgentRecord,
    *,
    max_price: Optional[float] = None,
    pricing_model: Optional[str] = None,
    auth_headers: Optional[Dict[str, str]] = None,
    timeout: float = 30.0,
) -> List[PactSpecTool]:
    """Extract PactSpecTool instances from a single AgentRecord.

    Applies pricing / model filters at the skill level.
    """
    spec = agent.spec or {}
    skills: List[Dict[str, Any]] = spec.get("skills", [])

    agent_meta = AgentMetadata(
        agent_id=agent.id,
        spec_id=agent.spec_id,
        name=agent.name,
        version=agent.version,
        endpoint_url=agent.endpoint_url,
        verified=agent.verified,
        attestation_hash=agent.attestation_hash,
        provider_name=agent.provider_name,
    )

    tools: List[PactSpecTool] = []
    for skill in skills:
        pricing_raw = skill.get("pricing", {})
        pricing = SkillPricing.from_dict(pricing_raw)

        # --- filters ---
        if pricing_model is not None and pricing.model != pricing_model:
            continue

        if max_price is not None and pricing.model != "free":
            if pricing.amount > max_price:
                logger.debug(
                    "Skipping skill %s: price %.4f > max_price %.4f",
                    skill.get("id"),
                    pricing.amount,
                    max_price,
                )
                continue

        skill_meta = SkillMetadata(
            skill_id=skill.get("id", skill.get("name", "unknown")),
            skill_name=skill.get("name", skill.get("id", "")),
            description=skill.get("description", ""),
            input_schema=skill.get("inputSchema", {}),
            output_schema=skill.get("outputSchema", {}),
            pricing=pricing,
            tags=skill.get("tags", []),
            examples=skill.get("examples", []),
        )

        tool = PactSpecTool(
            agent_meta=agent_meta,
            skill_meta=skill_meta,
            timeout=timeout,
            auth_headers=auth_headers or {},
        )
        tools.append(tool)

    return tools


class PactSpecToolkit:
    """Discover PactSpec agents from the registry and expose them as LangChain tools.

    Usage::

        from pactspec_langchain import PactSpecToolkit

        toolkit = PactSpecToolkit.from_registry(
            query="invoice processing",
            verified_only=True,
            max_price=0.10,
        )
        tools = toolkit.get_tools()

    Each skill in each matched agent becomes a separate :class:`PactSpecTool`.
    Pricing information is embedded in the tool description so the LLM can make
    cost-aware decisions.
    """

    def __init__(self, tools: List[PactSpecTool]) -> None:
        self._tools = list(tools)

    # ------------------------------------------------------------------
    # Factory: search the registry
    # ------------------------------------------------------------------

    @classmethod
    def from_registry(
        cls,
        query: str = "",
        *,
        verified_only: bool = False,
        max_price: Optional[float] = None,
        pricing_model: Optional[str] = None,
        registry: str = "https://pactspec.dev",
        limit: int = 10,
        auth_headers: Optional[Dict[str, str]] = None,
        timeout: float = 30.0,
    ) -> "PactSpecToolkit":
        """Search the PactSpec registry and build tools from matching agents.

        Args:
            query: Free-text search query (e.g. ``"invoice processing"``).
            verified_only: Only include agents that have passed verification.
            max_price: Maximum price per invocation — skills above this are excluded.
            pricing_model: Only include skills with this pricing model
                (``"free"``, ``"per-invocation"``, ``"per-token"``, ``"per-second"``).
            registry: PactSpec registry URL.
            limit: Maximum number of agents to fetch.
            auth_headers: Extra HTTP headers to send when invoking agent endpoints
                (e.g. ``{"Authorization": "Bearer sk-..."}``).
            timeout: HTTP timeout in seconds for agent invocations.

        Returns:
            A :class:`PactSpecToolkit` containing one tool per qualifying skill.
        """
        client = PactSpecClient(registry=registry)
        result = client.search(q=query, verified_only=verified_only, limit=limit)

        tools: List[PactSpecTool] = []
        for agent in result.agents:
            tools.extend(
                _extract_tools_from_agent(
                    agent,
                    max_price=max_price,
                    pricing_model=pricing_model,
                    auth_headers=auth_headers,
                    timeout=timeout,
                )
            )

        logger.info(
            "PactSpecToolkit.from_registry: query=%r, found %d agents, %d tools",
            query,
            len(result.agents),
            len(tools),
        )
        return cls(tools)

    # ------------------------------------------------------------------
    # Factory: from a specific agent
    # ------------------------------------------------------------------

    @classmethod
    def from_agent(
        cls,
        spec_id: str,
        *,
        max_price: Optional[float] = None,
        pricing_model: Optional[str] = None,
        registry: str = "https://pactspec.dev",
        auth_headers: Optional[Dict[str, str]] = None,
        timeout: float = 30.0,
    ) -> "PactSpecToolkit":
        """Create tools from a specific agent by its spec ID or registry UUID.

        Args:
            spec_id: The agent's spec URN (e.g. ``"urn:pactspec:acme/invoice-agent@1.0.0"``)
                or registry UUID.
            max_price: Maximum price per invocation.
            pricing_model: Only include skills with this pricing model.
            registry: PactSpec registry URL.
            auth_headers: Extra HTTP headers for agent invocations.
            timeout: HTTP timeout in seconds for agent invocations.

        Returns:
            A :class:`PactSpecToolkit` containing one tool per qualifying skill.
        """
        client = PactSpecClient(registry=registry)
        agent = client.get_agent(spec_id)

        tools = _extract_tools_from_agent(
            agent,
            max_price=max_price,
            pricing_model=pricing_model,
            auth_headers=auth_headers,
            timeout=timeout,
        )

        logger.info(
            "PactSpecToolkit.from_agent: spec_id=%r, %d tools",
            spec_id,
            len(tools),
        )
        return cls(tools)

    # ------------------------------------------------------------------
    # Factory: from raw agent dicts (for advanced use)
    # ------------------------------------------------------------------

    @classmethod
    def from_agents(
        cls,
        agents: Sequence[AgentRecord],
        *,
        max_price: Optional[float] = None,
        pricing_model: Optional[str] = None,
        auth_headers: Optional[Dict[str, str]] = None,
        timeout: float = 30.0,
    ) -> "PactSpecToolkit":
        """Create a toolkit from a pre-fetched list of :class:`AgentRecord` objects.

        This is useful when you've already fetched agents and want to avoid
        a second network call.
        """
        tools: List[PactSpecTool] = []
        for agent in agents:
            tools.extend(
                _extract_tools_from_agent(
                    agent,
                    max_price=max_price,
                    pricing_model=pricing_model,
                    auth_headers=auth_headers,
                    timeout=timeout,
                )
            )
        return cls(tools)

    # ------------------------------------------------------------------
    # Tool access
    # ------------------------------------------------------------------

    def get_tools(self) -> List[PactSpecTool]:
        """Return all tools in the toolkit.

        This is the standard LangChain toolkit interface used by
        ``create_tool_calling_agent`` and similar helpers.
        """
        return list(self._tools)

    def get_tool(self, name: str) -> Optional[PactSpecTool]:
        """Look up a single tool by name.

        Returns ``None`` if no tool with that name exists.
        """
        for tool in self._tools:
            if tool.name == name:
                return tool
        return None

    @property
    def tool_names(self) -> List[str]:
        """List the names of all tools in the toolkit."""
        return [t.name for t in self._tools]

    def __len__(self) -> int:
        return len(self._tools)

    def __repr__(self) -> str:
        return f"PactSpecToolkit(tools={self.tool_names})"
