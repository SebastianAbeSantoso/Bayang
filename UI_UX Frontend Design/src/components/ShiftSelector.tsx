import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { ShiftData } from "../data";
import { SHIFTS, SHIFT_TYPE_LABEL, effectiveShift, shiftLabel, shiftStatus } from "../data";
import { StatusDot } from "./ui";

export default function ShiftSelector({ value, db, onChange }: { value: string; db: Record<string, ShiftData>; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = effectiveShift(SHIFTS.find(s => s.id === value)!, db[value]);
  const selStatus = shiftStatus(selected, db[value]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hits = SHIFTS.map(s => effectiveShift(s, db[s.id])).filter(s => {
      if (!q) return true;
      const hay = [s.dayName, s.dayShort, s.dateLabel, s.date, SHIFT_TYPE_LABEL[s.type], s.outgoing, s.incoming, s.start, s.end, shiftStatus(s, db[s.id]).label].join(" ").toLowerCase();
      return q.split(/\s+/).every(t => hay.includes(t));
    });
    const map = new Map<string, typeof hits>();
    hits.forEach(s => map.set(s.date, [...(map.get(s.date) ?? []), s]));
    return [...map.entries()];
  }, [query, db]);

  const dayPrefix = (i: number) => (i === 0 ? "Today" : i === 1 ? "Yesterday" : null);
  const dates = [...new Set(SHIFTS.map(s => s.date))];

  return (
    <div className="shift-selector" ref={ref}>
      <button type="button" className="shift-selector-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <StatusDot tone={selStatus.tone} />
        <span className="shift-selector-label">{shiftLabel(selected)}</span>
        <span className="shift-selector-status">{selStatus.label}</span>
        <ChevronDown className="icon icon-sm" aria-hidden="true" />
      </button>

      {open && (
        <div className="shift-popover" role="dialog" aria-label="Select shift">
          <label className="shift-search">
            <Search className="icon icon-sm" aria-hidden="true" />
            <span className="sr-only">Search shifts</span>
            <input
              ref={inputRef}
              className="shift-search-input"
              placeholder="Search by date, shift, or worker..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </label>
          <div className="shift-popover-list" role="listbox">
            {groups.length === 0 && <p className="shift-popover-empty">No shifts match “{query}”.</p>}
            {groups.map(([date, shifts]) => {
              const s0 = shifts[0];
              const prefix = dayPrefix(dates.indexOf(date));
              return (
                <div key={date} className="shift-popover-group">
                  <div className="shift-popover-date">{prefix ? `${prefix} · ` : ""}{s0.dayName}, {s0.dateLabel}</div>
                  {shifts.map(s => {
                    const st = shiftStatus(s, db[s.id]);
                    const active = s.id === value;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`shift-option ${active ? "is-active" : ""}`}
                        onClick={() => { onChange(s.id); setOpen(false); setQuery(""); }}
                      >
                        <span className="shift-option-main">
                          <span className="shift-option-name">{SHIFT_TYPE_LABEL[s.type]} · {s.start}–{s.end}</span>
                          <span className="shift-option-meta">Lead: {s.outgoing} → {s.incoming}</span>
                        </span>
                        <span className="shift-option-status"><StatusDot tone={st.tone} />{st.label}</span>
                        {active ? <Check className="icon icon-sm" aria-hidden="true" /> : <span className="icon icon-sm" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
