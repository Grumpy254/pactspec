from typing import Any, Dict, List, Literal, Optional
try:
    from typing import TypedDict
except ImportError:
    from typing_extensions import TypedDict


class PactSpecPricing(TypedDict, total=False):
    model: Literal["per-invocation", "per-token", "per-second", "free"]
    amount: float
    currency: Literal["USD", "USDC", "SOL"]
    protocol: Literal["x402", "stripe", "none"]


class PactSpecSLA(TypedDict, total=False):
    p50LatencyMs: int
    p99LatencyMs: int
    uptimeSLA: float
    maxConcurrency: int


class PactSpecSkill(TypedDict, total=False):
    id: str
    name: str
    description: str
    tags: List[str]
    inputSchema: Dict[str, Any]
    outputSchema: Dict[str, Any]
    pricing: PactSpecPricing
    sla: PactSpecSLA
    testSuite: Dict[str, str]
    examples: List[Dict[str, Any]]


class PactSpec(TypedDict, total=False):
    specVersion: Literal["1.0.0"]
    id: str
    name: str
    version: str
    description: str
    provider: Dict[str, Any]
    endpoint: Dict[str, Any]
    skills: List[PactSpecSkill]
    tags: List[str]
    license: str
    links: Dict[str, str]
