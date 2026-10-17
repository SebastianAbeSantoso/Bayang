import React, { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, Edit3, KeyRound, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { Tag } from "./ui";
import type { Shift, ShiftData } from "../data";
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

interface Props {
  roster: StaffMember[];
  isOwner?: boolean;
  shift?: Shift;
  data?: ShiftData;
  onChangeStaff?: (which: "outgoing" | "incoming", newName: string) => void;
  onAddStaff?: (member: Omit<StaffMember, "id">) => void;
  onUpdateStaff?: (member: StaffMember) => void;
  onDeleteStaff?: (id: string) => void;
}

export default function StaffRoster({
  roster,
  isOwner = false,
  shift,
  data,
  onChangeStaff,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
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

      {/* Part 2: Current Shift (Lead on duty: Dimas · transfers to Rina) */}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <div>
            <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--espresso-600)" }}>
              <Clock className="icon icon-xs" aria-hidden="true" />
              Part 2 · Current Shift
            </span>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "2px 0 0" }}>
              {shift ? `${SHIFT_TYPE_LABEL[shift.type]} Shift (${shift.start}–${shift.end})` : "Current Shift"}
            </h2>
            <p className="muted-text" style={{ fontSize: "12px", margin: "2px 0 0" }}>
              {shift ? `${shift.dayShort} ${shift.dateLabel} · ${CAFE.name} (${CAFE.branch})` : "Active floor shift handover"}
            </p>
          </div>

          {data && (
            <Tag tone={data.signedOff ? "neutral" : data.submitted ? "info" : data.signedIn ? "success" : "warning"}>
              {data.signedOff
                ? `Transferred ${data.signedOffAt}`
                : data.submitted
                  ? `Report completed ${data.submittedAt}`
                  : data.signedIn
                    ? `Active · Signed in ${data.signedInAt || (shift ? shift.start : "")}`
                    : "Shift in progress"}
            </Tag>
          )}
        </div>

        {shift ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              padding: "14px 18px",
              background: "var(--paper-50)",
              border: "1px solid var(--paper-300)",
              borderRadius: "8px",
              fontSize: "13px",
            }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <span className="muted-text" style={{ fontWeight: 500 }}>Lead on duty:</span>
              {!data?.signedOff && onChangeStaff ? (
                <select
                  aria-label="Current shift lead on duty"
                  className="input input-sm"
                  value={shift.outgoing}
                  onChange={e => onChangeStaff("outgoing", e.target.value)}
                  style={{
                    width: "auto",
                    height: "30px",
                    padding: "2px 10px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    background: "var(--paper-0)",
                  }}
                >
                  {staffSelectOptions.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              ) : (
                <strong>{shift.outgoing}</strong>
              )}
            </div>

            <span className="muted-text">· transfers to</span>

            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              {!data?.signedOff && onChangeStaff ? (
                <select
                  aria-label="Next shift lead"
                  className="input input-sm"
                  value={shift.incoming}
                  onChange={e => onChangeStaff("incoming", e.target.value)}
                  style={{
                    width: "auto",
                    height: "30px",
                    padding: "2px 10px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    background: "var(--paper-0)",
                  }}
                >
                  {staffSelectOptions.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              ) : (
                <strong>{shift.incoming}</strong>
              )}
            </div>

            <span className="muted-text" style={{ fontSize: "12px", marginLeft: "auto" }}>
              Shift lead transfers automatically upon sign-off.
            </span>
          </div>
        ) : (
          <p className="muted-text">No active shift selected.</p>
        )}
      </section>
    </div>
  );
}
