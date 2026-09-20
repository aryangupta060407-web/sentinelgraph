# SentinelGraph agentic backend

SentinelGraph exposes `POST /api/cases/:caseId/investigate` and `GET /api/health`. The backend opens a case, retrieves minimal initial graph evidence, reasons over a bounded graph-grounded evidence ledger, selects missing evidence tools, reassesses, requests controlled external evidence only when necessary, applies deterministic policy gates, and writes the case back when a live TigerGraph adapter is configured.

## Local setup

```bash
pnpm install
cp docs/env.template .env
pnpm run check
pnpm test
pnpm run benchmark
pnpm run build
pnpm run dev
curl -X POST http://localhost:3000/api/cases/HHG-004/investigate \
  -H 'content-type: application/json' \
  -d '{"trigger":"customer_report"}'
```

The checked-in `demo_adapter` uses the official benchmark case JSON as a deterministic reference adapter. Demo graph calls, evidence-provider responses, and case write-back are explicitly labeled simulated; demo mode never claims a real TigerGraph write.

## Live TigerGraph

Set `TIGERGRAPH_HOST`, `TIGERGRAPH_GRAPH`, and `TIGERGRAPH_TOKEN` for RESTPP, or set `TIGERGRAPH_MCP_URL` and `TIGERGRAPH_MCP_TOKEN` for the controlled MCP JSON-RPC adapter. The backend reports the selected mode as `tigergraph_restpp` or `tigergraph_mcp` only when the corresponding live adapter is configured. Install `gsql/fraud_graph.gsql` and load the transformed HHGOA tables before running the API.

The live `write_case` query persists the investigation case and, where identifiers are available, links it to the flagged transaction and card. It also creates an evidence vertex, case-event vertex, policy-rule vertex, and their relationships. RESTPP reports success only after the query returns successfully; MCP reports the tool result. No live write is claimed after an exception or unavailable provider response.

## LLM reasoning and evidence providers

Set `LLM_REASONING_ENABLED=true`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, and optionally `LLM_MODEL` to enable server-side structured LLM reasoning. The model receives only the bounded current-case ledger, structured graph facts, historical case memory, fraud-pattern context, policy information, and regulatory constraints. The model can recommend an action and select a follow-up tool, but cannot bypass `policyGate`.

Step-up authentication and customer verification use the `EvidenceProvider` interface. With no `EVIDENCE_PROVIDER_URL`, the demo provider returns an explicitly simulated response. With an approved `EVIDENCE_PROVIDER_URL` and token, the live provider calls that integration and marks the result non-simulated; an unconfigured live provider returns unavailable rather than inventing evidence.

## Graph-grounded retrieval controls

This project does not use a vector database. The safe claim is **graph-grounded retrieval / GraphRAG-style reasoning**: TigerGraph/MCP graph retrieval → bounded evidence ledger → relevance context supplied to the model. Historical cases include prior outcome, pattern, action, analyst context, evidence, and relevant entities. Memory can influence the recommendation only as precedent; current evidence and deterministic policy remain authoritative. Trace output records selected tools, memory influence, evidence-provider source, reassessment, stop reason, approval route, and write-back result.

## Policy

Policy routing is deterministic and runs after reasoning. Protected actions (`BLOCK_CARD`, `BLOCK_ACCOUNT`, `BLOCK_TRANSACTION`, `FILE_REPORT`, and `CLOSE_CASE`) remain approval-gated. The LLM cannot mark them as permitted.
