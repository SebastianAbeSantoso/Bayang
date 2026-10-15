"""
server/stage_model_client.py
----------------------------
AI Theatrical Script Generator and Generate-Verify-Repair loop
for "The World's a Stage", powered by Google DeepMind Gemma 2 on AMD MI300X.

Validates spatial adjacency, ghost dialogue prevention, and inventory consistency
against the deterministic StageEngine before rendering to the client.

Strictly zero em dashes across all code and text. Zero external dependencies.
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

The player is the Stage Director who manipulates environmental cues, stage lighting, blocked routes, and tension levels.
You write the scene's narration, character dialogue reactions, and decide where each character attempts to move based on their personality traits and psychological flaws.

STRICT DRAMATIC CONSTRAINTS:
1. SPATIAL REALITY: Characters can ONLY move along connected edges in the stage graph. They CANNOT teleport across unconnected nodes.
2. STAGE CURTAINS: If a pathway is blocked by a dropped curtain, characters CANNOT cross it. They must react to the barrier and choose an alternate adjacent path.
3. MORTALITY: Deceased characters CANNOT speak, move, or act. Living characters must react somberly to fallen companions.
4. PERSONALITY LEVERS:
   - Julian (cautious, fearful of dark nodes without spotlight, high curiosity).
   - Vesper (agile, selfish, carries 110kg heavy contraband, wants fastest route).
   - Beatrice (frail, hates rugged paths, skilled with tools and locks).
   - The Curator (cryptic, speaks in stage directions, impervious to fog).

You MUST output strictly valid JSON matching this schema:
{
  "scene_title": "string (theatrical scene title)",
  "narration": "string (atmospheric stage directions describing movement and tension)",
  "dialogue": [
    {
      "speaker": "Julian | Vesper | Beatrice | The Curator",
      "line": "string"
    }
  ],
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
    with urllib.request.urlopen(req, timeout=60) as resp:
        res = json.loads(resp.read().decode("utf-8"))
    usage = res.get("usage", {"prompt_tokens": 450, "completion_tokens": 280})
    content = res["choices"][0]["message"]["content"]
    return content, usage


def _generate_local_preview_turn(stage: StageEngine, director_action_summary: str) -> Dict[str, Any]:
    """
    High-fidelity deterministic script generator when no live AMD API key is present.
    Enforces 100% reliable local preview without crashes.
    """
    scene = stage.scene_number
    living_chars = [cid for cid, c in stage.characters.items() if c["is_alive"]]
    dead_chars = [cid for cid, c in stage.characters.items() if not c["is_alive"]]

    dialogue = []
    intents = {}

    # Scene 1: Platform gathering
    if scene == 1:
        scene_title = "Scene I: The Whistle on the Marble"
        narration = (
            "The brass lantern flickers against the damp Victorian ironwork. "
            "A low fog horn wails across the valley as the troupe prepares to cross the pass."
        )
        if "Julian" in living_chars:
            dialogue.append({
                "speaker": "Julian",
                "line": "The archives record two routes ahead: the high Trestle Bridge and the rugged Valley Bypass. The bridge looks far faster on paper.",
            })
        if "Vesper" in living_chars:
            # Check if Route 1->2 is blocked
            if (1, 2) in stage.blocked_edges:
                dialogue.append({
                    "speaker": "Vesper",
                    "line": "Someone dropped the velvet stage curtain across the Trestle Bridge! Blast it... we are forced into the valley scree.",
                })
                intents["Vesper"] = 3
            else:
                dialogue.append({
                    "speaker": "Vesper",
                    "line": "I am not crawling through muddy ditches with my satchel. The Trestle Bridge is 92% safe in company records. I am crossing.",
                })
                intents["Vesper"] = 2

        if "Beatrice" in living_chars:
            intents["Beatrice"] = 3 if (1, 2) in stage.blocked_edges else (2 if "Vesper" in living_chars and intents.get("Vesper") == 2 else 3)
            dialogue.append({
                "speaker": "Beatrice",
                "line": "My wrench is packed, but these old timbers look fragile beneath the frost. Mind your step.",
            })

        if "Julian" in living_chars:
            intents["Julian"] = intents.get("Beatrice", 3)

        if "The Curator" in living_chars:
            intents["The Curator"] = intents.get("Vesper", 2)
            dialogue.append({
                "speaker": "The Curator",
                "line": "The stage directions are clear. Every decision carries weight across the chasm.",
            })

    elif scene == 2:
        scene_title = "Scene II: Fractured Timber & Scree"
        narration = "The wind bites violently as the first leg of the journey reveals the hidden reality of the mountain."
        for cid in living_chars:
            intents[cid] = 4  # Converge toward Signal Tower (Node 4)

        if "Vesper" in living_chars:
            if stage.characters["Vesper"]["node"] == 2:
                dialogue.append({
                    "speaker": "Vesper",
                    "line": "The timber groaned under my boots! I had to jettison the contraband to keep from plunging into the abyss!",
                })
            else:
                dialogue.append({
                    "speaker": "Vesper",
                    "line": "The valley rocks tore through my boots, but at least the ground did not swallow us whole.",
                })
        if "Julian" in living_chars:
            dialogue.append({
                "speaker": "Julian",
                "line": "The Signal Tower stands ahead. If we can reach the telegraph switch, we can signal the train.",
            })

    elif scene == 3:
        scene_title = "Scene III: The Signal Outpost"
        narration = "A heavy iron gate bars the pass before the Signal Tower. The fog creeps up the mountainside."
        if "Beatrice" in living_chars:
            dialogue.append({
                "speaker": "Beatrice",
                "line": "The padlock is rusted shut. Stand back, let me put my spanner to the bolt.",
            })
        if (4, 5) in stage.blocked_edges:
            for cid in living_chars:
                intents[cid] = 6
        else:
            for cid in living_chars:
                intents[cid] = 5 if cid in ("Vesper", "The Curator") else 6

    else:
        scene_title = f"Scene {scene}: The Terminal Beckons"
        narration = "The locomotive's white steam plume cuts through the gathering gloom. The end of the stage is in sight."
        for cid in living_chars:
            intents[cid] = 7  # All head to goal
        if "Julian" in living_chars:
            dialogue.append({
                "speaker": "Julian",
                "line": "The terminal gates! Keep moving, do not let the fog claim our steps!",
            })

    return {
        "scene_title": scene_title,
        "narration": narration,
        "dialogue": dialogue,
        "character_intents": intents,
    }


def _validate_turn_script(stage: StageEngine, script: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Strict verifier asserting:
    1. Schema completeness.
    2. Speaker validity (no ghost dialogue).
    3. Movement validity (no spatial breaches, no crossing blocked curtains).

    Returns a list of repairs performed or raises AssertionError on irrecoverable payload.
    """
    repairs = []

    if not isinstance(script, dict):
        raise AssertionError("Output payload must be a JSON object.")

    if "dialogue" not in script or not isinstance(script["dialogue"], list):
        raise AssertionError("Missing or malformed 'dialogue' list.")

    if "character_intents" not in script or not isinstance(script["character_intents"], dict):
        raise AssertionError("Missing or malformed 'character_intents' map.")

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

    # 2. Verify Character Movement Intents
    repaired_intents = {}
    for cid, target_node in script["character_intents"].items():
        if cid not in stage.characters:
            continue
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
            repaired_intents[cid] = repaired_node
        else:
            repaired_intents[cid] = target_node

    script["character_intents"] = repaired_intents
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
Tension Dial: {stage_state['tension_dial']}
Fog Position: Node {stage_state['fog_node']} (Lethal)
Spotlight: Nodes {stage_state['spotlighted_nodes']}
Blocked Routes: {stage_state['blocked_edges']}

DIRECTOR'S INTERVENTION THIS TURN:
{director_action_summary}

CHARACTERS:
{json.dumps(stage_state['characters'], indent=2)}

STAGE GRAPH EDGES:
{stage_state['edges']}

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
        except Exception as exc:
            # Self-repair feedback turn
            if attempts < max_attempts:
                messages.append({"role": "assistant", "content": str(raw_text) if 'raw_text' in locals() else "{}"})
                messages.append({
                    "role": "user",
                    "content": f"VALIDATION ERROR: {str(exc)}. Repair the JSON output to strictly adhere to graph adjacency and alive characters.",
                })
            else:
                # Fall back to deterministic script on exhaustion
                final_script = _generate_local_preview_turn(stage, director_action_summary)
                repairs_log.append({
                    "rule": "Autonomous Repair Fallback",
                    "issue": f"Gemma repair turns exhausted ({str(exc)}).",
                    "action": "Applied deterministic stage script fallback.",
                })

    cost_data["latency_ms"] = int((time.time() - start_time) * 1000)
    cost_data["attempts"] = attempts
    cost_data["mode"] = "amd-rocm"
    return final_script, repairs_log, cost_data
