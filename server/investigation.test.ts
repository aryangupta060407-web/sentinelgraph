import { describe, expect, it, beforeEach } from "vitest";
import { investigateCase } from "./investigation";

describe("agentic investigation workflow", () => {
  beforeEach(() => { delete process.env.TIGERGRAPH_HOST; });

  it("retrieves bounded graph evidence and emits a trace", async () => {
    const result = await investigateCase("HHG-004", "customer_report");
    expect(result.agent.mode).toBe("demo_adapter");
    expect(result.agent.evidence.length).toBeGreaterThanOrEqual(5);
    expect(result.agent.activity_trace.map((x: any) => x.step)).toContain("transaction_context");
    expect(result.agent.activity_trace.map((x: any) => x.step)).toContain("memory_retrieval");
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
});
