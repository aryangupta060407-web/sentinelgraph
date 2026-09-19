# SentinelGraph agentic backend

SentinelGraph now exposes `POST /api/cases/:caseId/investigate` and `GET /api/health`. The frontend calls the investigation endpoint when an analyst selects **Run investigation**. The backend opens a case, selects graph tools, gathers bounded evidence, retrieves historical memory, assesses confidence, requests step-up evidence when uncertainty crosses the threshold, reassesses, applies deterministic policy gates, and writes the case back when a live TigerGraph adapter is configured.

## Local setup

```bash
pnpm install
cp .env.template .env
pnpm run check
pnpm run build
pnpm run dev
curl -X POST http://localhost:3000/api/cases/HHG-004/investigate \
  -H 'content-type: application/json' \
  -d '{"trigger":"customer_report"}'
```

The checked-in `DEMO_MODE` path is deterministic and uses the official benchmark case JSON only as a reference adapter. It is deliberately labeled `demo_adapter`; it never claims that a case was written to TigerGraph. This keeps the public demo reliable while making the live integration boundary explicit.

## Live TigerGraph

Set `TIGERGRAPH_HOST`, `TIGERGRAPH_GRAPH`, and `TIGERGRAPH_TOKEN` in the runtime environment. The backend then calls RESTPP query endpoints named `transaction_context`, `customer_history`, `connected_entities`, `device_investigation`, `similar_cases`, `fraud_pattern_detection`, and `write_case`. Install `gsql/fraud_graph.gsql` and load the transformed HHGOA tables before running the API. The API reports `graph_mode: tigergraph-rest` only when the host is configured.

For an MCP gateway, set `TIGERGRAPH_MCP_URL`, `TIGERGRAPH_MCP_TOKEN`, and `TIGERGRAPH_MCP_TIMEOUT_MS`. The MCP tool contract is documented in `gsql/tigergraph_mcp_tools.md`; secrets must be injected by the deployment environment and must not be committed.

## Policy and GraphRAG controls

Policy routing is deterministic and runs after evidence retrieval. The model, if added later, can summarize the bounded evidence ledger but cannot bypass `policyGate`. Protected actions (`BLOCK_CARD`, `BLOCK_ACCOUNT`, `BLOCK_TRANSACTION`, `FILE_REPORT`, and `CLOSE_CASE`) remain approval-gated. Each trace item includes its source query and entity references so the analyst can audit the explanation.
