import React, { useState } from "react";
import { X, Lock, KeyRound, UserCheck, Users, Plus, ShieldCheck, Check, Smartphone, Key } from "lucide-react";
import type { Role } from "../data";
import { Tag } from "./ui";

export interface StaffMember {
  id: string;
  name: string;
  fullName: string;
  role: Role;
  roleTitle: string;
  pin: string;
  phone: string;
  active: boolean;
  avatarColor: string;
}

interface StaffPinModalProps {
  currentRole: Role;
  onSelectStaff: (staff: StaffMember) => void;
  onClose: () => void;
  staffList: StaffMember[];
  onAddStaff: (newStaff: StaffMember) => void;
}

export default function StaffPinModal({
  currentRole,
  onSelectStaff,
  onClose,
  staffList,
  onAddStaff,
}: StaffPinModalProps) {
  const [tab, setTab] = useState<"terminal" | "roster">("terminal");
  const [selectedStaff, setSelectedStaff] = useState<StaffMember>(
    () => staffList.find(s => s.role === currentRole) || staffList[0]
  );
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New staff form state
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("outgoing");
  const [newPin, setNewPin] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);

  const handleKeyClick = (digit: string) => {
    if (pinInput.length >= 4) return;
    const nextPin = pinInput + digit;
    setPinInput(nextPin);
    setPinError(null);

    if (nextPin.length === 4) {
      if (nextPin === selectedStaff.pin) {
        onSelectStaff(selectedStaff);
        onClose();
      } else {
        setPinError(`Incorrect PIN. (Hint: ${selectedStaff.name}'s PIN is ${selectedStaff.pin})`);
      }
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
    setPinError(null);
  };

  const handleClear = () => {
    setPinInput("");
    setPinError(null);
  };

  const handleQuickBypass = (staff: StaffMember) => {
    onSelectStaff(staff);
    onClose();
  };

  const handleCopyInvite = (staff: StaffMember) => {
    const text = `Hi ${staff.name}, your ShiftGuard terminal PIN for Common Ground Central is: ${staff.pin}. Access the shift workbench: https://shiftguard.app/central`;
    navigator.clipboard?.writeText(text);
    setCopiedId(staff.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newPin.length !== 4) return;

    const roleTitles: Record<Role, string> = {
      outgoing: "Outgoing Shift Lead",
      incoming: "Incoming Shift Lead",
      supervisor: "Store Supervisor",
    };

    const newEntry: StaffMember = {
      id: `STF-${Date.now().toString().slice(-4)}`,
      name: newName.trim().split(" ")[0],
      fullName: newName.trim(),
      role: newRole,
      roleTitle: roleTitles[newRole],
      pin: newPin,
      phone: newPhone || "+62 812-0000-0000",
      active: true,
      avatarColor: newRole === "supervisor" ? "#7c3aed" : newRole === "incoming" ? "#0284c7" : "#c89d7c",
    };

    onAddStaff(newEntry);
    setNewName("");
    setNewPin("");
    setNewPhone("");
    setFormSuccess(true);
    setTimeout(() => setFormSuccess(false), 3000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "680px",
          width: "95%",
          background: "var(--paper-100)",
          border: "1px solid var(--paper-400)",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: "16px 20px",
            background: "var(--paper-200)",
            borderBottom: "1px solid var(--paper-300)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "var(--espresso-800)",
                color: "var(--espresso-100)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Lock size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--espresso-900)" }}>
                In-Store Terminal Authentication
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-500)" }}>
                Common Ground Coffee · Central Branch · Countertop Tablet #1
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close"
            style={{ borderRadius: "50%", width: "32px", height: "32px", padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* View Mode Switcher */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--paper-300)",
            background: "var(--paper-50)",
          }}
        >
          <button
            type="button"
            onClick={() => setTab("terminal")}
            style={{
              flex: 1,
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: tab === "terminal" ? "var(--paper-100)" : "transparent",
              color: tab === "terminal" ? "var(--espresso-800)" : "var(--ink-500)",
              border: "none",
              borderBottom: tab === "terminal" ? "2px solid var(--espresso-800)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
            }}
          >
            <KeyRound size={16} />
            4-Digit PIN Terminal
          </button>
          <button
            type="button"
            onClick={() => setTab("roster")}
            style={{
              flex: 1,
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: tab === "roster" ? "var(--paper-100)" : "transparent",
              color: tab === "roster" ? "var(--espresso-800)" : "var(--ink-500)",
              border: "none",
              borderBottom: tab === "roster" ? "2px solid var(--espresso-800)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
            }}
          >
            <Users size={16} />
            Staff Roster & Provisioning (Owner View)
          </button>
        </div>

        {/* Tab 1: Terminal 4-Digit PIN */}
        {tab === "terminal" ? (
          <div style={{ padding: "20px" }}>
            <p style={{ margin: "0 0 14px", fontSize: "13px", color: "var(--ink-600)" }}>
              Tap your staff profile and enter your 4-digit PIN to switch the active shift workbench:
            </p>

            {/* Staff Profiles Selection */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
              {staffList.map(s => {
                const isSelected = selectedStaff.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedStaff(s);
                      setPinInput("");
                      setPinError(null);
                    }}
                    style={{
                      padding: "12px",
                      borderRadius: "12px",
                      background: isSelected ? "var(--amber-100)" : "var(--paper-200)",
                      border: isSelected ? "2px solid var(--amber-600)" : "1px solid var(--paper-400)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        background: s.avatarColor,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "15px",
                        fontWeight: 700,
                        margin: "0 auto 8px",
                      }}
                    >
                      {s.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--espresso-900)" }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--ink-500)", marginTop: "2px" }}>
                      {s.roleTitle}
                    </div>
                    <div style={{ marginTop: "6px" }}>
                      <Tag tone={s.role === "supervisor" ? "neutral" : s.role === "incoming" ? "info" : "warning"}>
                        PIN: {s.pin}
                      </Tag>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PIN Display & Keypad */}
            <div style={{ maxWidth: "300px", margin: "0 auto", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "var(--ink-500)", marginBottom: "8px" }}>
                Authenticating as <strong style={{ color: "var(--espresso-900)" }}>{selectedStaff.fullName}</strong>
              </div>

              {/* 4 PIN Dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: "14px", marginBottom: "16px" }}>
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: i < pinInput.length ? "var(--espresso-800)" : "var(--paper-300)",
                      border: "2px solid var(--paper-500)",
                      transition: "all 0.15s ease",
                      transform: i < pinInput.length ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                ))}
              </div>

              {pinError && (
                <div style={{ fontSize: "12px", color: "#dc2626", marginBottom: "12px", fontWeight: 600 }}>
                  {pinError}
                </div>
              )}

              {/* Numeric Keypad Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "16px" }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeyClick(num)}
                    style={{
                      height: "46px",
                      fontSize: "18px",
                      fontWeight: 600,
                      borderRadius: "10px",
                      border: "1px solid var(--paper-400)",
                      background: "var(--paper-50)",
                      color: "var(--espresso-900)",
                      cursor: "pointer",
                    }}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    height: "46px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "10px",
                    border: "1px solid var(--paper-400)",
                    background: "var(--paper-200)",
                    color: "var(--ink-600)",
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleKeyClick("0")}
                  style={{
                    height: "46px",
                    fontSize: "18px",
                    fontWeight: 600,
                    borderRadius: "10px",
                    border: "1px solid var(--paper-400)",
                    background: "var(--paper-50)",
                    color: "var(--espresso-900)",
                    cursor: "pointer",
                  }}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  style={{
                    height: "46px",
                    fontSize: "13px",
                    fontWeight: 600,
                    borderRadius: "10px",
                    border: "1px solid var(--paper-400)",
                    background: "var(--paper-200)",
                    color: "var(--ink-600)",
                    cursor: "pointer",
                  }}
                >
                  ⌫
                </button>
              </div>

              {/* Quick Switch Demo Button */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickBypass(selectedStaff)}
                style={{ width: "100%", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <UserCheck size={14} /> Quick Switch (Demo Bypass for Judges)
              </button>
            </div>
          </div>
        ) : (
          /* Tab 2: Owner Staff Provisioning */
          <div style={{ padding: "20px", maxHeight: "480px", overflowY: "auto" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={18} style={{ color: "var(--emerald-600)" }} />
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--espresso-900)" }}>
                  Central Branch Employee Roster
                </h4>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--ink-500)" }}>
                Store Owners provision 4-digit PINs and mobile WhatsApp invite links. Staff never need to register manually.
              </p>
            </div>

            {/* Roster Table */}
            <div style={{ border: "1px solid var(--paper-300)", borderRadius: "10px", overflow: "hidden", marginBottom: "20px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                <thead>
                  <tr style={{ background: "var(--paper-200)", textAlign: "left", color: "var(--ink-600)", borderBottom: "1px solid var(--paper-300)" }}>
                    <th style={{ padding: "8px 12px" }}>Staff Member</th>
                    <th style={{ padding: "8px 12px" }}>Role</th>
                    <th style={{ padding: "8px 12px" }}>4-Digit PIN</th>
                    <th style={{ padding: "8px 12px" }}>Mobile Invite</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s, idx) => (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: idx < staffList.length - 1 ? "1px solid var(--paper-200)" : "none",
                        background: idx % 2 === 0 ? "var(--paper-50)" : "var(--paper-100)",
                      }}
                    >
                      <td style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            background: s.avatarColor,
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          {s.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--espresso-900)" }}>{s.fullName}</div>
                          <div style={{ fontSize: "11px", color: "var(--ink-500)" }}>{s.phone}</div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <Tag tone={s.role === "supervisor" ? "neutral" : s.role === "incoming" ? "info" : "warning"}>
                          {s.roleTitle}
                        </Tag>
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, color: "var(--espresso-800)" }}>
                        {s.pin}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleCopyInvite(s)}
                          style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          {copiedId === s.id ? (
                            <>
                              <Check size={12} style={{ color: "#16a34a" }} /> Copied!
                            </>
                          ) : (
                            <>
                              <Smartphone size={12} /> WhatsApp Invite
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Staff Member Form */}
            <div style={{ background: "var(--paper-200)", padding: "14px", borderRadius: "10px", border: "1px solid var(--paper-400)" }}>
              <h5 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 700, color: "var(--espresso-900)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Plus size={14} /> Provision New Staff Member
              </h5>

              {formSuccess && (
                <div style={{ background: "#dcfce7", color: "#166534", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", marginBottom: "10px", fontWeight: 600 }}>
                  ✓ Staff member added to Common Ground roster with 4-digit PIN!
                </div>
              )}

              <form onSubmit={handleCreateStaff} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-600)", marginBottom: "4px" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="input input-sm"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-600)", marginBottom: "4px" }}>
                    Assigned Role
                  </label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as Role)}
                    className="input input-sm"
                    style={{ width: "100%" }}
                  >
                    <option value="outgoing">Outgoing Shift Lead</option>
                    <option value="incoming">Incoming Shift Lead</option>
                    <option value="supervisor">Store Supervisor</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-600)", marginBottom: "4px" }}>
                    4-Digit Terminal PIN
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="e.g. 7744"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="input input-sm"
                    style={{ width: "100%", fontFamily: "monospace", letterSpacing: "2px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-600)", marginBottom: "4px" }}>
                    WhatsApp / Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+62 8..."
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="input input-sm"
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ gridColumn: "span 2", textAlign: "right", marginTop: "4px" }}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Save to Branch Roster
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
