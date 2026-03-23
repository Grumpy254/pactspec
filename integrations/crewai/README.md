# pactspec-crewai

CrewAI integration for [PactSpec](https://pactspec.dev) — discover and use PactSpec agents as CrewAI tools.

## Installation

```bash
pip install pactspec-crewai
```

## Quick Start

Search the PactSpec registry and get CrewAI-compatible tools in two lines:

```python
from pactspec_crewai import PactSpecTools

tools = PactSpecTools.from_registry(
    query="medical coding",
    verified_only=True,
)

print(f"Found {len(tools)} tools")
for tool in tools.get_tools():
    print(f"  - {tool.name}: {tool.description}")
```

## Full CrewAI Agent Example

```python
from crewai import Agent, Task, Crew
from pactspec_crewai import PactSpecTools

# Discover tools from the registry
tools = PactSpecTools.from_registry(
    query="medical coding",
    verified_only=True,
)

# Create a CrewAI agent with PactSpec tools
coder = Agent(
    role="Medical Coder",
    goal="Assign accurate ICD-11 codes to clinical notes",
    backstory="You are an experienced medical coder who uses specialized AI tools.",
    tools=tools.get_tools(),
)

task = Task(
    description="Assign ICD-11 codes to: 'Patient presents with acute bronchitis and mild fever.'",
    expected_output="A list of ICD-11 codes with descriptions",
    agent=coder,
)

crew = Crew(agents=[coder], tasks=[task])
result = crew.kickoff()
print(result)
```

## Filtering and Pricing

You can filter by price to control costs:

```python
# Only include skills that cost $0.01 or less per invocation
tools = PactSpecTools.from_registry(
    query="translation",
    max_price=0.01,
)

# Further filter after discovery
subset = tools.filter(name_contains="translate", verified_only=True)
```

## Using a Specific Agent

If you know the agent's spec ID or registry UUID, load it directly:

```python
from pactspec_crewai import PactSpecTools

tools = PactSpecTools.from_agent("pactspec:acme/medical-coder@1.0.0")

# Or by registry UUID
tools = PactSpecTools.from_agent("550e8400-e29b-41d4-a716-446655440000")
```

## API Reference

### `PactSpecTools`

| Method | Description |
|---|---|
| `from_registry(query, verified_only, max_price, limit, registry)` | Search the registry and build tools |
| `from_agent(spec_id, max_price, registry)` | Load a specific agent by ID |
| `get_tools()` | Return the list of `PactSpecTool` instances |
| `filter(name_contains, verified_only)` | Return a filtered subset |

### `PactSpecTool`

Extends `crewai.tools.BaseTool`. Each tool wraps a single PactSpec skill.

- **name** — Unique tool name derived from the agent spec ID and skill ID
- **description** — Skill description with agent name and verification badge
- **_run(input_text)** — Sends input as JSON POST to the agent endpoint; parses JSON input or wraps plain text as `{"input": "..."}`

## License

MIT
