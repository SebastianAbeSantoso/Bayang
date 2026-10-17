import React, { useEffect, useState } from "react";
import { ChevronRight, Plus, X } from "lucide-react";
import type { Bucket, Check, Evidence, Finding, Severity, Shift, ShiftData } from "../data";
import { STAFF, bucketOf, EVIDENCE_LABEL, STAFF_NAMES, SUPERVISOR } from "../data";
import { EmptyState, EvidenceTag, PageHeader, SeverityTag, Tag, WorkflowTag } from "./ui";

export type CheckAction = "resolve" | "carry" | "override" | "false_positive";
type Filter = "all" | Bucket | "carried" | "resolved";

const BUCKETS: Array<{ id: Bucket; label: string; hint: string }> = [
  { id: "critical", label: "Critical blockers", hint: "Need action before sign-off" },
  { id: "review", label: "Needs review", hint: "Check before closing" },
  { id: "pending", label: "Supported, follow-up pending", hint: "Claim confirmed, task remains" },
  { id: "info", label: "Informational", hint: "Low priority" },
];

const matches = (f: Finding, filter: Filter) => {
  if (filter === "all") return true;
  if (filter === "resolved") return f.checks.every(c => c.workflow === "resolved");
  if (filter === "carried") return f.checks.some(c => c.workflow === "awaiting_ack" || c.workflow === "carried_forward");
  return f.checks.some(c => bucketOf(c) === filter);
};

const toneOf = (f: Finding) => {
  const b = f.checks.map(bucketOf);
  if (b.includes("critical")) return "critical";
  if (b.includes("review")) return "review";
  if (b.some(Boolean)) return "info";
  return "resolved";
};

export interface NewFindingInput {
  title: string;
  category: Finding["category"];
  severity: Severity;
  evidence: Evidence;
  ruleCode: string;
  quote: string;
  explanation: string;
  requiredAction: string;
  recordId: string;
  actor: string;
}

interface Props {
  shift: Shift;
  data: ShiftData;
  locked: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAction: (findingId: string, checkId: string, action: CheckAction, payload: { rationale: string; owner?: string; target?: string; actor?: string }) => void;
  onBulkInfo: (ids: Array<[string, string]>) => void;
  onGoReport: () => void;
  onOpenRecord?: (recordId: string) => void;
  onAddFinding?: (input: NewFindingInput) => void;
}

export default function Ledger({ shift, data, locked, selectedId, onSelect, onAction, onBulkInfo, onGoReport, onOpenRecord, onAddFinding }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [draft, setDraft] = useState<NewFindingInput>({
    title: "",
    category: "stock",
    severity: "review",
    evidence: "unverified",
    ruleCode: "R-OPS-MANUAL",
    quote: "",
    explanation: "",
    requiredAction: "Verify during incoming shift handover",
    recordId: "PO-4481",
    actor: shift.outgoing,
  });

  const checks = data.findings.flatMap(f => f.checks.map(c => ({ f, c })));
  const count = (b: Bucket) => checks.filter(x => bucketOf(x.c) === b).length;
  const countF = (fl: Filter) => data.findings.filter(f => matches(f, fl)).length;
  const list = data.findings.filter(f => matches(f, filter));
  const selected = data.findings.find(f => f.id === selectedId) ?? null;
  const eligibleInfo = checks.filter(x => bucketOf(x.c) === "info" && !x.c.obligation);

  const actorOptions = Array.from(new Set([
    shift.outgoing,
    shift.incoming,
    ...STAFF_NAMES,
  ]));

  const openAddModal = () => {
    setDraft({
      title: "",
      category: "stock",
      severity: "review",
      evidence: "unverified",
      ruleCode: "R-OPS-MANUAL",
      quote: "",
      explanation: "",
      requiredAction: "Inspect & verify during incoming briefing",
      recordId: "PO-4481",
      actor: shift.outgoing,
    });
    setShowAddFinding(true);
  };

  if (!data.submitted && data.findings.length === 0) {
    return (
      <>
        <PageHeader title="Handover ledger" subtitle="Worker claims and operational issues checked against the shift records.">
          {!locked && onAddFinding && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={openAddModal}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Plus className="icon icon-sm" aria-hidden="true" />
              + Add Ledger Issue
            </button>
          )}
        </PageHeader>
        <EmptyState
          title="No report completed yet"
          body={shift.phase === "upcoming" ? "This shift has not started." : `Findings appear here once ${shift.outgoing} completes the shift report, or you can log an operational issue directly.`}
          action={
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
              {shift.phase !== "upcoming" && (
                <button type="button" className="btn btn-primary" onClick={onGoReport}>
                  Go to shift report
                </button>
              )}
              {!locked && onAddFinding && (
                <button type="button" className="btn btn-secondary" onClick={openAddModal}>
                  + Log operational issue directly
                </button>
              )}
            </div>
          }
        />
        {showAddFinding && onAddFinding && (
          <AddFindingModal
            draft={draft}
            setDraft={setDraft}
            actorOptions={actorOptions}
            onClose={() => setShowAddFinding(false)}
            onSave={() => {
              onAddFinding(draft);
              setShowAddFinding(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className={`ledger ${selected ? "has-drawer" : ""}`}>
      <div className="ledger-main">
        <PageHeader
          title="Handover ledger"
          subtitle="Worker claims and operational checks reconciled against shift records. Issues added here or flagged from Operational Records flow directly into the Incoming Briefing."
        >
          {!locked && onAddFinding && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openAddModal}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Plus className="icon icon-sm" aria-hidden="true" />
              + Add Ledger Issue
            </button>
          )}
        </PageHeader>

        <div className="triage" role="group" aria-label="Triage summary">
          {BUCKETS.map(b => {
            const n = count(b.id);
            return (
              <button
                key={b.id}
                type="button"
                className={`triage-cell triage-${b.id} ${filter === b.id ? "is-active" : ""} ${n === 0 ? "is-zero" : ""}`}
                onClick={() => setFilter(filter === b.id ? "all" : b.id)}
                aria-pressed={filter === b.id}
              >
                <span className="triage-num">{n}</span>
                <span className="triage-label">{b.label}</span>
                <span className="triage-hint">{b.hint}</span>
              </button>
            );
          })}
        </div>

        <div className="toolbar">
          <div className="segmented" role="tablist" aria-label="Filter findings">
            {(["all", "critical", "review", "pending", "info", "carried", "resolved"] as Filter[]).map(fl => (
              <button key={fl} type="button" role="tab" aria-selected={filter === fl} className={`segment ${filter === fl ? "is-active" : ""}`} onClick={() => setFilter(fl)}>
                {{ all: "All", critical: "Critical", review: "Review", pending: "Follow-up", info: "Info", carried: "Carried", resolved: "Resolved" }[fl]}
                <span className="segment-count">{countF(fl)}</span>
              </button>
            ))}
          </div>
          {eligibleInfo.length > 0 && !locked && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onBulkInfo(eligibleInfo.map(x => [x.f.id, x.c.id]))} title="Only informational checks without follow-up are included">
              Resolve {eligibleInfo.length} informational
            </button>
          )}
        </div>

        {list.length === 0 ? (
          <EmptyState title="Nothing in this view" body="Try another filter." />
        ) : (
          <ul className="finding-list">
            {list.map(f => (
              <li key={f.id}>
                <button type="button" className={`finding tone-${toneOf(f)} ${selectedId === f.id ? "is-selected" : ""}`} onClick={() => onSelect(f.id)}>
                  <div className="finding-top">
                    <span className="mono-label">{f.id}</span>
                    <span className="finding-title">{f.title}</span>
                    <ChevronRight className="icon icon-sm finding-chevron" aria-hidden="true" />
                  </div>
                  {f.quote && <p className="finding-quote">“{f.quote}”</p>}
                  <ul className="check-pills">
                    {f.checks.map(c => (
                      <li key={c.id} className={`check-pill ${c.workflow === "resolved" ? "is-resolved" : ""}`}>
                        <span className="check-pill-title">{c.title}</span>
                        <SeverityTag value={c.severity} />
                        <EvidenceTag value={c.evidence} />
                        <WorkflowTag value={c.workflow} />
                      </li>
                    ))}
                  </ul>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <FindingDrawer key={selected.id} shift={shift} finding={selected} data={data} locked={locked} onClose={() => onSelect(null)} onAction={onAction} onOpenRecord={onOpenRecord} />
      )}

      {showAddFinding && onAddFinding && (
        <AddFindingModal
          draft={draft}
          setDraft={setDraft}
          actorOptions={actorOptions}
          onClose={() => setShowAddFinding(false)}
          onSave={() => {
            onAddFinding(draft);
            setShowAddFinding(false);
          }}
        />
      )}
    </div>
  );
}

function AddFindingModal({
  draft,
  setDraft,
  actorOptions,
  onClose,
  onSave,
}: {
  draft: NewFindingInput;
  setDraft: React.Dispatch<React.SetStateAction<NewFindingInput>>;
  actorOptions: string[];
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-finding-title">
      <div className="modal-dialog modal-dialog-wide">
        <div className="modal-header">
          <h3 id="add-finding-title" className="modal-title">Add Operational Issue to Handover Ledger</h3>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X className="icon" aria-hidden="true" />
          </button>
        </div>
        <p className="modal-sub">
          Log an issue directly in the Handover Ledger (e.g., supplier delivery discrepancy, failed hygiene check, equipment fault, or stock variance). It will automatically appear in the <strong>Incoming briefing</strong>.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          <span style={{ fontSize: "11.5px", color: "var(--ink-500)", fontWeight: 600 }}>Quick presets:</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            style={{ border: "1px solid var(--paper-400)", borderRadius: "999px", padding: "2px 10px", fontSize: "11.5px" }}
            onClick={() =>
              setDraft({
                ...draft,
                title: "Delivery discrepancy: Tube ice PO-4481 arriving after 07:00 rush",
                category: "stock",
                severity: "critical",
                evidence: "supported",
                ruleCode: "R-SUP-4481",
                quote: "Tube ice at 0 bags; PO-4481 scheduled 10:00 AM leaves 3-hour morning gap",
                explanation: "Arctic Ice Co. delivery PO-4481 (5 bags) arrives at 10:00 AM, leaving the 07:00–10:00 peak rush with 0 bags of ice.",
                requiredAction: "Transfer 2 emergency bags from Kemang branch before 07:00 AM",
                recordId: "PO-4481",
              })
            }
          >
            Tube Ice Delivery Gap (PO-4481)
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            style={{ border: "1px solid var(--paper-400)", borderRadius: "999px", padding: "2px 10px", fontSize: "11.5px" }}
            onClick={() =>
              setDraft({
                ...draft,
                title: "Operational hygiene check: Milk chiller temperature drift (5.4°C)",
                category: "cleaning",
                severity: "review",
                evidence: "unverified",
                ruleCode: "R-HYG-002",
                quote: "Under-counter milk chiller reading 5.4°C after afternoon rush door openings",
                explanation: "Target cold-chain threshold is ≤ 4.0°C. Condenser coil dust buildup or door gasket wear may be reducing cooling efficiency.",
                requiredAction: "Verify chiller reaches ≤ 4.0°C at opening & vacuum condenser intake screen",
                recordId: "SCH-HYG-01",
              })
            }
          >
            Milk Chiller Hygiene Check
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            style={{ border: "1px solid var(--paper-400)", borderRadius: "999px", padding: "2px 10px", fontSize: "11.5px" }}
            onClick={() =>
              setDraft({
                ...draft,
                title: "Friday ingredient truck cold-storage space prep required",
                category: "stock",
                severity: "review",
                evidence: "supported",
                ruleCode: "R-SCH-FRI",
                quote: "Weekly Friday 08:00 truck arriving with 24 oat milk cartons & 10kg house blend",
                explanation: "Cold room shelf B needs FIFO rotation before the Friday 08:00 supply truck unloads.",
                requiredAction: "Clear & rotate cold-room shelf B before 08:00 Friday truck pickup",
                recordId: "SCH-FRI-TRUCK",
              })
            }
          >
            Friday Truck Storage Prep
          </button>
        </div>

        <div className="field-grid field-grid-3" style={{ gap: "10px", marginBottom: "10px" }}>
          <label className="field" style={{ gridColumn: "span 2" }}>
            <span className="field-label">Issue Title</span>
            <input
              className="input input-sm"
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Delivery discrepancy or hygiene check exception…"
            />
          </label>
          <label className="field">
            <span className="field-label">Logged by</span>
            <select className="input input-sm" value={draft.actor} onChange={e => setDraft({ ...draft, actor: e.target.value })}>
              {actorOptions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="field-grid field-grid-3" style={{ gap: "10px", marginBottom: "10px" }}>
          <label className="field">
            <span className="field-label">Category</span>
            <select
              className="input input-sm"
              value={draft.category}
              onChange={e => setDraft({ ...draft, category: e.target.value as Finding["category"] })}
            >
              <option value="equipment">Equipment</option>
              <option value="stock">Stock & Deliveries</option>
              <option value="cleaning">Hygiene & Cleaning</option>
              <option value="cash">Cash & POS</option>
              <option value="customer">Customer</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Severity</span>
            <select
              className="input input-sm"
              value={draft.severity}
              onChange={e => setDraft({ ...draft, severity: e.target.value as Severity })}
            >
              <option value="critical">Critical blocker</option>
              <option value="review">Needs review</option>
              <option value="info">Informational</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Linked Record / Schedule ID</span>
            <input
              className="input input-sm mono"
              value={draft.recordId}
              onChange={e => setDraft({ ...draft, recordId: e.target.value })}
              placeholder="e.g. PO-4481, SCH-HYG-01"
            />
          </label>
        </div>

        <label className="field" style={{ marginBottom: "10px" }}>
          <span className="field-label">Observation / Claim Quote</span>
          <input
            className="input input-sm"
            value={draft.quote}
            onChange={e => setDraft({ ...draft, quote: e.target.value })}
            placeholder="Short summary quote shown in the Handover Ledger & Briefing…"
          />
        </label>

        <div className="field-grid" style={{ gap: "10px", marginBottom: "14px" }}>
          <label className="field">
            <span className="field-label">Details & Operational Context</span>
            <textarea
              className="input textarea"
              rows={2}
              value={draft.explanation}
              onChange={e => setDraft({ ...draft, explanation: e.target.value })}
              placeholder="What records or operational checks established this issue…"
            />
          </label>
          <label className="field">
            <span className="field-label">Required Next Action</span>
            <textarea
              className="input textarea"
              rows={2}
              value={draft.requiredAction}
              onChange={e => setDraft({ ...draft, requiredAction: e.target.value })}
              placeholder="What the incoming shift or supervisor needs to do…"
            />
          </label>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!draft.title.trim()}
            onClick={onSave}
          >
            Add to Handover Ledger & Briefing
          </button>
        </div>
      </div>
    </div>
  );
}

function FindingDrawer({ shift, finding, data, locked, onClose, onAction, onOpenRecord }: {
  shift: Shift; finding: Finding; data: ShiftData; locked: string | null; onClose: () => void; onAction: Props["onAction"]; onOpenRecord?: (id: string) => void;
}) {
  const openChecks = finding.checks.filter(c => c.workflow !== "resolved");
  const [checkId, setCheckId] = useState(openChecks.find(c => c.severity === "critical")?.id ?? openChecks[0]?.id ?? finding.checks[0]?.id ?? "");
  const [rationale, setRationale] = useState("");
  const [actor, setActor] = useState("Kevin");
  const [owner, setOwner] = useState(STAFF_NAMES[2]);
  const [target, setTarget] = useState(`Next shift (${shift.incoming})`);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!finding.checks.some(c => c.id === checkId)) setCheckId(openChecks[0]?.id ?? finding.checks[0]?.id ?? ""); }, [finding]); // eslint-disable-line
  const check: Check | undefined = finding.checks.find(c => c.id === checkId);
  const history = data.audit.filter(e => e.findingId === finding.id);
  const records = data.records.filter(r => finding.recordIds.includes(r.id));

  const act = (a: CheckAction) => {
    if (!check) return;
    if ((a === "override" || a === "false_positive") && rationale.trim().length < 10) { setError("Write a justification of at least 10 characters."); return; }
    if (a === "carry" && !owner) { setError("Choose who owns the follow-up."); return; }
    setError(null);
    onAction(finding.id, check.id, a, {
      rationale: rationale.trim(),
      owner: a === "carry" ? owner : undefined,
      target: a === "carry" ? target : undefined,
      actor,
    });
    setRationale("");
  };

  const actorOptions = Array.from(new Set([
    shift.outgoing,
    shift.incoming,
    ...STAFF_NAMES,
  ]));

  return (
    <aside className="drawer" aria-label="Finding detail">
      <div className="drawer-head">
        <span className="mono-label">{finding.id} · {finding.category}</span>
        <button type="button" className="icon-btn" aria-label="Close detail" onClick={onClose}><X className="icon" aria-hidden="true" /></button>
      </div>
      <h3 className="drawer-title">{finding.title}</h3>

      <section className="drawer-section">
        <p className="section-label">What the worker reported</p>
        {finding.quote && <blockquote className="quote">“{finding.quote}”</blockquote>}
        <p className="mono-small">{finding.structured}</p>
      </section>

      <section className="drawer-section">
        <p className="section-label">Linked checks ({finding.checks.length})</p>
        <ul className="drawer-checks">
          {finding.checks.map(c => (
            <li key={c.id} className={`drawer-check ${c.id === checkId ? "is-active" : ""}`}>
              <button type="button" className="drawer-check-btn" onClick={() => setCheckId(c.id)}>
                <span className="drawer-check-title">{c.title}<span className="mono-label">{c.ruleCode}</span></span>
                <dl className="dims">
                  <div><dt>Evidence</dt><dd><EvidenceTag value={c.evidence} /></dd></div>
                  <div><dt>Severity</dt><dd><SeverityTag value={c.severity} /></dd></div>
                  <div><dt>Workflow</dt><dd><WorkflowTag value={c.workflow} /></dd></div>
                </dl>
                <span className="drawer-check-reason">{c.reason}</span>
                {c.obligation && <span className="drawer-check-meta">Follow-up: {c.obligation}</span>}
                {c.owner && <span className="drawer-check-meta">Owner: {c.owner}{c.target ? ` · ${c.target}` : ""}</span>}
                {c.workflow !== "resolved" && c.requiredAction && <span className="drawer-check-meta">Required: {c.requiredAction}</span>}
                {c.solvedBy && (
                  <span className="drawer-check-meta" style={{ color: "#166534", fontWeight: 600 }}>
                    ✓ Solved by {c.solvedBy}{c.solvedAt ? ` at ${c.solvedAt}` : ""}: {c.solvedWhat || c.title} — via “{c.solvedWith}”
                  </span>
                )}
                {c.resolution && c.workflow === "resolved" && !c.solvedBy && (
                  <span className="drawer-check-meta">Closed as: {{ resolved: "Resolved", override: "Override", false_positive: "False positive", auto: "Auto-resolved by rule", assigned: "Follow-up assigned" }[c.resolution]}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="drawer-section">
        <p className="section-label">What we know and don't know</p>
        <p className="body-text">{finding.explanation}</p>
        <p className="body-text muted-text">Unknown: {finding.unknowns}</p>
      </section>

      {(records.length > 0 || finding.recordIds.length > 0) && (
        <section className="drawer-section">
          <p className="section-label">Records used</p>
          <ul className="ref-list">
            {records.length > 0 ? records.map(r => (
              <li
                key={r.id}
                className="ref-item"
                style={{ cursor: onOpenRecord ? "pointer" : "default" }}
                onClick={() => onOpenRecord?.(r.id)}
                title="Click to inspect this record in Operational Records"
              >
                <span className="mono" style={{ textDecoration: onOpenRecord ? "underline" : "none" }}>{r.id} ↗</span>
                <span>{r.name} · {r.entries} {r.entries === 1 ? "entry" : "entries"} · {r.coverage}</span>
              </li>
            )) : finding.recordIds.map(rid => (
              <li
                key={rid}
                className="ref-item"
                style={{ cursor: onOpenRecord ? "pointer" : "default" }}
                onClick={() => onOpenRecord?.(rid)}
              >
                <span className="mono" style={{ textDecoration: onOpenRecord ? "underline" : "none" }}>{rid} ↗</span>
                <span>Inspect source in Operational Records</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {finding.aiRecommendation && (
        <section className="drawer-section gemma-recommendation-box" style={{ background: "var(--amber-50)", border: "1px solid var(--amber-200)", borderRadius: "8px", padding: "12px 14px", marginTop: "12px", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span className="mono-label" style={{ color: "var(--espresso-600)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
              ⚡ Gemma Decision Support (AMD)
            </span>
            <Tag tone="warning">AI Recommendation</Tag>
          </div>
          <p className="body-text" style={{ fontSize: "12px", marginBottom: "8px", color: "var(--ink-900)" }}>
            <strong>Operational Risk:</strong> {finding.aiRecommendation.operationalHazard}
          </p>
          <div style={{ fontSize: "11.5px", color: "var(--ink-700)", marginBottom: "10px", lineHeight: "1.4" }}>
            <div><strong>Recommended Owner:</strong> {finding.aiRecommendation.recommendedOwner}</div>
            <div><strong>Target Due Window:</strong> {finding.aiRecommendation.recommendedTarget}</div>
            <div><strong>Recommended Action:</strong> {finding.aiRecommendation.recommendedAction}</div>
          </div>
          {!locked && check && check.workflow !== "resolved" && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setOwner(finding.aiRecommendation!.recommendedOwner);
                setTarget(finding.aiRecommendation!.recommendedTarget);
                setRationale(`Adopted Gemma recommendation: ${finding.aiRecommendation!.recommendedAction}`);
              }}
            >
              Apply Gemma Recommendation
            </button>
          )}
        </section>
      )}

      {openChecks.length > 0 && check && check.workflow !== "resolved" && !locked && (
        <section className="drawer-section drawer-actions">
          <p className="section-label">Decide on: {check.title}</p>
          <label className="field">
            <span className="field-label">Actioned / Solved by</span>
            <select className="input" value={actor} onChange={e => setActor(e.target.value)}>
              {actorOptions.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">What it is solved with / Justification</span>
            <textarea className="input textarea" rows={2} value={rationale} onChange={e => setRationale(e.target.value)} placeholder="Describe how this was solved or why it is overridden…" />
          </label>
          <div className="field-grid">
            <label className="field">
              <span className="field-label">Owner</span>
              <select className="input" value={owner} onChange={e => setOwner(e.target.value)}>
                {STAFF_NAMES.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Hand over to</span>
              <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
                <option>Next shift ({shift.incoming})</option>
                <option>Technician visit</option>
                <option>Supervisor</option>
              </select>
            </label>
          </div>
          <div className="action-grid">
            <button type="button" className="btn btn-primary" onClick={() => act("carry")}>{check.linkedTaskId ? "Assign follow-up" : "Carry forward"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => act("resolve")}>Mark resolved</button>
            <button type="button" className="btn btn-ghost" onClick={() => act("override")}>Override</button>
            <button type="button" className="btn btn-ghost" onClick={() => act("false_positive")}>False positive</button>
          </div>
          <p className="hint">Override and false positive require a written justification. Evidence stays “{EVIDENCE_LABEL[check.evidence]}” either way.</p>
          {error && <p className="field-error" role="alert">{error}</p>}
        </section>
      )}

      <section className="drawer-section">
        <p className="section-label">History</p>
        {history.length === 0 ? <p className="muted-text">No events yet.</p> : (
          <ol className="history">
            {history.map(e => (
              <li key={e.id} className={`history-item ${e.actorKind}`}>
                <span className="mono-small">{e.time} · {e.actor}</span>
                <span className="history-action">{e.action}</span>
                <span className="muted-text">{e.explanation}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      {locked && <Tag tone="outline">Read-only</Tag>}
    </aside>
  );
}
