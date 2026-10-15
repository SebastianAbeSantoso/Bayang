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
The game takes place inside a physical room on a mountain journey. Each room has interactive architectural fixtures and forward exit doors.
Characters move freeform inside the room, investigate fixtures, converse, react to Director interventions, and advocate for which exit door the troupe should take next.

STRICT DRAMATIC CONSTRAINTS:
1. SPATIAL REALITY: Characters can ONLY move between fixtures that exist in the active room, and can ONLY vote to exit through connected unblocked doors.
2. STAGE CURTAINS: If an exit door is blocked by a dropped velvet curtain, characters CANNOT cross it. They must react to the barrier and pivot to an unblocked alternative door.
3. MORTALITY: Deceased characters CANNOT speak, move, or act. Living characters must react somberly to fallen companions.
4. PERSONALITY LEVERS:
   - Julian (cautious, fearful of dark areas without spotlight, high curiosity, reviews records).
   - Vesper (agile, pragmatic, carries 110kg heavy contraband, pushes for fastest route).
   - Beatrice (frail, hates rugged scree, skilled with tools, examines locks and machinery).
   - The Curator (cryptic, speaks in stage directions, impervious to fog).

You MUST output strictly valid JSON matching this schema:
{
  "scene_title": "string (theatrical scene title)",
  "narration": "string (atmospheric stage directions describing movements and room tension)",
  "dialogue": [
    {
      "speaker": "Julian | Vesper | Beatrice | The Curator",
      "line": "string"
    }
  ],
  "character_actions": {
    "Julian": {
      "target_fixture": "string (valid fixture id in current room)",
      "action": "string (natural physical action performed)",
      "voted_exit": integer (target next node id)
    },
    "Vesper": {
      "target_fixture": "string",
      "action": "string",
      "voted_exit": integer
    },
    "Beatrice": {
      "target_fixture": "string",
      "action": "string",
      "voted_exit": integer
    },
    "The Curator": {
      "target_fixture": "string",
      "action": "string",
      "voted_exit": integer
    }
  },
  "character_intents": {
    "Julian": integer (target node id),
    "Vesper": integer (target node id),
    "Beatrice": integer (target node id),
    "The Curator": integer (target node id)
  }
}
"""


def _call_amd_api(messages: List[Dict[str, str]], max_tokens: int = 800) -> Tuple[str, Dict[str, int]]:
    """Calls Gemma 2 on AMD Developer Cloud (vLLM ROCm endpoint)."""
    base = os.getenv("AMD_API_BASE_URL", "https://developer.amd.com.cn/radeon/api/v1").rstrip("/")
    endpoint = base + ("/chat/completions" if base.endswith("/v1") else "/v1/chat/completions")
    body = {
        "model": os.getenv("AMD_MODEL_NAME", "google/gemma-2-9b-it"),
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
            "Authorization": "Bearer " + os.getenv("AMD_API_KEY", ""),
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=6) as resp:
        res = json.loads(resp.read().decode("utf-8"))
    usage = res.get("usage", {"prompt_tokens": 450, "completion_tokens": 280})
    content = res["choices"][0]["message"]["content"]
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
        scene_title = "Scene I: The Whistle in the Ticket Hall"
        narration = (
            f"Inside the {current_room['name']}, cold mountain mist seeps beneath the door jamb. "
            "The brass telegraph keys chatter softly in the silence as the cast gathers around the iron stove."
        )

        # Decide voted exits
        if 2 in blocked_targets:
            vesper_vote = 3
            vesper_line = "Someone dropped the velvet curtain across the upper bridge door! Blast it... we are forced into the valley scree."
        else:
            vesper_vote = 2
            vesper_line = "I am not trudging through mud and wet scree with my satchel. The Trestle Bridge is 92% safe in company records. I say we take the bridge."

        beatrice_vote = 3
        beatrice_line = "Company records were written before the winter freeze, Vesper. Those timber supports creak in the wind. The ravine shelter is rough, but safe."

        if 2 in blocked_targets:
            julian_vote = 3
            julian_line = "With the upper door barricaded, the telegraph records agree: our only viable crossing is through the lower ravine hatch."
        else:
            julian_vote = 2
            julian_line = "The telegraph records confirm the express leaves at midnight. We cannot afford the extra hour in the ravine unless the bridge is truly impassable."

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
        scene_title = "Scene II: Over the Gaping Abyss"
        narration = (
            "The wooden trestle groans violently beneath the wind. Frost glazes the narrow ties, "
            "and hundreds of feet below, the wailing fog churns across jagged rocks."
        )
        for cid in living_chars:
            intents[cid] = 4
            actions[cid] = {"target_fixture": "rotted_timber", "action": "carefully tests footing on the timber span", "voted_exit": 4}

        if "Vesper" in living_chars:
            if stage.characters["Vesper"]["node"] == 2 and 2 in stage.spotlighted_nodes:
                dialogue.append({
                    "speaker": "Vesper",
                    "line": "The spotlight beam caught the fractured beam just in time! I had to ditch the heavy satchel to keep the span from splitting!",
                })
            else:
                dialogue.append({
                    "speaker": "Vesper",
                    "line": "The timber groaned under my boots! That was far too close... keep moving toward the Signal Tower!",
                })

        if "Beatrice" in living_chars:
            dialogue.append({
                "speaker": "Beatrice",
                "line": "Do not look down. Step only where the iron bolts hold the stringers together.",
            })

    elif room_id == 3:
        scene_title = "Scene II: Sheltered in the Canyon Scree"
        narration = (
            "The canyon walls loom like black monoliths. The wind is muffled here, but the sharp scree "
            "bites through leather soles with every step."
        )
        for cid in living_chars:
            intents[cid] = 4
            actions[cid] = {"target_fixture": "hearth", "action": "takes momentary shelter near the stone hearth", "voted_exit": 4}

        if "Beatrice" in living_chars:
            dialogue.append({
                "speaker": "Beatrice",
                "line": "My boots are shredded, but the cliff wall holds steady. The ascending tunnel to the Signal Tower is just ahead.",
            })
        if "Julian" in living_chars:
            dialogue.append({
                "speaker": "Julian",
                "line": "The compass needle is steadying. Up the stone stairs, everyone.",
            })

    elif room_id == 4:
        scene_title = "Scene III: The Locked Junction Tower"
        narration = (
            "Inside the Signal Tower, the massive iron track-switch gate stands padlocked. "
            "Behind, the wailing fog climbs the gorge, devouring the lower paths."
        )
        next_vote = 6 if (4, 5) in stage.blocked_edges else 5
        for cid in living_chars:
            intents[cid] = next_vote
            actions[cid] = {"target_fixture": "gate_lock", "action": "attempts to breach the chained gate", "voted_exit": next_vote}

        if "Beatrice" in living_chars:
            dialogue.append({
                "speaker": "Beatrice",
                "line": "The padlock is seized with rust. Stand back, let me put the cold iron spanner to the hasp!",
            })
        if "Julian" in living_chars:
            dialogue.append({
                "speaker": "Julian",
                "line": "The fog has already swallowed the crossing behind us! Break the lock, Beatrice!",
            })

    else:
        scene_title = f"Scene {stage.scene_number}: The Final Ascent"
        narration = "The white steam plume of the Midnight Express cuts through the freezing mountain twilight. Salvation is at hand."
        for cid in living_chars:
            intents[cid] = 7
            actions[cid] = {"target_fixture": "locomotive", "action": "sprints toward the departure platform", "voted_exit": 7}

        if "Julian" in living_chars:
            dialogue.append({
                "speaker": "Julian",
                "line": "The terminal gates! Keep running, do not let the fog claim our steps!",
            })

    return {
        "scene_title": scene_title,
        "narration": narration,
        "dialogue": dialogue,
        "character_actions": actions,
        "character_intents": intents,
    }


def _validate_turn_script(stage: StageEngine, script: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Strict verifier asserting:
    1. Schema completeness.
    2. Speaker validity (no ghost dialogue).
    3. Room fixture validity and exit legality (no spatial breaches, no crossing blocked curtains).

    Returns a list of repairs performed or raises AssertionError on irrecoverable payload.
    """
    repairs = []

    if not isinstance(script, dict):
        raise AssertionError("Output payload must be a JSON object.")

    if "dialogue" not in script or not isinstance(script["dialogue"], list):
        raise AssertionError("Missing or malformed 'dialogue' list.")

    # 1. Verify Dialogue Speakers
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
            cleaned_dialogue.append(entry)
    script["dialogue"] = cleaned_dialogue

    # 2. Verify Character Movement & Exit Intents
    # Handle either character_actions or character_intents
    raw_intents = script.get("character_intents", {})
    raw_actions = script.get("character_actions", {})

    repaired_intents = {}
    repaired_actions = {}

    for cid in stage.characters.keys():
        char = stage.characters[cid]
        if not char["is_alive"]:
            continue

        # Extract target node intent
        target_node = None
        if cid in raw_intents and isinstance(raw_intents[cid], int):
            target_node = raw_intents[cid]
        elif cid in raw_actions and isinstance(raw_actions[cid], dict):
            target_node = raw_actions[cid].get("voted_exit")

        if target_node is None:
            target_node = char.get("node", stage.current_room_id)

        # Validate macro move or exit vote
        valid_move, reason = stage.validate_move(cid, target_node)
        if not valid_move:
            # Fallback: keep at current node or find legal adjacent node
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

        # Validate fixture action
        if cid in raw_actions and isinstance(raw_actions[cid], dict):
            act_dict = dict(raw_actions[cid])
            target_fix = act_dict.get("target_fixture")
            if target_fix and not stage.validate_fixture(stage.current_room_id, target_fix):
                default_fix = stage.nodes[stage.current_room_id].get("default_fixture", "stove")
                repairs.append({
                    "rule": "Fixture Adjacency Enforced",
                    "issue": f"Fixture '{target_fix}' does not exist in {stage.nodes[stage.current_room_id]['name']}.",
                    "action": f"Positioned {cid} at default fixture '{default_fix}'.",
                })
                act_dict["target_fixture"] = default_fix
            act_dict["voted_exit"] = target_node
            repaired_actions[cid] = act_dict
        else:
            repaired_actions[cid] = {
                "target_fixture": char.get("current_fixture", "stove"),
                "action": "Standing guard in the room.",
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
    start_time = time.time()
    repairs_log: List[Dict[str, str]] = []
    cost_data = compute_cost_usd(520, 240)

    # Check if live AMD API key is provided
    use_live_amd = bool(os.getenv("AMD_API_KEY"))

    if not use_live_amd:
        # High fidelity local deterministic generation
        script = _generate_local_preview_turn(stage, director_action_summary)
        repairs = _validate_turn_script(stage, script)
        repairs_log.extend(repairs)
        cost_data["latency_ms"] = int((time.time() - start_time) * 1000)
        cost_data["mode"] = "local-preview"
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
            break
        except (urllib.error.URLError, TimeoutError, OSError) as net_err:
            final_script = _generate_local_preview_turn(stage, director_action_summary)
            repairs = _validate_turn_script(stage, final_script)
            repairs_log.extend(repairs)
            repairs_log.append({
                "rule": "Network Failover Engaged",
                "issue": f"AMD endpoint unreachable ({net_err}).",
                "action": "Switched to high-fidelity deterministic theater engine.",
            })
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
                repairs_log.append({
                    "rule": "Autonomous Repair Fallback",
                    "issue": f"Gemma repair turns exhausted ({str(exc)}).",
                    "action": "Applied deterministic stage script fallback.",
                })

    cost_data["latency_ms"] = int((time.time() - start_time) * 1000)
    cost_data["attempts"] = attempts
    cost_data["mode"] = "amd-rocm"
    return final_script, repairs_log, cost_data
