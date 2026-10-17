import React, { useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Coffee,
  LogIn,
  Search,
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

  const staffPins: Record<string, string> = {};
  for (const m of roster) {
    staffPins[m.name] = m.pin;
  }

  const ownerPins = new Set([
    "0000",
    "9999",
    ...roster.filter(m => m.role === "owner").map(m => m.pin),
  ]);

  const initialLeadMember = roster.find(m => m.name.toLowerCase() === shift.outgoing.toLowerCase());
  const [leadName, setLeadName] = useState<string>(shift.outgoing);
  const [leadSearchQuery, setLeadSearchQuery] = useState<string>(
    initialLeadMember ? `${initialLeadMember.name} (${initialLeadMember.station})` : shift.outgoing
  );
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);
  const [leadPin, setLeadPin] = useState<string>("");
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string>("");

  const activeMember = roster.find(m => m.name.toLowerCase() === leadName.toLowerCase());
  const expectedPin = activeMember?.pin || staffPins[leadName] || "1024";

  const floorRosterLabels = roster
    .filter(m => m.role === "floor_staff")
    .map(m => `${m.name} (${m.station})`);
  const crewOptions =
    floorRosterLabels.length > 0
      ? floorRosterLabels
      : ["Sari (Barista)", "Bima (Cashier)", "Nadia (Cold Bar)", "Reza (Roastery Support)"];

  const [selectedCrew, setSelectedCrew] = useState<string[]>(crewOptions.slice(0, 2));

  const isOwnerPinEntered = leadPin.trim().length === 4 && ownerPins.has(leadPin.trim());

  const filteredStaff = roster.filter(m => {
    const q = leadSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.station.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q) ||
      m.pin.includes(q)
    );
  });

  const handleSelectShift = (newShiftId: string) => {
    setSelectedShiftId(newShiftId);
    const nextRaw = SHIFTS.find(s => s.id === newShiftId) ?? SHIFTS[1];
    const nextEff = effectiveShift(nextRaw, db[newShiftId]);
    const nextMember = roster.find(m => m.name.toLowerCase() === nextEff.outgoing.toLowerCase());
    setLeadName(nextEff.outgoing);
    setLeadSearchQuery(nextMember ? `${nextMember.name} (${nextMember.station})` : nextEff.outgoing);
    setLeadPin("");
    setPinError("");
  };

  const handleSelectLead = (member: StaffMember) => {
    setLeadName(member.name);
    setLeadSearchQuery(`${member.name} (${member.station})`);
    setIsLeadDropdownOpen(false);
    setLeadPin("");
    setPinError("");
  };

  const toggleCrew = (member: string) => {
    setSelectedCrew(prev =>
      prev.includes(member) ? prev.filter(m => m !== member) : [...prev, member]
    );
  };

  const handleSignIn = () => {
    const cleanPin = leadPin.trim();
    if (!cleanPin) {
      setPinError(`Please input ${leadName}’s 4-digit PIN (or enter 0000 for Owner Mode).`);
      return;
    }
    if (cleanPin.length < 4) {
      setPinError("PIN must be 4 digits.");
      return;
    }

    const isOwner = ownerPins.has(cleanPin);
    if (!isOwner && expectedPin && cleanPin !== expectedPin) {
      setPinError(`Incorrect PIN for ${leadName}. Registered PIN is ${expectedPin} (or enter 0000 for Owner Mode).`);
      return;
    }

    setPinError("");
    const ownerMember = roster.find(m => m.role === "owner" && m.pin === cleanPin);
    onStartShiftSession({
      shiftId: selectedShiftId,
      outgoingLead: isOwner ? (ownerMember?.name ?? leadName) : leadName,
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

            {/* Step 2: Searchable Shift Lead Box + PIN */}
            <div style={{ marginBottom: "20px", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <label className="field-label" htmlFor="shift-lead-search">
                  Shift Lead Signing In
                </label>
                <span className="muted-text" style={{ fontSize: "11.5px" }}>
                  Search or select from staff roster
                </span>
              </div>

              {/* Searchable input */}
              <div style={{ position: "relative", marginBottom: "14px" }}>
                <Search
                  className="icon icon-xs"
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--ink-500)",
                    pointerEvents: "none",
                  }}
                  aria-hidden="true"
                />
                <input
                  id="shift-lead-search"
                  type="text"
                  className="input"
                  value={leadSearchQuery}
                  onChange={e => {
                    setLeadSearchQuery(e.target.value);
                    setIsLeadDropdownOpen(true);
                  }}
                  onFocus={() => setIsLeadDropdownOpen(true)}
                  placeholder="Search or select shift lead (e.g. Dimas, Rina, Sarah)…"
                  style={{ width: "100%", fontWeight: 600, paddingLeft: "36px", paddingRight: "36px" }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setIsLeadDropdownOpen(prev => !prev)}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    padding: "4px",
                    cursor: "pointer",
                    color: "var(--ink-600)",
                    display: "flex",
                    alignItems: "center",
                  }}
                  aria-label="Toggle staff roster dropdown"
                >
                  <ChevronDown className="icon icon-xs" />
                </button>

                {isLeadDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      zIndex: 60,
                      background: "var(--paper-0)",
                      border: "1.5px solid var(--espresso-600)",
                      borderRadius: "8px",
                      boxShadow: "0 10px 25px rgba(28, 25, 23, 0.15)",
                      maxHeight: "220px",
                      overflowY: "auto",
                      padding: "6px",
                    }}
                  >
                    {filteredStaff.length === 0 ? (
                      <div style={{ padding: "10px 12px", fontSize: "12.5px", color: "var(--ink-500)" }}>
                        No staff found matching "{leadSearchQuery}"
                      </div>
                    ) : (
                      filteredStaff.map(m => {
                        const isSelected = leadName.toLowerCase() === m.name.toLowerCase();
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelectLead(m)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 12px",
                              borderRadius: "6px",
                              border: "none",
                              background: isSelected ? "var(--amber-50)" : "transparent",
                              color: isSelected ? "var(--espresso-600)" : "var(--ink-900)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              fontSize: "13px",
                              fontWeight: isSelected ? 700 : 500,
                              marginBottom: "2px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              {isSelected ? (
                                <Check className="icon icon-xs" style={{ color: "var(--espresso-600)" }} />
                              ) : (
                                <span style={{ width: "14px", display: "inline-block" }} />
                              )}
                              <span>
                                {m.name} · <span style={{ color: "var(--ink-500)", fontWeight: 400 }}>{m.station}</span>
                              </span>
                            </div>
                            <span className="mono-small" style={{ fontSize: "11px", color: "var(--espresso-600)" }}>
                              PIN: {m.pin}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* PIN input that requires actual entry */}
              <label className="field" style={{ maxWidth: "340px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="field-label">PIN</span>
                  {expectedPin && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setLeadPin(expectedPin);
                        if (pinError) setPinError("");
                      }}
                      style={{ fontSize: "11px" }}
                    >
                      Fill {leadName}'s PIN ({expectedPin})
                    </button>
                  )}
                </div>
                <input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  className="input input-sm mono"
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
                  placeholder={`Input 4-digit PIN for ${leadName}`}
                  style={{ letterSpacing: "0.25em", fontWeight: 700, fontSize: "14px" }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setShowPin(v => !v)}
                    style={{ fontSize: "11px", color: "var(--ink-500)" }}
                  >
                    {showPin ? "Hide numbers" : "Show numbers"}
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setLeadPin("0000");
                      if (pinError) setPinError("");
                    }}
                    style={{ fontSize: "11px", color: "var(--espresso-600)" }}
                  >
                    Use Owner PIN (0000)
                  </button>
                </div>

                {isOwnerPinEntered && (
                  <span style={{ color: "var(--espresso-600)", fontSize: "11.5px", fontWeight: 600, marginTop: "4px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <ShieldCheck className="icon icon-xs" aria-hidden="true" />
                    Owner PIN recognized — will unlock Staff Roster management
                  </span>
                )}
                {pinError && (
                  <span style={{ color: "var(--crimson-600)", fontSize: "11.5px", marginTop: "4px", display: "block" }}>
                    {pinError}
                  </span>
                )}
              </label>
            </div>

            {/* Step 3: Staff in shift */}
            <div style={{ marginBottom: "24px" }}>
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
              {isOwnerPinEntered
                ? "Sign In to Owner Mode & Manage Staff Roster"
                : `Sign In & Start ${SHIFT_TYPE_LABEL[shift.type]} Shift as ${leadName} (${shift.start}–${shift.end})`}
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
                  Signing in starts the <strong>{SHIFT_TYPE_LABEL[shift.type].toLowerCase()} shift</strong> for <strong>{leadName}</strong>.
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
