"""
server/test_epistemic_engine.py
-------------------------------
Unit and verification test suite for the Epistemic Engine,
2x2 Dollhouse Stage, Theory of Mind memory isolation,
The Spotlight Rule, and Contradiction Detection.

Run with: python server/test_epistemic_engine.py
"""

from stage_engine import StageEngine, STAGE_CHAMBERS, CHAMBER_EDGES


def test_dollhouse_topology():
    engine = StageEngine()
    # Check 4 chambers present
    assert len(engine.chambers) == 4
    assert 1 in engine.chambers  # Telegraph
    assert 2 in engine.chambers  # Platform Gate
    assert 3 in engine.chambers  # Waiting Hall
    assert 4 in engine.chambers  # Boiler Room

    # Bilateral connectivity checks from Chamber 3 (Grand Waiting Hall)
    engine.characters["Julian"]["node"] = 3
    valid, _ = engine.validate_move("Julian", 1)  # From 3 to 1 is legal
    assert valid, "Expected move from Chamber 3 to Chamber 1 to be valid"

    valid, _ = engine.validate_move("Julian", 4)  # From 3 to 4 is legal
    assert valid, "Expected move from Chamber 3 to Chamber 4 to be valid"

    valid, reason = engine.validate_move("Julian", 2)  # From 3 to 2 has no direct edge
    assert not valid, "Expected diagonal move from 3 to 2 to be rejected"
    assert "Spatial breach" in reason
    print("[PASS] 2x2 Dollhouse topology and spatial adjacency verified.")


def test_spotlight_rule_and_accountability():
    engine = StageEngine()
    # Direct spotlight onto Chamber 3
    engine.characters["Julian"]["node"] = 3
    engine.spotlight_chamber = 3
    engine.spotlighted_nodes = [3]

    # Julian attempts covert crime in Chamber 3 under the spotlight
    intents = {
        "Julian": {
            "target_room": 3,
            "target_fixture": "hearth_stove",
            "action": "Burn the incriminating records in the embers.",
            "action_type": "BURN",
        }
    }
    res = engine.execute_room_turn(intents)
    assert any("aborted illicit action under the Director's Spotlight" in log for log in res["action_log"])
    # Crime must NOT be recorded in physical log as an executed crime
    crimes = [r for r in engine.physical_truth_log if r.get("is_crime")]
    assert len(crimes) == 0, "Covert crime should have been suppressed under spotlight"

    # Now shift spotlight to Chamber 1
    success, _ = engine.apply_director_action("shift_spotlight", 1)
    assert success
    assert engine.spotlight_chamber == 1

    # Julian now executes covert crime in Chamber 3 in the dark!
    res2 = engine.execute_room_turn(intents)
    assert any("[SHADOW ACTION]" in log for log in res2["action_log"])
    crimes2 = [r for r in engine.physical_truth_log if r.get("is_crime")]
    assert len(crimes2) == 1, "Covert crime should succeed in unlit chamber"
    print("[PASS] The Spotlight Rule (Gaze of Accountability) verified.")


def test_epistemic_memory_isolation_and_theory_of_mind():
    engine = StageEngine()
    # Move Vesper to Chamber 4 (Boiler Room) while Julian stays in Chamber 3
    engine.characters["Vesper"]["node"] = 4
    engine.characters["Julian"]["node"] = 3
    engine.spotlight_chamber = 1  # Both 3 and 4 are unlit

    # Vesper stashes contraband in the Boiler Room
    intents = {
        "Vesper": {
            "target_room": 4,
            "target_fixture": "smuggler_crate",
            "action": "Stash the contraband payload into the crate.",
            "action_type": "STEAL",
        },
        "Julian": {
            "target_room": 3,
            "target_fixture": "clock_tower",
            "action": "Checking the clock pendulum.",
            "action_type": "OBSERVE",
        },
    }
    engine.execute_room_turn(intents)

    # Julian's personal memory must NOT contain Vesper's crime
    julian_memories = [m["event"] for m in engine.actor_memories["Julian"]]
    for mem in julian_memories:
        assert "contraband payload" not in mem, "Julian should not have witnessed Vesper's secret crime in Room 4!"

    # Vesper's secret agenda should have progressed
    assert engine.characters["Vesper"]["secret_agenda"]["progress_pct"] > 0
    print("[PASS] Epistemic memory isolation and Theory of Mind verified.")


def test_contradiction_detection_engine():
    engine = StageEngine()
    engine.characters["Julian"]["node"] = 4  # Julian in Boiler Room
    engine.spotlight_chamber = 2

    # Tick 1: Julian burns records in Boiler Room
    intents = {
        "Julian": {
            "target_room": 4,
            "target_fixture": "steam_furnace",
            "action": "Burning dispatcher records in furnace.",
            "action_type": "BURN",
        }
    }
    # But Julian claims he was in Waiting Hall
    dialogue = [
        {"speaker": "Julian", "line": "I have been in the Grand Waiting Hall all along, warming my hands.", "intent": "LIE_ALIBI"}
    ]
    res = engine.execute_room_turn(intents, dialogue)

    # Contradiction engine should catch the lie!
    assert len(engine.evidence_contradictions) > 0, "Expected contradiction between alibi and physical log"
    contra = engine.evidence_contradictions[0]
    assert contra["actor"] == "Julian"
    assert "Waiting Hall" in contra["claim"]
    assert "Boiler Room" in contra["reality"]
    print(f"[PASS] Contradiction detected: {contra['claim']} vs {contra['reality']}")


def test_gate_unlocking_and_climax_accusation():
    engine = StageEngine()
    assert not engine.platform_unlocked

    # Beatrice is at Room 2 and unbolts the gate with spanner
    engine.characters["Beatrice"]["node"] = 2
    intents = {
        "Beatrice": {
            "target_room": 2,
            "target_fixture": "padlocked_gate",
            "action": "Applying machinist spanner to unbolt the iron gate.",
            "action_type": "UNBOLT_GATE",
        }
    }
    engine.execute_room_turn(intents)
    assert engine.platform_unlocked, "Gate should be unbolted by Beatrice"

    # Accuse wrong suspect
    success, msg = engine.accuse_suspect("Vesper")
    assert not success
    assert "FALSE ACCUSATION" in msg
    assert engine.status == "in_progress"

    # Accuse true traitor (Julian)
    success2, msg2 = engine.accuse_suspect("Julian")
    assert success2
    assert "CURTAIN CALL ACCUSATION SUCCESSFUL" in msg2
    assert engine.status == "won"
    print("[PASS] Gate unbolting and climax accusation verified.")


if __name__ == "__main__":
    print("Running Epistemic Engine Verification Tests...")
    test_dollhouse_topology()
    test_spotlight_rule_and_accountability()
    test_epistemic_memory_isolation_and_theory_of_mind()
    test_contradiction_detection_engine()
    test_gate_unlocking_and_climax_accusation()
    print("\nALL EPISTEMIC ENGINE TESTS PASSED CLEANLY!")
