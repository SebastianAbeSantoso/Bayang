import React, { useState } from "react";
import { ArrowUpRight, Check, ChevronDown, ChevronUp, CircleCheck, Database, FileText, ListChecks, Wrench } from "lucide-react";
import type { Check as CheckType, ChecklistItem, Finding, Shift, ShiftData } from "../data";
import { allChecks, SHIFT_TYPE_LABEL, SHIFTS, STAFF_NAMES, SUPERVISOR } from "../data";
import { EmptyState, EvidenceTag, PageHeader, SeverityTag, Tag, WorkflowTag } from "./ui";

interface SolvePayload {
  solvedBy: string;
  solvedWhat: string;
  solvedWith: string;
}

interface Props {
  shift: Shift;
  data: ShiftData;
  locked: string | null;
  onStart: () => void;
  onChangeStaff: (which: "outgoing" | "incoming", newName: string) => void;
  onOpenFinding: (findingId: string) => void;
  onOpenRecord: (recordId: string) => void;
  onOpenReport: () => void;
  onSolveCheck: (findingId: string, checkId: string, payload: SolvePayload) => void;
  onSolveTask: (taskId: string, payload: SolvePayload) => void;
}

const QUICK_SOLUTIONS: Record<string, string[]> = {
  equipment: [
    "Inspected machine, cleared burr/line jam, ran test calibration shots",
    "Booked BaristaPro technician visit & tagged backup grinder for morning peak",
    "Verified incident log entry & assigned morning warm-up pressure check",
  ],
  stock: [
    "Recounted physical stock, posted POS waste adjustment & updated ERP",
    "Confirmed emergency transfer of 2 bags of ice before 07:00 rush",
    "Verified expiry discard log with supervisor approval",
  ],
  cash: [
    "Verified manager comp approval slip & attached reason to POS order",
    "Recounted cash drawer & reconciled register close sheet",
  ],
  cleaning: [
    "Completed missed deep-clean & sanitization before opening bar",
    "Logged exception approval & scheduled pre-open sanitation check",
  ],
  customer: [
    "Followed up directly & logged resolution in store handover book",
  ],
};

export default function Briefing({
  shift,
  data,
  locked,
  onStart,
  onChangeStaff,
  onOpenFinding,
  onOpenRecord,
  onOpenReport,
  onSolveCheck,
  onSolveTask,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [solvedByDraft, setSolvedByDraft] = useState<string>(shift.incoming);
  const [solvedWhatDraft, setSolvedWhatDraft] = useState<string>("");
  const [solvedWithDraft, setSolvedWithDraft] = useState<string>("");
  const [customStaffMode, setCustomStaffMode] = useState(false);
  const [customStaffDraft, setCustomStaffDraft] = useState("");

  if (!data.submitted)
    return (
      <>
        <PageHeader title="Incoming briefing" />
        <EmptyState title="Briefing not ready" body={`It is built from ${shift.outgoing}'s shift report once it is completed.`} />
      </>
    );

  const idx = SHIFTS.findIndex(s => s.id === shift.id);
  const next = idx > 0 ? SHIFTS[idx - 1] : null;
  const all = allChecks(data);
  const open = all.filter(x => x.check.workflow !== "resolved");
  const attention = all.filter(x => x.check.severity !== "info" || x.finding.category === "equipment" || x.check.solvedBy);
  const stock = all.filter(x => x.finding.category === "stock" && x.check.severity === "info" && !attention.some(a => a.check.id === x.check.id));
  const tasks = data.checklist.filter(t => !t.done || t.solvedBy);
  const deliveries = data.records.filter(r => r.id.startsWith("PO-") && r.availability === "available");
  const comingUp = open.filter(x => x.check.owner && (x.check.target === "Technician visit" || x.finding.category === "customer"));
  const carried = all.filter(x => x.check.owner);

  const staffOptions = Array.from(new Set([
    shift.incoming,
    shift.outgoing,
    ...STAFF_NAMES,
    `${SUPERVISOR} (Supervisor)`,
  ]));

  const toggleExpandCheck = (finding: Finding, check: CheckType) => {
    if (expandedId === check.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(check.id);
    setSolvedByDraft(check.solvedBy || shift.incoming);
    setSolvedWhatDraft(check.solvedWhat || check.title || finding.title);
    setSolvedWithDraft(check.solvedWith || check.requiredAction || "");
  };

  const toggleExpandTask = (t: ChecklistItem) => {
    const key = `TASK-${t.id}`;
    if (expandedId === key) {
      setExpandedId(null);
      return;
    }
    setExpandedId(key);
    setSolvedByDraft(t.solvedBy || shift.incoming);
    setSolvedWhatDraft(t.solvedWhat || `Completed closing task: ${t.label}`);
    setSolvedWithDraft(t.solvedWith || "Completed & verified during incoming shift handover");
  };

  const formatCheckHeading = (finding: Finding, check: CheckType) => {
    const fTitle = finding.title.trim();
    const cTitle = check.title.trim();
    if (!cTitle || fTitle.toLowerCase() === cTitle.toLowerCase() || fTitle.toLowerCase().includes(cTitle.toLowerCase())) {
      return fTitle;
    }
    if (cTitle.toLowerCase().includes(fTitle.toLowerCase())) {
      return cTitle;
    }
    return `${fTitle} — ${cTitle}`;
  };

  return (
    <div className="briefing">
      <PageHeader
        title="Incoming briefing"
        subtitle={`Handover from ${shift.outgoing} (${SHIFT_TYPE_LABEL[shift.type]} · ${shift.id})${next ? ` → ${SHIFT_TYPE_LABEL[next.type]}, ${next.dayShort} ${next.dateLabel}` : ""}`}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px" }}>
            <span className="muted-text">Incoming lead:</span>
            {!customStaffMode ? (
              <select
                aria-label="Incoming shift lead"
                className="input input-sm"
                value={shift.incoming}
                onChange={e => {
                  if (e.target.value === "__custom__") {
                    setCustomStaffMode(true);
                    setCustomStaffDraft("");
                  } else {
                    onChangeStaff("incoming", e.target.value);
                  }
                }}
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  height: "30px",
                  width: "auto",
                  background: "var(--paper-0)",
                  border: "1px solid var(--paper-400)",
                  borderRadius: "6px",
                }}
              >
                {Array.from(new Set([...STAFF_NAMES, shift.incoming, shift.outgoing])).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                <option value="__custom__">+ Replace staff (cover)…</option>
              </select>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <input
                  className="input input-sm"
                  placeholder="Replacement name…"
                  value={customStaffDraft}
                  onChange={e => setCustomStaffDraft(e.target.value)}
                  style={{ width: "130px", height: "30px", fontSize: "12.5px" }}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  onClick={() => {
                    const trimmed = customStaffDraft.trim();
                    if (trimmed) onChangeStaff("incoming", trimmed);
                    setCustomStaffMode(false);
                  }}
                >
                  Save
                </button>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setCustomStaffMode(false)}>
                  Cancel
                </button>
              </span>
            )}
          </div>
          {data.acknowledged ? (
            <Tag tone="success">Acknowledged by {shift.incoming} at {data.acknowledgedAt}</Tag>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onStart} disabled={!!locked}>
              Acknowledge & start shift ({shift.incoming})
            </button>
          )}
        </div>
      </PageHeader>

      {data.acknowledged && (
        <p className="notice notice-neutral">
          <CircleCheck className="icon icon-sm" aria-hidden="true" />
          {shift.incoming} confirmed receiving this briefing. Click any item in <strong>Needs attention</strong> below to record how it was solved or open its Handover Ledger finding.
        </p>
      )}
      {!data.acknowledged && (
        <p className="muted-text">
          Click any item under <strong>Needs attention</strong> to solve it (record who solved it, what was solved, and what it was solved with) or open the corresponding Handover Ledger finding.
        </p>
      )}

      <section className="brief-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
          <h3 className="group-title" style={{ margin: 0 }}>Needs attention</h3>
          <span className="muted-text" style={{ fontSize: "12px" }}>Click any item to solve or open in Handover Ledger</span>
        </div>
        {attention.length + stock.length + tasks.length === 0 ? <p className="muted-text">Nothing outstanding.</p> : (
          <ul className="brief-list">
            {[...attention, ...stock].map(({ finding, check }) => {
              const isExpanded = expandedId === check.id;
              const isSolved = check.workflow === "resolved" || !!check.solvedBy;
              const suggestions = QUICK_SOLUTIONS[finding.category] || QUICK_SOLUTIONS.equipment;
              return (
                <li
                  key={check.id}
                  className={`brief-item ${check.severity === "critical" && !isSolved ? "is-critical" : ""}`}
                  style={{ flexDirection: "column", alignItems: "stretch", gap: "10px", padding: "12px 14px" }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpandCheck(finding, check)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpandCheck(finding, check); } }}
                    style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", cursor: "pointer", width: "100%" }}
                  >
                    <div className="brief-item-main" style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
                        <span className="mono-label" style={{ background: "var(--paper-200)", padding: "1px 6px", borderRadius: "4px", fontSize: "11px" }}>
                          {finding.id}
                        </span>
                        <span className="brief-item-title">{formatCheckHeading(finding, check)}</span>
                      </div>
                      <span className="muted-text">
                        {isSolved && check.solvedBy ? (
                          <span style={{ color: "#166534", fontWeight: 500 }}>
                            ✓ Solved by {check.solvedBy}{check.solvedAt ? ` at ${check.solvedAt}` : ""} · {check.solvedWhat || check.title} — via “{check.solvedWith}”
                          </span>
                        ) : (
                          <>
                            {check.owner ? `Owner: ${check.owner}` : "No owner yet"} · Next: {check.requiredAction ?? check.obligation ?? "Review discrepancy"}
                          </>
                        )}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      <SeverityTag value={check.severity} />
                      <WorkflowTag value={check.workflow} />
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={e => { e.stopPropagation(); toggleExpandCheck(finding, check); }}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px" }}
                      >
                        {isExpanded ? <ChevronUp className="icon icon-sm" /> : <ChevronDown className="icon icon-sm" />}
                        {isSolved ? "Details" : "Solve / Open"}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        borderTop: "1px solid var(--paper-300)",
                        paddingTop: "12px",
                        marginTop: "2px",
                        background: "var(--paper-50)",
                        borderRadius: "6px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12px" }}>
                          <span className="mono-label">Rule: {check.ruleCode}</span>
                          <EvidenceTag value={check.evidence} />
                          {finding.recordIds.length > 0 && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                              <span className="muted-text">Sources:</span>
                              {finding.recordIds.map(rid => (
                                <button
                                  key={rid}
                                  type="button"
                                  className="btn btn-ghost btn-xs mono"
                                  onClick={() => onOpenRecord(rid)}
                                  style={{ fontSize: "11px", padding: "1px 6px", border: "1px solid var(--paper-400)", borderRadius: "4px" }}
                                  title={`Open record ${rid} in Operational Records`}
                                >
                                  {rid} ↗
                                </button>
                              ))}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenFinding(finding.id)}
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                        >
                          <ListChecks className="icon icon-sm" aria-hidden="true" />
                          Open {finding.id} in Handover Ledger
                          <ArrowUpRight className="icon icon-sm" aria-hidden="true" />
                        </button>
                      </div>

                      <p className="body-text" style={{ fontSize: "12.5px", color: "var(--ink-700)", margin: 0 }}>
                        {check.reason || finding.explanation}
                      </p>

                      <div className="field-grid field-grid-3" style={{ gap: "10px" }}>
                        <label className="field">
                          <span className="field-label">Solved by (Who)</span>
                          <select
                            className="input input-sm"
                            value={solvedByDraft}
                            onChange={e => setSolvedByDraft(e.target.value)}
                          >
                            {staffOptions.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field" style={{ gridColumn: "span 2" }}>
                          <span className="field-label">What is solved</span>
                          <input
                            className="input input-sm"
                            value={solvedWhatDraft}
                            onChange={e => setSolvedWhatDraft(e.target.value)}
                            placeholder="Describe the discrepancy or issue being resolved…"
                          />
                        </label>
                      </div>

                      <label className="field">
                        <span className="field-label">What it is solved with (Action / Evidence / Reference)</span>
                        <input
                          className="input input-sm"
                          value={solvedWithDraft}
                          onChange={e => setSolvedWithDraft(e.target.value)}
                          placeholder="e.g. Verified manager comp approval slip #44, recounted physical stock, or completed task…"
                        />
                      </label>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "11px", color: "var(--ink-500)" }}>Quick fill:</span>
                        {suggestions.map((sug, i) => (
                          <button
                            key={i}
                            type="button"
                            className="btn btn-ghost btn-xs"
                            style={{ fontSize: "11px", border: "1px solid var(--paper-400)", borderRadius: "999px", padding: "2px 8px" }}
                            onClick={() => setSolvedWithDraft(sug)}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", marginTop: "2px" }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedId(null)}>
                          Close
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!solvedWhatDraft.trim() || !solvedWithDraft.trim()}
                          onClick={() => {
                            onSolveCheck(finding.id, check.id, {
                              solvedBy: solvedByDraft,
                              solvedWhat: solvedWhatDraft.trim(),
                              solvedWith: solvedWithDraft.trim(),
                            });
                            setExpandedId(null);
                          }}
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          <Check className="icon icon-sm" aria-hidden="true" />
                          {isSolved ? "Update resolution" : "Mark solved"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}

            {tasks.map(t => {
              const key = `TASK-${t.id}`;
              const isExpanded = expandedId === key;
              const isSolved = t.done && !!t.solvedBy;
              const linkedFinding = data.findings.find(f => f.checks.some(c => c.linkedTaskId === t.id) || f.recordIds.includes(t.id));
              return (
                <li
                  key={t.id}
                  className="brief-item"
                  style={{ flexDirection: "column", alignItems: "stretch", gap: "10px", padding: "12px 14px" }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpandTask(t)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpandTask(t); } }}
                    style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", cursor: "pointer", width: "100%" }}
                  >
                    <div className="brief-item-main" style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
                        <span className="mono-label" style={{ background: "var(--paper-200)", padding: "1px 6px", borderRadius: "4px", fontSize: "11px" }}>
                          {t.id}
                        </span>
                        <span className="brief-item-title">
                          {isSolved ? `Task completed: ${t.label}` : `Task not done: ${t.label}`}
                        </span>
                      </div>
                      <span className="muted-text">
                        {isSolved ? (
                          <span style={{ color: "#166534", fontWeight: 500 }}>
                            ✓ Solved by {t.solvedBy}{t.solvedAt ? ` at ${t.solvedAt}` : ""} · {t.solvedWhat} — via “{t.solvedWith}”
                          </span>
                        ) : (
                          <>
                            {t.mandatory ? "Mandatory" : "Optional"} · {t.id}{t.reason ? ` · Reported reason: “${t.reason}”` : ""}
                          </>
                        )}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      <Tag tone={isSolved ? "success" : t.mandatory ? "warning" : "neutral"}>
                        {isSolved ? "Solved" : t.mandatory ? "Mandatory task" : "Optional task"}
                      </Tag>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={e => { e.stopPropagation(); toggleExpandTask(t); }}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px" }}
                      >
                        {isExpanded ? <ChevronUp className="icon icon-sm" /> : <ChevronDown className="icon icon-sm" />}
                        {isSolved ? "Details" : "Solve / Open"}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        borderTop: "1px solid var(--paper-300)",
                        paddingTop: "12px",
                        marginTop: "2px",
                        background: "var(--paper-50)",
                        borderRadius: "6px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {linkedFinding && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                          <span className="mono-small">Linked Handover Finding: {linkedFinding.id} ({linkedFinding.title})</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onOpenFinding(linkedFinding.id)}
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                          >
                            <ListChecks className="icon icon-sm" aria-hidden="true" />
                            Open {linkedFinding.id} in Handover Ledger
                            <ArrowUpRight className="icon icon-sm" aria-hidden="true" />
                          </button>
                        </div>
                      )}

                      <div className="field-grid field-grid-3" style={{ gap: "10px" }}>
                        <label className="field">
                          <span className="field-label">Solved by (Who)</span>
                          <select
                            className="input input-sm"
                            value={solvedByDraft}
                            onChange={e => setSolvedByDraft(e.target.value)}
                          >
                            {staffOptions.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field" style={{ gridColumn: "span 2" }}>
                          <span className="field-label">What is solved</span>
                          <input
                            className="input input-sm"
                            value={solvedWhatDraft}
                            onChange={e => setSolvedWhatDraft(e.target.value)}
                          />
                        </label>
                      </div>

                      <label className="field">
                        <span className="field-label">What it is solved with (How / Verification)</span>
                        <input
                          className="input input-sm"
                          value={solvedWithDraft}
                          onChange={e => setSolvedWithDraft(e.target.value)}
                          placeholder="e.g. Soaked & sanitized right steam wand before opening bar…"
                        />
                      </label>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "11px", color: "var(--ink-500)" }}>Quick fill:</span>
                        {QUICK_SOLUTIONS.cleaning.map((sug, i) => (
                          <button
                            key={i}
                            type="button"
                            className="btn btn-ghost btn-xs"
                            style={{ fontSize: "11px", border: "1px solid var(--paper-400)", borderRadius: "999px", padding: "2px 8px" }}
                            onClick={() => setSolvedWithDraft(sug)}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedId(null)}>
                          Close
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!solvedWhatDraft.trim() || !solvedWithDraft.trim()}
                          onClick={() => {
                            onSolveTask(t.id, {
                              solvedBy: solvedByDraft,
                              solvedWhat: solvedWhatDraft.trim(),
                              solvedWith: solvedWithDraft.trim(),
                            });
                            setExpandedId(null);
                          }}
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          <Check className="icon icon-sm" aria-hidden="true" />
                          {isSolved ? "Update task resolution" : "Mark task solved"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="brief-section">
        <h3 className="group-title">Coming up</h3>
        {deliveries.length + comingUp.length === 0 ? <p className="muted-text">No scheduled deliveries or visits.</p> : (
          <ul className="brief-list">
            {deliveries.map(d => (
              <li key={d.id} className="brief-item" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <div className="brief-item-main">
                  <span className="brief-item-title">Delivery: {d.fields[0][1]}</span>
                  <span className="muted-text">{d.fields[1][1]} · {d.location} · <span className="mono">{d.id}</span></span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => onOpenRecord(d.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", border: "1px solid var(--paper-400)", borderRadius: "6px", padding: "3px 8px" }}
                >
                  <Database className="icon icon-sm" aria-hidden="true" />
                  View PO ({d.id}) ↗
                </button>
              </li>
            ))}
            {comingUp.map(({ finding, check }) => (
              <li key={check.id} className="brief-item" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <div className="brief-item-main">
                  <span className="brief-item-title">{check.target}: {finding.title}</span>
                  <span className="muted-text">Owner: {check.owner} · Ledger: {finding.id}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => onOpenFinding(finding.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", border: "1px solid var(--paper-400)", borderRadius: "6px", padding: "3px 8px" }}
                >
                  <ListChecks className="icon icon-sm" aria-hidden="true" />
                  Open {finding.id} ↗
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="brief-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
          <h3 className="group-title" style={{ margin: 0 }}>Context & Ledger Traceability</h3>
          <span className="muted-text" style={{ fontSize: "12px" }}>
            Linked to {SHIFT_TYPE_LABEL[shift.type]} Shift ({shift.id}) Handover Ledger & Operational Records
          </span>
        </div>

        {data.report.notes.length > 0 && data.report.notes.map((n, i) => (
          <blockquote
            key={i}
            className="quote"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}
          >
            <span>
              “{n}” <span className="mono-small">— {shift.outgoing}, {SHIFT_TYPE_LABEL[shift.type].toLowerCase()} shift note ({shift.id})</span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={onOpenReport}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", border: "1px solid var(--paper-400)", borderRadius: "6px", padding: "3px 8px", flexShrink: 0 }}
            >
              <FileText className="icon icon-sm" aria-hidden="true" />
              Open Shift Report ({shift.id}) ↗
            </button>
          </blockquote>
        ))}

        <ul className="brief-list">
          {data.findings.filter(f => f.quote).map(f => (
            <li key={f.id} className="brief-item" style={{ alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div className="brief-item-main" style={{ flex: 1 }}>
                <span className="brief-item-title">“{f.quote}”</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  <span className="muted-text" style={{ fontSize: "12px" }}>
                    Prompted by <strong>{SHIFT_TYPE_LABEL[shift.type]} Handover Ledger</strong>:
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => onOpenFinding(f.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "var(--espresso-600)",
                      background: "var(--paper-200)",
                      border: "1px solid var(--paper-400)",
                      borderRadius: "4px",
                      padding: "1px 7px",
                    }}
                    title={`Open Finding ${f.id} in Handover Ledger`}
                  >
                    {f.id} · {f.title} ↗
                  </button>
                  {f.recordIds.length > 0 && (
                    <>
                      <span className="muted-text" style={{ fontSize: "12px" }}>· Sources:</span>
                      {f.recordIds.map(rid => (
                        <button
                          key={rid}
                          type="button"
                          className="btn btn-ghost btn-xs mono"
                          onClick={() => onOpenRecord(rid)}
                          style={{
                            fontSize: "11px",
                            padding: "1px 6px",
                            border: "1px solid var(--paper-400)",
                            borderRadius: "4px",
                            background: "var(--paper-0)",
                          }}
                          title={`Inspect source ${rid} in Operational Records`}
                        >
                          {rid} ↗
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onOpenFinding(f.id)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", flexShrink: 0 }}
              >
                <ListChecks className="icon icon-sm" aria-hidden="true" />
                Open in Ledger ({f.id})
                <ArrowUpRight className="icon icon-sm" aria-hidden="true" />
              </button>
            </li>
          ))}

          {carried.map(({ finding, check }) => (
            <li key={check.id + "c"} className="brief-item" style={{ alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div className="brief-item-main" style={{ flex: 1 }}>
                <span className="brief-item-title">Carried forward: { formatCheckHeading(finding, check) }</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  <span className="muted-text" style={{ fontSize: "12px" }}>
                    Owner: <strong>{check.owner}</strong>{check.target ? ` (${check.target})` : ""} · From Ledger:
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => onOpenFinding(finding.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "var(--espresso-600)",
                      background: "var(--paper-200)",
                      border: "1px solid var(--paper-400)",
                      borderRadius: "4px",
                      padding: "1px 7px",
                    }}
                  >
                    {finding.id} · {finding.title} ↗
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <WorkflowTag value={check.workflow} />
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => onOpenFinding(finding.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", border: "1px solid var(--paper-400)", borderRadius: "6px", padding: "3px 8px" }}
                >
                  Open {finding.id} ↗
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
