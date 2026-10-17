import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, ClipboardCheck, LayoutDashboard, Database, Download, ListChecks, LogIn, ScrollText, X } from "lucide-react";
import type { AuditEvent, ChecklistItem, Finding, OperationalScheduleItem, ReportState, ShiftData, SourceRecord } from "./data";
import {
  CAFE, CURRENT_SHIFT_ID, SHIFTS, SUPERVISOR, SHIFT_TYPE_LABEL, STAFF_NAMES, buildInitialDb, categoryComplete, effectiveShift, makeEvent, reconcile, shiftById, signoffState, stampTime, bucketOf,
} from "./data";
import Dashboard from "./components/Dashboard";
import WorkerReport from "./components/WorkerReport";
import Ledger, { type CheckAction, type NewFindingInput } from "./components/Ledger";
import Records from "./components/Records";
import AuditLog from "./components/AuditLog";
import Briefing from "./components/Briefing";
import ShiftLogin from "./components/ShiftLogin";
import { Tag } from "./components/ui";
import { api, type SystemStatus } from "./api";

type Tab = "dashboard" | "report" | "ledger" | "briefing" | "records" | "audit";

export default function App() {
  const [db, setDb] = useState<Record<string, ShiftData>>(buildInitialDb);
  const [shiftId, setShiftId] = useState(CURRENT_SHIFT_ID);
  const [showLoginScreen, setShowLoginScreen] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferActor, setTransferActor] = useState<string>("");
  const [showExport, setShowExport] = useState(false);
  const [gemmaMode, setGemmaMode] = useState<"live" | "seeded">("live");
  const [isReconciling, setIsReconciling] = useState(false);
  const [, setSystemStatus] = useState<SystemStatus | null>(null);

  const rawShift = shiftById(shiftId);
  const data = db[shiftId];
  const shift = effectiveShift(rawShift, data);
  const so = signoffState(data);
  const locked = data.signedOff ? `Shift transferred at ${data.signedOffAt}. This shift is read-only.` : null;
  const allEvents = useMemo(() => Object.values(db).flatMap(d => d.audit), [db]);

  const idx = SHIFTS.findIndex(s => s.id === shiftId);
  const nextShiftObj = idx > 0 ? effectiveShift(SHIFTS[idx - 1], db[SHIFTS[idx - 1].id]) : null;

  const update = (fn: (d: ShiftData) => ShiftData) => setDb(prev => ({ ...prev, [shiftId]: fn(prev[shiftId]) }));
  const ev = (e: Omit<AuditEvent, "id" | "shiftId" | "date" | "time">) => makeEvent(shift, e);

  useEffect(() => {
    api.getStatus().then(setSystemStatus).catch(() => {});
  }, []);

  const switchShift = (id: string) => {
    setShiftId(id);
    setSelectedFinding(null);
    setSelectedRecordId(null);
    setJustSubmitted(false);
  };

  const setReport = (report: ReportState) => update(d => ({ ...d, report }));
  const setTasks = (ids: string[], patch: Partial<ChecklistItem>) =>
    update(d => ({ ...d, checklist: d.checklist.map(t => (ids.includes(t.id) ? { ...t, ...patch } : t)) }));

  const handleStartShiftSession = (params: {
    shiftId: string;
    outgoingLead: string;
    incomingLead: string;
    crew: string[];
    openTab: "dashboard" | "report" | "briefing" | "ledger";
  }) => {
    const time = stampTime().slice(0, 5);
    const targetShift = shiftById(params.shiftId);
    setShiftId(params.shiftId);
    setSelectedFinding(null);
    setSelectedRecordId(null);
    setJustSubmitted(false);
    setDb(prev => {
      const curr = prev[params.shiftId];
      const startEv = makeEvent(targetShift, {
        actor: params.outgoingLead,
        actorKind: "human",
        type: "shift",
        action: "Signed in & started shift",
        explanation: `${params.outgoingLead} signed in on POS tablet to start ${SHIFT_TYPE_LABEL[targetShift.type]} shift (${targetShift.start}–${targetShift.end}). Handover recipient: ${params.incomingLead}${params.crew.length ? ` · Floor crew: ${params.crew.join(", ")}` : ""}.`,
      });
      return {
        ...prev,
        [params.shiftId]: {
          ...curr,
          signedIn: true,
          signedInAt: curr.signedInAt || time,
          outgoingLead: params.outgoingLead,
          incomingLead: params.incomingLead,
          audit: [startEv, ...curr.audit],
        },
      };
    });
    setTab(params.openTab);
    setShowLoginScreen(false);
  };

  const handleSignIn = (staffName: string) => {
    const time = stampTime().slice(0, 5);
    update(d => ({
      ...d,
      signedIn: true,
      signedInAt: time,
      outgoingLead: staffName,
      audit: [
        ...d.audit,
        ev({
          actor: staffName,
          actorKind: "human",
          type: "shift",
          action: "Signed in to shift",
          explanation: `${staffName} signed in on POS tablet for ${SHIFT_TYPE_LABEL[shift.type]} shift (${shift.start}–${shift.end}).`,
        }),
      ],
    }));
  };

  const handleToggleEndHour = (reached: boolean) => {
    update(d => ({ ...d, endHourReached: reached }));
  };

  const handleChangeStaff = (which: "outgoing" | "incoming", newName: string) => {
    const prevName = which === "outgoing" ? shift.outgoing : shift.incoming;
    if (!newName || newName === prevName) return;
    update(d => ({
      ...d,
      ...(which === "outgoing" ? { outgoingLead: newName } : { incomingLead: newName }),
      audit: [
        ...d.audit,
        ev({
          actor: newName,
          actorKind: "human",
          type: "shift",
          action: which === "outgoing" ? "Reporting shift lead replaced" : "Incoming shift lead replaced",
          explanation: `${prevName} replaced by ${newName} (${which === "outgoing" ? "active shift lead" : "incoming shift lead"}).`,
        }),
      ],
    }));
  };

  const handleSaveSchedule = (item: OperationalScheduleItem, isNew: boolean) => {
    update(d => {
      const exists = d.schedules.some(s => s.id === item.id);
      const schedules = exists
        ? d.schedules.map(s => (s.id === item.id ? item : s))
        : [item, ...d.schedules];

      // Sync to SourceRecord if linkedRecordId or PO-*
      let records = d.records;
      const recId = item.linkedRecordId || (item.id.startsWith("PO-") ? item.id : null);
      if (recId) {
        const cleanItemText = item.title.replace(/^Delivery:\s*/i, "").trim();
        const existingRec = d.records.find(r => r.id === recId);
        if (existingRec) {
          records = d.records.map(r =>
            r.id === recId
              ? {
                  ...r,
                  location: item.vendorOrArea || r.location,
                  fields: [
                    ["Item & qty", cleanItemText],
                    ["Scheduled", item.whenLabel],
                    ["Status", item.status === "completed" ? `Received by ${item.solvedBy || shift.incoming}` : "Confirmed, not yet delivered"],
                  ],
                }
              : r
          );
        } else {
          const newRec: SourceRecord = {
            id: recId,
            category: "stock",
            name: item.category === "delivery" ? "Supplier purchase order" : "Operational schedule record",
            source: item.category === "delivery" ? "Email / Supplier PO" : "Store Schedule",
            location: item.vendorOrArea,
            timestamp: stampTime().slice(0, 5),
            coverage: item.whenLabel,
            availability: "available",
            entries: 1,
            establishes: `Scheduled ${item.title} (${item.whenLabel}).`,
            doesNotEstablish: "Actual physical arrival or verification until signed off by shift staff.",
            fields: [
              ["Item & qty", cleanItemText],
              ["Scheduled", item.whenLabel],
              ["Status", "Scheduled"],
            ],
          };
          records = [...d.records, newRec];
        }
      }

      return {
        ...d,
        schedules,
        records,
        audit: [
          ...d.audit,
          ev({
            actor: shift.outgoing,
            actorKind: "human",
            type: "shift",
            action: isNew ? "Operational schedule added" : "Operational schedule updated",
            explanation: `${item.id}: ${item.title} (${item.whenLabel} · ${item.vendorOrArea}).`,
          }),
        ],
      };
    });
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    update(d => {
      const target = d.schedules.find(s => s.id === scheduleId);
      return {
        ...d,
        schedules: d.schedules.filter(s => s.id !== scheduleId),
        audit: [
          ...d.audit,
          ev({
            actor: shift.outgoing,
            actorKind: "human",
            type: "shift",
            action: "Operational schedule removed",
            explanation: `${scheduleId}${target ? `: ${target.title}` : ""} removed from schedule.`,
          }),
        ],
      };
    });
  };

  const handleCompleteSchedule = (scheduleId: string, payload: { solvedBy: string; solvedWhat: string; solvedWith: string }) => {
    update(d => {
      const solvedAt = stampTime().slice(0, 5);
      const schedules = d.schedules.map(s =>
        s.id === scheduleId
          ? {
              ...s,
              status: "completed" as const,
              solvedBy: payload.solvedBy,
              solvedWhat: payload.solvedWhat,
              solvedWith: payload.solvedWith,
              solvedAt,
            }
          : s
      );
      const target = d.schedules.find(s => s.id === scheduleId);
      const recId = target?.linkedRecordId || scheduleId;
      const records = d.records.map(r =>
        r.id === recId
          ? {
              ...r,
              fields: r.fields.map(([k, v]) => (k.toLowerCase().includes("status") ? [k, `Completed by ${payload.solvedBy} at ${solvedAt} (${payload.solvedWith})`] as [string, string] : [k, v] as [string, string])),
            }
          : r
      );
      const findings = d.findings.map(f =>
        f.recordIds.includes(scheduleId) || f.recordIds.includes(recId)
          ? {
              ...f,
              checks: f.checks.map(c => ({
                ...c,
                workflow: "resolved" as const,
                resolution: "resolved" as const,
                solvedBy: payload.solvedBy,
                solvedWhat: payload.solvedWhat,
                solvedWith: payload.solvedWith,
                solvedAt,
              })),
            }
          : f
      );
      return {
        ...d,
        schedules,
        records,
        findings,
        audit: [
          ...d.audit,
          ev({
            actor: payload.solvedBy,
            actorKind: "human",
            type: "resolved",
            action: "Operational schedule / delivery completed",
            explanation: `${scheduleId}: ${payload.solvedWhat} · Verified with: “${payload.solvedWith}”.`,
          }),
        ],
      };
    });
  };

  const handlePromoteScheduleToIssue = (item: OperationalScheduleItem, issueReason: string, actor = shift.outgoing) => {
    update(d => {
      const schedules = d.schedules.map(s =>
        s.id === item.id
          ? { ...s, status: "issue_raised" as const, placement: "needs_attention" as const }
          : s
      );
      const nextIdx = d.findings.length + 1;
      const fid = `FND-OPS-${String(nextIdx).padStart(2, "0")}`;
      const cat: Finding["category"] =
        item.category === "hygiene_check"
          ? "cleaning"
          : item.category === "maintenance"
            ? "equipment"
            : "stock";
      const recId = item.linkedRecordId || item.id;
      const newFinding: Finding = {
        id: fid,
        title: `${item.title} — Operational schedule issue`,
        category: cat,
        quote: issueReason || `${item.title} (${item.whenLabel}) flagged for handover attention`,
        structured: `Operational Schedule ${item.id} · ${item.whenLabel} · ${item.vendorOrArea}`,
        explanation: `${issueReason}. Linked to schedule ${item.id} (${item.whenLabel}).`,
        unknowns: "Requires incoming shift verification and physical sign-off.",
        recordIds: [recId],
        checks: [
          {
            id: `${fid}-CHK-1`,
            title: `${item.title} (${item.id})`,
            ruleCode: item.category === "hygiene_check" ? "R-HYG-SCH" : "R-SUP-SCH",
            severity: item.category === "hygiene_check" ? "critical" : "review",
            evidence: "supported",
            workflow: "open",
            reason: issueReason,
            requiredAction: item.notes || `Verify and resolve ${item.title} during shift handover`,
          },
        ],
      };

      return {
        ...d,
        schedules,
        findings: [newFinding, ...d.findings],
        audit: [
          ...d.audit,
          ev({
            actor,
            actorKind: "human",
            type: "claim",
            findingId: fid,
            action: "Operational schedule flagged as Handover Issue",
            explanation: `${item.id} (${item.title}) escalated to Handover Ledger as ${fid}: “${issueReason}”.`,
          }),
        ],
      };
    });
  };

  const handleUpdateRecordFields = (recordId: string, newFields: Array<[string, string]>) => {
    update(d => {
      const records = d.records.map(r => (r.id === recordId ? { ...r, fields: newFields } : r));
      // Sync back to schedule if recordId matches PO-4481 or linkedRecordId
      const itemField = newFields.find(([k]) => k.toLowerCase().includes("item"))?.[1];
      const schedField = newFields.find(([k]) => k.toLowerCase().includes("scheduled") || k.toLowerCase().includes("time"))?.[1];
      const schedules = d.schedules.map(s => {
        if (s.id === recordId || s.linkedRecordId === recordId) {
          return {
            ...s,
            title: itemField ? (s.category === "delivery" && !itemField.toLowerCase().startsWith("delivery:") ? `Delivery: ${itemField}` : itemField) : s.title,
            whenLabel: schedField || s.whenLabel,
          };
        }
        return s;
      });
      return {
        ...d,
        records,
        schedules,
        audit: [
          ...d.audit,
          ev({
            actor: shift.outgoing,
            actorKind: "human",
            type: "shift",
            action: `Operational record ${recordId} updated`,
            explanation: newFields.map(([k, v]) => `${k}: ${v}`).join(" · "),
          }),
        ],
      };
    });
  };

  const handleAddFinding = (input: NewFindingInput) => {
    let createdId = "";
    update(d => {
      const nextIdx = d.findings.length + 1;
      const fid = `FND-${String(nextIdx).padStart(2, "0")}`;
      createdId = fid;
      const newFinding: Finding = {
        id: fid,
        title: input.title.trim(),
        category: input.category,
        quote: input.quote.trim() || input.title.trim(),
        structured: `Manual Ledger Entry · Rule ${input.ruleCode} · Logged by ${input.actor}`,
        explanation: input.explanation.trim() || `Logged directly in Handover Ledger by ${input.actor}.`,
        unknowns: "Requires verification by incoming shift or supervisor.",
        recordIds: input.recordId.trim() ? [input.recordId.trim()] : [],
        checks: [
          {
            id: `${fid}-CHK-1`,
            title: input.title.trim(),
            ruleCode: input.ruleCode.trim() || "R-OPS-MANUAL",
            severity: input.severity,
            evidence: input.evidence,
            workflow: "open",
            reason: input.explanation.trim() || input.title.trim(),
            requiredAction: input.requiredAction.trim() || "Verify and resolve during shift handover",
          },
        ],
      };
      return {
        ...d,
        findings: [newFinding, ...d.findings],
        audit: [
          ...d.audit,
          ev({
            actor: input.actor,
            actorKind: "human",
            type: "claim",
            findingId: fid,
            action: "Operational issue added to Handover Ledger",
            explanation: `${fid}: ${newFinding.title} (${input.severity}).`,
          }),
        ],
      };
    });
    if (createdId) setSelectedFinding(createdId);
  };

  const submit = async () => {
    setIsReconciling(true);
    try {
      const notes = data.report.notes.join("\n");
      const res = await api.runReconciliation({
        shift_id: shiftId,
        shift_notes: notes,
        mode: gemmaMode,
        actor: shift.outgoing,
      });

      update(d => {
        const manualOrScheduleFindings = d.findings.filter(f => f.id.startsWith("FND-OPS-") || f.structured.startsWith("Manual Ledger Entry"));
        const mappedFindings: Finding[] = res.findings.map(bf => {
          const matchingChecks = d.findings.flatMap(f => f.checks).filter(c => c.ruleCode === bf.rule_id || bf.title.includes(c.title));
          const checks = matchingChecks.length > 0 ? matchingChecks : [
            {
              id: `${bf.id}-CHK`,
              title: bf.title,
              ruleCode: bf.rule_id,
              severity: bf.severity === "critical" ? "critical" : bf.severity === "warning" ? "review" : "info",
              evidence: bf.evidence_status === "Supported" ? "supported" : bf.evidence_status === "Contradicted" ? "contradicted" : "unverified",
              workflow: bf.status === "resolved" ? "resolved" : "open",
              reason: bf.explanation,
              requiredAction: bf.rule_id === "RULE_01_UNLOGGED_EQUIPMENT_DOWNTIME" ? "Confirm incident log and assign follow-up" : "Review discrepancy",
            }
          ];
          return {
            id: bf.id,
            title: bf.title,
            category: bf.category === "inventory" ? "stock" : bf.category === "equipment" ? "equipment" : bf.category === "sales" ? "cash" : "customer",
            quote: bf.reported_claim,
            structured: `${bf.rule_name} · ${bf.title}`,
            explanation: bf.explanation,
            unknowns: bf.unknowns || "Physical inspection required.",
            recordIds: (bf.evidence_refs || []).map(r => r.record_id),
            checks,
            aiRecommendation: bf.ai_recommendation ? {
              recommendedOwner: bf.ai_recommendation.recommended_owner,
              recommendedTarget: bf.ai_recommendation.recommended_target,
              recommendedAction: bf.ai_recommendation.recommended_action,
              operationalHazard: bf.ai_recommendation.operational_hazard,
            } : (bf.category === "equipment" ? {
              recommendedOwner: "BaristaPro Service (Technician)",
              recommendedTarget: "Technician visit (Before 07:00 morning rush)",
              recommendedAction: "Perform burr alignment and check motor capacitor clearance",
              operationalHazard: "Risk of grinder motor stall during high-volume morning peak",
            } : undefined),
          };
        });

        const briefing = res.incoming_briefing ? {
          headline: res.incoming_briefing.headline,
          narrative: res.incoming_briefing.narrative,
          deliveryEta: res.incoming_briefing.ice_delivery_eta,
          generatedBy: res.incoming_briefing.generated_by,
          latencyMs: res.incoming_briefing.latency_ms,
        } : undefined;

        const gemmaTelemetry = {
          model: res.reconciliation_meta.model,
          mode: res.reconciliation_meta.mode,
          latencyMs: res.reconciliation_meta.latency_ms,
          extractedClaimsCount: res.reconciliation_meta.total_claims,
        };

        const time = stampTime();
        const combinedFindings = [...manualOrScheduleFindings, ...(mappedFindings.length > 0 ? mappedFindings : d.findings.filter(f => !manualOrScheduleFindings.includes(f)))];
        return {
          ...d,
          submitted: true,
          submittedAt: time.slice(0, 5),
          findings: combinedFindings,
          incomingBriefing: briefing,
          gemmaTelemetry,
          audit: [
            ...d.audit,
            ev({
              actor: shift.outgoing,
              actorKind: "human",
              type: "report",
              action: "Shift report completed",
              explanation: `Completed at end hour (${shift.end}) by ${shift.outgoing}.`,
            }),
            ev({
              actor: "Gemma 3-27B-IT · TokenFactory",
              actorKind: "system",
              type: "claim",
              action: `Extracted ${res.claims.length} claims (${res.reconciliation_meta.latency_ms}ms)`,
              explanation: `Mode: ${res.reconciliation_meta.mode}. Exact quote spans verified by Anti-Hallucination Gate.`,
            }),
          ],
        };
      });
    } catch (err) {
      console.warn("Backend reconciliation API error, using deterministic local engine fallback", err);
      update(d => {
        const manualOrScheduleFindings = d.findings.filter(f => f.id.startsWith("FND-OPS-") || f.structured.startsWith("Manual Ledger Entry"));
        const time = stampTime();
        const pre: AuditEvent[] = [
          { ...ev({ actor: shift.outgoing, actorKind: "human", type: "report", action: "Shift report completed", explanation: `All 5 categories answered. ${d.report.notes.length} note(s).` }), time },
          ...d.report.notes.map(n => ev({ actor: shift.outgoing, actorKind: "human", type: "note", action: "Original worker note recorded", explanation: `“${n}”` })),
        ];
        const r = reconcile(shift, { ...d, audit: [] });
        return {
          ...d,
          submitted: true,
          submittedAt: time.slice(0, 5),
          findings: [...manualOrScheduleFindings, ...r.findings],
          checklist: r.checklist,
          audit: [...d.audit, ...pre, ...r.events],
        };
      });
    } finally {
      setIsReconciling(false);
      setJustSubmitted(true);
    }
  };

  const act = (findingId: string, checkId: string, action: CheckAction, p: { rationale: string; owner?: string; target?: string; actor?: string }) => {
    const actorName = p.actor || `${SUPERVISOR} (Supervisor)`;
    api.resolveFinding({
      finding_id: findingId,
      action: action === "carry" ? "carry_forward" : action === "resolve" ? "mark_accounted_for" : action === "override" ? "override_with_rationale" : "mark_false_positive",
      rationale: p.rationale,
      actor: actorName,
      owner_role: p.owner,
      due_time: p.target,
      shift_id: shiftId,
    }).catch(() => {});

    update(d => {
      let linkedTask: string | undefined;
      let title = "";
      const solvedAt = stampTime().slice(0, 5);
      const findings = d.findings.map(f => f.id !== findingId ? f : {
        ...f,
        checks: f.checks.map(c => {
          if (c.id !== checkId) return c;
          linkedTask = c.linkedTaskId;
          title = c.title;
          if (action === "carry") return { ...c, workflow: "awaiting_ack" as const, owner: p.owner, target: p.target };
          return {
            ...c,
            workflow: "resolved" as const,
            resolution: action === "resolve" ? "resolved" as const : action,
            solvedBy: actorName,
            solvedWhat: c.title,
            solvedWith: p.rationale || "Verified and resolved in Handover Ledger",
            solvedAt,
          };
        }),
      });
      const checklist: ChecklistItem[] = linkedTask && (action === "carry" || action === "resolve")
        ? d.checklist.map(t => (t.id === linkedTask ? { ...t, done: true, notDone: false, solvedBy: actorName, solvedWhat: t.label, solvedWith: p.rationale || "Follow-up assigned/resolved", solvedAt } : t))
        : d.checklist;
      const type = action === "carry" ? "carried" : action === "resolve" ? "resolved" : action;
      const label = { carry: "Issue carried forward", resolve: "Finding resolved", override: "Override recorded with rationale", false_positive: "Marked false positive with rationale" }[action];
      const events = [ev({ actor: actorName, actorKind: "human", type, action: label, findingId, explanation: `${title}${p.owner ? ` → ${p.owner} (${p.target})` : ""}${p.rationale ? `. “${p.rationale}”` : ""}` })];
      if (linkedTask && checklist !== d.checklist) events.push(ev({ actor: actorName, actorKind: "human", type: "task", action: "Task completed", findingId, explanation: `${linkedTask}: follow-up recorded.` }));
      return { ...d, findings, checklist, audit: [...d.audit, ...events] };
    });
  };

  const handleSolveCheckFromBriefing = (findingId: string, checkId: string, payload: { solvedBy: string; solvedWhat: string; solvedWith: string }) => {
    api.resolveFinding({
      finding_id: findingId,
      action: "mark_accounted_for",
      rationale: `${payload.solvedWhat} — Solved with: ${payload.solvedWith}`,
      actor: payload.solvedBy,
      shift_id: shiftId,
    }).catch(() => {});

    update(d => {
      const solvedAt = stampTime().slice(0, 5);
      let linkedTaskId: string | undefined;
      const findings = d.findings.map(f => f.id !== findingId ? f : {
        ...f,
        checks: f.checks.map(c => {
          if (c.id !== checkId) return c;
          linkedTaskId = c.linkedTaskId;
          return {
            ...c,
            workflow: "resolved" as const,
            resolution: "resolved" as const,
            solvedBy: payload.solvedBy,
            solvedWhat: payload.solvedWhat,
            solvedWith: payload.solvedWith,
            solvedAt,
          };
        }),
      });
      const checklist = linkedTaskId
        ? d.checklist.map(t => (t.id === linkedTaskId ? { ...t, done: true, notDone: false, solvedBy: payload.solvedBy, solvedWhat: payload.solvedWhat, solvedWith: payload.solvedWith, solvedAt } : t))
        : d.checklist;
      return {
        ...d,
        findings,
        checklist,
        audit: [
          ...d.audit,
          ev({
            actor: payload.solvedBy,
            actorKind: "human",
            type: "resolved",
            action: "Solved from Incoming Briefing",
            findingId,
            explanation: `${payload.solvedWhat} · Solved with: “${payload.solvedWith}”.`,
          }),
        ],
      };
    });
  };

  const handleSolveTaskFromBriefing = (taskId: string, payload: { solvedBy: string; solvedWhat: string; solvedWith: string }) => {
    update(d => {
      const solvedAt = stampTime().slice(0, 5);
      const checklist = d.checklist.map(t =>
        t.id === taskId
          ? { ...t, done: true, notDone: false, solvedBy: payload.solvedBy, solvedWhat: payload.solvedWhat, solvedWith: payload.solvedWith, solvedAt }
          : t
      );
      const findings = d.findings.map(f => ({
        ...f,
        checks: f.checks.map(c =>
          c.linkedTaskId === taskId
            ? { ...c, workflow: "resolved" as const, resolution: "resolved" as const, solvedBy: payload.solvedBy, solvedWhat: payload.solvedWhat, solvedWith: payload.solvedWith, solvedAt }
            : c
        ),
      }));
      return {
        ...d,
        checklist,
        findings,
        audit: [
          ...d.audit,
          ev({
            actor: payload.solvedBy,
            actorKind: "human",
            type: "task",
            action: "Closing task solved in Briefing",
            explanation: `${taskId}: ${payload.solvedWhat} · Solved with: “${payload.solvedWith}”.`,
          }),
        ],
      };
    });
  };

  const bulkInfo = (ids: Array<[string, string]>) => update(d => ({
    ...d,
    findings: d.findings.map(f => ({ ...f, checks: f.checks.map(c => (ids.some(([fi, ci]) => fi === f.id && ci === c.id) && bucketOf(c) === "info" && !c.obligation ? { ...c, workflow: "resolved" as const, resolution: "resolved" as const } : c)) })),
    audit: [...d.audit, ...ids.map(([fi, ci]) => ev({ actor: shift.outgoing, actorKind: "human", type: "resolved", action: "Finding resolved", findingId: fi, explanation: `${ci}: routine informational item (bulk).` }))],
  }));

  const acknowledge = () => update(d => ({
    ...d,
    acknowledged: true,
    acknowledgedAt: stampTime().slice(0, 5),
    findings: d.findings.map(f => ({ ...f, checks: f.checks.map(c => (c.workflow === "awaiting_ack" ? { ...c, workflow: "carried_forward" as const } : c)) })),
    audit: [...d.audit, ev({ actor: shift.incoming, actorKind: "human", type: "acknowledged", action: "Incoming shift acknowledged", explanation: `${shift.incoming} received the handover briefing and started the incoming shift.` })],
  }));

  const transferShift = () => {
    const actor = transferActor || `${shift.outgoing} → ${shift.incoming}`;
    api.resolveFinding({
      finding_id: "",
      action: "mark_accounted_for",
      rationale: `Shift transferred to next shift (${shift.incoming}).`,
      actor,
      shift_id: shiftId,
      sign_off_shift: true,
    }).catch(() => {});

    const time = stampTime().slice(0, 5);
    update(d => ({
      ...d,
      signedOff: true,
      signedOffAt: time,
      audit: [
        ...d.audit,
        ev({
          actor,
          actorKind: "human",
          type: "signoff",
          action: `Shift transferred to next shift (${shift.incoming})`,
          explanation: "All critical blockers resolved; tablet handed over to incoming shift lead.",
        }),
      ],
    }));
    setShowTransfer(false);
    setTab("briefing");
  };

  const reportDone = ["equipment", "stock", "cleaning", "cash", "customer"].filter(c => categoryComplete(data.report, c as "equipment", data.checklist)).length;
  const openChecks = data.findings.flatMap(f => f.checks).filter(c => bucketOf(c)).length;

  const NAV: Array<{ id: Tab; label: string; Icon: typeof ListChecks; meta?: string }> = [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { id: "report", label: "Finish your shift", Icon: ClipboardCheck, meta: data.submitted ? "Done" : `${reportDone}/5` },
    { id: "ledger", label: "Handover ledger", Icon: ListChecks, meta: data.submitted || openChecks > 0 ? String(openChecks) : "" },
    { id: "briefing", label: "Incoming briefing", Icon: ArrowRightLeft, meta: data.acknowledged ? "Ack" : String((data.schedules || []).length) },
    { id: "records", label: "Operational records", Icon: Database, meta: String(data.records.length + (data.schedules || []).length) },
    { id: "audit", label: "Audit log", Icon: ScrollText, meta: String(data.audit.length) },
  ];

  const goBlockers = () => {
    if (!data.submitted) { setTab("report"); return; }
    setTab("ledger");
    setSelectedFinding(so.blockers[0]?.finding.id ?? null);
  };

  const signTone = so.status === "signed_off" ? "success" : so.status === "ready" ? "success" : so.status === "blocked" ? "danger" : "neutral";
  const signLabel = { signed_off: "Transferred", ready: "Ready", blocked: "Blocked", not_submitted: "Report pending", not_started: "Not started" }[so.status];

  const transferActorOptions = Array.from(new Set([
    `${shift.outgoing} (Outgoing Lead)`,
    `${SUPERVISOR} (Supervisor)`,
    `${shift.incoming} (Incoming Lead)`,
    ...STAFF_NAMES,
  ]));

  if (showLoginScreen) {
    return (
      <ShiftLogin
        shiftId={shiftId}
        db={db}
        gemmaMode={gemmaMode}
        onToggleGemmaMode={() => setGemmaMode(m => (m === "live" ? "seeded" : "live"))}
        onStartShiftSession={handleStartShiftSession}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-emblem" aria-hidden="true">SG</span>
          <span className="brand-text">
            <span className="brand-name">ShiftGuard</span>
            <span className="brand-sub">{CAFE.name} · {CAFE.branch}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setGemmaMode(m => m === "live" ? "seeded" : "live")}
          title="Click to toggle between Live TokenFactory API and Recorded Run"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            background: "var(--paper-200)",
            padding: "4px 12px",
            borderRadius: "20px",
            border: "1px solid var(--paper-400)",
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--espresso-600)",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: isReconciling ? "var(--amber-600)" : gemmaMode === "live" ? "#16a34a" : "var(--ink-400)",
              display: "inline-block",
            }}
          />
          <span>
            Gemma 3-27B-IT {gemmaMode === "live" ? "Live via TokenFactory" : "Recorded via TokenFactory"}
            {isReconciling
              ? " · reconciling…"
              : data.gemmaTelemetry?.latencyMs
                ? ` · ${data.gemmaTelemetry.latencyMs}ms`
                : ""}
          </span>
        </button>

        <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="mono-small" style={{ color: "var(--ink-600)", background: "var(--paper-100)", border: "1px solid var(--paper-300)", padding: "4px 10px", borderRadius: "6px" }}>
            {SHIFT_TYPE_LABEL[shift.type]} Shift ({shift.start}–{shift.end}) · Lead: <strong>{shift.outgoing}</strong>
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowLoginScreen(true)}
            title="Return to POS Tablet Staff Login & Start Shift screen"
            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            <LogIn className="icon icon-sm" aria-hidden="true" />
            Switch Staff / Start Shift
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowExport(true)}>
            <Download className="icon icon-sm" aria-hidden="true" />Export
          </button>
        </div>
      </header>

      <div className="body-grid">
        <nav className="sidebar" aria-label="Workbench">
          <div className="sidebar-scroll">
            <p className="sidebar-heading">{SHIFT_TYPE_LABEL[shift.type]} · {shift.dayShort} {shift.dateLabel}</p>
            {NAV.map(({ id, label, Icon, meta }) => (
              <button key={id} type="button" className={`nav-item ${tab === id ? "is-active" : ""}`} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
                <Icon className="icon" aria-hidden="true" />
                <span className="nav-label">{label}</span>
                {meta && <span className="nav-meta">{meta}</span>}
              </button>
            ))}
          </div>

          <section className="signoff" aria-label="Shift transfer">
            <div className="signoff-head">
              <span className="section-label">Shift transfer</span>
              <Tag tone={signTone}>{signLabel}</Tag>
            </div>
            <ol className="signoff-steps">
              <li className={data.submitted ? "is-done" : ""}>Report {data.submitted ? `completed ${data.submittedAt}` : "not completed"}</li>
              <li className={data.submitted && so.blockers.length === 0 ? "is-done" : so.blockers.length ? "is-blocked" : ""}>
                {so.blockers.length} critical blocker{so.blockers.length === 1 ? "" : "s"}
              </li>
              <li className={so.tasks.length === 0 ? "is-done" : "is-blocked"}>
                {so.tasks.length} mandatory task{so.tasks.length === 1 ? "" : "s"} incomplete
              </li>
            </ol>
            {!data.signedOff && !so.ready && (
              <button type="button" className="link-btn" onClick={goBlockers}>{data.submitted ? "View blocking items" : "Go to shift report"}</button>
            )}
            <button
              type="button"
              className="btn btn-success btn-block"
              disabled={!so.ready || data.signedOff}
              onClick={() => {
                setTransferActor(`${shift.outgoing} (Outgoing Lead)`);
                setShowTransfer(true);
              }}
            >
              {data.signedOff ? `Transferred ${data.signedOffAt}` : "Transfer shift to next"}
            </button>
            {data.signedOff && nextShiftObj && (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "12px" }}
                onClick={() => {
                  switchShift(nextShiftObj.id);
                  setShowLoginScreen(true);
                }}
              >
                Start {SHIFT_TYPE_LABEL[nextShiftObj.type]} Shift Login ({nextShiftObj.outgoing})
                <ArrowRight className="icon icon-sm" aria-hidden="true" />
              </button>
            )}
          </section>
        </nav>

        <main className={`main ${tab === "ledger" && selectedFinding ? "main-flush" : ""}`}>
          {tab === "dashboard" && (
            <Dashboard
              shift={shift}
              shiftId={shiftId}
              db={db}
              justSubmitted={justSubmitted}
              onSelectShift={switchShift}
              onNavigate={t => { setJustSubmitted(false); setTab(t); }}
              onChangeStaff={handleChangeStaff}
              onRequestTransfer={() => {
                setTransferActor(`${shift.outgoing} (Outgoing Lead)`);
                setShowTransfer(true);
              }}
            />
          )}
          {tab === "report" && (
            <WorkerReport
              shift={shift}
              data={data}
              locked={locked}
              isReconciling={isReconciling}
              onReport={setReport}
              onSetTasks={setTasks}
              onSignIn={handleSignIn}
              onToggleEndHour={handleToggleEndHour}
              onChangeStaff={handleChangeStaff}
              onSubmit={submit}
              onOpenLedger={fid => {
                if (fid) setSelectedFinding(fid);
                setTab("ledger");
              }}
            />
          )}
          {tab === "ledger" && (
            <Ledger
              shift={shift}
              data={data}
              locked={locked}
              selectedId={selectedFinding}
              onSelect={setSelectedFinding}
              onAction={act}
              onBulkInfo={bulkInfo}
              onGoReport={() => setTab("report")}
              onOpenRecord={rid => {
                setSelectedRecordId(rid);
                setTab("records");
              }}
              onAddFinding={handleAddFinding}
            />
          )}
          {tab === "briefing" && (
            <Briefing
              shift={shift}
              data={data}
              locked={null}
              onStart={acknowledge}
              onChangeStaff={handleChangeStaff}
              onOpenFinding={fid => {
                setSelectedFinding(fid);
                setTab("ledger");
              }}
              onOpenRecord={rid => {
                setSelectedRecordId(rid);
                setTab("records");
              }}
              onOpenReport={() => setTab("report")}
              onSolveCheck={handleSolveCheckFromBriefing}
              onSolveTask={handleSolveTaskFromBriefing}
              onSaveSchedule={handleSaveSchedule}
              onCompleteSchedule={handleCompleteSchedule}
              onPromoteScheduleToIssue={handlePromoteScheduleToIssue}
            />
          )}
          {tab === "records" && (
            <Records
              key={shiftId}
              shift={shift}
              data={data}
              initialRecordId={selectedRecordId}
              onSaveSchedule={handleSaveSchedule}
              onDeleteSchedule={handleDeleteSchedule}
              onPromoteScheduleToIssue={item => {
                handlePromoteScheduleToIssue(item, item.notes || `Escalated from Operational Records: ${item.title}`, shift.outgoing);
                setTab("briefing");
              }}
              onUpdateRecordFields={handleUpdateRecordFields}
            />
          )}
          {tab === "audit" && <AuditLog events={allEvents} currentShiftId={shiftId} />}
        </main>
      </div>

      {showTransfer && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="so-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="so-title" className="modal-title">Transfer {SHIFT_TYPE_LABEL[shift.type].toLowerCase()} shift to next shift ({shift.incoming})?</h3>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setShowTransfer(false)}><X className="icon" aria-hidden="true" /></button>
            </div>
            <p className="modal-sub">
              No critical blockers or mandatory tasks remain. {data.findings.flatMap(f => f.checks).filter(c => c.workflow !== "resolved").length} item(s) carry into {shift.incoming}’s incoming briefing. The {SHIFT_TYPE_LABEL[shift.type].toLowerCase()} shift report becomes read-only and the POS tablet transitions to the incoming briefing.
            </p>
            <label className="field" style={{ marginBottom: "14px" }}>
              <span className="field-label">Transferred / Authorized by</span>
              <select className="input" value={transferActor} onChange={e => setTransferActor(e.target.value)}>
                {transferActorOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowTransfer(false)}>Cancel</button>
              <button type="button" className="btn btn-success" onClick={transferShift}>
                Transfer shift to {shift.incoming}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ex-title">
          <div className="modal-dialog modal-dialog-wide">
            <div className="modal-header">
              <h3 id="ex-title" className="modal-title">Shift export · {shift.id}</h3>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setShowExport(false)}><X className="icon" aria-hidden="true" /></button>
            </div>
            <pre className="modal-code-preview">{JSON.stringify({ shift, ...data }, null, 2)}</pre>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(JSON.stringify({ shift, ...data }, null, 2))}>Copy JSON</button>
              <button type="button" className="btn btn-primary" onClick={() => setShowExport(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
