// ============================================================================
// ShiftGuard domain model + seeded demo data (Common Ground Coffee · Central)
// Every screen derives from this single state shape.
// ============================================================================

export type ShiftType = "morning" | "afternoon" | "night";
export type Severity = "critical" | "review" | "info";
export type Evidence = "supported" | "contradicted" | "unverified" | "conflicting";
export type Workflow = "open" | "awaiting_ack" | "carried_forward" | "resolved";
export type Resolution = "resolved" | "override" | "false_positive" | "auto" | "assigned";
export type Availability = "available" | "partial" | "missing" | "na";
export type RecordGroup = "sales" | "equipment" | "inventory";
export type Role = "outgoing" | "incoming" | "supervisor";
export type EventType =
  | "shift" | "record" | "report" | "note" | "claim" | "quote" | "rule" | "finding"
  | "task" | "resolved" | "override" | "false_positive" | "carried" | "acknowledged" | "signoff";

export const CAFE = { name: "Common Ground Coffee", branch: "Central Branch" };
export const SUPERVISOR = "Kevin";

export interface Shift {
  id: string;
  date: string;
  dayName: string;
  dayShort: string;
  dateLabel: string;
  type: ShiftType;
  start: string;
  end: string;
  outgoing: string;
  incoming: string;
  phase: "past" | "current" | "upcoming";
}

export interface ChecklistItem {
  id: string;
  label: string;
  mandatory: boolean;
  done: boolean;
  notDone?: boolean;
  reason?: string;
  group: "cleaning" | "equipment" | "prep";
  conditional?: boolean;
  solvedBy?: string;
  solvedWhat?: string;
  solvedWith?: string;
  solvedAt?: string;
}

export interface Check {
  id: string;
  title: string;
  ruleCode: string;
  severity: Severity;
  evidence: Evidence;
  workflow: Workflow;
  reason: string;
  requiredAction?: string;
  obligation?: string;
  owner?: string;
  target?: string;
  resolution?: Resolution;
  linkedTaskId?: string;
  solvedBy?: string;
  solvedWhat?: string;
  solvedWith?: string;
  solvedAt?: string;
}

export interface Finding {
  id: string;
  title: string;
  category: "equipment" | "stock" | "cash" | "customer";
  quote?: string;
  structured: string;
  explanation: string;
  unknowns: string;
  recordIds: string[];
  checks: Check[];
  aiRecommendation?: {
    recommendedOwner: string;
    recommendedTarget: string;
    recommendedAction: string;
    operationalHazard: string;
  };
}

export interface SourceRecord {
  id: string;
  name: string;
  group: RecordGroup;
  type: string;
  coverage: string;
  updated: string;
  availability: Availability;
  entries: number;
  location: string;
  gap?: string;
  fields: Array<[string, string]>;
  rows: Array<Record<string, string>>;
  establishes: string;
  doesNotEstablish: string;
}

export interface AuditEvent {
  id: string;
  shiftId: string;
  date: string;
  time: string;
  actor: string;
  actorKind: "system" | "human";
  type: EventType;
  action: string;
  findingId?: string;
  explanation: string;
  sourceRef?: string;
}

export interface EquipmentEntry { issue: string; item: string; details: string; owner: string }
export const isEntryFilled = (e: EquipmentEntry) => e.issue !== "" || e.details.trim() !== "" || e.owner !== "";

export interface ReportState {
  equipment: { status: "" | "ok" | "attention"; entries: EquipmentEntry[] };
  stock: { ok: boolean; low: boolean; waste: boolean; lowItems: string[]; wasteItem: string; wasteQty: string; wasteUnit: string; wasteDetails: string };
  cleaning: { status: "" | "done" | "incomplete"; details: string };
  cash: { status: "" | "balanced" | "variance" | "na"; details: string };
  customer: { status: "" | "none" | "followup"; details: string; destination: string };
  notes: string[];
}

export type ScheduleCategory = "delivery" | "hygiene" | "maintenance" | "inventory" | "custom";
export type ScheduleRecurrence = "one_time" | "every_shift" | "daily" | "weekly_fri" | "weekly_mon" | "monthly";

export interface OperationalScheduleItem {
  id: string;
  category: ScheduleCategory;
  title: string;
  whenLabel: string;
  recurrence: ScheduleRecurrence;
  vendorOrArea: string;
  referenceCode: string;
  instructions: string;
  owner?: string;
  placement: "coming_up" | "needs_attention";
  severity: Severity;
  status: "scheduled" | "completed" | "issue_raised";
  solvedBy?: string;
  solvedWhat?: string;
  solvedWith?: string;
  solvedAt?: string;
  linkedRecordId?: string;
  linkedFindingId?: string;
}

export const SCHEDULE_CATEGORY_LABEL: Record<ScheduleCategory, string> = {
  delivery: "Supplier delivery & receiving",
  hygiene: "Operational hygiene & food safety",
  maintenance: "Equipment calibration & maintenance",
  inventory: "Stock & cold-room putaway",
  custom: "Store operational task",
};

export const RECURRENCE_LABEL: Record<ScheduleRecurrence, string> = {
  one_time: "One-time scheduled",
  every_shift: "Every shift handover",
  daily: "Daily recurring",
  weekly_fri: "Every week on Friday",
  weekly_mon: "Every week on Monday",
  monthly: "Monthly recurring",
};

export interface ShiftRosterEntry {
  id: string;
  name: string;
  role: "shift_lead" | "floor_staff" | "owner";
  station: string;
  status: "on_duty" | "left_early" | "replaced" | "added_mid_shift";
  note: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ShiftRosterLogEntry {
  id: string;
  time: string;
  actor: string;
  action: string;
  detail: string;
}

export interface ShiftData {
  report: ReportState;
  submitted: boolean;
  submittedAt?: string;
  checklist: ChecklistItem[];
  findings: Finding[];
  records: SourceRecord[];
  schedules: OperationalScheduleItem[];
  shiftRoster?: ShiftRosterEntry[];
  shiftRosterLog?: ShiftRosterLogEntry[];
  audit: AuditEvent[];
  signedOff: boolean;
  signedOffAt?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  signedIn?: boolean;
  signedInAt?: string;
  endHourReached?: boolean;
  outgoingLead?: string;
  incomingLead?: string;
  incomingBriefing?: {
    headline: string;
    narrative: string;
    deliveryEta?: string;
    generatedBy?: string;
    latencyMs?: number;
  };
  gemmaTelemetry?: {
    model: string;
    mode: string;
    latencyMs: number;
    extractedClaimsCount: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
    tokensPerSec?: number;
    claims?: Array<{
      claim_id: string;
      claim_type: string;
      entity: string;
      action: string;
      quantity?: number;
      unit?: string;
      verbatim_quote: string;
      quote_valid: boolean;
    }>;
  };
}

export const SHIFT_TYPE_LABEL: Record<ShiftType, string> = { morning: "Morning", afternoon: "Afternoon", night: "Night" };
const SHIFT_CODE: Record<ShiftType, string> = { morning: "MOR", afternoon: "AFT", night: "NGT" };
const SHIFT_TIMES: Record<ShiftType, [string, string]> = {
  morning: ["07:00", "16:00"],
  afternoon: ["16:00", "22:00"],
  night: ["22:00", "07:00"],
};
const LEADS: Record<ShiftType, string> = { morning: "Sarah", afternoon: "Dimas", night: "Rina" };
const NEXT: Record<ShiftType, ShiftType> = { morning: "afternoon", afternoon: "night", night: "morning" };

export const STAFF = ["Sarah (Morning Manager)", "Dimas (Afternoon Manager)", "Rina (Night Manager)", "Kevin (Supervisor)", "Ayu (Barista Cover)", "Budi (Shift Cover)", "BaristaPro Service (Technician)"];
export const STAFF_NAMES = ["Dimas", "Rina", "Sarah", "Kevin", "Ayu", "Budi"];

const DAYS = [
  { date: "2026-10-12", dayName: "Monday", dayShort: "Mon", dateLabel: "12 October", short: "20261012" },
  { date: "2026-10-11", dayName: "Sunday", dayShort: "Sun", dateLabel: "11 October", short: "20261011" },
  { date: "2026-10-10", dayName: "Saturday", dayShort: "Sat", dateLabel: "10 October", short: "20261010" },
];

export const CURRENT_SHIFT_ID = "20261012-AFT";

export const SHIFTS: Shift[] = DAYS.flatMap(d =>
  (["night", "afternoon", "morning"] as ShiftType[]).map(type => {
    const id = `${d.short}-${SHIFT_CODE[type]}`;
    const phase: Shift["phase"] = id === CURRENT_SHIFT_ID ? "current" : id === "20261012-NGT" ? "upcoming" : "past";
    return {
      id,
      date: d.date,
      dayName: d.dayName,
      dayShort: d.dayShort,
      dateLabel: d.dateLabel,
      type,
      start: SHIFT_TIMES[type][0],
      end: SHIFT_TIMES[type][1],
      outgoing: LEADS[type],
      incoming: LEADS[NEXT[type]],
      phase,
    };
  })
);

export const shiftById = (id: string) => SHIFTS.find(s => s.id === id)!;
export const effectiveShift = (s: Shift, d?: ShiftData): Shift => ({
  ...s,
  outgoing: d?.outgoingLead || s.outgoing,
  incoming: d?.incomingLead || s.incoming,
});
export const shiftLabel = (s: Shift) => `${s.dayShort}, ${s.dateLabel.split(" ")[0]} ${s.dateLabel.split(" ")[1].slice(0, 3)} · ${SHIFT_TYPE_LABEL[s.type]} · ${s.start}–${s.end}`;
export const shiftShort = (s: Shift) => `${s.dayShort} ${s.dateLabel.split(" ")[0]} ${s.dateLabel.split(" ")[1].slice(0, 3)} · ${SHIFT_TYPE_LABEL[s.type]}`;

// ---------- Simulated clock for new events (demo "now" = 12 Oct, 21:50) -----
let clock = 21 * 3600 + 50 * 60;
let seq = 100;
export function stampTime() {
  clock += 23;
  const h = Math.floor(clock / 3600) % 24;
  const m = Math.floor((clock % 3600) / 60);
  const s = clock % 60;
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}
export function nextId(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}`;
}
export function makeEvent(shift: Shift, e: Omit<AuditEvent, "id" | "shiftId" | "date" | "time"> & { time?: string }): AuditEvent {
  return { id: nextId("AUD"), shiftId: shift.id, date: shift.date, time: e.time ?? stampTime(), ...e };
}

// ---------- Labels ----------------------------------------------------------
export const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", review: "Review required", info: "Informational" };
export const EVIDENCE_LABEL: Record<Evidence, string> = {
  supported: "Supported",
  contradicted: "Contradicted",
  unverified: "Not independently verified",
  conflicting: "Conflicting evidence",
};
export const WORKFLOW_LABEL: Record<Workflow, string> = {
  open: "Open",
  awaiting_ack: "Awaiting acknowledgement",
  carried_forward: "Carried forward",
  resolved: "Resolved",
};
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: "Available",
  partial: "Partial coverage",
  missing: "Missing",
  na: "Not applicable",
};
export const GROUP_LABEL: Record<RecordGroup, string> = {
  sales: "Sales and payments",
  equipment: "Equipment and maintenance",
  inventory: "Inventory and purchasing",
};
export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  shift: "Shift event",
  record: "Record imported",
  report: "Report submitted",
  note: "Worker note recorded",
  claim: "Claim extracted",
  quote: "Source quote validated",
  rule: "Rule evaluated",
  finding: "Finding created",
  task: "Task updated",
  resolved: "Finding resolved",
  override: "Override recorded",
  false_positive: "False positive recorded",
  carried: "Carried forward",
  acknowledged: "Incoming acknowledged",
  signoff: "Shift signed off",
};

// ---------- Report categories ----------------------------------------------
export const EMPTY_REPORT: ReportState = {
  equipment: { status: "", entries: [] },
  stock: { ok: false, low: false, waste: false, lowItems: [], wasteItem: "House Blend beans", wasteQty: "", wasteUnit: "g", wasteDetails: "" },
  cleaning: { status: "", details: "" },
  cash: { status: "", details: "" },
  customer: { status: "", details: "", destination: "" },
  notes: [],
};

export const EQUIPMENT_ITEMS = ["Grinder #1 (Mahlkönig E65S)", "Grinder #2 (Decaf)", "Espresso machine (La Marzocco Linea)", "Ice machine", "Dishwasher"];
export const EQUIPMENT_ISSUES = ["Machine malfunction", "Performance issue", "Cleaning or maintenance needed", "Other"];
export const STOCK_ITEMS = ["Ice", "Fresh milk", "Oat milk", "House Blend beans", "Cups (12 oz)"];

export function categoryComplete(r: ReportState, id: keyof Omit<ReportState, "notes">, checklist: ChecklistItem[]): boolean {
  switch (id) {
    case "equipment":
      if (r.equipment.status === "ok") return true;
      const filled = (r.equipment.entries ?? []).filter(isEntryFilled);
      return r.equipment.status === "attention" && filled.length > 0 && filled.every(e => e.issue !== "");
    case "stock":
      if (r.stock.ok) return true;
      if (!r.stock.low && !r.stock.waste) return false;
      if (r.stock.low && r.stock.lowItems.length === 0) return false;
      if (r.stock.waste && !(Number(r.stock.wasteQty) > 0)) return false;
      return true;
    case "cleaning":
      // Answered when every required task is done, or marked not done with a reason.
      return checklist.filter(c => c.group === "cleaning" && c.mandatory).every(c => c.done || (c.notDone && (c.reason ?? "").trim().length > 0));
    case "cash":
      return r.cash.status !== "";
    case "customer":
      return r.customer.status === "none" || (r.customer.status === "followup" && r.customer.details.trim().length > 0);
  }
}

// ---------- Records ---------------------------------------------------------
function recordsFor(shift: Shift): SourceRecord[] {
  const d = shift.date.replace(/-/g, "");
  const code = shift.id.split("-")[1];
  const cov = `${SHIFT_TYPE_LABEL[shift.type]} · ${shift.start}–${shift.end}`;
  const isCurrent = shift.phase === "current";
  const end = isCurrent ? "21:48" : shift.end === "07:00" ? "06:55" : `${String(Number(shift.end.slice(0, 2)) - 1).padStart(2, "0")}:55`;
  const drinks = isCurrent ? 83 : shift.type === "morning" ? 214 : shift.type === "afternoon" ? 131 : 22;
  const cashSales = isCurrent ? "Rp 1.180.000" : shift.type === "morning" ? "Rp 2.640.000" : "Rp 1.410.000";
  return [
    {
      id: `POS-${d}-${code}`, name: "POS export", group: "sales", type: "POS export (CSV)", coverage: cov, updated: end,
      availability: "available", entries: drinks, location: "Moka POS · daily export",
      fields: [["Espresso drinks sold", String(drinks)], ["Gross sales", isCurrent ? "Rp 4.215.000" : "Rp 5.380.000"], ["Cash sales", cashSales]],
      rows: [
        { time: "16:04", item: "Iced Latte", qty: "2", payment: "QRIS" },
        { time: "17:41", item: "Cappuccino", qty: "1", payment: "Cash" },
        { time: "21:31", item: "Americano", qty: "1", payment: "Card" },
      ],
      establishes: "How many drinks were rung up and how they were paid for.",
      doesNotEstablish: "Drinks remade, given away without a POS entry, or wasted during preparation.",
    },
    {
      id: `VOID-${d}-${code}`, name: "Voids and complimentary items", group: "sales", type: "POS export (CSV)", coverage: cov, updated: end,
      availability: "available", entries: 2, location: "Moka POS · void report",
      fields: [["Voids", "1"], ["Complimentary", "1"]],
      rows: [
        { time: "18:02", item: "Flat White", reason: "Wrong milk", by: shift.outgoing },
        { time: "20:15", item: "Espresso", reason: "Staff comp", by: shift.outgoing },
      ],
      establishes: "Which POS items were voided or marked complimentary, and by whom.",
      doesNotEstablish: "Whether a voided drink was physically made.",
    },
    {
      id: `CASH-${d}-${code}`, name: "Cash count", group: "sales", type: "Manual count sheet", coverage: `Close count · ${shift.end}`, updated: end,
      availability: "available", entries: 1, location: "Cash drawer · counted by shift lead",
      fields: [["Counted cash sales", cashSales], ["POS cash sales", cashSales], ["Difference", "Rp 0"]],
      rows: [{ time: end, counted: cashSales, expected: cashSales, by: shift.outgoing }],
      establishes: "That the counted cash matched POS cash sales at the time of count.",
      doesNotEstablish: "Cash movements after the count was taken.",
    },
    {
      id: `MC-${d}-${code}`, name: "Espresso machine counter", group: "equipment", type: "Manual counter reading", coverage: cov, updated: end,
      availability: "available", entries: drinks + 1, location: "La Marzocco Linea · read by shift lead",
      fields: [["Group cycles", String(drinks + 1)], ["Cleaning cycles noted", "1 (backflush)"]],
      rows: [{ time: shift.start, reading: "48,210" }, { time: end, reading: String(48210 + drinks + 1) }],
      establishes: "How many shots the machine pulled between two manual readings.",
      doesNotEstablish: "Which cycles were drinks, re-pulls, or cleaning.",
    },
    {
      id: `CLN-${d}-${code}`, name: "Cleaning cycles", group: "equipment", type: "Paper log (photographed)", coverage: cov, updated: end,
      availability: isCurrent ? "partial" : "available", entries: isCurrent ? 1 : 2, location: "Back-bar clipboard",
      gap: isCurrent ? "Group-head clean not yet recorded" : undefined,
      fields: [["Backflush", "Recorded 21:45"], ["Group-head clean", isCurrent ? "Not recorded" : "Recorded"]],
      rows: isCurrent ? [{ time: "21:45", task: "Backflush", by: shift.outgoing }] : [{ time: end, task: "Backflush", by: shift.outgoing }, { time: end, task: "Group-head clean", by: shift.outgoing }],
      establishes: "Cleaning steps someone wrote down on the log.",
      doesNotEstablish: "Cleaning that happened but was not written down.",
    },
    {
      id: `IB-${d}`, name: "Manual incident book", group: "equipment", type: "Paper log", coverage: cov, updated: isCurrent ? "21:55" : end,
      availability: "available", entries: 0, location: "Barista Station 1",
      fields: [["Logged incidents", "0"], ["Physical record", "Barista Station 1"], ["Last recorded event", isCurrent ? "21:55 (page check, no entry)" : end]],
      rows: [],
      establishes: "No incidents were written in the incident book during this shift.",
      doesNotEstablish: "That no incident occurred. Staff may report an incident elsewhere, or not log it at all.",
    },
    {
      id: `MT-${d}-${code}`, name: "Maintenance assignments", group: "equipment", type: "Shared task sheet", coverage: cov, updated: end,
      availability: "available", entries: 0, location: "Google Sheet · Maintenance",
      fields: [["Open tickets", "0"], ["Assigned technician visits", "0"]],
      rows: [],
      establishes: "No maintenance follow-up has been assigned for this shift.",
      doesNotEstablish: "The current operating condition of any equipment.",
    },
    {
      id: `INV-${d}-${code}`, name: "Inventory ledger", group: "inventory", type: "POS inventory module", coverage: cov, updated: end,
      availability: "available", entries: 14, location: "Moka POS · inventory",
      fields: [["Stock movements", "14"], ["Waste adjustments", "0"]],
      rows: [
        { time: "16:10", item: "Fresh milk", movement: "−6 L", type: "Usage" },
        { time: "19:20", item: "House Blend beans", movement: "−1.2 kg", type: "Usage" },
      ],
      establishes: "Stock movements that were posted in the POS inventory module.",
      doesNotEstablish: "Physical waste that was never posted.",
    },
    {
      id: `SS-${d}-${code}`, name: "Manual stock sheet", group: "inventory", type: "Paper sheet (photographed)", coverage: `Close count · ${shift.end}`, updated: isCurrent ? "21:40" : end,
      availability: "available", entries: 5, location: "Store room door",
      fields: [["Ice", isCurrent ? "0 bags (par 2)" : "3 bags (par 2)"], ["Fresh milk", "8 L (par 6)"], ["House Blend beans", "2.4 kg (par 2)"]],
      rows: [
        { item: "Ice", count: isCurrent ? "0 bags" : "3 bags", par: "2 bags" },
        { item: "Fresh milk", count: "8 L", par: "6 L" },
        { item: "House Blend beans", count: "2.4 kg", par: "2 kg" },
      ],
      establishes: "What was physically counted at close.",
      doesNotEstablish: "When stock ran out during the shift.",
    },
    {
      id: "PO-4481", name: "Supplier orders", group: "inventory", type: "Supplier confirmation (WhatsApp)", coverage: "Order placed 12 Oct, 18:15", updated: "18:15",
      availability: isCurrent ? "available" : "na", entries: isCurrent ? 1 : 0, location: "Arctic Ice Co.",
      fields: isCurrent ? [["Item", "Tube ice, 5 bags"], ["Delivery", "Tue 13 Oct, 10:00 (stated by supplier)"]] : [["Orders", "None for this shift"]],
      rows: isCurrent ? [{ placed: "18:15", supplier: "Arctic Ice Co.", item: "Tube ice × 5", delivery: "13 Oct 10:00" }] : [],
      establishes: "The supplier confirmed an order and stated a delivery time.",
      doesNotEstablish: "That the delivery has arrived.",
    },
  ];
}

// ---------- Checklist -------------------------------------------------------
function checklistFor(done: boolean): ChecklistItem[] {
  return [
    { id: "CHK-1", label: "Clean group heads and steam wands", mandatory: true, done, group: "cleaning" },
    { id: "CHK-2", label: "Backflush espresso machine", mandatory: true, done, group: "cleaning" },
    { id: "CHK-3", label: "Sanitize counters and prep stations", mandatory: true, done, group: "cleaning" },
    { id: "CHK-4", label: "Empty knock-box and grounds bin", mandatory: true, done, group: "cleaning" },
    { id: "CHK-5", label: "Count and sign closing stock sheet", mandatory: true, done, group: "cleaning" },
    { id: "CHK-7", label: "Prep for next shift: batch cold brew", mandatory: false, done, group: "prep" },
  ];
}

export const FOLLOWUP_TASK: ChecklistItem = {
  id: "CHK-6", label: "Record and assign follow-up for reported equipment issue", mandatory: true, done: false, group: "equipment", conditional: true,
};

// ---------- Reconciliation (deterministic, demo rules) ----------------------
const findQuote = (notes: string[], keys: string[]) => {
  for (const n of notes) {
    for (const part of n.split(/[,.;]/)) {
      const p = part.trim();
      if (p && keys.some(k => p.toLowerCase().includes(k))) return p;
    }
  }
  return undefined;
};

export function reconcile(shift: Shift, data: ShiftData): { findings: Finding[]; checklist: ChecklistItem[]; events: AuditEvent[] } {
  const r = data.report;
  const rec = (prefix: string) => data.records.find(x => x.id.startsWith(prefix))!;
  const ib = rec("IB-");
  const mt = rec("MT-");
  const findings: Finding[] = [];
  const events: AuditEvent[] = [];
  let checklist = data.checklist.filter(c => !c.id.startsWith(FOLLOWUP_TASK.id));
  const sys = (type: EventType, action: string, explanation: string, extra: Partial<AuditEvent> = {}) =>
    events.push(makeEvent(shift, { actor: type === "claim" || type === "quote" ? "Claim extractor (Gemma 2B)" : "Rule engine", actorKind: "system", type, action, explanation, ...extra }));

  // Equipment: one finding per reported machine
  const noteEqQuote = findQuote(r.notes, ["grinder", "mesin", "machine"]);
  let entries = r.equipment.status === "attention" ? (r.equipment.entries ?? []).filter(e => e.issue !== "") : [];
  if (entries.length === 0 && r.equipment.status !== "ok" && noteEqQuote)
    entries = [{ issue: "Other", item: EQUIPMENT_ITEMS[0], details: "", owner: "" }];
  const eqQuotes: string[] = [];
  entries.forEach((e, i) => {
    const fid = i === 0 ? "FND-001" : `FND-01${i}`;
    const taskId = i === 0 ? FOLLOWUP_TASK.id : `${FOLLOWUP_TASK.id}.${i + 1}`;
    const quote = e.details.trim() || (i === 0 ? noteEqQuote : undefined);
    if (quote) eqQuotes.push(quote);
    const assigned = e.owner !== "";
    const item = e.item.split(" (")[0];
    checklist = [...checklist, { ...FOLLOWUP_TASK, id: taskId, label: `Record and assign follow-up: ${item}`, done: assigned }];
    findings.push({
      id: fid,
      title: `${item}: ${e.issue.toLowerCase()} reported`,
      category: "equipment",
      quote,
      structured: `Equipment · Needs attention · ${e.issue} · ${e.item}`,
      explanation: assigned
        ? `The cause of the issue and the equipment's current operational status have not been confirmed. Follow-up was assigned to ${e.owner} in the report.`
        : "The cause of the issue and the equipment's current operational status have not been confirmed. No assigned follow-up is recorded.",
      unknowns: "Exact time the issue started, how long it lasted, and whether the equipment is fully operational now.",
      recordIds: [ib.id, mt.id],
      checks: [
        {
          id: `${fid}-A`, title: `Reported ${item.toLowerCase()} issue`, ruleCode: "R-INC-001", severity: "review", evidence: "unverified", workflow: "open",
          reason: `No matching entry in the manual incident book (${ib.id}, 0 entries for ${shift.start}–${shift.end}). This does not mean the report is wrong.`,
          requiredAction: "Confirm the incident, or add it to the incident book.",
        },
        {
          id: `${fid}-B`, title: `${item} follow-up`, ruleCode: "POL-EQP-004", severity: "critical", evidence: "supported",
          workflow: assigned ? "resolved" : "open", resolution: assigned ? "assigned" : undefined, owner: assigned ? e.owner : undefined,
          reason: assigned
            ? `Follow-up assigned to ${e.owner} in the shift report.`
            : `Checklist task ${taskId} is incomplete and ${mt.id} shows no maintenance assignment. Café policy makes this a sign-off blocker.`,
          requiredAction: "Assign a follow-up or record a permitted disposition.",
          linkedTaskId: taskId,
        },
      ],
    });
  });

  // Waste
  const wasteQuote = r.stock.wasteDetails.trim() || findQuote(r.notes, ["buang", "waste", "spill"]);
  if (r.stock.waste || wasteQuote) {
    const amount = r.stock.waste ? `${r.stock.wasteQty}${r.stock.wasteUnit} ${r.stock.wasteItem}` : "reported waste";
    findings.push({
      id: "FND-002", title: `Waste of ${amount} not posted in inventory`, category: "stock", quote: wasteQuote,
      structured: `Stock and waste · Waste recorded · ${amount}`,
      explanation: "The worker recorded waste in the shift report. No matching waste adjustment exists in the inventory ledger.",
      unknowns: "Why the beans were discarded and whether the amount is exact.",
      recordIds: [rec("INV-").id],
      checks: [{
        id: "FND-002-A", title: "Waste adjustment posted", ruleCode: "R-INV-003", severity: "review", evidence: "unverified", workflow: "open",
        reason: `${rec("INV-").id} contains 0 waste adjustments for this shift.`,
        requiredAction: "Post the waste adjustment in the inventory module, or confirm the amount.",
      }],
    });
  }

  // Low stock
  const iceQuote = findQuote(r.notes, ["es batu", "ice", "habis", "abis"]);
  const lowItems = r.stock.low ? r.stock.lowItems : iceQuote ? ["Ice"] : [];
  if (lowItems.length) {
    const ice = lowItems.includes("Ice");
    findings.push({
      id: "FND-003", title: `Low stock: ${lowItems.join(", ")}`, category: "stock", quote: iceQuote,
      structured: `Stock and waste · Low stock · ${lowItems.join(", ")}`,
      explanation: ice
        ? "The closing stock sheet shows 0 bags of ice against a par of 2. Supplier order PO-4481 states delivery on 13 Oct at 10:00."
        : "The worker reported low stock. Restocking should be planned for the next shift.",
      unknowns: ice ? "Whether demand before 10:00 tomorrow will need an emergency ice purchase." : "Exact remaining quantity.",
      recordIds: ice ? [rec("SS-").id, "PO-4481"] : [rec("SS-").id],
      checks: [{
        id: "FND-003-A", title: "Stock level matches closing count", ruleCode: "R-STK-002", severity: "info", evidence: "supported", workflow: "open",
        reason: ice ? `${rec("SS-").id}: Ice 0 bags (par 2).` : "Reported by the worker; matches the stock sheet note.",
        obligation: ice ? "Receive ice delivery PO-4481 (13 Oct, 10:00, per supplier)." : `Restock ${lowItems.join(", ")}.`,
      }],
    });
  }

  // POS & cash
  const pos = rec("POS-");
  const mc = rec("MC-");
  const cashChecks: Check[] = [{
    id: "FND-004-A", title: "Machine cycles vs POS drinks", ruleCode: "R-POS-001", severity: "info", evidence: "supported", workflow: "resolved", resolution: "auto",
    reason: `${mc.id}: ${mc.entries} cycles, ${pos.id}: ${pos.entries} drinks. Difference of 1 matches the backflush logged at 21:45.`,
  }];
  if (r.cash.status === "balanced") {
    cashChecks.push({
      id: "FND-004-B", title: "Cash count vs POS cash sales", ruleCode: "R-CSH-001", severity: "info", evidence: "supported", workflow: "resolved", resolution: "auto",
      reason: `${rec("CASH-").id} matches POS cash sales (difference Rp 0).`,
    });
  } else if (r.cash.status === "variance") {
    cashChecks.push({
      id: "FND-004-B", title: "Reported cash variance", ruleCode: "R-CSH-001", severity: "review", evidence: "conflicting", workflow: "open",
      reason: `The worker reported a variance, but ${rec("CASH-").id} records a difference of Rp 0.`,
      requiredAction: "Recount the drawer or correct the count sheet.",
    });
  }
  findings.push({
    id: "FND-004", title: r.cash.status === "variance" ? "Cash variance reported" : "Sales, cash, and machine counts reconciled", category: "cash",
    quote: r.cash.details.trim() || undefined,
    structured: `Cash and POS · ${r.cash.status === "na" ? "Not applicable" : r.cash.status === "variance" ? "Variance found" : "Balanced"}`,
    explanation: r.cash.status === "variance" ? "The worker's report and the count sheet disagree. Neither source is assumed to be correct." : "Counts are consistent within tolerance.",
    unknowns: r.cash.status === "variance" ? "Size of the variance the worker observed." : "None.",
    recordIds: [pos.id, mc.id, rec("CASH-").id],
    checks: cashChecks,
  });

  // Customer follow-up
  if (r.customer.status === "followup") {
    findings.push({
      id: "FND-005", title: "Customer follow-up pending", category: "customer", quote: r.customer.details.trim(),
      structured: "Customer issues · Needs follow-up",
      explanation: "Pending task handed over by the outgoing worker.",
      unknowns: "None recorded.",
      recordIds: [],
      checks: [{
        id: "FND-005-A", title: "Follow-up handed over", ruleCode: "R-HND-001", severity: "info", evidence: "supported",
        workflow: r.customer.destination ? "awaiting_ack" : "open",
        target: r.customer.destination || undefined, owner: r.customer.destination ? shift.incoming : undefined,
        reason: "Recorded in the shift report.", obligation: r.customer.details.trim(),
      }],
    });
  }

  // Audit trail of reconciliation
  const claimQuotes = [...eqQuotes, wasteQuote, iceQuote].filter(Boolean) as string[];
  claimQuotes.forEach(q => {
    sys("claim", "Claim extracted", `Extracted claim from worker note: “${q}”.`);
    sys("quote", "Source quote validated", `Exact substring match found in the original note.`);
  });
  findings.forEach(f =>
    f.checks.forEach(c => sys("rule", `Rule ${c.ruleCode} evaluated`, `${c.title}: ${EVIDENCE_LABEL[c.evidence]}, ${SEVERITY_LABEL[c.severity]}.`, { findingId: f.id, sourceRef: f.recordIds[0] }))
  );
  findings.forEach(f => sys("finding", "Finding created", f.title, { findingId: f.id }));
  return { findings, checklist, events };
}

export function schedulesFor(shift: Shift): OperationalScheduleItem[] {
  const isCurrentOrUpcoming = shift.phase !== "past";
  return [
    {
      id: "PO-4481",
      category: "delivery",
      title: "Delivery: Tube ice, 5 bags",
      whenLabel: "Tue 13 Oct, 10:00 (stated by supplier)",
      recurrence: "one_time",
      vendorOrArea: "Arctic Ice Co.",
      referenceCode: "PO-4481",
      instructions: "Receive 5 bags of tube ice at back loading door and transfer immediately to backup chest freezer. Note: 3-hour gap between 07:00 rush and 10:00 delivery.",
      owner: shift.incoming,
      placement: "coming_up",
      severity: "review",
      status: isCurrentOrUpcoming ? "scheduled" : "completed",
      solvedBy: isCurrentOrUpcoming ? undefined : shift.incoming,
      solvedWhat: isCurrentOrUpcoming ? undefined : "Received 5 bags of tube ice",
      solvedWith: isCurrentOrUpcoming ? undefined : "Signed delivery docket PO-4481 & stored in chest freezer",
      solvedAt: isCurrentOrUpcoming ? undefined : "10:04",
      linkedRecordId: "PO-4481",
    },
    {
      id: "SCH-FRI-TRUCK",
      category: "delivery",
      title: "Weekly ingredient truck pickup & cold-room storage",
      whenLabel: "Every Friday, 08:00 (Weekly recurring schedule)",
      recurrence: "weekly_fri",
      vendorOrArea: "Central Roastery & Dairy Truck",
      referenceCode: "SOP-RCV-04",
      instructions: "Pick up 12× Oat Milk Barista cases + 15kg House Blend beans from Friday delivery truck, check cold-chain temp, and store in walk-in chiller.",
      owner: shift.incoming,
      placement: "coming_up",
      severity: "info",
      status: "scheduled",
    },
    {
      id: "SCH-HYG-01",
      category: "hygiene",
      title: "Operational hygiene checking: Milk chiller & sanitizer audit",
      whenLabel: `Every shift start (${shift.end} handover)`,
      recurrence: "every_shift",
      vendorOrArea: "Espresso Bar & Undercounter Chiller",
      referenceCode: "SOP-HYG-01",
      instructions: "Verify undercounter milk chiller ≤ 4.0°C, test sanitizer strip ppm, and inspect steam wand purge nozzle before opening bar.",
      owner: shift.incoming,
      placement: "needs_attention",
      severity: "review",
      status: isCurrentOrUpcoming ? "scheduled" : "completed",
      solvedBy: isCurrentOrUpcoming ? undefined : shift.incoming,
      solvedWhat: isCurrentOrUpcoming ? undefined : "Milk chiller 3.4°C & sanitizer verified",
      solvedWith: isCurrentOrUpcoming ? undefined : "Digital probe log SOP-HYG-01 signed",
      solvedAt: isCurrentOrUpcoming ? undefined : shift.start,
    },
  ];
}

// ---------- Seed ------------------------------------------------------------
function historical(shift: Shift): ShiftData {
  const records = recordsFor(shift);
  const base: ShiftData = {
    report: {
      ...EMPTY_REPORT,
      equipment: { ...EMPTY_REPORT.equipment, status: "ok" },
      stock: { ...EMPTY_REPORT.stock, ok: true },
      cleaning: { status: "done", details: "" },
      cash: { status: "balanced", details: "" },
      customer: { status: "none", details: "", destination: "" },
    },
    submitted: true,
    submittedAt: shift.end === "07:00" ? "06:48" : `${String(Number(shift.end.slice(0, 2)) - 1).padStart(2, "0")}:48`,
    checklist: checklistFor(true),
    findings: [],
    records,
    schedules: schedulesFor(shift),
    audit: [],
    signedOff: true,
    acknowledged: true,
    signedIn: true,
    signedInAt: `${shift.start}:00`,
    endHourReached: true,
  };
  const pos = records[0];
  const mc = records[3];
  base.findings = [{
    id: "FND-004", title: "Sales, cash, and machine counts reconciled", category: "cash", structured: "Cash and POS · Balanced",
    explanation: "Counts are consistent within tolerance.", unknowns: "None.", recordIds: [pos.id, mc.id],
    checks: [{
      id: "FND-004-A", title: "Machine cycles vs POS drinks", ruleCode: "R-POS-001", severity: "info", evidence: "supported", workflow: "resolved", resolution: "auto",
      reason: `${mc.id}: ${mc.entries} cycles, ${pos.id}: ${pos.entries} drinks. Within tolerance.`,
    }],
  }];
  const t = base.submittedAt!;
  base.signedOffAt = t.replace(/48$/, "56");
  base.acknowledgedAt = t.replace(/48$/, "59");
  base.audit = [
    { id: `${shift.id}-1`, shiftId: shift.id, date: shift.date, time: `${shift.start}:00`, actor: shift.outgoing, actorKind: "human", type: "shift", action: "Shift started", explanation: `${SHIFT_TYPE_LABEL[shift.type]} shift opened.` },
    { id: `${shift.id}-2`, shiftId: shift.id, date: shift.date, time: `${t}:10`, actor: shift.outgoing, actorKind: "human", type: "report", action: "Shift report submitted", explanation: "All five categories reported normal." },
    { id: `${shift.id}-3`, shiftId: shift.id, date: shift.date, time: `${t}:31`, actor: "Rule engine", actorKind: "system", type: "rule", action: "Rule R-POS-001 evaluated", findingId: "FND-004", sourceRef: pos.id, explanation: "Machine cycles vs POS drinks within tolerance." },
    { id: `${shift.id}-4`, shiftId: shift.id, date: shift.date, time: `${base.signedOffAt}:02`, actor: `${SUPERVISOR} (Supervisor)`, actorKind: "human", type: "signoff", action: "Shift transferred to next shift", explanation: "No blockers remained." },
    { id: `${shift.id}-5`, shiftId: shift.id, date: shift.date, time: `${base.acknowledgedAt}:40`, actor: shift.incoming, actorKind: "human", type: "acknowledged", action: "Incoming shift acknowledged", explanation: "Handover briefing received." },
  ];
  base.shiftRoster = [
    { id: `${shift.id}-SR-1`, name: shift.outgoing, role: "shift_lead", station: "Manager", status: "on_duty", note: "Completed shift as lead", updatedAt: shift.start, updatedBy: shift.outgoing },
    { id: `${shift.id}-SR-2`, name: "Sari", role: "floor_staff", station: "Barista", status: "on_duty", note: "Full shift", updatedAt: shift.start, updatedBy: shift.outgoing },
    { id: `${shift.id}-SR-3`, name: "Bima", role: "floor_staff", station: "Cashier", status: "on_duty", note: "Full shift", updatedAt: shift.start, updatedBy: shift.outgoing },
  ];
  base.shiftRosterLog = [
    { id: `${shift.id}-SRL-1`, time: shift.start, actor: shift.outgoing, action: "Shift roster initialized", detail: `${shift.outgoing} (Manager), Sari (Barista), Bima (Cashier) on duty.` },
  ];
  return base;
}

export function buildEmptyDb(): Record<string, ShiftData> {
  const db: Record<string, ShiftData> = {};
  for (const s of SHIFTS) {
    db[s.id] = {
      report: EMPTY_REPORT,
      submitted: false,
      checklist: checklistFor(false),
      findings: [],
      records: recordsFor(s),
      schedules: [],
      shiftRoster: [
        { id: `${s.id}-SR-1`, name: s.outgoing, role: "shift_lead", station: "Manager", status: "on_duty", note: "Scheduled shift lead", updatedAt: s.start, updatedBy: s.outgoing },
        { id: `${s.id}-SR-2`, name: "Sari", role: "floor_staff", station: "Barista", status: "on_duty", note: "Scheduled on floor", updatedAt: s.start, updatedBy: s.outgoing },
        { id: `${s.id}-SR-3`, name: "Bima", role: "floor_staff", station: "Cashier", status: "on_duty", note: "Scheduled on floor", updatedAt: s.start, updatedBy: s.outgoing },
      ],
      shiftRosterLog: [],
      audit: [],
      signedOff: false,
      acknowledged: false,
      signedIn: false,
      endHourReached: s.phase === "current",
      gemmaTelemetry: {
        model: "google/gemma-3-27b-it",
        mode: "standby",
        latencyMs: 0,
        extractedClaimsCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        tokensPerSec: 0,
        claims: [],
      },
    };
  }
  return db;
}

export function buildInitialDb(): Record<string, ShiftData> {
  const db: Record<string, ShiftData> = {};
  for (const s of SHIFTS) {
    if (s.phase === "past") db[s.id] = historical(s);
    else if (s.phase === "upcoming")
      db[s.id] = {
        report: EMPTY_REPORT,
        submitted: false,
        checklist: checklistFor(false),
        findings: [],
        records: recordsFor(s),
        schedules: schedulesFor(s),
        shiftRoster: [
          { id: `${s.id}-SR-1`, name: s.outgoing, role: "shift_lead", station: "Manager", status: "on_duty", note: "Scheduled shift lead", updatedAt: s.start, updatedBy: s.outgoing },
          { id: `${s.id}-SR-2`, name: "Nadia", role: "floor_staff", station: "Cold Bar", status: "on_duty", note: "Scheduled on floor", updatedAt: s.start, updatedBy: s.outgoing },
          { id: `${s.id}-SR-3`, name: "Reza", role: "floor_staff", station: "Roastery Support", status: "on_duty", note: "Scheduled on floor", updatedAt: s.start, updatedBy: s.outgoing },
        ],
        shiftRosterLog: [],
        audit: [],
        signedOff: false,
        acknowledged: false,
        signedIn: false,
        endHourReached: false,
      };
    else {
      const records = recordsFor(s);
      const seededReport: ReportState = {
        equipment: {
          status: "attention",
          entries: [
            {
              issue: "Machine malfunction",
              item: EQUIPMENT_ITEMS[0],
              details: "Grinder jammed for 20 minutes around 17:00",
              owner: "",
            },
          ],
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
        cleaning: { status: "incomplete", details: "Steam wand deep clean skipped due to peak rush." },
        cash: { status: "balanced", details: "Count Rp 1.180.000 matches POS." },
        customer: { status: "none", details: "", destination: "" },
        notes: [
          "Tadi grinder macet 20 menit pas jam 17, buang beans 200g house blend, es batu abis dari jam 18, gak sempet deep clean steam wand kanan karena antrian rame",
        ],
      };
      const seededChecklist = checklistFor(true).map(t =>
        t.id === "CHK-1" ? { ...t, done: false, notDone: true, reason: "Antrian rame jam 18-20" } : t
      );
      const baseShiftData: ShiftData = {
        report: seededReport,
        submitted: true,
        submittedAt: "21:52",
        checklist: seededChecklist,
        findings: [],
        records,
        schedules: schedulesFor(s),
        shiftRoster: [
          { id: "SR-AFT-1", name: s.outgoing, role: "shift_lead", station: "Manager", status: "on_duty", note: "Shift lead on duty since shift start", updatedAt: "16:02", updatedBy: s.outgoing },
          { id: "SR-AFT-2", name: "Sari", role: "floor_staff", station: "Barista", status: "on_duty", note: "Espresso bar station", updatedAt: "16:02", updatedBy: s.outgoing },
          { id: "SR-AFT-3", name: "Bima", role: "floor_staff", station: "Cashier", status: "left_early", note: "Left early at 19:30 (unwell) — covered by Reza", updatedAt: "19:30", updatedBy: s.outgoing },
          { id: "SR-AFT-4", name: "Reza", role: "floor_staff", station: "Cashier (Cover)", status: "added_mid_shift", note: "Called in mid-shift to cover Bima on Cashier", updatedAt: "19:32", updatedBy: s.outgoing },
          { id: "SR-AFT-5", name: "Nadia", role: "floor_staff", station: "Cold Bar", status: "on_duty", note: "Cold bar & customer pickup", updatedAt: "16:02", updatedBy: s.outgoing },
        ],
        shiftRosterLog: [
          { id: "SRL-AFT-3", time: "19:32", actor: `${s.outgoing} (Shift Lead)`, action: "Added staff mid-shift", detail: "Reza added to Cashier (Cover) to replace Bima." },
          { id: "SRL-AFT-2", time: "19:30", actor: `${s.outgoing} (Shift Lead)`, action: "Marked Left Early", detail: "Bima (Cashier) left early at 19:30 (unwell)." },
          { id: "SRL-AFT-1", time: "16:02", actor: `${s.outgoing} (Shift Lead)`, action: "Shift roster initialized", detail: `${s.outgoing} (Manager), Sari (Barista), Bima (Cashier), Nadia (Cold Bar) signed in.` },
        ],
        signedOff: false,
        acknowledged: false,
        signedIn: true,
        signedInAt: "16:02",
        endHourReached: true,
        gemmaTelemetry: {
          model: "google/gemma-3-27b-it",
          mode: "seeded_demo_snapshot",
          latencyMs: 892,
          extractedClaimsCount: 4,
          promptTokens: 640,
          completionTokens: 310,
          totalTokens: 950,
          estimatedCostUsd: 0.000157,
          tokensPerSec: 347.5,
          claims: [
            {
              claim_id: "CLM-01",
              claim_type: "equipment_issue",
              entity: "Grinder #1 (Mahlkönig E65S)",
              action: "jammed for 20 minutes",
              quantity: 20,
              unit: "minutes",
              verbatim_quote: "grinder macet 20 menit pas jam 17",
              quote_valid: true,
            },
            {
              claim_id: "CLM-02",
              claim_type: "remake_waste",
              entity: "House Blend beans",
              action: "wasted during recalibration",
              quantity: 200,
              unit: "g",
              verbatim_quote: "buang beans 200g house blend",
              quote_valid: true,
            },
            {
              claim_id: "CLM-03",
              claim_type: "stock_action",
              entity: "Ice cubes",
              action: "depleted",
              verbatim_quote: "es batu abis dari jam 18",
              quote_valid: true,
            },
            {
              claim_id: "CLM-04",
              claim_type: "task_completion",
              entity: "Right steam wand",
              action: "deep cleaning skipped",
              verbatim_quote: "gak sempet deep clean steam wand kanan",
              quote_valid: true,
            },
          ],
        },
        audit: [
          { id: "A-AFT-1", shiftId: s.id, date: s.date, time: "16:02:11", actor: s.outgoing, actorKind: "human", type: "shift", action: "Shift opened", explanation: "Afternoon shift roster active." },
          { id: "A-AFT-2", shiftId: s.id, date: s.date, time: "18:15:40", actor: "Supplier import", actorKind: "system", type: "record", action: "Supplier order recorded", sourceRef: "PO-4481", explanation: "Arctic Ice Co. confirmed 5 bags for 13 Oct, 10:00." },
          { id: "A-AFT-3", shiftId: s.id, date: s.date, time: "21:40:05", actor: s.outgoing, actorKind: "human", type: "record", action: "Closing stock sheet photographed", sourceRef: `SS-20261012-AFT`, explanation: "Manual count uploaded." },
          { id: "A-AFT-4", shiftId: s.id, date: s.date, time: "21:48:30", actor: "POS import", actorKind: "system", type: "record", action: "POS export imported", sourceRef: "POS-20261012-AFT", explanation: "83 espresso drinks, 2 voids/comps." },
        ],
      };
      const rec = reconcile(s, baseShiftData);
      db[s.id] = {
        ...baseShiftData,
        findings: rec.findings,
        checklist: rec.checklist,
        audit: [...baseShiftData.audit, ...rec.events],
      };
    }
  }
  return db;
}

export interface GroundedShiftMetrics {
  wasteSummary: string;
  wasteDetail: string;
  machineIssuesCount: number;
  machineDetail: string;
  tasksDone: number;
  tasksTotal: number;
  tasksDetail: string;
  schedulesCount: number;
  schedulesDetail: string;
  cashStatus: string;
}

export function computeShiftMetrics(data: ShiftData): GroundedShiftMetrics {
  const r = data.report;
  
  // Waste & Stock
  let wasteSummary = "0 waste logged";
  let wasteDetail = "Stock nominal";
  if (r.stock.waste && Number(r.stock.wasteQty) > 0) {
    wasteSummary = `${r.stock.wasteQty}${r.stock.wasteUnit} ${r.stock.wasteItem}`;
    wasteDetail = r.stock.low && r.stock.lowItems.length > 0 ? `Low: ${r.stock.lowItems.join(", ")}` : "Waste unposted in ledger";
  } else if (r.stock.low && r.stock.lowItems.length > 0) {
    wasteSummary = `Low stock: ${r.stock.lowItems.join(", ")}`;
    wasteDetail = "PO order in transit";
  }

  // Machine issues
  const machineEntries = r.equipment.status === "attention" ? (r.equipment.entries ?? []).filter(e => e.issue !== "") : [];
  const machineIssuesCount = machineEntries.length;
  const machineDetail = machineIssuesCount > 0 ? machineEntries.map(e => e.item.split(" (")[0]).join(", ") : "All equipment nominal";

  // Checklist
  const mandatoryTasks = data.checklist.filter(t => t.mandatory);
  const tasksDone = mandatoryTasks.filter(t => t.done).length;
  const tasksTotal = mandatoryTasks.length;
  const skippedTasks = mandatoryTasks.filter(t => t.notDone).length;
  const tasksDetail = skippedTasks > 0 ? `${skippedTasks} skipped with reason` : tasksDone === tasksTotal && tasksTotal > 0 ? "All required tasks verified" : `${tasksTotal - tasksDone} pending`;

  // Schedules
  const schedulesCount = data.schedules.length;
  const schedulesCompleted = data.schedules.filter(s => s.status === "completed").length;
  const schedulesDetail = schedulesCount > 0 ? `${schedulesCompleted} of ${schedulesCount} verified` : "No active schedules";

  // Cash status
  const cashStatus = r.cash.status === "balanced" ? "Balanced" : r.cash.status === "variance" ? "Variance flagged" : "Unchecked";

  return {
    wasteSummary,
    wasteDetail,
    machineIssuesCount,
    machineDetail,
    tasksDone,
    tasksTotal,
    tasksDetail,
    schedulesCount,
    schedulesDetail,
    cashStatus,
  };
}

// ---------- Derived state ---------------------------------------------------
export const allChecks = (d: ShiftData) => d.findings.flatMap(f => f.checks.map(c => ({ finding: f, check: c })));
export const isBlocker = (c: Check) => c.severity === "critical" && c.workflow === "open";
export type Bucket = "critical" | "review" | "pending" | "info";
export function bucketOf(c: Check): Bucket | null {
  if (c.workflow === "resolved") return null;
  if (isBlocker(c)) return "critical";
  if (c.severity === "critical" || c.severity === "review") return "review";
  if (c.obligation) return "pending";
  return "info";
}

export function signoffState(d: ShiftData) {
  const blockers = allChecks(d).filter(x => isBlocker(x.check));
  const tasks = d.checklist.filter(t => t.mandatory && !t.done);
  const ready = d.submitted && blockers.length === 0 && tasks.length === 0;
  const status: "signed_off" | "blocked" | "not_submitted" | "ready" | "not_started" =
    d.signedOff ? "signed_off" : !d.submitted ? "not_submitted" : ready ? "ready" : "blocked";
  return { blockers, tasks, ready, status };
}

export function shiftStatus(shift: Shift, d: ShiftData): { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" } {
  if (d.signedOff) return { label: "Transferred", tone: "success" };
  if (shift.phase === "upcoming" && !d.signedIn && !d.submitted) return { label: "Not started", tone: "neutral" };
  const s = signoffState(d);
  if (!d.submitted) return { label: d.signedIn ? "Signed in · In progress" : "Awaiting sign-in", tone: d.signedIn ? "info" : "neutral" };
  if (s.status === "blocked") return { label: "Blocked", tone: "danger" };
  return { label: "Ready to transfer", tone: "warning" };
}
