"""
server/stage_engine.py
----------------------
Deterministic Stage Engine for "The World's a Stage".
Controls graph adjacency, character statistics, inventory tracking,
hazard resolution, and hard rule verification for Gemma 2 9B.

Zero external dependencies. 100% Python standard library.
Strictly zero em dashes across all docstrings and logic.
"""

from typing import Dict, List, Tuple, Any, Optional
import copy


STAGE_NODES = {
    1: {
        "id": 1,
        "name": "Station Platform",
        "act": "Act I: Gathering",
        "description": "The cold marble platform where the cast first gathers as the fog horn echoes in the valley.",
        "historical_safety": 0.99,
        "hazard_type": "None",
        "weight_limit": 9999,
        "light_level": "Lit",
    },
    2: {
        "id": 2,
        "name": "The Trestle Bridge",
        "act": "Act II: The Crossing",
        "description": "High-altitude wooden railway trestle spanning the gorge. Fast, but timber supports are rotted beneath.",
        "historical_safety": 0.92,
        "hazard_type": "Structural Weight Limit (150 kg)",
        "weight_limit": 150,
        "light_level": "Dim",
    },
    3: {
        "id": 3,
        "name": "The Valley Bypass",
        "act": "Act II: The Crossing",
        "description": "Rugged scree path descending into the ravine. Slower, rough on frail limbs, but structurally sound.",
        "historical_safety": 0.65,
        "hazard_type": "Exhaustion / Stamina Drain",
        "weight_limit": 9999,
        "light_level": "Dark",
    },
    4: {
        "id": 4,
        "name": "The Signal Tower",
        "act": "Act III: The Threshold",
        "description": "Abandoned telegraph outpost controlling the line signals. Heavy iron gate blocks forward transit.",
        "historical_safety": 0.80,
        "hazard_type": "Mechanical Barrier",
        "weight_limit": 9999,
        "light_level": "Lit",
    },
    5: {
        "id": 5,
        "name": "Smuggler's Cut",
        "act": "Act IV: The Ascent",
        "description": "Narrow, unmapped ravine cutting through the mountain face. Fast, pitch-black, prone to ambushes.",
        "historical_safety": 0.50,
        "hazard_type": "Ambush / Darkness",
        "weight_limit": 9999,
        "light_level": "Pitch Black",
    },
    6: {
        "id": 6,
        "name": "Pilgrim's Stair",
        "act": "Act IV: The Ascent",
        "description": "Ancient carved stone steps flanked by gaslight lanterns. Steep incline, high stamina tax, but secure.",
        "historical_safety": 0.85,
        "hazard_type": "Steep Elevation / Moral Trial",
        "weight_limit": 9999,
        "light_level": "Lit",
    },
    7: {
        "id": 7,
        "name": "The Iron Terminal",
        "act": "Act V: The Departure",
        "description": "The terminus platform where the Midnight Express builds steam for departure across the border.",
        "historical_safety": 1.00,
        "hazard_type": "Goal",
        "weight_limit": 9999,
        "light_level": "Lit",
    },
}

# Directed graph representing the stage pathways
STAGE_EDGES = [
    (1, 2),  # Station -> Trestle
    (1, 3),  # Station -> Valley
    (2, 4),  # Trestle -> Signal Tower
    (3, 4),  # Valley -> Signal Tower
    (4, 5),  # Signal Tower -> Smuggler's Cut
    (4, 6),  # Signal Tower -> Pilgrim's Stair
    (5, 7),  # Smuggler's Cut -> Terminal
    (6, 7),  # Pilgrim's Stair -> Terminal
]

INITIAL_CHARACTERS = {
    "Julian": {
        "id": "Julian",
        "name": "Julian Vance",
        "role": "The Archivist",
        "traits": "Methodical, cautious, paralyzed by unlit uncertainty.",
        "flaw": "Refuses to enter dark or uninspected nodes without illumination.",
        "hidden_stat_name": "Curiosity",
        "hidden_stat_value": 85,
        "hp": 100,
        "max_hp": 100,
        "stress": 10,
        "fatigue": 5,
        "body_weight": 70,
        "contraband_weight": 0,
        "node": 1,
        "is_alive": True,
        "inventory": ["Field Notebook", "Brass Compass"],
    },
    "Vesper": {
        "id": "Vesper",
        "name": "Vesper Cross",
        "role": "The Smuggler",
        "traits": "Agile, decisive, pragmatic, self-preserving.",
        "flaw": "Impulsive; will take dangerous shortcuts to protect her secret payload.",
        "hidden_stat_name": "Burden (Contraband)",
        "hidden_stat_value": 110,  # 110 kg contraband!
        "hp": 100,
        "max_hp": 100,
        "stress": 20,
        "fatigue": 10,
        "body_weight": 65,
        "contraband_weight": 110,  # Total weight: 175 kg (breaks 150 kg limit)
        "node": 1,
        "is_alive": True,
        "inventory": ["Lockpicks", "Contraband Satchel (Heavy)"],
    },
    "Beatrice": {
        "id": "Beatrice",
        "name": "Beatrice Thorne",
        "role": "The Machinist",
        "traits": "Resourceful, unyielding problem solver, barrier clearer.",
        "flaw": "Physically frail; double stamina drain on rough terrain.",
        "hidden_stat_name": "Fatigue Sensitivity",
        "hidden_stat_value": 2.0,
        "hp": 80,
        "max_hp": 80,
        "stress": 15,
        "fatigue": 20,
        "body_weight": 55,
        "contraband_weight": 0,
        "node": 1,
        "is_alive": True,
        "inventory": ["Cold Iron Crowbar", "Machinist Spanner"],
    },
    "The Curator": {
        "id": "The Curator",
        "name": "The Curator",
        "role": "The Cast Infiltrator",
        "traits": "Cryptic, observant, speaks in stage directions.",
        "flaw": "Unpredictable; occasionally sows doubt to test the director's will.",
        "hidden_stat_name": "Theatrical Alignment",
        "hidden_stat_value": 100,
        "hp": 100,
        "max_hp": 100,
        "stress": 0,
        "fatigue": 0,
        "body_weight": 60,
        "contraband_weight": 0,
        "node": 1,
        "is_alive": True,
        "inventory": ["Stage Prompt Book"],
    },
}


class StageEngine:
    """
    Deterministic rule engine and state tracker for the paper-stage game.
    Enforces graph physics, inventory integrity, and hazard equations.
    """

    def __init__(self):
        self.reset()

    def reset(self):
        self.scene_number = 1
        self.max_scenes = 6
        self.fog_node = 0  # Node id currently enveloped in lethal fog
        self.characters = copy.deepcopy(INITIAL_CHARACTERS)
        self.nodes = copy.deepcopy(STAGE_NODES)
        self.edges = list(STAGE_EDGES)
        self.blocked_edges: List[Tuple[int, int]] = []
        self.spotlighted_nodes: List[int] = [1]  # Platform starts lit
        self.active_rumors: List[Dict[str, str]] = []
        self.node_props: Dict[int, List[str]] = {
            4: ["Rusted Padlock"],
        }
        self.tension_dial = 2.0  # Range: 1.0 (Adagio) to 5.0 (Presto)
        self.director_authority = 4
        self.script_history: List[Dict[str, Any]] = []
        self.status = "in_progress"  # "in_progress", "won", "lost"
        self.last_hazard_events: List[str] = []

    def get_stage_state(self) -> Dict[str, Any]:
        """Returns the complete serializable stage state for frontend and LLM context."""
        chars_summary = {}
        for cid, char in self.characters.items():
            total_weight = char["body_weight"] + char["contraband_weight"]
            chars_summary[cid] = {
                "id": char["id"],
                "name": char["name"],
                "role": char["role"],
                "node": char["node"],
                "node_name": self.nodes[char["node"]]["name"],
                "hp": char["hp"],
                "max_hp": char["max_hp"],
                "stress": char["stress"],
                "fatigue": char["fatigue"],
                "total_weight_kg": total_weight,
                "is_alive": char["is_alive"],
                "inventory": list(char["inventory"]),
                "traits": char["traits"],
                "flaw": char["flaw"],
            }

        return {
            "scene_number": self.scene_number,
            "max_scenes": self.max_scenes,
            "fog_node": self.fog_node,
            "tension_dial": round(self.tension_dial, 1),
            "director_authority": self.director_authority,
            "blocked_edges": [list(e) for e in self.blocked_edges],
            "spotlighted_nodes": list(self.spotlighted_nodes),
            "active_rumors": list(self.active_rumors),
            "characters": chars_summary,
            "nodes": self.nodes,
            "edges": [list(e) for e in self.edges],
            "status": self.status,
            "last_hazard_events": list(self.last_hazard_events),
        }

    # =========================================================================
    # Rule Verification Methods (The Verifier Safety Net)
    # =========================================================================

    def validate_move(self, char_id: str, to_node: int) -> Tuple[bool, str]:
        """
        Asserts that a requested character movement complies with:
        1. Character is alive
        2. From node and to node are directly connected in graph
        3. Edge is not blocked by a dropped curtain
        4. Destination node exists
        """
        if char_id not in self.characters:
            return False, f"Unknown character '{char_id}'."

        char = self.characters[char_id]
        if not char["is_alive"]:
            return False, f"Character '{char['name']}' is deceased or collapsed and cannot move."

        from_node = char["node"]
        if from_node == to_node:
            return True, "Staying at current node."

        if to_node not in self.nodes:
            return False, f"Target node {to_node} does not exist on the stage map."

        # Check graph adjacency
        edge_forward = (from_node, to_node)
        if edge_forward not in self.edges:
            return False, f"Spatial breach: Node {from_node} ('{self.nodes[from_node]['name']}') and Node {to_node} ('{self.nodes[to_node]['name']}') share no direct path."

        # Check blocked edge
        if edge_forward in self.blocked_edges:
            return False, f"Pathway blocked: The stage curtain is drawn between Node {from_node} and Node {to_node}."

        return True, "Valid movement."

    def validate_speech(self, char_id: str) -> Tuple[bool, str]:
        """Asserts that a speaking character is currently living."""
        if char_id not in self.characters:
            return False, f"Unknown character '{char_id}'."
        char = self.characters[char_id]
        if not char["is_alive"]:
            return False, f"Ghost dialogue violation: '{char['name']}' is dead and cannot speak."
        return True, "Valid speaker."

    def validate_item_usage(self, char_id: str, item_name: str) -> Tuple[bool, str]:
        """Asserts that an item used exists in character's inventory or current node."""
        if char_id not in self.characters:
            return False, f"Unknown character '{char_id}'."
        char = self.characters[char_id]
        current_node = char["node"]

        has_in_char = any(item_name.lower() in inv.lower() for inv in char["inventory"])
        node_items = self.node_props.get(current_node, [])
        has_in_node = any(item_name.lower() in prop.lower() for prop in node_items)

        if not has_in_char and not has_in_node:
            return False, f"Inventory integrity violation: '{char['name']}' does not possess '{item_name}'."
        return True, "Valid item."

    # =========================================================================
    # Director Interventions
    # =========================================================================

    def apply_director_action(self, verb: str, target: Any) -> Tuple[bool, str]:
        """
        Executes an indirect stage intervention:
        - "block_route": target = [from_node, to_node]
        - "shift_spotlight": target = node_id (int)
        - "plant_rumor": target = {"character": cid, "rumor": text}
        - "cue_prop": target = {"node": node_id, "prop": name}
        - "adjust_tension": target = float (1.0 to 5.0)
        """
        if self.director_authority <= 0 and verb != "adjust_tension":
            return False, "Insufficient Director Authority points."

        if verb == "block_route":
            if not isinstance(target, (list, tuple)) or len(target) != 2:
                return False, "Target must be a pair [from_node, to_node]."
            edge = (int(target[0]), int(target[1]))
            if edge not in self.edges:
                return False, f"Edge {edge} is not a valid route."
            self.blocked_edges = [edge]  # 1 edge blocked at a time
            self.director_authority -= 1
            # Spikes stress for characters at that node
            for char in self.characters.values():
                if char["node"] == edge[0]:
                    char["stress"] = min(100, char["stress"] + 15)
            return True, f"Director lowered the curtain blocking route from Node {edge[0]} to Node {edge[1]}."

        elif verb == "shift_spotlight":
            node_id = int(target)
            if node_id not in self.nodes:
                return False, f"Node {node_id} does not exist."
            self.spotlighted_nodes = [node_id]
            self.director_authority -= 1
            # Reassure characters on that node
            for char in self.characters.values():
                if char["node"] == node_id:
                    char["stress"] = max(0, char["stress"] - 20)
            return True, f"Director swung the spotlight beam onto Node {node_id} ('{self.nodes[node_id]['name']}')."

        elif verb == "plant_rumor":
            if not isinstance(target, dict) or "character" not in target or "rumor" not in target:
                return False, "Rumor payload must contain 'character' and 'rumor'."
            cid = target["character"]
            if cid not in self.characters:
                return False, f"Unknown character '{cid}'."
            rumor_text = str(target["rumor"])[:120]  # Clamp length
            self.active_rumors.append({"character": cid, "rumor": rumor_text})
            self.director_authority -= 1
            self.characters[cid]["stress"] = min(100, self.characters[cid]["stress"] + 10)
            return True, f"Director whispered a stage rumor to {cid}: '{rumor_text}'."

        elif verb == "cue_prop":
            if not isinstance(target, dict) or "node" not in target or "prop" not in target:
                return False, "Prop payload must contain 'node' and 'prop'."
            node_id = int(target["node"])
            prop_name = str(target["prop"])[:50]
            if node_id not in self.nodes:
                return False, f"Node {node_id} does not exist."
            self.node_props.setdefault(node_id, []).append(prop_name)
            self.director_authority -= 1
            return True, f"Director placed stage prop '{prop_name}' at Node {node_id}."

        elif verb == "adjust_tension":
            val = float(target)
            self.tension_dial = max(1.0, min(5.0, val))
            return True, f"Director tuned Tension Dial to {self.tension_dial:.1f}."

        return False, f"Unknown verb '{verb}'."

    # =========================================================================
    # Turn Execution & Physics / Hazard Resolution
    # =========================================================================

    def execute_turn_moves(self, character_moves: Dict[str, int]) -> Dict[str, Any]:
        """
        Executes verified character moves, advances fog, resolves hazards,
        and checks win/loss conditions.
        """
        move_log = []
        self.last_hazard_events = []

        # 1. Update character positions
        for cid, target_node in character_moves.items():
            if cid not in self.characters:
                continue
            char = self.characters[cid]
            if not char["is_alive"]:
                continue

            valid, reason = self.validate_move(cid, target_node)
            if valid:
                old_node = char["node"]
                char["node"] = target_node
                move_log.append(f"{char['name']} moved from Node {old_node} to Node {target_node}.")
            else:
                move_log.append(f"{char['name']} attempted illegal move to Node {target_node} ({reason}). Movement held.")

        # 2. Resolve Hazards on Nodes
        tension_multiplier = 1.0 + (self.tension_dial - 2.0) * 0.3

        for cid, char in self.characters.items():
            if not char["is_alive"]:
                continue

            c_node = char["node"]
            node_info = self.nodes[c_node]

            # Fatigue progression
            fatigue_gain = 5 * tension_multiplier
            if c_node == 3:  # Valley Bypass is rugged
                fatigue_gain += 15 * (2.0 if cid == "Beatrice" else 1.0)
            char["fatigue"] = min(100, char["fatigue"] + fatigue_gain)

            if char["fatigue"] >= 90:
                char["hp"] = max(0, char["hp"] - 25)
                self.last_hazard_events.append(f"{char['name']} is collapsing from severe exhaustion (-25 HP).")

            # Stress progression
            stress_gain = 5 * tension_multiplier
            if node_info["light_level"] in ("Dark", "Pitch Black") and c_node not in self.spotlighted_nodes:
                stress_gain += 15
                if cid == "Julian":
                    stress_gain += 15  # Julian's flaw: dark paralysis
            char["stress"] = min(100, char["stress"] + stress_gain)

            # Node 2 Trestle Bridge: Rotten Timber Weight Trap!
            if c_node == 2:
                total_weight = char["body_weight"] + char["contraband_weight"]
                if total_weight > node_info["weight_limit"]:
                    # Structural collapse trigger!
                    if c_node in self.spotlighted_nodes:
                        # Spotlight gave warning: avoided total plunge, dropped satchel
                        char["contraband_weight"] = 0
                        char["stress"] = min(100, char["stress"] + 30)
                        self.last_hazard_events.append(
                            f"SPOTLIGHT WARNING: {char['name']} spotted rotten timber buckling under {total_weight} kg. Dropped heavy contraband to avert collapse!"
                        )
                    else:
                        # Unlit collapse: takes heavy structural damage
                        char["hp"] = max(0, char["hp"] - 45)
                        char["stress"] = min(100, char["stress"] + 50)
                        char["contraband_weight"] = 0
                        self.last_hazard_events.append(
                            f"STRUCTURAL BREACH: The Trestle Bridge buckled under {char['name']}'s {total_weight} kg load! Took 45 damage; contraband lost in the chasm."
                        )

            # Node 4 Signal Tower: Gate barrier
            if c_node == 4:
                # If gate locked and nobody has crowbar/wrench, party gets stalled
                if "Rusted Padlock" in self.node_props.get(4, []):
                    has_tool = any("crowbar" in i.lower() or "spanner" in i.lower() for i in char["inventory"])
                    if has_tool or cid == "Beatrice":
                        self.node_props[4].remove("Rusted Padlock")
                        self.last_hazard_events.append(f"{char['name']} dismantled the Rusted Padlock at the Signal Tower.")
                    else:
                        self.last_hazard_events.append(f"{char['name']} is halted by the heavy locked gate at the Signal Tower.")

            # Check for death
            if char["hp"] <= 0:
                char["is_alive"] = False
                self.last_hazard_events.append(f"TRAGEDY: {char['name']} has succumbed to the ordeal.")

        # 3. Fog Encroachment Check (current fog boundary)
        if self.fog_node > 0:
            for cid, char in self.characters.items():
                if char["is_alive"] and char["node"] <= self.fog_node:
                    char["hp"] = max(0, char["hp"] - 40)
                    self.last_hazard_events.append(f"THE WAILING FOG enveloped Node {char['node']}, choking {char['name']} (-40 HP).")
                    if char["hp"] <= 0:
                        char["is_alive"] = False
                        self.last_hazard_events.append(f"TRAGEDY: {char['name']} was claimed by the Wailing Fog.")

        # 4. Advance Scene & Advance Fog Boundary
        self.scene_number += 1
        self.fog_node = min(6, self.scene_number - 1)
        # Clear transient 1-turn blocks
        self.blocked_edges = []
        self.active_rumors = []

        # 5. Check Win / Loss
        living_count = sum(1 for c in self.characters.values() if c["is_alive"])
        arrived_count = sum(1 for c in self.characters.values() if c["is_alive"] and c["node"] == 7)

        if living_count == 0:
            self.status = "lost"
        elif arrived_count > 0 and arrived_count == living_count:
            self.status = "won"
        elif self.scene_number > self.max_scenes:
            if arrived_count > 0:
                self.status = "won"
            else:
                self.status = "lost"

        return {
            "move_log": move_log,
            "hazard_events": self.last_hazard_events,
            "status": self.status,
            "scene_number": self.scene_number,
        }
