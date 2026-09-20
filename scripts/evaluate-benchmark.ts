import fs from "node:fs/promises";
import path from "node:path";
import { investigateCase } from "../server/investigation";

const root = path.resolve(process.cwd());
const outputDir = path.join(root, "docs");
const caseIds = Array.from({ length: 20 }, (_, index) => `HHG-${String(index + 1).padStart(3, "0")}`);
const rows: any[] = [];

for (const caseId of caseIds) {
  const result = await investigateCase(caseId, "benchmark_evaluation");
  const agent = result.agent || {};
  const policy = agent.policy || {};
  rows.push({
    case_id: caseId,
    mode: agent.mode,
    llm_enabled: agent.llm_enabled,
    customer_id: agent.customer_id,
    transaction_id: agent.transaction_id,
    pattern: result.case?.pattern,
    verdict: result.case?.verdict,
    initial_probability: agent.initial_probability,
    final_probability: agent.final_probability,
    initial_confidence: agent.initial_confidence,
    final_confidence: agent.final_confidence,
    requested_evidence: agent.requested_evidence,
    final_action: policy.action,
    approval_route: policy.route,
    sar_required: Boolean(result.sar?.file),
    graph_writeback: agent.case_writeback,
    evidence_sources: [...new Set((agent.evidence || []).map((item: any) => item.source))],
    trace_steps: agent.activity_trace?.length || 0,
    explanation: agent.reasoning?.explanation || result.case?.summary,
  });
}

const summary = {
  generated_at: new Date().toISOString(),
  cases: rows.length,
  runtime_mode: rows[0]?.mode,
  llm_enabled: rows.some((row) => row.llm_enabled),
  verdicts: rows.reduce((acc, row) => { acc[row.verdict] = (acc[row.verdict] || 0) + 1; return acc; }, {} as Record<string, number>),
  evidence_request_count: rows.filter((row) => row.requested_evidence.length > 0).length,
  approval_routes: rows.reduce((acc, row) => { acc[row.approval_route] = (acc[row.approval_route] || 0) + 1; return acc; }, {} as Record<string, number>),
  graph_writeback_successes: rows.filter((row) => row.graph_writeback?.written).length,
  rows,
};
await fs.writeFile(path.join(outputDir, "benchmark-agentic-evaluation.json"), JSON.stringify(summary, null, 2));
const lines = ["# Agentic benchmark evaluation", "", `Generated: ${summary.generated_at}`, `Cases evaluated: ${summary.cases}`, `Runtime mode: ${summary.runtime_mode}`, `LLM reasoning enabled in run: ${summary.llm_enabled}`, "", "| Case | Customer | Transaction | Pattern | Verdict | Initial → final confidence | Evidence request | Action | Route | Sources |", "|---|---|---|---|---|---:|---|---|---|---|"];
for (const row of rows) lines.push(`| ${row.case_id} | ${row.customer_id} | ${row.transaction_id} | ${row.pattern} | ${row.verdict} | ${Math.round(row.initial_confidence * 100)}% → ${Math.round(row.final_confidence * 100)}% | ${row.requested_evidence[0]?.type || "none"} | ${row.final_action} | ${row.approval_route} | ${row.evidence_sources.join(", ")} |`);
lines.push("", "## Run interpretation", "", "The report records the bounded evidence sources, agent recommendation, deterministic approval route, evidence request behavior, and case write-back result for every official benchmark case. In demo mode, write-back is intentionally reported as simulated rather than successful. Enable TigerGraph MCP/RESTPP and the LLM provider to produce a live run.");
await fs.writeFile(path.join(outputDir, "benchmark-agentic-evaluation.md"), `${lines.join("\n")}\n`);
console.log(`Evaluated ${rows.length} cases`);
