import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { Availability, RecordGroup, ShiftData } from "../data";
import { AVAILABILITY_LABEL, GROUP_LABEL } from "../data";
import { AvailabilityTag, EmptyState, PageHeader } from "./ui";

export default function Records({ data }: { data: ShiftData }) {
  const [group, setGroup] = useState<RecordGroup | "all">("all");
  const [avail, setAvail] = useState<Availability | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const rec = data.records.find(r => r.id === openId);

  if (data.records.length === 0)
    return (
      <>
        <PageHeader title="Operational records" subtitle="The records ShiftGuard uses to check each handover." />
        <EmptyState title="No records yet" body="Records are collected once the shift starts." />
      </>
    );

  if (rec) {
    const cols = rec.rows[0] ? Object.keys(rec.rows[0]) : [];
    return (
      <div className="record-detail">
        <button type="button" className="link-btn back-link" onClick={() => setOpenId(null)}>
          <ArrowLeft className="icon icon-sm" aria-hidden="true" />All records
        </button>
        <PageHeader title={rec.name} subtitle={`${GROUP_LABEL[rec.group]} · ${rec.type}`}>
          <AvailabilityTag value={rec.availability} />
        </PageHeader>
        <dl className="kv-grid">
          <div><dt>Record ID</dt><dd className="mono">{rec.id}</dd></div>
          <div><dt>Coverage</dt><dd>{rec.coverage}</dd></div>
          <div><dt>Last updated</dt><dd>{rec.updated}</dd></div>
          <div><dt>Where it lives</dt><dd>{rec.location}</dd></div>
          {rec.fields.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        {rec.gap && <p className="notice notice-warning">Missing information: {rec.gap}</p>}
        <div className="meaning-grid">
          <div className="meaning meaning-yes">
            <p className="section-label">What this record establishes</p>
            <p className="body-text">{rec.establishes}</p>
          </div>
          <div className="meaning meaning-no">
            <p className="section-label">What it does not establish</p>
            <p className="body-text">{rec.doesNotEstablish}</p>
          </div>
        </div>
        <p className="section-label">Raw data used in verification</p>
        {rec.rows.length === 0 ? (
          <p className="muted-text">0 entries in this record for the coverage period.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{rec.rows.map((row, i) => <tr key={i}>{cols.map(c => <td key={c}>{row[c]}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const groups = (["sales", "equipment", "inventory"] as RecordGroup[]).filter(g => group === "all" || g === group);
  const visible = (g: RecordGroup) => data.records.filter(r => r.group === g && (avail === "all" || r.availability === avail));

  return (
    <>
      <PageHeader title="Operational records" subtitle="The records ShiftGuard uses to check each handover." />
      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Record category">
          {(["all", "sales", "equipment", "inventory"] as const).map(g => (
            <button key={g} type="button" role="tab" aria-selected={group === g} className={`segment ${group === g ? "is-active" : ""}`} onClick={() => setGroup(g)}>
              {g === "all" ? "All" : GROUP_LABEL[g]}
            </button>
          ))}
        </div>
        <label className="inline-field">
          <span className="field-label">Availability</span>
          <select className="input input-sm" value={avail} onChange={e => setAvail(e.target.value as Availability | "all")}>
            <option value="all">Any</option>
            {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map(a => <option key={a} value={a}>{AVAILABILITY_LABEL[a]}</option>)}
          </select>
        </label>
      </div>

      {groups.map(g => {
        const rows = visible(g);
        return (
          <section key={g} className="record-group">
            <h3 className="group-title">{GROUP_LABEL[g]}</h3>
            {rows.length === 0 ? <p className="muted-text">No records match this filter.</p> : (
              <div className="table-wrap">
                <table className="table table-click">
                  <thead>
                    <tr><th>Source</th><th>Record ID</th><th>Coverage</th><th>Updated</th><th className="num">Entries</th><th>Availability</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} tabIndex={0} onClick={() => setOpenId(r.id)} onKeyDown={e => { if (e.key === "Enter") setOpenId(r.id); }}>
                        <td><span className="cell-strong">{r.name}</span><span className="cell-sub">{r.type}</span></td>
                        <td className="mono">{r.id}</td>
                        <td>{r.coverage}</td>
                        <td className="mono">{r.updated}</td>
                        <td className="num mono">{r.entries}</td>
                        <td><AvailabilityTag value={r.availability} />{r.gap && <span className="cell-sub">{r.gap}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
