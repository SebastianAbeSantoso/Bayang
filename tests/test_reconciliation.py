"""
Automated unit tests for ShiftGuard Deterministic Engine & Quote Verifier.
Tests exact quote validation, 5 deterministic rules, signoff gate blockers,
and carryover state machine.
"""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

from stage_engine import CafeHandoverEngine, verify_quote_exists
from stage_model_client import StageModelClient


class TestQuoteVerification(unittest.TestCase):
    def setUp(self):
        self.note = (
            "Tadi grinder macet 20 menit pas jam 17, buang beans 200g house blend, "
            "es batu abis dari jam 18, gak sempet deep clean steam wand kanan karena antrian rame"
        )

    def test_exact_substring_passes(self):
        self.assertTrue(verify_quote_exists("grinder macet 20 menit", self.note))
        self.assertTrue(verify_quote_exists("buang beans 200g", self.note))
        self.assertTrue(verify_quote_exists("es batu abis dari jam 18", self.note))

    def test_hallucinated_quote_fails(self):
        self.assertFalse(verify_quote_exists("grinder motor overheating 45 minutes", self.note))
        self.assertFalse(verify_quote_exists("wasted 500g ethiopian beans", self.note))

    def test_short_quote_rejected(self):
        # Under 6 chars should be rejected to prevent trivial 1-word matches
        self.assertFalse(verify_quote_exists("abis", self.note))
        self.assertFalse(verify_quote_exists("tadi", self.note))


class TestDeterministicReconciliation(unittest.TestCase):
    def setUp(self):
        self.engine = CafeHandoverEngine()

    def test_initial_state(self):
        state = self.engine.get_state("shift_pm_01")
        self.assertEqual(state["active_shift_id"], "shift_pm_01")
        self.assertTrue("Cafe" in state["cafe"]["name"] or "Coffee" in state["cafe"]["name"])
        self.assertFalse(state["reconciled"])

    def test_reconciliation_executes_rules(self):
        # Seeded claims extracted by Gemma
        claims = [
            {
                "claim_id": "CLM-01",
                "claim_type": "equipment_anomaly",
                "entity": "Grinder #1 (Mahlkönig E65S)",
                "action": "jammed for 20 minutes",
                "verbatim_quote": "grinder macet 20 menit",
                "quote_valid": True,
                "confidence": 0.98,
            },
            {
                "claim_id": "CLM-02",
                "claim_type": "stock_waste",
                "entity": "House Blend beans",
                "action": "wasted",
                "quantity": 200,
                "unit": "g",
                "verbatim_quote": "buang beans 200g",
                "quote_valid": True,
                "confidence": 0.95,
            },
            {
                "claim_id": "CLM-03",
                "claim_type": "stock_depletion",
                "entity": "Ice",
                "action": "depleted",
                "verbatim_quote": "es batu abis",
                "quote_valid": True,
                "confidence": 0.97,
            },
        ]
        meta = {
            "mode": "live_gemma",
            "model_name": "google/gemma-3-27b-it",
            "latency_ms": 780,
        }

        state = self.engine.run_reconciliation(
            extracted_claims=claims,
            meta=meta,
            raw_notes_override="tadi grinder macet 20 menit, buang beans 200g, es batu abis",
            shift_id="shift_pm_01",
        )

        self.assertTrue(state["reconciled"])
        self.assertGreater(len(state["findings"]), 0)

        # Check signoff gate is initially blocked
        gate = state["signoff_gate"]
        self.assertFalse(gate["can_sign_off"])
        self.assertGreater(len(gate["blockers"]), 0)

    def test_override_requires_rationale(self):
        claims = [
            {
                "claim_id": "CLM-01",
                "claim_type": "equipment_anomaly",
                "entity": "Grinder #1 (Mahlkönig E65S)",
                "action": "jammed for 20 minutes",
                "verbatim_quote": "grinder macet 20 menit",
                "quote_valid": True,
                "confidence": 0.98,
            }
        ]
        self.engine.run_reconciliation(
            extracted_claims=claims,
            meta={"mode": "seeded", "model_name": "gemma", "latency_ms": 100},
            raw_notes_override="grinder macet 20 menit",
            shift_id="shift_pm_01",
        )

        findings = self.engine.findings_by_shift["shift_pm_01"]
        fnd_id = findings[0]["id"]

        # Override without rationale must raise ValueError
        with self.assertRaises(ValueError):
            self.engine.resolve_finding(
                finding_id=fnd_id,
                action="override_with_rationale",
                rationale="",
                actor="Supervisor",
            )

        # Override with rationale must succeed
        res = self.engine.resolve_finding(
            finding_id=fnd_id,
            action="override_with_rationale",
            rationale="Reviewed with bar team, burrs were cleaned and tested OK.",
            actor="Supervisor",
        )
        self.assertIsNotNone(res)

    def test_custom_notes_multi_presets(self):
        """Verify dynamic claim extraction and rule evaluation across diverse custom notes."""
        client = StageModelClient()

        # Preset 2 (English Closing Spoilage & Cash Shortage)
        note_en = "Oat milk 3 cartons expired dumped unlogged, cash drawer short by Rp 50.000 at close, espresso machine portafilter gasket leaking steam."
        claims, meta = client.extract_handover_claims(note_en, mode="seeded")
        self.assertGreaterEqual(len(claims), 3)
        for c in claims:
            self.assertTrue(verify_quote_exists(c["verbatim_quote"], note_en))

        state = self.engine.run_reconciliation(claims, meta=meta, raw_notes_override=note_en)
        rule_ids = {f["rule_id"] for f in state["findings"]}
        self.assertIn("RULE_02_CASH_VARIANCE", rule_ids)
        self.assertIn("RULE_03_STOCK_MOVEMENTS", rule_ids)
        self.assertIn("RULE_05_INCIDENT_CARRYOVER", rule_ids)

        # Preset 4 (Indonesian shorthand custom note)
        note_id = "Susu oat 3 karton basi dibuang, kasir kurang Rp 50.000"
        claims_id, meta_id = client.extract_handover_claims(note_id, mode="seeded")
        self.assertGreaterEqual(len(claims_id), 2)
        for c in claims_id:
            self.assertTrue(verify_quote_exists(c["verbatim_quote"], note_id))

        state_id = self.engine.run_reconciliation(claims_id, meta=meta_id, raw_notes_override=note_id)
        rule_ids_id = {f["rule_id"] for f in state_id["findings"]}
        self.assertIn("RULE_02_CASH_VARIANCE", rule_ids_id)
        self.assertIn("RULE_03_STOCK_MOVEMENTS", rule_ids_id)


if __name__ == "__main__":
    unittest.main()

