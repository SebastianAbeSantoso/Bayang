import React from "react";
import { ArrowRight, CircleCheck } from "lucide-react";
import type { Shift, ShiftData } from "../data";
import { CAFE, SHIFT_TYPE_LABEL, allChecks, bucketOf, categoryComplete, computeShiftMetrics, shiftStatus, signoffState } from "../data";
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
  const metrics = computeShiftMetrics(data);
  const checks = allChecks(data);
  const count = (b: string) => checks.filter(x => bucketOf(x.check) === b).length;
  const answered = (["equipment", "stock", "cleaning", "cash", "customer"] as const).filter(c => categoryComplete(data.report, c, data.checklist)).length;
  const upcoming = shift.phase === "upcoming" && !data.signedIn && !data.submitted;

  return (
    <div className="dashboard">
      <PageHeader title="Dashboard" subtitle={`${CAFE.name} · ${CAFE.branch}`} />

      <div className="dash-shift">
        <span className="field-label">Shift</span>
        <ShiftSelector value={shiftId} db={db} onChange={onSelectShift} />
      </div>

      {justSubmitted && data.submitted && (
        <p className="notice notice-success" role="status">
          <CircleCheck className="icon icon-sm" aria-hidden="true" />
          Report completed at {data.submittedAt} by {shift.outgoing}. The reconciliation checks are below; resolve blockers before transferring to the next shift.
        </p>
      )}

      {/* Grounded Shift Operational Metrics Strip */}
      <section
        style={{
          background: "var(--paper-100)",
          border: "1px solid var(--paper-300)",
          borderRadius: "10px",
          padding: "14px 16px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <span className="section-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            Measured Shift Events (Operational Ground Truth)
          </span>
          <span style={{ fontSize: "11px", color: "var(--ink-500)", fontFamily: "var(--font-mono)" }}>
            Shift ID: {shiftId}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "10px",
          }}
        >
          {/* 1. Supply Waste & Low Stock */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--paper-300)",
              background: "#fff",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--ink-500)" }}>Supply Waste & Stock</div>
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ink-900)", marginTop: "2px" }}>
              {metrics.wasteSummary}
            </div>
            <div style={{ fontSize: "11px", color: "var(--ink-500)", marginTop: "2px" }}>
              {metrics.wasteDetail}
            </div>
          </div>

          {/* 2. Machine Fixing */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--paper-300)",
              background: "#fff",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--ink-500)" }}>Machine Fixing</div>
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: metrics.machineIssuesCount > 0 ? "var(--amber-700)" : "var(--ink-900)", marginTop: "2px" }}>
              {metrics.machineIssuesCount > 0 ? `${metrics.machineIssuesCount} Issue Flagged` : "0 Machine Issues"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--ink-500)", marginTop: "2px" }}>
              {metrics.machineDetail}
            </div>
          </div>

          {/* 3. Closing Checklist */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--paper-300)",
              background: "#fff",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--ink-500)" }}>Closing Checklist</div>
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ink-900)", marginTop: "2px" }}>
              {metrics.tasksDone} / {metrics.tasksTotal} Completed
            </div>
            <div style={{ fontSize: "11px", color: "var(--ink-500)", marginTop: "2px" }}>
              {metrics.tasksDetail}
            </div>
          </div>

          {/* 4. Scheduled Items */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--paper-300)",
              background: "#fff",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--ink-500)" }}>Scheduled Items</div>
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ink-900)", marginTop: "2px" }}>
              {metrics.schedulesCount > 0 ? `${metrics.schedulesCount} Active Schedules` : "0 Schedules"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--ink-500)", marginTop: "2px" }}>
              {metrics.schedulesDetail}
            </div>
          </div>
        </div>
      </section>

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
