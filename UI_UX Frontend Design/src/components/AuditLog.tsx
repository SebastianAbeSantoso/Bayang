import React, { useMemo, useState } from "react";
import { Cpu, User } from "lucide-react";
import type { AuditEvent, EventType } from "../data";
import { EVENT_TYPE_LABEL, SHIFTS, shiftById, shiftShort } from "../data";
import { EmptyState, PageHeader } from "./ui";

export default function AuditLog({ events, currentShiftId }: { events: AuditEvent[]; currentShiftId: string }) {
  const [type, setType] = useState<EventType | "all">("all");
  const [actor, setActor] = useState<"all" | "system" | "human">("all");
  const [shiftId, setShiftId] = useState<string>(currentShiftId);
  const [date, setDate] = useState<string>("all");
  const [lastShift, setLastShift] = useState(currentShiftId);
  if (lastShift !== currentShiftId) { setLastShift(currentShiftId); setShiftId(currentShiftId); }

  const dates = [...new Set(SHIFTS.map(s => s.date))];
  const list = useMemo(
    () => events
      .filter(e => (type === "all" || e.type === type) && (actor === "all" || e.actorKind === actor) && (shiftId === "all" || e.shiftId === shiftId) && (date === "all" || e.date === date))
      .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)),
    [events, type, actor, shiftId, date]
  );

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every report, check, and decision, newest first. Entries are only ever added; corrections appear as new entries." />
      <div className="filters">
        <label className="inline-field"><span className="field-label">Event</span>
          <select className="input input-sm" value={type} onChange={e => setType(e.target.value as EventType | "all")}>
            <option value="all">All events</option>
            {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map(t => <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="inline-field"><span className="field-label">Actor</span>
          <select className="input input-sm" value={actor} onChange={e => setActor(e.target.value as typeof actor)}>
            <option value="all">Everyone</option><option value="human">People</option><option value="system">System</option>
          </select>
        </label>
        <label className="inline-field"><span className="field-label">Shift</span>
          <select className="input input-sm" value={shiftId} onChange={e => setShiftId(e.target.value)}>
            <option value="all">All shifts</option>
            {SHIFTS.map(s => <option key={s.id} value={s.id}>{shiftShort(s)}</option>)}
          </select>
        </label>
        <label className="inline-field"><span className="field-label">Date</span>
          <select className="input input-sm" value={date} onChange={e => setDate(e.target.value)}>
            <option value="all">Any date</option>
            {dates.map(d => <option key={d} value={d}>{shiftById(SHIFTS.find(s => s.date === d)!.id).dayShort}, {SHIFTS.find(s => s.date === d)!.dateLabel}</option>)}
          </select>
        </label>
        <span className="muted-text filters-count">{list.length} entries</span>
      </div>

      {list.length === 0 ? <EmptyState title="No entries" body="No events match these filters." /> : (
        <ol className="audit-list">
          {list.map(e => (
            <li key={e.id} className={`audit-row is-${e.actorKind}`}>
              <span className="audit-time mono">{e.date.slice(5).replace("-", "/")} {e.time}</span>
              <span className={`audit-actor is-${e.actorKind}`}>
                {e.actorKind === "system" ? <Cpu className="icon icon-sm" aria-hidden="true" /> : <User className="icon icon-sm" aria-hidden="true" />}
                {e.actor}
              </span>
              <span className="audit-body">
                <span className="audit-action">{e.action}</span>
                <span className="audit-expl">{e.explanation}</span>
              </span>
              <span className="audit-refs mono">
                <span>{shiftShort(shiftById(e.shiftId))}</span>
                {e.findingId && <span>{e.findingId}</span>}
                {e.sourceRef && <span>{e.sourceRef}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="footnote">This prototype stores the log in the browser. It is append-only in the interface, but not cryptographically tamper-proof.</p>
    </>
  );
}
