import React, { useState, useMemo } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Coffee,
  LogIn,
  ShieldCheck,
} from "lucide-react";
import type { Shift, ShiftData } from "../data";
import {
  CAFE,
  RECURRENCE_LABEL,
  SHIFT_TYPE_LABEL,
  SHIFTS,
  effectiveShift,
} from "../data";
import type { StaffMember } from "./StaffRoster";
import { Tag } from "./ui";

interface Props {
  shiftId: string;
  db: Record<string, ShiftData>;
  roster: StaffMember[];
  gemmaMode: "live" | "seeded";
  onToggleGemmaMode: () => void;
  onStartShiftSession: (params: {
    shiftId: string;
    outgoingLead: string;
    incomingLead: string;
    crew: string[];
    ownerMode?: boolean;
    openTab: "dashboard" | "report" | "briefing" | "ledger" | "roster";
  }) => void;
}

export default function ShiftLogin({
  shiftId: initialShiftId,
  db,
  roster,
  onStartShiftSession,
}: Props) {
  const [selectedShiftId, setSelectedShiftId] = useState<string>(initialShiftId);
  const rawShift = SHIFTS.find(s => s.id === selectedShiftId) ?? SHIFTS[1];
  const shiftData = db[selectedShiftId];
  const shift: Shift = effectiveShift(rawShift, shiftData);

  const [leadPin, setLeadPin] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");

  const ownerPins = useMemo(
    () =>
      new Set([
        "0000",
        "9999",
        ...roster.filter(m => m.role === "owner").map(m => m.pin),
      ]),
    [roster]
  );

  const cleanPin = leadPin.trim();
  const matchedMember = cleanPin.length === 4 ? roster.find(m => m.pin === cleanPin) : null;
  const isOwner = cleanPin.length === 4 && ownerPins.has(cleanPin);
  const ownerMember = isOwner ? roster.find(m => m.role === "owner" && m.pin === cleanPin) : null;

  const floorRosterLabels = roster
    .filter(m => m.role === "floor_staff")
    .map(m => `${m.name} (${m.station})`);
  const crewOptions =
    floorRosterLabels.length > 0
      ? floorRosterLabels
      : ["Sari (Barista)", "Bima (Cashier)", "Nadia (Cold Bar)", "Reza (Roastery Support)"];

  const [selectedCrew, setSelectedCrew] = useState<string[]>(crewOptions.slice(0, 2));

  const handleSelectShift = (newShiftId: string) => {
    setSelectedShiftId(newShiftId);
    setLeadPin("");
    setPinError("");
  };

  const toggleCrew = (member: string) => {
    setSelectedCrew(prev =>
      prev.includes(member) ? prev.filter(m => m !== member) : [...prev, member]
    );
  };

  const handleNumpadPress = (val: string) => {
    if (val === "C") {
      setLeadPin("");
      if (pinError) setPinError("");
      return;
    }
    if (val === "BACK") {
      setLeadPin(prev => prev.slice(0, -1));
      if (pinError) setPinError("");
      return;
    }
    if (leadPin.length < 4) {
      const nextPin = leadPin + val;
      setLeadPin(nextPin);
      if (pinError) setPinError("");
    }
  };

  const handleSignIn = () => {
    if (!cleanPin) {
      setPinError("Please enter your 4-digit staff PIN.");
      return;
    }
    if (cleanPin.length < 4) {
      setPinError("PIN must be 4 digits.");
      return;
    }

    if (!matchedMember && !isOwner) {
      setPinError("Unrecognized PIN. Please enter a valid registered staff PIN.");
      return;
    }

    setPinError("");
    const resolvedLeadName = matchedMember ? matchedMember.name : (ownerMember?.name ?? "Store Owner");

    onStartShiftSession({
      shiftId: selectedShiftId,
      outgoingLead: resolvedLeadName,
      incomingLead: shift.incoming,
      crew: selectedCrew,
      ownerMode: isOwner,
      openTab: isOwner ? "roster" : "report",
    });
  };

  const activeSchedules = shiftData.schedules || [];
  const activeShifts = SHIFTS.slice(0, 4);

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
            maxWidth: "960px",
            display: "grid",
            gridTemplateColumns: "1.15fr 0.85fr",
            gap: "24px",
            alignItems: "start",
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
              Sign in on the store POS tablet to start the shift, select staff on duty, and unlock shift reporting & operational checks.
            </p>

            {/* Step 1: Select Shift Window */}
            <div style={{ marginBottom: "20px" }}>
              <label className="field-label" htmlFor="shift-window-select" style={{ display: "block", marginBottom: "8px" }}>
                Shift Window
              </label>
              <select
                id="shift-window-select"
                className="input"
                value={selectedShiftId}
                onChange={e => handleSelectShift(e.target.value)}
                style={{ width: "100%", fontWeight: 600 }}
              >
                {activeShifts.map(s => {
                  const d = db[s.id];
                  const statusText =
                    s.phase === "current"
                      ? "Current"
                      : s.phase === "upcoming"
                        ? "Next Shift"
                        : d.signedOff
                          ? "Transferred"
                          : "Past";
                  return (
                    <option key={s.id} value={s.id}>
                      {SHIFT_TYPE_LABEL[s.type]} ({s.start}–{s.end}) · {s.dayShort} {s.dateLabel} — {statusText}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Step 2: Staff PIN Input with POS Touch Keypad */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <label className="field-label" htmlFor="staff-pin-input">
                  Staff PIN
                </label>
                <span className="muted-text" style={{ fontSize: "11.5px" }}>
                  Enter your 4-digit staff or manager PIN
                </span>
              </div>

              <div style={{ maxWidth: "240px" }}>
                <input
                  id="staff-pin-input"
                  type="password"
                  inputMode="numeric"
                  className="input mono"
                  value={leadPin}
                  onChange={e => {
                    const nextVal = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setLeadPin(nextVal);
                    if (pinError) setPinError("");
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleSignIn();
                  }}
                  maxLength={4}
                  placeholder="••••"
                  autoFocus
                  style={{
                    letterSpacing: "0.4em",
                    fontWeight: 700,
                    fontSize: "20px",
                    textAlign: "center",
                    padding: "10px 14px",
                  }}
                />

                {/* Instant Recognition Feedback */}
                {matchedMember && (
                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--color-success)",
                      fontSize: "12.5px",
                      fontWeight: 600,
                    }}
                  >
                    <Check className="icon icon-xs" />
                    <span>
                      Recognized: <strong>{matchedMember.name}</strong> · {matchedMember.role === "shift_lead" ? "Manager" : matchedMember.station}
                    </span>
                  </div>
                )}
                {isOwner && !matchedMember && (
                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--espresso-600)",
                      fontSize: "12.5px",
                      fontWeight: 600,
                    }}
                  >
                    <ShieldCheck className="icon icon-xs" />
                    <span>
                      Recognized: <strong>{ownerMember?.name || "Hendra"} (Store Owner · Owner Mode)</strong>
                    </span>
                  </div>
                )}
                {pinError && (
                  <span style={{ color: "var(--crimson-600)", fontSize: "12px", marginTop: "6px", display: "block" }}>
                    {pinError}
                  </span>
                )}

                {/* POS Touch Keypad */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "8px",
                    marginTop: "12px",
                  }}
                >
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map(btn => (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => handleNumpadPress(btn === "⌫" ? "BACK" : btn)}
                      style={{
                        padding: "10px 0",
                        fontSize: "16px",
                        fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                        borderRadius: "8px",
                        border: "1px solid var(--paper-300)",
                        background: btn === "C" || btn === "⌫" ? "var(--paper-100)" : "var(--paper-0)",
                        color: btn === "C" ? "var(--crimson-600)" : "var(--ink-900)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: "44px",
                      }}
                      aria-label={btn === "⌫" ? "Backspace" : btn === "C" ? "Clear" : `Digit ${btn}`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3: Staff in shift */}
            <div style={{ marginBottom: "26px" }}>
              <span className="field-label" style={{ display: "block", marginBottom: "8px" }}>
                Staff in shift
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
                        padding: "5px 11px",
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

            {/* Single Primary CTA: Sign In & Start Shift */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSignIn}
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
              {matchedMember
                ? `Sign In & Start ${SHIFT_TYPE_LABEL[shift.type]} Shift as ${matchedMember.name}`
                : isOwner
                  ? `Sign In as Owner (Owner Mode)`
                  : `Enter PIN to Start ${SHIFT_TYPE_LABEL[shift.type]} Shift`}
              <ArrowRight className="icon icon-sm" aria-hidden="true" />
            </button>
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
                {shift.dayOfWeek}, {shift.dateLabel}
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
                  Signing in starts the <strong>{SHIFT_TYPE_LABEL[shift.type].toLowerCase()} shift</strong> for <strong>{matchedMember ? matchedMember.name : isOwner ? (ownerMember?.name || "Store Owner") : "authenticated shift lead"}</strong>.
                </li>
                <li>
                  You can log equipment issues, waste, and shift notes anytime during the shift.
                </li>
                <li>
                  Completing & transferring the shift unlocks at the end hour (<strong>{shift.end}</strong>).
                </li>
              </ul>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span className="section-label">Scheduled Deliveries & Checks ({activeSchedules.length})</span>
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
