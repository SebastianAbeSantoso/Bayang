"""
server/test_stage_model.py
--------------------------
Unit and verification tests for the AI Stage Model Client and
Generate-Verify-Repair loop in "The World's a Stage".
"""

from stage_engine import StageEngine
from stage_model_client import generate_stage_turn, _validate_turn_script, compute_cost_usd


def test_ghost_dialogue_interception():
    stage = StageEngine()
    # Mark Julian as deceased
    stage.characters["Julian"]["is_alive"] = False

    # Simulate LLM script where Julian speaks
    bad_script = {
        "scene_title": "Scene I: The Phantom Echo",
        "narration": "The wind howls.",
        "dialogue": [
            {"speaker": "Julian", "line": "I can still see the tracks ahead!"},
            {"speaker": "Vesper", "line": "Keep moving, everyone."},
        ],
        "character_intents": {
            "Vesper": 2,
            "Beatrice": 3,
            "The Curator": 2,
        },
    }

    repairs = _validate_turn_script(stage, bad_script)
    assert len(repairs) > 0, "Expected repair for ghost dialogue"
    assert repairs[0]["rule"] == "Deceased State Synchronized"
    # Julian's dialogue must be stripped
    speakers = [d["speaker"] for d in bad_script["dialogue"]]
    assert "Julian" not in speakers, "Ghost dialogue was not removed"
    assert "Vesper" in speakers, "Living dialogue was incorrectly stripped"
    print("[PASS] Ghost dialogue interception and repair verified.")


def test_spatial_breach_interception():
    stage = StageEngine()
    # Julian is at Node 1. Simulate LLM script attempting to teleport Julian to Node 5
    bad_script = {
        "scene_title": "Scene I: The Impossible Leap",
        "narration": "Julian sprints recklessly.",
        "dialogue": [
            {"speaker": "Julian", "line": "I took a shortcut!"},
        ],
        "character_intents": {
            "Julian": 5,  # Illegal: Node 1 to Node 5 has no edge
            "Vesper": 2,  # Legal: Node 1 to Node 2
        },
    }

    repairs = _validate_turn_script(stage, bad_script)
    assert len(repairs) > 0, "Expected repair for spatial breach"
    assert repairs[0]["rule"] == "Spatial Adjacency Enforced"
    assert bad_script["character_intents"]["Julian"] in (2, 3), f"Julian was not rerouted to a legal node: {bad_script['character_intents']['Julian']}"
    assert bad_script["character_intents"]["Vesper"] == 2
    print("[PASS] Spatial breach interception and rerouting verified.")


def test_blocked_curtain_interception():
    stage = StageEngine()
    # Director blocks Route 1 -> 2
    stage.apply_director_action("block_route", [1, 2])

    # LLM tries to move Vesper to Node 2
    bad_script = {
        "scene_title": "Scene I: Through the Velvet",
        "narration": "Vesper charges forward.",
        "dialogue": [{"speaker": "Vesper", "line": "Nothing stops me."}],
        "character_intents": {
            "Vesper": 2,  # Blocked!
        },
    }

    repairs = _validate_turn_script(stage, bad_script)
    assert len(repairs) > 0, "Expected repair for blocked curtain"
    assert repairs[0]["rule"] == "Spatial Adjacency Enforced"
    assert bad_script["character_intents"]["Vesper"] == 3, f"Vesper should have been redirected to Node 3, got {bad_script['character_intents']['Vesper']}"
    print("[PASS] Blocked curtain interception verified.")


def test_generate_stage_turn_end_to_end():
    stage = StageEngine()
    summary = "Director dropped the curtain on Node 1 -> Node 2; Tension set to 3.0"
    script, repairs, telemetry = generate_stage_turn(stage, summary)

    assert "scene_title" in script
    assert "narration" in script
    assert "dialogue" in script
    assert "character_intents" in script
    assert "amd_cost_usd" in telemetry
    assert telemetry["savings_pct"] >= 90.0
    print(f"[PASS] End-to-end generate_stage_turn verified ({telemetry['total_tokens']} tokens, ${telemetry['amd_cost_usd']:.6f} AMD).")


if __name__ == "__main__":
    print("Running Stage Model & Verifier Tests...")
    test_ghost_dialogue_interception()
    test_spatial_breach_interception()
    test_blocked_curtain_interception()
    test_generate_stage_turn_end_to_end()
    print("\nALL STAGE MODEL TESTS PASSED CLEANLY!")
