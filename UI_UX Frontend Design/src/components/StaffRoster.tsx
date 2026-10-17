import React, { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, Edit3, KeyRound, Lock, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { Tag } from "./ui";
import type { Shift, ShiftData, ShiftRosterEntry } from "../data";
import { CAFE, SHIFT_TYPE_LABEL, STAFF_NAMES } from "../data";

export interface StaffMember {
  id: string;
  name: string;
  role: "owner" | "shift_lead" | "floor_staff";
  station: string;
  pin: string;
}

export const INITIAL_STAFF_ROSTER: StaffMember[] = [
  { id: "STF-00", name: "Kevin", role: "owner", station: "Owner / Supervisor", pin: "0000" },
  { id: "STF-01", name: "Rina", role: "shift_lead", station: "Manager", pin: "1024" },
  { id: "STF-02", name: "Sarah", role: "shift_lead", station: "Manager", pin: "2048" },
  { id: "STF-03", name: "Dimas", role: "shift_lead", station: "Manager", pin: "3012" },
  { id: "STF-04", name: "Sari", role: "floor_staff", station: "Barista", pin: "5120" },
  { id: "STF-05", name: "Bima", role: "floor_staff", station: "Cashier", pin: "4096" },
  { id: "STF-06", name: "Nadia", role: "floor_staff", station: "Cold Bar", pin: "6144" },
  { id: "STF-07", name: "Reza", role: "floor_staff", station: "Roastery Support", pin: "7168" },
];

const ROLE_LABELS: Record<StaffMember["role"], string> = {
  owner: "Owner / Supervisor",
  shift_lead: "Manager",
  floor_staff: "Staff in shift",
};

const SHIFT_STATUS_LABELS: Record<ShiftRosterEntry["status"], string> = {
  on_duty: "On Duty",
  left_early: "Left Early",
  replaced: "Replaced / Covered",
  added_mid_shift: "Added Mid-Shift",
};

const SHIFT_STATUS_TONE: Record<ShiftRosterEntry["status"], "success" | "warning" | "neutral" | "info"> = {
  on_duty: "success",
  left_early: "warning",
  replaced: "neutral",
  added_mid_shift: "info",
};

interface Props {
  roster: StaffMember[];
  isOwner?: boolean;
  isShiftLead?: boolean;
  activeActorName?: string;
  shift?: Shift;
  data?: ShiftData;
  onChangeStaff?: (which: "outgoing" | "incoming", newName: string) => void;
  onAddStaff?: (member: Omit<StaffMember, "id">) => void;
  onUpdateStaff?: (member: StaffMember) => void;
  onDeleteStaff?: (id: string) => void;
  onAddShiftRosterMember?: (entry: Omit<ShiftRosterEntry, "id" | "updatedAt" | "updatedBy">) => void;
  onUpdateShiftRosterMember?: (entryId: string, patch: { name: string; role: ShiftRosterEntry["role"]; station: string; status: ShiftRosterEntry["status"]; note: string }) => void;
  onRemoveShiftRosterMember?: (entryId: string, reason?: string) => void;
}

export default function StaffRoster({
  roster,
  isOwner = false,
  isShiftLead = true,
  activeActorName,
  shift,
  data,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  onAddShiftRosterMember,
  onUpdateShiftRosterMember,
  onRemoveShiftRosterMember,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<StaffMember["role"]>("shift_lead");
  const [newStation, setNewStation] = useState("Manager");
  const [newPin, setNewPin] = useState("");
  const [formError, setFormError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<StaffMember["role"]>("shift_lead");
  const [editStation, setEditStation] = useState("");
  const [editPin, setEditPin] = useState("");

  // Part 2: Current Shift Roster state (editable by Shift Lead or Owner)
  const canEditCurrentShift = (isOwner || isShiftLead) && !data?.signedOff;
  const [showAddShiftMember, setShowAddShiftMember] = useState(false);
  const [srName, setSrName] = useState("");
  const [srRole, setSrRole] = useState<ShiftRosterEntry["role"]>("floor_staff");
  const [srStation, setSrStation] = useState("Barista");
  const [srStatus, setSrStatus] = useState<ShiftRosterEntry["status"]>("added_mid_shift");
  const [srNote, setSrNote] = useState("");

  const [editingShiftEntryId, setEditingShiftEntryId] = useState<string | null>(null);
  const [editSrName, setEditSrName] = useState("");
  const [editSrRole, setEditSrRole] = useState<ShiftRosterEntry["role"]>("floor_staff");
  const [editSrStation, setEditSrStation] = useState("");
  const [editSrStatus, setEditSrStatus] = useState<ShiftRosterEntry["status"]>("on_duty");
  const [editSrNote, setEditSrNote] = useState("");

  const PAGE_SIZE = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(roster.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedRoster = roster.slice(startIndex, startIndex + PAGE_SIZE);

  const staffSelectOptions = Array.from(
    new Set([
      ...roster.map(m => m.name),
      ...STAFF_NAMES,
      ...(shift ? [shift.outgoing, shift.incoming] : []),
    ])
  );

  const startEdit = (m: StaffMember) => {
    if (!isOwner) return;
    setEditingId(m.id);
    setEditName(m.name);
    setEditRole(m.role);
    setEditStation(m.station);
    setEditPin(m.pin);
  };

  const handleSaveEdit = (id: string) => {
    if (!isOwner || !onUpdateStaff) return;
    if (!editName.trim()) return;
    if (editPin.trim().length < 4) return;
    onUpdateStaff({
      id,
      name: editName.trim(),
      role: editRole,
      station: editStation.trim() || ROLE_LABELS[editRole],
      pin: editPin.trim().slice(0, 4),
    });
    setEditingId(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !onAddStaff) return;
    if (!newName.trim()) {
      setFormError("Staff name is required.");
      return;
    }
    if (newPin.trim().length !== 4) {
      setFormError("PIN must be 4 digits.");
      return;
    }
    setFormError("");
    onAddStaff({
      name: newName.trim(),
      role: newRole,
      station: newStation.trim() || ROLE_LABELS[newRole],
      pin: newPin.trim(),
    });
    setNewName("");
    setNewRole("shift_lead");
    setNewStation("Manager");
    setNewPin("");
    setShowAddForm(false);
  };

  const leadsCount = roster.filter(m => m.role === "shift_lead").length;
  const floorCount = roster.filter(m => m.role === "floor_staff").length;
  const ownerCount = roster.filter(m => m.role === "owner").length;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            {isOwner ? (
              <>
                <ShieldCheck className="icon icon-xs" aria-hidden="true" />
                Owner Mode · Store Staff & PIN Access
              </>
            ) : (
              <>
                <Users className="icon icon-xs" aria-hidden="true" />
                Staff Directory
              </>
            )}
          </span>
          <h1 className="page-title">{isOwner ? "Staff Roster Management" : "Staff Roster"}</h1>
          <p className="page-subtitle">
            {isOwner
              ? "Add, edit, or remove Managers, floor staff, and 4-digit POS tablet PINs. Changes update the Shift Sign-In screen immediately."
              : "Active store staff directory and assigned station roles for Common Ground Coffee."}
          </p>
        </div>
        {isOwner && (
          <div className="page-header-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddForm(v => !v)}
            >
              <Plus className="icon icon-sm" aria-hidden="true" />
              {showAddForm ? "Close Form" : "Add Staff Member"}
            </button>
          </div>
        )}
      </header>

      {/* Summary Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div className="card" style={{ padding: "14px 18px" }}>
          <span className="mono-label">MANAGERS</span>
          <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>{leadsCount}</div>
          <span className="muted-text" style={{ fontSize: "12px" }}>Can sign in & transfer shifts</span>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <span className="mono-label">STAFF IN SHIFT</span>
          <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>{floorCount}</div>
          <span className="muted-text" style={{ fontSize: "12px" }}>Selectable on shift floor roster</span>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <span className="mono-label">OWNER / SUPERVISOR</span>
          <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>{ownerCount}</div>
          <span className="muted-text" style={{ fontSize: "12px" }}>Store owner / supervisor access</span>
        </div>
      </div>

      {/* Add Staff Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="card"
          style={{
            padding: "20px",
            marginBottom: "20px",
            border: "1.5px solid var(--espresso-600)",
            background: "var(--amber-50)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Add New Staff Member</h2>
            <button type="button" className="icon-btn" onClick={() => setShowAddForm(false)} aria-label="Close">
              <X className="icon icon-sm" aria-hidden="true" />
            </button>
          </div>

          <div className="field-grid field-grid-2" style={{ gap: "12px", marginBottom: "12px" }}>
            <label className="field">
              <span className="field-label">Staff Name</span>
              <input
                className="input input-sm"
                placeholder="e.g. Fajar"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
              />
            </label>

            <label className="field">
              <span className="field-label">Role</span>
              <select
                className="input input-sm"
                value={newRole}
                onChange={e => {
                  const r = e.target.value as StaffMember["role"];
                  setNewRole(r);
                  if (r === "shift_lead") setNewStation("Manager");
                  else if (r === "owner") setNewStation("Owner / Supervisor");
                  else setNewStation("Barista");
                }}
              >
                <option value="shift_lead">Manager (Signs in on POS)</option>
                <option value="floor_staff">Staff in shift (Barista / Cashier / Floor)</option>
                <option value="owner">Owner / Supervisor (Owner Access)</option>
              </select>
            </label>

            <label className="field">
              <span className="field-label">Station / Position Label</span>
              <input
                className="input input-sm"
                placeholder="e.g. Barista, Cashier, Cold Bar, Shift Lead"
                value={newStation}
                onChange={e => setNewStation(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">4-Digit PIN</span>
              <input
                type="text"
                inputMode="numeric"
                className="input input-sm mono"
                placeholder="e.g. 8240"
                maxLength={4}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </label>
          </div>

          {formError && (
            <p style={{ color: "var(--crimson-600)", fontSize: "12px", margin: "0 0 10px" }}>
              {formError}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              <Check className="icon icon-xs" aria-hidden="true" />
              Save to Roster
            </button>
          </div>
        </form>
      )}

      {/* Staff Roster Table */}
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--paper-100)", borderBottom: "1px solid var(--paper-300)", textAlign: "left", fontSize: "11.5px", color: "var(--ink-600)" }}>
              <th style={{ padding: "12px 16px" }}>ID</th>
              <th style={{ padding: "12px 16px" }}>Name</th>
              <th style={{ padding: "12px 16px" }}>Role</th>
              <th style={{ padding: "12px 16px" }}>Station</th>
              {isOwner && <th style={{ padding: "12px 16px" }}>PIN</th>}
              {isOwner && <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedRoster.map(member => {
              const isEditing = isOwner && editingId === member.id;
              return (
                <tr key={member.id} style={{ borderBottom: "1px solid var(--paper-200)", fontSize: "13px" }}>
                  <td style={{ padding: "12px 16px" }} className="mono-small">
                    {member.id}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                    {isEditing ? (
                      <input
                        className="input input-sm"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                      />
                    ) : (
                      member.name
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {isEditing ? (
                      <select
                        className="input input-sm"
                        value={editRole}
                        onChange={e => setEditRole(e.target.value as StaffMember["role"])}
                      >
                        <option value="shift_lead">Manager</option>
                        <option value="floor_staff">Staff in shift</option>
                        <option value="owner">Owner / Supervisor</option>
                      </select>
                    ) : (
                      <Tag
                        tone={
                          member.role === "owner"
                            ? "warning"
                            : member.role === "shift_lead"
                              ? "info"
                              : "neutral"
                        }
                      >
                        {ROLE_LABELS[member.role]}
                      </Tag>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {isEditing ? (
                      <input
                        className="input input-sm"
                        value={editStation}
                        onChange={e => setEditStation(e.target.value)}
                      />
                    ) : (
                      member.station
                    )}
                  </td>
                  {isOwner && (
                    <td style={{ padding: "12px 16px" }}>
                      {isEditing ? (
                        <input
                          className="input input-sm mono"
                          maxLength={4}
                          value={editPin}
                          onChange={e => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          style={{ width: "90px" }}
                        />
                      ) : (
                        <span
                          className="mono"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            background: "var(--paper-100)",
                            border: "1px solid var(--paper-300)",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          <KeyRound className="icon icon-xs" aria-hidden="true" />
                          {member.pin}
                        </span>
                      )}
                    </td>
                  )}
                  {isOwner && (
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      {isEditing ? (
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            onClick={() => handleSaveEdit(member.id)}
                          >
                            <Check className="icon icon-xs" aria-hidden="true" />
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => startEdit(member)}
                          >
                            <Edit3 className="icon icon-xs" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => onDeleteStaff && onDeleteStaff(member.id)}
                            style={{ color: "var(--crimson-600)" }}
                            title="Delete staff member"
                          >
                            <Trash2 className="icon icon-xs" aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination Controls - Max 5 with Next Page > */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            background: "var(--paper-50)",
            borderTop: "1px solid var(--paper-200)",
            fontSize: "12px",
            color: "var(--ink-600)",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            Showing <strong>{roster.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, roster.length)}</strong> of <strong>{roster.length}</strong> staff members
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ marginRight: "4px" }}>
              Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              style={{ padding: "4px 8px", minHeight: "26px", display: "inline-flex", alignItems: "center", gap: "2px" }}
              aria-label="Previous page of staff"
            >
              <ChevronLeft className="icon icon-xs" aria-hidden="true" />
              Prev
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              style={{ padding: "4px 8px", minHeight: "26px", display: "inline-flex", alignItems: "center", gap: "2px" }}
              aria-label="Next page of staff"
            >
              Next
              <ChevronRight className="icon icon-xs" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Part 2: Current Shift Roster (Editable by Shift Lead or Owner with Timestamp Recording) */}
      <section
        className="card"
        style={{
          marginTop: "24px",
          padding: "20px 22px",
          background: "var(--paper-0)",
          border: "1px solid var(--paper-300)",
          borderRadius: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--espresso-600)" }}>
              <Clock className="icon icon-xs" aria-hidden="true" />
              Part 2 · Current Shift Roster
            </span>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "2px 0 0" }}>
              {shift ? `${SHIFT_TYPE_LABEL[shift.type]} Shift (${shift.start}–${shift.end}) — Staff Working This Shift` : "Current Shift Roster"}
            </h2>
            <p className="muted-text" style={{ fontSize: "12px", margin: "2px 0 0" }}>
              {shift ? `${shift.dayShort} ${shift.dateLabel} · ${CAFE.name} (${CAFE.branch})` : "Active floor shift roster"} — Record early departures, replacements, or mid-shift covers with automatic timestamps.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span
              className="mono-small"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 10px",
                borderRadius: "6px",
                background: canEditCurrentShift ? "var(--amber-50)" : "var(--paper-100)",
                border: canEditCurrentShift ? "1px solid var(--amber-300)" : "1px solid var(--paper-300)",
                color: canEditCurrentShift ? "var(--espresso-700)" : "var(--ink-500)",
                fontSize: "11.5px",
                fontWeight: 600,
              }}
            >
              {canEditCurrentShift ? (
                <>
                  <ShieldCheck className="icon icon-xs" aria-hidden="true" />
                  Edit Permission: {isOwner ? `Owner (${activeActorName || "Kevin"})` : `Shift Lead (${shift?.outgoing || activeActorName || "Dimas"})`}
                </>
              ) : (
                <>
                  <Lock className="icon icon-xs" aria-hidden="true" />
                  Read-only (Shift Lead or Owner required to edit)
                </>
              )}
            </span>

            {canEditCurrentShift && onAddShiftRosterMember && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (!showAddShiftMember && !srName) {
                    const firstAvailable = staffSelectOptions.find(
                      n => !(data?.shiftRoster || []).some(r => r.name === n && r.status === "on_duty")
                    ) || staffSelectOptions[0] || "";
                    setSrName(firstAvailable);
                  }
                  setShowAddShiftMember(v => !v);
                }}
              >
                <Plus className="icon icon-xs" aria-hidden="true" />
                {showAddShiftMember ? "Close" : "+ Add Staff to Shift"}
              </button>
            )}
          </div>
        </div>

        {/* Add Staff to Current Shift Form */}
        {canEditCurrentShift && showAddShiftMember && onAddShiftRosterMember && (
          <form
            onSubmit={e => {
              e.preventDefault();
              const cleanName = srName.trim();
              if (!cleanName) return;
              onAddShiftRosterMember({
                name: cleanName,
                role: srRole,
                station: srStation.trim() || (srRole === "shift_lead" ? "Manager" : "Barista"),
                status: srStatus,
                note: srNote.trim() || (srStatus === "added_mid_shift" ? "Added mid-shift as cover" : "Added to current shift roster"),
              });
              setSrNote("");
              setShowAddShiftMember(false);
            }}
            style={{
              padding: "14px 16px",
              marginBottom: "14px",
              borderRadius: "8px",
              border: "1.5px solid var(--espresso-600)",
              background: "var(--amber-50)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink-900)" }}>
                Add Staff Member to Current Shift (Records Timestamp)
              </span>
              <button type="button" className="icon-btn" onClick={() => setShowAddShiftMember(false)} aria-label="Close">
                <X className="icon icon-xs" aria-hidden="true" />
              </button>
            </div>
            <div className="field-grid field-grid-2" style={{ gap: "10px", marginBottom: "10px" }}>
              <label className="field">
                <span className="field-label">Staff Member</span>
                <select
                  className="input input-sm"
                  value={srName}
                  onChange={e => {
                    const val = e.target.value;
                    setSrName(val);
                    const matched = roster.find(m => m.name === val);
                    if (matched) {
                      setSrRole(matched.role);
                      setSrStation(matched.station);
                    }
                  }}
                >
                  {staffSelectOptions.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Shift Role</span>
                <select
                  className="input input-sm"
                  value={srRole}
                  onChange={e => {
                    const r = e.target.value as ShiftRosterEntry["role"];
                    setSrRole(r);
                    if (r === "shift_lead") setSrStation("Manager");
                  }}
                >
                  <option value="floor_staff">Staff in shift</option>
                  <option value="shift_lead">Shift Lead (Manager)</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">Station</span>
                <input
                  className="input input-sm"
                  value={srStation}
                  onChange={e => setSrStation(e.target.value)}
                  placeholder="e.g. Barista, Cashier, Cold Bar"
                />
              </label>

              <label className="field">
                <span className="field-label">Status</span>
                <select
                  className="input input-sm"
                  value={srStatus}
                  onChange={e => setSrStatus(e.target.value as ShiftRosterEntry["status"])}
                >
                  <option value="added_mid_shift">Added Mid-Shift (Cover)</option>
                  <option value="on_duty">On Duty</option>
                </select>
              </label>
            </div>

            <label className="field" style={{ marginBottom: "10px" }}>
              <span className="field-label">Reason / Handover Note (Recorded with Timestamp)</span>
              <input
                className="input input-sm"
                value={srNote}
                onChange={e => setSrNote(e.target.value)}
                placeholder="e.g. Called in at 19:30 to cover Bima on Cashier"
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowAddShiftMember(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-xs">
                <Check className="icon icon-xs" aria-hidden="true" />
                Add & Record Timestamp
              </button>
            </div>
          </form>
        )}

        {/* Current Shift Staff Table */}
        {shift && data ? (
          <>
            <div style={{ border: "1px solid var(--paper-300)", borderRadius: "8px", overflow: "hidden" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--paper-100)", borderBottom: "1px solid var(--paper-300)", textAlign: "left", fontSize: "11.5px", color: "var(--ink-600)" }}>
                    <th style={{ padding: "10px 14px" }}>Name</th>
                    <th style={{ padding: "10px 14px" }}>Role</th>
                    <th style={{ padding: "10px 14px" }}>Station</th>
                    <th style={{ padding: "10px 14px" }}>Shift Status</th>
                    <th style={{ padding: "10px 14px" }}>Roster Note / Change Reason</th>
                    <th style={{ padding: "10px 14px" }}>Timestamp</th>
                    {canEditCurrentShift && <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(data.shiftRoster || []).map(entry => {
                    const isEditingRow = canEditCurrentShift && editingShiftEntryId === entry.id;
                    return (
                      <tr
                        key={entry.id}
                        style={{
                          borderBottom: "1px solid var(--paper-200)",
                          fontSize: "12.5px",
                          background: entry.status === "left_early" || entry.status === "replaced" ? "var(--paper-50)" : "var(--paper-0)",
                        }}
                      >
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                          {isEditingRow ? (
                            <select
                              className="input input-sm"
                              value={editSrName}
                              onChange={e => setEditSrName(e.target.value)}
                              title="Select staff member or replacement"
                            >
                              {staffSelectOptions.map(n => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ textDecoration: entry.status === "left_early" || entry.status === "replaced" ? "line-through" : "none", color: entry.status === "left_early" || entry.status === "replaced" ? "var(--ink-500)" : "var(--ink-900)" }}>
                              {entry.name}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {isEditingRow ? (
                            <select
                              className="input input-sm"
                              value={editSrRole}
                              onChange={e => setEditSrRole(e.target.value as ShiftRosterEntry["role"])}
                            >
                              <option value="shift_lead">Manager (Shift Lead)</option>
                              <option value="floor_staff">Staff in shift</option>
                            </select>
                          ) : (
                            <Tag tone={entry.role === "shift_lead" ? "info" : "neutral"}>
                              {entry.role === "shift_lead" ? "Shift Lead" : "Staff in shift"}
                            </Tag>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {isEditingRow ? (
                            <input
                              className="input input-sm"
                              value={editSrStation}
                              onChange={e => setEditSrStation(e.target.value)}
                            />
                          ) : (
                            entry.station
                          )}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {isEditingRow ? (
                            <select
                              className="input input-sm"
                              value={editSrStatus}
                              onChange={e => setEditSrStatus(e.target.value as ShiftRosterEntry["status"])}
                            >
                              <option value="on_duty">On Duty</option>
                              <option value="left_early">Left Early</option>
                              <option value="replaced">Replaced / Covered</option>
                              <option value="added_mid_shift">Added Mid-Shift</option>
                            </select>
                          ) : (
                            <Tag tone={SHIFT_STATUS_TONE[entry.status]}>
                              {SHIFT_STATUS_LABELS[entry.status]}
                            </Tag>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--ink-700)" }}>
                          {isEditingRow ? (
                            <input
                              className="input input-sm"
                              value={editSrNote}
                              onChange={e => setEditSrNote(e.target.value)}
                              placeholder="e.g. Left early at 19:30, covered by Reza"
                            />
                          ) : (
                            entry.note || "—"
                          )}
                        </td>
                        <td style={{ padding: "10px 14px" }} className="mono-small">
                          <div>{entry.updatedAt}</div>
                          <div style={{ fontSize: "10.5px", color: "var(--ink-400)" }}>by {entry.updatedBy}</div>
                        </td>
                        {canEditCurrentShift && (
                          <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {isEditingRow ? (
                              <div style={{ display: "inline-flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-xs"
                                  onClick={() => {
                                    if (onUpdateShiftRosterMember) {
                                      onUpdateShiftRosterMember(entry.id, {
                                        name: editSrName,
                                        role: editSrRole,
                                        station: editSrStation.trim() || entry.station,
                                        status: editSrStatus,
                                        note: editSrNote.trim() || entry.note,
                                      });
                                    }
                                    setEditingShiftEntryId(null);
                                  }}
                                >
                                  <Check className="icon icon-xs" aria-hidden="true" />
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => setEditingShiftEntryId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "inline-flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => {
                                    setEditingShiftEntryId(entry.id);
                                    setEditSrName(entry.name);
                                    setEditSrRole(entry.role);
                                    setEditSrStation(entry.station);
                                    setEditSrStatus(entry.status);
                                    setEditSrNote(entry.note);
                                  }}
                                  title="Change status (e.g. Left Early), replace staff, or change station with timestamp"
                                >
                                  <Edit3 className="icon icon-xs" aria-hidden="true" />
                                  Change
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => onRemoveShiftRosterMember && onRemoveShiftRosterMember(entry.id)}
                                  style={{ color: "var(--crimson-600)" }}
                                  title="Remove from current shift roster (logs timestamp)"
                                >
                                  <Trash2 className="icon icon-xs" aria-hidden="true" />
                                  Remove
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Timestamped Shift Roster Change Log */}
            {(data.shiftRosterLog || []).length > 0 && (
              <div
                style={{
                  marginTop: "14px",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "var(--paper-50)",
                  border: "1px solid var(--paper-200)",
                }}
              >
                <div className="mono-label" style={{ marginBottom: "8px", color: "var(--ink-600)" }}>
                  TIMESTAMPED CURRENT SHIFT ROSTER LOG ({data.shiftRosterLog!.length})
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                  {data.shiftRosterLog!.map(log => (
                    <li
                      key={log.id}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "8px",
                        fontSize: "12px",
                        color: "var(--ink-700)",
                      }}
                    >
                      <span className="mono-small" style={{ fontWeight: 700, color: "var(--espresso-600)", flexShrink: 0 }}>
                        [{log.time}]
                      </span>
                      <span style={{ fontWeight: 600, color: "var(--ink-900)", flexShrink: 0 }}>
                        {log.action}
                      </span>
                      <span style={{ color: "var(--ink-700)" }}>— {log.detail}</span>
                      <span className="muted-text" style={{ marginLeft: "auto", fontSize: "11px", flexShrink: 0 }}>
                        by {log.actor}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="muted-text">No active shift selected.</p>
        )}
      </section>
    </div>
  );
}
