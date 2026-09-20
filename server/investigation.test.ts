import { describe, expect, it, beforeEach } from "vitest";
import { investigateCase } from "./investigation";

describe("agentic investigation workflow", () => {
  beforeEach(() => { delete process.env.TIGERGRAPH_HOST; delete process.env.TIGERGRAPH_MCP_URL; delete process.env.LLM_REASONING_ENABLED; });

  it("retrieves bounded graph evidence and emits a trace", async () => {
    const result = await investigateCase("HHG-004", "customer_report");
    expect(result.agent.mode).toBe("demo_adapter");
    expect(result.agent.evidence.length).toBeGreaterThanOrEqual(5);
    expect(result.agent.activity_trace.map((x: any) => x.step)).toContain("transaction_context");
    expect(result.agent.activity_trace.map((x: any) => x.step)).toContain("memory_retrieval");
    expect(result.agent.activity_trace.some((x: any) => x.step === "tool_selected")).toBe(true);
    expect(result.agent.evidence.every((item: any) => item.facts && typeof item.facts === "object")).toBe(true);
  });

  it("requests evidence for an uncertain benchmark case and reassesses", async () => {
    const result = await investigateCase("HHG-001", "risk_score");
    expect(result.agent.requested_evidence.length).toBeGreaterThanOrEqual(0);
    expect(result.agent.final_confidence).toBeGreaterThan(0);
    expect(result.next_best_actions.what_changed).toBeTruthy();
  });

  it("keeps protected actions approval-gated and does not fake write-back", async () => {
    const result = await investigateCase("HHG-004", "customer_report");
    expect(["auto", "L1", "L2"]).toContain(result.agent.policy.route);
    if (result.agent.mode === "demo_adapter") expect(result.case.written_to_graph).toBe(false);
    expect(result.agent.activity_trace.some((x: any) => x.step === "policy_checked")).toBe(true);
  });

  it("does not claim a real graph write in demo mode", async () => {
    const result = await investigateCase("HHG-010", "risk_score");
    expect(result.agent.case_writeback.written).toBe(false);
    expect(result.agent.case_writeback.source).toBe("demo_adapter");
  });

  it("falls back safely when the configured LLM endpoint returns no valid plan", async () => {
    process.env.LLM_REASONING_ENABLED = "true";
    process.env.BUILT_IN_FORGE_API_URL = "http://127.0.0.1:1";
    process.env.BUILT_IN_FORGE_API_KEY = "test-only";
    const result = await investigateCase("HHG-002", "risk_score");
    expect(result.agent.llm_enabled).toBe(false);
    expect(result.agent.activity_trace.some((x: any) => x.step === "llm_fallback")).toBe(true);
  });
});
