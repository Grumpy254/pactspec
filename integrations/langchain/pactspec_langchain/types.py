"""Type definitions for the PactSpec LangChain integration."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SkillPricing(BaseModel):
    """Pricing information extracted from a PactSpec skill."""

    model: str = "free"
    amount: float = 0.0
    currency: str = "USD"
    protocol: Optional[str] = None

    @property
    def display(self) -> str:
        """Human-readable pricing string for tool descriptions."""
        if self.model == "free":
            return "Free"
        parts = [f"{self.amount} {self.currency}/{self.model}"]
        if self.protocol and self.protocol != "none":
            parts.append(f"via {self.protocol}")
        return " ".join(parts)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SkillPricing":
        """Parse pricing from a raw PactSpec skill pricing dict."""
        if not data:
            return cls()
        return cls(
            model=data.get("model", "free"),
            amount=data.get("amount", 0.0),
            currency=data.get("currency", "USD"),
            protocol=data.get("protocol"),
        )


class SkillMetadata(BaseModel):
    """Metadata about a PactSpec skill used to construct a LangChain tool."""

    skill_id: str
    skill_name: str
    description: str
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    output_schema: Dict[str, Any] = Field(default_factory=dict)
    pricing: SkillPricing = Field(default_factory=SkillPricing)
    tags: List[str] = Field(default_factory=list)
    examples: List[Dict[str, Any]] = Field(default_factory=list)


class AgentMetadata(BaseModel):
    """Metadata about the parent PactSpec agent for a tool."""

    agent_id: str
    spec_id: str
    name: str
    version: str
    endpoint_url: str
    verified: bool = False
    attestation_hash: Optional[str] = None
    provider_name: str = ""
