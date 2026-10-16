import React from "react";
import type { Availability, Evidence, Severity, Workflow } from "../data";
import { AVAILABILITY_LABEL, EVIDENCE_LABEL, SEVERITY_LABEL, WORKFLOW_LABEL } from "../data";

type Tone = "success" | "warning" | "danger" | "neutral" | "info" | "outline";

export function Tag({ tone = "neutral", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return <span className={`tag tag-${tone}`} title={title}>{children}</span>;
}

const SEV_TONE: Record<Severity, Tone> = { critical: "danger", review: "warning", info: "neutral" };
const EV_TONE: Record<Evidence, Tone> = { supported: "success", contradicted: "danger", unverified: "outline", conflicting: "warning" };
const AV_TONE: Record<Availability, Tone> = { available: "success", partial: "warning", missing: "danger", na: "outline" };

export const SeverityTag = ({ value }: { value: Severity }) => <Tag tone={SEV_TONE[value]}>{SEVERITY_LABEL[value]}</Tag>;
export const EvidenceTag = ({ value }: { value: Evidence }) => <Tag tone={EV_TONE[value]}>{EVIDENCE_LABEL[value]}</Tag>;
export const WorkflowTag = ({ value }: { value: Workflow }) => <Tag tone={value === "resolved" ? "success" : value === "open" ? "outline" : "info"}>{WORKFLOW_LABEL[value]}</Tag>;
export const AvailabilityTag = ({ value }: { value: Availability }) => <Tag tone={AV_TONE[value]}>{AVAILABILITY_LABEL[value]}</Tag>;

export function StatusDot({ tone }: { tone: string }) {
  return <span className={`status-dot status-dot-${tone}`} aria-hidden="true" />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-body">{body}</p>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h2 className="page-title">{title}</h2>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}
