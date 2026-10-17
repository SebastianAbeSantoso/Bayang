import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarClock, Check, Edit3, Plus, Trash2, X } from "lucide-react";
import type {
  Availability,
  OperationalScheduleItem,
  RecordGroup,
  ScheduleCategory,
  ScheduleRecurrence,
  Severity,
  Shift,
  ShiftData,
  SourceRecord,
} from "../data";
import {
  AVAILABILITY_LABEL,
  GROUP_LABEL,
  RECURRENCE_LABEL,
  SCHEDULE_CATEGORY_LABEL,
  STAFF_NAMES,
  nextId,
} from "../data";
import { AvailabilityTag, EmptyState, PageHeader, SeverityTag, Tag } from "./ui";

function resolveRecord(records: SourceRecord[], rawId: string | null | undefined): SourceRecord | undefined {
  if (!rawId) return undefined;
  const direct = records.find(r => r.id === rawId);
  if (direct) return direct;
  const up = rawId.toUpperCase();
  const byRow = records.find(r => r.rows.some(row => Object.values(row).some(v => v.toUpperCase().includes(up))));
  if (byRow) return byRow;
  if (up.startsWith("ORD-") || up.startsWith("POS-")) return records.find(r => r.id.startsWith("POS-"));
  if (up.startsWith("MAC-") || up.startsWith("MC-")) return records.find(r => r.id.startsWith("MC-"));
  if (up.startsWith("IB-") || up.startsWith("INC-")) return records.find(r => r.id.startsWith("IB-"));
  if (up.startsWith("INV-")) return records.find(r => r.id.startsWith("INV-"));
  if (up.startsWith("SS-")) return records.find(r => r.id.startsWith("SS-"));
  if (up.startsWith("PO-")) return records.find(r => r.id.startsWith("PO-"));
  if (up.startsWith("CASH-")) return records.find(r => r.id.startsWith("CASH-"));
  return undefined;
}

interface Props {
  shift: Shift;
  data: ShiftData;
  initialRecordId?: string | null;
  onSaveSchedule: (item: OperationalScheduleItem, isNew: boolean) => void;
  onDeleteSchedule: (id: string) => void;
  onPromoteScheduleToIssue: (item: OperationalScheduleItem, note?: string) => void;
  onUpdateRecordFields: (recordId: string, fields: Array<[string, string]>, location: string) => void;
  onOpenBriefing: () => void;
}

const SCHEDULE_TEMPLATES: Array<{
  label: string;
  category: ScheduleCategory;
  title: string;
  whenLabel: string;
  recurrence: ScheduleRecurrence;
  vendorOrArea: string;
  referenceCode: string;
  instructions: string;
  placement: "coming_up" | "needs_attention";
  severity: Severity;
}> = [
  {
    label: "🚚 Weekly Friday Truck Ingredient Pickup",
    category: "delivery",
    title: "Weekly ingredient truck pickup & cold-room storage",
    whenLabel: "Every Friday, 08:00 AM (Weekly recurring)",
    recurrence: "weekly_fri",
    vendorOrArea: "Central Roastery & Dairy Freight Truck",
    referenceCode: "SOP-RCV-04",
    instructions: "Pick up 12× Oat Milk Barista cases + 15kg House Blend beans from Friday delivery truck, verify cold-chain temp, and store in walk-in chiller.",
    placement: "coming_up",
    severity: "info",
  },
  {
    label: "🧊 Supplier Delivery (PO)",
    category: "delivery",
    title: "Delivery: Tube ice, 5 bags",
    whenLabel: "Tue 13 Oct, 10:00 (stated by supplier)",
    recurrence: "one_time",
    vendorOrArea: "Arctic Ice Co.",
    referenceCode: "PO-4481",
    instructions: "Receive 5 bags of tube ice at back loading door and store in backup chest freezer.",
    placement: "coming_up",
    severity: "review",
  },
  {
    label: "🧼 Operational Hygiene & Chiller Audit",
    category: "hygiene",
    title: "Operational hygiene checking: Milk chiller & steam wand sanitizer",
    whenLabel: "Every shift start & close",
    recurrence: "every_shift",
    vendorOrArea: "Espresso Bar & Undercounter Chiller",
    referenceCode: "SOP-HYG-01",
    instructions: "Check milk chiller ≤ 4.0°C, verify sanitizer strip ppm, and inspect steam wand purge nozzle.",
    placement: "needs_attention",
    severity: "review",
  },
  {
    label: "🔧 Weekly Grinder Burr & Water Filter Check",
    category: "maintenance",
    title: "Weekly grinder burr calibration & water filtration pressure check",
    whenLabel: "Every Monday, 07:00 AM",
    recurrence: "weekly_mon",
    vendorOrArea: "Barista Station 1 · Mahlkönig EK43S",
    referenceCode: "SOP-EQP-02",
    instructions: "Check zero-point burr alignment and verify water softener line pressure ≥ 2.5 bar.",
    placement: "needs_attention",
    severity: "review",
  },
];

export default function Records({
  shift,
  data,
  initialRecordId,
  onSaveSchedule,
  onDeleteSchedule,
  onPromoteScheduleToIssue,
  onUpdateRecordFields,
  onOpenBriefing,
}: Props) {
  const [group, setGroup] = useState<RecordGroup | "schedules" | "all">("all");
  const [avail, setAvail] = useState<Availability | "all">("all");
  const [openId, setOpenId] = useState<string | null>(() => resolveRecord(data.records, initialRecordId)?.id ?? null);

  // Schedule editor modal state
  const [editingSchedule, setEditingSchedule] = useState<OperationalScheduleItem | null>(null);
  const [isNewSchedule, setIsNewSchedule] = useState(false);

  // Record field editor state
  const [editingRecFields, setEditingRecFields] = useState<boolean>(false);
  const [recFieldsDraft, setRecFieldsDraft] = useState<Array<[string, string]>>([]);
  const [recLocationDraft, setRecLocationDraft] = useState<string>("");

  useEffect(() => {
    if (initialRecordId) {
      const matched = resolveRecord(data.records, initialRecordId);
      if (matched) setOpenId(matched.id);
    }
  }, [initialRecordId, data.records]);

  const rec = data.records.find(r => r.id === openId);
  const staffOptions = Array.from(new Set([shift.incoming, shift.outgoing, ...STAFF_NAMES]));

  const openNewScheduleModal = (presetIdx = 0) => {
    const tpl = SCHEDULE_TEMPLATES[presetIdx] || SCHEDULE_TEMPLATES[0];
    setIsNewSchedule(true);
    setEditingSchedule({
      id: nextId("SCH"),
      category: tpl.category,
      title: tpl.title,
      whenLabel: tpl.whenLabel,
      recurrence: tpl.recurrence,
      vendorOrArea: tpl.vendorOrArea,
      referenceCode: tpl.referenceCode,
      instructions: tpl.instructions,
      owner: shift.incoming,
      placement: tpl.placement,
      severity: tpl.severity,
      status: "scheduled",
    });
  };

  const openEditScheduleModal = (item: OperationalScheduleItem) => {
    setIsNewSchedule(false);
    setEditingSchedule({ ...item });
  };

  if (data.records.length === 0 && (data.schedules ?? []).length === 0)
    return (
      <>
        <PageHeader title="Operational records & schedules" subtitle="The records, deliveries, and recurring SOP schedules ShiftGuard uses for each shift." />
        <EmptyState title="No records yet" body="Records are collected once the shift starts." />
      </>
    );

  if (rec) {
    const cols = rec.rows[0] ? Object.keys(rec.rows[0]) : [];
    const linkedSchedule = (data.schedules ?? []).find(s => s.linkedRecordId === rec.id || s.referenceCode === rec.id);
    return (
      <div className="record-detail">
        <button
          type="button"
          className="link-btn back-link"
          onClick={() => {
            setOpenId(null);
            setEditingRecFields(false);
          }}
        >
          <ArrowLeft className="icon icon-sm" aria-hidden="true" />All records & schedules
        </button>
        <PageHeader title={rec.name} subtitle={`${GROUP_LABEL[rec.group]} · ${rec.type}`}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AvailabilityTag value={rec.availability} />
            {!editingRecFields && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setRecFieldsDraft(rec.fields.map(([k, v]) => [k, v]));
                  setRecLocationDraft(rec.location);
                  setEditingRecFields(true);
                }}
              >
                <Edit3 className="icon icon-sm" aria-hidden="true" />
                Edit Record Fields
              </button>
            )}
          </div>
        </PageHeader>

        {editingRecFields ? (
          <section
            style={{
              background: "var(--paper-100)",
              border: "1px solid var(--paper-400)",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "18px",
            }}
          >
            <p className="section-label" style={{ marginBottom: "10px" }}>Edit Operational Record ({rec.id})</p>
            <label className="field" style={{ marginBottom: "10px" }}>
              <span className="field-label">Supplier / Location / Source</span>
              <input
                className="input input-sm"
                value={recLocationDraft}
                onChange={e => setRecLocationDraft(e.target.value)}
              />
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              {recFieldsDraft.map(([k, v], idx) => (
                <div key={idx} className="field-grid" style={{ gap: "8px" }}>
                  <input
                    className="input input-sm"
                    value={k}
                    onChange={e => {
                      const next = [...recFieldsDraft];
                      next[idx] = [e.target.value, v];
                      setRecFieldsDraft(next);
                    }}
                    placeholder="Field name"
                  />
                  <input
                    className="input input-sm"
                    value={v}
                    onChange={e => {
                      const next = [...recFieldsDraft];
                      next[idx] = [k, e.target.value];
                      setRecFieldsDraft(next);
                    }}
                    placeholder="Field value"
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setRecFieldsDraft([...recFieldsDraft, ["New field", ""]])}
              >
                + Add field
              </button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingRecFields(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    onUpdateRecordFields(rec.id, recFieldsDraft.filter(([k]) => k.trim()), recLocationDraft.trim() || rec.location);
                    setEditingRecFields(false);
                  }}
                >
                  <Check className="icon icon-sm" aria-hidden="true" />
                  Save Record Changes
                </button>
              </div>
            </div>
          </section>
        ) : (
          <dl className="kv-grid">
            <div><dt>Record ID</dt><dd className="mono">{rec.id}</dd></div>
            <div><dt>Coverage</dt><dd>{rec.coverage}</dd></div>
            <div><dt>Last updated</dt><dd>{rec.updated}</dd></div>
            <div><dt>Where it lives</dt><dd>{rec.location}</dd></div>
            {rec.fields.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        )}

        {linkedSchedule && (
          <div className="notice notice-neutral" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <span>
              Linked to Incoming Briefing schedule: <strong>{linkedSchedule.title}</strong> ({linkedSchedule.whenLabel})
            </span>
            <button type="button" className="btn btn-secondary btn-xs" onClick={onOpenBriefing}>
              View in Incoming Briefing ↗
            </button>
          </div>
        )}

        {rec.gap && <p className="notice notice-warning">Missing information: {rec.gap}</p>}
        <div className="meaning-grid">
          <div className="meaning meaning-yes">
            <p className="section-label">What this record establishes</p>
            <p className="body-text">{rec.establishes}</p>
          </div>
          <div className="meaning meaning-no">
            <p className="section-label">What it does not establish</p>
            <p className="body-text">{rec.doesNotEstablish}</p>
          </div>
        </div>
        <p className="section-label">Raw data used in verification</p>
        {rec.rows.length === 0 ? (
          <p className="muted-text">0 entries in this record for the coverage period.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{rec.rows.map((row, i) => <tr key={i}>{cols.map(c => <td key={c}>{row[c]}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const groups = (["sales", "equipment", "inventory"] as RecordGroup[]).filter(g => group === "all" || g === group);
  const visible = (g: RecordGroup) => data.records.filter(r => r.group === g && (avail === "all" || r.availability === avail));
  const schedules = data.schedules ?? [];

  return (
    <>
      <PageHeader
        title="Operational records & schedules"
        subtitle="Manage supplier deliveries, recurring weekly schedules, operational hygiene checks, and shift verification records."
      >
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openNewScheduleModal(0)}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Plus className="icon icon-sm" aria-hidden="true" />
          Add delivery / operational schedule
        </button>
      </PageHeader>

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Record category">
          {(["all", "schedules", "sales", "equipment", "inventory"] as const).map(g => (
            <button key={g} type="button" role="tab" aria-selected={group === g} className={`segment ${group === g ? "is-active" : ""}`} onClick={() => setGroup(g)}>
              {g === "all" ? "All" : g === "schedules" ? `Schedules & Deliveries (${schedules.length})` : GROUP_LABEL[g]}
            </button>
          ))}
        </div>
        {group !== "schedules" && (
          <label className="inline-field">
            <span className="field-label">Availability</span>
            <select className="input input-sm" value={avail} onChange={e => setAvail(e.target.value as Availability | "all")}>
              <option value="all">Any</option>
              {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map(a => <option key={a} value={a}>{AVAILABILITY_LABEL[a]}</option>)}
            </select>
          </label>
        )}
      </div>

      {(group === "all" || group === "schedules") && (
        <section className="record-group" aria-label="Store schedules, deliveries, and hygiene checks">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
            <div>
              <h3 className="group-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                <CalendarClock className="icon icon-sm" aria-hidden="true" />
                Scheduled Deliveries, Weekly Truck Pickups & Operational Hygiene Checks
              </h3>
              <p className="muted-text" style={{ fontSize: "12.5px", marginTop: "2px" }}>
                Items added or edited here automatically sync to the <strong>Incoming Briefing</strong> (under <em>Coming up</em> or <em>Needs attention</em>) and can be escalated into the <strong>Handover Ledger</strong>.
              </p>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openNewScheduleModal(0)}>
                + Weekly Truck Pickup
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openNewScheduleModal(1)}>
                + Supplier Delivery (PO)
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openNewScheduleModal(2)}>
                + Hygiene Check
              </button>
            </div>
          </div>

          {schedules.length === 0 ? (
            <p className="muted-text">No scheduled deliveries or operational checks yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Operational Item / Delivery</th>
                    <th>Schedule & Recurrence</th>
                    <th>Supplier / Area</th>
                    <th>Ref / PO</th>
                    <th>Briefing Section</th>
                    <th>Status & Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(item => (
                    <tr key={item.id}>
                      <td>
                        <span className="cell-strong">{item.title}</span>
                        <span className="cell-sub">{SCHEDULE_CATEGORY_LABEL[item.category]} · {item.instructions}</span>
                        {item.solvedBy && (
                          <span className="cell-sub" style={{ color: "#166534", fontWeight: 500 }}>
                            ✓ Completed by {item.solvedBy}{item.solvedAt ? ` at ${item.solvedAt}` : ""}: {item.solvedWhat} ({item.solvedWith})
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="cell-strong">{item.whenLabel}</span>
                        <span className="cell-sub">{RECURRENCE_LABEL[item.recurrence]}</span>
                      </td>
                      <td>
                        <span>{item.vendorOrArea}</span>
                        {item.owner && <span className="cell-sub">Assigned: {item.owner}</span>}
                      </td>
                      <td className="mono">{item.referenceCode}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                          <Tag tone={item.placement === "needs_attention" ? "warning" : "info"}>
                            {item.placement === "needs_attention" ? "Briefing: Needs attention" : "Briefing: Coming up"}
                          </Tag>
                          <SeverityTag value={item.severity} />
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => openEditScheduleModal(item)}
                            title="Edit schedule, delivery time, supplier, or recurrence"
                          >
                            <Edit3 className="icon icon-sm" aria-hidden="true" />
                            Edit
                          </button>
                          {item.status !== "issue_raised" && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => onPromoteScheduleToIssue(item)}
                              style={{ border: "1px solid var(--amber-400)", color: "var(--amber-900)" }}
                              title="Flag an operational issue for this schedule into Needs Attention & Handover Ledger"
                            >
                              <AlertTriangle className="icon icon-sm" aria-hidden="true" />
                              Flag Issue
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Remove ${item.title}`}
                            onClick={() => onDeleteSchedule(item.id)}
                            title="Delete schedule"
                          >
                            <Trash2 className="icon icon-sm" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {group !== "schedules" && groups.map(g => {
        const rows = visible(g);
        return (
          <section key={g} className="record-group">
            <h3 className="group-title">{GROUP_LABEL[g]}</h3>
            {rows.length === 0 ? <p className="muted-text">No records match this filter.</p> : (
              <div className="table-wrap">
                <table className="table table-click">
                  <thead>
                    <tr><th>Source</th><th>Record ID</th><th>Coverage</th><th>Updated</th><th className="num">Entries</th><th>Availability</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} tabIndex={0} onClick={() => setOpenId(r.id)} onKeyDown={e => { if (e.key === "Enter") setOpenId(r.id); }}>
                        <td><span className="cell-strong">{r.name}</span><span className="cell-sub">{r.type}</span></td>
                        <td className="mono">{r.id}</td>
                        <td>{r.coverage}</td>
                        <td className="mono">{r.updated}</td>
                        <td className="num mono">{r.entries}</td>
                        <td><AvailabilityTag value={r.availability} />{r.gap && <span className="cell-sub">{r.gap}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {editingSchedule && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="sch-modal-title">
          <div className="modal-dialog modal-dialog-wide">
            <div className="modal-header">
              <h3 id="sch-modal-title" className="modal-title">
                {isNewSchedule ? "Add operational schedule, delivery, or hygiene check" : `Edit operational item · ${editingSchedule.referenceCode}`}
              </h3>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setEditingSchedule(null)}>
                <X className="icon" aria-hidden="true" />
              </button>
            </div>

            {isNewSchedule && (
              <div style={{ marginBottom: "14px" }}>
                <span className="field-label" style={{ display: "block", marginBottom: "6px" }}>Quick templates:</span>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {SCHEDULE_TEMPLATES.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() =>
                        setEditingSchedule({
                          ...editingSchedule,
                          category: tpl.category,
                          title: tpl.title,
                          whenLabel: tpl.whenLabel,
                          recurrence: tpl.recurrence,
                          vendorOrArea: tpl.vendorOrArea,
                          referenceCode: tpl.referenceCode,
                          instructions: tpl.instructions,
                          placement: tpl.placement,
                          severity: tpl.severity,
                        })
                      }
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="field-grid" style={{ gap: "12px", marginBottom: "12px" }}>
              <label className="field">
                <span className="field-label">Category</span>
                <select
                  className="input"
                  value={editingSchedule.category}
                  onChange={e => setEditingSchedule({ ...editingSchedule, category: e.target.value as ScheduleCategory })}
                >
                  {(Object.keys(SCHEDULE_CATEGORY_LABEL) as ScheduleCategory[]).map(cat => (
                    <option key={cat} value={cat}>{SCHEDULE_CATEGORY_LABEL[cat]}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Recurrence / Frequency</span>
                <select
                  className="input"
                  value={editingSchedule.recurrence}
                  onChange={e => {
                    const recVal = e.target.value as ScheduleRecurrence;
                    const defaultWhen =
                      recVal === "weekly_fri"
                        ? "Every Friday, 08:00 AM (Weekly recurring)"
                        : recVal === "weekly_mon"
                          ? "Every Monday, 07:00 AM (Weekly recurring)"
                          : recVal === "every_shift"
                            ? "Every shift handover"
                            : recVal === "daily"
                              ? "Daily · 07:30 AM"
                              : editingSchedule.whenLabel;
                    setEditingSchedule({ ...editingSchedule, recurrence: recVal, whenLabel: defaultWhen });
                  }}
                >
                  {(Object.keys(RECURRENCE_LABEL) as ScheduleRecurrence[]).map(rc => (
                    <option key={rc} value={rc}>{RECURRENCE_LABEL[rc]}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field" style={{ marginBottom: "12px" }}>
              <span className="field-label">Title (What is delivered, checked, or scheduled)</span>
              <input
                className="input"
                value={editingSchedule.title}
                onChange={e => setEditingSchedule({ ...editingSchedule, title: e.target.value })}
                placeholder="e.g. Delivery: Tube ice, 5 bags · or · Weekly Friday truck ingredient pickup & cold-room storage"
              />
            </label>

            <div className="field-grid field-grid-3" style={{ gap: "12px", marginBottom: "12px" }}>
              <label className="field">
                <span className="field-label">When / Delivery ETA</span>
                <input
                  className="input"
                  value={editingSchedule.whenLabel}
                  onChange={e => setEditingSchedule({ ...editingSchedule, whenLabel: e.target.value })}
                  placeholder="e.g. Tue 13 Oct, 10:00 or Every Friday 08:00"
                />
              </label>
              <label className="field">
                <span className="field-label">Supplier / Store Area</span>
                <input
                  className="input"
                  value={editingSchedule.vendorOrArea}
                  onChange={e => setEditingSchedule({ ...editingSchedule, vendorOrArea: e.target.value })}
                  placeholder="e.g. Arctic Ice Co. or Walk-in Chiller"
                />
              </label>
              <label className="field">
                <span className="field-label">Reference / PO / SOP Code</span>
                <input
                  className="input mono"
                  value={editingSchedule.referenceCode}
                  onChange={e => setEditingSchedule({ ...editingSchedule, referenceCode: e.target.value })}
                  placeholder="e.g. PO-4481 or SOP-HYG-01"
                />
              </label>
            </div>

            <label className="field" style={{ marginBottom: "12px" }}>
              <span className="field-label">Operational instructions / What staff must do</span>
              <textarea
                className="input textarea"
                rows={2}
                value={editingSchedule.instructions}
                onChange={e => setEditingSchedule({ ...editingSchedule, instructions: e.target.value })}
                placeholder="e.g. Pick up ingredients from truck, check temperature ≤ 4°C, and log putaway in inventory..."
              />
            </label>

            <div className="field-grid field-grid-3" style={{ gap: "12px", marginBottom: "14px" }}>
              <label className="field">
                <span className="field-label">Assigned to</span>
                <select
                  className="input"
                  value={editingSchedule.owner || shift.incoming}
                  onChange={e => setEditingSchedule({ ...editingSchedule, owner: e.target.value })}
                >
                  {staffOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Show in Incoming Briefing under</span>
                <select
                  className="input"
                  value={editingSchedule.placement}
                  onChange={e => setEditingSchedule({ ...editingSchedule, placement: e.target.value as "coming_up" | "needs_attention" })}
                >
                  <option value="coming_up">Coming up (Scheduled delivery / recurring task)</option>
                  <option value="needs_attention">Needs attention (Immediate operational check / issue)</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Priority / Severity</span>
                <select
                  className="input"
                  value={editingSchedule.severity}
                  onChange={e => setEditingSchedule({ ...editingSchedule, severity: e.target.value as Severity })}
                >
                  <option value="info">Informational / Routine</option>
                  <option value="review">Review required</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setEditingSchedule(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!editingSchedule.title.trim() || !editingSchedule.whenLabel.trim()}
                onClick={() => {
                  onSaveSchedule(editingSchedule, isNewSchedule);
                  setEditingSchedule(null);
                }}
              >
                <Check className="icon icon-sm" aria-hidden="true" />
                {isNewSchedule ? "Add to Operational Schedules & Briefing" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
