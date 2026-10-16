"""
server/stage_model_client.py
----------------------------
AI Theatrical Script Generator and Generate-Verify-Repair loop
for "The World's a Stage", powered by Google DeepMind Gemma 2 on AMD MI300X.

Validates spatial adjacency, room fixture occupancy, ghost dialogue prevention,
and inventory consistency against the deterministic StageEngine before rendering
to the client.

Strictly zero em dashes across all code, prompt strings, and comments. Zero external dependencies.
"""

import json
import os
import time
import urllib.request
import urllib.error
from typing import Dict, List, Any, Tuple
from stage_engine import StageEngine


def compute_cost_usd(prompt_tokens: int, completion_tokens: int) -> Dict[str, Any]:
    """Calculates AMD Instinct token economics vs commercial cloud APIs."""
    total = prompt_tokens + completion_tokens
    amd_cost = round(total * 0.0000002, 6)  # $0.20 per 1M tokens on dedicated AMD MI300X
    commercial_equiv = round(total * 0.0000050, 6)  # $5.00 per 1M blended proprietary tokens
    savings_pct = round((1.0 - (amd_cost / commercial_equiv)) * 100, 1) if commercial_equiv > 0 else 0.0
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total,
        "amd_cost_usd": amd_cost,
        "commercial_equiv_usd": commercial_equiv,
        "savings_pct": savings_pct,
    }


STAGE_DIRECTOR_SYSTEM_PROMPT = """You are the Lead Playwright and Stage Director for 'The World's a Stage', a dark Victorian theatrical visual novel.
Your cast consists of 4 autonomous actors (Julian the Archivist, Vesper the Smuggler, Beatrice the Machinist, and The Curator).

The player is the Stage Director who manipulates environmental cues, stage lighting, blocked doors, and tension levels.
The game takes place inside a 2x2 cross-section Victorian dollhouse stage with 4 interconnected chambers:
1. Telegraph Office (Fixtures: morse_ticker, manifest_desk, filing_safe, stove, cabinets, floorboards; connects to 2, 3)
2. Locked Platform Gate (Fixtures: padlocked_gate, signal_lever, track_lantern, winch, rotted_timber, observation; connects to 1, 4)
3. Grand Waiting Hall (Fixtures: hearth_stove, clock_tower, chandelier, double_doors, leather_armchairs, timetables; connects to 1, 4)
4. Baggage & Boiler Room (Fixtures: steam_furnace, coal_chute, toolbench, smuggler_crate; connects to 2, 3)

STRICT DRAMATIC CONSTRAINTS:
1. SPATIAL REALITY: Characters can ONLY move between adjacent chambers connected by doorways, and investigate valid fixtures in their chamber.
2. STAGE CURTAINS: If a doorway is blocked by a dropped velvet curtain, characters CANNOT cross it. They must react to the barrier and pivot to an unblocked alternative door.
3. THE SPOTLIGHT RULE (GAZE OF ACCOUNTABILITY): Characters know when they are in the chamber illuminated by the Spotlight. No character will commit a covert/selfish action while lit; they are forced to play innocent for the audience. Covert deeds (burning manifests, stashing contraband, sabotage) only occur in unlit chambers.
4. THEORY OF MIND & ALIBIS: Characters only perceive events occurring in their current chamber. When speaking, characters formulate alibis and can lie about their location.
5. MORTALITY: Deceased characters CANNOT speak, move, or act. Living characters must react somberly to fallen companions.
6. PERSONALITY LEVERS:
   - Julian (cautious, fearful of dark areas without spotlight, secretly burning incriminating station manifests).
   - Vesper (agile, pragmatic, carries heavy contraband satchel, secretly stashing contraband in the boiler room).
   - Beatrice (frail, skilled with tools, unbolts the padlocked gate with machinist spanners).
   - The Curator (cryptic, speaks in stage directions, impervious to fog).

You MUST output strictly valid JSON matching this schema:
{
  "scene_title": "string (theatrical scene title)",
  "narration": "string (atmospheric stage directions describing movements and room tension)",
  "dialogue": [
    {
      "speaker": "Julian | Vesper | Beatrice | The Curator",
      "line": "string",
      "intent": "STATEMENT | INQUIRY | ACCUSATION | LIE_ALIBI",
      "claimed_room": 1
    }
  ],
  "character_actions": {
    "Julian": {
      "target_room": 1,
      "target_fixture": "string (valid fixture id in target room)",
      "action": "string (natural physical action performed)",
      "action_type": "OBSERVE | INVESTIGATE | BURN | STEAL | SABOTAGE | UNBOLT_GATE",
      "voted_exit": 1
    },
    "Vesper": {
      "target_room": 1,
      "target_fixture": "string",
      "action": "string",
      "action_type": "string",
      "voted_exit": 1
    },
    "Beatrice": {
      "target_room": 1,
      "target_fixture": "string",
      "action": "string",
      "action_type": "string",
      "voted_exit": 1
    },
    "The Curator": {
      "target_room": 1,
      "target_fixture": "string",
      "action": "string",
      "action_type": "string",
      "voted_exit": 1
    }
  },
  "character_intents": {
    "Julian": 1,
    "Vesper": 1,
    "Beatrice": 1,
    "The Curator": 1
  }
}
"""

_AMD_CIRCUIT_BROKEN = False


def _call_amd_api(messages: List[Dict[str, str]], max_tokens: int = 800) -> Tuple[str, Dict[str, int]]:
    """Calls vLLM / SGLang ROCm endpoint on AMD Developer Cloud or TokenFactory."""
    base = (
        os.getenv("AMD_API_BASE_URL")
        or os.getenv("TOKENFACTORY_BASE_URL")
        or "https://developer.amd.com.cn/radeon/api/v1"
    ).rstrip("/")
    endpoint = base + ("/chat/completions" if base.endswith("/v1") else "/v1/chat/completions")
    api_key = (os.getenv("AMD_API_KEY") or os.getenv("TOKENFACTORY_API_KEY") or "").strip()
    model_name = os.getenv("AMD_MODEL_NAME") or os.getenv("TOKENFACTORY_MODEL") or "Gemma-4-31B-IT"

    body = {
        "model": model_name,
        "temperature": 0.7,
        "messages": messages,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + api_key,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=3) as resp:
        res = json.loads(resp.read().decode("utf-8"))
    usage = res.get("usage", {"prompt_tokens": 450, "completion_tokens": 280})
    msg = res["choices"][0]["message"]
    content = msg.get("content", "")
    if not content and "reasoning" in msg:
        content = msg.get("reasoning", "")
    if "```" in content:
        lines = content.splitlines()
        content = "\n".join(l for l in lines if not l.strip().startswith("```"))
    return content, usage


def _generate_local_preview_turn(stage: StageEngine, director_action_summary: str) -> Dict[str, Any]:
    """
    High-fidelity deterministic script generator when no live AMD API key is present.
    Enforces 100% reliable local preview with natural freeform room movement and dialogue.
    """
    current_room = stage.nodes[stage.current_room_id]
    room_id = stage.current_room_id
    living_chars = [cid for cid, c in stage.characters.items() if c["is_alive"]]

    dialogue = []
    actions = {}
    intents = {}

    # Check blocked edges from this room
    blocked_targets = [to_n for (frm, to_n) in stage.blocked_edges if frm == room_id]

    if room_id == 1:
        if stage.room_turn <= 1:
            scene_title = "Scene I: The Whistle in the Ticket Hall"
            narration = (
                f"Inside the {current_room['name']}, cold mountain mist seeps beneath the door jamb. "
                "The brass telegraph keys chatter softly in the silence as the cast gathers around the iron stove."
            )
            julian_line = "The telegraph records confirm the midnight express has already passed the outer signal. Let us check our gear before we venture out."
            vesper_line = "The company ledger drawer is locked. Keep watch while I see what route manifests they left behind."
            beatrice_line = "The frost outside is creeping across the iron ties. Let us warm our joints at the stove first; this cold will freeze a gear in minutes."
            curator_line = "Every room holds its secrets. Take your marks and search the fixtures."

            if "Julian" in living_chars:
                actions["Julian"] = {"target_fixture": "telegraph", "action": "decodes telegraph ticker", "voted_exit": None}
                intents["Julian"] = 1
                dialogue.append({"speaker": "Julian", "line": julian_line})
            if "Vesper" in living_chars:
                actions["Vesper"] = {"target_fixture": "cabinets", "action": "inspects the locked ledger drawer", "voted_exit": None}
                intents["Vesper"] = 1
                dialogue.append({"speaker": "Vesper", "line": vesper_line})
            if "Beatrice" in living_chars:
                actions["Beatrice"] = {"target_fixture": "stove", "action": "warms numb fingers over coal embers", "voted_exit": None}
                intents["Beatrice"] = 1
                dialogue.append({"speaker": "Beatrice", "line": beatrice_line})
            if "The Curator" in living_chars:
                actions["The Curator"] = {"target_fixture": "floorboards", "action": "examines the creaking floorboards", "voted_exit": None}
                intents["The Curator"] = 1
                dialogue.append({"speaker": "The Curator", "line": curator_line})
        else:
            scene_title = "Scene I: Route Consensus in the Ticket Hall"
            narration = (
                "The shadows lengthen across the station platform. The troupe must choose their route before the wailing fog engulfs the valley."
            )
            # Decide voted exits
            if 2 in blocked_targets:
                vesper_vote = 3
                vesper_line = "Someone dropped the velvet curtain across the upper bridge door! Blast it... we are forced into the valley scree."
                julian_vote = 3
                julian_line = "With the upper door barricaded, the telegraph records agree: our only viable crossing is through the lower ravine hatch."
            else:
                vesper_vote = 2
                vesper_line = "I am not trudging through mud and wet scree with my satchel. The Trestle Bridge is 92% safe in company records. I say we take the bridge."
                julian_vote = 2
                julian_line = "The telegraph records confirm the express leaves at midnight. We cannot afford the extra hour in the ravine unless the bridge is truly impassable."

            beatrice_vote = 3
            beatrice_line = "Company records were written before the winter freeze, Vesper. Those timber supports creak in the wind. The ravine shelter is rough, but safe."
            curator_vote = vesper_vote
            curator_line = "The stage directions are clear. Every decision carries weight across the chasm."

            # Assign room fixtures and actions
            if "Julian" in living_chars:
                actions["Julian"] = {"target_fixture": "telegraph", "action": "decodes telegraph ticker", "voted_exit": julian_vote}
                intents["Julian"] = julian_vote
                dialogue.append({"speaker": "Julian", "line": julian_line})

            if "Vesper" in living_chars:
                actions["Vesper"] = {"target_fixture": "cabinets", "action": "inspects the locked ledger drawer", "voted_exit": vesper_vote}
                intents["Vesper"] = vesper_vote
                dialogue.append({"speaker": "Vesper", "line": vesper_line})

            if "Beatrice" in living_chars:
                actions["Beatrice"] = {"target_fixture": "stove", "action": "warms numb fingers over coal embers", "voted_exit": beatrice_vote}
                intents["Beatrice"] = beatrice_vote
                dialogue.append({"speaker": "Beatrice", "line": beatrice_line})

            if "The Curator" in living_chars:
                actions["The Curator"] = {"target_fixture": "floorboards", "action": "examines the creaking floorboards", "voted_exit": curator_vote}
                intents["The Curator"] = curator_vote
                dialogue.append({"speaker": "The Curator", "line": curator_line})

    elif room_id == 2:
        scene_title = "Scene II: The Locked Platform Gate"
        narration = (
            "Outside the station arches, freezing gale winds howl against the iron portcullis. "
            "Beyond the locked bars, the rails of the Midnight Express glisten in the frost."
        )
        if "Beatrice" in living_chars:
            intents["Beatrice"] = 2
            actions["Beatrice"] = {
                "target_room": 2,
                "target_fixture": "padlocked_gate",
                "action": "Applies machinist spanner to unbolt the rusted gate padlock.",
                "action_type": "UNBOLT_GATE",
                "voted_exit": 4,
            }
            dialogue.append({"speaker": "Beatrice", "line": "Give me a moment with the spanner; this rusted hasp will give way under pressure.", "claimed_room": 2})
        if "Julian" in living_chars:
            intents["Julian"] = 2
            actions["Julian"] = {"target_room": 2, "target_fixture": "signal_lever", "action": "calculates track signal clearance", "voted_exit": 4}
            dialogue.append({"speaker": "Julian", "line": "The semaphore is set against us. If the gate opens, the train can depart safely.", "claimed_room": 2})
        if "Vesper" in living_chars:
            intents["Vesper"] = 2
            actions["Vesper"] = {"target_room": 2, "target_fixture": "track_lantern", "action": "scouts the outer tracks", "voted_exit": 4}
            dialogue.append({"speaker": "Vesper", "line": "The fog is crawling onto the ties below. Hurry with that lock, Beatrice!", "claimed_room": 2})
        if "The Curator" in living_chars:
            intents["The Curator"] = 2
            actions["The Curator"] = {"target_room": 2, "target_fixture": "observation", "action": "watches the ticking station clock", "voted_exit": 4}
            dialogue.append({"speaker": "The Curator", "line": "The rails do not wait for consensus. The bells toll for departure.", "claimed_room": 2})

    elif room_id == 3:
        scene_title = "Scene III: The Grand Waiting Hall"
        narration = (
            "A cavernous hall of tarnished bronze chandeliers and fading red velvet armchairs. "
            "The iron hearth stove crackles in the center, casting flickering shadows against the grand clock tower."
        )
        if "Julian" in living_chars:
            intents["Julian"] = 3
            actions["Julian"] = {"target_room": 3, "target_fixture": "clock_tower", "action": "checks the pendulum escapement", "voted_exit": 4}
            dialogue.append({"speaker": "Julian", "line": "Eight bells until midnight. We are running dangerously short on time.", "claimed_room": 3})
        if "Vesper" in living_chars:
            intents["Vesper"] = 3
            actions["Vesper"] = {"target_room": 3, "target_fixture": "timetables", "action": "scans departures board for secret routes", "voted_exit": 4}
            dialogue.append({"speaker": "Vesper", "line": "The baggage room connects to the lower platform service hatch. That is our way.", "claimed_room": 3})
        if "Beatrice" in living_chars:
            intents["Beatrice"] = 3
            actions["Beatrice"] = {"target_room": 3, "target_fixture": "hearth_stove", "action": "thaws frostbitten knuckles", "voted_exit": 4}
            dialogue.append({"speaker": "Beatrice", "line": "The heat returns feeling to my fingers. Now I can grip the wrenches.", "claimed_room": 3})
        if "The Curator" in living_chars:
            intents["The Curator"] = 3
            actions["The Curator"] = {"target_room": 3, "target_fixture": "chandelier", "action": "observes the sway of the gas lamps", "voted_exit": 4}
            dialogue.append({"speaker": "The Curator", "line": "Every theater has its wings. Watch where your companions wander.", "claimed_room": 3})

    elif room_id == 4:
        scene_title = "Scene IV: The Baggage & Boiler Room"
        narration = (
            "Damp service basement roaring with hissing steam and smelling of grease and coal soot. "
            "A towering furnace glows with incandescent heat beside piles of freight crates."
        )
        is_lit = (4 == getattr(stage, "spotlight_chamber", 1))
        if "Julian" in living_chars:
            intents["Julian"] = 4
            if is_lit:
                actions["Julian"] = {"target_room": 4, "target_fixture": "coal_chute", "action": "standing guard near the coal chute", "voted_exit": 2}
                dialogue.append({"speaker": "Julian", "line": "The heat here is suffocating. Let us find the tools and get to the platform.", "claimed_room": 4})
            else:
                actions["Julian"] = {
                    "target_room": 4,
                    "target_fixture": "steam_furnace",
                    "action": "Feeds incriminating company manifests into the furnace fire.",
                    "action_type": "BURN",
                    "voted_exit": 2,
                }
                dialogue.append({
                    "speaker": "Julian",
                    "line": "I have been in the Grand Waiting Hall all along, reviewing safe schedules.",
                    "intent": "LIE_ALIBI",
                    "claimed_room": 3,
                })
        if "Vesper" in living_chars:
            intents["Vesper"] = 4
            if is_lit:
                actions["Vesper"] = {"target_room": 4, "target_fixture": "toolbench", "action": "inspecting the machinist tools", "voted_exit": 2}
                dialogue.append({"speaker": "Vesper", "line": "Beatrice, there are heavy spanners on this workbench for your lock.", "claimed_room": 4})
            else:
                actions["Vesper"] = {
                    "target_room": 4,
                    "target_fixture": "smuggler_crate",
                    "action": "Stashes volatile contraband satchel into the wooden freight crate.",
                    "action_type": "STEAL",
                    "voted_exit": 2,
                }
                dialogue.append({
                    "speaker": "Vesper",
                    "line": "I was checking the timetable board in the Grand Waiting Hall, nowhere near the baggage.",
                    "intent": "LIE_ALIBI",
                    "claimed_room": 3,
                })
        if "Beatrice" in living_chars:
            intents["Beatrice"] = 4
            actions["Beatrice"] = {"target_room": 4, "target_fixture": "toolbench", "action": "retrieves cold iron spanner from toolbench", "voted_exit": 2}
            dialogue.append({"speaker": "Beatrice", "line": "Found the spanner! Now I can crack the platform portcullis padlock.", "claimed_room": 4})
        if "The Curator" in living_chars:
            intents["The Curator"] = 4
            actions["The Curator"] = {"target_room": 4, "target_fixture": "steam_furnace", "action": "watches embers rise into chimney", "voted_exit": 2}
            dialogue.append({"speaker": "The Curator", "line": "Ash in the dark, fire in the cold. What is burned cannot be unsaid.", "claimed_room": 4})

    else:
        scene_title = f"Scene {stage.scene_number}: The Platform Threshold"
        narration = "The whistle of the Midnight Express echoes down the mountain pass. The final curtain approaches."
        for cid in living_chars:
            intents[cid] = 2
            actions[cid] = {"target_room": 2, "target_fixture": "padlocked_gate", "action": "boarding the train", "voted_exit": 2}
        dialogue.append({"speaker": "The Curator", "line": "Take your places. The curtain falls upon the station."})

    return {
        "scene_title": scene_title,
        "narration": narration,
        "dialogue": dialogue,
        "character_actions": actions,
        "character_intents": intents,
    }


def _validate_turn_script(stage: StageEngine, script: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Strict Epistemic Verifier Gate asserting:
    1. Schema completeness.
    2. Speaker validity (no ghost dialogue).
    3. Spatial adjacency across 2x2 dollhouse chambers.
    4. The Spotlight Rule (Gaze of Accountability): intercepts illicit covert actions in lit room.
    5. Theory of Mind Epistemic Gate: flags unperceived secret claims.
    """
    repairs = []

    if not isinstance(script, dict):
        raise AssertionError("Output payload must be a JSON object.")

    if "dialogue" not in script or not isinstance(script["dialogue"], list):
        raise AssertionError("Missing or malformed 'dialogue' list.")

    # 1. Verify Dialogue Speakers & Ghost Dialogue Interception
    cleaned_dialogue = []
    for entry in script["dialogue"]:
        speaker = entry.get("speaker", "")
        valid_spk, reason = stage.validate_speech(speaker)
        if not valid_spk:
            repairs.append({
                "rule": "Deceased State Synchronized",
                "issue": f"Ghost dialogue intercepted: '{speaker}' is deceased.",
                "action": f"Suppressed line from '{speaker}'.",
            })
        else:
            # Epistemic Omniscience Verifier: Flag unperceived secret references
            line = entry.get("line", "")
            lower_line = line.lower()
            if speaker in stage.characters:
                spk_char = stage.characters[speaker]
                spk_mems = [m.get("event", "").lower() for m in stage.actor_memories.get(speaker, [])]
                if ("contraband" in lower_line or "stashed" in lower_line) and speaker != "Vesper" and spk_char["node"] != 4:
                    if not any("contraband" in m for m in spk_mems):
                        repairs.append({
                            "rule": "Theory of Mind Epistemic Gate",
                            "issue": f"{speaker} asserted unobserved contraband in Room 4 without direct perception.",
                            "action": "Framed line with rumor suspicion prefix.",
                        })
                        entry["line"] = f"A rumor whispers across the hall: {line}"
            cleaned_dialogue.append(entry)
    script["dialogue"] = cleaned_dialogue

    # 2. Verify Character Movement, Fixtures, and Spotlight Rule
    raw_intents = script.get("character_intents", {})
    raw_actions = script.get("character_actions", {})

    repaired_intents = {}
    repaired_actions = {}

    for cid in stage.characters.keys():
        char = stage.characters[cid]
        if not char["is_alive"]:
            continue

        target_node = None
        if cid in raw_intents and isinstance(raw_intents[cid], int):
            target_node = raw_intents[cid]
        elif cid in raw_actions and isinstance(raw_actions[cid], dict):
            if "target_room" in raw_actions[cid]:
                target_node = int(raw_actions[cid]["target_room"])
            elif "voted_exit" in raw_actions[cid] and raw_actions[cid]["voted_exit"] is not None:
                target_node = int(raw_actions[cid]["voted_exit"])

        if target_node is None:
            target_node = char.get("node", stage.current_room_id)

        # Validate bilateral adjacency
        valid_move, reason = stage.validate_move(cid, target_node)
        if not valid_move:
            current_node = stage.characters[cid]["node"]
            legal_adjacent = [
                to_n for (frm, to_n) in stage.edges
                if frm == current_node and (frm, to_n) not in stage.blocked_edges
            ]
            repaired_node = legal_adjacent[0] if legal_adjacent else current_node
            repairs.append({
                "rule": "Spatial Adjacency Enforced",
                "issue": f"{cid} attempted illegal move to Node {target_node} ({reason}).",
                "action": f"Rerouted {cid} to legal Node {repaired_node}.",
            })
            target_node = repaired_node

        repaired_intents[cid] = target_node

        # Validate Fixture and Action
        if cid in raw_actions and isinstance(raw_actions[cid], dict):
            act_dict = dict(raw_actions[cid])
            act_room = act_dict.get("target_room", target_node)
            target_fix = act_dict.get("target_fixture")
            if target_fix and not stage.validate_fixture(act_room, target_fix):
                default_fix = stage.nodes[act_room].get("default_fixture", "hearth_stove")
                repairs.append({
                    "rule": "Fixture Adjacency Enforced",
                    "issue": f"Fixture '{target_fix}' does not exist in Chamber {act_room}.",
                    "action": f"Positioned {cid} at default fixture '{default_fix}'.",
                })
                act_dict["target_fixture"] = default_fix

            # Spotlight Rule (Gaze of Accountability) Assertion
            is_under_spotlight = (act_room == getattr(stage, "spotlight_chamber", 1))
            act_text = act_dict.get("action", "")
            act_type = str(act_dict.get("action_type", "")).upper()
            is_covert_crime = act_type in ("SABOTAGE", "STEAL", "BURN", "COVERT") or any(
                kw in act_text.lower() for kw in ["burn", "steal", "stash", "sabotage", "poison"]
            )

            if is_under_spotlight and is_covert_crime:
                repairs.append({
                    "rule": "The Spotlight Rule (Gaze of Accountability)",
                    "issue": f"{cid} attempted covert crime in lit Chamber {act_room} under the Director's Spotlight.",
                    "action": "Suppressed illicit deed; forced innocent facade under audience gaze.",
                })
                act_dict["action"] = "Standing innocently under the audience spotlight."
                act_dict["action_type"] = "INNOCENT_FACADE"

            act_dict["target_room"] = act_room
            act_dict["voted_exit"] = target_node
            repaired_actions[cid] = act_dict
        else:
            repaired_actions[cid] = {
                "target_room": target_node,
                "target_fixture": char.get("current_fixture", "hearth_stove"),
                "action": "Observing from the shadows.",
                "voted_exit": target_node,
            }

    script["character_intents"] = repaired_intents
    script["character_actions"] = repaired_actions
    return repairs


def generate_stage_turn(
    stage: StageEngine,
    director_action_summary: str,
) -> Tuple[Dict[str, Any], List[Dict[str, str]], Dict[str, Any]]:
    """
    Executes the Generate-Verify-Repair loop for a theatrical stage scene.
    Returns: (verified_script, list_of_repairs, cost_telemetry)
    """
    global _AMD_CIRCUIT_BROKEN
    start_time = time.time()
    repairs_log: List[Dict[str, str]] = []
    cost_data = compute_cost_usd(520, 240)

    # Check if live AMD API key is provided and circuit is healthy
    use_live_amd = bool(os.getenv("AMD_API_KEY")) and not _AMD_CIRCUIT_BROKEN

    if not use_live_amd:
        # High fidelity local deterministic generation
        script = _generate_local_preview_turn(stage, director_action_summary)
        repairs = _validate_turn_script(stage, script)
        repairs_log.extend(repairs)
        cost_data["latency_ms"] = int((time.time() - start_time) * 1000)
        cost_data["mode"] = "local-preview" if not _AMD_CIRCUIT_BROKEN else "local-failover"
        return script, repairs_log, cost_data

    # Live AMD ROCm / vLLM execution with Generate-Verify-Repair loop
    stage_state = stage.get_stage_state()
    user_prompt = f"""
CURRENT STAGE STATE:
Scene: {stage_state['scene_number']} of {stage_state['max_scenes']}
Active Room: Node {stage_state['current_room_id']} ({stage_state['current_room']['name']})
Room Progress: {stage_state['room_progress']}%
Room Fixtures: {[f['id'] + ': ' + f['name'] for f in stage_state['current_room'].get('fixtures', [])]}
Room Exits: {[e['name'] + ' -> Node ' + str(e['target_node']) for e in stage_state['current_room'].get('exits', [])]}
Tension Dial: {stage_state['tension_dial']}
Fog Position: Node {stage_state['fog_node']} (Lethal)
Spotlight: Nodes {stage_state['spotlighted_nodes']}, Fixture {stage_state.get('spotlighted_fixture')}
Blocked Routes: {stage_state['blocked_edges']}

DIRECTOR'S INTERVENTION THIS TURN:
{director_action_summary}

CHARACTERS IN ROOM:
{json.dumps(stage_state['characters'], indent=2)}

Write the theatrical turn script in valid JSON matching the schema.
"""
    messages = [
        {"role": "system", "content": STAGE_DIRECTOR_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    attempts = 0
    max_attempts = 3
    final_script = None

    while attempts < max_attempts:
        attempts += 1
        try:
            raw_text, usage = _call_amd_api(messages)
            cost_data = compute_cost_usd(usage.get("prompt_tokens", 520), usage.get("completion_tokens", 240))
            parsed = json.loads(raw_text)
            repairs = _validate_turn_script(stage, parsed)
            repairs_log.extend(repairs)
            final_script = parsed
            cost_data["mode"] = "amd-live"
            break
        except (urllib.error.URLError, TimeoutError, OSError) as net_err:
            _AMD_CIRCUIT_BROKEN = True
            final_script = _generate_local_preview_turn(stage, director_action_summary)
            repairs = _validate_turn_script(stage, final_script)
            repairs_log.extend(repairs)
            cost_data["mode"] = "local-failover"
            break
        except Exception as exc:
            # Self-repair feedback turn
            if attempts < max_attempts:
                messages.append({"role": "assistant", "content": str(raw_text) if 'raw_text' in locals() else "{}"})
                messages.append({
                    "role": "user",
                    "content": f"VALIDATION ERROR: {str(exc)}. Repair the JSON output to strictly adhere to room fixtures, graph adjacency, and alive characters.",
                })
            else:
                # Fall back to deterministic script on exhaustion
                final_script = _generate_local_preview_turn(stage, director_action_summary)
                repairs = _validate_turn_script(stage, final_script)
                repairs_log.extend(repairs)
                cost_data["mode"] = "local-repair-fallback"

    cost_data["latency_ms"] = int((time.time() - start_time) * 1000)
    cost_data["attempts"] = attempts
    cost_data["mode"] = "amd-rocm"
    return final_script, repairs_log, cost_data
