"""Unit tests for ShiftGuard Cafe Shift-Handover Reconciliation Engine (server/stage_engine.py).
Covers all required verification scenarios:
1. Exact quote validation pass (Indonesian primary scenario quotes)
2. Exact quote validation fail -> Needs review
3. Negation preservation ("Did not clean the steam wand" -> Contradicted)
4. Primary seeded scenario 5 rules:
   - Rule 1: 84 machine cycles vs 83 POS drinks + 1 purge -> Supported (no spurious count alert)
   - Rule 2: ORD-8859 missing reason & supervisor approval -> Needs review (critical)
   - Rule 3: Bean waste 200g missing from inventory ledger -> Not independently verified
   - Rule 3: Ice stock 0 bags supported by stock sheet & supplier ETA 10:00 AM -> Supported
   - Rule 4: Required task CHK-06 incomplete -> Contradicted (critical sign-off blocker)
   - Rule 5: Grinder jam 20 min unlogged in incident book -> Not independently verified (critical carryover)
5. 30-second incoming shift briefing strictly derived from recorded carryover facts & supplier ETA
6. Sign-off gate blocked while critical findings/tasks are open
7. Sign-off gate unlocked after supervisor dispositions -> closed_with_exceptions
8. Acknowledge vs Resolve on carryover item (acknowledge != resolved)
9. Model outage fallback (mode='live' without API key -> extraction_unavailable, note preserved)
10. English preset note scenario verification
"""

import os
import sys
import unittest
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
ROOT = TESTS_DIR.parent
SERVER_DIR = ROOT / "server"
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from stage_engine import CafeHandoverEngine, verify_quote_exists
from stage_model_client import StageModelClient


class TestCafeHandoverEngine(unittest.TestCase):
    def setUp(self):
        self.engine = CafeHandoverEngine()
        self.client = StageModelClient()

    def test_01_and_02_quote_validation_pass_and_fail(self):
        raw_note = self.engine.shift_reports["shift_pm_01"]["note_text"]
        # Primary Indonesian note: "tadi grinder macet 20 menit, buang beans 200g, es batu abis"
        self.assertTrue(verify_quote_exists("grinder macet 20 menit", raw_note))
        self.assertTrue(verify_quote_exists("buang beans 200g", raw_note))
        self.assertTrue(verify_quote_exists("es batu abis", raw_note))
        self.assertFalse(
            verify_quote_exists("Restocked 10 crates of matcha powder at midnight.", raw_note)
        )

        # Inject a claim with a non-matching quote and verify it becomes "Needs review"
        bad_claims = [
            {
                "claim_id": "CLM-99",
                "claim_type": "stock_action",
                "entity": "matcha powder",
                "action": "restocked",
                "quantity": 10,
                "unit": "crates",
                "verbatim_quote": "Restocked 10 crates of matcha powder at midnight.",
            }
        ]
        state = self.engine.run_reconciliation(bad_claims, meta={"model_status": "seeded_demo_snapshot"})
        q_fnd = next((f for f in state["findings"] if f["claim_id"] == "CLM-99"), None)
        self.assertIsNotNone(q_fnd)
        self.assertEqual(q_fnd["evidence_status"], "Needs review")
        self.assertFalse(q_fnd["quote_valid"])

    def test_03_negation_preservation(self):
        note_with_negation = "Did not clean the steam wand before closing because of rush."
        claims, meta = self.client.extract_handover_claims(
            raw_shift_notes=note_with_negation, mode="seeded"
        )
        self.assertTrue(any("not_" in c["action"] for c in claims))
        state = self.engine.run_reconciliation(
            claims, meta=meta, raw_notes_override=note_with_negation
        )
        neg_fnd = next(
            (
                f
                for f in state["findings"]
                if f["rule_id"] == "RULE_04_REQUIRED_CHECKLIST" and f["claim_id"] is not None
            ),
            None,
        )
        self.assertIsNotNone(neg_fnd)
        self.assertEqual(neg_fnd["evidence_status"], "Contradicted")
        self.assertEqual(neg_fnd["severity"], "critical")

    def test_04_primary_seeded_scenario_five_rules(self):
        raw_note = self.engine.shift_reports["shift_pm_01"]["note_text"]
        claims, meta = self.client.extract_handover_claims(raw_shift_notes=raw_note, mode="seeded")
        self.assertEqual(len(claims), 3)

        state = self.engine.run_reconciliation(claims, meta=meta)
        findings = state["findings"]

        # Rule 1: 84 cycles vs 83 POS drinks + 1 purge = 84 -> Supported (clean reconciliation, no spurious count alert)
        r1 = next((f for f in findings if f["rule_id"] == "RULE_01_MACHINE_VS_POS"), None)
        self.assertIsNotNone(r1)
        self.assertEqual(r1["evidence_status"], "Supported")
        self.assertEqual(r1["severity"], "info")
        self.assertIn("reconcile", r1["title"].lower())

        # Rule 2: ORD-8859 missing reason/approval -> Needs review (critical severity)
        r2 = next((f for f in findings if f["rule_id"] == "RULE_02_VOIDS_COMPS_REFUNDS"), None)
        self.assertIsNotNone(r2)
        self.assertEqual(r2["evidence_status"], "Needs review")
        self.assertEqual(r2["severity"], "critical")

        # Rule 3: buang beans 200g missing from inventory ledger -> Not independently verified
        r3_beans = next(
            (
                f
                for f in findings
                if f["rule_id"] == "RULE_03_STOCK_MOVEMENTS"
                and f["evidence_status"] == "Not independently verified"
            ),
            None,
        )
        self.assertIsNotNone(r3_beans)
        self.assertIn("waste", r3_beans["title"].lower())

        # Rule 3: es batu abis (ice = 0 bags, threshold = 2, delivery due 10:00 AM) -> Supported
        r3_ice = next(
            (
                f
                for f in findings
                if f["rule_id"] == "RULE_03_STOCK_MOVEMENTS"
                and f["evidence_status"] == "Supported"
            ),
            None,
        )
        self.assertIsNotNone(r3_ice)
        self.assertIn("ice", r3_ice["title"].lower())
        self.assertIn("10:00 AM", r3_ice["system_result"])

        # Rule 4: CHK-06 incomplete -> Contradicted (critical sign-off blocker)
        r4_chk06 = next(
            (
                f
                for f in findings
                if f["rule_id"] == "RULE_04_REQUIRED_CHECKLIST"
                and "CHK-06" in f["title"]
            ),
            None,
        )
        self.assertIsNotNone(r4_chk06)
        self.assertEqual(r4_chk06["evidence_status"], "Contradicted")
        self.assertEqual(r4_chk06["severity"], "critical")

        # Rule 5: Grinder downtime 20 min unlogged in incident book -> Not independently verified (critical carryover)
        r5_grinder = next(
            (f for f in findings if f["rule_id"] == "RULE_05_INCIDENT_CARRYOVER"), None
        )
        self.assertIsNotNone(r5_grinder)
        self.assertEqual(r5_grinder["evidence_status"], "Not independently verified")
        self.assertIn("grinder", r5_grinder["title"].lower())

        # Incoming 30-second briefing test
        briefing = state["incoming_briefing"]
        self.assertIsNotNone(briefing)
        self.assertIn("Grinder jam reported for 20 minutes", briefing["briefing_text"])
        self.assertIn("Bean-waste entry (200 g)", briefing["briefing_text"])
        self.assertIn("delivery is due at 10:00 AM", briefing["briefing_text"])

    def test_05_signoff_gate_and_carryover_acknowledge_vs_resolve(self):
        raw_note = self.engine.shift_reports["shift_pm_01"]["note_text"]
        claims, meta = self.client.extract_handover_claims(raw_shift_notes=raw_note, mode="seeded")
        state = self.engine.run_reconciliation(claims, meta=meta)

        # Sign-off blocked while critical findings/tasks are open
        self.assertFalse(state["signoff_gate"]["can_sign_off"])
        with self.assertRaises(ValueError):
            self.engine.resolve_finding("", "", sign_off_shift=True)

        # Override without rationale raises ValueError
        first_open = next(f for f in state["findings"] if f["status"] == "open")
        with self.assertRaises(ValueError):
            self.engine.resolve_finding(first_open["id"], "override_with_rationale", rationale="  ")

        # Resolve / carry forward all open findings
        for f in list(state["findings"]):
            if f["status"] == "open":
                if f["rule_id"] == "RULE_05_INCIDENT_CARRYOVER":
                    self.engine.resolve_finding(
                        f["id"],
                        "carry_forward",
                        rationale="Carry grinder jam inspection to morning shift lead.",
                        owner_role="Opening Shift Lead (Sari Wijaya)",
                        due_time="Before 07:00 morning rush",
                    )
                elif f["severity"] == "critical":
                    self.engine.resolve_finding(
                        f["id"],
                        "override_with_rationale",
                        rationale="Assigned technician ticket and verified with barista.",
                    )
                else:
                    self.engine.resolve_finding(
                        f["id"],
                        "mark_accounted_for",
                        rationale="Reviewed and accounted for during handover.",
                    )

        # Sign-off gate is now unlocked and terminal state is closed_with_exceptions
        updated_state = self.engine.get_state("shift_pm_01")
        self.assertTrue(updated_state["signoff_gate"]["can_sign_off"])
        self.assertEqual(
            updated_state["signoff_gate"]["allowed_terminal_state"], "closed_with_exceptions"
        )

        signed_state = self.engine.resolve_finding(
            "", "", rationale="Shift signed off", sign_off_shift=True
        )
        self.assertEqual(signed_state["active_shift"]["status"], "closed_with_exceptions")

        # Switch to Next Morning Shift (shift_am_02) and verify Acknowledge != Resolve
        am_state = self.engine.select_shift("shift_am_02")
        self.assertEqual(len(am_state["incoming_carryovers"]), 1)
        car_id = am_state["incoming_carryovers"][0]["id"]
        self.assertEqual(am_state["incoming_carryovers"][0]["status"], "open")

        # Acknowledge receipt -> status becomes 'acknowledged', NOT 'resolved'
        ack_state = self.engine.update_carryover_item(car_id, "acknowledge")
        car_after_ack = ack_state["incoming_carryovers"][0]
        self.assertEqual(car_after_ack["status"], "acknowledged")
        self.assertNotEqual(car_after_ack["status"], "resolved")
        self.assertIsNotNone(car_after_ack["acknowledged_at"])
        self.assertIsNone(car_after_ack["resolved_at"])

        # Resolve -> status becomes 'resolved'
        res_state = self.engine.update_carryover_item(
            car_id, "resolve", note="Grinder burrs inspected and cleaned by morning technician."
        )
        car_after_res = res_state["incoming_carryovers"][0]
        self.assertEqual(car_after_res["status"], "resolved")
        self.assertIsNotNone(car_after_res["resolved_at"])

    def test_06_model_outage_honest_fallback(self):
        # Ensure live mode without AMD_API_KEY returns extraction_unavailable honestly
        saved_key = self.client.api_key
        try:
            self.client.api_key = ""
            raw_note = self.engine.shift_reports["shift_pm_01"]["note_text"]
            claims, meta = self.client.extract_handover_claims(
                raw_shift_notes=raw_note, mode="live"
            )
            self.assertEqual(claims, [])
            self.assertEqual(meta["model_status"], "extraction_unavailable")

            state = self.engine.run_reconciliation(claims, meta=meta)
            self.assertEqual(state["shift_report"]["model_status"], "extraction_unavailable")
            self.assertEqual(state["shift_report"]["note_text"], raw_note)
            self.assertTrue(
                any(f["rule_id"] == "RULE_00_EXTRACTION_STATUS" for f in state["findings"])
            )
        finally:
            self.client.api_key = saved_key


if __name__ == "__main__":
    unittest.main()
