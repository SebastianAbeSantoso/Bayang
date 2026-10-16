"""
Integration tests for ShiftGuard Cafe Shift-Handover Reconciliation HTTP API routes in server/app.py.
Tests /api/handover/state, /api/handover/select_shift, /api/handover/save_draft,
/api/handover/run, /api/handover/resolve, /api/handover/carryover, /api/handover/export, and /api/handover/reset.
"""

import json
import sys
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent
ROOT = SERVER_DIR.parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import BayangHandler


class TestHandoverAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), BayangHandler)
        cls.port = cls.server.server_port
        cls.base_url = f"http://127.0.0.1:{cls.port}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def _get_json(self, path: str):
        with urllib.request.urlopen(f"{self.base_url}{path}", timeout=5) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))

    def _post_json(self, path: str, payload: dict):
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            return err.code, json.loads(err.read().decode("utf-8"))

    def test_end_to_end_cafe_handover_api_lifecycle(self):
        # 1. Reset
        status, state = self._post_json("/api/handover/reset", {})
        self.assertEqual(status, 200)
        self.assertFalse(state["reconciled"])
        self.assertEqual(state["active_shift_id"], "shift_pm_01")

        # 2. Run seeded reconciliation
        status, state = self._post_json("/api/handover/run", {"mode": "seeded"})
        self.assertEqual(status, 200)
        self.assertTrue(state["reconciled"])
        self.assertEqual(len(state["claims"]), 3)
        self.assertEqual(len(state["findings"]), 6)

        # 3. Attempt override without rationale -> 400
        first_open = next(f for f in state["findings"] if f["status"] == "open")
        status, err = self._post_json(
            "/api/handover/resolve",
            {"finding_id": first_open["id"], "action": "override_with_rationale", "rationale": ""},
        )
        self.assertEqual(status, 400)
        self.assertIn("Supervisor note / written rationale is required", err["error"])

        # 4. Carry forward Rule 5 steam wand leak and resolve remaining open findings
        for f in state["findings"]:
            if f["status"] == "open":
                act = (
                    "carry_forward"
                    if f["rule_id"] == "RULE_05_INCIDENT_CARRYOVER"
                    else "override_with_rationale"
                )
                status, updated = self._post_json(
                    "/api/handover/resolve",
                    {
                        "finding_id": f["id"],
                        "action": act,
                        "rationale": f"Supervisor disposition for {f['id']}",
                        "owner_role": "Opening Shift Lead (Sari Wijaya)",
                        "due_time": "Before 07:00 morning rush",
                    },
                )
                self.assertEqual(status, 200)

        self.assertTrue(updated["signoff_gate"]["can_sign_off"])

        # 5. Sign off Afternoon shift
        status, signed = self._post_json(
            "/api/handover/resolve",
            {
                "finding_id": "",
                "action": "",
                "sign_off_shift": True,
                "actor": "Sari Wijaya (Supervisor)",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(signed["active_shift"]["status"], "closed_with_exceptions")

        # 6. Switch to Next Morning Shift (shift_am_02) and test Acknowledge vs Resolve
        status, am_state = self._post_json(
            "/api/handover/select_shift", {"shift_id": "shift_am_02"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(len(am_state["incoming_carryovers"]), 1)
        car_id = am_state["incoming_carryovers"][0]["id"]

        status, ack_state = self._post_json(
            "/api/handover/carryover",
            {"carryover_id": car_id, "action": "acknowledge"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(ack_state["incoming_carryovers"][0]["status"], "acknowledged")

        status, res_state = self._post_json(
            "/api/handover/carryover",
            {"carryover_id": car_id, "action": "resolve", "note": "Steam wand seal replaced."},
        )
        self.assertEqual(status, 200)
        self.assertEqual(res_state["incoming_carryovers"][0]["status"], "resolved")

        # 7. Export Markdown audit record
        with urllib.request.urlopen(
            f"{self.base_url}/api/handover/export?format=md&shift_id=shift_pm_01", timeout=5
        ) as resp:
            md_text = resp.read().decode("utf-8")
            self.assertEqual(resp.status, 200)
            self.assertIn("# ShiftGuard Handover Audit Record", md_text)
            self.assertIn("Kopi Kita Specialty Cafe - Kemang", md_text)


if __name__ == "__main__":
    unittest.main()
