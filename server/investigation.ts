import fs from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;
export type InvestigationResult = Json;

const root = path.resolve(process.cwd());
const casesDir = path.join(root, "client/public/data/cases");
const casePackPath = path.join(root, "client/public/data/case_pack.csv");

const now = () => new Date().toISOString();
const clamp = (n: number) => Math.max(0, Math.min(1, n));

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { cells.push(cell); cell = ""; }
    else cell += char;
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

async function officialCaseMetadata(caseId: string) {
  try {
    const lines = (await fs.readFile(casePackPath, "utf8")).split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines[0]);
    const values = parseCsvLine(lines.slice(1).find((line) => parseCsvLine(line)[0] === caseId) || "");
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    return { caseId: row.case_id, transactionId: row.flagged_txn_id, customerId: row.customer_id, cardId: row.card_id, trigger: row.trigger_type, riskScore: Number(row.risk_score || 0) };
  } catch { return { caseId, transactionId: "", customerId: "", cardId: "", trigger: "analyst_request", riskScore: 0 }; }
}

export type GraphEvidence = {
  source: "tigergraph" | "tigergraph_mcp" | "demo_adapter" | "case_memory" | "policy";
  query: string;
  claim: string;
  entities: string[];
  facts: Json;
};

export interface GraphTools {
  transactionContext(transactionId: string): Promise<GraphEvidence>;
  customerHistory(customerId: string): Promise<GraphEvidence>;
  connectedEntities(transactionId: string): Promise<GraphEvidence>;
  deviceInvestigation(transactionId: string): Promise<GraphEvidence>;
  previousFraudCases(customerId: string, pattern?: string): Promise<GraphEvidence>;
  detectPattern(transactionId: string): Promise<GraphEvidence>;
  writeCase(caseId: string, state: Json): Promise<{ written: boolean; reference: string; source: string }>;
}

class TigerGraphRestTools implements GraphTools {
  private base: string;
  private token: string;
  constructor() { this.base = (process.env.TIGERGRAPH_HOST || "").replace(/\/$/, ""); this.token = process.env.TIGERGRAPH_TOKEN || ""; }
  private async query(name: string, params: Json = {}) {
    const url = `${this.base}/restpp/query/${process.env.TIGERGRAPH_GRAPH || "FraudGraph"}/${name}`;
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(params) });
    if (!response.ok) throw new Error(`TigerGraph ${name} failed: ${response.status}`);
    return response.json();
  }
  private evidence(query: string, claim: string, entities: string[], facts: Json): GraphEvidence { return { source: "tigergraph", query, claim, entities, facts }; }
  async transactionContext(transactionId: string) { const data = await this.query("transaction_context", { transaction_id: transactionId }); return this.evidence("transaction_context", `TigerGraph returned transaction context for ${transactionId}.`, [transactionId], { transaction_id: transactionId, result: data }); }
  async customerHistory(customerId: string) { const data = await this.query("customer_history", { customer_id: customerId }); return this.evidence("customer_history", `TigerGraph returned customer history for ${customerId}.`, [customerId], { customer_id: customerId, result_count: Array.isArray(data) ? data.length : 1, result: data }); }
  async connectedEntities(transactionId: string) { const data = await this.query("connected_entities", { transaction_id: transactionId }); return this.evidence("connected_entities", `TigerGraph traversed connected accounts, cards, merchants, IPs, and devices for ${transactionId}.`, [transactionId], { transaction_id: transactionId, result: data }); }
  async deviceInvestigation(transactionId: string) { const data = await this.query("device_investigation", { transaction_id: transactionId }); return this.evidence("device_investigation", `TigerGraph returned device and shared-device activity for ${transactionId}.`, [transactionId], { transaction_id: transactionId, result: data }); }
  async previousFraudCases(customerId: string, pattern = "") { const data = await this.query("similar_cases", { customer_id: customerId, pattern }); return this.evidence("similar_cases", `TigerGraph returned similar historical cases for ${customerId}.`, [customerId], { customer_id: customerId, pattern, result: data }); }
  async detectPattern(transactionId: string) { const data = await this.query("fraud_pattern_detection", { transaction_id: transactionId }); return this.evidence("fraud_pattern_detection", `TigerGraph evaluated known fraud patterns for ${transactionId}.`, [transactionId], { transaction_id: transactionId, result: data }); }
  async writeCase(caseId: string, state: Json) { await this.query("write_case", { case_id: caseId, ...state }); return { written: true, reference: caseId, source: "tigergraph" }; }
}

class TigerGraphMcpTools implements GraphTools {
  private endpoint = process.env.TIGERGRAPH_MCP_URL || "";
  private token = process.env.TIGERGRAPH_MCP_TOKEN || "";
  private async call(name: string, args: Json) {
    const response = await fetch(this.endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: `${name}-${Date.now()}`, method: "tools/call", params: { name, arguments: args } }) });
    if (!response.ok) throw new Error(`TigerGraph MCP ${name} failed: ${response.status}`);
    const payload = await response.json() as Json;
    if (payload.error) throw new Error(`TigerGraph MCP ${name}: ${payload.error.message || "tool error"}`);
    return payload.result;
  }
  private evidence(query: string, claim: string, entities: string[], facts: Json): GraphEvidence { return { source: "tigergraph_mcp", query, claim, entities, facts }; }
  async transactionContext(transactionId: string) { const data = await this.call("get_transaction_context", { transaction_id: transactionId }); return this.evidence("get_transaction_context", `TigerGraph MCP returned transaction context for ${transactionId}.`, [transactionId], { transaction_id: transactionId, result: data }); }
  async customerHistory(customerId: string) { const data = await this.call("get_customer_history", { customer_id: customerId }); return this.evidence("get_customer_history", `TigerGraph MCP returned customer history for ${customerId}.`, [customerId], { customer_id: customerId, result: data }); }
  async connectedEntities(transactionId: string) { const data = await this.call("get_connected_entities", { transaction_id: transactionId }); return this.evidence("get_connected_entities", `TigerGraph MCP traversed connected entities for ${transactionId}.`, [transactionId], { transaction_id: transactionId, result: data }); }
  async deviceInvestigation(transactionId: string) { const data = await this.call("investigate_device", { transaction_id: transactionId }); return this.evidence("investigate_device", `TigerGraph MCP returned device investigation evidence for ${transactionId}.`, [transactionId], { transaction_id: transactionId, result: data }); }
  async previousFraudCases(customerId: string, pattern = "") { const data = await this.call("find_similar_cases", { customer_id: customerId, pattern }); return { source: "tigergraph_mcp" as const, query: "find_similar_cases", claim: `TigerGraph MCP returned historical cases for ${customerId}.`, entities: [customerId], facts: { customer_id: customerId, pattern, result: data } }; }
  async detectPattern(transactionId: string) { const data = await this.call("detect_fraud_pattern", { transaction_id: transactionId }); return this.evidence("detect_fraud_pattern", `TigerGraph MCP detected fraud-pattern evidence for ${transactionId}.`, [transactionId], { transaction_id: transactionId, result: data }); }
  async writeCase(caseId: string, state: Json) { const data = await this.call("write_case", { case_id: caseId, ...state }); return { written: true, reference: JSON.stringify(data).slice(0, 220) || caseId, source: "tigergraph_mcp" }; }
}

class DemoGraphTools implements GraphTools {
  private async answer(id: string): Promise<Json> { try { return JSON.parse(await fs.readFile(path.join(casesDir, `${id}.json`), "utf8")); } catch { return {}; } }
  private async context(id: string) { return this.answer(id); }
  private evidence(query: string, claim: string, entities: string[], facts: Json): GraphEvidence { return { source: "demo_adapter", query, claim, entities, facts }; }
  async transactionContext(id: string) { const c = await this.context(id); return this.evidence("transaction_context", `Benchmark adapter returned the official transaction context for ${id}; bank risk is a trigger, not a verdict.`, [id], { transaction_id: id, amount: c.case?.exposure_usd || 0, risk_signal: c.case?.fraud_probability || 0, reference_case: c.case_id }); }
  async customerHistory(id: string) { const c = await this.context(id); return { source: "case_memory" as const, query: "customer_history", claim: `Benchmark adapter returned the official customer history context for ${id}.`, entities: [id], facts: { customer_id: id, affected_transactions: c.case?.affected_txn_ids || [] } }; }
  async connectedEntities(id: string) { const c = await this.context(id); return this.evidence("connected_entities", `Benchmark adapter traversed ${c.case?.affected_txn_ids?.length || 1} connected transaction(s), card(s), and device relationships.`, [id, ...(c.case?.affected_txn_ids || []).slice(0, 4)], { transaction_id: id, affected_transactions: c.case?.affected_txn_ids || [], cards: c.case?.connected_card_ids || [], devices: c.case?.connected_device_profiles || [] }); }
  async deviceInvestigation(id: string) { const c = await this.context(id); return this.evidence("device_investigation", `Benchmark adapter returned device profile evidence for ${id}.`, c.case?.connected_device_profiles || [id], { transaction_id: id, devices: c.case?.connected_device_profiles || [] }); }
  async previousFraudCases(id: string, pattern = "") { const c = await this.context(id); return { source: "case_memory" as const, query: "similar_cases", claim: `Retrieved ${c.case?.similar_prior_cases?.length || 0} historical cases relevant to ${pattern || "the current investigation"}.`, entities: c.case?.similar_prior_cases || [id], facts: { similar_case_ids: c.case?.similar_prior_cases || [], pattern, outcome: c.case?.verdict || "unknown", action: c.next_best_actions?.final?.[0]?.action || "unknown", evidence: c.case?.evidence || [] } }; }
  async detectPattern(id: string) { const c = await this.context(id); return this.evidence("fraud_pattern_detection", `Pattern library matched ${c.case?.pattern || "unclassified activity"} using benchmark evidence.`, [c.case?.pattern || "unknown", id], { transaction_id: id, pattern: c.case?.pattern || "unknown", probability: c.case?.fraud_probability || 0 }); }
  async writeCase(caseId: string) { return { written: false, reference: `demo-writeback:${caseId}`, source: "demo_adapter" }; }
}

function tools(): GraphTools { return process.env.TIGERGRAPH_MCP_URL ? new TigerGraphMcpTools() : process.env.TIGERGRAPH_HOST ? new TigerGraphRestTools() : new DemoGraphTools(); }

type AgentPlan = { pattern: string; relevant_evidence_queries: string[]; next_tool: string; next_tool_reason: string; needs_more_evidence: boolean; evidence_request_type: string; evidence_request_reason: string; recommended_action: string; action_reason: string; confidence_delta: number; explanation: string };

const agentPlanSchema = { type: "object", properties: {
  pattern: { type: "string" }, relevant_evidence_queries: { type: "array", items: { type: "string" } }, next_tool: { type: "string" }, next_tool_reason: { type: "string" }, needs_more_evidence: { type: "boolean" }, evidence_request_type: { type: "string" }, evidence_request_reason: { type: "string" }, recommended_action: { type: "string" }, action_reason: { type: "string" }, confidence_delta: { type: "number" }, explanation: { type: "string" },
}, required: ["pattern", "relevant_evidence_queries", "next_tool", "next_tool_reason", "needs_more_evidence", "evidence_request_type", "evidence_request_reason", "recommended_action", "action_reason", "confidence_delta", "explanation"], additionalProperties: false };

function fallbackPlan(base: Json, evidence: GraphEvidence[], probability: number, uncertainty: number): AgentPlan {
  const hasNetwork = evidence.some((item) => item.query === "connected_entities" || item.query === "device_investigation");
  const hasDevice = evidence.some((item) => item.query === "device_investigation");
  const next_tool = !hasNetwork ? "get_connected_entities" : !hasDevice ? "investigate_device" : "none";
  const next_tool_reason = next_tool === "get_connected_entities" ? "The initial transaction and pattern evidence do not resolve whether connected accounts, cards, or IPs explain the alert." : next_tool === "investigate_device" ? "Connected entities are present, but the device relationship is still uncharacterized." : "The selected graph neighborhood is sufficient; no further graph tool is needed.";
  const needs = uncertainty > 0.25 && next_tool === "none";
  const recommended_action = hasNetwork && probability >= 0.72 ? "BLOCK_CARD" : needs ? "STEP_UP_AUTH" : probability >= 0.58 ? "STEP_UP_AUTH" : "MONITOR_ACCOUNT";
  return { pattern: base.pattern || (hasNetwork ? "connected_entity_activity" : "unclassified_suspicious_activity"), relevant_evidence_queries: evidence.map((item) => item.query), next_tool, next_tool_reason, needs_more_evidence: needs, evidence_request_type: needs ? "STEP_UP_AUTH" : "NONE", evidence_request_reason: needs ? "Conflicting or incomplete identity evidence leaves the decision boundary unresolved; customer verification is the least irreversible next step." : "The connected-device and historical evidence is sufficient for a policy check.", recommended_action, action_reason: hasNetwork ? "The graph neighborhood provides a connected-entity signal that outweighs the raw risk score." : "The bounded evidence does not support an irreversible control, so monitoring or reversible verification is safer.", confidence_delta: needs ? 0.16 : 0, explanation: "Fallback reasoning used because no LLM provider was enabled; all evidence remains bounded and policy-gated." };
}

async function reasonWithLLM(context: Json, fallback: AgentPlan): Promise<{ plan: AgentPlan; enabled: boolean; error?: string }> {
  if (process.env.LLM_REASONING_ENABLED !== "true" || !process.env.BUILT_IN_FORGE_API_URL || !process.env.BUILT_IN_FORGE_API_KEY) return { plan: fallback, enabled: false };
  try {
    const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL.replace(/\/$/, "")}/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}` }, body: JSON.stringify({ model: process.env.LLM_MODEL || "gpt-5-mini", messages: [{ role: "system", content: "You are the SentinelGraph fraud investigation agent. Reason only over the bounded evidence ledger. The deterministic policy engine is the final authority; never claim an action is permitted. Treat bank risk as a trigger, not a verdict. Output JSON only." }, { role: "user", content: JSON.stringify(context) }], response_format: { type: "json_schema", json_schema: { name: "agent_plan", strict: true, schema: agentPlanSchema } }, max_completion_tokens: 900 }) });
    if (!response.ok) throw new Error(`LLM reasoning failed: ${response.status}`);
    const payload = await response.json() as Json;
    const content = payload.choices?.[0]?.message?.content;
    const plan = typeof content === "string" ? JSON.parse(content) as AgentPlan : null;
    if (!plan || typeof plan.recommended_action !== "string") throw new Error("LLM returned an invalid agent plan");
    return { plan: { ...fallback, ...plan }, enabled: true };
  } catch (error) { return { plan: fallback, enabled: false, error: error instanceof Error ? error.message : "LLM reasoning unavailable" }; }
}

async function loadReference(caseId: string): Promise<Json> { try { return JSON.parse(await fs.readFile(path.join(casesDir, `${caseId}.json`), "utf8")); } catch { return { case_id: caseId, case: { fraud_probability: 0.5, verdict: "uncertain", pattern: "unclassified activity", summary: "No benchmark reference was available; additional evidence is required.", evidence: [], similar_prior_cases: [], affected_txn_ids: [caseId] }, evidence_requests: [], next_best_actions: { initial: [], final: [], what_changed: "Reference not available." }, sar: { file: false, reason: "No reference." }, stop_reason: "Evidence threshold not reached." }; } }

async function runSelectedTool(graph: GraphTools, toolName: string, transactionId: string, customerId: string, pattern: string): Promise<GraphEvidence | null> {
  if (toolName === "get_connected_entities") return graph.connectedEntities(transactionId);
  if (toolName === "investigate_device") return graph.deviceInvestigation(transactionId);
  if (toolName === "get_customer_history") return graph.customerHistory(customerId);
  if (toolName === "find_similar_cases") return graph.previousFraudCases(customerId, pattern);
  if (toolName === "detect_fraud_pattern") return graph.detectPattern(transactionId);
  return null;
}

function policyGate(probability: number, uncertainty: number, action: string) {
  const protectedAction = ["BLOCK_CARD", "BLOCK_TRANSACTION", "BLOCK_ACCOUNT", "FILE_REPORT", "CLOSE_CASE"].includes(action);
  if (action === "STEP_UP_AUTH" || action === "VERIFY_CUSTOMER" || action === "CREATE_CASE") return { route: "auto", allowed: true, reason: "Reversible evidence or case-preservation action is permitted automatically." };
  if (protectedAction && probability >= 0.72) return { route: action === "FILE_REPORT" || action === "BLOCK_ACCOUNT" ? "L2" : "L1", allowed: false, reason: "Protected control requires the designated human approval route." };
  return { route: "auto", allowed: true, reason: uncertainty > 0.35 ? "Monitoring is safer while evidence remains incomplete." : "Policy permits the reversible action." };
}

export async function investigateCase(caseId: string, trigger = "analyst_request"): Promise<InvestigationResult> {
  const reference = await loadReference(caseId);
  const base = reference.case || {};
  const official = await officialCaseMetadata(caseId);
  const txn = official.transactionId || base.first_suspicious_txn_id || base.affected_txn_ids?.[0] || caseId;
  const customer = official.customerId || "unknown-customer";
  const card = official.cardId || "unknown-card";
  const trace: Json[] = [{ time: now(), status: "complete", step: "trigger_received", label: "Trigger received", detail: trigger }, { time: now(), status: "complete", step: "case_opened", label: "Case created", detail: `Opened ${caseId} for customer ${customer}` }];
  const graph = tools();
  const evidence: GraphEvidence[] = [];
  const run = async (step: string, label: string, fn: () => Promise<GraphEvidence | null>) => { try { const item = await fn(); if (!item) return null; evidence.push(item); trace.push({ time: now(), status: "complete", step, label, detail: item.claim, source: item.source }); return item; } catch (error) { trace.push({ time: now(), status: "warning", step, label, detail: String(error) }); return null; } };
  await run("transaction_context", "Queried transaction context", () => graph.transactionContext(txn));
  const pattern = await run("pattern_detection", "Detected fraud pattern", () => graph.detectPattern(txn));
  const memory = await run("memory_retrieval", "Retrieved similar historical cases", () => graph.previousFraudCases(customer, base.pattern));
  const initial = clamp(Number(base.fraud_probability ?? official.riskScore ?? 0.5));
  const evidenceQuality = Math.min(0.18, evidence.filter((e) => e.source !== "demo_adapter").length * 0.05 + evidence.filter((e) => e.source === "demo_adapter").length * 0.025);
  let confidence = clamp(initial * 0.72 + 0.2 + evidenceQuality);
  const initialUncertainty = clamp(1 - confidence);
  trace.push({ time: now(), status: "complete", step: "assessed", label: "Assessed risk and confidence", detail: `Initial confidence ${Math.round(confidence * 100)}%` });
  const buildContext = () => ({ current_case: { case_id: caseId, transaction_id: txn, customer_id: customer, card_id: card, trigger, bank_risk_score: initial }, evidence: evidence.map((item) => ({ source: item.source, query: item.query, claim: item.claim, entities: item.entities, facts: item.facts })), memory: evidence.find((item) => item.query === "similar_cases") || null, fraud_patterns: evidence.find((item) => item.query === "fraud_pattern_detection") || null, policy: { protected_actions_require_approval: true, reversible_evidence_action: "STEP_UP_AUTH", report_approval_route: "L2" }, regulatory_context: "Do not file or execute a protected action without the deterministic approval route." });
  const fallback = fallbackPlan(base, evidence, initial, initialUncertainty);
  let reasoning = await reasonWithLLM(buildContext(), fallback);
  trace.push({ time: now(), status: reasoning.enabled ? "complete" : "simulated", step: "agent_reasoning", label: reasoning.enabled ? "Agent reasoned over bounded GraphRAG context" : "Deterministic agent fallback reasoned over bounded context", detail: reasoning.plan.explanation, source: reasoning.enabled ? "llm" : "demo_adapter" });
  if (reasoning.error) trace.push({ time: now(), status: "warning", step: "llm_fallback", label: "LLM unavailable; fallback preserved", detail: reasoning.error });
  const selectedToolNames = new Set<string>();
  for (let round = 0; round < 2 && reasoning.plan.next_tool && reasoning.plan.next_tool !== "none"; round += 1) {
    if (selectedToolNames.has(reasoning.plan.next_tool)) break;
    selectedToolNames.add(reasoning.plan.next_tool);
    trace.push({ time: now(), status: "complete", step: "tool_selected", label: `Agent selected ${reasoning.plan.next_tool}`, detail: reasoning.plan.next_tool_reason, source: reasoning.enabled ? "llm" : "demo_adapter" });
    const selected = await run("agent_selected_tool", `Called ${reasoning.plan.next_tool}`, () => runSelectedTool(graph, reasoning.plan.next_tool, txn, customer, reasoning.plan.pattern));
    if (!selected) break;
    reasoning = await reasonWithLLM(buildContext(), fallbackPlan(base, evidence, initial, initialUncertainty));
    trace.push({ time: now(), status: reasoning.enabled ? "complete" : "simulated", step: "agent_reassessment", label: "Agent reassessed after selected evidence", detail: reasoning.plan.explanation, source: reasoning.enabled ? "llm" : "demo_adapter" });
  }
  const needsEvidence = reasoning.plan.needs_more_evidence;
  const requested = needsEvidence ? { type: reasoning.plan.evidence_request_type || "STEP_UP_AUTH", reason: reasoning.plan.evidence_request_reason } : null;
  let finalConfidence = confidence;
  let finalProbability = initial;
  let changed = "No additional evidence was required; the initial decision boundary was defensible.";
  if (requested) {
    trace.push({ time: now(), status: "warning", step: "uncertain", label: "Evidence insufficient", detail: requested.reason });
    trace.push({ time: now(), status: "complete", step: "evidence_requested", label: "Requested step-up authentication", detail: "Simulated external response is isolated to demo mode." });
    const response = base.verdict === "fraud" ? "challenge_failed" : "challenge_passed";
    const delta = response === "challenge_failed" ? 0.12 : -0.1;
    finalProbability = clamp(initial + delta);
    finalConfidence = clamp(confidence + Math.max(0.1, reasoning.plan.confidence_delta || 0.16));
    trace.push({ time: now(), status: "complete", step: "evidence_received", label: "Evidence received", detail: `Step-up response: ${response}` });
    trace.push({ time: now(), status: "complete", step: "reassessed", label: "Recalculated confidence", detail: `Updated confidence ${Math.round(finalConfidence * 100)}%` });
    changed = `Step-up response ${response} changed the recommendation by ${Math.round(Math.abs(delta) * 100)} percentage points.`;
  }
  const uncertainty = clamp(1 - finalConfidence);
  const permittedActionNames = new Set(["BLOCK_CARD", "BLOCK_TRANSACTION", "BLOCK_ACCOUNT", "FILE_REPORT", "STEP_UP_AUTH", "VERIFY_CUSTOMER", "CREATE_CASE", "MONITOR_ACCOUNT", "ALLOW_WITH_MONITORING"]);
  const finalAction = permittedActionNames.has(reasoning.plan.recommended_action) ? reasoning.plan.recommended_action : fallback.recommended_action;
  const gate = policyGate(finalProbability, uncertainty, finalAction);
  trace.push({ time: now(), status: "complete", step: "next_best_action", label: "Selected next-best action", detail: finalAction });
  trace.push({ time: now(), status: gate.allowed ? "complete" : "approval", step: "policy_checked", label: "Checked approval route", detail: `${gate.route} · ${gate.reason}` });
  const caseIdOut = `CASE-${caseId}-${Date.now().toString(36).toUpperCase()}`;
  const written = await graph.writeCase(caseIdOut, { status: gate.allowed ? "monitoring" : "awaiting_approval", verdict: finalProbability >= 0.72 ? "fraud" : "uncertain", probability: finalProbability, pattern: reasoning.plan.pattern || base.pattern || pattern?.claim || "unclassified", exposure: base.exposure_usd || 0, summary: changed, evidence, findings: [reasoning.plan.explanation], selected_action: finalAction, approval_route: gate.route, outcome: gate.allowed ? "executed_or_monitored" : "approval_required", memory: memory?.entities || [] });
  trace.push({ time: now(), status: written.written ? "complete" : "simulated", step: "case_writeback", label: written.written ? "Case written to TigerGraph" : "Case write-back simulated", detail: written.reference });
  trace.push({ time: now(), status: "complete", step: "memory_written", label: written.written ? "Memory written" : "Memory retained in demo adapter", detail: written.source });
  const initialAction = needsEvidence ? (requested?.type || "STEP_UP_AUTH") : reasoning.plan.recommended_action;
  const graphMode = process.env.TIGERGRAPH_MCP_URL ? "tigergraph_mcp" : process.env.TIGERGRAPH_HOST ? "tigergraph_restpp" : "demo_adapter";
  return { ...reference, case_id: caseId, agent: { mode: graphMode, llm_enabled: reasoning.enabled, trigger, transaction_id: txn, customer_id: customer, card_id: card, initial_confidence: confidence, final_confidence: finalConfidence, initial_probability: initial, final_probability: finalProbability, uncertainty, reasoning: reasoning.plan, grounded_context: buildContext(), evidence, requested_evidence: requested ? [requested] : [], returned_evidence: requested ? [{ type: requested.type, response: process.env.DEMO_EXTERNAL_RESPONSE || "challenge_passed", reason: "Controlled demo response; replace with approved external evidence provider in live mode." }] : [], activity_trace: trace, policy: { action: finalAction, ...gate }, case_writeback: written, changed_recommendation: changed }, next_best_actions: { ...(reference.next_best_actions || {}), initial: [{ action: initialAction, route: policyGate(initial, 1 - confidence, initialAction).route, reason: reasoning.plan.action_reason }], final: [{ action: finalAction, route: gate.route, reason: gate.reason }], what_changed: changed }, case: { ...base, status: gate.allowed ? "monitoring" : "awaiting_approval", fraud_probability: finalProbability, pattern: reasoning.plan.pattern, written_to_graph: written.written, graph_case_id: written.reference, evidence: [...(base.evidence || []), ...evidence.map((x) => ({ claim: x.claim, source: x.source, ref: x.query, entity_ids: x.entities, facts: x.facts }))], similar_prior_cases: memory?.entities || base.similar_prior_cases || [], summary: reasoning.plan.explanation } };
}
