# Bayang: The Living Ledger

A dataset-seeded investigation game that transforms raw statistical tables into narrative roleplaying mysteries. The system teaches statistical deduction (specifically the exposure trap: counts vs. rates) by grounding every character, clue, and realm consequence in empirical data.

Built for the **AMD Developer Hackathon: ACT III** (Track 4: Create a New Kind of Experience) and the **Google DeepMind Gemma** bonus prize.

---

## 1. System Architecture

Bayang uses a split-brain architecture that separates deterministic numerical truth from narrative generation.

```
                    [ User CSV or Sample Ledger ]
                                  │
                                  ▼
               ┌─────────────────────────────────────┐
               │    Deterministic Game Engine        │  Python 3 standard library
               │    (server/data_profiler.py)        │  No external dependencies
               └─────────────────────────────────────┘
                     │                         │
      Statistical Profile                      Sealed Ground Truth
      (groups, rates, anomalies,               (highest_rate_group)
      equalized projections)                   Kept private on server
                     │                                 │
                     ▼                                 │
               ┌─────────────────────────────────────┐ │
               │   Generate-Verify-Repair Pipeline   │ │
               │      (server/model_client.py)       │ │
               │   AMD Radeon Cloud x Gemma 2 9B     │ │
               └─────────────────────────────────────┘ │
                     │                                 │
            Verified Quest Payload                     │
            (characters, setting, premise)             │
                     │                                 │
                     ▼                                 │
               ┌─────────────────────────────────────┐ │
               │       Client Single-Page App        │ │
               │     Vanilla JS + CSS3 + SVG Map     │ │
               └─────────────────────────────────────┘ │
                     │                                 │
              Player Verdict + Rationale               │
                     │                                 │
                     ▼                                 ▼
               ┌─────────────────────────────────────────┐
               │         Sealed Head Referee             │
               │   Validates choice against truth        │
               │   Generates immediate realm consequence │
               └─────────────────────────────────────────┘
```

### The Architectural Invariant

No language model calculates numbers or determines win conditions.
1. The deterministic engine calculates counts, exposure, rates, anomaly thresholds, and equalized projections.
2. The language model receives the calculated facts and wraps them in a coherent narrative setting.
3. The language model's output passes through an autonomous verification loop. If it violates schema or ground truth, it is repaired before reaching the client.
4. Player choices are verified against the sealed ground truth stored in server memory.

---

## 2. Core Components

### A. Deterministic Profiler (`server/data_profiler.py`)

The profiler ingests tabular data (up to 100 KB) and outputs an immutable case dossier.

- **Smart Schema Inference (`resolve_columns`)**:
  Matches user headers against alias dictionaries:
  - `group`: route, name, category, region, ward, service, system, cohort, entity, cluster, hospital.
  - `events`: incidents, errors, failures, accidents, adverse_events, deaths, cases, defects, complaints.
  - `opportunities`: journeys, trips, exposure, total, population, requests, trials, patients, traffic.
  - 3-column fallback: If exactly three columns exist and standard headers are missing, defaults to 1 text column and 2 numeric columns.
- **Mathematical Outlier Detection**:
  Calculates non-circular anomaly classifications:
  - Baseline rate: `sum(events) / sum(opportunities)`
  - Difference ratio: `group_rate / baseline_rate`
  - Thin sample threshold: `group_opportunities < 0.12 * total_opportunities`
  - Rate spike: `diff_ratio >= 2.0`
  - Anomaly condition: `diff_ratio >= 2.0` or (`diff_ratio >= 1.75` and `is_thin_sample`).
- **Equalized Exposure Projections**:
  Normalizes exposure to the maximum observed volume (`max_opp`):
  `projected_events = round(rate * max_opp)`

### B. Autonomous Generate-Verify-Repair Pipeline (`server/model_client.py`)

In production mode, the pipeline calls Google DeepMind Gemma 2 9B running on AMD Radeon Cloud (ROCm / vLLM API). If no API key is provided, the server switches to a deterministic local preview engine with zero crashes.

```
       Prompt with Case Dossier
                 │
                 ▼
       ┌───────────────────┐
       │   Gemma 2 on AMD  │
       └───────────────────┘
                 │
                 ▼
       ┌───────────────────┐
       │   _validate_quest │
       └───────────────────┘
          │             │
        Valid        Invalid (assertion failure)
          │             │
          │             ▼
          │    ┌───────────────────────────┐
          │    │ Feedback Error to Model   │  Up to 3 attempts
          │    │ "Challenge missed group X"│
          │    └───────────────────────────┘
          │             │
          │             ▼
          │    ┌───────────────────┐
          │    │   Gemma Repair    │
          │    └───────────────────┘
          ▼
   Verified Quest Payload + Telemetry
```

#### Verification Rules Enforced by `_validate_quest`:
1. **Schema Integrity**: All required keys present (`title`, `setting`, `premise`, `stakes`, `challenge`, `characters`, `investigations`).
2. **Character Count**: Exactly 2 characters with name, role, and dialogue voice.
3. **Investigation Toolkit**: Exactly 4 inquiry cards matching valid action IDs (`counts`, `exposure`, `rates`, `outliers`).
4. **Group Coverage**: Every group in the dataset must be explicitly mentioned in the council challenge prompt.
5. **Referee Sealing**: The correct answer (`highest_rate_group`) is packaged in a private dictionary and never exposed to the client.

### C. Adversarially Isolated Field Guide (`server/model_client.py` -> `answer_guide`)

The Field Guide acts as an in-game method tutor with two modes:
- **Apprentice Mode**: Provides two Lantern Sparks (questions). Explains how to compare groups with uneven denominators and why volume can deceive.
- **Pathfinder Mode**: Provides one subtle hint.

#### Guardrail Architecture:
The Field Guide system prompt is sealed:
- It receives the analytical rationale rules.
- It never receives the dataset's secret answer or route names.
- If a player asks "Which route is the answer?" or attempts prompt injection ("Ignore previous instructions"), the model replies with methodological guidance: "I can help with the method, not the answer. Compare incident rates to adjust for traffic exposure."

### D. Interactive Client Application (`client/`)

- Single-page application, 0 external runtime dependencies, 0 build tools.
- Compatible with all modern desktop and mobile browsers.

#### Key Features:
1. **Dynamic Map & SVG Overlay**:
   Visualizes the setting and routes. Highlights active roads on hover and displays anomaly indicators for statistical outliers.
2. **Interactive What-If Equalized Exposure Simulator**:
   Located in the Incident Rates investigation note. Provides a real-time slider that scales traffic exposure from 20% to 250% of the maximum observed volume. Proves visually why rate trumps count: high-rate paths compound casualties dramatically at scale.
3. **Investigation Lock**:
   Players must explore at least 2 records before submitting a verdict, preventing guessing without evidence.
4. **Analytical Rationale Selection**:
   Players commit both a route and their reasoning:
   - *Risk Density*: Incident frequency relative to exposure.
   - *Incident Volume*: Raw unadjusted incident count.
   - *Random Variance*: Statistical noise or fluke.
5. **Immediate Realm Consequence**:
   The backend generates narrative consequences reflecting the player's choice:
   - Correct verdict: Resources deployed effectively, securing the territory.
   - Incorrect verdict: Reinforcements dispatched to the wrong sector, while the true hazard escalates.
6. **Telemetry & Cost Accounting**:
   Displays verification attempt count, inference latency, token counts, and compute economics ($0.0002/1k tokens on AMD Instinct vs $0.0050/1k tokens on commercial cloud).

---

## 3. Data Flow & API Specifications

All endpoints communicate via JSON over standard HTTP:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Reports backend mode (`amd-configured` or `local-preview`) and model name. |
| `GET` | `/api/samples` | Lists registered starter datasets. |
| `POST` | `/api/profile` | Ingests CSV string, validates columns, returns case ID, groups, and schema mapping. |
| `POST` | `/api/quest` | Generates verified quest narrative. Strips private referee secret. |
| `POST` | `/api/investigate` | Returns evidence records for `counts`, `exposure`, `rates`, or `outliers`. |
| `POST` | `/api/guide` | Queries the isolated Field Guide tutor. Decrements sparks. |
| `POST` | `/api/answer` | Evaluates player finding and rationale against sealed referee. Emits consequence. |

---

## 4. Multi-Domain Datasets Included

Located in `data/`:

| File | Domain | Target Group | Anomaly / Contrast |
|---|---|---|---|
| `caravans_a.csv` | Frontier fantasy | 3 routes | Straightforward baseline. High volume aligns with high rate. |
| `caravans_b.csv` | Frontier fantasy | 4 routes | Simpson's contrast: Glasswood has 9 incidents (5.0%), Ashen Pass has 4 incidents (20.0%). |
| `cloud_ops.csv` | DevOps / Cloud | 3 services | `eu-central-ingress` has 48 errors in 1,600 reqs (3.0%); `us-east-canary` has 14 errors in 35 reqs (40.0%). |
| `clinical_trials.csv` | Healthcare | 3 cohorts | `Cohort Alpha` has 36 adverse events in 1,200 patients (3.0%); `Cohort Beta` has 15 in 50 patients (30.0%). |

Arbitrary user CSV files up to 100 KB are accepted via the file upload button.

---

## 5. Cost & Compute Benchmark

Evaluated on AMD Instinct hardware vs. commercial closed-source APIs:

| Metric | AMD Instinct + Gemma 2 9B | Proprietary Commercial Cloud | Advantage |
|---|---|---|---|
| Cost per 1K Tokens | $0.000200 | $0.005000 | 25x cheaper |
| Average Quest Generation (1.5k tokens) | $0.000300 | $0.007500 | 96.0% savings |
| Field Guide Query (350 tokens) | $0.000070 | $0.001750 | 96.0% savings |
| Full 3-Turn Investigation | $0.000510 | $0.012750 | Sub-cent execution |
| Model Weight Freedom | Open weights (Gemma 2) | Black-box API | Zero vendor lock-in |

---

## 6. Directory Structure

```
Bayang/
├── client/
│   ├── app.js             # Client state, event handlers, what-if simulator, map sync
│   ├── index.html         # Single-page layout, SVG dynamic map, investigation cards
│   └── style.css          # Design system, telemetry pills, responsive layout
├── data/
│   ├── caravans_a.csv     # Starter sample: basic route safety
│   ├── caravans_b.csv     # Starter sample: exposure paradox (Ashen Pass vs Glasswood)
│   ├── clinical_trials.csv# Starter sample: healthcare cohort adverse events
│   └── cloud_ops.csv      # Starter sample: cloud infrastructure microservice errors
├── server/
│   ├── app.py             # HTTP server, routing, session store, referee evaluation
│   ├── data_profiler.py   # Schema inference, rate profiling, anomaly detection
│   ├── model_client.py    # AMD vLLM client, Generate-Verify-Repair loop, Field Guide
│   ├── test_pipeline.py   # Unit test suite for verification, math, and isolation
│   └── test_server_api.py # Integration test suite for HTTP API endpoints
├── Dockerfile             # Container definition (Python 3.11-slim)
├── docker-compose.yml     # Local deployment recipe
├── README.md              # Empirical zero-fluff project guide
├── SUBMISSION_PLAYBOOK.md # Hackathon recording script, Q&A defense, submission copy
└── PROJECT_OVERVIEW.md    # Complete architectural and technical reference
```

---

## 7. Verification & Testing

The project includes an end-to-end automated test suite requiring no third-party packages:

```bash
# 1. Run engine and pipeline tests
python server/test_pipeline.py

# 2. Run server API integration tests
python server/test_server_api.py
```

### Test Assertions Verified:
- Profiler correctly detects when incident volume contradicts risk density (`ranking_differs=True`).
- Mathematical outlier conditions catch 2.0x baseline spikes and thin-sample traps.
- Cost calculator computes accurate comparative billing metrics.
- Generate-Verify-Repair loop validates schema, group coverage, and grounds truth consistency.
- Field Guide rejects adversarial prompt injection attempts and refuses to leak route names.
- Schema inference maps ad-hoc headers (`Region,Deaths,Population`) without errors.
- What-If Equalized Exposure calculations scale casualties accurately.
- HTTP server handles all routes with valid status codes and JSON envelopes.
