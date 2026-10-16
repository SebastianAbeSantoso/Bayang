import React, { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, ClipboardCheck, LayoutDashboard, Database, Download, ListChecks, ScrollText, X, Sparkles, RefreshCw, Cpu } from "lucide-react";
import type { AuditEvent, ChecklistItem, Finding, ReportState, Role, ShiftData } from "./data";
import {
  CAFE, CURRENT_SHIFT_ID, SUPERVISOR, SHIFT_TYPE_LABEL, buildInitialDb, categoryComplete, makeEvent, reconcile, shiftById, signoffState, stampTime, bucketOf,
} from "./data";
import Dashboard from "./components/Dashboard";
import WorkerReport from "./components/WorkerReport";
import Ledger, { type CheckAction } from "./components/Ledger";
import Records from "./components/Records";
import AuditLog from "./components/AuditLog";
import Briefing from "./components/Briefing";
import { Tag } from "./components/ui";
import { api, type BackendState, type SystemStatus } from "./api";

type Tab = "dashboard" | "report" | "ledger" | "briefing" | "records" | "audit";

const ROLE_LABEL: Record<Role, string> = { outgoing: "Outgoing lead", incoming: "Incoming lead", supervisor: "Supervisor" };

export default function App() {
  const [db, setDb] = useState<Record<string, ShiftData>>(buildInitialDb);
  const [shiftId, setShiftId] = useState(CURRENT_SHIFT_ID);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [role, setRole] = useState<Role>("outgoing");
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);
  const [showSignoff, setShowSignoff] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [gemmaMode, setGemmaMode] = useState<"live" | "seeded">("live");
  const [isReconciling, setIsReconciling] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const shift = shiftById(shiftId);
  const data = db[shiftId];
  const so = signoffState(data);
  const locked = shift.phase === "upcoming" ? "This shift has not started yet." : data.signedOff ? `Signed off at ${data.signedOffAt}. This shift is read-only.` : null;
  const allEvents = useMemo(() => Object.values(db).flatMap(d => d.audit), [db]);

  const update = (fn: (d: ShiftData) => ShiftData) => setDb(prev => ({ ...prev, [shiftId]: fn(prev[shiftId]) }));
  const ev = (e: Omit<AuditEvent, "id" | "shiftId" | "date" | "time">) => makeEvent(shift, e);
  const me = role === "supervisor" ? `${SUPERVISOR} (Supervisor)` : role === "outgoing" ? shift.outgoing : shift.incoming;

  useEffect(() => {
    api.getStatus().then(setSystemStatus).catch(() => {});
  }, []);

  const switchShift = (id: string) => { setShiftId(id); setSelectedFinding(null); setJustSubmitted(false); };

  const setReport = (report: ReportState) => update(d => ({ ...d, report }));
  const setTasks = (ids: string[], patch: Partial<ChecklistItem>) => update(d => ({ ...d, checklist: d.checklist.map(t => (ids.includes(t.id) ? { ...t, ...patch } : t)) }));

  const submit = async () => {
    setIsReconciling(true);
    setSyncMessage("Google Gemma 3-27B-IT extracting claims on AMD Token Factory...");
    try {
      const notes = data.report.notes.join("\n");
      const res = await api.runReconciliation({
        shift_id: shiftId,
        shift_notes: notes,
        mode: gemmaMode,
        actor: me,
      });

      update(d => {
        const mappedFindings: Finding[] = res.findings.map(bf => {
          const matchingChecks = d.findings.flatMap(f => f.checks).filter(c => c.ruleCode === bf.rule_id || bf.title.includes(c.title));
          const checks = matchingChecks.length > 0 ? matchingChecks : [
            {
              id: `${bf.id}-CHK`,
              title: bf.title,
              ruleCode: bf.rule_id,
              severity: bf.severity === "critical" ? "critical" : bf.severity === "warning" ? "review" : "info",
              evidence: bf.evidence_status === "Supported" ? "supported" : bf.evidence_status === "Contradicted" ? "contradicted" : "unverified",
              workflow: bf.status === "resolved" ? "resolved" : "open",
              reason: bf.explanation,
              requiredAction: bf.rule_id === "RULE_01_UNLOGGED_EQUIPMENT_DOWNTIME" ? "Confirm incident log and assign follow-up" : "Review discrepancy",
            }
          ];
          return {
            id: bf.id,
            title: bf.title,
            category: bf.category === "inventory" ? "stock" : bf.category === "equipment" ? "equipment" : bf.category === "sales" ? "cash" : "customer",
            quote: bf.reported_claim,
            structured: `${bf.rule_name} · ${bf.title}`,
            explanation: bf.explanation,
            unknowns: bf.unknowns || "Physical inspection required.",
            recordIds: (bf.evidence_refs || []).map(r => r.record_id),
            checks,
            aiRecommendation: bf.ai_recommendation ? {
              recommendedOwner: bf.ai_recommendation.recommended_owner,
              recommendedTarget: bf.ai_recommendation.recommended_target,
              recommendedAction: bf.ai_recommendation.recommended_action,
              operationalHazard: bf.ai_recommendation.operational_hazard,
            } : (bf.category === "equipment" ? {
              recommendedOwner: "BaristaPro Service (Technician)",
              recommendedTarget: "Technician visit (Before 07:00 morning rush)",
              recommendedAction: "Perform burr alignment and check motor capacitor clearance",
              operationalHazard: "Risk of grinder motor stall during high-volume morning peak",
            } : undefined),
          };
        });

        const briefing = res.incoming_briefing ? {
          headline: res.incoming_briefing.headline,
          narrative: res.incoming_briefing.narrative,
          deliveryEta: res.incoming_briefing.ice_delivery_eta,
          generatedBy: res.incoming_briefing.generated_by,
          latencyMs: res.incoming_briefing.latency_ms,
        } : undefined;

        const gemmaTelemetry = {
          model: res.reconciliation_meta.model,
          mode: res.reconciliation_meta.mode,
          latencyMs: res.reconciliation_meta.latency_ms,
          extractedClaimsCount: res.reconciliation_meta.total_claims,
        };

        const time = stampTime();
        return {
          ...d,
          submitted: true,
          submittedAt: time.slice(0, 5),
          findings: mappedFindings.length > 0 ? mappedFindings : d.findings,
          incomingBriefing: briefing,
          gemmaTelemetry,
          audit: [
            ...d.audit,
            ev({
              actor: "Claim Extractor (Google Gemma 3-27B-IT · AMD)",
              actorKind: "system",
              type: "claim",
              action: `Extracted ${res.claims.length} claims on AMD Token Factory (${res.reconciliation_meta.latency_ms}ms)`,
              explanation: `Mode: ${res.reconciliation_meta.mode}. Exact quote spans verified by Anti-Hallucination Gate.`,
            }),
          ],
        };
      });
    } catch (err) {
      console.warn("Backend reconciliation API error, using deterministic local engine fallback", err);
      update(d => {
        const time = stampTime();
        const pre: AuditEvent[] = [
          { ...ev({ actor: shift.outgoing, actorKind: "human", type: "report", action: "Shift report submitted", explanation: `All 5 categories answered. ${d.report.notes.length} note(s).` }), time },
          ...d.report.notes.map(n => ev({ actor: shift.outgoing, actorKind: "human", type: "note", action: "Original worker note recorded", explanation: `“${n}”` })),
        ];
        const r = reconcile(shift, { ...d, audit: [] });
        return { ...d, submitted: true, submittedAt: time.slice(0, 5), findings: r.findings, checklist: r.checklist, audit: [...d.audit, ...pre, ...r.events] };
      });
    } finally {
      setIsReconciling(false);
      setSyncMessage(null);
    }
  };

  const act = (findingId: string, checkId: string, action: CheckAction, p: { rationale: string; owner?: string; target?: string }) => {
    // Optimistic backend call
    api.resolveFinding({
      finding_id: findingId,
      action: action === "carry" ? "carry_forward" : action === "resolve" ? "mark_accounted_for" : action === "override" ? "override_with_rationale" : "mark_false_positive",
      rationale: p.rationale,
      actor: me,
      owner_role: p.owner,
      due_time: p.target,
      shift_id: shiftId,
    }).catch(() => {});

    update(d => {
      let linkedTask: string | undefined;
      let title = "";
      const findings = d.findings.map(f => f.id !== findingId ? f : {
        ...f,
        checks: f.checks.map(c => {
          if (c.id !== checkId) return c;
          linkedTask = c.linkedTaskId;
          title = c.title;
          if (action === "carry") return { ...c, workflow: "awaiting_ack" as const, owner: p.owner, target: p.target };
          return { ...c, workflow: "resolved" as const, resolution: action === "resolve" ? "resolved" as const : action };
        }),
      });
      const checklist: ChecklistItem[] = linkedTask && (action === "carry" || action === "resolve") ? d.checklist.map(t => (t.id === linkedTask ? { ...t, done: true, notDone: false } : t)) : d.checklist;
      const type = action === "carry" ? "carried" : action === "resolve" ? "resolved" : action;
      const label = { carry: "Issue carried forward", resolve: "Finding resolved", override: "Override recorded with rationale", false_positive: "Marked false positive with rationale" }[action];
      const events = [ev({ actor: me, actorKind: "human", type, action: label, findingId, explanation: `${title}${p.owner ? ` → ${p.owner} (${p.target})` : ""}${p.rationale ? `. “${p.rationale}”` : ""}` })];
      if (linkedTask && checklist !== d.checklist) events.push(ev({ actor: me, actorKind: "human", type: "task", action: "Task completed", findingId, explanation: `${linkedTask}: follow-up recorded.` }));
      return { ...d, findings, checklist, audit: [...d.audit, ...events] };
    });
  };

  const bulkInfo = (ids: Array<[string, string]>) => update(d => ({
    ...d,
    findings: d.findings.map(f => ({ ...f, checks: f.checks.map(c => (ids.some(([fi, ci]) => fi === f.id && ci === c.id) && bucketOf(c) === "info" && !c.obligation ? { ...c, workflow: "resolved" as const, resolution: "resolved" as const } : c)) })),
    audit: [...d.audit, ...ids.map(([fi, ci]) => ev({ actor: me, actorKind: "human", type: "resolved", action: "Finding resolved", findingId: fi, explanation: `${ci}: routine informational item (bulk).` }))],
  }));

  const acknowledge = () => update(d => ({
    ...d,
    acknowledged: true,
    acknowledgedAt: stampTime().slice(0, 5),
    findings: d.findings.map(f => ({ ...f, checks: f.checks.map(c => (c.workflow === "awaiting_ack" ? { ...c, workflow: "carried_forward" as const } : c)) })),
    audit: [...d.audit, ev({ actor: shift.incoming, actorKind: "human", type: "acknowledged", action: "Incoming shift acknowledged", explanation: "Briefing received. Open items keep their owners and are not resolved by this." })],
  }));

  const signOff = () => {
    api.resolveFinding({
      finding_id: "",
      action: "mark_accounted_for",
      rationale: "Shift sign-off completed by supervisor.",
      actor: `${SUPERVISOR} (Supervisor)`,
      shift_id: shiftId,
      sign_off_shift: true,
    }).catch(() => {});

    update(d => ({ ...d, signedOff: true, signedOffAt: stampTime().slice(0, 5), audit: [...d.audit, ev({ actor: `${SUPERVISOR} (Supervisor)`, actorKind: "human", type: "signoff", action: "Shift sign-off completed", explanation: "No critical blockers or mandatory tasks remained." })] }));
    setShowSignoff(false);
  };

  const reportDone = ["equipment", "stock", "cleaning", "cash", "customer"].filter(c => categoryComplete(data.report, c as "equipment", data.checklist)).length;
  const openChecks = data.findings.flatMap(f => f.checks).filter(c => bucketOf(c)).length;

  const NAV: Array<{ id: Tab; label: string; Icon: typeof ListChecks; meta?: string }> = [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { id: "report", label: "Finish your shift", Icon: ClipboardCheck, meta: data.submitted ? "Sent" : shift.phase === "upcoming" ? "" : `${reportDone}/5` },
    { id: "ledger", label: "Handover ledger", Icon: ListChecks, meta: data.submitted ? String(openChecks) : "" },
    { id: "briefing", label: "Incoming briefing", Icon: ArrowRightLeft, meta: data.acknowledged ? "Ack" : "" },
    { id: "records", label: "Operational records", Icon: Database, meta: String(data.records.length || "") },
    { id: "audit", label: "Audit log", Icon: ScrollText, meta: String(data.audit.length) },
  ];

  const goBlockers = () => {
    if (!data.submitted) { setTab("report"); return; }
    setTab("ledger");
    setSelectedFinding(so.blockers[0]?.finding.id ?? null);
  };

  const signTone = so.status === "signed_off" ? "success" : so.status === "ready" ? "success" : so.status === "blocked" ? "danger" : "neutral";
  const signLabel = shift.phase === "upcoming" ? "Not started" : { signed_off: "Signed off", ready: "Ready", blocked: "Blocked", not_submitted: "Report pending", not_started: "Not started" }[so.status];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-emblem" aria-hidden="true">SG</span>
          <span className="brand-text">
            <span className="brand-name">ShiftGuard</span>
            <span className="brand-sub">{CAFE.name} · {CAFE.branch}</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--paper-200)", padding: "4px 12px", borderRadius: "20px", border: "1px solid var(--paper-400)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--espresso-600)" }}>
            ⚡ Gemma 3-27B-IT <span style={{ color: "var(--ink-500)", fontWeight: 400 }}>· AMD Token Factory</span>
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            style={{ fontSize: "11px", padding: "1px 6px", height: "auto", border: "1px solid var(--paper-500)", borderRadius: "10px" }}
            onClick={() => setGemmaMode(m => m === "live" ? "seeded" : "live")}
            title="Toggle between live AMD Token Factory API and verified recorded run"
          >
            {gemmaMode === "live" ? "● Live AMD API" : "○ Recorded Run"}
          </button>
          {data.gemmaTelemetry?.latencyMs ? (
            <span className="mono-small" style={{ color: "var(--ink-700)" }}>
              {data.gemmaTelemetry.latencyMs}ms
            </span>
          ) : null}
        </div>

        <div className="topbar-right">
          <label className="inline-field">
            <span className="sr-only">Viewing as</span>
            <select className="input input-sm" value={role} onChange={e => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map(r => (
                <option key={r} value={r}>{ROLE_LABEL[r]} · {r === "supervisor" ? SUPERVISOR : r === "outgoing" ? shift.outgoing : shift.incoming}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowExport(true)}>
            <Download className="icon icon-sm" aria-hidden="true" />Export
          </button>
        </div>
      </header>

      {isReconciling && (
        <div style={{ background: "var(--amber-100)", borderBottom: "1px solid var(--amber-300)", padding: "8px 16px", fontSize: "12.5px", textAlign: "center", color: "var(--amber-900)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <span style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid var(--amber-600)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          {syncMessage || "Reconciling shift with Google Gemma on AMD Instinct GPUs..."}
        </div>
      )}

      <div className="body-grid">
        <nav className="sidebar" aria-label="Workbench">
          <div className="sidebar-scroll">
            <p className="sidebar-heading">{SHIFT_TYPE_LABEL[shift.type]} · {shift.dayShort} {shift.dateLabel}</p>
            {NAV.map(({ id, label, Icon, meta }) => (
              <button key={id} type="button" className={`nav-item ${tab === id ? "is-active" : ""}`} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
                <Icon className="icon" aria-hidden="true" />
                <span className="nav-label">{label}</span>
                {meta && <span className="nav-meta">{meta}</span>}
              </button>
            ))}
          </div>

          <section className="signoff" aria-label="Outgoing sign-off">
            <div className="signoff-head">
              <span className="section-label">Outgoing sign-off</span>
              <Tag tone={signTone}>{signLabel}</Tag>
            </div>
            <ol className="signoff-steps">
              <li className={data.submitted ? "is-done" : ""}>Report {data.submitted ? `submitted ${data.submittedAt}` : "not submitted"}</li>
              <li className={data.submitted && so.blockers.length === 0 ? "is-done" : so.blockers.length ? "is-blocked" : ""}>
                {so.blockers.length} critical blocker{so.blockers.length === 1 ? "" : "s"}
              </li>
              <li className={so.tasks.length === 0 ? "is-done" : "is-blocked"}>
                {so.tasks.length} mandatory task{so.tasks.length === 1 ? "" : "s"} incomplete
              </li>
            </ol>
            {!data.signedOff && shift.phase !== "upcoming" && !so.ready && (
              <button type="button" className="link-btn" onClick={goBlockers}>{data.submitted ? "View blocking items" : "Go to shift report"}</button>
            )}
            <button type="button" className="btn btn-success btn-block" disabled={!so.ready || data.signedOff} onClick={() => setShowSignoff(true)}>
              {data.signedOff ? `Signed off ${data.signedOffAt}` : "Sign off shift"}
            </button>
          </section>
        </nav>

        <main className={`main ${tab === "ledger" && selectedFinding ? "main-flush" : ""}`}>
          {tab === "dashboard" && (
            <Dashboard shift={shift} shiftId={shiftId} db={db} justSubmitted={justSubmitted} onSelectShift={switchShift} onNavigate={t => { setJustSubmitted(false); setTab(t); }} />
          )}
          {tab === "report" && (
            <WorkerReport shift={shift} data={data} locked={locked} onReport={setReport} onSetTasks={setTasks} onSubmit={() => { submit(); setJustSubmitted(true); setTab("dashboard"); }} onOpenLedger={() => setTab("ledger")} />
          )}
          {tab === "ledger" && (
            <Ledger shift={shift} data={data} role={role} locked={locked} selectedId={selectedFinding} onSelect={setSelectedFinding} onAction={act} onBulkInfo={bulkInfo} onGoReport={() => setTab("report")} />
          )}
          {tab === "briefing" && <Briefing shift={shift} data={data} locked={locked && !data.signedOff ? locked : null} onStart={acknowledge} />}
          {tab === "records" && <Records key={shiftId} data={data} />}
          {tab === "audit" && <AuditLog events={allEvents} currentShiftId={shiftId} />}
        </main>
      </div>

      {showSignoff && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="so-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="so-title" className="modal-title">Sign off {SHIFT_TYPE_LABEL[shift.type].toLowerCase()} shift?</h3>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setShowSignoff(false)}><X className="icon" aria-hidden="true" /></button>
            </div>
            <p className="modal-sub">
              No critical blockers or mandatory tasks remain. {data.findings.flatMap(f => f.checks).filter(c => c.workflow !== "resolved").length} item(s) stay open with owners and carry into the next shift. The shift becomes read-only.
            </p>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowSignoff(false)}>Cancel</button>
              <button type="button" className="btn btn-success" onClick={signOff}>Sign off as {SUPERVISOR}</button>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ex-title">
          <div className="modal-dialog modal-dialog-wide">
            <div className="modal-header">
              <h3 id="ex-title" className="modal-title">Shift export · {shift.id}</h3>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setShowExport(false)}><X className="icon" aria-hidden="true" /></button>
            </div>
            <pre className="modal-code-preview">{JSON.stringify({ shift, ...data }, null, 2)}</pre>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(JSON.stringify({ shift, ...data }, null, 2))}>Copy JSON</button>
              <button type="button" className="btn btn-primary" onClick={() => setShowExport(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
