"""
server/stage_engine.py
----------------------
Deterministic Stage Engine for "The World's a Stage".
Supports dual-layer theater architecture:
1. Macro Layer: Roguelike branching route tree across the Victorian mountain pass.
2. Micro Layer: Playable room stage dioramas with interactive fixtures, freeform cast
   movement, natural progressive drama, and exit consensus mechanics.

Controls physical constraints, structural weight limits, inventory tracking,
hazard resolution, and hard rule verification for Gemma 2 9B.

Zero external dependencies. 100% Python standard library.
Strictly zero em dashes across all docstrings, comments, and logic.
"""

from typing import Dict, List, Tuple, Any, Optional
import copy


STAGE_NODES = {
    1: {
        "id": 1,
        "name": "Station Office",
        "act": "Act I: Gathering",
        "description": "The cold marble ticket hall and telegraph post where the cast first gathers as the fog horn echoes in the valley.",
        "historical_safety": 0.99,
        "hazard_type": "None",
        "weight_limit": 9999,
        "light_level": "Lit",
        "default_fixture": "stove",
        "fixtures": [
            {
                "id": "telegraph",
                "name": "Telegraph Desk",
                "x": 190,
                "y": 140,
                "type": "terminal",
                "desc": "Brass keys and ticker tape recording distant train manifests and mountain closure warnings.",
            },
            {
                "id": "stove",
                "name": "Iron Stove & Benches",
                "x": 380,
                "y": 120,
                "type": "rest",
                "desc": "Glowing coal embers radiating heat against the biting mountain frost.",
            },
            {
                "id": "floorboards",
                "name": "Rotted Floorboards",
                "x": 280,
                "y": 240,
                "type": "hazard",
                "desc": "Creaking floorboards concealing a dark maintenance trapdoor beneath.",
            },
            {
                "id": "cabinets",
                "name": "Filing Cabinets",
                "x": 560,
                "y": 140,
                "type": "archive",
                "desc": "Company archives detailing bridge load ratings and ravine surveying maps.",
            },
        ],
        "exits": [
            {
                "target_node": 2,
                "name": "Upper Door to Trestle Watchpost",
                "edge": [1, 2],
                "x": 720,
                "y": 95,
                "desc": "High-altitude wooden railway route. Fast, but timber supports are rotted beneath.",
            },
            {
                "target_node": 3,
                "name": "Lower Hatch to Ravine Shelter",
                "edge": [1, 3],
                "x": 720,
                "y": 240,
                "desc": "Rugged scree path descending into the ravine. Slower, structurally sound, but exhausting.",
            },
        ],
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
        "default_fixture": "observation",
        "fixtures": [
            {
                "id": "observation",
                "name": "Observation Balcony",
                "x": 200,
                "y": 130,
                "type": "lookout",
                "desc": "Wind-swept timber platform overlooking the mist-shrouded chasm.",
            },
            {
                "id": "rotted_timber",
                "name": "Buckling Timber Span",
                "x": 390,
                "y": 220,
                "type": "hazard",
                "desc": "Fragile trestle beams. Weight threshold is strictly 150 kg before structural failure!",
            },
            {
                "id": "winch",
                "name": "Emergency Winch",
                "x": 270,
                "y": 230,
                "type": "terminal",
                "desc": "Cable drum and brake lever designed for emergency cargo transport across the gorge.",
            },
            {
                "id": "lantern_post",
                "name": "Lantern Perch",
                "x": 560,
                "y": 120,
                "type": "rest",
                "desc": "Flickering oil beacon piercing through the high-altitude cloud cover.",
            },
        ],
        "exits": [
            {
                "target_node": 4,
                "name": "Iron Gate to Signal Tower",
                "edge": [2, 4],
                "x": 720,
                "y": 160,
                "desc": "Heavy spiked gate leading into the junction telegraph outpost.",
            },
        ],
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
        "default_fixture": "hearth",
        "fixtures": [
            {
                "id": "hearth",
                "name": "Cavern Hearth",
                "x": 200,
                "y": 130,
                "type": "rest",
                "desc": "Stone fireplace carved into the canyon wall offering shelter from the howling wind.",
            },
            {
                "id": "scree_bed",
                "name": "Rough Scree Trench",
                "x": 390,
                "y": 230,
                "type": "hazard",
                "desc": "Sharp loose shale and rocky incline; severe stamina tax for frail travelers.",
            },
            {
                "id": "mine_cart",
                "name": "Abandoned Ore Cart",
                "x": 560,
                "y": 140,
                "type": "archive",
                "desc": "Derelict mining cart containing discarded mountaineering ironware and pitons.",
            },
            {
                "id": "spring",
                "name": "Thermal Vent",
                "x": 280,
                "y": 220,
                "type": "rest",
                "desc": "Natural thermal vent warming the cold cavern air.",
            },
        ],
        "exits": [
            {
                "target_node": 4,
                "name": "Tunnel Up to Signal Tower",
                "edge": [3, 4],
                "x": 720,
                "y": 160,
                "desc": "Ascending stone staircase cut into the cliff leading to the telegraph tower.",
            },
        ],
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
        "default_fixture": "switchboard",
        "fixtures": [
            {
                "id": "switchboard",
                "name": "Track Switchboard",
                "x": 200,
                "y": 130,
                "type": "terminal",
                "desc": "Telegraph relay switches and brass dials controlling the mountain junction.",
            },
            {
                "id": "gate_lock",
                "name": "Chained Security Gate",
                "x": 400,
                "y": 210,
                "type": "hazard",
                "desc": "Heavy iron gate secured with a rusted padlock. Requires crowbar or spanner to pry.",
            },
            {
                "id": "lookout",
                "name": "Signal Balk Window",
                "x": 570,
                "y": 120,
                "type": "lookout",
                "desc": "High bay window with sightlines across the northern ascent routes.",
            },
            {
                "id": "heater",
                "name": "Cast-Iron Heater",
                "x": 270,
                "y": 230,
                "type": "rest",
                "desc": "Warm coal stove keeping instruments from seizing in the freeze.",
            },
        ],
        "exits": [
            {
                "target_node": 5,
                "name": "Door to Smuggler's Cut",
                "edge": [4, 5],
                "x": 720,
                "y": 95,
                "desc": "Narrow, unmapped ravine cutting through the mountain face. Fast, pitch-black, prone to ambushes.",
            },
            {
                "target_node": 6,
                "name": "Portal to Mountain Chapel",
                "edge": [4, 6],
                "x": 720,
                "y": 240,
                "desc": "Ancient carved stone steps flanked by gaslight lanterns. Steep incline, secure passage.",
            },
        ],
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
        "default_fixture": "defile",
        "fixtures": [
            {
                "id": "defile",
                "name": "Narrow Defile",
                "x": 210,
                "y": 140,
                "type": "hazard",
                "desc": "Shadowed granite fissure with sheer walls on either side.",
            },
            {
                "id": "crevasse",
                "name": "Pitch-Black Crevasse",
                "x": 400,
                "y": 220,
                "type": "hazard",
                "desc": "Unlit chasm where echoes vanish. Treacherous footing in darkness.",
            },
            {
                "id": "stash",
                "name": "Concealed Stash",
                "x": 560,
                "y": 130,
                "type": "archive",
                "desc": "Hollowed boulder containing old smuggling cache and route notes.",
            },
            {
                "id": "ledge",
                "name": "Scout's Ledge",
                "x": 290,
                "y": 230,
                "type": "lookout",
                "desc": "Rocky ledge offering a glimpse of the illuminated terminal platform ahead.",
            },
        ],
        "exits": [
            {
                "target_node": 7,
                "name": "Gateway to Terminal Platform",
                "edge": [5, 7],
                "x": 720,
                "y": 160,
                "desc": "Iron archway opening directly out onto the departure tracks.",
            },
        ],
    },
    6: {
        "id": 6,
        "name": "Mountain Chapel",
        "act": "Act IV: The Ascent",
        "description": "Ancient carved stone steps flanked by gaslight lanterns. Steep incline, high stamina tax, but secure.",
        "historical_safety": 0.85,
        "hazard_type": "Steep Elevation / Moral Trial",
        "weight_limit": 9999,
        "light_level": "Lit",
        "default_fixture": "altar",
        "fixtures": [
            {
                "id": "altar",
                "name": "Carved Stone Altar",
                "x": 220,
                "y": 130,
                "type": "rest",
                "desc": "Ancient sanctuary offering solace and hope to passing wayfarers.",
            },
            {
                "id": "fresco",
                "name": "Fresco of the Wayfarer",
                "x": 410,
                "y": 110,
                "type": "archive",
                "desc": "Mural showing travelers navigating safely past the wailing fog.",
            },
            {
                "id": "belfry",
                "name": "Belfry Bell Rope",
                "x": 570,
                "y": 140,
                "type": "terminal",
                "desc": "Bronze bell that tolls across the valley to guide travelers in the fog.",
            },
            {
                "id": "font",
                "name": "Holy Water Font",
                "x": 280,
                "y": 230,
                "type": "rest",
                "desc": "Pure mountain spring water soothing weary limbs.",
            },
        ],
        "exits": [
            {
                "target_node": 7,
                "name": "Pilgrim's Gate to Terminal",
                "edge": [6, 7],
                "x": 720,
                "y": 160,
                "desc": "Broad stone archway opening out onto the terminal platform.",
            },
        ],
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
        "default_fixture": "locomotive",
        "fixtures": [
            {
                "id": "locomotive",
                "name": "Midnight Express Engine",
                "x": 240,
                "y": 140,
                "type": "terminal",
                "desc": "Massive black steam locomotive billowing white clouds, ready for departure.",
            },
            {
                "id": "conductor",
                "name": "Conductor's Booth",
                "x": 450,
                "y": 130,
                "type": "archive",
                "desc": "Ticket validator and final departure register.",
            },
            {
                "id": "clock",
                "name": "Grand Terminal Clock",
                "x": 380,
                "y": 75,
                "type": "lookout",
                "desc": "Ticking brass chronometer signaling midnight departure.",
            },
            {
                "id": "carriages",
                "name": "Passenger Carriages",
                "x": 600,
                "y": 160,
                "type": "rest",
                "desc": "Warm plush velvet seats welcoming the surviving troupe.",
            },
        ],
        "exits": [],
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
        "current_fixture": "telegraph",
        "room_action": "Reviewing telegraph logs and mountain charts.",
        "voted_exit": 2,
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
        "current_fixture": "cabinets",
        "room_action": "Inspecting lock mechanisms on the filing cabinet.",
        "voted_exit": 2,
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
        "current_fixture": "stove",
        "room_action": "Warming her hands by the coal stove while checking her tools.",
        "voted_exit": 3,
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
        "current_fixture": "floorboards",
        "room_action": "Observing the troupe from the shadows of the floorboards.",
        "voted_exit": 2,
        "is_alive": True,
        "inventory": ["Stage Prompt Book"],
    },
}


class StageEngine:
    """
    Deterministic rule engine and state tracker for the paper-stage game.
    Enforces dual-layer theater architecture:
    - Macro level: Route progression, fog advance, and spatial adjacency.
    - Micro level: Room stage interior, fixture occupancy, consensus votes, and physics.
    """

    def __init__(self):
        self.reset()

    def reset(self):
        self.current_room_id = 1
        self.room_turn = 1
        self.room_progress = 15  # Starts with initial scene setup
        self.scene_number = 1
        self.max_scenes = 6
        self.fog_node = 0  # Node id currently enveloped in lethal fog
        self.characters = copy.deepcopy(INITIAL_CHARACTERS)
        self.nodes = copy.deepcopy(STAGE_NODES)
        self.edges = list(STAGE_EDGES)
        self.blocked_edges: List[Tuple[int, int]] = []
        self.spotlighted_nodes: List[int] = [1]  # Room 1 starts lit
        self.spotlighted_fixture: Optional[str] = "stove"
        self.active_rumors: List[Dict[str, str]] = []
        self.node_props: Dict[int, List[str]] = {
            4: ["Rusted Padlock"],
        }
        self.fixture_props: Dict[str, List[str]] = {
            "cabinets": ["Route Survey Map"],
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
            c_node = char["node"]
            node_name = self.nodes.get(c_node, {}).get("name", "Unknown Node")
            chars_summary[cid] = {
                "id": char["id"],
                "name": char["name"],
                "role": char["role"],
                "node": c_node,
                "node_name": node_name,
                "current_fixture": char.get("current_fixture", "stove"),
                "room_action": char.get("room_action", "Observing the room."),
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
            }

        # Calculate current consensus status
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

        current_room = self.nodes.get(self.current_room_id, {})

        return {
            "scene_number": self.scene_number,
            "max_scenes": self.max_scenes,
            "current_room_id": self.current_room_id,
            "current_room": current_room,
            "room_turn": self.room_turn,
            "room_progress": self.room_progress,
            "room_consensus": {
                "reached": consensus_reached,
                "target_node": consensus_target,
                "votes": {cid: c.get("voted_exit") for cid, c in self.characters.items() if c["is_alive"]},
            },
            "fog_node": self.fog_node,
            "tension_dial": round(self.tension_dial, 1),
            "director_authority": self.director_authority,
            "blocked_edges": [list(e) for e in self.blocked_edges],
            "spotlighted_nodes": list(self.spotlighted_nodes),
            "spotlighted_fixture": self.spotlighted_fixture,
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
        Asserts that a requested macro movement complies with:
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

    def validate_fixture(self, room_id: int, fixture_id: str) -> bool:
        """Asserts that a fixture exists within the given room."""
        room = self.nodes.get(room_id)
        if not room:
            return False
        return any(f["id"] == fixture_id for f in room.get("fixtures", []))

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
        - "block_route": target = [from_node, to_node] or to_node int
        - "shift_spotlight": target = fixture_id (str) or node_id (int)
        - "plant_rumor": target = {"character": cid, "rumor": text}
        - "cue_prop": target = {"fixture": name, "prop": name} or {"node": id, "prop": name}
        - "adjust_tension": target = float (1.0 to 5.0)
        """
        if self.director_authority <= 0 and verb != "adjust_tension":
            return False, "Insufficient Director Authority points."

        if verb == "block_route":
            if isinstance(target, int):
                edge = (self.current_room_id, target)
            elif isinstance(target, (list, tuple)) and len(target) == 2:
                edge = (int(target[0]), int(target[1]))
            else:
                return False, "Target must be an exit node or a pair [from_node, to_node]."

            if edge not in self.edges:
                return False, f"Edge {edge} is not a valid route."
            self.blocked_edges = [edge]  # 1 edge blocked at a time
            self.director_authority -= 1

            # Spikes stress for characters at that node
            for char in self.characters.values():
                if char["node"] == edge[0]:
                    char["stress"] = min(100, char["stress"] + 15)
            return True, f"Director lowered the velvet curtain across the exit to Node {edge[1]}."

        elif verb == "shift_spotlight":
            # Can be either a fixture id or a node id
            if isinstance(target, str) and not target.isdigit():
                # Spotlight a fixture in the current room
                if not self.validate_fixture(self.current_room_id, target):
                    return False, f"Fixture '{target}' does not exist in the current room."
                self.spotlighted_fixture = target
                self.spotlighted_nodes = [self.current_room_id]
                self.director_authority -= 1
                # Calm characters at this fixture
                for char in self.characters.values():
                    if char["node"] == self.current_room_id and char.get("current_fixture") == target:
                        char["stress"] = max(0, char["stress"] - 20)
                return True, f"Director focused the golden spotlight beam onto '{target}'."
            else:
                node_id = int(target)
                if node_id not in self.nodes:
                    return False, f"Node {node_id} does not exist."
                self.spotlighted_nodes = [node_id]
                self.spotlighted_fixture = self.nodes[node_id].get("default_fixture", "stove")
                self.director_authority -= 1
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
            return True, f"Director whispered a stage prompt cue to {cid}: '{rumor_text}'."

        elif verb == "cue_prop":
            if not isinstance(target, dict):
                return False, "Prop payload must be a dictionary."
            prop_name = str(target.get("prop", "Mysterious Item"))[:50]
            fixture_id = target.get("fixture")
            node_id = target.get("node", self.current_room_id)

            if fixture_id:
                self.fixture_props.setdefault(fixture_id, []).append(prop_name)
                self.director_authority -= 1
                return True, f"Director cued stage prop '{prop_name}' at fixture '{fixture_id}'."
            else:
                self.node_props.setdefault(int(node_id), []).append(prop_name)
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
        Executes macro node moves for backward compatibility and test verification.
        """
        move_log = []
        self.last_hazard_events = []

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
                self.current_room_id = target_node
                move_log.append(f"{char['name']} moved from Node {old_node} to Node {target_node}.")
            else:
                move_log.append(f"{char['name']} attempted illegal move to Node {target_node} ({reason}). Movement held.")

        self._resolve_hazards_for_all()
        self._advance_macro_scene()

        return {
            "move_log": move_log,
            "hazard_events": self.last_hazard_events,
            "status": self.status,
            "scene_number": self.scene_number,
        }

    def execute_room_turn(
        self,
        character_intents: Dict[str, Any],
        dialogue: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        Executes a turn inside the current room:
        1. Updates each character's fixture position and narrative action.
        2. Records consensus votes for next route exit.
        3. Resolves fixture interactions, stress, and stamina.
        4. Checks if consensus or 100% room progress triggers an exit transition.
        """
        action_log = []
        self.last_hazard_events = []
        current_room = self.nodes[self.current_room_id]
        tension_multiplier = 1.0 + (self.tension_dial - 2.0) * 0.3

        # 1. Update character actions & fixture positions
        for cid, intent in character_intents.items():
            if cid not in self.characters:
                continue
            char = self.characters[cid]
            if not char["is_alive"]:
                continue

            # Support both format: integer (target node) or dict (target_fixture, action, voted_exit)
            if isinstance(intent, int):
                char["voted_exit"] = intent
                action_log.append(f"{char['name']} votes to depart toward Node {intent}.")
            elif isinstance(intent, dict):
                target_fix = intent.get("target_fixture")
                if target_fix and self.validate_fixture(self.current_room_id, target_fix):
                    char["current_fixture"] = target_fix
                if intent.get("action"):
                    char["room_action"] = intent["action"]
                if intent.get("voted_exit") is not None:
                    char["voted_exit"] = int(intent["voted_exit"])
                action_log.append(f"{char['name']} at {char.get('current_fixture')}: {char.get('room_action')}")

        # 2. Advance Room Progress based on tension
        progress_increment = int(35 * (0.8 + (self.tension_dial - 1.0) * 0.2))
        self.room_progress = min(100, self.room_progress + progress_increment)
        self.room_turn += 1

        # 3. Check for Consensus to Exit
        votes: Dict[int, int] = {}
        living_chars = [c for c in self.characters.values() if c["is_alive"]]
        for c in living_chars:
            ve = c.get("voted_exit")
            if ve is not None:
                # Check if edge is blocked
                edge = (self.current_room_id, ve)
                if edge not in self.blocked_edges and edge in self.edges:
                    votes[ve] = votes.get(ve, 0) + 1

        chosen_exit = None
        for exit_node, vote_count in votes.items():
            if vote_count > len(living_chars) / 2:
                chosen_exit = exit_node
                break

        # If room_progress reached 100% and no strict majority, choose the top-voted legal exit
        if chosen_exit is None and self.room_progress >= 100 and votes:
            chosen_exit = max(votes.keys(), key=lambda k: votes[k])

        transitioned = False
        if chosen_exit is not None and chosen_exit != self.current_room_id:
            # Party transitions to chosen room!
            old_room_id = self.current_room_id
            self.current_room_id = chosen_exit
            for c in living_chars:
                c["node"] = chosen_exit
                c["current_fixture"] = self.nodes[chosen_exit].get("default_fixture", "stove")
                c["voted_exit"] = None

            self.room_progress = 15
            self.room_turn = 1
            transitioned = True
            action_log.append(f"THE TROUPE HAS REACHED CONSENSUS: Advancing from {current_room['name']} to {self.nodes[chosen_exit]['name']}.")

            # Hazard resolution for the new room/crossing
            self._resolve_hazards_for_all()
            self._advance_macro_scene()
        else:
            # Still in current room: resolve internal fixture interactions
            self._resolve_room_fixture_effects()

        return {
            "action_log": action_log,
            "hazard_events": self.last_hazard_events,
            "transitioned": transitioned,
            "current_room_id": self.current_room_id,
            "room_progress": self.room_progress,
            "status": self.status,
            "scene_number": self.scene_number,
        }

    def _resolve_room_fixture_effects(self):
        """Resolves environmental comfort or hazards inside the active room."""
        tension_multiplier = 1.0 + (self.tension_dial - 2.0) * 0.3
        for cid, char in self.characters.items():
            if not char["is_alive"]:
                continue

            fix_id = char.get("current_fixture", "")

            # Claim props if present at fixture
            if fix_id in self.fixture_props and self.fixture_props[fix_id]:
                claimed_prop = self.fixture_props[fix_id].pop(0)
                char["inventory"].append(claimed_prop)
                self.last_hazard_events.append(f"{char['name']} discovered and claimed '{claimed_prop}' at {fix_id}.")

            # Fixture specific effects
            if fix_id == "stove" or fix_id == "hearth" or fix_id == "altar":
                # Warmth and comfort
                char["stress"] = max(0, char["stress"] - 5)
                char["fatigue"] = max(0, char["fatigue"] - 5)
            elif fix_id == "floorboards" and self.spotlighted_fixture != "floorboards":
                # Dark creaking floorboards
                char["stress"] = min(100, char["stress"] + 10)
            elif fix_id == "scree_bed":
                # Loose shale
                drain = 10 * (2.0 if cid == "Beatrice" else 1.0) * tension_multiplier
                char["fatigue"] = min(100, char["fatigue"] + drain)

    def _resolve_hazards_for_all(self):
        """Resolves node physics hazards (e.g. weight limits on trestle, fog encroachment)."""
        tension_multiplier = 1.0 + (self.tension_dial - 2.0) * 0.3

        for cid, char in self.characters.items():
            if not char["is_alive"]:
                continue

            c_node = char["node"]
            node_info = self.nodes.get(c_node, {})

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
            if node_info.get("light_level") in ("Dark", "Pitch Black") and c_node not in self.spotlighted_nodes:
                stress_gain += 15
                if cid == "Julian":
                    stress_gain += 15  # Julian's flaw: dark paralysis
            char["stress"] = min(100, char["stress"] + stress_gain)

            # Node 2 Trestle Bridge: Rotten Timber Weight Trap!
            if c_node == 2:
                total_weight = char["body_weight"] + char["contraband_weight"]
                if total_weight > node_info.get("weight_limit", 150):
                    if c_node in self.spotlighted_nodes:
                        char["contraband_weight"] = 0
                        char["stress"] = min(100, char["stress"] + 30)
                        self.last_hazard_events.append(
                            f"SPOTLIGHT WARNING: {char['name']} spotted rotten timber buckling under {total_weight} kg. Dropped heavy contraband to avert collapse!"
                        )
                    else:
                        char["hp"] = max(0, char["hp"] - 45)
                        char["stress"] = min(100, char["stress"] + 50)
                        char["contraband_weight"] = 0
                        self.last_hazard_events.append(
                            f"STRUCTURAL BREACH: The Trestle Bridge buckled under {char['name']}'s {total_weight} kg load! Took 45 damage; contraband lost in the chasm."
                        )

            # Node 4 Signal Tower: Gate barrier
            if c_node == 4:
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

        # Fog Encroachment Check
        if self.fog_node > 0:
            for cid, char in self.characters.items():
                if char["is_alive"] and char["node"] <= self.fog_node:
                    char["hp"] = max(0, char["hp"] - 40)
                    self.last_hazard_events.append(f"THE WAILING FOG enveloped Node {char['node']}, choking {char['name']} (-40 HP).")
                    if char["hp"] <= 0:
                        char["is_alive"] = False
                        self.last_hazard_events.append(f"TRAGEDY: {char['name']} was claimed by the Wailing Fog.")

    def _advance_macro_scene(self):
        """Advances scene counter, moves fog, and updates win/loss status."""
        self.scene_number += 1
        self.fog_node = min(6, self.scene_number - 1)
        self.blocked_edges = []
        self.active_rumors = []

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
