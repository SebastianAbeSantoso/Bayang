import React from "react";
import { ArrowRight, CircleCheck } from "lucide-react";
import type { Shift, ShiftData } from "../data";
import { CAFE, SHIFT_TYPE_LABEL, allChecks, bucketOf, categoryComplete, shiftStatus, signoffState } from "../data";
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
}

export default function Dashboard({ shift, shiftId, db, justSubmitted, onSelectShift, onNavigate }: Props) {
  const data = db[shiftId];
  const st = shiftStatus(shift, data);
  const so = signoffState(data);
  const checks = allChecks(data);
  const count = (b: string) => checks.filter(x => bucketOf(x.check) === b).length;
  const answered = (["equipment", "stock", "cleaning", "cash", "customer"] as const).filter(c => categoryComplete(data.report, c, data.checklist)).length;
  const upcoming = shift.phase === "upcoming";

  return (
    <div className="dashboard">
      <PageHeader title="Dashboard" subtitle={`${CAFE.name} · ${CAFE.branch}`} />

      <div className="dash-shift">
        <span className="field-label">Shift</span>
        <ShiftSelector value={shiftId} db={db} onChange={onSelectShift} />
        <span className="muted-text">Lead {shift.outgoing} · hands over to {shift.incoming}</span>
      </div>

      {justSubmitted && data.submitted && (
        <p className="notice notice-success" role="status">
          <CircleCheck className="icon icon-sm" aria-hidden="true" />
          Report submitted at {data.submittedAt}. The checks are below; the shift is not signed off yet.
        </p>
      )}

      <div className="dash-grid">
        <section className="dash-card">
          <div className="dash-card-head">
            <span className="section-label">1 · Shift report</span>
            <Tag tone={data.submitted ? "success" : upcoming ? "outline" : "info"}>{data.submitted ? "Submitted" : upcoming ? "Not started" : "In progress"}</Tag>
          </div>
          <p className="dash-big">{data.submitted ? data.submittedAt : upcoming ? "—" : `${answered} of 5`}</p>
          <p className="muted-text">{data.submitted ? `Submitted by ${shift.outgoing}` : upcoming ? "Opens when the shift starts" : "sections answered"}</p>
          {!upcoming && (
            <button type="button" className="link-btn dash-link" onClick={() => onNavigate("report")}>
              {data.submitted ? "View report" : "Finish your shift"}<ArrowRight className="icon icon-sm" aria-hidden="true" />
            </button>
          )}
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
          ) : <p className="muted-text">Available after the report is submitted.</p>}
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
            {!data.submitted ? "Built from the shift report." : data.acknowledged ? `${shift.incoming} acknowledged at ${data.acknowledgedAt}.` : `${shift.incoming} has not started the shift yet.`}
          </p>
          {data.submitted && (
            <button type="button" className="link-btn dash-link" onClick={() => onNavigate("briefing")}>
              Open briefing<ArrowRight className="icon icon-sm" aria-hidden="true" />
            </button>
          )}
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <span className="section-label">4 · Sign-off</span>
            <span className="dash-status"><StatusDot tone={st.tone} />{st.label}</span>
          </div>
          <p className="muted-text">
            {data.signedOff ? `Signed off at ${data.signedOffAt}.` : !data.submitted ? "Needs a submitted report first." : so.ready ? "Ready to sign off." : `${so.blockers.length} critical blocker${so.blockers.length === 1 ? "" : "s"} · ${so.tasks.length} mandatory task${so.tasks.length === 1 ? "" : "s"} incomplete`}
          </p>
        </section>
      </div>

      <p className="footnote">{SHIFT_TYPE_LABEL[shift.type]} shift · {shift.dayName}, {shift.dateLabel} · {shift.start}–{shift.end}</p>
    </div>
  );
}
