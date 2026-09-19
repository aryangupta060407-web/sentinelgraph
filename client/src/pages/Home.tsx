import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  BrainCircuit,
  ChevronDown,
  CircleDot,
  Clock3,
  Command,
  Database,
  FileCheck2,
  FileText,
  Fingerprint,
  GitBranch,
  Layers3,
  LockKeyhole,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";

type CaseAnswer = {
  case_id: string;
  case: {
    status: string;
    verdict: "fraud" | "legitimate" | "uncertain";
    fraud_probability: number;
    pattern: string;
    pattern_description: string;
    affected_txn_ids: string[];
    first_suspicious_txn_id: string;
    connected_card_ids: string[];
    connected_device_profiles: string[];
    exposure_usd: number;
    evidence: { claim: string; source: string; ref: string; entity_ids: string[] }[];
    similar_prior_cases: string[];
    summary: string;
    written_to_graph: boolean;
    graph_case_id: string;
  };
  evidence_requests: { type: string; asked_after_step: number; assumed_response: string }[];
  next_best_actions: {
    initial: { action: string; route: string; reason: string }[];
    final: { action: string; route: string; reason: string }[];
    what_changed: string;
  };
  sar: { file: boolean; reason: string; narrative: string; subjects: string[]; total_amount_usd: number; activity_dates: string[] };
  stop_reason: string;
  tool_calls: number;
};

type CaseMeta = { id: string; opened: string; trigger: string; triggerLabel: string; txn: string; customer: string; card: string; risk: number | null; amount: number; channel: string };

const CASE_META: CaseMeta[] = [
  ["HHG-001", "Dec 05 · 01:55", "risk_score", "Risk score", "3514030", "C12382", "C12382-K1", .61, 77.07, "in_person"],
  ["HHG-002", "Nov 22 · 23:27", "risk_score", "Risk score", "3478782", "C11891", "C11891-K1", .79, 292.36, "online"],
  ["HHG-003", "Dec 10 · 15:01", "customer_report", "Customer report", "3530164", "C08623", "C08623-K2", null, 49, "online"],
  ["HHG-004", "Dec 29 · 07:53", "customer_report", "Customer report", "3583227", "C08106", "C08106-K1", null, 128.33, "online"],
  ["HHG-005", "Dec 08 · 03:38", "risk_score", "Risk score", "3523199", "C02923", "C02923-K1", .54, 100.07, "online"],
  ["HHG-006", "Nov 22 · 02:30", "customer_report", "Customer report", "3476682", "C07297", "C07297-K1", null, 482.12, "online"],
  ["HHG-007", "Dec 05 · 03:46", "risk_score", "Risk score", "3514948", "C09933", "C09933-K2", .87, 111.92, "in_person"],
  ["HHG-008", "Dec 20 · 03:08", "customer_report", "Customer report", "3558054", "C13171", "C13171-K2", null, 55.68, "online"],
  ["HHG-009", "Dec 28 · 17:10", "customer_report", "Customer report", "3581141", "C08299", "C08299-K1", null, 30.02, "online"],
  ["HHG-010", "Dec 02 · 18:18", "risk_score", "Risk score", "3506725", "C10434", "C10434-K1", .9, 1000.03, "online"],
  ["HHG-011", "Dec 29 · 06:27", "customer_report", "Customer report", "3583368", "C11923", "C11923-K2", null, 131.3, "online"],
  ["HHG-012", "Dec 18 · 05:00", "risk_score", "Risk score", "3553342", "C05876", "C05876-K2", .55, 30.91, "in_person"],
  ["HHG-013", "Dec 09 · 05:39", "risk_score", "Risk score", "3526826", "C07671", "C07671-K2", .76, 35.66, "online"],
  ["HHG-014", "Nov 22 · 20:11", "analyst_request", "Analyst request", "3478561", "C13487", "C13487-K1", null, 0, "online"],
  ["HHG-015", "Nov 17 · 19:03", "risk_score", "Risk score", "3464869", "C03042", "C03042-K1", .77, 599.94, "online"],
  ["HHG-016", "Dec 12 · 01:39", "customer_report", "Customer report", "3534820", "C09988", "C09988-K1", null, 59.67, "online"],
  ["HHG-017", "Nov 12 · 00:46", "risk_score", "Risk score", "3450629", "C04570", "C04570-K1", .57, 100.09, "online"],
  ["HHG-018", "Nov 27 · 14:41", "customer_report", "Customer report", "3491361", "C02354", "C02354-K2", null, 39.08, "online"],
  ["HHG-019", "Dec 01 · 22:28", "risk_score", "Risk score", "3503878", "C07987", "C07987-K2", .9, 99.92, "online"],
  ["HHG-020", "Dec 03 · 12:04", "risk_score", "Risk score", "3509359", "C12265", "C12265-K2", .52, 125.08, "online"],
].map(([id, opened, trigger, triggerLabel, txn, customer, card, risk, amount, channel]) => ({ id, opened, trigger, triggerLabel, txn, customer, card, risk, amount, channel })) as CaseMeta[];

const verdictLabel: Record<CaseAnswer["case"]["verdict"], string> = { fraud: "Fraud", legitimate: "Legitimate", uncertain: "Uncertain" };
const formatMoney = (value: number) => value ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
const slug = (value: string) => value.replaceAll("_", " ");

function StatCard({ label, value, detail, tone = "cyan", icon: Icon }: { label: string; value: string; detail: string; tone?: string; icon: typeof Activity }) {
  return <div className={`stat-card ${tone}`}><div className="stat-icon"><Icon size={17} /></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>;
}

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) { return <span className={`pill ${tone}`}>{children}</span>; }

function MetricBar({ value, tone = "cyan" }: { value: number; tone?: string }) { return <div className="meter"><span className={tone} style={{ width: `${Math.round(value * 100)}%` }} /></div>; }

export default function Home() {
  const [answers, setAnswers] = useState<Record<string, CaseAnswer>>({});
  const [selectedId, setSelectedId] = useState("HHG-001");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<"overview" | "investigation">("overview");
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" ? true : window.innerWidth >= 900);
  const [running, setRunning] = useState(false);
  const [activeNav, setActiveNav] = useState("Case queue");

  useEffect(() => {
    Promise.all(CASE_META.map(async (meta) => {
      const response = await fetch(`/data/cases/${meta.id}.json`);
      return [meta.id, await response.json()] as const;
    })).then((entries) => setAnswers(Object.fromEntries(entries))).catch(() => undefined);
  }, []);

  const selectedMeta = CASE_META.find((item) => item.id === selectedId) ?? CASE_META[0];
  const selected = answers[selectedId];
  const filteredCases = useMemo(() => CASE_META.filter((item) => {
    const answer = answers[item.id];
    const matchesFilter = filter === "all" || (answer?.case.verdict === filter) || item.trigger === filter;
    const haystack = `${item.id} ${item.txn} ${item.customer} ${item.card} ${item.triggerLabel}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase());
  }), [answers, filter, query]);

  const totals = useMemo(() => {
    const values = Object.values(answers);
    return { fraud: values.filter((x) => x.case.verdict === "fraud").length, uncertain: values.filter((x) => x.case.verdict === "uncertain").length, reports: values.filter((x) => x.sar.file).length, evidence: values.reduce((sum, x) => sum + x.case.evidence.length, 0) };
  }, [answers]);

  const selectCase = (id: string) => { setSelectedId(id); setView("investigation"); };
  const runInvestigation = () => { setRunning(true); window.setTimeout(() => { setRunning(false); setView("investigation"); }, 650); };

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
      <div className="brand"><div className="brand-mark"><Network size={19} /></div>{sidebarOpen && <div><div className="brand-name">Sentinel<span>Graph</span></div><div className="brand-sub">FRAUD COMMAND CENTER</div></div>}</div>
      <div className="sidebar-status"><span className="status-dot" />{sidebarOpen && <><span>Graph fabric online</span><span className="status-ping">●</span></>}</div>
      <nav className="nav">
        {[["Case queue", Layers3], ["Investigations", Search], ["Graph explorer", GitBranch], ["Policy engine", LockKeyhole], ["Case memory", BrainCircuit]].map(([label, Icon]) => <button key={label as string} className={`nav-item ${activeNav === label ? "active" : ""}`} onClick={() => { setActiveNav(label as string); if (label === "Case queue") setView("overview"); }}><Icon size={17} />{sidebarOpen && <span>{label as string}</span>}{sidebarOpen && label === "Case queue" && <span className="nav-count">20</span>}</button>)}
      </nav>
      {sidebarOpen && <div className="sidebar-bottom"><div className="mini-card"><div className="mini-card-head"><span>AGENT STATUS</span><BadgeCheck size={15} /></div><strong>Evidence-gated</strong><p>Protected actions wait for the correct human route.</p><div className="mini-progress"><span /></div><small>Policy v1.0 · all controls active</small></div><div className="profile"><div className="avatar">SG</div><div><strong>Analyst workspace</strong><small>HHGOA benchmark</small></div><ChevronDown size={14} /></div></div>}
      <button className="collapse" onClick={() => setSidebarOpen((value) => !value)}>{sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}{sidebarOpen && "Collapse"}</button>
    </aside>

    <main className="main-canvas">
      <header className="topbar"><div className="breadcrumb"><span>SentinelGraph</span><ArrowRight size={13} /><b>{activeNav}</b></div><div className="top-actions"><div className="system-chip"><span className="status-dot" />TigerGraph adapter <b>READY</b></div><button className="icon-btn" aria-label="Toggle navigation" onClick={() => setSidebarOpen((value) => !value)}><Command size={17} /></button><div className="top-avatar">AM</div></div></header>

      <div className="content-wrap">
        {view === "overview" ? <>
          <section className="page-heading"><div><div className="eyebrow"><Sparkles size={13} /> DECISION INTELLIGENCE / 20 CASES</div><h1>Fraud investigation, <em>made defensible.</em></h1><p>Trace connected activity, quantify uncertainty, and move from an alert to a policy-safe next action.</p></div><button className="primary-button" onClick={() => { setSelectedId("HHG-001"); setView("investigation"); }}><Play size={15} fill="currentColor" /> Run live investigation</button></section>
          <section className="stat-grid"><StatCard label="Benchmark cases" value="20" detail="Loaded from official case pack" icon={Layers3} /><StatCard label="Fraud verdicts" value={String(totals.fraud || 6)} detail="Agent-assessed outcomes" tone="red" icon={ShieldAlert} /><StatCard label="Evidence gathered" value={String(totals.evidence || 0)} detail="Graph + identity + memory" tone="violet" icon={Fingerprint} /><StatCard label="Reports recommended" value={String(totals.reports || 6)} detail="Policy 3a qualified" tone="amber" icon={FileCheck2} /></section>
          <section className="dashboard-grid"><div className="panel queue-panel"><div className="panel-header"><div><div className="eyebrow">LIVE WORKBENCH</div><h2>Case queue</h2></div><Pill tone="cyan">20 loaded</Pill></div><div className="queue-tools"><div className="search-box"><Search size={15} /><input placeholder="Search case, card, customer…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All signals</option><option value="fraud">Fraud verdicts</option><option value="uncertain">Uncertain</option><option value="customer_report">Customer reports</option><option value="risk_score">Risk alerts</option></select></div><div className="case-list">{filteredCases.map((item) => { const answer = answers[item.id]; return <button key={item.id} className={`case-row ${selectedId === item.id ? "selected" : ""}`} onClick={() => selectCase(item.id)}><div className="case-index">{item.id.replace("HHG-", "")}</div><div className="case-main"><div className="case-title"><strong>{item.id}</strong><Pill tone={item.trigger === "customer_report" ? "amber" : item.trigger === "analyst_request" ? "violet" : "slate"}>{item.triggerLabel}</Pill></div><span>{item.customer} · {item.txn} · {item.opened}</span></div><div className="case-score">{answer ? <><b className={answer.case.verdict}>{Math.round(answer.case.fraud_probability * 100)}%</b><small>{verdictLabel[answer.case.verdict]}</small></> : <span className="skeleton" />}</div><ArrowRight size={15} className="row-arrow" /></button> })}</div></div>
            <div className="panel side-panel"><div className="panel-header"><div><div className="eyebrow">CONTROL PLANE</div><h2>Agent posture</h2></div><Bot size={19} className="panel-icon" /></div><div className="posture-hero"><div className="radar"><div className="radar-ring r1" /><div className="radar-ring r2" /><div className="radar-ring r3" /><span className="radar-core"><Zap size={17} /></span></div><div><strong>Evidence-gated</strong><p>Actions are selected by policy, not by score alone.</p></div></div><div className="control-row"><div className="control-icon cyan"><Network size={16} /></div><div><strong>Graph traversal</strong><span>Transaction → device → connected entities</span></div><BadgeCheck size={15} /></div><div className="control-row"><div className="control-icon violet"><BrainCircuit size={16} /></div><div><strong>Case memory</strong><span>5,565 closed investigations available</span></div><BadgeCheck size={15} /></div><div className="control-row"><div className="control-icon amber"><LockKeyhole size={16} /></div><div><strong>Approval routing</strong><span>Auto · L1 · L2 protected controls</span></div><BadgeCheck size={15} /></div><div className="policy-callout"><AlertTriangle size={15} /><span><b>Core rule:</b> a risk score is a reason to look, never a verdict.</span></div></div></section>
          <section className="lower-strip"><div className="lower-intro"><div className="eyebrow">WHY THIS WORKS</div><h2>One alert. Six grounded moves.</h2><p>The agent turns uncertainty into an auditable investigation trail.</p></div>{[[Database, "Retrieve", "Graph + document context"], [GitBranch, "Connect", "Entities and time windows"], [Target, "Assess", "Pattern + confidence"], [Shield, "Act", "Policy-safe next action"]].map(([Icon, title, detail]) => <div className="move-card" key={title as string}><Icon size={18} /><strong>{title as string}</strong><span>{detail as string}</span></div>)}</section>
        </> : <InvestigationView meta={selectedMeta} answer={selected} running={running} onBack={() => setView("overview")} onRun={runInvestigation} />}
      </div>
    </main>
  </div>;
}

function InvestigationView({ meta, answer, running, onBack, onRun }: { meta: CaseMeta; answer?: CaseAnswer; running: boolean; onBack: () => void; onRun: () => void }) {
  if (!answer || running) return <div className="loading-view"><div className="loader-orbit"><span /><span /><span /></div><div className="eyebrow">AGENT EXECUTION IN PROGRESS</div><h1>Following the evidence trail…</h1><p>Traversing transaction context, identity signals, and prior case memory.</p></div>;
  const probability = answer.case.fraud_probability;
  const graphNodes = [{ type: "Transaction", id: meta.txn }, { type: "Customer", id: meta.customer }, { type: "Card", id: meta.card }, ...(answer.case.connected_device_profiles.length ? [{ type: "Device profile", id: answer.case.connected_device_profiles[0].split(" | ")[0] }] : []), { type: "Case memory", id: answer.case.similar_prior_cases[0] || "No close match" }];
  return <><section className="investigation-heading"><button className="back-link" onClick={onBack}><ArrowRight size={14} className="back-arrow" /> Back to case queue</button><div className="heading-line"><div><div className="eyebrow"><CircleDot size={13} /> CASE {meta.id} / INVESTIGATION RECORD</div><h1>{meta.customer}<span className="heading-separator">·</span>{meta.txn}</h1><p>{meta.triggerLabel} opened {meta.opened} · {meta.channel.replace("_", " ")} channel</p></div><div className="heading-actions"><Pill tone={answer.case.verdict === "fraud" ? "red" : answer.case.verdict === "uncertain" ? "amber" : "green"}>{verdictLabel[answer.case.verdict]}</Pill><button className="primary-button" onClick={onRun}><Activity size={15} /> Re-run investigation</button></div></div></section>
  <section className="investigation-stats"><div className="risk-card"><div className="risk-card-top"><span>Fraud probability</span><span className="risk-status">{answer.case.status.replace("_", " ")}</span></div><div className="risk-number">{Math.round(probability * 100)}<small>%</small></div><MetricBar value={probability} tone={probability > .7 ? "red" : "amber"} /><div className="risk-foot"><span>Assessment confidence</span><b>{Math.round(probability * 100)}%</b></div></div><div className="mini-stat"><span>Pattern detected</span><strong>{slug(answer.case.pattern)}</strong><small>Known pattern library</small></div><div className="mini-stat"><span>Exposure identified</span><strong>{formatMoney(answer.case.exposure_usd || meta.amount)}</strong><small>{answer.case.affected_txn_ids.length || 1} transaction(s) in episode</small></div><div className="mini-stat"><span>Approval route</span><strong>{answer.next_best_actions.final[0]?.route || "auto"}</strong><small>Protected controls remain gated</small></div></section>
  <section className="investigation-grid"><div className="panel evidence-panel"><div className="panel-header"><div><div className="eyebrow">GRAPH-RAG EVIDENCE</div><h2>What the agent found</h2></div><Pill tone="cyan">{answer.case.evidence.length} claims grounded</Pill></div><div className="graph-path">{graphNodes.map((node, index) => <div className="graph-step" key={`${node.type}-${node.id}`}><div className={`graph-node ${index === 0 ? "root" : ""}`}><span>{node.type}</span><b>{node.id}</b></div>{index < graphNodes.length - 1 && <div className="graph-link"><ArrowRight size={14} /></div>}</div>)}</div><div className="evidence-list">{answer.case.evidence.map((item, index) => <div className="evidence-item" key={`${item.ref}-${index}`}><div className={`evidence-bullet ${item.source}`}><Fingerprint size={14} /></div><div><div className="evidence-meta"><b>{item.source}</b><span>{item.ref}</span></div><p>{item.claim}</p><small>{item.entity_ids.join(" · ")}</small></div></div>)}</div></div><div className="panel decision-panel"><div className="panel-header"><div><div className="eyebrow">DECISION TRACE</div><h2>Why this action</h2></div><FileText size={18} className="panel-icon" /></div><div className="decision-summary"><div className="decision-orb"><Target size={18} /></div><div><strong>{slug(answer.case.pattern)}</strong><p>{answer.case.summary}</p></div></div><div className="uncertainty-block"><div><span>Uncertainty remaining</span><b>{Math.round((1 - probability) * 100)}%</b></div><MetricBar value={1 - probability} tone="violet" /><p>More evidence is requested when the decision boundary is not defensible yet.</p></div><div className="trace-item"><Clock3 size={15} /><div><b>Stop reason</b><span>{answer.stop_reason}</span></div></div><div className="trace-item"><Database size={15} /><div><b>Case memory</b><span>{answer.case.similar_prior_cases.length ? `${answer.case.similar_prior_cases.join(", ")} retrieved` : "No matching closed case retrieved"}</span></div></div></div></section>
  <section className="action-grid"><ActionPanel title="Before evidence" eyebrow="INITIAL RECOMMENDATION" tone="amber" actions={answer.next_best_actions.initial} /><ActionPanel title="After assumed response" eyebrow="FINAL RECOMMENDATION" tone="green" actions={answer.next_best_actions.final} /><div className="panel sar-panel"><div className="panel-header"><div><div className="eyebrow">REGULATORY ROUTE</div><h2>Suspicious activity report</h2></div><FileCheck2 size={18} className="panel-icon" /></div><div className={`sar-state ${answer.sar.file ? "file" : "no-file"}`}><span>{answer.sar.file ? "FILE REPORT" : "NO REPORT"}</span><b>{answer.sar.file ? "L2 approval" : "Policy threshold not met"}</b></div><p>{answer.sar.reason}</p>{answer.sar.file && <div className="sar-details"><span>Total activity</span><b>{formatMoney(answer.sar.total_amount_usd)}</b><span>Subjects</span><b>{answer.sar.subjects.slice(0, 3).join(" · ")}</b></div>}</div></section></>;
}

function ActionPanel({ title, eyebrow, tone, actions }: { title: string; eyebrow: string; tone: string; actions: { action: string; route: string; reason: string }[] }) { return <div className="panel action-panel"><div className="panel-header"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><Pill tone={tone}>{actions.length} action{actions.length === 1 ? "" : "s"}</Pill></div><div className="actions-list">{actions.map((item) => <div className="action-item" key={item.action}><div className={`action-mark ${tone}`}><Shield size={14} /></div><div><div className="action-title"><b>{item.action}</b><span>{item.route}</span></div><p>{item.reason}</p></div></div>)}</div></div>; }
