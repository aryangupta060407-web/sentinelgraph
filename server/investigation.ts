import fs from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;
export type InvestigationResult = Json;

const root = path.resolve(process.cwd());
const casesDir = path.join(root, "client/public/data/cases");

const now = () => new Date().toISOString();
const clamp = (n: number) => Math.max(0, Math.min(1, n));

export type GraphEvidence = {
  source: "tigergraph" | "demo_adapter" | "case_memory" | "policy";
  query: string;
  claim: string;
  entities: string[];
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
  private evidence(query: string, claim: string, entities: string[]): GraphEvidence { return { source: "tigergraph", query, claim, entities }; }
  async transactionContext(transactionId: string) { const data = await this.query("transaction_context", { transaction_id: transactionId }); return this.evidence("transaction_context", `TigerGraph returned transaction context for ${transactionId}.`, [transactionId, JSON.stringify(data).slice(0, 180)]); }
  async customerHistory(customerId: string) { const data = await this.query("customer_history", { customer_id: customerId }); return this.evidence("customer_history", `TigerGraph returned ${Array.isArray(data) ? data.length : 1} customer-history result(s) for ${customerId}.`, [customerId, JSON.stringify(data).slice(0, 180)]); }
  async connectedEntities(transactionId: string) { const data = await this.query("connected_entities", { transaction_id: transactionId }); return this.evidence("connected_entities", `TigerGraph traversed connected accounts, cards, merchants, IPs, and devices for ${transactionId}.`, [transactionId, JSON.stringify(data).slice(0, 180)]); }
  async deviceInvestigation(transactionId: string) { const data = await this.query("device_investigation", { transaction_id: transactionId }); return this.evidence("device_investigation", `TigerGraph returned device and shared-device activity for ${transactionId}.`, [transactionId, JSON.stringify(data).slice(0, 180)]); }
  async previousFraudCases(customerId: string, pattern = "") { const data = await this.query("similar_cases", { customer_id: customerId, pattern }); return this.evidence("similar_cases", `TigerGraph returned similar historical cases for ${customerId}.`, [customerId, pattern, JSON.stringify(data).slice(0, 180)]); }
  async detectPattern(transactionId: string) { const data = await this.query("fraud_pattern_detection", { transaction_id: transactionId }); return this.evidence("fraud_pattern_detection", `TigerGraph evaluated known fraud patterns for ${transactionId}.`, [transactionId, JSON.stringify(data).slice(0, 180)]); }
  async writeCase(caseId: string, state: Json) { await this.query("write_case", { case_id: caseId, ...state }); return { written: true, reference: caseId, source: "tigergraph" }; }
}

class DemoGraphTools implements GraphTools {
  private async answer(id: string): Promise<Json> { try { return JSON.parse(await fs.readFile(path.join(casesDir, `${id}.json`), "utf8")); } catch { return {}; } }
  private async context(id: string) { return this.answer(id); }
  private evidence(query: string, claim: string, entities: string[]): GraphEvidence { return { source: "demo_adapter", query, claim, entities }; }
  async transactionContext(id: string) { const c = await this.context(id); return this.evidence("transaction_context", `Benchmark adapter returned the official transaction context for ${id}; bank risk is a trigger, not a verdict.`, [id, c.case?.first_suspicious_txn_id || id]); }
  async customerHistory(id: string) { const c = await this.context(id); return this.evidence("customer_history", `Benchmark adapter returned customer history for ${c.case?.connected_card_ids?.[0] || id}; the customer sequence is assessed in context.`, [c.case?.connected_card_ids?.[0] || id]); }
  async connectedEntities(id: string) { const c = await this.context(id); return this.evidence("connected_entities", `Benchmark adapter traversed ${c.case?.affected_txn_ids?.length || 1} connected transaction(s), card(s), and device relationships.`, [id, ...(c.case?.affected_txn_ids || []).slice(0, 4)]); }
  async deviceInvestigation(id: string) { const c = await this.context(id); return this.evidence("device_investigation", `Benchmark adapter returned device profile evidence for ${id}.`, c.case?.connected_device_profiles || [id]); }
  async previousFraudCases(id: string, pattern = "") { const c = await this.context(id); return { source: "case_memory" as const, query: "similar_cases", claim: `Retrieved ${c.case?.similar_prior_cases?.length || 0} historical cases relevant to ${pattern || "the current investigation"}.`, entities: c.case?.similar_prior_cases || [id] }; }
  async detectPattern(id: string) { const c = await this.context(id); return this.evidence("fraud_pattern_detection", `Pattern library matched ${c.case?.pattern || "unclassified activity"} using benchmark evidence.`, [c.case?.pattern || "unknown", id]); }
  async writeCase(caseId: string) { return { written: false, reference: `demo-writeback:${caseId}`, source: "demo_adapter" }; }
}

function tools(): GraphTools { return process.env.TIGERGRAPH_HOST ? new TigerGraphRestTools() : new DemoGraphTools(); }

async function loadReference(caseId: string): Promise<Json> { try { return JSON.parse(await fs.readFile(path.join(casesDir, `${caseId}.json`), "utf8")); } catch { return { case_id: caseId, case: { fraud_probability: 0.5, verdict: "uncertain", pattern: "unclassified activity", summary: "No benchmark reference was available; additional evidence is required.", evidence: [], similar_prior_cases: [], affected_txn_ids: [caseId] }, evidence_requests: [], next_best_actions: { initial: [], final: [], what_changed: "Reference not available." }, sar: { file: false, reason: "No reference." }, stop_reason: "Evidence threshold not reached." }; } }

function policyGate(probability: number, uncertainty: number, action: string) {
  const protectedAction = ["BLOCK_CARD", "BLOCK_TRANSACTION", "BLOCK_ACCOUNT", "FILE_REPORT", "CLOSE_CASE"].includes(action);
  if (action === "STEP_UP_AUTH" || action === "VERIFY_CUSTOMER" || action === "CREATE_CASE") return { route: "auto", allowed: true, reason: "Reversible evidence or case-preservation action is permitted automatically." };
  if (protectedAction && probability >= 0.72) return { route: action === "FILE_REPORT" || action === "BLOCK_ACCOUNT" ? "L2" : "L1", allowed: false, reason: "Protected control requires the designated human approval route." };
  return { route: "auto", allowed: true, reason: uncertainty > 0.35 ? "Monitoring is safer while evidence remains incomplete." : "Policy permits the reversible action." };
}

export async function investigateCase(caseId: string, trigger = "analyst_request"): Promise<InvestigationResult> {
  const reference = await loadReference(caseId);
  const base = reference.case || {};
  const txn = base.first_suspicious_txn_id || base.affected_txn_ids?.[0] || caseId;
  const customer = base.connected_card_ids?.[0] || "unknown-customer";
  const trace: Json[] = [{ time: now(), status: "complete", step: "trigger_received", label: "Trigger received", detail: trigger }, { time: now(), status: "complete", step: "case_opened", label: "Case created", detail: `Opened ${caseId}` }];
  const graph = tools();
  const evidence: GraphEvidence[] = [];
  const run = async (step: string, label: string, fn: () => Promise<GraphEvidence>) => { try { const item = await fn(); evidence.push(item); trace.push({ time: now(), status: "complete", step, label, detail: item.claim, source: item.source }); return item; } catch (error) { trace.push({ time: now(), status: "warning", step, label, detail: String(error) }); return null; } };
  await run("transaction_context", "Queried transaction context", () => graph.transactionContext(txn));
  await run("connected_entities", "Traversed connected entities", () => graph.connectedEntities(txn));
  await run("device_investigation", "Investigated device relationship", () => graph.deviceInvestigation(txn));
  await run("customer_history", "Retrieved customer history", () => graph.customerHistory(customer));
  const pattern = await run("pattern_detection", "Detected fraud pattern", () => graph.detectPattern(txn));
  const memory = await run("memory_retrieval", "Retrieved similar historical cases", () => graph.previousFraudCases(customer, base.pattern));
  const initial = clamp(Number(base.fraud_probability ?? 0.5));
  const evidenceQuality = Math.min(0.18, evidence.filter((e) => e.source !== "demo_adapter").length * 0.05 + evidence.filter((e) => e.source === "demo_adapter").length * 0.025);
  let confidence = clamp(initial * 0.72 + 0.2 + evidenceQuality);
  const initialUncertainty = clamp(1 - confidence);
  trace.push({ time: now(), status: "complete", step: "assessed", label: "Assessed risk and confidence", detail: `Initial confidence ${Math.round(confidence * 100)}%` });
  const needsEvidence = initialUncertainty > 0.25 && base.verdict === "uncertain";
  const requested = needsEvidence ? { type: "STEP_UP_AUTH", reason: "Evidence is insufficient at the decision boundary; request a reversible customer challenge." } : null;
  let finalConfidence = confidence;
  let finalProbability = initial;
  let changed = "No additional evidence was required; the initial decision boundary was defensible.";
  if (requested) {
    trace.push({ time: now(), status: "warning", step: "uncertain", label: "Evidence insufficient", detail: requested.reason });
    trace.push({ time: now(), status: "complete", step: "evidence_requested", label: "Requested step-up authentication", detail: "Simulated external response is isolated to demo mode." });
    const response = base.verdict === "fraud" ? "challenge_failed" : "challenge_passed";
    const delta = response === "challenge_failed" ? 0.12 : -0.1;
    finalProbability = clamp(initial + delta);
    finalConfidence = clamp(confidence + 0.16);
    trace.push({ time: now(), status: "complete", step: "evidence_received", label: "Evidence received", detail: `Step-up response: ${response}` });
    trace.push({ time: now(), status: "complete", step: "reassessed", label: "Recalculated confidence", detail: `Updated confidence ${Math.round(finalConfidence * 100)}%` });
    changed = `Step-up response ${response} changed the recommendation by ${Math.round(Math.abs(delta) * 100)} percentage points.`;
  }
  const uncertainty = clamp(1 - finalConfidence);
  const finalAction = finalProbability >= 0.78 ? "BLOCK_CARD" : finalProbability >= 0.58 ? "STEP_UP_AUTH" : "MONITOR_ACCOUNT";
  const gate = policyGate(finalProbability, uncertainty, finalAction);
  trace.push({ time: now(), status: "complete", step: "next_best_action", label: "Selected next-best action", detail: finalAction });
  trace.push({ time: now(), status: gate.allowed ? "complete" : "approval", step: "policy_checked", label: "Checked approval route", detail: `${gate.route} · ${gate.reason}` });
  const caseIdOut = `CASE-${caseId}-${Date.now().toString(36).toUpperCase()}`;
  const written = await graph.writeCase(caseIdOut, { status: gate.allowed ? "monitoring" : "awaiting_approval", verdict: finalProbability >= 0.72 ? "fraud" : "uncertain", probability: finalProbability, pattern: base.pattern || pattern?.claim || "unclassified", exposure: base.exposure_usd || 0, summary: changed });
  trace.push({ time: now(), status: written.written ? "complete" : "simulated", step: "case_writeback", label: written.written ? "Case written to TigerGraph" : "Case write-back simulated", detail: written.reference });
  trace.push({ time: now(), status: "complete", step: "memory_written", label: written.written ? "Memory written" : "Memory retained in demo adapter", detail: written.source });
  const initialAction = needsEvidence ? "STEP_UP_AUTH" : (base.next_best_actions?.initial?.[0]?.action || "CREATE_CASE");
  return { ...reference, case_id: caseId, agent: { mode: process.env.TIGERGRAPH_HOST ? "tigergraph" : "demo_adapter", trigger, transaction_id: txn, customer_id: customer, initial_confidence: confidence, final_confidence: finalConfidence, initial_probability: initial, final_probability: finalProbability, uncertainty, evidence, requested_evidence: requested ? [requested] : [], returned_evidence: requested ? [{ type: "STEP_UP_AUTH", response: base.verdict === "fraud" ? "challenge_failed" : "challenge_passed" }] : [], activity_trace: trace, policy: { action: finalAction, ...gate }, case_writeback: written, changed_recommendation: changed }, next_best_actions: { ...(reference.next_best_actions || {}), initial: [{ action: initialAction, route: policyGate(initial, 1 - confidence, initialAction).route, reason: "Initial evidence-gathering decision." }], final: [{ action: finalAction, route: gate.route, reason: gate.reason }], what_changed: changed }, case: { ...base, status: gate.allowed ? "monitoring" : "awaiting_approval", fraud_probability: finalProbability, written_to_graph: written.written, graph_case_id: written.reference, evidence: [...(base.evidence || []), ...evidence.map((x) => ({ claim: x.claim, source: x.source, ref: x.query, entity_ids: x.entities }))], similar_prior_cases: memory?.entities || base.similar_prior_cases || [], summary: changed } };
}
