/**
 * ShiftGuard API Client
 * Connects the React 19 UI to the Python backend running Google Gemma (AMD Token Factory)
 * and the deterministic verification engine.
 */

export interface SystemStatus {
  mode: "amd-configured" | "seeded-demo-ready";
  model: string;
}

export interface BackendSignoffGate {
  ready: boolean;
  status: "ready" | "blocked" | "ready_with_exceptions" | "closed" | "held";
  can_sign_off: boolean;
  blockers: Array<{ id: string; title: string; reason: string }>;
  held_count: number;
  open_critical_count: number;
  unacknowledged_carryovers: number;
}

export interface BackendFinding {
  id: string;
  shift_id: string;
  claim_id?: string | null;
  rule_id: string;
  rule_name: string;
  category: "equipment" | "inventory" | "sales" | "checklist" | "policy";
  severity: "critical" | "warning" | "info";
  evidence_status: "Supported" | "Contradicted" | "Not independently verified" | "Needs review";
  status: "open" | "reviewing" | "resolved" | "carried_forward" | "overridden" | "false_positive" | "held";
  title: string;
  reported_claim: string;
  quote_valid: boolean;
  author: string;
  system_result: string;
  explanation: string;
  unknowns: string;
  evidence_refs: Array<{
    source_type: string;
    record_id: string;
    label: string;
    occurred_at: string;
    detail: string;
  }>;
  ai_recommendation?: {
    recommended_owner: string;
    recommended_target: string;
    recommended_action: string;
    operational_hazard: string;
  };
  decision_history: Array<{
    decision_id: string;
    action: string;
    actor: string;
    rationale: string;
    occurred_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface BackendClaim {
  claim_id: string;
  claim_type: string;
  entity: string;
  action: string;
  quantity?: number;
  unit?: string;
  verbatim_quote: string;
  quote_valid: boolean;
  confidence: number;
}

export interface BackendBriefing {
  headline: string;
  narrative: string;
  facts: Array<{
    topic: string;
    headline: string;
    detail: string;
    action: string;
    source: string;
  }>;
  open_blockers_count: number;
  ice_delivery_eta?: string;
  generated_by: string;
  latency_ms: number;
}

export interface BackendState {
  product: string;
  cafe: { name: string; branch: string; timezone: string };
  active_shift_id: string;
  active_role: string;
  shifts_list: Array<{
    id: string;
    shift_label: string;
    outgoing_lead: string;
    incoming_lead: string;
    status: string;
  }>;
  active_shift: {
    id: string;
    shift_label: string;
    date: string;
    start_time: string;
    end_time: string;
    outgoing_lead: string;
    incoming_lead: string;
    status: string;
    default_worker_note?: string;
  };
  shift_report: {
    id: string;
    note_text: string;
    model_status: "not_run" | "live_gemma" | "seeded_fallback" | "error";
    model_name?: string;
    latency_ms?: number;
  };
  reconciled: boolean;
  claims: BackendClaim[];
  findings: BackendFinding[];
  signoff_gate: BackendSignoffGate;
  incoming_briefing: BackendBriefing;
  audit_events: Array<{
    id: string;
    shift_id: string;
    finding_id?: string | null;
    actor: string;
    action: string;
    rationale?: string;
    occurred_at: string;
  }>;
  reconciliation_meta: {
    mode: string;
    model: string;
    latency_ms: number;
    total_claims: number;
    flagged_count: number;
    clean_count: number;
    rejected_hallucinations: number;
  };
}

const BASE_URL = "";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || `HTTP error ${res.status}`);
  }
  return res.json();
}

export const api = {
  async getStatus(): Promise<SystemStatus> {
    return request<SystemStatus>("/api/status");
  },

  async getState(shiftId?: string): Promise<BackendState> {
    const q = shiftId ? `?shift_id=${encodeURIComponent(shiftId)}` : "";
    return request<BackendState>(`/api/handover/state${q}`);
  },

  async runReconciliation(params: {
    shift_id: string;
    shift_notes?: string;
    mode?: "live" | "seeded";
    actor?: string;
  }): Promise<BackendState> {
    return request<BackendState>("/api/handover/run", {
      method: "POST",
      body: JSON.stringify({
        shift_id: params.shift_id,
        shift_notes: params.shift_notes,
        mode: params.mode || "live",
        actor: params.actor,
      }),
    });
  },

  async resolveFinding(params: {
    finding_id: string;
    action: "mark_accounted_for" | "carry_forward" | "override_with_rationale" | "mark_false_positive" | "hold_and_escalate" | "resolve" | "override" | "false_positive" | "carry";
    rationale?: string;
    actor?: string;
    owner_role?: string;
    due_time?: string;
    shift_id?: string;
    sign_off_shift?: boolean;
  }): Promise<BackendState> {
    return request<BackendState>("/api/handover/resolve", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async carryoverFinding(params: {
    carryover_id: string;
    action: "acknowledge" | "resolve" | "update_note";
    actor?: string;
    note?: string;
    shift_id?: string;
  }): Promise<BackendState> {
    return request<BackendState>("/api/handover/carryover", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async saveDraft(params: {
    shift_id?: string;
    note_text?: string;
    checklist_updates?: Array<{ task_id: string; status: string; exception_reason?: string }>;
    stock_entry?: { entity: string; quantity: number; unit: string; note?: string };
    issue_entry?: { title: string; category?: string; urgency?: string; owner_role?: string };
    actor?: string;
  }): Promise<BackendState> {
    return request<BackendState>("/api/handover/save_draft", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async selectShift(shiftId: string, activeRole?: string): Promise<BackendState> {
    return request<BackendState>("/api/handover/select_shift", {
      method: "POST",
      body: JSON.stringify({ shift_id: shiftId, active_role: activeRole }),
    });
  },

  async reset(): Promise<BackendState> {
    return request<BackendState>("/api/handover/reset", { method: "POST" });
  },

  getExportUrl(shiftId: string, format: "json" | "md" = "json"): string {
    return `/api/handover/export?shift_id=${encodeURIComponent(shiftId)}&format=${format}`;
  },
};
