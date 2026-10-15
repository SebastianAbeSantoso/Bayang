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

    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    print("Testing Stage Engine HTTP API...")
    test_stage_api()
    print("\nALL STAGE HTTP API TESTS PASSED CLEANLY!")
