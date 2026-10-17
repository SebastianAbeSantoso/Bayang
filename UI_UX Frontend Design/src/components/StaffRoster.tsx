import React, { useState } from "react";
import { Check, Edit3, KeyRound, Plus, ShieldCheck, Trash2, UserCheck, Users, X } from "lucide-react";
import { Tag } from "./ui";

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
  onAddStaff: (member: Omit<StaffMember, "id">) => void;
  onUpdateStaff: (member: StaffMember) => void;
  onDeleteStaff: (id: string) => void;
}

export default function StaffRoster({
  roster,
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

  const startEdit = (m: StaffMember) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditRole(m.role);
    setEditStation(m.station);
    setEditPin(m.pin);
  };

  const handleSaveEdit = (id: string) => {
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
    setNewStation("Shift Lead");
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
            <ShieldCheck className="icon icon-xs" aria-hidden="true" />
            Owner Mode · Store Staff & PIN Access
          </span>
          <h1 className="page-title">Staff Roster Management</h1>
          <p className="page-subtitle">
            Add, edit, or remove Shift Leads, floor staff, and 4-digit POS tablet PINs. Changes update the Shift Sign-In screen immediately.
          </p>
        </div>
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
              <th style={{ padding: "12px 16px" }}>Access Role</th>
              <th style={{ padding: "12px 16px" }}>Station / Title</th>
              <th style={{ padding: "12px 16px" }}>PIN</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roster.map(member => {
              const isEditing = editingId === member.id;
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
                        <option value="shift_lead">Shift Lead</option>
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
                          onClick={() => onDeleteStaff(member.id)}
                          style={{ color: "var(--crimson-600)" }}
                          title="Delete staff member"
                        >
                          <Trash2 className="icon icon-xs" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
