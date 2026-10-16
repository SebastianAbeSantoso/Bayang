import React from "react";
import { CircleCheck } from "lucide-react";
import type { Shift, ShiftData } from "../data";
import { allChecks, SHIFT_TYPE_LABEL, SHIFTS } from "../data";
import { EmptyState, PageHeader, SeverityTag, Tag, WorkflowTag } from "./ui";

export default function Briefing({ shift, data, locked, onStart }: { shift: Shift; data: ShiftData; locked: string | null; onStart: () => void }) {
  if (!data.submitted)
    return (
      <>
        <PageHeader title="Incoming briefing" />
        <EmptyState title="Briefing not ready" body={`It is built from ${shift.outgoing}'s shift report once it is submitted.`} />
      </>
    );

  const idx = SHIFTS.findIndex(s => s.id === shift.id);
  const next = idx > 0 ? SHIFTS[idx - 1] : null;
  const open = allChecks(data).filter(x => x.check.workflow !== "resolved");
  const attention = open.filter(x => x.check.severity !== "info" || x.finding.category === "equipment");
  const stock = open.filter(x => x.finding.category === "stock" && x.check.severity === "info");
  const tasks = data.checklist.filter(t => !t.done);
  const deliveries = data.records.filter(r => r.id.startsWith("PO-") && r.availability === "available");
  const comingUp = open.filter(x => x.check.owner && (x.check.target === "Technician visit" || x.finding.category === "customer"));
  const carried = allChecks(data).filter(x => x.check.owner);

  return (
    <div className="briefing">
      <PageHeader
        title="Incoming briefing"
        subtitle={`From ${shift.outgoing} (${SHIFT_TYPE_LABEL[shift.type]}) to ${shift.incoming}${next ? ` · ${SHIFT_TYPE_LABEL[next.type]}, ${next.dayShort} ${next.dateLabel}` : ""}`}
      >
        {data.acknowledged ? (
          <Tag tone="success">Acknowledged {data.acknowledgedAt}</Tag>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onStart} disabled={!!locked}>Start shift</button>
        )}
      </PageHeader>

      {data.acknowledged && (
        <p className="notice notice-neutral">
          <CircleCheck className="icon icon-sm" aria-hidden="true" />
          {shift.incoming} confirmed receiving this briefing. Open items below stay open until someone resolves them.
        </p>
      )}
      {!data.acknowledged && <p className="muted-text">Starting the shift confirms you received this briefing. It does not close any issue.</p>}

      {data.incomingBriefing && (
        <section className="brief-section gemma-summary-hero" style={{ background: "var(--paper-50)", border: "1px solid var(--paper-400)", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span className="mono-label" style={{ color: "var(--espresso-500)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
              ⚡ 30-Second Executive Synthesis · Google Gemma 3-27B-IT (AMD Instinct)
            </span>
            {data.incomingBriefing.latencyMs ? (
              <span className="mono-small" style={{ color: "var(--ink-500)" }}>{data.incomingBriefing.latencyMs}ms latency</span>
            ) : null}
          </div>
          <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "16px", fontWeight: 600, color: "var(--ink-900)", margin: "0 0 8px 0" }}>
            {data.incomingBriefing.headline}
          </h4>
          <p className="body-text" style={{ fontSize: "13px", lineHeight: "1.5", color: "var(--ink-700)", margin: 0 }}>
            {data.incomingBriefing.narrative}
          </p>
          {data.incomingBriefing.deliveryEta && (
            <p className="mono-small" style={{ marginTop: "10px", color: "var(--amber-700)", fontWeight: 500 }}>
              🚚 <strong>Supplier Delivery:</strong> {data.incomingBriefing.deliveryEta}
            </p>
          )}
        </section>
      )}

      <section className="brief-section">
        <h3 className="group-title">Needs attention</h3>
        {attention.length + stock.length + tasks.length === 0 ? <p className="muted-text">Nothing outstanding.</p> : (
          <ul className="brief-list">
            {attention.map(({ finding, check }) => (
              <li key={check.id} className={`brief-item ${check.severity === "critical" ? "is-critical" : ""}`}>
                <div className="brief-item-main">
                  <span className="brief-item-title">{finding.title} — {check.title}</span>
                  <span className="muted-text">{check.owner ? `Owner: ${check.owner}` : "No owner yet"} · Next: {check.requiredAction ?? check.obligation ?? "Review"}</span>
                </div>
                <SeverityTag value={check.severity} /><WorkflowTag value={check.workflow} />
              </li>
            ))}
            {stock.map(({ finding, check }) => (
              <li key={check.id} className="brief-item">
                <div className="brief-item-main">
                  <span className="brief-item-title">{finding.title}</span>
                  <span className="muted-text">{check.obligation}</span>
                </div>
                <WorkflowTag value={check.workflow} />
              </li>
            ))}
            {tasks.map(t => (
              <li key={t.id} className="brief-item">
                <div className="brief-item-main">
                  <span className="brief-item-title">Task not done: {t.label}</span>
                  <span className="muted-text">{t.mandatory ? "Mandatory" : "Optional"} · {t.id}{t.reason ? ` · “${t.reason}”` : ""}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="brief-section">
        <h3 className="group-title">Coming up</h3>
        {deliveries.length + comingUp.length === 0 ? <p className="muted-text">No scheduled deliveries or visits.</p> : (
          <ul className="brief-list">
            {deliveries.map(d => (
              <li key={d.id} className="brief-item">
                <div className="brief-item-main">
                  <span className="brief-item-title">Delivery: {d.fields[0][1]}</span>
                  <span className="muted-text">{d.fields[1][1]} · {d.location} · <span className="mono">{d.id}</span></span>
                </div>
              </li>
            ))}
            {comingUp.map(({ finding, check }) => (
              <li key={check.id} className="brief-item">
                <div className="brief-item-main">
                  <span className="brief-item-title">{check.target}: {finding.title}</span>
                  <span className="muted-text">Owner: {check.owner}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="brief-section">
        <h3 className="group-title">Context</h3>
        {data.report.notes.length > 0 && data.report.notes.map((n, i) => <blockquote key={i} className="quote">“{n}” <span className="mono-small">— {shift.outgoing}, shift note</span></blockquote>)}
        <ul className="brief-list">
          {data.findings.filter(f => f.quote).map(f => (
            <li key={f.id} className="brief-item">
              <div className="brief-item-main">
                <span className="brief-item-title">“{f.quote}”</span>
                <span className="muted-text">{f.id} · sources: {f.recordIds.join(", ") || "worker report"}</span>
              </div>
            </li>
          ))}
          {carried.map(({ finding, check }) => (
            <li key={check.id + "c"} className="brief-item">
              <div className="brief-item-main">
                <span className="brief-item-title">Carried: {check.title}</span>
                <span className="muted-text">{finding.id} · {check.owner}</span>
              </div>
              <WorkflowTag value={check.workflow} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
