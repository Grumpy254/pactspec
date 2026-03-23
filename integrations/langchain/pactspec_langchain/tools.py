"""PactSpec LangChain tool — wraps a single PactSpec agent skill as a LangChain BaseTool."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional, Type

import httpx
from langchain_core.callbacks import (
    AsyncCallbackManagerForToolRun,
    CallbackManagerForToolRun,
)
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field, model_validator

from .types import AgentMetadata, SkillMetadata, SkillPricing

logger = logging.getLogger(__name__)


def _build_pydantic_model_from_json_schema(
    schema: Dict[str, Any],
    model_name: str = "DynamicInput",
) -> Type[BaseModel]:
    """Build a pydantic model from a JSON Schema dict.

    This creates a model with fields derived from the JSON Schema ``properties``.
    For properties without an explicit type we fall back to ``Any``.
    """
    properties = schema.get("properties", {})
    required = set(schema.get("required", []))

    field_definitions: Dict[str, Any] = {}
    annotations: Dict[str, Any] = {}

    type_map = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "array": list,
        "object": dict,
    }

    for prop_name, prop_schema in properties.items():
        json_type = prop_schema.get("type", "string")
        python_type = type_map.get(json_type, Any)
        description = prop_schema.get("description", "")
        default = prop_schema.get("default")

        if prop_name in required and default is None:
            field_definitions[prop_name] = Field(description=description)
        else:
            if python_type is Any:
                annotations[prop_name] = Optional[Any]
            else:
                annotations[prop_name] = Optional[python_type]  # type: ignore[assignment]
            field_definitions[prop_name] = Field(default=default, description=description)

        if prop_name not in annotations:
            annotations[prop_name] = python_type

    namespace: Dict[str, Any] = {"__annotations__": annotations, **field_definitions}
    model = type(model_name, (BaseModel,), namespace)
    return model  # type: ignore[return-value]


class PactSpecTool(BaseTool):
    """A LangChain tool backed by a single PactSpec agent skill.

    Each skill declared in a PactSpec becomes one ``PactSpecTool`` instance.
    The tool name, description, and input schema are derived from the spec,
    and the ``_run`` / ``_arun`` methods invoke the agent endpoint directly.

    Pricing information is appended to the tool description so that the LLM
    can make cost-aware decisions when selecting tools.
    """

    # --- metadata stored on the tool ---
    agent_meta: AgentMetadata
    skill_meta: SkillMetadata

    # --- httpx settings ---
    timeout: float = 30.0
    auth_headers: Dict[str, str] = Field(default_factory=dict)

    # These are set via model_validator from the metadata
    name: str = ""  # type: ignore[assignment]
    description: str = ""

    args_schema: Optional[Type[BaseModel]] = None  # type: ignore[assignment]

    @model_validator(mode="after")
    def _set_derived_fields(self) -> "PactSpecTool":
        # Tool name: use skill_id, sanitised for LangChain (alphanumeric + hyphens/underscores)
        if not self.name:
            self.name = self.skill_meta.skill_id.replace(" ", "_")

        # Build a rich description with pricing and verification status
        if not self.description:
            parts = [self.skill_meta.description or self.skill_meta.skill_name]
            pricing_display = self.skill_meta.pricing.display
            if pricing_display:
                parts.append(f"Cost: {pricing_display}")
            if self.agent_meta.verified:
                parts.append("[Verified]")
            parts.append(f"Agent: {self.agent_meta.name} v{self.agent_meta.version}")
            self.description = " | ".join(parts)

        # Build args_schema from the skill's inputSchema
        if self.args_schema is None and self.skill_meta.input_schema:
            model_name = (
                self.skill_meta.skill_id.replace("-", "_").replace(" ", "_").title().replace("_", "")
                + "Input"
            )
            self.args_schema = _build_pydantic_model_from_json_schema(
                self.skill_meta.input_schema,
                model_name=model_name,
            )

        return self

    # ------------------------------------------------------------------
    # Invocation
    # ------------------------------------------------------------------

    def _build_url(self) -> str:
        """Construct the invocation URL for the agent skill."""
        base = self.agent_meta.endpoint_url.rstrip("/")
        return base

    def _build_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        headers.update(self.auth_headers)
        return headers

    def _handle_response(self, response: httpx.Response) -> str:
        """Process the HTTP response and return a string for the LLM."""
        if response.status_code == 402:
            try:
                detail = response.json()
            except Exception:
                detail = response.text
            return f"Payment required for this agent skill. Details: {detail}"

        response.raise_for_status()

        # Try to return formatted JSON; fall back to raw text
        content_type = response.headers.get("content-type", "")
        if "json" in content_type:
            try:
                return json.dumps(response.json(), indent=2)
            except Exception:
                pass
        return response.text

    def _run(
        self,
        run_manager: Optional[CallbackManagerForToolRun] = None,
        **kwargs: Any,
    ) -> str:
        """Synchronously invoke the PactSpec agent skill."""
        url = self._build_url()
        headers = self._build_headers()
        logger.debug("PactSpecTool %s: POST %s with %s", self.name, url, kwargs)

        response = httpx.post(
            url,
            json=kwargs,
            headers=headers,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    async def _arun(
        self,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
        **kwargs: Any,
    ) -> str:
        """Asynchronously invoke the PactSpec agent skill."""
        url = self._build_url()
        headers = self._build_headers()
        logger.debug("PactSpecTool %s: async POST %s with %s", self.name, url, kwargs)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=kwargs,
                headers=headers,
                timeout=self.timeout,
            )
        return self._handle_response(response)
