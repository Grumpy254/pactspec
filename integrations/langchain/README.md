# pactspec-langchain

LangChain integration for [PactSpec](https://pactspec.dev) -- discover and invoke verified AI agents as LangChain tools with automatic pricing awareness.

Each skill in a PactSpec agent becomes a LangChain `BaseTool` with its name, description, input schema, and pricing information derived from the spec. The LLM sees pricing in the tool description and can make cost-aware decisions.

## Installation

```bash
pip install pactspec-langchain
```

## Quick start

```python
from pactspec_langchain import PactSpecToolkit

# Discover verified agents for a task
toolkit = PactSpecToolkit.from_registry(
    query="invoice processing",
    verified_only=True,
    max_price=0.10,
)

# List what was found
for tool in toolkit.get_tools():
    print(f"{tool.name}: {tool.description}")
```

## Using with a LangChain agent

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import create_tool_calling_agent, AgentExecutor
from pactspec_langchain import PactSpecToolkit

# 1. Discover tools from the registry
toolkit = PactSpecToolkit.from_registry(
    query="document analysis",
    verified_only=True,
    max_price=0.25,
)

# 2. Set up the LLM and prompt
llm = ChatOpenAI(model="gpt-4o")
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant. Use the available tools to help the user. "
               "Pay attention to tool costs and prefer cheaper options when quality is similar."),
    ("human", "{input}"),
    MessagesPlaceholder("agent_scratchpad"),
])

# 3. Create the agent
agent = create_tool_calling_agent(llm, toolkit.get_tools(), prompt)
executor = AgentExecutor(agent=agent, tools=toolkit.get_tools(), verbose=True)

# 4. Run it
result = executor.invoke({"input": "Extract line items from this invoice: ..."})
print(result["output"])
```

## Load a specific agent

If you know the exact agent you want, load it by spec ID:

```python
toolkit = PactSpecToolkit.from_agent(
    "urn:pactspec:acme/invoice-agent@1.0.0",
    auth_headers={"Authorization": "Bearer sk-your-api-key"},
)
```

## Filtering

### By price

```python
# Only tools that cost at most $0.05 per invocation
toolkit = PactSpecToolkit.from_registry(
    query="translation",
    max_price=0.05,
)
```

### By pricing model

```python
# Only free tools
toolkit = PactSpecToolkit.from_registry(
    query="summarization",
    pricing_model="free",
)

# Only per-token pricing
toolkit = PactSpecToolkit.from_registry(
    query="summarization",
    pricing_model="per-token",
)
```

### Verified agents only

```python
# Only agents that have passed PactSpec verification
toolkit = PactSpecToolkit.from_registry(
    query="code review",
    verified_only=True,
)
```

### Combining filters

```python
toolkit = PactSpecToolkit.from_registry(
    query="medical coding",
    verified_only=True,
    max_price=0.10,
    pricing_model="per-invocation",
)
```

## How pricing appears in tool descriptions

Each tool's description includes pricing and verification status so the LLM can reason about costs:

```
Extract line items from invoices | Cost: 0.05 USD/per-invocation via stripe | [Verified] | Agent: InvoiceBot v2.1.0
```

For free tools:

```
Summarize text documents | Cost: Free | Agent: SummaryAgent v1.0.0
```

## Authentication

Pass headers for authenticated agent endpoints:

```python
toolkit = PactSpecToolkit.from_registry(
    query="invoice processing",
    auth_headers={
        "Authorization": "Bearer sk-your-key",
        "X-API-Key": "your-api-key",
    },
)
```

## Using pre-fetched agents

If you've already fetched agents via the PactSpec Python SDK, avoid a second network call:

```python
from pactspec import PactSpecClient
from pactspec_langchain import PactSpecToolkit

client = PactSpecClient()
result = client.search(q="translation", verified_only=True)

# Pass agent records directly
toolkit = PactSpecToolkit.from_agents(
    result.agents,
    max_price=0.10,
)
```

## API reference

### `PactSpecToolkit`

| Method | Description |
|--------|-------------|
| `from_registry(query, ...)` | Search the registry and create tools from matching agents |
| `from_agent(spec_id, ...)` | Create tools from a specific agent by spec ID or UUID |
| `from_agents(agents, ...)` | Create tools from pre-fetched `AgentRecord` objects |
| `get_tools()` | Return all tools (standard LangChain toolkit interface) |
| `get_tool(name)` | Look up a single tool by name |
| `tool_names` | List of all tool names |

### `PactSpecTool`

Extends `langchain_core.tools.BaseTool`. Each instance wraps a single PactSpec agent skill.

| Attribute | Description |
|-----------|-------------|
| `agent_meta` | `AgentMetadata` with agent ID, endpoint, verified status |
| `skill_meta` | `SkillMetadata` with skill ID, description, pricing, input schema |
| `timeout` | HTTP timeout in seconds (default: 30) |
| `auth_headers` | Extra headers sent with every invocation |

## License

MIT
