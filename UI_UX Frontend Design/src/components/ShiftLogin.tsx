import React, { useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  CalendarClock,
  Check,
  Clock,
  Coffee,
  LogIn,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import type { Shift, ShiftData } from "../data";
import {
  CAFE,
  RECURRENCE_LABEL,
  SHIFT_TYPE_LABEL,
  SHIFTS,
  STAFF_NAMES,
  SUPERVISOR,
  effectiveShift,
} from "../data";
import { Tag } from "./ui";

interface Props {
  shiftId: string;
  db: Record<string, ShiftData>;
  gemmaMode: "live" | "seeded";
  onToggleGemmaMode: () => void;
  onStartShiftSession: (params: {
    shiftId: string;
    outgoingLead: string;
    incomingLead: string;
    crew: string[];
    openTab: "dashboard" | "report" | "briefing" | "ledger";
  }) => void;
}

export default function ShiftLogin({
  shiftId: initialShiftId,
  db,
  gemmaMode,
  onToggleGemmaMode,
  onStartShiftSession,
}: Props) {
  const [selectedShiftId, setSelectedShiftId] = useState<string>(initialShiftId);
  const rawShift = SHIFTS.find(s => s.id === selectedShiftId) ?? SHIFTS[1];
  const shiftData = db[selectedShiftId];
  const shift: Shift = effectiveShift(rawShift, shiftData);

  const [leadName, setLeadName] = useState<string>(shift.outgoing);
  const [incomingName, setIncomingName] = useState<string>(shift.incoming);
  const [customLeadMode, setCustomLeadMode] = useState(false);
  const [customLeadInput, setCustomLeadInput] = useState("");
  const [customIncomingMode, setCustomIncomingMode] = useState(false);
  const [customIncomingInput, setCustomIncomingInput] = useState("");
  const [selectedCrew, setSelectedCrew] = useState<string[]>(["Sari (Barista)", "Bima (Cashier)"]);
  const [pinCode, setPinCode] = useState<string>("0421");

  const staffRoster = Array.from(new Set([...STAFF_NAMES, shift.outgoing, shift.incoming]));
  const crewOptions = [
    "Sari (Barista)",
    "Bima (Cashier)",
    "Nadia (Cold Bar)",
    "Reza (Roastery Support)",
  ];

  const handleSelectShift = (newShiftId: string) => {
    setSelectedShiftId(newShiftId);
    const nextRaw = SHIFTS.find(s => s.id === newShiftId) ?? SHIFTS[1];
    const nextEff = effectiveShift(nextRaw, db[newShiftId]);
    setLeadName(nextEff.outgoing);
    setIncomingName(nextEff.incoming);
    setCustomLeadMode(false);
    setCustomIncomingMode(false);
  };

  const toggleCrew = (member: string) => {
    setSelectedCrew(prev =>
      prev.includes(member) ? prev.filter(m => m !== member) : [...prev, member]
    );
  };

  const activeSchedules = shiftData.schedules || [];
  const activeShifts = SHIFTS.slice(0, 4); // Upcoming + Current + Recent

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper-100)",
        color: "var(--ink-900)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Bar */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-emblem" aria-hidden="true">SG</span>
          <span className="brand-text">
            <span className="brand-name">ShiftGuard</span>
            <span className="brand-sub">{CAFE.name} · {CAFE.branch} · POS Terminal #01</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleGemmaMode}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            background: "var(--paper-200)",
            padding: "4px 12px",
            borderRadius: "20px",
            border: "1px solid var(--paper-400)",
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--espresso-600)",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: gemmaMode === "live" ? "#16a34a" : "var(--ink-400)",
              display: "inline-block",
            }}
          />
          <span>
            Gemma 3-27B-IT {gemmaMode === "live" ? "Live via TokenFactory" : "Recorded via TokenFactory"}
          </span>
        </button>

        <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="mono-small" style={{ color: "var(--ink-600)" }}>
            Shared Store POS Tablet · Shift-Based Access
          </span>
        </div>
      </header>

      {/* Main Centered Login / Start Shift Workbench */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "980px",
            display: "grid",
            gridTemplateColumns: "1.2fr 0.85fr",
            gap: "24px",
            alignItems: " start",
          }}
        >
          {/* Left Column: Staff Login & Start Shift Form */}
          <section
            style={{
              background: "var(--paper-0)",
              border: "1px solid var(--paper-300)",
              borderRadius: "12px",
              padding: "28px 30px",
              boxShadow: "0 4px 20px rgba(28, 25, 23, 0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "6px" }}>
              <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Coffee className="icon icon-xs" aria-hidden="true" />
                {CAFE.name} · {CAFE.branch}
              </span>
              <Tag tone={shiftData.signedOff ? "neutral" : shiftData.submitted ? "info" : "warning"}>
                {shiftData.signedOff
                  ? `Transferred ${shiftData.signedOffAt}`
                  : shiftData.submitted
                    ? `Report submitted ${shiftData.submittedAt}`
                    : shiftData.signedIn
                      ? `Active since ${shiftData.signedInAt || shift.start}`
                      : "Ready to start shift"}
              </Tag>
            </div>

            <h1 className="page-title page-title-lg" style={{ marginBottom: "6px" }}>
              Staff Sign-In & Start Shift
            </h1>
            <p className="page-subtitle" style={{ marginBottom: "22px" }}>
              Sign in on the store POS tablet to start the shift, assign or replace staff on duty, and unlock shift reporting & operational checks.
            </p>

            {/* Step 1: Select Shift Window */}
            <div style={{ marginBottom: "20px" }}>
              <label className="field-label" style={{ display: "block", marginBottom: "8px" }}>
                1 · Select Shift Window
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "8px",
                }}
              >
                {activeShifts.map(s => {
                  const eff = effectiveShift(s, db[s.id]);
                  const d = db[s.id];
                  const isSelected = s.id === selectedShiftId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectShift(s.id)}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: isSelected ? "2px solid var(--espresso-600)" : "1px solid var(--paper-300)",
                        background: isSelected ? "var(--amber-50)" : "var(--paper-50)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                        <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--ink-900)" }}>
                          {SHIFT_TYPE_LABEL[s.type]} ({s.start}–{s.end})
                        </span>
                        <span className="mono-small" style={{ fontSize: "11px" }}>
                          {s.dayShort} {s.dateLabel}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11.5px", color: "var(--ink-600)" }}>
                        <span>Lead: <strong>{eff.outgoing}</strong> → {eff.incoming}</span>
                        <span style={{ fontWeight: 600, color: s.phase === "current" ? "var(--espresso-600)" : "var(--ink-500)" }}>
                          {s.phase === "current" ? "Current" : s.phase === "upcoming" ? "Next Shift" : d.signedOff ? "Transferred" : "Past"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Select or Replace Shift Lead Signing In */}
            <div style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <label className="field-label">
                  2 · Shift Lead Signing In (Active Shift Lead)
                </label>
                <span className="muted-text" style={{ fontSize: "11.5px" }}>
                  Tap to switch or replace if someone swapped shifts / called in sick
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: customLeadMode ? "10px" : "0" }}>
                {staffRoster.map(name => {
                  const active = !customLeadMode && leadName === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setCustomLeadMode(false);
                        setLeadName(name);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 14px",
                        borderRadius: "999px",
                        border: active ? "1.5px solid var(--espresso-600)" : "1px solid var(--paper-400)",
                        background: active ? "var(--espresso-600)" : "var(--paper-0)",
                        color: active ? "#fff" : "var(--ink-800)",
                        fontSize: "13px",
                        fontWeight: active ? 600 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {active && <Check className="icon icon-xs" aria-hidden="true" />}
                      {name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setCustomLeadMode(true);
                    setCustomLeadInput("");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "7px 12px",
                    borderRadius: "999px",
                    border: customLeadMode ? "1.5px solid var(--espresso-600)" : "1px dashed var(--paper-400)",
                    background: customLeadMode ? "var(--amber-50)" : "transparent",
                    color: "var(--espresso-600)",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Replace / Cover Staff…
                </button>
              </div>

              {customLeadMode && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                  <input
                    className="input input-sm"
                    placeholder="Enter replacement shift lead name (e.g. Fajar)…"
                    value={customLeadInput}
                    onChange={e => {
                      setCustomLeadInput(e.target.value);
                      if (e.target.value.trim()) setLeadName(e.target.value.trim());
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (customLeadInput.trim()) setLeadName(customLeadInput.trim());
                      setCustomLeadMode(false);
                    }}
                  >
                    Use {customLeadInput.trim() || "Name"}
                  </button>
                </div>
              )}
            </div>

            {/* Step 3: Next / Incoming Shift Lead & Tablet PIN */}
            <div className="field-grid field-grid-2" style={{ gap: "14px", marginBottom: "18px" }}>
              <div>
                <span className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                  3 · Next Shift Lead (Handover Recipient)
                </span>
                {!customIncomingMode ? (
                  <select
                    className="input input-sm"
                    value={incomingName}
                    onChange={e => {
                      if (e.target.value === "__custom__") {
                        setCustomIncomingMode(true);
                        setCustomIncomingInput("");
                      } else {
                        setIncomingName(e.target.value);
                      }
                    }}
                  >
                    {staffRoster.map(n => (
                      <option key={n} value={n}>
                        {n} (Next shift lead)
                      </option>
                    ))}
                    <option value="__custom__">+ Replace incoming lead…</option>
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      className="input input-sm"
                      placeholder="Incoming lead name…"
                      value={customIncomingInput}
                      onChange={e => {
                        setCustomIncomingInput(e.target.value);
                        if (e.target.value.trim()) setIncomingName(e.target.value.trim());
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setCustomIncomingMode(false)}
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>

              <label className="field">
                <span className="field-label">POS Tablet Shift Passcode</span>
                <input
                  type="password"
                  className="input input-sm mono"
                  value={pinCode}
                  onChange={e => setPinCode(e.target.value)}
                  maxLength={6}
                  placeholder="4-digit PIN"
                />
              </label>
            </div>

            {/* Optional Crew on Shift */}
            <div style={{ marginBottom: "22px" }}>
              <span className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                Baristas on Floor This Shift (Optional)
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {crewOptions.map(c => {
                  const on = selectedCrew.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCrew(c)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: on ? "1px solid var(--espresso-600)" : "1px solid var(--paper-300)",
                        background: on ? "var(--paper-200)" : "var(--paper-50)",
                        color: on ? "var(--ink-900)" : "var(--ink-500)",
                        fontSize: "12px",
                        fontWeight: on ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {on ? "✓ " : "+ "}{c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary CTA: Sign In & Start Shift */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  onStartShiftSession({
                    shiftId: selectedShiftId,
                    outgoingLead: leadName,
                    incomingLead: incomingName,
                    crew: selectedCrew,
                    openTab: "report",
                  })
                }
                style={{
                  width: "100%",
                  padding: "12px 18px",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <LogIn className="icon icon-sm" aria-hidden="true" />
                Sign In & Start {SHIFT_TYPE_LABEL[shift.type]} Shift as {leadName} ({shift.start}–{shift.end})
                <ArrowRight className="icon icon-sm" aria-hidden="true" />
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    onStartShiftSession({
                      shiftId: selectedShiftId,
                      outgoingLead: leadName,
                      incomingLead: incomingName,
                      crew: selectedCrew,
                      openTab: "briefing",
                    })
                  }
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  <ArrowRightLeft className="icon icon-xs" aria-hidden="true" />
                  Sign In & View Incoming Briefing
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    onStartShiftSession({
                      shiftId: selectedShiftId,
                      outgoingLead: leadName,
                      incomingLead: incomingName,
                      crew: selectedCrew,
                      openTab: "dashboard",
                    })
                  }
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", border: "1px solid var(--paper-300)" }}
                >
                  Open Shift Dashboard ({SUPERVISOR} / Lead)
                </button>
              </div>
            </div>
          </section>

          {/* Right Column: Shift Start Operational Preview */}
          <aside
            style={{
              background: "var(--paper-0)",
              border: "1px solid var(--paper-300)",
              borderRadius: "12px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div>
              <span className="mono-label" style={{ color: "var(--espresso-600)" }}>
                SHIFT START BRIEFING PREVIEW · {shift.id}
              </span>
              <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "4px 0 4px" }}>
                {SHIFT_TYPE_LABEL[shift.type]} Shift ({shift.start}–{shift.end})
              </h2>
              <p className="muted-text" style={{ fontSize: "12.5px", margin: 0 }}>
                {shift.dayOfWeek}, {shift.dateLabel} · Lead on duty: <strong>{leadName}</strong> → Handover to <strong>{incomingName}</strong>
              </p>
            </div>

            <div
              style={{
                background: "var(--paper-50)",
                border: "1px solid var(--paper-300)",
                borderRadius: "8px",
                padding: "12px 14px",
                fontSize: "12.5px",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock className="icon icon-xs" aria-hidden="true" />
                How Shift-Based Tablet Sign-In Works
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--ink-700)", display: "flex", flexDirection: "column", gap: "4px" }}>
                <li>
                  Signing in starts the <strong>{SHIFT_TYPE_LABEL[shift.type].toLowerCase()} shift</strong> for <strong>{leadName}</strong>.
                </li>
                <li>
                  You can log equipment issues, waste, and shift notes anytime during the shift.
                </li>
                <li>
                  Completing & transferring the shift to <strong>{incomingName}</strong> unlocks at the end hour (<strong>{shift.end}</strong>).
                </li>
              </ul>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span className="section-label">Scheduled Deliveries & Checks ({activeSchedules.length})</span>
                <span className="mono-small">Editable in Briefing</span>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                {activeSchedules.map(sc => (
                  <li
                    key={sc.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--paper-300)",
                      background: sc.placement === "needs_attention" ? "var(--amber-50)" : "var(--paper-50)",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginBottom: "2px" }}>
                      <span className="mono-label" style={{ fontSize: "10.5px" }}>{sc.id}</span>
                      <span className="mono-small" style={{ fontSize: "10.5px", color: "var(--espresso-600)" }}>
                        {RECURRENCE_LABEL[sc.recurrence]}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, color: "var(--ink-900)", marginBottom: "2px" }}>
                      {sc.title}
                    </div>
                    <div className="muted-text" style={{ fontSize: "11.5px" }}>
                      {sc.whenLabel} · {sc.vendorOrArea}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
