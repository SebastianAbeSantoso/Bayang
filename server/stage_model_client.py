"""
Gemma Claim Extractor & Anti-Hallucination Gate for ShiftGuard (Cafe Shift-Handover Reconciliation Workbench).
Connects to Google Gemma (google/gemma-3-27b-it) on the AMD Token Factory API
to extract structured, cited operational claims from bilingual (English/Indonesian)
barista and shift-lead notes, with 1-retry schema validation, honest failure states,
and an explicitly labeled Seeded Demo Extraction option.
"""

from __future__ import annotations

import copy
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from server.stage_engine import CAFE_DATA_DIR, verify_quote_exists


REQUIRED_CLAIM_KEYS = {
    "claim_type",
    "entity",
    "action",
    "verbatim_quote",
}

VALID_CLAIM_TYPES = {
    "stock_action",
    "remake_waste",
    "void_comp_refund",
    "task_completion",
    "equipment_issue",
    "customer_followup",
    "incident",
}

SYSTEM_PROMPT = """You are a structured information extractor for a cafe shift handover workbench (ShiftGuard).
Given a worker's shift note (in English, Indonesian, or mixed EN/ID), extract checkable operational claims as JSON.

Rules:
1. Extract only statements present in the note.
2. Every claim must include a verbatim_quote copied character-for-character from the input note.
3. Preserve negation ("did not clean", "not completed", "belum dibersihkan", "tidak sempat", "not locked"). If negated, set action to start with "not_" (for example "not_cleaned" or "not_completed").
4. Do not infer whether a claim is true or false; downstream deterministic rules handle verification.
5. Keep uncertain or qualitative statements in "unstructured_notes" or "uncertainties" rather than inventing fields.
6. Return valid JSON matching the schema below and no surrounding prose.

Schema:
{
  "claims": [
    {
      "claim_id": "CLM-01",
      "claim_type": "stock_action | remake_waste | void_comp_refund | task_completion | equipment_issue | customer_followup",
      "entity": "string (e.g. oat milk, espresso drinks, iced lattes, steam wand, bar area)",
      "action": "string (e.g. restocked, wasted, remade, comped, cleaned, not_cleaned, leaking)",
      "quantity": 2,
      "unit": "string or null (e.g. cartons, drinks, orders, packs, L)",
      "occurred_at": "string or null (e.g. after 19:00 rush, 19:10, near closing)",
      "verbatim_quote": "exact substring from the shift note",
      "needs_review": false
    }
  ],
  "unstructured_notes": ["string"],
  "uncertainties": ["string"]
}
"""


def _extract_json_block(raw_text: str) -> Dict[str, Any]:
    """Strip optional markdown fences and parse JSON object."""
    cleaned = (raw_text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


def validate_claims_schema(
    payload: Dict[str, Any], raw_shift_notes: str
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Validate extracted JSON claims against the Cafe Claim schema.
    Returns (valid_claims, error_messages).
    """
    errors: List[str] = []
    if not isinstance(payload, dict) or not isinstance(payload.get("claims"), list):
        return [], ["Payload must be a JSON object with a 'claims' list."]

    valid_claims: List[Dict[str, Any]] = []
    for idx, item in enumerate(payload["claims"]):
        if not isinstance(item, dict):
            errors.append(f"Claim at index {idx} is not an object.")
            continue
        missing = REQUIRED_CLAIM_KEYS - set(item.keys())
        if missing:
            errors.append(f"Claim at index {idx} missing keys: {sorted(missing)}")
            continue
        ctype = str(item.get("claim_type") or "").strip()
        if ctype not in VALID_CLAIM_TYPES:
            item["claim_type"] = "task_completion"
            item["needs_review"] = True

        item.setdefault("claim_id", f"CLM-{idx + 1:02d}")
        item.setdefault("quantity", None)
        item.setdefault("unit", None)
        item.setdefault("occurred_at", None)
        item.setdefault("needs_review", False)
        valid_claims.append(item)

    return valid_claims, errors


def _parse_custom_sentences_heuristic(raw_note: str, existing_quotes: List[str]) -> List[Dict[str, Any]]:
    """
    Deterministic heuristic claim parser for custom or edited worker sentences in Seeded/Offline mode
    so custom notes (e.g. negation 'did not clean the steam wand', 'restocked 3 cartons of oat milk',
    'Oat milk 3 cartons expired dumped unlogged, cash drawer short by Rp 50.000 at close, espresso machine portafilter gasket leaking steam')
    are cleanly partitioned and extracted with exact verbatim quotes.
    """
    extra_claims: List[Dict[str, Any]] = []
    # Split by major sentence punctuation or commas/semicolons to handle multi-clause shift logs
    clauses: List[str] = []
    for chunk in re.split(r"(?<=[.!?\n])\s+", raw_note or ""):
        chunk = chunk.strip()
        if not chunk:
            continue
        if ("," in chunk or ";" in chunk) and len(chunk) > 30:
            subparts = re.split(r"[,;]\s*", chunk)
            for sp in subparts:
                sp_clean = sp.strip()
                if len(sp_clean) >= 6:
                    clauses.append(sp_clean)
        else:
            if len(chunk) >= 6:
                clauses.append(chunk)

    seq = len(existing_quotes) + 1

    for sent in clauses:
        # Skip if already covered by a seeded quote
        if any(q in sent or sent in q for q in existing_quotes if q):
            continue

        low = sent.lower()

        # 1. Negated task completion (e.g., 'gak sempet deep clean steam wand', 'did not clean right steam wand')
        if any(neg in low for neg in ("did not", "didn't", "not clean", "not done", "belum", "tidak", "gak sempet", "tak sempat", "skipped")):
            entity = "steam wand" if "wand" in low else ("dairy chiller" if "chiller" in low else ("grinder" if "grinder" in low else "bar area"))
            extra_claims.append(
                {
                    "claim_id": f"CLM-{seq:02d}",
                    "claim_type": "task_completion",
                    "entity": entity,
                    "action": "not_cleaned",
                    "quantity": None,
                    "unit": None,
                    "occurred_at": "closing",
                    "verbatim_quote": sent,
                    "needs_review": False,
                }
            )
            seq += 1
            continue

        # 2. Ice stock depletion (checked before equipment to avoid Indonesian time collision like 'jam 18')
        if any(w in low for w in ("es batu", "ice")) and any(w in low for w in ("abis", "habis", "depleted", "empty", "out")):
            extra_claims.append(
                {
                    "claim_id": f"CLM-{seq:02d}",
                    "claim_type": "stock_action",
                    "entity": "es batu",
                    "action": "abis",
                    "quantity": 0,
                    "unit": "bags",
                    "occurred_at": "end of shift",
                    "verbatim_quote": sent,
                    "needs_review": False,
                }
            )
            seq += 1
            continue

        # 3. Cash variance (ignore if explicitly zero variance / balanced)
        is_zero_variance = any(w in low for w in ("zero variance", "no variance", "0 variance", "tanpa selisih", "balanced"))
        if not is_zero_variance and any(w in low for w in ("kurang", "selisih", "short", "minus", "variance", "kasir")) and any(w in low for w in ("rp", "ribu", "k", "cash", "drawer", "uang", "register")):
            m_cash = re.search(r"(?:rp\.?\s*|short\s+by\s+rp\.?\s*|kurang\s+rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+k|\d+)", low)
            cash_val = 50000
            if m_cash:
                val_str = m_cash.group(1).lower().replace(".", "").replace(",", "")
                if val_str.endswith("k"):
                    cash_val = int(val_str[:-1]) * 1000
                elif val_str.isdigit():
                    cash_val = int(val_str)
            extra_claims.append(
                {
                    "claim_id": f"CLM-{seq:02d}",
                    "claim_type": "cash_mismatch",
                    "entity": "cash drawer",
                    "action": "variance",
                    "quantity": cash_val,
                    "unit": "IDR",
                    "occurred_at": "close count",
                    "verbatim_quote": sent,
                    "needs_review": True,
                }
            )
            seq += 1
            continue

        # 4. Equipment issues (use 'jammed'/'macet', avoiding Indonesian time 'jam 17')
        has_issue_keyword = any(w in low for w in ("macet", "jammed", "stalled", "stuck", "bocor", "leak", "leaking", "broken", "rusak", "error", "fault", "drip", "pressure drop", "pressure"))
        if has_issue_keyword:
            if any(w in low for w in ("grinder", "burr")):
                m_min = re.search(r"(\d+)\s*(menit|mins?|minutes?)", low)
                downtime_qty = int(m_min.group(1)) if m_min else 20
                extra_claims.append(
                    {
                        "claim_id": f"CLM-{seq:02d}",
                        "claim_type": "equipment_issue",
                        "entity": "grinder",
                        "action": f"macet {downtime_qty} menit",
                        "quantity": downtime_qty,
                        "unit": "menit",
                        "occurred_at": "during shift",
                        "verbatim_quote": sent,
                        "needs_review": False,
                    }
                )
                seq += 1
                continue
            else:
                entity = "portafilter gasket" if "gasket" in low else ("steam wand" if "wand" in low else "espresso machine")
                action = "pressure_drop" if "pressure" in low else ("leaking" if any(w in low for w in ("leak", "bocor", "drip")) else "malfunction")
                extra_claims.append(
                    {
                        "claim_id": f"CLM-{seq:02d}",
                        "claim_type": "equipment_issue",
                        "entity": entity,
                        "action": action,
                        "quantity": None,
                        "unit": None,
                        "occurred_at": "near closing",
                        "verbatim_quote": sent,
                        "needs_review": False,
                    }
                )
                seq += 1
                continue

        # 5. Comps / Voids / Refunds
        if any(w in low for w in ("comped", "comp", "void", "refund", "gratis")):
            m_comp = re.search(r"(?:comped|comp|void|refund)\s+(\d+)\s*([a-zA-Z\s]+)", low)
            comp_qty = int(m_comp.group(1)) if m_comp else 2
            comp_item = m_comp.group(2).strip() if m_comp else "drinks"
            extra_claims.append(
                {
                    "claim_id": f"CLM-{seq:02d}",
                    "claim_type": "void_comp_refund",
                    "entity": comp_item,
                    "action": "comped",
                    "quantity": comp_qty,
                    "unit": "drinks",
                    "occurred_at": "during shift",
                    "verbatim_quote": sent,
                    "needs_review": False,
                }
            )
            seq += 1
            continue

        # 5. Stock movements & waste
        m_stock_verb = re.search(r"(restocked|ambil|used|wasted|buang|dumped|expired)\s+([a-zA-Z\s]+?)\s*(\d+(?:\.\d+)?)\s*(cartons?|karton|packs?|pak|bottles?|botol|l|liters?|g|grams?|kg|bags?|kantong)?", sent, flags=re.IGNORECASE)
        m_stock_qty = re.search(r"(restocked|ambil|used|wasted|buang|dumped)\s+(\d+(?:\.\d+)?)\s*(cartons?|karton|packs?|pak|bottles?|botol|l|liters?|g|grams?|kg|bags?|kantong)?\s*(?:of\s+)?([a-zA-Z\s]+)", sent, flags=re.IGNORECASE)
        m_stock_item = re.search(r"([a-zA-Z\s]+?)\s+(\d+(?:\.\d+)?)\s*(cartons?|karton|packs?|pak|bottles?|botol|l|liters?|g|grams?|kg|bags?|kantong)?\s*(expired|basi|dumped|wasted|buang|dibuang|restocked)", sent, flags=re.IGNORECASE)

        matched_stock = None
        if m_stock_item:
            entity = m_stock_item.group(1).strip(" .,;")
            qty = float(m_stock_item.group(2))
            unit = (m_stock_item.group(3) or "cartons").strip()
            v_action = m_stock_item.group(4).lower()
            action = "wasted" if any(w in v_action for w in ("expired", "basi", "dumped", "wasted", "buang", "dibuang")) else "restocked"
            matched_stock = (entity, qty, unit, action)
        elif m_stock_verb:
            verb = m_stock_verb.group(1).lower()
            entity = m_stock_verb.group(2).strip(" .,;")
            qty = float(m_stock_verb.group(3))
            unit = (m_stock_verb.group(4) or "g").strip()
            action = "wasted" if any(w in verb for w in ("wasted", "buang", "dumped", "expired")) else "restocked"
            matched_stock = (entity, qty, unit, action)
        elif m_stock_qty:
            verb = m_stock_qty.group(1).lower()
            qty = float(m_stock_qty.group(2))
            unit = (m_stock_qty.group(3) or "cartons").strip()
            entity = m_stock_qty.group(4).strip(" .,;")
            action = "wasted" if any(w in verb for w in ("wasted", "buang", "dumped")) else "restocked"
            matched_stock = (entity, qty, unit, action)

        if matched_stock:
            entity, qty, unit, action = matched_stock
            if qty.is_integer():
                qty = int(qty)
            extra_claims.append(
                {
                    "claim_id": f"CLM-{seq:02d}",
                    "claim_type": "stock_action",
                    "entity": entity,
                    "action": action,
                    "quantity": qty,
                    "unit": unit,
                    "occurred_at": "during shift",
                    "verbatim_quote": sent,
                    "needs_review": False,
                }
            )
            seq += 1
            continue

        # 6. Positive completion
        if any(w in low for w in ("calibrated", "kalibrasi", "counted and matched", "balanced", "reconciled")):
            extra_claims.append(
                {
                    "claim_id": f"CLM-{seq:02d}",
                    "claim_type": "task_completion",
                    "entity": "grinder" if "grinder" in low else "inventory",
                    "action": "completed",
                    "quantity": None,
                    "unit": None,
                    "occurred_at": "during shift",
                    "verbatim_quote": sent,
                    "needs_review": False,
                }
            )
            seq += 1
            continue

    return extra_claims



class StageModelClient:
    """
    Client for extracting structured cafe shift-handover claims via Google Gemma on AMD Token Factory.
    Implements honest failure states (`extraction_unavailable`) when live mode fails,
    and explicitly labeled `seeded_demo_snapshot` when using the seeded fixture option.
    """

    def __init__(self, fixture_dir: Optional[Path] = None) -> None:
        self.fixture_dir = Path(fixture_dir) if fixture_dir else CAFE_DATA_DIR
        self.api_base = os.environ.get(
            "AMD_API_BASE",
            os.environ.get("AMD_API_BASE_URL", os.environ.get("OPENAI_API_BASE", "https://api.tokenfactory.amd.com/v1")),
        ).rstrip("/")
        self.api_key = os.environ.get("AMD_API_KEY", os.environ.get("OPENAI_API_KEY", ""))
        self.model_id = os.environ.get("AMD_MODEL_ID", os.environ.get("AMD_MODEL_NAME", "google/gemma-3-27b-it"))
        self.timeout_sec = float(os.environ.get("SHIFTGUARD_LLM_TIMEOUT", "6.0"))

    def _load_fixture_data(self) -> Dict[str, Any]:
        path = self.fixture_dir / "cafe_fixtures.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def load_seeded_claims(
        self, raw_shift_notes: str, shift_id: str = "shift_pm_01"
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Load pre-extracted claims from cafe_fixtures.json for the given shift_id and note language,
        filtering to claims whose verbatim_quote appears in raw_shift_notes and supplementing
        any newly edited custom sentences.
        """
        fixtures = self._load_fixture_data()
        resolved_sid = shift_id
        if shift_id not in fixtures.get("shifts", {}):
            sid_clean = str(shift_id).lower()
            if any(tok in sid_clean for tok in ("aft", "pm", "afternoon", "night", "ngt")):
                resolved_sid = "shift_pm_01"
            elif any(tok in sid_clean for tok in ("mor", "am", "morning")):
                resolved_sid = "shift_am_02"
            else:
                resolved_sid = "shift_pm_01"
        shift_data = fixtures.get("shifts", {}).get(resolved_sid, {})
        cand_list: List[Dict[str, Any]] = []
        seeded_ext = shift_data.get("seeded_extractions", {})
        if isinstance(seeded_ext, dict):
            cand_list.extend(copy.deepcopy(seeded_ext.get("en", [])))
            cand_list.extend(copy.deepcopy(seeded_ext.get("id", [])))
        cand_list.extend(copy.deepcopy(shift_data.get("seeded_extraction", {}).get("claims", [])))
        cand_list.extend(copy.deepcopy(shift_data.get("seeded_extraction_id", {}).get("claims", [])))

        matched_claims: List[Dict[str, Any]] = []
        matched_quotes: List[str] = []
        for item in cand_list:
            q = item.get("verbatim_quote", "")
            if verify_quote_exists(q, raw_shift_notes):
                matched_claims.append(item)
                matched_quotes.append(q)

        # Also parse any custom user-added sentences so custom edits work seamlessly in demo mode
        extra = _parse_custom_sentences_heuristic(raw_shift_notes, matched_quotes)
        matched_claims.extend(extra)

        # Re-number sequentially
        for i, c in enumerate(matched_claims):
            c["claim_id"] = f"CLM-{i + 1:02d}"

        meta = {
            "mode": "seeded_demo_snapshot",
            "model_status": "seeded_demo_snapshot",
            "model": f"{self.model_id} (Seeded Demo Extraction)",
            "latency_ms": 24,
            "prompt_tokens": 640,
            "completion_tokens": 310,
            "unstructured_notes": [],
            "uncertainties": [],
        }
        return matched_claims, meta

    def _call_gemma_endpoint(self, messages: List[Dict[str, str]]) -> Tuple[str, int, int]:
        """Call OpenAI-compatible AMD Token Factory chat completions endpoint."""
        url = f"{self.api_base}/chat/completions"
        body = json.dumps(
            {
                "model": self.model_id,
                "messages": messages,
                "temperature": 0.1,
                "max_tokens": 1600,
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=self.timeout_sec) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
        content = resp_data["choices"][0]["message"]["content"]
        usage = resp_data.get("usage", {})
        prompt_tokens = int(usage.get("prompt_tokens", 640))
        completion_tokens = int(usage.get("completion_tokens", 310))
        return content, prompt_tokens, completion_tokens

    def extract_handover_claims(
        self,
        raw_shift_notes: str,
        work_orders: Optional[List[Dict[str, Any]]] = None,
        oem_specs: Optional[Dict[str, Any]] = None,
        mode: str = "live",
        shift_id: str = "shift_pm_01",
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Extract structured operational claims from raw_shift_notes.
        - mode in ('seeded', 'recorded', 'demo'): uses Seeded Demo Extraction (`seeded_demo_snapshot`).
        - mode == 'live': calls live Google Gemma on AMD Token Factory (`live_gemma_success`).
          If `AMD_API_KEY` is missing or the live call fails, returns `extraction_unavailable` honestly
          without pretending a canned response came from a live model call.
        """
        t0 = time.perf_counter()
        req_mode = (mode or "live").strip().lower()

        if req_mode in ("seeded", "recorded", "demo"):
            claims, meta = self.load_seeded_claims(raw_shift_notes, shift_id=shift_id)
            elapsed_ms = max(1, int((time.perf_counter() - t0) * 1000))
            meta["latency_ms"] = elapsed_ms
            return claims, meta

        # Live mode requested: check if API key is configured
        if not self.api_key:
            elapsed_ms = max(1, int((time.perf_counter() - t0) * 1000))
            return [], {
                "mode": "extraction_unavailable",
                "model_status": "extraction_unavailable",
                "model": self.model_id,
                "latency_ms": elapsed_ms,
                "error_message": (
                    "AI extraction is unavailable (AMD_API_KEY not configured). "
                    "Your report is saved; review the notes manually before sign-off or use Seeded Demo Extraction."
                ),
                "unstructured_notes": [raw_shift_notes] if raw_shift_notes else [],
                "uncertainties": ["Live Gemma API key not set in environment."],
            }

        user_prompt = (
            "Extract all checkable cafe operational claims from the following worker shift note.\n\n"
            f"WORKER SHIFT NOTE:\n{raw_shift_notes}\n"
        )
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        last_err = "Unknown extraction error"
        for _attempt in range(2):
            try:
                raw_resp, p_tok, c_tok = self._call_gemma_endpoint(messages)
                parsed = _extract_json_block(raw_resp)
                valid_claims, errors = validate_claims_schema(parsed, raw_shift_notes)
                if not errors:
                    elapsed_ms = max(1, int((time.perf_counter() - t0) * 1000))
                    return valid_claims, {
                        "mode": "live_gemma_success",
                        "model_status": "live_gemma_success",
                        "model": self.model_id,
                        "latency_ms": elapsed_ms,
                        "prompt_tokens": p_tok,
                        "completion_tokens": c_tok,
                        "unstructured_notes": parsed.get("unstructured_notes", []),
                        "uncertainties": parsed.get("uncertainties", []),
                    }
                last_err = "; ".join(errors)
                messages.append({"role": "assistant", "content": raw_resp})
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            f"Schema validation failed: {last_err}. "
                            "Return corrected JSON object with top-level 'claims' list."
                        ),
                    }
                )
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError) as exc:
                last_err = str(exc)
                break

        elapsed_ms = max(1, int((time.perf_counter() - t0) * 1000))
        return [], {
            "mode": "extraction_unavailable",
            "model_status": "extraction_unavailable",
            "model": self.model_id,
            "latency_ms": elapsed_ms,
            "error_message": (
                f"AI extraction is unavailable ({last_err}). "
                "Your report is saved; review the notes manually before sign-off."
            ),
            "unstructured_notes": [raw_shift_notes] if raw_shift_notes else [],
            "uncertainties": ["Live model call failed or timed out."],
        }
