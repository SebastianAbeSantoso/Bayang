import React from "react";
import { ArrowRight, CircleCheck } from "lucide-react";
import type { Shift, ShiftData } from "../data";
import { CAFE, SHIFT_TYPE_LABEL, STAFF_NAMES, allChecks, bucketOf, categoryComplete, shiftStatus, signoffState } from "../data";
import ShiftSelector from "./ShiftSelector";
import { PageHeader, StatusDot, Tag } from "./ui";

type Target = "report" | "ledger" | "briefing" | "records" | "audit";

interface Props {
  shift: Shift;
  shiftId: string;
  db: Record<string, ShiftData>;
  justSubmitted: boolean;
  onSelectShift: (id: string) => void;
  onNavigate: (t: Target) => void;
  onChangeStaff: (which: "outgoing" | "incoming", newName: string) => void;
  onRequestTransfer: () => void;
}

export default function Dashboard({
  shift,
  shiftId,
  db,
  justSubmitted,
  onSelectShift,
  onNavigate,
  onChangeStaff,
  onRequestTransfer,
}: Props) {
  const data = db[shiftId];
  const st = shiftStatus(shift, data);
  const so = signoffState(data);
  const checks = allChecks(data);
  const count = (b: string) => checks.filter(x => bucketOf(x.check) === b).length;
  const answered = (["equipment", "stock", "cleaning", "cash", "customer"] as const).filter(c => categoryComplete(data.report, c, data.checklist)).length;
  const upcoming = shift.phase === "upcoming" && !data.signedIn && !data.submitted;
  const staffOptions = Array.from(new Set([...STAFF_NAMES, shift.outgoing, shift.incoming]));

  return (
    <div className="dashboard">
      <PageHeader title="Dashboard" subtitle={`${CAFE.name} · ${CAFE.branch}`} />

      <div className="dash-shift" style={{ flexWrap: "wrap", gap: "10px" }}>
        <span className="field-label">Shift</span>
        <ShiftSelector value={shiftId} db={db} onChange={onSelectShift} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "13px" }}>
          <span className="muted-text">Lead on duty:</span>
          {!data.signedOff ? (
            <select
              aria-label="Current shift lead"
              className="input input-sm"
              value={shift.outgoing}
              onChange={e => onChangeStaff("outgoing", e.target.value)}
              style={{ width: "auto", height: "28px", padding: "2px 8px", fontSize: "12.5px", fontWeight: 600 }}
            >
              {staffOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <strong>{shift.outgoing}</strong>
          )}
          <span className="muted-text">· transfers to</span>
          {!data.signedOff ? (
            <select
              aria-label="Next shift lead"
              className="input input-sm"
              value={shift.incoming}
              onChange={e => onChangeStaff("incoming", e.target.value)}
              style={{ width: "auto", height: "28px", padding: "2px 8px", fontSize: "12.5px", fontWeight: 600 }}
            >
              {staffOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <strong>{shift.incoming}</strong>
          )}
        </div>
      </div>

      {justSubmitted && data.submitted && (
        <p className="notice notice-success" role="status">
          <CircleCheck className="icon icon-sm" aria-hidden="true" />
          Report completed at {data.submittedAt} by {shift.outgoing}. The reconciliation checks are below; resolve blockers before transferring to the next shift.
        </p>
      )}

      <div className="dash-grid">
        <section className="dash-card">
          <div className="dash-card-head">
            <span className="section-label">1 · Shift report</span>
            <Tag tone={data.submitted ? "success" : data.signedIn ? "info" : "outline"}>
              {data.submitted ? "Completed" : data.signedIn ? "Signed in · Filling" : "Sign-in required"}
            </Tag>
          </div>
          <p className="dash-big">{data.submitted ? data.submittedAt : `${answered} of 5`}</p>
          <p className="muted-text">
            {data.submitted
              ? `Completed by ${shift.outgoing}`
              : data.signedIn
                ? `${shift.outgoing} signed in · ${data.endHourReached ? `Ready to complete (${shift.end})` : `Completes at ${shift.end}`}`
                : `Sign in as ${shift.outgoing} to fill shift report`}
          </p>
          <button type="button" className="link-btn dash-link" onClick={() => onNavigate("report")}>
            {data.submitted ? "View report" : data.signedIn ? "Finish your shift" : "Sign in & fill shift"}<ArrowRight className="icon icon-sm" aria-hidden="true" />
          </button>
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <span className="section-label">2 · Handover checks</span>
            {data.submitted && <Tag tone={count("critical") ? "danger" : count("review") ? "warning" : "success"}>{count("critical") ? "Action needed" : count("review") ? "Review" : "Clear"}</Tag>}
          </div>
          {data.submitted ? (
            <dl className="dash-counts">
              <div className="is-critical"><dt>Critical</dt><dd>{count("critical")}</dd></div>
              <div className="is-review"><dt>Review</dt><dd>{count("review")}</dd></div>
              <div><dt>Follow-up</dt><dd>{count("pending")}</dd></div>
              <div><dt>Info</dt><dd>{count("info")}</dd></div>
            </dl>
          ) : <p className="muted-text">Available after the shift report is completed at {shift.end}.</p>}
          {data.submitted && (
            <button type="button" className="link-btn dash-link" onClick={() => onNavigate("ledger")}>
              Open handover ledger<ArrowRight className="icon icon-sm" aria-hidden="true" />
            </button>
          )}
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <span className="section-label">3 · Incoming briefing</span>
            {data.submitted && <Tag tone={data.acknowledged ? "success" : "outline"}>{data.acknowledged ? "Acknowledged" : "Waiting"}</Tag>}
          </div>
          <p className="muted-text">
            {!data.submitted ? "Built from the shift report." : data.acknowledged ? `${shift.incoming} acknowledged at ${data.acknowledgedAt}.` : `Prepared for ${shift.incoming} (next shift).`}
          </p>
          {data.submitted && (
            <button type="button" className="link-btn dash-link" onClick={() => onNavigate("briefing")}>
              Open briefing<ArrowRight className="icon icon-sm" aria-hidden="true" />
            </button>
          )}
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <span className="section-label">4 · Shift transfer</span>
            <span className="dash-status"><StatusDot tone={st.tone} />{st.label}</span>
          </div>
          <p className="muted-text">
            {data.signedOff
              ? `Transferred to ${shift.incoming} at ${data.signedOffAt}.`
              : !data.submitted
                ? "Complete the shift report at the end hour first."
                : so.ready
                  ? `Ready to transfer shift to ${shift.incoming}.`
                  : `${so.blockers.length} critical blocker${so.blockers.length === 1 ? "" : "s"} · ${so.tasks.length} mandatory task${so.tasks.length === 1 ? "" : "s"} incomplete`}
          </p>
          {!data.signedOff && so.ready && (
            <button type="button" className="link-btn dash-link" onClick={onRequestTransfer}>
              Transfer shift to {shift.incoming}<ArrowRight className="icon icon-sm" aria-hidden="true" />
            </button>
          )}
        </section>
      </div>

      <p className="footnote">{SHIFT_TYPE_LABEL[shift.type]} shift · {shift.dayName}, {shift.dateLabel} · {shift.start}–{shift.end}</p>
    </div>
  );
}
