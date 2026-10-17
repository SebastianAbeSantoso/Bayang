import React, { useRef, useState } from "react";
import { Banknote, Check, CircleCheck, Circle, Clock, Lock, LogIn, MessageSquare, Package, Plus, Sparkles, UserCheck, Wrench, X } from "lucide-react";
import type { ChecklistItem, EquipmentEntry, ReportState, Shift, ShiftData } from "../data";
import { CAFE, EQUIPMENT_ISSUES, EQUIPMENT_ITEMS, SHIFT_TYPE_LABEL, STAFF, STAFF_NAMES, STOCK_ITEMS, categoryComplete, allChecks, bucketOf, isEntryFilled } from "../data";
import { SeverityTag, Tag } from "./ui";

type CatId = "equipment" | "stock" | "cleaning" | "cash" | "customer";
const CATS: Array<{ id: CatId; title: string; prompt: string; Icon: typeof Wrench }> = [
  { id: "equipment", title: "Equipment", prompt: "How are the machines?", Icon: Wrench },
  { id: "stock", title: "Stock and waste", prompt: "Anything restocked, wasted, or running low?", Icon: Package },
  { id: "cleaning", title: "Cleaning and closing", prompt: "Tick off the closing checklist.", Icon: Sparkles },
  { id: "cash", title: "Cash and POS", prompt: "Does the drawer match the POS?", Icon: Banknote },
  { id: "customer", title: "Customer issues and pending tasks", prompt: "Anything the next shift has to follow up?", Icon: MessageSquare },
];

// Default the next entry to equipment not yet reported.
const newEntry = (taken: EquipmentEntry[]): EquipmentEntry => ({
  issue: "", details: "", owner: "",
  item: EQUIPMENT_ITEMS.find(i => !taken.some(t => t.item === i)) ?? EQUIPMENT_ITEMS[0],
});

function Choice({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className={`choice ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={onClick} disabled={disabled}>
      {selected && <Check className="icon icon-sm" aria-hidden="true" />}
      {children}
    </button>
  );
}

function Chip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className={`chip ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function summarize(r: ReportState, d: ShiftData): Array<{ id: CatId; title: string; value: string; flagged: boolean }> {
  const e = r.equipment, s = r.stock, c = r.cash, cu = r.customer;
  const notDone = d.checklist.filter(t => t.group !== "equipment" && t.notDone);
  return [
    { id: "equipment", title: "Equipment", flagged: e.status === "attention",
      value: e.status === "ok" ? "All OK" : e.status === "attention"
        ? (e.entries ?? []).filter(isEntryFilled).map(x => `${x.item.split(" (")[0]}: ${x.issue || "type not chosen"}${x.owner ? ` → ${x.owner}` : " · no follow-up"}`).join("; ") || "Needs attention · no equipment added"
        : "Not answered" },
    { id: "stock", title: "Stock and waste", flagged: s.low || s.waste,
      value: s.ok ? "Stock OK" : [s.low && `Low: ${s.lowItems.join(", ") || "items not chosen"}`, s.waste && `Waste: ${s.wasteQty || "?"}${s.wasteUnit} ${s.wasteItem}`].filter(Boolean).join(" · ") || "Not answered" },
    { id: "cleaning", title: "Cleaning and closing", flagged: notDone.length > 0,
      value: notDone.length === 0 ? "All tasks done" : `Not done: ${notDone.map(t => `${t.label}${t.reason ? ` (“${t.reason}”)` : ""}`).join("; ")}` },
    { id: "cash", title: "Cash and POS", flagged: c.status === "variance",
      value: c.status === "balanced" ? "Balanced" : c.status === "variance" ? "Variance found" : c.status === "na" ? "Not applicable" : "Not answered" },
    { id: "customer", title: "Customer issues and pending tasks", flagged: cu.status === "followup",
      value: cu.status === "none" ? "Nothing pending" : cu.status === "followup" ? `Needs follow-up${cu.destination ? ` · to ${cu.destination}` : ""}` : "Not answered" },
  ];
}

interface Props {
  shift: Shift;
  data: ShiftData;
  locked: string | null;
  isReconciling?: boolean;
  onReport: (r: ReportState) => void;
  onSetTasks: (ids: string[], patch: Partial<ChecklistItem>) => void;
  onSignIn: (staffName: string) => void;
  onToggleEndHour: (reached: boolean) => void;
  onChangeStaff: (which: "outgoing" | "incoming", newName: string) => void;
  onSubmit: () => void;
  onUnlockReport?: () => void;
  onOpenLedger: (findingId?: string) => void;
}

export default function WorkerReport({
  shift,
  data,
  locked,
  isReconciling,
  onReport,
  onSetTasks,
  onSignIn,
  onToggleEndHour,
  onChangeStaff,
  onSubmit,
  onUnlockReport,
  onOpenLedger,
}: Props) {
  const r = data.report;
  const [noteDraft, setNoteDraft] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [draftItem, setDraftItem] = useState<string | null>(null);
  const [customStaffMode, setCustomStaffMode] = useState(false);
  const [customStaffDraft, setCustomStaffDraft] = useState("");
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const signedIn = !!data.signedIn || data.submitted;
  const endHourReached = data.endHourReached ?? true;
  const readOnly = !!locked || data.submitted || !signedIn;

  const done = CATS.filter(c => categoryComplete(r, c.id, data.checklist));
  const missing = CATS.filter(c => !done.includes(c));
  const set = <K extends keyof ReportState>(k: K, v: Partial<ReportState[K]>) => onReport({ ...r, [k]: { ...(r[k] as object), ...v } });
  const cleaningTasks = data.checklist.filter(t => t.group !== "equipment");
  const pos = data.records.find(x => x.id.startsWith("POS-"));
  const cash = data.records.find(x => x.id.startsWith("CASH-"));
  const inv = data.records.find(x => x.id.startsWith("INV-"));
  const mc = data.records.find(x => x.id.startsWith("MC-"));

  const jump = (id: string) => cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });

  const addNote = () => {
    const t = noteDraft.trim();
    if (!t) return;
    onReport({ ...r, notes: [...r.notes, t] });
    setNoteDraft("");
  };

  const startReview = () => {
    if (!signedIn) return;
    if (missing.length) { setShowErrors(true); jump(missing[0].id); return; }
    if (!endHourReached) return;
    if (noteDraft.trim()) addNote();
    setReviewing(true);
  };

  const staffOptions = Array.from(new Set([...STAFF_NAMES, shift.outgoing, shift.incoming]));

  const DEMO_PRESETS = [
    {
      id: "preset_1",
      label: "Preset 1: Afternoon Rush (Indonesian Shorthand)",
      badge: "Indonesian Shorthand · Unlogged Jam & Waste",
      note: "Tadi grinder macet 20 menit pas jam 17, buang beans 200g house blend, es batu abis dari jam 18, gak sempet deep clean steam wand kanan karena antrian rame",
      report: {
        equipment: {
          status: "attention" as const,
          entries: [{
            issue: "Machine malfunction",
            item: EQUIPMENT_ITEMS[0],
            details: "Grinder jammed for 20 minutes around 17:00",
            owner: "",
          }],
        },
        stock: {
          ok: false,
          low: true,
          waste: true,
          lowItems: ["Ice"],
          wasteItem: "House Blend beans",
          wasteQty: "200",
          wasteUnit: "g",
          wasteDetails: "Purged jammed burrs",
        },
        cleaning: { status: "incomplete" as const, details: "Steam wand deep clean skipped due to peak rush." },
        cash: { status: "balanced" as const, details: "Count Rp 1.180.000 matches POS." },
        customer: { status: "none" as const, details: "", destination: "" },
      },
      tasksUpdate: (tasks: ChecklistItem[]) => tasks.map(t => t.id === "CHK-1" ? { ...t, done: false, notDone: true, reason: "Antrian rame jam 18-20" } : { ...t, done: true, notDone: false }),
    },
    {
      id: "preset_2",
      label: "Preset 2: Spoilage & Cash Shortage (English)",
      badge: "English · Spoilage Conflict & Cash Shortage",
      note: "Oat milk 3 cartons expired dumped unlogged, cash drawer short by Rp 50.000 at close, espresso machine portafilter gasket leaking steam.",
      report: {
        equipment: {
          status: "attention" as const,
          entries: [{
            issue: "Leak / Pressure drop",
            item: EQUIPMENT_ITEMS[1] || "La Marzocco Linea PB (Bar 1)",
            details: "Portafilter grouphead gasket leaking steam during extraction",
            owner: "",
          }],
        },
        stock: {
          ok: false,
          low: false,
          waste: true,
          lowItems: [],
          wasteItem: "Oat Milk Barista 1L",
          wasteQty: "3",
          wasteUnit: "cartons",
          wasteDetails: "3 cartons past expiry date discarded",
        },
        cleaning: { status: "done" as const, details: "All closing cleaning tasks completed." },
        cash: { status: "variance" as const, details: "Cash drawer Rp 50.000 short vs POS close register." },
        customer: { status: "none" as const, details: "", destination: "" },
      },
      tasksUpdate: (tasks: ChecklistItem[]) => tasks.map(t => ({ ...t, done: true, notDone: false })),
    },
    {
      id: "preset_3",
      label: "Preset 3: Clean Shift (All Verified)",
      badge: "Zero Variance · All Verified & Reconciled",
      note: "Smooth afternoon shift. All inventory counted and matched POS, grinder calibrated at 14:00, ice restocked from backup freezer, closing cash reconciled with zero variance.",
      report: {
        equipment: {
          status: "ok" as const,
          entries: [],
        },
        stock: {
          ok: true,
          low: false,
          waste: false,
          lowItems: [],
          wasteItem: "",
          wasteQty: "",
          wasteUnit: "g",
          wasteDetails: "",
        },
        cleaning: { status: "done" as const, details: "All closing cleaning tasks completed." },
        cash: { status: "balanced" as const, details: "Count Rp 1.180.000 matches POS exactly." },
        customer: { status: "none" as const, details: "", destination: "" },
      },
      tasksUpdate: (tasks: ChecklistItem[]) => tasks.map(t => ({ ...t, done: true, notDone: false })),
    },
  ];

  const applyPreset = (presetId: string) => {
    const preset = DEMO_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    if (!endHourReached) onToggleEndHour(true);
    onReport({
      ...preset.report,
      notes: [preset.note],
    });
    const updatedTasks = preset.tasksUpdate(data.checklist);
    for (const t of updatedTasks) {
      onSetTasks([t.id], { done: t.done, notDone: t.notDone, reason: t.reason });
    }
  };

  const pct = Math.round((done.length / CATS.length) * 100);
  const results = allChecks(data);

  return (
    <div className="report">
      <div className="report-head">
        <div>
          <p className="eyebrow">{CAFE.name} · {CAFE.branch}</p>
          <h2 className="page-title page-title-lg">Finish your shift</h2>
          <p className="page-subtitle">A few quick checks so the next shift knows what happened.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
          <dl className="report-meta">
            <div><dt>Shift</dt><dd>{SHIFT_TYPE_LABEL[shift.type]} · {shift.start}–{shift.end}</dd></div>
            <div><dt>Date</dt><dd>{shift.dayShort}, {shift.dateLabel}</dd></div>
            <div>
              <dt>Reporting</dt>
              <dd style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                {!data.signedOff && !customStaffMode ? (
                  <select
                    aria-label="Reporting shift lead"
                    className="input input-sm"
                    value={shift.outgoing}
                    onChange={e => {
                      if (e.target.value === "__custom__") {
                        setCustomStaffMode(true);
                        setCustomStaffDraft("");
                      } else {
                        onChangeStaff("outgoing", e.target.value);
                      }
                    }}
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      height: "28px",
                      width: "auto",
                      background: "var(--paper-0)",
                      border: "1px solid var(--paper-400)",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                    title="Change or replace active shift lead (e.g. shift swap or sick cover)"
                  >
                    {staffOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="__custom__">+ Replace staff (cover)…</option>
                  </select>
                ) : !data.signedOff && customStaffMode ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <input
                      className="input input-sm"
                      placeholder="Replacement name…"
                      value={customStaffDraft}
                      onChange={e => setCustomStaffDraft(e.target.value)}
                      style={{ width: "135px", height: "28px", fontSize: "12.5px", padding: "2px 6px" }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={() => {
                        const trimmed = customStaffDraft.trim();
                        if (trimmed) onChangeStaff("outgoing", trimmed);
                        setCustomStaffMode(false);
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setCustomStaffMode(false)}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span>{shift.outgoing}</span>
                )}
              </dd>
            </div>
          </dl>
          {!readOnly && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <label htmlFor="demo-preset-select" style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Demo Packet:
              </label>
              <select
                id="demo-preset-select"
                className="select select-sm"
                defaultValue="preset_1"
                onChange={e => applyPreset(e.target.value)}
                style={{ fontSize: "12px", padding: "4px 8px", background: "var(--paper-0)", border: "1px solid var(--border-neutral)", borderRadius: "6px" }}
              >
                {DEMO_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const sel = document.getElementById("demo-preset-select") as HTMLSelectElement;
                  applyPreset(sel ? sel.value : "preset_1");
                }}
                title="Populate report with selected demo preset"
              >
                Load Preset
              </button>
            </div>
          )}
        </div>
      </div>

      {locked && (
        <div className="notice notice-neutral"><Lock className="icon icon-sm" aria-hidden="true" />{locked}</div>
      )}

      {!locked && !data.submitted && !signedIn && (
        <section
          aria-label="Sign in to shift"
          style={{
            background: "var(--paper-100)",
            border: "1px solid var(--amber-300)",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", maxWidth: "620px" }}>
            <LogIn className="icon" style={{ color: "var(--espresso-600)", marginTop: "2px", flexShrink: 0 }} aria-hidden="true" />
            <div>
              <p style={{ fontWeight: 600, fontSize: "14.5px", color: "var(--ink-900)", marginBottom: "4px" }}>
                Sign in to {SHIFT_TYPE_LABEL[shift.type].toLowerCase()} shift ({shift.start}–{shift.end}) before filling your report
              </p>
              <p className="muted-text" style={{ fontSize: "13px", lineHeight: 1.45 }}>
                Confirm or replace the shift lead on duty above ({shift.outgoing}). Once signed in, you can fill out the shift report at any time during the shift and complete it at the end hour ({shift.end}).
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSignIn(shift.outgoing)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0 }}
          >
            <UserCheck className="icon icon-sm" aria-hidden="true" />
            Sign in to shift as {shift.outgoing}
          </button>
        </section>
      )}

      {!locked && !data.submitted && signedIn && (
        <div
          style={{
            background: "var(--paper-100)",
            border: "1px solid var(--paper-300)",
            borderRadius: "8px",
            padding: "10px 14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            fontSize: "12.5px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ink-700)" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
            <span>
              Signed in to shift as <strong>{shift.outgoing}</strong>{data.signedInAt ? ` at ${data.signedInAt}` : ""} · Report can be filled anytime; completion unlocks at end hour ({shift.end}).
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock className="icon icon-sm" style={{ color: "var(--ink-500)" }} aria-hidden="true" />
            <span className="muted-text">Shift clock:</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => onToggleEndHour(!endHourReached)}
              style={{
                fontSize: "11.5px",
                padding: "3px 10px",
                borderRadius: "999px",
                border: "1px solid var(--paper-400)",
                background: endHourReached ? "#dcfce7" : "var(--amber-100)",
                color: endHourReached ? "#166534" : "var(--amber-900)",
                fontWeight: 600,
              }}
              title="Toggle between mid-shift filling and end-of-shift completion hour"
            >
              {endHourReached ? `● End hour reached (${shift.end})` : `◐ Mid-shift (Before ${shift.end})`}
            </button>
          </div>
        </div>
      )}

      {data.submitted && (
        <section className="submitted-panel" aria-label="Report submitted">
          <div className="submitted-head">
            <CircleCheck className="icon icon-lg text-success" aria-hidden="true" />
            <div>
              <p className="submitted-title">Report completed at {data.submittedAt} by {shift.outgoing}</p>
              <p className="submitted-sub">
                Your entries are saved as written. Completing the report does not resolve open discrepancies or transfer the shift yet; review the findings in the handover ledger below.
              </p>
            </div>
          </div>
          <ul className="result-list">
            {data.findings.map(f => {
              const open = f.checks.filter(c => bucketOf(c));
              const top = open.find(c => c.severity === "critical") ?? open[0];
              return (
                <li
                  key={f.id}
                  className="result-item"
                  style={{ cursor: "pointer" }}
                  onClick={() => onOpenLedger(f.id)}
                  title="Click to inspect this finding in the Handover Ledger"
                >
                  <span className="mono-label">{f.id}</span>
                  <span className="result-title">{f.title}</span>
                  {top ? <SeverityTag value={top.severity} /> : <Tag tone="success">No action needed</Tag>}
                </li>
              );
            })}
          </ul>
          <div className="row-gap">
            <button type="button" className="btn btn-primary" onClick={() => onOpenLedger()}>Open handover ledger</button>
            {!locked && onUnlockReport && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onUnlockReport}
                title="Unlock report form to edit answers, load presets, or re-run Gemma reconciliation"
              >
                Edit / Re-run Shift Report
              </button>
            )}
            <span className="muted-text">{results.filter(x => bucketOf(x.check)).length} check{results.length === 1 ? "" : "s"} still open</span>
          </div>
        </section>
      )}

      {!data.submitted && (
        <div className="progress-bar-wrap">
          <div className="progress-row">
            <span className="progress-label">{done.length} of {CATS.length} sections complete</span>
            <div className="progress-steps">
              {CATS.map(c => {
                const ok = done.includes(c);
                return (
                  <button key={c.id} type="button" className={`progress-step ${ok ? "is-done" : ""}`} onClick={() => jump(c.id)} title={c.title}>
                    {ok ? <CircleCheck className="icon icon-sm" aria-hidden="true" /> : <Circle className="icon icon-sm" aria-hidden="true" />}
                    <span>{c.title.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      <div className="cat-list">
        {CATS.map(({ id, title, prompt, Icon }) => {
          const complete = done.some(c => c.id === id);
          const err = showErrors && !complete;
          return (
            <section key={id} ref={el => { cardRefs.current[id] = el; }} className={`cat-card ${complete && !(id === "cleaning" && cleaningTasks.some(t => t.notDone)) ? "is-complete" : ""} ${err ? "has-error" : ""}`} aria-label={title}>
              <div className="cat-head">
                <span className="cat-icon"><Icon className="icon" aria-hidden="true" /></span>
                <div className="cat-titles">
                  <h3 className="cat-title">{title}</h3>
                  <p className="cat-prompt">{prompt}</p>
                </div>
                {(() => {
                  const partial = id === "cleaning" && complete && cleaningTasks.some(t => t.notDone);
                  return (
                    <span className={`cat-status ${complete && !partial ? "is-done" : ""} ${partial ? "is-partial" : ""}`}>
                      {partial ? "Reported · not all done" : complete ? <><Check className="icon icon-sm" aria-hidden="true" />Done</> : err ? "Required" : "To do"}
                    </span>
                  );
                })()}
              </div>

              {id === "equipment" && (() => {
                const filled = (r.equipment.entries ?? []).filter(isEntryFilled);
                // Always offer one blank entry after the last filled one.
                const draft = newEntry(filled);
                if (draftItem && !filled.some(f => f.item === draftItem)) draft.item = draftItem;
                const shown = [...filled, draft];
                const setEntry = (i: number, patch: Partial<EquipmentEntry>) => {
                  const next = shown.map((e, j) => (j === i ? { ...e, ...patch } : e));
                  if (i === filled.length && !isEntryFilled(next[i])) { setDraftItem(next[i].item); return; }
                  if (i === filled.length) setDraftItem(null);
                  set("equipment", { entries: next.filter(isEntryFilled) });
                };
                const removeEntry = (i: number) => set("equipment", { entries: filled.filter((_, j) => j !== i) });
                return (
                  <>
                    <div className="choice-row">
                      <Choice disabled={readOnly} selected={r.equipment.status === "ok"} onClick={() => set("equipment", { status: "ok", entries: [] })}>All OK</Choice>
                      <Choice disabled={readOnly} selected={r.equipment.status === "attention"} onClick={() => set("equipment", { status: "attention" })}>Needs attention</Choice>
                    </div>
                    {mc && r.equipment.status === "ok" && <p className="cat-snapshot">Recorded: {mc.id} · {mc.entries} machine cycles</p>}
                    {r.equipment.status === "attention" && (
                      <div className="followup eq-list">
                        {shown.filter((_, i) => !(readOnly && i === filled.length)).map((e, i) => {
                          const isDraft = i === filled.length;
                          return (
                            <div key={i} className={`eq-entry ${isDraft ? "is-draft" : ""}`}>
                              <div className="eq-entry-head">
                                <span className="followup-label">{isDraft ? (i === 0 ? "Which equipment?" : "Another machine? (optional)") : `Equipment ${i + 1}`}</span>
                                {!isDraft && !readOnly && (
                                  <button type="button" className="icon-btn" aria-label={`Remove equipment ${i + 1}`} onClick={() => removeEntry(i)}>
                                    <X className="icon icon-sm" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                              <div className="field-grid">
                                <label className="field">
                                  <span className="field-label">Which equipment?</span>
                                  <select className="input" disabled={readOnly} value={e.item} onChange={ev => setEntry(i, { item: ev.target.value })}>
                                    {EQUIPMENT_ITEMS.map(it => <option key={it}>{it}</option>)}
                                  </select>
                                </label>
                                <label className="field">
                                  <span className="field-label">Assign follow-up (optional)</span>
                                  <select className="input" disabled={readOnly} value={e.owner} onChange={ev => setEntry(i, { owner: ev.target.value })}>
                                    <option value="">Not assigned yet</option>
                                    {STAFF_NAMES.map(st => <option key={st}>{st}</option>)}
                                  </select>
                                </label>
                              </div>
                              <p className="field-label">What happened?</p>
                              <div className="chip-row">
                                {EQUIPMENT_ISSUES.map(iss => <Chip key={iss} disabled={readOnly} selected={e.issue === iss} onClick={() => setEntry(i, { issue: e.issue === iss ? "" : iss })}>{iss}</Chip>)}
                              </div>
                              <label className="field">
                                <span className="field-label">Add details (optional)</span>
                                <input className="input" disabled={readOnly} placeholder="e.g. tadi grinder macet 20 menit" value={e.details} onChange={ev => setEntry(i, { details: ev.target.value })} />
                              </label>
                              {!isDraft && !e.issue && <p className="hint hint-warning">Choose what happened to include this machine.</p>}
                              {!isDraft && e.issue && !e.owner && <p className="hint">No follow-up owner yet. The supervisor must assign one before sign-off.</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}

              {id === "stock" && (
                <>
                  <div className="choice-row">
                    <Choice disabled={readOnly} selected={r.stock.ok} onClick={() => set("stock", { ok: true, low: false, waste: false })}>Stock OK</Choice>
                    <Choice disabled={readOnly} selected={r.stock.low} onClick={() => set("stock", { ok: false, low: !r.stock.low })}>Low stock</Choice>
                    <Choice disabled={readOnly} selected={r.stock.waste} onClick={() => set("stock", { ok: false, waste: !r.stock.waste })}>Waste recorded</Choice>
                  </div>
                  {r.stock.low && (
                    <div className="followup">
                      <p className="followup-label">What is running low?</p>
                      <div className="chip-row">
                        {STOCK_ITEMS.map(i => {
                          const sel = r.stock.lowItems.includes(i);
                          return <Chip key={i} disabled={readOnly} selected={sel} onClick={() => set("stock", { lowItems: sel ? r.stock.lowItems.filter(x => x !== i) : [...r.stock.lowItems, i] })}>{i}</Chip>;
                        })}
                      </div>
                    </div>
                  )}
                  {r.stock.waste && (
                    <div className="followup">
                      <p className="followup-label">What was wasted?</p>
                      <div className="field-grid field-grid-3">
                        <label className="field">
                          <span className="field-label">Item</span>
                          <select className="input" disabled={readOnly} value={r.stock.wasteItem} onChange={e => set("stock", { wasteItem: e.target.value })}>
                            {STOCK_ITEMS.map(i => <option key={i}>{i}</option>)}
                          </select>
                        </label>
                        <label className="field">
                          <span className="field-label">Quantity</span>
                          <input className="input" disabled={readOnly} inputMode="decimal" placeholder="200" value={r.stock.wasteQty} onChange={e => set("stock", { wasteQty: e.target.value.replace(/[^0-9.]/g, "") })} />
                        </label>
                        <label className="field">
                          <span className="field-label">Unit</span>
                          <select className="input" disabled={readOnly} value={r.stock.wasteUnit} onChange={e => set("stock", { wasteUnit: e.target.value })}>
                            {["g", "kg", "L", "pcs", "bags"].map(u => <option key={u}>{u}</option>)}
                          </select>
                        </label>
                      </div>
                      <label className="field">
                        <span className="field-label">Why? (optional)</span>
                        <input className="input" disabled={readOnly} placeholder="e.g. buang beans waktu grinder macet" value={r.stock.wasteDetails} onChange={e => set("stock", { wasteDetails: e.target.value })} />
                      </label>
                      {inv && <p className="cat-snapshot">Checked {inv.id}: no waste adjustment posted yet, so nothing to copy over.</p>}
                    </div>
                  )}
                </>
              )}

              {id === "cleaning" && (() => {
                const unanswered = cleaningTasks.filter(t => !t.done && !t.notDone);
                return (
                  <>
                    <div className="checklist-head">
                      <span className="muted-text">
                        {cleaningTasks.filter(t => t.done).length} of {cleaningTasks.length} done
                        {cleaningTasks.some(t => t.notDone) && ` · ${cleaningTasks.filter(t => t.notDone).length} not done`}
                      </span>
                      {unanswered.length > 0 && !readOnly && (
                        <button type="button" className="link-btn" onClick={() => onSetTasks(unanswered.map(t => t.id), { done: true, notDone: false })}>Mark remaining done</button>
                      )}
                    </div>
                    <ul className="task-list">
                      {cleaningTasks.map(t => {
                        const needsReason = t.notDone && t.mandatory && !(t.reason ?? "").trim();
                        return (
                          <li key={t.id} className={`task ${t.done ? "is-done" : ""} ${t.notDone ? "is-not-done" : ""}`}>
                            <div className="task-row">
                              <span className="task-label">{t.label}</span>
                              {!t.mandatory && <span className="mono-label">Optional</span>}
                              <span className="task-toggle" role="group" aria-label={`${t.label} status`}>
                                <button type="button" className={`task-btn task-btn-done ${t.done ? "is-selected" : ""}`} aria-pressed={t.done} aria-label="Done" disabled={readOnly}
                                  onClick={() => onSetTasks([t.id], { done: !t.done, notDone: false })}>
                                  <Check className="icon icon-sm" aria-hidden="true" />
                                </button>
                                <button type="button" className={`task-btn task-btn-not ${t.notDone ? "is-selected" : ""}`} aria-pressed={!!t.notDone} aria-label="Not done" disabled={readOnly}
                                  onClick={() => onSetTasks([t.id], { notDone: !t.notDone, done: false })}>
                                  <X className="icon icon-sm" aria-hidden="true" />
                                </button>
                              </span>
                            </div>
                            {t.notDone && (
                              <label className="field task-reason">
                                <span className="field-label">Why can't this be finished?{t.mandatory ? "" : " (optional)"}</span>
                                <input className={`input ${needsReason && showErrors ? "is-invalid" : ""}`} disabled={readOnly} placeholder="e.g. ran out of sanitizer"
                                  value={t.reason ?? ""} onChange={e => onSetTasks([t.id], { reason: e.target.value })} />
                              </label>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                );
              })()}

              {id === "cash" && (
                <>
                  <div className="choice-row">
                    <Choice disabled={readOnly} selected={r.cash.status === "balanced"} onClick={() => set("cash", { status: "balanced" })}>Balanced</Choice>
                    <Choice disabled={readOnly} selected={r.cash.status === "variance"} onClick={() => set("cash", { status: "variance" })}>Variance found</Choice>
                    <Choice disabled={readOnly} selected={r.cash.status === "na"} onClick={() => set("cash", { status: "na" })}>Not applicable</Choice>
                  </div>
                  {pos && cash && (
                    <dl className="snapshot-grid">
                      <div><dt>POS cash sales</dt><dd>{pos.fields[2][1]}</dd></div>
                      <div><dt>Counted cash</dt><dd>{cash.fields[0][1]}</dd></div>
                      <div><dt>Drinks sold</dt><dd>{pos.entries}</dd></div>
                      <div><dt>Source</dt><dd className="mono">{pos.id}</dd></div>
                    </dl>
                  )}
                  {r.cash.status === "variance" && (
                    <div className="followup">
                      <label className="field">
                        <span className="field-label">What did you notice? (optional)</span>
                        <input className="input" disabled={readOnly} placeholder="e.g. kurang 20rb" value={r.cash.details} onChange={e => set("cash", { details: e.target.value })} />
                      </label>
                    </div>
                  )}
                </>
              )}

              {id === "customer" && (
                <>
                  <div className="choice-row">
                    <Choice disabled={readOnly} selected={r.customer.status === "none"} onClick={() => set("customer", { status: "none" })}>Nothing pending</Choice>
                    <Choice disabled={readOnly} selected={r.customer.status === "followup"} onClick={() => set("customer", { status: "followup" })}>Needs follow-up</Choice>
                  </div>
                  {r.customer.status === "followup" && (
                    <div className="followup">
                      <label className="field">
                        <span className="field-label">What needs following up?</span>
                        <input className="input" disabled={readOnly} placeholder="e.g. Customer left a laptop charger, kept behind the bar" value={r.customer.details} onChange={e => set("customer", { details: e.target.value })} />
                      </label>
                      <label className="field">
                        <span className="field-label">Hand over to (optional)</span>
                        <select className="input" disabled={readOnly} value={r.customer.destination} onChange={e => set("customer", { destination: e.target.value })}>
                          <option value="">Decide later</option>
                          <option>Next shift ({shift.incoming})</option>
                          <option>Supervisor ({"Kevin"})</option>
                        </select>
                      </label>
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}

        <section className="cat-card cat-card-note" aria-label="Quick note">
          <label className="field">
            <span className="cat-title">Anything else the next shift should know?</span>
            <textarea
              className="input textarea"
              rows={2}
              disabled={readOnly}
              placeholder="Type or paste a message or voice-to-text transcript, e.g. tadi grinder macet 20 menit, buang beans 200g, es batu abis"
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
            />
          </label>
          <div className="row-gap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={readOnly || !noteDraft.trim()} onClick={addNote}>
                <Plus className="icon icon-sm" aria-hidden="true" />Add note
              </button>
              <span className="muted-text">Notes are kept word for word.</span>
            </div>
            {!readOnly && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--ink-400)" }}>Insert sample:</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  style={{ fontSize: "11px", color: "var(--espresso-500)", fontWeight: 500 }}
                  onClick={() => setNoteDraft(DEMO_PRESETS[0].note)}
                  title="Insert Indonesian shorthand note"
                >
                  🇮🇩 ID Rush
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  style={{ fontSize: "11px", color: "var(--espresso-500)", fontWeight: 500 }}
                  onClick={() => setNoteDraft(DEMO_PRESETS[1].note)}
                  title="Insert English closing spoilage and cash shortage note"
                >
                  🇬🇧 EN Spoilage/Cash
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  style={{ fontSize: "11px", color: "var(--espresso-500)", fontWeight: 500 }}
                  onClick={() => setNoteDraft(DEMO_PRESETS[2].note)}
                  title="Insert Clean shift note"
                >
                  ✨ Clean Shift
                </button>
              </div>
            )}
          </div>
          {r.notes.length > 0 && (
            <ul className="note-list">
              {r.notes.map((n, i) => (
                <li key={i} className="note-item">
                  <span className="note-text">“{n}”</span>
                  {!readOnly && (
                    <button type="button" className="icon-btn" aria-label="Remove note" onClick={() => onReport({ ...r, notes: r.notes.filter((_, j) => j !== i) })}>
                      <X className="icon icon-sm" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {data.findings.filter(f => f.quote).length > 0 && (
            <div style={{ marginTop: "12px", padding: "10px 12px", background: "var(--highlight-100)", border: "1px solid var(--amber-200)", borderRadius: "6px" }}>
              <span className="mono-label" style={{ color: "var(--highlight-ink-strong)", display: "block", marginBottom: "6px", fontWeight: 600 }}>
                ✓ Verbatim Quote Spans Validated by Anti-Hallucination Gate:
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {data.findings.filter(f => f.quote).map(f => (
                  <span key={f.id} style={{ background: "var(--paper-0)", border: "1px solid var(--amber-500)", borderRadius: "4px", padding: "2px 8px", fontSize: "11.5px", fontFamily: "var(--font-mono)" }}>
                    “{f.quote}” <span style={{ color: "var(--ink-500)" }}>({f.id})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {!readOnly && (
        <div className="submit-bar">
          <div>
            {missing.length > 0 ? (
              <span className="submit-missing">
                Still to answer: {missing.map((m, i) => (
                  <React.Fragment key={m.id}>{i > 0 && ", "}<button type="button" className="link-btn" onClick={() => jump(m.id)}>{m.title}</button></React.Fragment>
                ))}
              </span>
            ) : !endHourReached ? (
              <span className="submit-missing" style={{ color: "var(--amber-900)" }}>
                All sections filled · Shift completion unlocks at end hour ({shift.end})
              </span>
            ) : (
              <span className="submit-ready">All sections answered · Ready to complete at {shift.end}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {!endHourReached && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onToggleEndHour(true)}
                title={`Reach shift end hour (${shift.end}) to allow completion`}
              >
                Reach end hour ({shift.end})
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!endHourReached || !!isReconciling}
              onClick={startReview}
            >
              {isReconciling ? "Reconciling via Gemma 3-27B-IT…" : endHourReached ? "Review and complete shift" : `Complete at ${shift.end}`}
            </button>
          </div>
        </div>
      )}

      {reviewing && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="review-title" className="modal-title">Review and complete shift report</h3>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setReviewing(false)}><X className="icon" aria-hidden="true" /></button>
            </div>
            <ul className="review-list">
              <li className="review-item">
                <span className="review-cat">Reporting shift lead</span>
                <span className="review-val">{shift.outgoing} ({SHIFT_TYPE_LABEL[shift.type]} · {shift.start}–{shift.end})</span>
              </li>
              {summarize(r, data).map(s => (
                <li key={s.id} className="review-item">
                  <span className="review-cat">{s.title}</span>
                  <span className={`review-val ${s.flagged ? "is-flagged" : ""}`}>{s.value}</span>
                </li>
              ))}
              {r.notes.length > 0 && (
                <li className="review-item">
                  <span className="review-cat">Notes</span>
                  <span className="review-val">{r.notes.map(n => `“${n}”`).join(" ")}</span>
                </li>
              )}
            </ul>
            <p className="modal-sub">ShiftGuard will reconcile your report against the shift records. Completing the report prepares the handover ledger before transferring to the next shift ({shift.incoming}).</p>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setReviewing(false)}>Keep editing</button>
              <button type="button" className="btn btn-primary" onClick={() => { setReviewing(false); onSubmit(); }}>Complete shift report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
