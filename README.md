# SentinelGraph — Agentic TigerGraph Fraud Investigation

SentinelGraph is the HHGOA Task 4 fraud-investigation experience. The existing analyst console is preserved, while the investigation path now calls a backend agent workflow that gathers bounded graph evidence, retrieves historical memory, handles uncertainty, applies deterministic policy gates, and returns an auditable activity trace.

## What changed

The static benchmark JSON files remain in `client/public/data/cases/` as official reference data. They are no longer the only investigation behavior. The backend in `server/investigation.ts` exposes graph tools through a `GraphTools` contract, uses live TigerGraph RESTPP when configured, and uses a clearly labeled deterministic demo adapter otherwise. A demo adapter never claims a case was written to TigerGraph.

The workflow is: trigger → open case → transaction context → connected entity traversal → device and customer history → similar case memory → pattern detection → confidence assessment → evidence request/reassessment when needed → next-best action → deterministic policy/approval check → case write-back → trace returned to the current UI.

## Run locally

```bash
pnpm install
cp docs/env.template .env # or inject the variables in your deployment environment
pnpm run check
pnpm test
pnpm run dev
```

Then run an investigation:

```bash
curl -X POST http://localhost:3000/api/cases/HHG-004/investigate \
  -H 'content-type: application/json' \
  -d '{"trigger":"customer_report"}'
```

`GET /api/health` reports whether the live TigerGraph adapter is configured. The frontend calls the same endpoint from **Run live investigation** and displays the returned confidence, evidence, memory, action route, write-back status, and activity trace. The static GitHub Pages build remains usable with benchmark reference data when no backend is present.

## TigerGraph and MCP

See `docs/agentic-backend.md`, `gsql/fraud_graph.gsql`, and `gsql/tigergraph_mcp_tools.md`. Configure `TIGERGRAPH_HOST`, `TIGERGRAPH_GRAPH`, and `TIGERGRAPH_TOKEN` for RESTPP. Configure `TIGERGRAPH_MCP_URL` and `TIGERGRAPH_MCP_TOKEN` for the controlled MCP gateway. Do not commit credentials. Load the transformed HHGOA data into the `FraudGraph` schema before enabling live mode.

The policy boundary is deterministic. Protected actions such as blocking a card/account/transaction and filing a report remain approval-gated. Any optional LLM/GraphRAG layer can summarize the bounded evidence ledger, but it cannot bypass policy or receive the full dataset.

## Benchmark compatibility

The official 20 benchmark JSON files are preserved. The backend returns the same case-oriented fields where practical and adds an `agent` envelope containing mode, evidence sources, requested/returned evidence, confidence changes, policy routing, case write-back result, and the activity trace.

## GitHub Pages

The repository’s GitHub Pages workflow builds the frontend with the `/sentinelgraph/` base path. GitHub Pages is a static demo surface; live TigerGraph mode requires the backend deployment described above.
