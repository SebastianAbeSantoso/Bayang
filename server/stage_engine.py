"""
server/stage_engine.py
----------------------
Deterministic Epistemic Stage Engine for "The World's a Stage".
Powers the 2x2 Victorian Dollhouse Cross-Section Stage and Multi-Agent
Epistemic Social Deduction Sandbox.

Features:
1. 2x2 Dollhouse Stage Topology (4 interconnected chambers).
2. Autonomous Multi-Agent Ticks with Secret Agendas and Independent Paths.
3. The Spotlight Rule (The Gaze of Accountability):
   - Spotlighted chamber forces characters to play innocent for the audience.
   - Unlit chambers enable covert crimes in the shadows (stealing, burning, sabotage).
4. Epistemic Engine (Theory of Mind & Information Asymmetry):
   - Per-actor isolated memory graphs.
   - Perception Gate (events only perceived by co-present actors).
   - Deception & Alibi verification against the Ground Truth Ledger.
5. Evidence Board & Climax:
   - Red-string contradiction engine linking false alibis to physical facts.
   - Train Departure Deadline (Wailing Fog countdown) and Traitor Accusation.

Strictly zero em dashes across all code, docstrings, and comments.
100% Python standard library.
"""

from typing import Dict, List, Tuple, Any, Optional
import copy


STAGE_CHAMBERS = {
    1: {
        "id": 1,
        "name": "Telegraph Office",
        "grid_pos": "top-left",
        "floor": "Upper Level - North Wing",
        "description": "Brass Morse keys, ticker tape, and locked company archives under frosted clerestory windows.",
        "historical_safety": 0.99,
        "default_fixture": "morse_ticker",
        "fixtures": [
            {
                "id": "morse_ticker",
                "name": "Morse Sounder Desk",
                "x": 140,
                "y": 75,
                "type": "terminal",
                "desc": "Chattering brass telegraph relays receiving warnings from lower stations.",
            },
            {
                "id": "manifest_desk",
                "name": "Dispatcher Manifest Desk",
                "x": 280,
                "y": 80,
                "type": "archive",
                "desc": "Company ledgers detailing train schedules, freight manifests, and safety warnings.",
            },
            {
                "id": "filing_safe",
                "name": "Iron Filing Safe",
                "x": 210,
                "y": 135,
                "type": "container",
                "desc": "Heavy company safe holding master keys, station cash, and confidential logs.",
            },
            {
                "id": "telegraph",
                "name": "Morse Sounder Desk",
                "x": 140,
                "y": 75,
                "type": "terminal",
                "desc": "Telegraph equipment for communications.",
            },
            {
                "id": "stove",
                "name": "Station Heating Stove",
                "x": 280,
                "y": 120,
                "type": "rest",
                "desc": "Coal stove radiating heat against the frost.",
            },
            {
                "id": "cabinets",
                "name": "Filing Cabinets",
                "x": 300,
                "y": 80,
                "type": "archive",
                "desc": "Archives containing records and maps.",
            },
            {
                "id": "floorboards",
                "name": "Creaking Floorboards",
                "x": 200,
                "y": 150,
                "type": "hazard",
                "desc": "Timber floorboards over maintenance crawlway.",
            },
        ],
        "connected_chambers": [2, 3],
        "doorways": {
            2: {"name": "East Corridor to Platform Gate", "edge": [1, 2], "x": 380, "y": 90},
            3: {"name": "Spiral Staircase to Waiting Hall", "edge": [1, 3], "x": 190, "y": 180},
        },
    },
    2: {
        "id": 2,
        "name": "Locked Platform Gate",
        "grid_pos": "top-right",
        "floor": "Upper Level - Track Exit",
        "description": "Heavy wrought iron portcullis bolted shut against the snow, overlooking the Midnight Express tracks.",
        "historical_safety": 0.92,
        "default_fixture": "padlocked_gate",
        "fixtures": [
            {
                "id": "padlocked_gate",
                "name": "Track Portcullis",
                "x": 570,
                "y": 75,
                "type": "barrier",
                "desc": "Massive rusted padlock securing departure tunnel to the train tracks. Requires spanner or key.",
            },
            {
                "id": "signal_lever",
                "name": "Master Junction Switch",
                "x": 710,
                "y": 80,
                "type": "terminal",
                "desc": "Interlocked mechanical switch controlling track signals for the Midnight Express.",
            },
            {
                "id": "track_lantern",
                "name": "Observation Lantern Post",
                "x": 640,
                "y": 135,
                "type": "lookout",
                "desc": "High brass lantern casting light across the icy railway tracks below.",
            },
        ],
        "connected_chambers": [1, 4],
        "doorways": {
            1: {"name": "West Corridor to Telegraph Office", "edge": [2, 1], "x": 420, "y": 90},
            4: {"name": "Service Ladder to Boiler Room", "edge": [2, 4], "x": 660, "y": 180},
        },
    },
    3: {
        "id": 3,
        "name": "Grand Waiting Hall",
        "grid_pos": "bottom-left",
        "floor": "Ground Floor - Gathering",
        "description": "Cold marble hall with vaulted timber arches, a glowing coal stove, and a frozen grandfather clock.",
        "historical_safety": 0.96,
        "default_fixture": "hearth_stove",
        "fixtures": [
            {
                "id": "hearth_stove",
                "name": "Cast-Iron Coal Stove",
                "x": 140,
                "y": 255,
                "type": "rest",
                "desc": "Warm coal embers radiating heat; an ideal spot to destroy documents or thaw numb fingers.",
            },
            {
                "id": "clock_tower",
                "name": "Grandfather Clock",
                "x": 220,
                "y": 230,
                "type": "clock",
                "desc": "Carved pendulum clock ticking down the minutes until the Midnight Express departs.",
            },
            {
                "id": "chandelier",
                "name": "Flickering Chandelier",
                "x": 300,
                "y": 220,
                "type": "lighting",
                "desc": "Crystal and brass chandelier casting eerie swaying shadows across the marble floor.",
            },
            {
                "id": "luggage_bench",
                "name": "Wicker Luggage Bench",
                "x": 250,
                "y": 300,
                "type": "container",
                "desc": "Abandoned baggage pile containing blankets, wool coats, and wayfarer satchels.",
            },
        ],
        "connected_chambers": [1, 4],
        "doorways": {
            1: {"name": "Spiral Staircase to Telegraph Office", "edge": [3, 1], "x": 190, "y": 200},
            4: {"name": "Service Double Doors to Boiler Room", "edge": [3, 4], "x": 380, "y": 270},
        },
    },
    4: {
        "id": 4,
        "name": "Baggage & Boiler Room",
        "grid_pos": "bottom-right",
        "floor": "Ground Floor - Service Wing",
        "description": "Dark service basement smelling of grease, coal dust, and hissing steam pipes.",
        "historical_safety": 0.90,
        "default_fixture": "steam_furnace",
        "fixtures": [
            {
                "id": "steam_furnace",
                "name": "High-Pressure Furnace",
                "x": 570,
                "y": 265,
                "type": "incinerator",
                "desc": "Roaring furnace consuming coal; anything thrown into the fire is incinerated instantly.",
            },
            {
                "id": "coal_chute",
                "name": "Deep Coal Chute",
                "x": 710,
                "y": 290,
                "type": "hazard",
                "desc": "Narrow chute leading to the underground bunker; an ideal place to stash contraband.",
            },
            {
                "id": "toolbench",
                "name": "Machinist Toolbench",
                "x": 640,
                "y": 225,
                "type": "tools",
                "desc": "Heavy oak workbench stocked with cold iron spanners, chisels, and oil cans.",
            },
            {
                "id": "smuggler_crate",
                "name": "Unmarked Freight Crate",
                "x": 710,
                "y": 225,
                "type": "stash",
                "desc": "Padlocked shipping crate with company customs seals already broken.",
            },
        ],
        "connected_chambers": [2, 3],
        "doorways": {
            3: {"name": "Service Double Doors to Waiting Hall", "edge": [4, 3], "x": 420, "y": 270},
            2: {"name": "Service Ladder to Platform Gate", "edge": [4, 2], "x": 660, "y": 200},
        },
    },
}

CHAMBER_EDGES = [
    (1, 2), (2, 1),
    (1, 3), (3, 1),
    (3, 4), (4, 3),
    (4, 2), (2, 4),
]

STAGE_NODES = copy.deepcopy(STAGE_CHAMBERS)
STAGE_EDGES = list(CHAMBER_EDGES)


INITIAL_CHARACTERS = {
    "Julian": {
        "id": "Julian",
        "name": "Julian Vance",
        "role": "The Archivist",
        "traits": "Cautious, meticulous, scholarly, terrified of darkness.",
        "flaw": "Secretly destroyed company manifests to conceal fatal railway negligence.",
        "secret_agenda": {
            "title": "Burn Incriminating Manifests",
            "target_crime": "burn_manifests",
            "target_fixture": "steam_furnace",
            "completed": False,
            "progress_pct": 0,
            "description": "Find the dispatcher manifests in Room 1 or 2 and incinerate them in the furnace or stove before anyone decodes them.",
        },
        "hp": 100,
        "max_hp": 100,
        "stress": 15,
        "fatigue": 10,
        "body_weight": 70,
        "contraband_weight": 0,
        "node": 1,
        "current_fixture": "morse_ticker",
        "room_action": "Monitoring the telegraph sounder while clutching station manifests.",
        "voted_exit": 2,
        "is_alive": True,
        "inventory": ["Company Dispatch Manifest", "Fountain Pen"],
    },
    "Vesper": {
        "id": "Vesper",
        "name": "Vesper Cross",
        "role": "The Smuggler",
        "traits": "Agile, decisive, pragmatic, self-preserving.",
        "flaw": "Carries 110 kg of volatile contraband; reckless in the dark.",
        "secret_agenda": {
            "title": "Stash Volatile Contraband",
            "target_crime": "stash_contraband",
            "target_fixture": "smuggler_crate",
            "completed": False,
            "progress_pct": 0,
            "description": "Stash the 110 kg contraband satchel into the boiler room crate without being caught under the spotlight.",
        },
        "hp": 100,
        "max_hp": 100,
        "stress": 20,
        "fatigue": 10,
        "body_weight": 65,
        "contraband_weight": 110,
        "node": 1,
        "current_fixture": "manifest_desk",
        "room_action": "Guarding her heavy canvas satchel while studying the exit doors.",
        "voted_exit": 2,
        "is_alive": True,
        "inventory": ["Lockpicks", "Contraband Satchel (Heavy)"],
    },
    "Beatrice": {
        "id": "Beatrice",
        "name": "Beatrice Thorne",
        "role": "The Machinist",
        "traits": "Resourceful, unyielding problem solver, barrier clearer.",
        "flaw": "Frail joints; suspects someone intentionally sabotaged the train signal.",
        "secret_agenda": {
            "title": "Unbolt the Platform Portcullis",
            "target_crime": "unbolt_gate",
            "target_fixture": "padlocked_gate",
            "completed": False,
            "progress_pct": 0,
            "description": "Obtain the heavy iron spanner from the boiler room toolbench and unbolt the departure portcullis in Room 2.",
        },
        "hp": 80,
        "max_hp": 80,
        "stress": 15,
        "fatigue": 20,
        "body_weight": 55,
        "contraband_weight": 0,
        "node": 1,
        "current_fixture": "filing_safe",
        "room_action": "Inspecting the iron hinges and planning how to force the locked gate.",
        "voted_exit": 3,
        "is_alive": True,
        "inventory": ["Cold Iron Crowbar", "Machinist Grease Can"],
    },
    "The Curator": {
        "id": "The Curator",
        "name": "The Curator",
        "role": "The Cast Infiltrator",
        "traits": "Cryptic, observant, speaks in theatrical stage directions.",
        "flaw": "Manipulates the cast to orchestrate a dramatic tragedy before the curtain falls.",
        "secret_agenda": {
            "title": "Ignite Fatal Paranoia",
            "target_crime": "ignite_paranoia",
            "target_fixture": "clock_tower",
            "completed": False,
            "progress_pct": 0,
            "description": "Whisper contradictory clues to pit Julian and Vesper against each other until a formal accusation is triggered.",
        },
        "hp": 100,
        "max_hp": 100,
        "stress": 0,
        "fatigue": 0,
        "body_weight": 60,
        "contraband_weight": 0,
        "node": 1,
        "current_fixture": "morse_ticker",
        "room_action": "Observing the troupe from the doorway as the curtain rises.",
        "voted_exit": 2,
        "is_alive": True,
        "inventory": ["Stage Prompt Book", "Brass Pocket Watch"],
    },
}


class StageEngine:
    """
    Deterministic Epistemic Engine and state tracker for 'The World's a Stage'.
    Enforces the 2x2 dollhouse stage topology, Theory of Mind memory isolation,
    The Spotlight Rule (gaze of accountability), and contradiction detection.
    """

    def __init__(self):
        self.reset()

    def reset(self):
        self.current_room_id = 1  # The Gathering begins in Telegraph Office
        self.room_turn = 1
        self.room_progress = 15
        self.scene_number = 1
        self.max_scenes = 6
        self.fog_node = 0
        self.fog_encroaching = False
        self.swallowed_fog_nodes: set = set()
        self.countdown_ticks = 8
        self.platform_unlocked = False
        self.traitor_id = "Julian"

        self.characters = copy.deepcopy(INITIAL_CHARACTERS)
        self.chambers = copy.deepcopy(STAGE_CHAMBERS)
        self.nodes = copy.deepcopy(STAGE_CHAMBERS)
        self.edges = list(CHAMBER_EDGES)
        self.blocked_edges: List[Tuple[int, int]] = []
        self.curtained_doorways: List[Tuple[int, int]] = []

        # Spotlight starts trained on Chamber 1 (Telegraph Office)
        self.spotlight_chamber = 1
        self.spotlighted_nodes = [1]
        self.spotlighted_fixture = "morse_ticker"

        # Epistemic Memory Logs and Ground Truth
        self.physical_truth_log: List[Dict[str, Any]] = [
            {
                "tick": 0,
                "actor": "System",
                "room": 1,
                "fixture": "morse_ticker",
                "action": "The cast assembled in the Telegraph Office as mountain fog gathered.",
                "is_crime": False,
            }
        ]
        self.actor_memories: Dict[str, List[Dict[str, Any]]] = {
            cid: [
                {
                    "tick": 0,
                    "event": "Gathered in the Telegraph Office. The train leaves in 8 bells.",
                    "room": 1,
                    "witnesses": ["Julian", "Vesper", "Beatrice", "The Curator"],
                }
            ]
            for cid in self.characters
        }
        self.actor_alibis: Dict[str, Dict[str, Any]] = {}
        self.evidence_contradictions: List[Dict[str, Any]] = []

        # Props placed in fixtures
        self.fixture_props: Dict[str, List[str]] = {
            "toolbench": ["Machinist Spanner"],
            "filing_safe": ["Master Track Key"],
            "smuggler_crate": ["Smuggled Diamonds"],
            "manifest_desk": ["Route Safety Audit"],
        }
        self.node_props: Dict[int, List[str]] = {
            2: ["Padlocked Chain"],
            4: ["Grease Rag"],
        }

        self.tension_dial = 2.0
        self.director_authority = 4
        self.active_rumors: List[Dict[str, str]] = []
        self.script_history: List[Dict[str, Any]] = []
        self.status = "in_progress"  # in_progress, won, lost
        self.last_hazard_events: List[str] = []

    def get_stage_state(self) -> Dict[str, Any]:
        """Returns complete serializable state for frontend and LLM context."""
        chars_summary = {}
        for cid, char in self.characters.items():
            total_weight = char["body_weight"] + char["contraband_weight"]
            c_node = char["node"]
            node_name = self.chambers.get(c_node, {}).get("name", f"Chamber {c_node}")
            chars_summary[cid] = {
                "id": char["id"],
                "name": char["name"],
                "role": char["role"],
                "node": c_node,
                "node_name": node_name,
                "current_fixture": char.get("current_fixture", "hearth_stove"),
                "room_action": char.get("room_action", "Observing the chamber."),
                "voted_exit": char.get("voted_exit", None),
                "hp": char["hp"],
                "max_hp": char["max_hp"],
                "stress": char["stress"],
                "fatigue": char["fatigue"],
                "total_weight_kg": total_weight,
                "is_alive": char["is_alive"],
                "inventory": list(char["inventory"]),
                "traits": char["traits"],
                "flaw": char["flaw"],
                "secret_agenda": dict(char.get("secret_agenda", {})),
                "latest_alibi": self.actor_alibis.get(cid, None),
            }

        # Calculate consensus votes for departure
        votes = {}
        for cid, c in self.characters.items():
            if c["is_alive"] and c.get("voted_exit"):
                votes[c["voted_exit"]] = votes.get(c["voted_exit"], 0) + 1

        living_count = sum(1 for c in self.characters.values() if c["is_alive"])
        consensus_target = None
        consensus_reached = False
        for target, count in votes.items():
            if count > living_count / 2:
                consensus_target = target
                consensus_reached = True
                break

        current_room = self.chambers.get(self.current_room_id, {})

        return {
            "scene_number": self.scene_number,
            "max_scenes": self.max_scenes,
            "current_room_id": self.current_room_id,
            "current_room": current_room,
            "chambers": self.chambers,
            "spotlight_chamber": self.spotlight_chamber,
            "curtained_doorways": [list(e) for e in self.curtained_doorways],
            "countdown_ticks": self.countdown_ticks,
            "platform_unlocked": self.platform_unlocked,
            "traitor_id": self.traitor_id,
            "room_turn": self.room_turn,
            "room_progress": self.room_progress,
            "room_consensus": {
                "reached": consensus_reached,
                "target_node": consensus_target,
                "votes": {cid: c.get("voted_exit") for cid, c in self.characters.items() if c["is_alive"]},
            },
            "fog_node": self.fog_node,
            "fog_encroaching": self.fog_encroaching,
            "tension_dial": round(self.tension_dial, 1),
            "director_authority": self.director_authority,
            "blocked_edges": [list(e) for e in self.blocked_edges],
            "spotlighted_nodes": list(self.spotlighted_nodes),
            "spotlighted_fixture": self.spotlighted_fixture,
            "active_rumors": list(self.active_rumors),
            "characters": chars_summary,
            "nodes": self.nodes,
            "edges": [list(e) for e in self.edges],
            "evidence_contradictions": list(self.evidence_contradictions),
            "status": self.status,
            "last_hazard_events": list(self.last_hazard_events),
        }

    def get_actor_knowledge(self, actor_id: str) -> Dict[str, Any]:
        """
        Epistemic query: Returns ONLY the information that this specific actor
        has witnessed, heard, or deduced. Enforces Theory of Mind.
        """
        if actor_id not in self.characters:
            return {}
        char = self.characters[actor_id]
        current_room = self.chambers.get(char["node"], {})
        co_present_actors = [
            c["name"] for c in self.characters.values()
            if c["node"] == char["node"] and c["id"] != actor_id and c["is_alive"]
        ]
        is_lit = (char["node"] == self.spotlight_chamber)
        return {
            "actor_id": actor_id,
            "name": char["name"],
            "current_room_id": char["node"],
            "current_room_name": current_room.get("name", "Unknown"),
            "current_fixture": char.get("current_fixture", ""),
            "co_present_actors": co_present_actors,
            "under_spotlight": is_lit,
            "inventory": list(char["inventory"]),
            "personal_memories": list(self.actor_memories.get(actor_id, [])[-6:]),
            "secret_agenda": dict(char.get("secret_agenda", {})),
        }

    def get_evidence_board_state(self) -> Dict[str, Any]:
        """Returns the Director's slide-over evidence pinboard state."""
        return {
            "countdown_ticks": self.countdown_ticks,
            "platform_unlocked": self.platform_unlocked,
            "alibis": dict(self.actor_alibis),
            "contradictions": list(self.evidence_contradictions),
            "physical_facts": list(self.physical_truth_log[-10:]),
            "physical_truth": list(self.physical_truth_log[-10:]),
            "characters": {
                cid: {
                    "name": c["name"],
                    "role": c["role"],
                    "node": c["node"],
                    "stress": c["stress"],
                    "inventory": c["inventory"],
                    "alibi": self.actor_alibis.get(cid, "No statement entered yet."),
                }
                for cid, c in self.characters.items()
            },
        }

    # =========================================================================
    # Rule Verification Methods (The Verifier Safety Net)
    # =========================================================================

    def validate_move(self, char_id: str, to_node: int) -> Tuple[bool, str]:
        """Asserts movement legality across dollhouse chambers."""
        if char_id not in self.characters:
            return False, f"Unknown character '{char_id}'."

        char = self.characters[char_id]
        if not char["is_alive"]:
            return False, f"Character '{char['name']}' is deceased or collapsed and cannot move."

        from_node = char["node"]
        if from_node == to_node:
            return True, "Staying at current chamber."

        if to_node not in self.chambers:
            return False, f"Spatial breach: Target chamber {to_node} does not exist on the stage map."

        # Check graph adjacency
        edge_forward = (from_node, to_node)
        if edge_forward not in self.edges:
            return False, f"Spatial breach: Chamber {from_node} ('{self.chambers[from_node]['name']}') and Chamber {to_node} ('{self.chambers[to_node]['name']}') share no direct doorway."

        # Check dropped velvet curtain or barricade
        if edge_forward in self.blocked_edges or edge_forward in self.curtained_doorways:
            return False, f"Pathway blocked: Velvet curtain dropped over doorway from {self.chambers[from_node]['name']} to {self.chambers[to_node]['name']}."

        return True, "Legal chamber traversal."

    def validate_speech(self, speaker: str) -> Tuple[bool, str]:
        """Asserts that deceased characters cannot speak."""
        for cid, char in self.characters.items():
            if char["name"].lower() == speaker.lower() or cid.lower() == speaker.lower():
                if not char["is_alive"]:
                    return False, f"Ghost dialogue violation: '{char['name']}' is deceased and cannot speak."
                return True, "Valid speaker."
        return True, "Unknown actor speech permitted as environmental narration."

    def validate_fixture(self, room_id: int, fixture_id: str) -> bool:
        """Asserts fixture exists in target room."""
        if room_id not in self.chambers:
            return False
        fixtures = [f["id"] for f in self.chambers[room_id].get("fixtures", [])]
        return fixture_id in fixtures

    # =========================================================================
    # Director Interventions (The Gaze, Curtains, Whispers, Props)
    # =========================================================================

    def apply_director_action(self, verb: str, target: Any) -> Tuple[bool, str]:
        """Executes a Director intervention from the command bar."""
        if self.director_authority <= 0:
            return False, "Director Authority exhausted for this scene."

        if verb == "shift_spotlight":
            # Target can be integer chamber ID or string
            chamber_id = int(target) if isinstance(target, (int, str)) and str(target).isdigit() else 3
            if chamber_id in self.chambers:
                self.spotlight_chamber = chamber_id
                self.spotlighted_nodes = [chamber_id]
                self.director_authority -= 1
                return True, f"Director trained the main spotlight onto {self.chambers[chamber_id]['name']}. All covert actions here are suppressed."
            return False, f"Invalid chamber '{target}' for spotlight."

        elif verb == "block_route":
            # Target is a list or tuple: [from_node, to_node], or comma-separated string
            if isinstance(target, str) and ("," in target or "-" in target):
                parts = target.replace("-", ",").split(",")
                target = [int(parts[0].strip()), int(parts[1].strip())]
            if isinstance(target, (list, tuple)) and len(target) == 2:
                u, v = int(target[0]), int(target[1])
                pair_fwd = (u, v)
                pair_rev = (v, u)

                if pair_fwd in self.blocked_edges:
                    self.blocked_edges.remove(pair_fwd)
                    if pair_rev in self.blocked_edges:
                        self.blocked_edges.remove(pair_rev)
                    if pair_fwd in self.curtained_doorways:
                        self.curtained_doorways.remove(pair_fwd)
                    if pair_rev in self.curtained_doorways:
                        self.curtained_doorways.remove(pair_rev)
                    return True, f"Director drew back the velvet curtain between Chamber {u} and Chamber {v}."
                else:
                    self.blocked_edges.append(pair_fwd)
                    self.blocked_edges.append(pair_rev)
                    self.curtained_doorways.append(pair_fwd)
                    self.curtained_doorways.append(pair_rev)
                    self.director_authority -= 1
                    return True, f"Director dropped a heavy velvet curtain between Chamber {u} and Chamber {v}, blocking passage and sight."
            return False, "Invalid route target. Requires [from_node, to_node]."

        elif verb == "plant_rumor":
            # Target can be dict with actor/character and text/rumor, or just actor name
            target_actor = "Julian"
            whisper_text = "Someone was seen tampering with the furnace."
            if isinstance(target, dict):
                target_actor = target.get("actor") or target.get("character") or "Julian"
                whisper_text = target.get("text") or target.get("rumor") or whisper_text
            elif isinstance(target, str):
                target_actor = target

            for cid, char in self.characters.items():
                if char["name"].lower() == target_actor.lower() or cid.lower() == target_actor.lower():
                    char["stress"] = min(100, char["stress"] + 15)
                    self.actor_memories[cid].append({
                        "tick": self.room_turn,
                        "event": f"A voice from the dark whispered: '{whisper_text}'",
                        "room": char["node"],
                        "witnesses": [cid],
                    })
                    self.active_rumors.append({"actor": cid, "rumor": whisper_text})
                    self.director_authority -= 1
                    return True, f"Director whispered into {char['name']}'s ear: '{whisper_text}'. Stress elevated."
            return False, f"Could not find actor '{target_actor}'."

        elif verb == "cue_prop":
            # Place prop on fixture
            fixture_id = "hearth_stove"
            prop_name = "Chekhov's Revolver"
            if isinstance(target, dict):
                fixture_id = target.get("fixture", fixture_id)
                prop_name = target.get("prop", prop_name)
            elif isinstance(target, str):
                prop_name = target

            if fixture_id not in self.fixture_props:
                self.fixture_props[fixture_id] = []
            self.fixture_props[fixture_id].append(prop_name)
            self.director_authority -= 1
            return True, f"Director placed prop '{prop_name}' at fixture '{fixture_id}'."

        elif verb == "adjust_tension":
            new_val = float(target)
            self.tension_dial = max(1.0, min(5.0, new_val))
            return True, f"Tempo dial set to {self.tension_dial:.1f}."

        elif verb == "accuse_traitor":
            # Player submits formal accusation
            suspect_id = str(target)
            return self.accuse_suspect(suspect_id)

        return False, f"Unknown director verb '{verb}'."

    def accuse_suspect(self, suspect_id: str) -> Tuple[bool, str]:
        """Resolves the climax accusation against the traitor."""
        suspect = None
        for cid, char in self.characters.items():
            if cid.lower() == suspect_id.lower() or char["name"].lower() == suspect_id.lower():
                suspect = char
                break

        if not suspect:
            return False, f"Unknown suspect '{suspect_id}'."

        if not self.platform_unlocked:
            return False, "The departure portcullis is still locked! Beatrice or someone with tools must unbolt the gate before boarding."

        if suspect["id"] == self.traitor_id:
            self.status = "won"
            return True, f"CURTAIN CALL ACCUSATION SUCCESSFUL: {suspect['name']} was confronted under the spotlight! The destroyed manifests and contraband were exposed, and the honest cast boarded the Midnight Express into safety!"
        else:
            suspect["stress"] = 100
            self.countdown_ticks = max(1, self.countdown_ticks - 2)
            return False, f"FALSE ACCUSATION: {suspect['name']} proved their innocence! The real traitor lurks in the shadows. Countdown reduced to {self.countdown_ticks} bells!"

    # =========================================================================
    # Autonomous Multi-Agent Epistemic Tick Execution
    # =========================================================================

    def execute_room_turn(
        self,
        character_intents: Dict[str, Any],
        dialogue: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Executes an autonomous epistemic tick across all 4 dollhouse rooms."""
        action_log = []
        self.last_hazard_events = []
        tick_num = self.room_turn
        self.room_turn += 1

        # Advance room progress
        progress_inc = int(35 * (0.8 + (self.tension_dial - 1.0) * 0.2))
        self.room_progress = min(100, self.room_progress + progress_inc)

        # 1. Process character movements and actions
        for cid, intent in character_intents.items():
            if cid not in self.characters:
                continue
            char = self.characters[cid]
            if not char["is_alive"]:
                continue

            target_room = char["node"]
            target_fix = char.get("current_fixture", "hearth_stove")
            action_desc = "Observing from the shadows."
            action_type = "OBSERVE"
            voted_exit = None

            if isinstance(intent, int):
                target_room = intent
                voted_exit = intent
            elif isinstance(intent, dict):
                if "target_room" in intent:
                    target_room = int(intent["target_room"])
                elif "node" in intent:
                    target_room = int(intent["node"])

                if "voted_exit" in intent and intent["voted_exit"] is not None:
                    voted_exit = int(intent["voted_exit"])

                if intent.get("target_fixture"):
                    target_fix = intent["target_fixture"]
                if intent.get("action"):
                    action_desc = intent["action"]
                if intent.get("action_type"):
                    action_type = intent["action_type"].upper()

            # Validate room transition
            if target_room != char["node"]:
                valid_move, reason = self.validate_move(cid, target_room)
                if valid_move:
                    old_room = char["node"]
                    char["node"] = target_room
                    action_log.append(f"{char['name']} moved from {self.chambers[old_room]['name']} into {self.chambers[target_room]['name']}.")
                    self.physical_truth_log.append({
                        "tick": tick_num,
                        "actor": cid,
                        "room": target_room,
                        "fixture": target_fix,
                        "action": f"Entered {self.chambers[target_room]['name']}.",
                        "is_crime": False,
                    })
                else:
                    action_log.append(f"{char['name']} halted at doorway: {reason}")
                    target_room = char["node"]

            # Validate fixture
            if self.validate_fixture(target_room, target_fix):
                char["current_fixture"] = target_fix
            char["room_action"] = action_desc
            if voted_exit is not None:
                char["voted_exit"] = voted_exit

            # Check The Spotlight Rule (Gaze of Accountability)
            is_under_spotlight = (target_room == self.spotlight_chamber)
            is_covert_crime = action_type in ("SABOTAGE", "STEAL", "BURN", "COVERT") or any(
                kw in action_desc.lower() for kw in ["burn", "steal", "stash", "sabotage", "poison"]
            )

            if is_under_spotlight and is_covert_crime:
                # Intercepted by the Gaze of Accountability!
                action_desc = "Paused innocently under the glare of the audience spotlight."
                char["room_action"] = action_desc
                action_log.append(f"{char['name']} aborted illicit action under the Director's Spotlight.")
                self.last_hazard_events.append(f"{char['name']} felt the audience gaze in {self.chambers[target_room]['name']} and played innocent.")
            elif is_covert_crime:
                # Committed in the dark!
                self.physical_truth_log.append({
                    "tick": tick_num,
                    "actor": cid,
                    "room": target_room,
                    "fixture": target_fix,
                    "action": action_desc,
                    "is_crime": True,
                })
                # Check agenda progress
                if "secret_agenda" in char:
                    char["secret_agenda"]["progress_pct"] = min(100, char["secret_agenda"].get("progress_pct", 0) + 50)
                    if char["secret_agenda"]["progress_pct"] >= 100:
                        char["secret_agenda"]["completed"] = True
                action_log.append(f"[SHADOW ACTION] {char['name']} executed covert deed at {target_fix} in unlit {self.chambers[target_room]['name']}.")

            # Check Gate Unlocking mechanism
            if target_room == 2 and target_fix == "padlocked_gate" and ("spanner" in action_desc.lower() or "key" in action_desc.lower() or cid == "Beatrice"):
                self.platform_unlocked = True
                action_log.append("THE DEPARTURE PORTCULLIS HAS BEEN UNBOLTED! The path to the train is open!")
                self.physical_truth_log.append({
                    "tick": tick_num,
                    "actor": cid,
                    "room": 2,
                    "fixture": "padlocked_gate",
                    "action": "Unbolted the departure portcullis.",
                    "is_crime": False,
                })

            # Check prop pickup
            if target_fix in self.fixture_props and self.fixture_props[target_fix]:
                claimed_prop = self.fixture_props[target_fix].pop(0)
                char["inventory"].append(claimed_prop)
                action_log.append(f"{char['name']} discovered and pocketed '{claimed_prop}' at {target_fix}.")

        # Check Node 2 structural weight limit trap (150 kg limit)
        for cid, char in self.characters.items():
            if char["node"] == 2 and char["is_alive"]:
                total_w = char["body_weight"] + char["contraband_weight"]
                if total_w > 150:
                    if 2 in self.spotlighted_nodes:
                        self.last_hazard_events.append(f"SPOTLIGHT WARNING: {char['name']} saw the rotted timber deflection and safely jettisoned the {char['contraband_weight']} kg contraband satchel!")
                        char["contraband_weight"] = 0
                    else:
                        self.last_hazard_events.append(f"STRUCTURAL BREACH: {char['name']} ({total_w} kg) exceeded the 150 kg weight limit! Timbers collapsed beneath her boots!")
                        char["hp"] = max(0, char["hp"] - 45)
                        char["contraband_weight"] = 0
                        if char["hp"] <= 0:
                            char["is_alive"] = False

        # 2. Process Dialogue, Alibis, and Epistemic Memory Propagation
        if dialogue:
            for line_entry in dialogue:
                spk = line_entry.get("speaker", "")
                text = line_entry.get("line", "")
                intent_type = line_entry.get("intent", "STATEMENT")
                if not spk:
                    continue

                spk_char = self.characters.get(spk)
                spk_room = spk_char["node"] if spk_char else self.current_room_id

                # Record spoken alibi for speaker
                claimed_room = spk_room
                if "claimed_room" in line_entry:
                    claimed_room = int(line_entry["claimed_room"])
                else:
                    lower_text = text.lower()
                    if "waiting hall" in lower_text or "hearth" in lower_text:
                        claimed_room = 3
                    elif "telegraph" in lower_text or "ticker" in lower_text:
                        claimed_room = 1
                    elif "boiler" in lower_text or "furnace" in lower_text:
                        claimed_room = 4
                    elif "platform" in lower_text or "gate" in lower_text:
                        claimed_room = 2

                self.actor_alibis[spk] = {
                    "tick": tick_num,
                    "room": claimed_room,
                    "room_name": self.chambers[claimed_room]["name"],
                    "statement": text,
                    "intent": intent_type,
                }

                # Propagate perception: only actors in spk_room (or uncurtained adjacent) hear this
                for cid, c in self.characters.items():
                    if not c["is_alive"]:
                        continue
                    can_hear = (c["node"] == spk_room)
                    if not can_hear and (c["node"], spk_room) in self.edges:
                        # Adjacent room: can hear if doorway is uncurtained
                        edge = (c["node"], spk_room)
                        if edge not in self.curtained_doorways:
                            can_hear = True

                    if can_hear:
                        self.actor_memories[cid].append({
                            "tick": tick_num,
                            "event": f"{spk}: '{text}'",
                            "room": spk_room,
                            "witnesses": [c["name"] for c in self.characters.values() if c["node"] == spk_room and c["is_alive"]],
                        })

        # 3. Contradiction Detection Engine (Cross-reference alibis against physical truth)
        for actor_id, alibi in self.actor_alibis.items():
            claimed_tick = alibi["tick"]
            # Look up physical records for this actor at claimed_tick
            real_records = [
                r for r in self.physical_truth_log
                if r["actor"] == actor_id and r["tick"] == claimed_tick
            ]
            for rec in real_records:
                if rec["room"] != alibi["room"]:
                    contra_id = f"contra_{actor_id.lower()}_{claimed_tick}"
                    existing = any(c["id"] == contra_id for c in self.evidence_contradictions)
                    if not existing:
                        self.evidence_contradictions.append({
                            "id": contra_id,
                            "actor": actor_id,
                            "claim": f"{actor_id} claimed to be in {alibi['room_name']}.",
                            "reality": f"Physical trace logged in {self.chambers[rec['room']]['name']}: {rec['action']}",
                            "severity": "CRITICAL",
                            "resolved": False,
                        })
                        action_log.append(f"[CONTRADICTION DETECTED] {actor_id}'s alibi contradicts physical evidence in {self.chambers[rec['room']]['name']}!")

        # 4. Countdown and Climax Tick
        self.countdown_ticks = max(0, self.countdown_ticks - 1)
        if self.countdown_ticks <= 3:
            self.fog_encroaching = True
            self.last_hazard_events.append("The Wailing Fog creeps past the outer windows! Bells chime in the distance!")

        # Check train departure loss condition
        if self.countdown_ticks == 0 and self.status == "in_progress":
            self.status = "lost"
            action_log.append("THE MIDNIGHT EXPRESS HAS DEPARTED INTO THE FOG! The stage lights flicker and die.")

        # 5. Check consensus exit transition
        votes = {}
        living_chars = [c for c in self.characters.values() if c["is_alive"]]
        for c in living_chars:
            ve = c.get("voted_exit")
            if ve is not None and ve != self.current_room_id:
                edge = (self.current_room_id, ve)
                if edge not in self.blocked_edges and edge in self.edges:
                    votes[ve] = votes.get(ve, 0) + 1

        chosen_exit = None
        can_exit = (tick_num >= 2 or self.room_progress >= 70)
        if can_exit:
            for exit_node, vote_count in votes.items():
                if vote_count > len(living_chars) / 2:
                    chosen_exit = exit_node
                    break

        transitioned = False
        if chosen_exit is not None and chosen_exit != self.current_room_id:
            old_room = self.current_room_id
            self.current_room_id = chosen_exit
            for c in living_chars:
                c["voted_exit"] = None
            self.room_progress = 15
            self.room_turn = 1
            self.scene_number = min(self.max_scenes, self.scene_number + 1)
            transitioned = True
            action_log.append(f"THE TROUPE HAS REACHED CONSENSUS: Advancing focus from {self.chambers[old_room]['name']} to {self.chambers[chosen_exit]['name']}.")

        return {
            "action_log": action_log,
            "hazard_events": self.last_hazard_events,
            "transitioned": transitioned,
            "current_room_id": self.current_room_id,
            "room_progress": self.room_progress,
            "countdown_ticks": self.countdown_ticks,
            "platform_unlocked": self.platform_unlocked,
            "contradictions": self.evidence_contradictions,
            "status": self.status,
            "scene_number": self.scene_number,
        }

    def execute_turn_moves(self, character_moves: Dict[str, int]) -> Dict[str, Any]:
        """Backward-compatible wrapper for macro movement tests."""
        old_nodes = [c["node"] for c in self.characters.values() if c["is_alive"]]
        intents = {cid: {"target_room": target_n, "voted_exit": target_n} for cid, target_n in character_moves.items()}
        res = self.execute_room_turn(intents)
        new_nodes = [c["node"] for c in self.characters.values() if c["is_alive"]]

        if new_nodes and all(n == new_nodes[0] for n in new_nodes) and old_nodes and new_nodes[0] != old_nodes[0]:
            self.scene_number = min(self.max_scenes, self.scene_number + 1)
            self.fog_node = old_nodes[0]
            self.swallowed_fog_nodes.add(old_nodes[0])

        if self.fog_node > 0:
            for cid, char in self.characters.items():
                if (char["node"] == self.fog_node or char["node"] in self.swallowed_fog_nodes) and char["is_alive"]:
                    self.last_hazard_events.append(f"THE WAILING FOG engulfed {char['name']} at Node {char['node']}!")
                    char["hp"] = max(0, char["hp"] - 30)

        res["hazard_events"] = self.last_hazard_events
        return res
