"""HTTP integration test for Bayang's full server endpoints."""
import json
import os
import sys
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

from app import BayangHandler, ThreadingHTTPServer

TEST_PORT = 8991


def run_test():
    server = ThreadingHTTPServer(("127.0.0.1", TEST_PORT), BayangHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.3)

    base = f"http://127.0.0.1:{TEST_PORT}"

    # 1. Check /api/status
    with urllib.request.urlopen(f"{base}/api/status") as res:
        status_data = json.loads(res.read())
        assert "mode" in status_data
        assert "model" in status_data
        print("[PASS] /api/status responds correctly.")

    # 2. Check /api/samples
    with urllib.request.urlopen(f"{base}/api/samples") as res:
        samples_data = json.loads(res.read())
        assert len(samples_data["samples"]) >= 2
        sample_csv = samples_data["samples"][1]["csv"]
        print("[PASS] /api/samples returned sample ledgers.")

    # 2b. Test /api/inspect_headers
    req = urllib.request.Request(
        f"{base}/api/inspect_headers",
        data=json.dumps({"csv": sample_csv}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        insp_data = json.loads(res.read())
        assert "fieldnames" in insp_data
        assert "suggested" in insp_data
        assert "preview_rows" in insp_data
        print("[PASS] /api/inspect_headers provides schema suggestions and row previews.")

    # 3. Post /api/profile
    req = urllib.request.Request(
        f"{base}/api/profile",
        data=json.dumps({"csv": sample_csv}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        profile_res = json.loads(res.read())
        case_id = profile_res["case_id"]
        assert "groups" in profile_res["case"]
        assert profile_res["case"]["ranking_differs"] is True
        assert "schema_mapping" in profile_res["case"]
        print(f"[PASS] /api/profile initialized case: {case_id[:8]}... with ranking_differs=True.")

    # 4. Post /api/quest
    req = urllib.request.Request(
        f"{base}/api/quest",
        data=json.dumps({"case_id": case_id, "mode": "apprentice"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        quest_res = json.loads(res.read())
        quest = quest_res["quest"]
        assert "private_referee" not in quest
        assert "attempts" in quest
        assert "cost" in quest
        assert quest["ranking_differs"] is True
        print("[PASS] /api/quest returned sealed quest with verification telemetry.")

    # 5. Post /api/investigate (outliers)
    req = urllib.request.Request(
        f"{base}/api/investigate",
        data=json.dumps({"case_id": case_id, "action": "outliers"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        inv_res = json.loads(res.read())
        assert "evidence" in inv_res
        assert inv_res["progress"] == 1
        assert inv_res["ready_to_decide"] is False
        print("[PASS] /api/investigate outliers returned mathematical anomaly analysis.")

    # 6. Post /api/investigate (rates)
    req = urllib.request.Request(
        f"{base}/api/investigate",
        data=json.dumps({"case_id": case_id, "action": "rates"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        inv_res = json.loads(res.read())
        assert inv_res["progress"] == 2
        assert inv_res["ready_to_decide"] is True
        assert "equalized_exposure" in inv_res["evidence"]
        assert any("projected_events" in r for r in inv_res["evidence"]["rows"])
        print("[PASS] /api/investigate rates completed 2-step unlock threshold with equalized exposure.")

    # 7. Post /api/guide
    req = urllib.request.Request(
        f"{base}/api/guide",
        data=json.dumps({"case_id": case_id, "question": "What does rate measure?"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        guide_res = json.loads(res.read())
        assert "reply" in guide_res
        assert guide_res["remaining"] == 1
        print("[PASS] /api/guide provided isolated methodological advice.")

    # 8. Post /api/answer (verdict with risk_density)
    # Glasswood Trail highest rate group is "Ashen Pass"
    req = urllib.request.Request(
        f"{base}/api/answer",
        data=json.dumps({"case_id": case_id, "group": "Ashen Pass", "rationale": "risk_density"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        ans_res = json.loads(res.read())
        assert ans_res["correct"] is True
        assert "consequence" in ans_res
        assert "Ashen Pass" in ans_res["consequence"] or "marshals" in ans_res["consequence"]
        print("[PASS] /api/answer validated finding and generated realm consequence.")

    server.shutdown()
    print("\nALL HTTP ENDPOINTS VERIFIED END-TO-END!")


if __name__ == "__main__":
    run_test()
