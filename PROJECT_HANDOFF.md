# Bayang  -  Project Handoff

This document is the working handoff for someone continuing Bayang without the original planning conversation.

## Project at a glance

**Name:** Bayang: The Living Ledger  
**Hackathon track:** Create a New Kind of Experience  
**Purpose:** Teach introductory data analytics through a dataset-seeded, tabletop-style fantasy investigation.

A learner selects or uploads a small CSV. Bayang turns its groups and calculated pattern into a new case. The learner chooses which records to inspect, can ask an in-world guide for limited help, then makes an evidence-backed finding.

The first lesson is **counts versus rates**. A count says how many events occurred; a rate compares events to opportunities. A dataset may make the largest count and highest rate point to different groups, but the application also accepts valid datasets where they agree.

## Current implemented experience

1. Select one of two bundled CSVs or upload a CSV under 100 KB.
2. The server validates and profiles the data. Before play, the browser receives only the group names and group count.
3. Choose **Apprentice** or **Pathfinder**.
4. The AMD Head Referee generates a case with a setting, premise, stakes, characters, investigation hooks, challenge, and success/setback endings.
5. Choose from three investigations:
   - **Counts:** reveal event totals by group.
   - **Exposure:** reveal opportunities/journeys by group.
   - **Rates:** reveal calculated event rates by group.
6. Investigate at least two records to unlock the verdict.
7. Optionally ask the Field Guide a method question. Apprentice receives two Lantern Sparks; Pathfinder receives one.
8. Select a group and evidence type. The server checks the answer and returns the matching generated ending.
9. Load another dataset to seed another case.

The story and its player-facing investigation text are generated per case. The investigation categories, learning objective, calculations, and scoring remain fixed so generated text cannot change the underlying lesson or answer check.

## AMD model roles and data boundaries

### Head Referee

- Uses AMD Token Factory's OpenAI-compatible chat endpoint.
- Receives the verified aggregate profile, including group labels, counts, opportunities, calculated rates, and the server-computed highest-rate group(s).
- Generates the case and a `private_referee` note.
- The note stays in server-side memory. `public_quest()` only returns an allowlist of story fields to the browser.
- It receives no player messages, guide conversation, investigation choices, or verdict.
- The server's own profile and answer check are authoritative; the model does not calculate or score.

### Field Guide

- Also uses AMD Token Factory, but in a separate model call and role.
- Receives the current method question, guidance mode, and up to the last two Field Guide exchanges.
- Does not receive the CSV, profile, group names, values, private referee note, or Head Referee conversation.
- It is prompted to explain the general method and redirect requests for the answer.
- Free-form player text is routed only to this role, never to the Head Referee.

### Data transmission

The original CSV is parsed by the local Python server. The Head Referee receives aggregate rows for story generation, not the raw uploaded CSV text. Use synthetic or non-sensitive data for the demo. The API key is read server-side from `.env` and must never be added to browser code or committed.

## Technology stack

| Layer | Technology | Responsibility |
|---|---|---|
| UI | HTML, CSS, vanilla JavaScript | Campaign, choices, evidence cards, Field Guide chat |
| Server | Python standard library | HTTP routes, CSV validation, session state, game rules, AMD proxy |
| Model API | AMD Token Factory | Head Referee scenario generation and Field Guide answers |
| Default model | `DeepSeek-V4-Flash` | Configurable in `.env` |
| Persistence | In-memory Python dictionary | Temporary cases; restarting the server clears them |
| Input | CSV | `group`, `events`, `opportunities` columns |

No framework, database, or third-party Python package is currently required.

## Project structure

```text
Bayang/
├── client/
│   ├── index.html       # Page structure and accessible UI regions
│   ├── app.js           # Browser state, API calls, campaign interactions
│   └── style.css        # Visual design and responsive layouts
├── data/
│   ├── caravans_a.csv   # North Road sample case
│   └── caravans_b.csv   # Glasswood sample case
├── prompts/
│   ├── gamemaster.txt  # Head Referee role and JSON output contract
│   └── fieldguide.txt  # Player-facing bounded guide role
├── server/
│   ├── app.py           # HTTP server, case state, evidence and scoring APIs
│   ├── data_profiler.py # CSV validation and deterministic aggregate profile
│   └── model_client.py  # AMD API client, preview generator, response validation
├── .env.example         # Non-secret environment template
├── .gitignore           # Excludes .env and local secrets
├── run-demo.cmd         # Windows command launcher
├── run-demo.ps1         # PowerShell launcher
├── README.md            # User-facing setup and product overview
├── Bayang_Concept.md    # Product concept and positioning
├── Bayang_Implementation_Plan.md # Stack, architecture, and remaining scope
└── PROJECT_HANDOFF.md   # This developer handoff
```

## API routes

All app endpoints are served by `server/app.py`.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/status` | Reports whether AMD is configured and the configured model name. A configured key does not guarantee that the endpoint is reachable. |
| `GET` | `/api/samples` | Returns the bundled sample CSVs and display names. |
| `POST` | `/api/profile` | Validates CSV; creates an in-memory case; returns a case ID and safe group-label summary. |
| `POST` | `/api/quest` | Calls the Head Referee or local preview; stores the full quest privately; returns public story fields only. |
| `POST` | `/api/investigate` | Returns app-calculated evidence for `counts`, `exposure`, or `rates`. |
| `POST` | `/api/guide` | Calls the Field Guide, decrements the case's limited Sparks, and returns its response. |
| `POST` | `/api/answer` | Requires two investigations and deterministically checks the selected group and evidence type. |

## CSV requirements

The first version accepts a CSV with these headers (case-insensitive):

```csv
group,events,opportunities
North Road,12,300
Marsh Road,4,40
```

Validation requires 2–30 unique group names, whole-number nonnegative event counts, positive opportunity counts, and events no greater than opportunities. Unlike the first prototype, a count/rate mismatch is not required.

## Local setup

Requirements: Python 3.10 or newer. There are no third-party dependencies.

1. Copy `.env.example` to `.env` if needed.
2. Set `AMD_API_KEY` to the private AMD Token Factory key. Optional settings are `AMD_API_BASE_URL`, `AMD_MODEL_NAME`, and `BAYANG_MODEL_MODE`.
3. Start from a regular Windows PowerShell window with the repository as the working directory:

   ```powershell
   Set-Location F:\Github\Bayang
   python -u .\server\app.py
   ```

   `run-demo.cmd` and `run-demo.ps1` are also available. If a stale Python process owns port 8000, stop that process before relaunching.

4. Keep the server window open and visit `http://127.0.0.1:8000`.

To use preview mode deliberately, set `BAYANG_MODEL_MODE=preview` in `.env`. Preview mode is clearly labeled and does not call AMD. Live generation errors are surfaced instead of silently being called AMD output.

## Known limitations and handoff cautions

- Case state is in memory and disappears when the server restarts.
- The local preview is intentionally simpler than live AMD generation.
- The Head Referee prompt asks the model not to reveal the answer in player-facing prose, but the generated prose still needs human review and stronger automated leak checks before production use.
- The configured status badge checks for a key; it does not make a live health call. A story/guide response labeled AMD is the evidence of an actual model response.
- The UI is a single-player local demo. No authentication, persistence, multi-user support, deployment configuration, or Docker image is included yet.
- No automated tests have been added or run for the current dynamic-game changes. Restart the app to load changed Python files; refresh the browser to load updated assets.
- The `.env` file is private and ignored. Never include its contents in logs, screenshots, issues, or handoff notes.

## Recommended next work

1. **Walk the full live loop** with both sample datasets and both learner modes; inspect actual Head Referee and Field Guide responses.
2. **Improve generation safety:** detect answer leakage in player-facing prose; validate title/scene length and ensure no unsupported data claims.
3. **Add usage telemetry** for AMD request latency and token usage so cost per generated case can be explained from measured data.
4. **Polish the learner experience:** accessibility/keyboard pass, robust loading and retry states, useful ending/retry behavior, and mobile review.
5. **Prepare the hackathon package:** short/long project descriptions, challenge and technology tags, cover image, demo video, pitch slides, public GitHub repository, runnable README, and application URL.
6. **Record a comparative demo:** show two different datasets generating visibly different settings and cases, then contrast Apprentice and Pathfinder. Explain AI-generated content, deterministic quality controls, measured cost, target users, and the educator/bootcamp buyer hypothesis.
7. **Confirm the latest event submission rules and deadline** on the official [AMD Developer Hackathon: ACT III page](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii).
