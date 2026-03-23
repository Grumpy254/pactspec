"""PactSpec LangChain integration — use PactSpec agents as LangChain tools.

Quick start::

    from pactspec_langchain import PactSpecToolkit

    toolkit = PactSpecToolkit.from_registry(
        query="invoice processing",
        verified_only=True,
        max_price=0.10,
    )
    tools = toolkit.get_tools()
"""

from .toolkit import PactSpecToolkit
from .tools import PactSpecTool
from .types import AgentMetadata, SkillMetadata, SkillPricing

__version__ = "0.1.0"

__all__ = [
    "PactSpecToolkit",
    "PactSpecTool",
    "AgentMetadata",
    "SkillMetadata",
    "SkillPricing",
]
