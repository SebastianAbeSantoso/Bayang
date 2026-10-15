"""
server/test_stage_engine.py
---------------------------
Unit tests for deterministic stage engine in "The World's a Stage".
Tests spatial adjacency, blocked curtains, ghost dialogue rejection,
hazard physics, and rotten timber weight thresholds.

Run with: python server/test_stage_engine.py
"""

import sys
from stage_engine import StageEngine, INITIAL_CHARACTERS, STAGE_NODES


def test_spatial_adjacency():
    engine = StageEngine()
    # Julian starts at Node 1
    # Move to Node 2 is legal (connected)
    valid, reason = engine.validate_move("Julian", 2)
    assert valid, f"Expected move to Node 2 to be valid, got {reason}"

    # Move to Node 3 is legal (connected)
    valid, reason = engine.validate_move("Julian", 3)
    assert valid, f"Expected move to Node 3 to be valid, got {reason}"

    # Move to Node 5 is illegal (not adjacent to Node 1)
    valid, reason = engine.validate_move("Julian", 5)
    assert not valid, "Expected move to Node 5 to be rejected"
    assert "Spatial breach" in reason, f"Unexpected reason: {reason}"
    print("[PASS] Spatial adjacency enforcement verified.")


def test_blocked_route_intervention():
    engine = StageEngine()
    # Director blocks Route 1 -> 2
    success, msg = engine.apply_director_action("block_route", [1, 2])
    assert success, f"Failed to apply block_route: {msg}"
    assert engine.director_authority == 3
    assert [1, 2] in [list(e) for e in engine.blocked_edges]

    # Attempting to move across blocked edge must fail
    valid, reason = engine.validate_move("Vesper", 2)
    assert not valid, "Expected move across blocked route to fail"
    assert "Pathway blocked" in reason, f"Unexpected reason: {reason}"

    # Moving to alternative unblocked Node 3 must succeed
    valid, reason = engine.validate_move("Vesper", 3)
    assert valid, f"Expected move to Node 3 to succeed, got {reason}"
    print("[PASS] Director route blocking intervention verified.")


def test_ghost_speech_verification():
    engine = StageEngine()
    # Living character speech is valid
    valid, reason = engine.validate_speech("Beatrice")
    assert valid, f"Living character speech rejected: {reason}"

    # Kill character
    engine.characters["Beatrice"]["is_alive"] = False
    engine.characters["Beatrice"]["hp"] = 0

    # Deceased character speech must be caught and rejected
    valid, reason = engine.validate_speech("Beatrice")
    assert not valid, "Expected ghost dialogue to be rejected"
    assert "Ghost dialogue violation" in reason, f"Unexpected reason: {reason}"
    print("[PASS] Ghost dialogue verifier assertion verified.")


def test_rotten_timber_weight_trap():
    # 1. Unlit Crossing: Vesper (175 kg total) breaches 150 kg limit
    engine = StageEngine()
    res = engine.execute_turn_moves({"Julian": 2, "Vesper": 2})

    # Julian (70 kg) survives without structural collapse damage
    assert engine.characters["Julian"]["hp"] == 100, "Julian took unexpected damage"

    # Vesper (175 kg) causes structural breach and takes 45 damage
    assert engine.characters["Vesper"]["hp"] == 55, f"Vesper HP should be 55, got {engine.characters['Vesper']['hp']}"
    assert engine.characters["Vesper"]["contraband_weight"] == 0, "Contraband should be lost"
    assert any("STRUCTURAL BREACH" in ev for ev in res["hazard_events"])
    print("[PASS] Unlit weight limit collapse trap verified.")

    # 2. Spotlighted Crossing: Spotlight reveals rotted beams, saves Vesper from damage
    engine2 = StageEngine()
    engine2.apply_director_action("shift_spotlight", 2)
    res2 = engine2.execute_turn_moves({"Vesper": 2})

    # Vesper takes zero structural HP damage because spotlight warned her in time
    assert engine2.characters["Vesper"]["hp"] == 100, f"Vesper took damage despite spotlight: {engine2.characters['Vesper']['hp']}"
    assert engine2.characters["Vesper"]["contraband_weight"] == 0, "Contraband was safely abandoned"
    assert any("SPOTLIGHT WARNING" in ev for ev in res2["hazard_events"])
    print("[PASS] Spotlight mitigation on weight limit trap verified.")


def test_tension_dial_and_fog():
    engine = StageEngine()
    # Set high tension
    engine.apply_director_action("adjust_tension", 4.5)
    assert engine.tension_dial == 4.5

    # Move cast forward
    engine.execute_turn_moves({"Julian": 3, "Vesper": 3, "Beatrice": 3, "The Curator": 3})
    assert engine.scene_number == 2
    assert engine.fog_node == 1  # Station Platform now swallowed in fog

    # If someone stayed at Node 1 during turn 2, they get engulfed
    engine.characters["The Curator"]["node"] = 1
    res = engine.execute_turn_moves({"Julian": 4, "Vesper": 4, "Beatrice": 4, "The Curator": 1})
    assert any("THE WAILING FOG" in ev for ev in res["hazard_events"])
    print("[PASS] Tension dial and fog encroachment verified.")


if __name__ == "__main__":
    print("Running StageEngine Verification Tests...")
    test_spatial_adjacency()
    test_blocked_route_intervention()
    test_ghost_speech_verification()
    test_rotten_timber_weight_trap()
    test_tension_dial_and_fog()
    print("\nALL STAGE ENGINE TESTS PASSED CLEANLY!")
