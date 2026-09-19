# TigerGraph MCP tool contract

The agent may call only these bounded tools. Each tool returns structured evidence with a query name, claim, entity IDs, and source reference. The policy layer receives the result; the LLM never receives unrestricted database access.

| Tool | Required input | Purpose |
|---|---|---|
| `transaction_context` | `transaction_id` | Amount, timestamp, channel, merchant, risk signal, and transaction attributes |
| `customer_history` | `customer_id` | Bounded customer sequence and account/card relationships |
| `connected_entities` | `transaction_id` | Cards, accounts, devices, IP/connection IDs, merchants, and two-hop links |
| `device_investigation` | `transaction_id` | Device profile and shared-device activity |
| `similar_cases` | `customer_id`, optional `pattern` | Historical cases, outcomes, evidence, and analyst decisions |
| `fraud_pattern_detection` | `transaction_id` | Known pattern matches over the graph neighborhood |
| `write_case` | case state | Investigation record and relationships for future memory retrieval |

## MCP configuration

Use the TigerGraph MCP server URL supplied by the deployment owner. Configure `TIGERGRAPH_MCP_URL` and inject `TIGERGRAPH_MCP_TOKEN` at runtime. Do not commit tokens. If the MCP server is unavailable, the backend uses the RESTPP adapter when `TIGERGRAPH_HOST` is set; otherwise it uses the clearly labeled deterministic demo adapter.

## Evidence boundary

Queries must return only the neighborhood needed for the current case. Do not send the full transaction table to an LLM. Graph evidence, policy snippets, documented fraud patterns, regulatory references, and similar historical cases are combined into a bounded evidence ledger before explanation.
