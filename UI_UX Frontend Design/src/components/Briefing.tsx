import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Clock,
  Database,
  Edit3,
  FileText,
  ListChecks,
  Plus,
  Repeat,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import type {
  Check as CheckType,
  ChecklistItem,
  Finding,
  OperationalScheduleItem,
  ScheduleCategory,
  ScheduleRecurrence,
  Shift,
  ShiftData,
} from "../data";
import {
  allChecks,
  RECURRENCE_LABEL,
  SCHEDULE_CATEGORY_LABEL,
  SHIFT_TYPE_LABEL,
  SHIFTS,
  STAFF_NAMES,
  SUPERVISOR,
} from "../data";
import { EvidenceTag, PageHeader, SeverityTag, Tag, WorkflowTag } from "./ui";

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
  onSaveSchedule: (item: OperationalScheduleItem, isNew: boolean) => void;
  onCompleteSchedule: (scheduleId: string, payload: SolvePayload) => void;
  onPromoteScheduleToIssue: (item: OperationalScheduleItem, issueReason: string, actor: string) => void;
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
  schedule: [
    "Verified milk chiller temp (2.8°C) & sanitizer strip (200 ppm) — passed pre-open check",
    "Received supplier delivery, verified batch expiry, and stored in cold room",
    "Completed weekly Friday truck pickup & updated FIFO inventory rack",
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
  onSaveSchedule,
  onCompleteSchedule,
  onPromoteScheduleToIssue,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState<"solve" | "edit" | "issue">("solve");
  const [solvedByDraft, setSolvedByDraft] = useState<string>(shift.incoming);
  const [solvedWhatDraft, setSolvedWhatDraft] = useState<string>("");
  const [solvedWithDraft, setSolvedWithDraft] = useState<string>("");
  const [issueReasonDraft, setIssueReasonDraft] = useState<string>("");
  const [customStaffMode, setCustomStaffMode] = useState(false);
  const [customStaffDraft, setCustomStaffDraft] = useState("");

  // Inline / modal schedule draft state
  const [editingSchedule, setEditingSchedule] = useState<OperationalScheduleItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTargetPlacement, setAddTargetPlacement] = useState<"coming_up" | "needs_attention">("coming_up");
  const [newSched, setNewSched] = useState<{
    id: string;
    category: ScheduleCategory;
    title: string;
    whenLabel: string;
    recurrence: ScheduleRecurrence;
    vendorOrArea: string;
    notes: string;
    assignedTo: string;
    escalateToLedgerImmediately: boolean;
  }>({
    id: "PO-4490",
    category: "delivery",
    title: "",
    whenLabel: "",
    recurrence: "weekly_fri",
    vendorOrArea: "",
    notes: "",
    assignedTo: shift.incoming,
    escalateToLedgerImmediately: false,
  });

  const idx = SHIFTS.findIndex(s => s.id === shift.id);
  const next = idx > 0 ? SHIFTS[idx - 1] : null;
  const all = allChecks(data);
  const open = all.filter(x => x.check.workflow !== "resolved");
  const attention = all.filter(x => x.check.severity !== "info" || x.finding.category === "equipment" || x.check.solvedBy);
  const stock = all.filter(x => x.finding.category === "stock" && x.check.severity === "info" && !attention.some(a => a.check.id === x.check.id));
  const tasks = data.checklist.filter(t => !t.done || t.solvedBy);

  const schedules = data.schedules || [];
  const attentionSchedules = schedules.filter(s => s.placement === "needs_attention" || s.status === "issue_raised");
  const comingUpSchedules = schedules.filter(s => s.placement === "coming_up" && s.status !== "issue_raised");

  // Small quick schedule form state
  const [quickSchedName, setQuickSchedName] = useState("");
  const [quickSchedCadence, setQuickSchedCadence] = useState<ScheduleRecurrence>("one_time");

  const handleQuickAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickSchedName.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();
    const isDelivery =
      lower.includes("delivery") ||
      lower.includes("po-") ||
      lower.includes("ice") ||
      lower.includes("milk") ||
      lower.includes("bean") ||
      lower.includes("syrup") ||
      lower.includes("bag");
    const isHygiene =
      lower.includes("hygiene") ||
      lower.includes("clean") ||
      lower.includes("sanitiz") ||
      lower.includes("chiller") ||
      lower.includes("wand");

    const category: ScheduleCategory = isDelivery
      ? "delivery"
      : isHygiene
        ? "hygiene"
        : quickSchedCadence === "monthly"
          ? "maintenance"
          : "inventory";

    const refCode = isDelivery
      ? `PO-${4482 + schedules.length}`
      : `SCH-${101 + schedules.length}`;

    const whenLabelMap: Record<ScheduleRecurrence, string> = {
      one_time: "One-time scheduled",
      daily: "Daily · Every shift",
      weekly_fri: "Weekly · Every Friday",
      weekly_mon: "Weekly · Every Monday",
      every_shift: "Every shift handover",
      monthly: "Monthly recurring",
    };

    const newSchedItem: OperationalScheduleItem = {
      id: refCode,
      category,
      title: trimmed,
      whenLabel: whenLabelMap[quickSchedCadence] || "Scheduled",
      recurrence: quickSchedCadence,
      vendorOrArea: isDelivery ? "Supplier Delivery" : isHygiene ? "Espresso Bar & Station" : "Store Operations",
      referenceCode: refCode,
      instructions: "Assigned for verification on shift handover.",
      owner: shift.incoming,
      placement: isHygiene ? "needs_attention" : "coming_up",
      severity: "review",
      status: "scheduled",
    };

    onSaveSchedule(newSchedItem, true);
    setQuickSchedName("");
  };

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

  const toggleExpandSchedule = (s: OperationalScheduleItem, initialMode: "solve" | "edit" | "issue" = "solve") => {
    const key = `SCHED-${s.id}`;
    if (expandedId === key && scheduleMode === initialMode) {
      setExpandedId(null);
      return;
    }
    setExpandedId(key);
    setScheduleMode(initialMode);
    setEditingSchedule({ ...s });
    setSolvedByDraft(s.solvedBy || shift.incoming);
    setSolvedWhatDraft(s.solvedWhat || s.title);
    setSolvedWithDraft(
      s.solvedWith ||
        (s.category === "delivery"
          ? "Received delivery, verified quantity against PO, and placed into storage"
          : s.category === "hygiene_check"
            ? "Verified milk chiller temp (2.8°C) & sanitizer concentration (200 ppm)"
            : "Completed scheduled pickup & logged into store inventory")
    );
    setIssueReasonDraft(`Discrepancy / issue on ${s.title} (${s.whenLabel}) — requires handover follow-up`);
  };

  const openQuickAddModal = (placement: "coming_up" | "needs_attention") => {
    setAddTargetPlacement(placement);
    const defaultCat: ScheduleCategory = placement === "coming_up" ? "delivery" : "hygiene_check";
    const nextNum = 4482 + schedules.length;
    setNewSched({
      id: defaultCat === "delivery" ? `PO-${nextNum}` : `SCH-${101 + schedules.length}`,
      category: defaultCat,
      title:
        placement === "coming_up"
          ? "Weekly ingredient truck pickup & cold-room storage"
          : "Operational hygiene checking: Bar & milk chiller audit",
      whenLabel:
        placement === "coming_up"
          ? "Every Friday, 08:00 (Weekly recurring schedule)"
          : `Today before peak rush · Assigned to ${shift.incoming}`,
      recurrence: placement === "coming_up" ? "weekly_fri" : "every_shift",
      vendorOrArea:
        placement === "coming_up"
          ? "Central Roastery & Cold-Chain Truck · Loading Bay"
          : "Espresso Bar & Cold Storage",
      notes:
        placement === "coming_up"
          ? "Pick up weekly ingredient crates from Friday supply truck, verify batch dates, and store in cold room."
          : "Verify milk chiller ≤ 4°C, steam wand purge, and sanitizer buckets before rush.",
      assignedTo: shift.incoming,
      escalateToLedgerImmediately: false,
    });
    setShowAddModal(true);
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

  const renderScheduleCard = (s: OperationalScheduleItem) => {
    const key = `SCHED-${s.id}`;
    const isExpanded = expandedId === key;
    const isCompleted = s.status === "completed" || !!s.solvedBy;
    const isIssue = s.status === "issue_raised";
    const linkedFinding = data.findings.find(f => f.recordIds.includes(s.id) || (s.linkedRecordId && f.recordIds.includes(s.linkedRecordId)));

    return (
      <li
        key={s.id}
        className={`brief-item ${isIssue && !isCompleted ? "is-critical" : ""}`}
        style={{ flexDirection: "column", alignItems: "stretch", gap: "10px", padding: "12px 14px" }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleExpandSchedule(s, "solve")}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleExpandSchedule(s, "solve");
            }
          }}
          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", cursor: "pointer", width: "100%" }}
        >
          <div className="brief-item-main" style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
              <span className="mono-label" style={{ background: "var(--paper-200)", padding: "1px 6px", borderRadius: "4px", fontSize: "11px" }}>
                {s.id}
              </span>
              <span className="brief-item-title">{s.title}</span>
              {s.recurrence !== "once" && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    background: "var(--paper-200)",
                    color: "var(--espresso-600)",
                    padding: "1px 7px",
                    borderRadius: "999px",
                    fontWeight: 500,
                  }}
                >
                  <Repeat className="icon icon-xs" aria-hidden="true" />
                  {RECURRENCE_LABEL[s.recurrence]}
                </span>
              )}
            </div>
            <span className="muted-text">
              {isCompleted && s.solvedBy ? (
                <span style={{ color: "#166534", fontWeight: 500 }}>
                  ✓ Completed by {s.solvedBy}{s.solvedAt ? ` at ${s.solvedAt}` : ""} · {s.solvedWhat || s.title} — via “{s.solvedWith}”
                </span>
              ) : (
                <>
                  {s.whenLabel} · {s.vendorOrArea} · <span className="mono">{s.id}</span>
                  {s.assignedTo ? ` · Assigned: ${s.assignedTo}` : ""}
                </>
              )}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, flexWrap: "wrap" }}>
            <Tag tone={isCompleted ? "success" : isIssue ? "danger" : s.category === "hygiene_check" ? "warning" : "neutral"}>
              {isCompleted ? "Completed" : isIssue ? "Issue flagged" : SCHEDULE_CATEGORY_LABEL[s.category]}
            </Tag>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={e => {
                e.stopPropagation();
                toggleExpandSchedule(s, "edit");
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", border: "1px solid var(--paper-400)", borderRadius: "6px", padding: "2px 7px" }}
              title="Edit schedule time, recurrence, or details"
            >
              <Edit3 className="icon icon-xs" aria-hidden="true" />
              Edit
            </button>
            {s.linkedRecordId && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={e => {
                  e.stopPropagation();
                  onOpenRecord(s.linkedRecordId!);
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", border: "1px solid var(--paper-400)", borderRadius: "6px", padding: "2px 7px" }}
                title={`View ${s.linkedRecordId} in Operational Records`}
              >
                <Database className="icon icon-xs" aria-hidden="true" />
                {s.linkedRecordId} ↗
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={e => {
                e.stopPropagation();
                toggleExpandSchedule(s, "solve");
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px" }}
            >
              {isExpanded ? <ChevronUp className="icon icon-sm" /> : <ChevronDown className="icon icon-sm" />}
              {isCompleted ? "Details" : "Complete / Manage"}
            </button>
          </div>
        </div>

        {isExpanded && editingSchedule && (
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
              <div className="segmented" role="tablist" aria-label="Manage schedule item">
                <button
                  type="button"
                  className={`segment ${scheduleMode === "solve" ? "is-active" : ""}`}
                  onClick={() => setScheduleMode("solve")}
                >
                  ✓ Complete / Receive
                </button>
                <button
                  type="button"
                  className={`segment ${scheduleMode === "edit" ? "is-active" : ""}`}
                  onClick={() => setScheduleMode("edit")}
                >
                  ✎ Edit Schedule / ETA
                </button>
                <button
                  type="button"
                  className={`segment ${scheduleMode === "issue" ? "is-active" : ""}`}
                  onClick={() => setScheduleMode("issue")}
                >
                  ⚠ Flag Issue to Ledger
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {linkedFinding && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => onOpenFinding(linkedFinding.id)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px" }}
                  >
                    <ListChecks className="icon icon-xs" aria-hidden="true" />
                    Open {linkedFinding.id} in Handover Ledger ↗
                  </button>
                )}
                {s.linkedRecordId && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => onOpenRecord(s.linkedRecordId!)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", border: "1px solid var(--paper-400)", borderRadius: "4px" }}
                  >
                    <Database className="icon icon-xs" aria-hidden="true" />
                    Inspect {s.linkedRecordId} in Records ↗
                  </button>
                )}
              </div>
            </div>

            {s.notes && scheduleMode !== "edit" && (
              <p className="body-text" style={{ fontSize: "12.5px", color: "var(--ink-700)", margin: 0 }}>
                {s.notes}
              </p>
            )}

            {scheduleMode === "solve" && (
              <>
                <div className="field-grid field-grid-3" style={{ gap: "10px" }}>
                  <label className="field">
                    <span className="field-label">Completed / Solved by (Who)</span>
                    <select className="input input-sm" value={solvedByDraft} onChange={e => setSolvedByDraft(e.target.value)}>
                      {staffOptions.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field" style={{ gridColumn: "span 2" }}>
                    <span className="field-label">What was completed / received</span>
                    <input
                      className="input input-sm"
                      value={solvedWhatDraft}
                      onChange={e => setSolvedWhatDraft(e.target.value)}
                      placeholder="e.g. Received 5 bags tube ice from Arctic Ice Co. / Completed milk chiller check…"
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="field-label">What it was completed / verified with (Evidence / Sign-off note)</span>
                  <input
                    className="input input-sm"
                    value={solvedWithDraft}
                    onChange={e => setSolvedWithDraft(e.target.value)}
                    placeholder="e.g. Signed delivery docket PO-4481 & stored in freezer / Verified 2.8°C & 200 ppm…"
                  />
                </label>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", color: "var(--ink-500)" }}>Quick fill:</span>
                  {QUICK_SOLUTIONS.schedule.map((sug, i) => (
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
                      onCompleteSchedule(s.id, {
                        solvedBy: solvedByDraft,
                        solvedWhat: solvedWhatDraft.trim(),
                        solvedWith: solvedWithDraft.trim(),
                      });
                      setExpandedId(null);
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Check className="icon icon-sm" aria-hidden="true" />
                    {isCompleted ? "Update completion" : "Mark completed / received"}
                  </button>
                </div>
              </>
            )}

            {scheduleMode === "edit" && (
              <>
                <div className="field-grid field-grid-3" style={{ gap: "10px" }}>
                  <label className="field" style={{ gridColumn: "span 2" }}>
                    <span className="field-label">Title / Delivery / Operational Check</span>
                    <input
                      className="input input-sm"
                      value={editingSchedule.title}
                      onChange={e => setEditingSchedule({ ...editingSchedule, title: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Category</span>
                    <select
                      className="input input-sm"
                      value={editingSchedule.category}
                      onChange={e => setEditingSchedule({ ...editingSchedule, category: e.target.value as ScheduleCategory })}
                    >
                      <option value="delivery">Supplier Delivery (PO)</option>
                      <option value="weekly_pickup">Weekly Ingredient Pickup / Storage</option>
                      <option value="hygiene_check">Operational Hygiene Check</option>
                      <option value="maintenance">Scheduled Maintenance</option>
                    </select>
                  </label>
                </div>

                <div className="field-grid field-grid-3" style={{ gap: "10px" }}>
                  <label className="field">
                    <span className="field-label">When / ETA / Window</span>
                    <input
                      className="input input-sm"
                      value={editingSchedule.whenLabel}
                      onChange={e => setEditingSchedule({ ...editingSchedule, whenLabel: e.target.value })}
                      placeholder="e.g. Tue 13 Oct, 10:00 (stated by supplier)"
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Recurrence</span>
                    <select
                      className="input input-sm"
                      value={editingSchedule.recurrence}
                      onChange={e => setEditingSchedule({ ...editingSchedule, recurrence: e.target.value as ScheduleRecurrence })}
                    >
                      <option value="once">One-time / Specific Date</option>
                      <option value="every_shift">Every Shift</option>
                      <option value="daily">Daily</option>
                      <option value="weekly_mon">Every Monday (Weekly)</option>
                      <option value="weekly_wed">Every Wednesday (Weekly)</option>
                      <option value="weekly_fri">Every Friday (Weekly)</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Supplier / Store Area</span>
                    <input
                      className="input input-sm"
                      value={editingSchedule.vendorOrArea}
                      onChange={e => setEditingSchedule({ ...editingSchedule, vendorOrArea: e.target.value })}
                      placeholder="e.g. Arctic Ice Co. / Cold Room"
                    />
                  </label>
                </div>

                <div className="field-grid field-grid-3" style={{ gap: "10px" }}>
                  <label className="field">
                    <span className="field-label">Briefing Section</span>
                    <select
                      className="input input-sm"
                      value={editingSchedule.placement}
                      onChange={e => setEditingSchedule({ ...editingSchedule, placement: e.target.value as "coming_up" | "needs_attention" })}
                    >
                      <option value="coming_up">Coming up (Deliveries & recurring pickups)</option>
                      <option value="needs_attention">Needs attention (Active check / issue)</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Assigned Staff</span>
                    <select
                      className="input input-sm"
                      value={editingSchedule.assignedTo || shift.incoming}
                      onChange={e => setEditingSchedule({ ...editingSchedule, assignedTo: e.target.value })}
                    >
                      {staffOptions.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Instructions / Notes</span>
                    <input
                      className="input input-sm"
                      value={editingSchedule.notes}
                      onChange={e => setEditingSchedule({ ...editingSchedule, notes: e.target.value })}
                    />
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedId(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      onSaveSchedule(editingSchedule, false);
                      setExpandedId(null);
                    }}
                  >
                    Save schedule changes
                  </button>
                </div>
              </>
            )}

            {scheduleMode === "issue" && (
              <>
                <p className="muted-text" style={{ fontSize: "12px", margin: 0 }}>
                  Flagging an issue on <strong>{s.title}</strong> moves it to <strong>Needs attention</strong> and creates a tracked finding in the <strong>Handover ledger</strong> (e.g., late supplier truck, missing bags, failed chiller temp check).
                </p>
                <div className="field-grid field-grid-3" style={{ gap: "10px" }}>
                  <label className="field">
                    <span className="field-label">Reported by</span>
                    <select className="input input-sm" value={solvedByDraft} onChange={e => setSolvedByDraft(e.target.value)}>
                      {staffOptions.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field" style={{ gridColumn: "span 2" }}>
                    <span className="field-label">What is the operational issue / discrepancy?</span>
                    <input
                      className="input input-sm"
                      value={issueReasonDraft}
                      onChange={e => setIssueReasonDraft(e.target.value)}
                      placeholder="e.g. Arctic Ice Co. delivery delayed past 10:00 AM / Chiller temp above 6°C…"
                    />
                  </label>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedId(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!issueReasonDraft.trim()}
                    onClick={() => {
                      onPromoteScheduleToIssue(s, issueReasonDraft.trim(), solvedByDraft);
                      setExpandedId(null);
                    }}
                  >
                    Raise Issue in Briefing & Handover Ledger
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </li>
    );
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
            <button type="button" className="btn btn-primary" onClick={onStart} disabled={!!locked || !data.submitted}>
              Acknowledge & start shift ({shift.incoming})
            </button>
          )}
        </div>
      </PageHeader>

      {!data.submitted && (
        <div className="notice notice-neutral" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <Clock className="icon icon-sm" aria-hidden="true" />
            <span>
              <strong>{shift.outgoing}’s shift report is still in progress.</strong> Store operational schedules, deliveries (e.g. PO-4481), weekly pickups, and hygiene checks are live below and can be edited or added anytime.
            </span>
          </span>
          <button type="button" className="btn btn-secondary btn-xs" onClick={onOpenReport}>
            Go to Finish your shift
          </button>
        </div>
      )}

      {data.submitted && data.acknowledged && (
        <p className="notice notice-neutral">
          <CircleCheck className="icon icon-sm" aria-hidden="true" />
          {shift.incoming} confirmed receiving this briefing. Click any item in <strong>Needs attention</strong> or <strong>Coming up</strong> below to solve it, edit its schedule, or open its Handover Ledger finding.
        </p>
      )}
      {data.submitted && !data.acknowledged && (
        <p className="muted-text">
          Click any item under <strong>Needs attention</strong> or <strong>Coming up</strong> to solve it (record who solved it, what was solved, and what it was solved with), edit delivery/schedule details, or open the corresponding Handover Ledger finding.
        </p>
      )}

      <section className="brief-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
          <div>
            <h3 className="group-title" style={{ margin: 0 }}>Needs attention</h3>
            <span className="muted-text" style={{ fontSize: "12px" }}>
              Issues from the Handover Ledger + operational hygiene checks & flagged schedule issues
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => openQuickAddModal("needs_attention")}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px" }}
          >
            <Plus className="icon icon-xs" aria-hidden="true" />
            + Add Operational Check / Issue
          </button>
        </div>

        {(data.submitted ? attention.length + stock.length + tasks.length : 0) + attentionSchedules.length === 0 ? (
          <p className="muted-text">Nothing outstanding.</p>
        ) : (
          <ul className="brief-list">
            {attentionSchedules.map(s => renderScheduleCard(s))}

            {data.submitted && [...attention, ...stock].map(({ finding, check }) => {
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

            {data.submitted && tasks.map(t => {
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
          <div>
            <h3 className="group-title" style={{ margin: 0 }}>Coming up</h3>
            <span className="muted-text" style={{ fontSize: "12px" }}>
              Scheduled supplier deliveries (PO-4481), recurring weekly ingredient truck pickups, and technician visits — click any item to edit, complete, or flag an issue
            </span>
          </div>
        </div>

        {/* Small Schedule Form: Name, Schedule (one time/weekly/monthly/daily), and Action */}
        <form
          onSubmit={handleQuickAddSchedule}
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "10px",
            background: "var(--paper-50)",
            border: "1px solid var(--paper-300)",
            borderRadius: "10px",
            padding: "12px 14px",
            marginBottom: "14px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "2 1 260px", minWidth: "180px" }}>
            <label className="field-label" style={{ display: "block", marginBottom: "4px", fontSize: "12px" }}>
              Name
            </label>
            <input
              type="text"
              className="input input-sm"
              placeholder="e.g. Delivery: Tube ice, 5 bags · Weekly truck pickup…"
              value={quickSchedName}
              onChange={e => setQuickSchedName(e.target.value)}
              style={{ width: "100%", background: "var(--paper-0)" }}
            />
          </div>

          <div style={{ flex: "1 1 140px", minWidth: "120px" }}>
            <label className="field-label" style={{ display: "block", marginBottom: "4px", fontSize: "12px" }}>
              Schedule
            </label>
            <select
              className="input input-sm"
              value={quickSchedCadence}
              onChange={e => setQuickSchedCadence(e.target.value as ScheduleRecurrence)}
              style={{ width: "100%", background: "var(--paper-0)" }}
            >
              <option value="one_time">One time</option>
              <option value="daily">Daily</option>
              <option value="weekly_fri">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!quickSchedName.trim()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                minHeight: "34px",
              }}
            >
              <Plus className="icon icon-xs" aria-hidden="true" />
              Schedule Item
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => openQuickAddModal("coming_up")}
              title="Open full schedule modal"
              style={{ fontSize: "12px" }}
            >
              More options…
            </button>
          </div>
        </form>

        {comingUpSchedules.length + (data.submitted ? comingUp.length : 0) === 0 ? (
          <p className="muted-text">No scheduled deliveries or visits.</p>
        ) : (
          <ul className="brief-list">
            {comingUpSchedules.map(s => renderScheduleCard(s))}
            {data.submitted && comingUp.map(({ finding, check }) => (
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

      {data.submitted && (
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
                  <span className="brief-item-title">Carried forward: {formatCheckHeading(finding, check)}</span>
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
      )}

      {showAddModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="brief-add-title">
          <div className="modal-dialog modal-dialog-wide">
            <div className="modal-header">
              <h3 id="brief-add-title" className="modal-title">
                {addTargetPlacement === "coming_up"
                  ? "Add Delivery, Weekly Pickup, or Operational Schedule"
                  : "Add Operational Hygiene Check or Briefing Issue"}
              </h3>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setShowAddModal(false)}>
                <X className="icon" aria-hidden="true" />
              </button>
            </div>
            <p className="modal-sub">
              Add a supplier delivery (like Tube ice PO-4481), a weekly Friday ingredient truck pickup, or an operational hygiene check directly to the briefing and operational records.
            </p>

            <div className="field-grid field-grid-3" style={{ gap: "10px", marginBottom: "10px" }}>
              <label className="field">
                <span className="field-label">Code / PO #</span>
                <input
                  className="input input-sm mono"
                  value={newSched.id}
                  onChange={e => setNewSched({ ...newSched, id: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">Category</span>
                <select
                  className="input input-sm"
                  value={newSched.category}
                  onChange={e => setNewSched({ ...newSched, category: e.target.value as ScheduleCategory })}
                >
                  <option value="delivery">Supplier Delivery (PO)</option>
                  <option value="weekly_pickup">Weekly Ingredient Pickup / Storage</option>
                  <option value="hygiene_check">Operational Hygiene Check</option>
                  <option value="maintenance">Scheduled Maintenance</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Recurrence</span>
                <select
                  className="input input-sm"
                  value={newSched.recurrence}
                  onChange={e => setNewSched({ ...newSched, recurrence: e.target.value as ScheduleRecurrence })}
                >
                  <option value="one_time">One time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly_fri">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="every_shift">Every Shift</option>
                </select>
              </label>
            </div>

            <label className="field" style={{ marginBottom: "10px" }}>
              <span className="field-label">Title / Item & Quantity</span>
              <input
                className="input input-sm"
                value={newSched.title}
                onChange={e => setNewSched({ ...newSched, title: e.target.value })}
                placeholder="e.g. Delivery: Tube ice, 5 bags · OR · Weekly ingredient truck pickup & storage"
              />
            </label>

            <div className="field-grid field-grid-3" style={{ gap: "10px", marginBottom: "10px" }}>
              <label className="field">
                <span className="field-label">Scheduled Time / ETA</span>
                <input
                  className="input input-sm"
                  value={newSched.whenLabel}
                  onChange={e => setNewSched({ ...newSched, whenLabel: e.target.value })}
                  placeholder="e.g. Every Friday, 08:00 / Tue 13 Oct, 10:00"
                />
              </label>
              <label className="field">
                <span className="field-label">Supplier / Store Area</span>
                <input
                  className="input input-sm"
                  value={newSched.vendorOrArea}
                  onChange={e => setNewSched({ ...newSched, vendorOrArea: e.target.value })}
                  placeholder="e.g. Arctic Ice Co. / Cold Room"
                />
              </label>
              <label className="field">
                <span className="field-label">Briefing Section</span>
                <select
                  className="input input-sm"
                  value={addTargetPlacement}
                  onChange={e => setAddTargetPlacement(e.target.value as "coming_up" | "needs_attention")}
                >
                  <option value="coming_up">Coming up (Scheduled deliveries & pickups)</option>
                  <option value="needs_attention">Needs attention (Active check / issue)</option>
                </select>
              </label>
            </div>

            <label className="field" style={{ marginBottom: "10px" }}>
              <span className="field-label">Operational Notes / Instructions</span>
              <textarea
                className="input textarea"
                rows={2}
                value={newSched.notes}
                onChange={e => setNewSched({ ...newSched, notes: e.target.value })}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", cursor: "pointer", marginBottom: "14px" }}>
              <input
                type="checkbox"
                checked={newSched.escalateToLedgerImmediately}
                onChange={e => setNewSched({ ...newSched, escalateToLedgerImmediately: e.target.checked })}
              />
              <span>
                Also create a linked finding in the <strong>Handover ledger</strong> immediately (so this schedule/check is tracked in both the Ledger and Briefing)
              </span>
            </label>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!newSched.title.trim() || !newSched.whenLabel.trim()}
                onClick={() => {
                  const created: OperationalScheduleItem = {
                    id: newSched.id.trim() || `SCH-${Date.now().toString().slice(-4)}`,
                    category: newSched.category,
                    title: newSched.title.trim(),
                    whenLabel: newSched.whenLabel.trim(),
                    recurrence: newSched.recurrence,
                    vendorOrArea: newSched.vendorOrArea.trim() || "Store Operations",
                    placement: addTargetPlacement,
                    status: newSched.escalateToLedgerImmediately ? "issue_raised" : "scheduled",
                    notes: newSched.notes.trim(),
                    assignedTo: newSched.assignedTo,
                    linkedRecordId: newSched.id.trim().startsWith("PO-") ? newSched.id.trim() : undefined,
                  };
                  onSaveSchedule(created, true);
                  if (newSched.escalateToLedgerImmediately) {
                    onPromoteScheduleToIssue(created, created.notes || created.title, shift.incoming);
                  }
                  setShowAddModal(false);
                }}
              >
                Save to Briefing & Operational Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
