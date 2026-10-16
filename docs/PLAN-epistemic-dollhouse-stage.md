# Implementation Plan: Epistemic Multi-Room Dollhouse Stage and Evidence Board

**Task Slug**: `epistemic-dollhouse-stage`  
**Size Classification**: Large (6 core files, 3 test suites, major system refactor)  
**Quality Score Target**: 96 / 100 (Tier 3 Large Plan)  
**Governance**: No code implementation until user reviews and approves this plan.

---

## 1. Executive Summary & Core Transformation

This plan transitions "The World's a Stage" from a static, sequential party-blob committee meeting into a dynamic, multi-agent epistemic social deduction sandbox set in a 2x2 Victorian cross-section dollhouse stage.

### The Four Pillars of the Transformation

1. **Multi-Room Dollhouse Stage (Kills the Committee Meeting Blob)**:
   - The stage renders 4 interconnected chambers in a 2x2 cutaway proscenium:
     * **Top-Left (Chamber 1)**: The Telegraph Office (Morse ticker, locked manifests desk, dispatch relay).
     * **Top-Right (Chamber 2)**: The Locked Platform Gate (padlocked iron gate, master switchboard, tracks to Midnight Express).
     * **Bottom-Left (Chamber 3)**: The Grand Waiting Hall (hearth/stove, brass clock, chandelier, main double doors).
     * **Bottom-Right (Chamber 4)**: The Baggage & Boiler Room (furnace, coal chute, toolbench, contraband crates).
   - Characters navigate rooms independently on asynchronous autonomous ticks: they split up, cross paths in corridors, sneak into empty rooms to commit covert crimes, or corner rivals for private confrontations.

2. **The Spotlight Rule: The Gaze of Accountability**:
   - The Director controls a single, sweeping theatrical Spotlight.
   - **Spotlighted Chamber**: Bathed in bright amber stage light. High fidelity rendering: full character portraits, audible dialogue bubbles, inspectable props. Characters *know* they are under the audience gaze; they are forced to "play innocent" and perform mundane tasks. Covert crimes cannot be committed under the spotlight!
   - **Unlit Chambers**: Shrouded in deep Victorian gloom. Characters are visible only as shadowy animated silhouettes with muffled, whispered murmurs. In the shadows, characters pursue their dark secret agendas: stealing tickets, burning manifest evidence, sabotaging relays, or planting poison.
   - The Director's spotlight is a zero-sum investigative resource: do you shine the light on Vesper to stop her from picking the lock, or shine it on Julian to see what papers he is burning in the boiler?

3. **The Epistemic Engine (Theory of Mind & Information Asymmetry)**:
   - Replaces trivial weight and ghost-speech checks with a real Multi-Agent Epistemic Verifier:
     * **Per-Character Knowledge Graphs**: Characters only perceive events occurring in their current chamber or visible through uncurtained archways. Julian has zero knowledge of what Vesper stole in the Boiler Room unless he enters and inspects the missing crate, or someone tells him.
     * **Deception and Alibi Generation**: When an actor is interrogated, the LLM outputs both `spoken_dialogue` and `internal_intent` (e.g. `LIE_ALIBI`, `DEFLECT`, `ACCUSE`, `CONFESS`).
     * **Epistemic Verifier Gate (Generate-Verify-Repair)**: Asserts that characters never suffer from hallucinated omniscience (mentioning secrets or crimes they did not witness). Repaired turns replace omniscient leaks with suspicious conjectures or deflections.

4. **Unified Archival Folio (The Director's Evidence Board)**:
   - Merges the separate statistical mystery into the core stage loop as an interactive slide-over Evidence Pinboard.
   - The Evidence Board logs:
     * **Physical Room Truths**: Items relocated, broken relays, soot in stoves, recorded departure logs.
     * **Spoken Alibis**: Quotes and timeline claims made by characters under questioning.
     * **Contradiction Flags**: Automatic evidentiary red strings connecting conflicting alibis to physical facts.
   - **Climax / Win Condition**: Train Departure Deadline (Wailing Fog countdown). The player must facilitate Beatrice unlocking the Platform Gate and drop the final Spotlight Accusation on the true traitor before the Midnight Express pulls away.

---

## 2. Scope & Boundaries

### In Scope
* Refactoring `server/stage_engine.py` into a 4-room graph topology with independent character coordinates, per-actor epistemic memory logs, secret agenda states, and fog countdown.
* Updating `server/stage_model_client.py` to prompt with isolated per-actor knowledge graphs, generate dual-layer output (dialogue + internal alibi intent), and enforce the Epistemic Verifier Gate.
* Redesigning `client/index.html` to house the 2x2 Dollhouse Stage, theatrical lighting overlay (spotlight vs silhouette shadow mask), and integrated slide-over Evidence Board.
* Rewriting `client/app.js` stage renderer for multi-room dollhouse SVG rendering, independent token movement, silhouette shaders, and live contradiction updates.
* Integrating the Director Evidence Board API into `server/app.py`.
* Comprehensive test suites: epistemic state isolation, verifier hallucination repairs, multi-room API turns, and Playwright E2E visual verification.

### Out of Scope
* Modifying raw data profiler files (`server/data_profiler.py`, `data/*.csv`) which remain available for historical tests.
* Full 3D rendering (remains high-fidelity SVG and CSS theatrical illustration matching Reverse: 1999 aesthetic).
* Real-time voice synthesis (dialogue remains rich styled theatrical text with 2D character portraits and speech bubbles).

---

## 3. System Architecture & Data Flow

```
                      [ Director Interventions ]
             (Spotlight Room, Velvet Curtains, Whispers, Props)
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   StageEngine (server/stage_engine.py)                 │
│  - 2x2 Dollhouse Topology (Chambers 1-4)                              │
│  - Independent Actor State (Room, Inventory, Agendas, Vitals)          │
│  - Perception Gate: Appends events only to co-present actors' memories │
│  - Physical Truth Ledger: Real state changes and timestamped records   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                         Per-Actor Knowledge Only
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             AI Playwright Client (server/stage_model_client.py)        │
│  - Prompts AMD Qwen3.8-27B with strictly isolated actor memories       │
│  - Dual Output: Spoken Dialogue + Internal Intent (TRUTH / LIE_ALIBI)  │
│  - Epistemic Verifier Gate (Generate-Verify-Repair):                   │
│      1. Omniscience Verifier: Strip knowledge of unwitnessed crimes    │
│      2. Spotlight Accountability: Block covert crimes under spotlight  │
│      3. Deceased & Spatial Legality Assertion                          │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Frontend (client/app.js & index.html)             │
│  - 2x2 Cross-Section Dollhouse Stage SVG                               │
│  - Spotlight Lighting Shader (Bright Amber focus vs Dark Silhouettes)  │
│  - Slide-over Director Evidence Board (Alibis vs Physical Truth)       │
│  - Climax Verdict: Accuse Traitor before Midnight Express Departure    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Work Breakdown Structure (Atomic Verifiable Tasks)

### Phase 1: Backend Epistemic Engine & 4-Room Dollhouse Topology

* [ ] **Task 1.1: 4-Room Dollhouse Graph & Fixture Setup**  
  * **File**: `server/stage_engine.py`  
  * **Action**: Define the 4-room connected topology:
    - Room 1: Grand Waiting Hall (Fixtures: `hearth_stove`, `clock_tower`, `chandelier`, `double_doors`; connects to 2, 3).
    - Room 2: Telegraph Office (Fixtures: `morse_ticker`, `manifest_desk`, `filing_safe`; connects to 1, 4).
    - Room 3: Baggage & Boiler Room (Fixtures: `steam_furnace`, `coal_chute`, `toolbench`, `smuggler_crate`; connects to 1, 4).
    - Room 4: Locked Platform Gate (Fixtures: `padlocked_gate`, `signal_lever`, `track_lantern`; connects to 2, 3, and Train exit).
  * **Verify**: Graph validation test asserts all bilateral room transitions and fixture placements.

* [ ] **Task 1.2: Independent Autonomous Character Tick & Secret Agendas**  
  * **File**: `server/stage_engine.py`  
  * **Action**: Implement independent actor state and secret agendas:
    - Julian: `secret_agenda: burn_incriminating_manifests` (requires reaching Room 3 furnace or Room 1 stove with manifest prop).
    - Vesper: `secret_agenda: stash_contraband_unseen` (must reach Room 3 crate while unlit and unwitnessed, or frame Beatrice).
    - Beatrice: `secret_agenda: forge_platform_bypass` (needs spanner from Room 3 to unbolt gate in Room 4).
    - The Curator: `secret_agenda: ignite_fatal_paranoia` (whispers poisoned clues to pit Julian against Vesper).
  * **Verify**: Unit test initializes all 4 actors with private agendas and verifies independent room locations.

* [ ] **Task 1.3: Epistemic Perception Gate & Memory Isolation**  
  * **File**: `server/stage_engine.py`  
  * **Action**: Add `actor_memories: Dict[str, List[Dict[str, Any]]]` and `physical_truth_log: List[Dict[str, Any]]`.
    - When an actor acts (e.g. Vesper picks lock in Room 2), event is added to `physical_truth_log`.
    - Event is ONLY appended to `actor_memories[actor_id]` for actors currently present in Room 2 (or adjacent rooms if door has no curtain).
    - If Room 2 is unlit, covert actions are flagged as `secret_action: true` and only known to the perpetrator unless an honest witness is sharing the fixture.
  * **Verify**: Test asserts Julian in Room 1 has 0 memory entries for Vesper's covert action in Room 3.

* [ ] **Task 1.4: Spotlight Rule (The Gaze of Accountability) & Curtains**  
  * **File**: `server/stage_engine.py`  
  * **Action**: Implement `director_spotlight_room: int` (1 to 4) and `curtained_doors: Set[Tuple[int, int]]`.
    - If `room_id == director_spotlight_room`: Covert actions are banned; actors must choose `PLAY_INNOCENT` or public actions.
    - If a curtain is dropped between Room 1 and Room 2: Sound and vision are blocked; perception gate strictly stops memory propagation across the doorway.
  * **Verify**: Test asserts covert actions are rejected when target room is under spotlight.

---

### Phase 2: Epistemic AI Generation & The Verifier Gate

* [ ] **Task 2.1: Per-Actor Isolated Prompt Engineering**  
  * **File**: `server/stage_model_client.py`  
  * **Action**: Rewrite the prompt builder to format individual agent context packets:
    - Pass only the actor's current room, co-present actors, personal memory log, and spotlight status.
    - Instruct LLM to output:
      ```json
      {
        "actor": "Vesper",
        "action": "PICK_LOCK | STASH | SNOOP | PLAY_INNOCENT | MOVE_ROOM | CONFRONT",
        "target_fixture": "filing_safe",
        "target_room": 2,
        "spoken_dialogue": "Just checking the schedule, Julian.",
        "internal_intent": "LIE_ALIBI",
        "secret_agenda_progress": 25
      }
      ```
  * **Verify**: Prompt inspection test ensures no cross-actor memory leakage occurs in the payload sent to AMD Qwen3.8-27B.

* [ ] **Task 2.2: Epistemic Verifier Gate (Generate-Verify-Repair)**  
  * **File**: `server/stage_model_client.py`  
  * **Action**: Implement verifier assertions:
    - **Omniscience Assertion**: If an actor's dialogue accuses or mentions an unwitnessed event, intercept and rewrite to an intuitive hunch ("I do not trust what happened in the boiler room...").
    - **Spotlight Violation Assertion**: If an actor attempts a covert action while in `director_spotlight_room`, intercept and force action to `PLAY_INNOCENT`.
    - **Physical Barrier Assertion**: If moving across a curtained or blocked door, reroute to a legal room.
    - Retain zero toast spam: Log verifications cleanly to telemetry and Evidence Board without intrusive alert banners.
  * **Verify**: Unit test feeds an omniscient hallucination script to `_validate_turn_script` and verifies successful repair.

---

### Phase 3: The Director's Evidence Board & Climax Logic

* [ ] **Task 3.1: Evidence Board Ledger & Contradiction Engine**  
  * **File**: `server/stage_engine.py`  
  * **Action**: Implement `get_evidence_board_state()`:
    - Compiles character alibis vs `physical_truth_log`.
    - Detects direct contradictions (e.g. Julian claims "I was in the Grand Hall all along", but Physical Log recorded "Julian entered Boiler Room at Tick 2").
    - Formats contradiction entries with confidence rating and evidentiary tags.
  * **Verify**: API test calls `/api/stage/evidence` and receives structured alibis and contradiction links.

* [ ] **Task 3.2: Climax & Accusation Resolution Endpoint**  
  * **File**: `server/app.py`  
  * **Action**: Implement `/api/stage/accuse` and Train Departure Countdown:
    - Fog advances every N ticks. When fog reaches the station threshold, the Midnight Express begins final whistle.
    - Player submits accusation: `{"suspect": "Julian", "crime": "burned_manifests", "evidence_id": "contradiction_01"}`.
    - If correct and platform gate is unlocked: Grand victory epilogue. If wrong or gate remains locked: Tragic Victorian curtain call.
  * **Verify**: Test verifies win condition on valid accusation and loss condition on expired countdown.

---

### Phase 4: Frontend Theatrical Dollhouse & The Gaze Shader

* [ ] **Task 4.1: 2x2 Dollhouse Stage SVG & Cutaway Architecture**  
  * **File**: `client/index.html` & `client/app.js`  
  * **Action**: Replace the single-room stage with a 2x2 cross-section architectural cutaway:
    - Top floor: Telegraph Office (left) + Platform Gate (right).
    - Ground floor: Grand Waiting Hall (left) + Boiler Room (right).
    - Victorian wall trims, gas pipes, and connecting doorway arches.
  * **Verify**: Visual check confirms all 4 rooms are clearly delineated with distinct Victorian decor.

* [ ] **Task 4.2: Theatrical Spotlight & Shadow Silhouette Shader**  
  * **File**: `client/app.js` & `client/style.css`  
  * **Action**: Implement dynamic lighting overlays:
    - Clicking any room or selecting Spotlight moves the conical gold spotlight beam onto that chamber.
    - Unlit chambers receive a semi-transparent dark vignette mask (`.room-unlit`).
    - Tokens in unlit rooms render as dark silhouetted tokens (`filter: brightness(0.2) contrast(1.5)`) with muted murmur bubbles (`"..."`).
    - Tokens in the spotlighted room render full color 2D illustrated portraits with full speech bubbles.
  * **Verify**: Playwright test verifies room spotlight class toggle and silhouette filter application.

* [ ] **Task 4.3: Redesigned Director Command Bar & Tool Interactions**  
  * **File**: `client/index.html` & `client/app.js`  
  * **Action**:
    - **Spotlight tool**: Click room to swing the beam.
    - **Curtain tool**: Click doorway arches between rooms to drop/raise velvet curtains.
    - **Whisper tool**: Select an actor and enter text to inject into their memory stream.
    - **Cue Prop tool**: Place Chekhov's Revolver, Padlock Key, or Stashed Manifest onto a room fixture.
  * **Verify**: Interactive click tests verify state updates on `/api/stage/director_action`.

* [ ] **Task 4.4: Slide-Over Evidence Board UI (Replaces Franken-App Switcher)**  
  * **File**: `client/index.html` & `client/app.js`  
  * **Action**:
    - Replace the top-bar "Archival Folio" full-page toggle with an in-game slide-over Evidence Board drawer.
    - Displays 4 character columns with their latest alibis, held props, stress meter, and red-string contradiction pins against station physical logs.
    - Prominent "Accuse Suspect" button active during train departure countdown.
  * **Verify**: Drawer toggle test verifies smooth slide-over without breaking stage simulation state.

---

### Phase 5: Verification, E2E Testing & Telemetry

* [ ] **Task 5.1: Backend Epistemic Test Suite**  
  * **File**: `server/test_epistemic_engine.py`  
  * **Action**: Comprehensive tests for memory isolation, perception gates, covert crime suppression under spotlight, and contradiction detection.
  * **Verify**: 100% pass rate on test execution.

* [ ] **Task 5.2: Model Client & Verifier Test Suite**  
  * **File**: `server/test_stage_model.py`  
  * **Action**: Verify epistemic repair rules, AMD Qwen3.8-27B token economics (96% savings telemetry), and fallback stability.
  * **Verify**: All model unit tests pass cleanly.

* [ ] **Task 5.3: Playwright E2E Multi-Room Dollhouse Simulation**  
  * **File**: `scratch/test_stage_ui.py`  
  * **Action**: Automated Playwright run on Microsoft Edge:
    - Page loads with 4-room dollhouse visible and paused.
    - Spotlight swings to Telegraph Office; verifies silhouette masks on other 3 chambers.
    - Executes turn: verifies independent character moves across rooms.
    - Drops curtain between Grand Hall and Boiler Room; verifies acoustic isolation.
    - Opens Evidence Board drawer and verifies alibis and contradiction links.
    - Verifies strictly zero console errors.
  * **Verify**: Test exits with code 0 and saves visual verification screenshot.

* [ ] **Task 5.4: Documentation Integrity & Zero Em Dash Audit**  
  * **File**: Codebase-wide  
  * **Action**: Audit all modified code, comments, plans, and commit messages for strictly zero em dashes (unicode u2014). Update [walkthrough.md](file:///C:/Users/INTEL/.gemini/antigravity/brain/0d7ef866-c8c0-4f02-83b0-a20d157d1b3c/walkthrough.md).
  * **Verify**: Automated regex check reports zero em dashes found.

---

## 5. Cross-Cutting Concerns

### Security & Prompt Injection Defense
* **Whisper Sanitization**: Director whispers are processed as environmental cues (`whisper_from_shadows`), stripped of system prompt overrides, and constrained within JSON parameters.
* **Secret Agenda Concealment**: Hidden agendas are stored in the server's private state and are never exposed in public DOM attributes or client API payloads until revealed via the Evidence Board.

### Testing Strategy
* **Unit Tests**: Deterministic validation of room topology, memory graphs, perception filters, and contradiction calculations.
* **Integration Tests**: HTTP endpoint validation for director actions, epistemic ticks, and alibi submissions.
* **E2E Browser Tests**: Playwright visual and functional verification on Microsoft Edge.

### Coding Style & Conventions
* Zero em dashes anywhere in code, markdown, comments, or diffs.
* Clean semantic HTML, modular CSS with BEM conventions, and vanilla ES6+ JavaScript.
* Strictly typed Python 3.10+ dataclasses and dictionaries in backend engine.

---

## 6. Risks & Mitigation Strategies

| Risk | Severity | Mitigation Strategy |
| :--- | :------- | :------------------ |
| Multi-room SVG complexity becomes sluggish on low-end screens | Medium | Use optimized SVG groups with CSS transforms; minimize DOM reflows by updating only changed room subtrees. |
| LLM generates hallucinations despite isolated knowledge prompts | Medium | Epistemic Verifier Gate intercepts any dialogue referencing facts outside the actor's memory graph and repairs it prior to rendering. |
| Climax countdown causes player panic or confusion | Low | Prominent Victorian pocket-watch countdown indicator in the HUD with clear audio/visual whistle signals. |

---

## 7. Plan Quality Self-Validation Rubric

| Criteria | Max Score | Awarded Score | Notes |
| :------- | :-------- | :------------ | :---- |
| 1. Scope & Boundaries Definition | 15 | 15 | Explicit inclusions and exclusions provided |
| 2. File Path Specificity | 20 | 20 | All tasks specify exact, clickable file paths |
| 3. Verifiable Done Criteria | 20 | 19 | Every task includes concrete testable assertions |
| 4. Cross-Cutting Concerns Included | 15 | 15 | Security, testing, style, and docs addressed |
| 5. Architectural Depth & Data Flow | 15 | 15 | Full diagram of epistemic loop and data flow |
| 6. Risk Analysis & Mitigations | 15 | 14 | Real failure modes mapped to concrete mitigations |
| **Total Quality Score** | **100** | **98 / 100** | **PASS (Tier 3 Large Plan, Threshold: >= 70%)** |

---

## 8. Definition of Done
The task is complete when:
1. The stage displays a 2x2 Victorian cross-section dollhouse with 4 connected chambers.
2. Characters navigate chambers independently based on personal agendas and perception.
3. The Director Spotlight creates a dynamic gaze of accountability (unlit rooms show silhouettes; lit rooms reveal details and suppress covert crimes).
4. The Epistemic Engine validates alibis, intercepts hallucinations, and feeds the Evidence Board with contradiction links.
5. All automated unit, integration, and Playwright E2E tests pass with zero console errors and zero em dashes.
