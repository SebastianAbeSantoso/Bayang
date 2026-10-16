"""
server/test_stage_api.py
------------------------
Integration test for Stage Engine HTTP endpoints in server/app.py.
"""

import json
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer
from app import BayangHandler


def test_stage_api():
    port = 8011
    server = ThreadingHTTPServer(("127.0.0.1", port), BayangHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.5)

    base = f"http://127.0.0.1:{port}"

    try:
        # 1. GET /api/stage/init
        req = urllib.request.Request(f"{base}/api/stage/init")
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            assert data["scene_number"] == 1
            assert "characters" in data
            assert "Julian" in data["characters"]
            assert data["characters"]["Vesper"]["node"] == 1
            print("[PASS] GET /api/stage/init returned clean stage state.")

        # 2. POST /api/stage/director_action (Block route 1 -> 2)
        payload = {"verb": "block_route", "target": [1, 2]}
        req = urllib.request.Request(
            f"{base}/api/stage/director_action",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            assert data["success"] is True
            assert [1, 2] in data["stage_state"]["blocked_edges"]
            print("[PASS] POST /api/stage/director_action successfully dropped stage curtain.")

        # 3. POST /api/stage/turn (Turn 1: In-room exploration)
        turn_payload = {
            "director_action_summary": "Director dropped curtain on Route 1->2. Tension dial set to 3.0"
        }
        req = urllib.request.Request(
            f"{base}/api/stage/turn",
            data=json.dumps(turn_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            assert "script" in data
            assert "repairs" in data
            assert "telemetry" in data
            assert "stage_state" in data
            assert data["stage_state"]["scene_number"] == 1
            assert not data["turn_resolution"]["transitioned"], "Turn 1 should explore without instant exit"
            assert data["stage_state"]["room_progress"] > 15
            print(f"[PASS] POST /api/stage/turn executed Turn 1 exploration (Room {data['stage_state']['current_room_id']}).")

        # 4. POST /api/stage/turn (Turn 2: Consensus exit transition to Scene 2)
        req2 = urllib.request.Request(
            f"{base}/api/stage/turn",
            data=json.dumps(turn_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req2) as resp2:
            data2 = json.loads(resp2.read().decode("utf-8"))
            assert data2["stage_state"]["scene_number"] == 2
            assert data2["turn_resolution"]["transitioned"] is True
            assert data2["stage_state"]["current_room_id"] == 3  # Route 1->2 blocked, so bypassed to 3
            print(f"[PASS] POST /api/stage/turn executed Turn 2 consensus departure to Scene 2 (Room 3).")

        # 5. GET /api/stage/evidence (Evidence Board State)
        req3 = urllib.request.Request(f"{base}/api/stage/evidence")
        with urllib.request.urlopen(req3) as resp3:
            data3 = json.loads(resp3.read().decode("utf-8"))
            assert "alibis" in data3
            assert "contradictions" in data3
            assert "physical_truth" in data3
            print("[PASS] GET /api/stage/evidence returned complete Evidence Board dossier.")

        # 6. POST /api/stage/accuse (Climax Accusation)
        # Attempt accusation before gate unbolted
        accuse_payload = {"suspect_id": "Julian"}
        req4 = urllib.request.Request(
            f"{base}/api/stage/accuse",
            data=json.dumps(accuse_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req4) as resp4:
                data4 = json.loads(resp4.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            data4 = json.loads(err.read().decode("utf-8"))
            assert data4["success"] is False
            assert "portcullis" in data4["message"]
            print("[PASS] POST /api/stage/accuse rejected premature accusation before gate unbolted.")

    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    print("Testing Stage Engine HTTP API...")
    test_stage_api()
    print("\nALL STAGE HTTP API TESTS PASSED CLEANLY!")
