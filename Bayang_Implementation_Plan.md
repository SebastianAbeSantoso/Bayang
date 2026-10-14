# Bayang — Implementation Plan

**Product:** The Living Ledger  
**Hackathon track:** Create a New Kind of Experience  
**Current phase:** Dynamic playable demo; submission packaging remains.

## Product loop

Bayang turns an uploaded or sample CSV into a short analytics campaign. The player chooses investigations to reveal evidence, asks a separate limited-use guide for help with the method, and commits to a data-backed conclusion.

## Stack

| Layer | Choice | Role |
|---|---|---|
| Browser | HTML, CSS, vanilla JavaScript | Campaign UI, choices, evidence views, and guide conversation |
| App server | Python standard library | CSV validation, private case state, endpoints, deterministic evidence and scoring |
| Model service | AMD Token Factory / AMD Developer Cloud | Story-authoring Head Referee and player-facing Field Guide |
| Model | Google DeepMind `Gemma-4-31B-IT` (default, configurable) | Narrative generation, world-building, and bounded method guidance |
| Bonus Track | Google DeepMind Dedicated Prize | Eligible for dedicated prize for building with Gemma on AMD Cloud |
| Data | CSV with `group`, `events`, `opportunities` | Small supported learning dataset |
| Storage | In-memory case state | No account or database for the hackathon demo |

## Agent separation and controls

**Head Referee:** receives verified aggregate rows and the learning objective. It generates the setting, premise, cast, player-selected investigation hooks, challenge, endings, and a private referee note. The server keeps that private note and never returns it to the browser. The Head Referee receives no player messages or choices.

**Field Guide:** receives only the player's method question and the Field Guide's own short conversation history. It is prompted to explain concepts like counts, opportunities, and rates without choosing a group or solving the specific case. It has two Lantern Sparks in Apprentice mode and one in Pathfinder mode. It never receives the dataset, answer, or Head Referee conversation.

**Game engine:** calculates all evidence and the answer from the CSV. Generated text controls theme and presentation, not data facts, progression rules, or scoring. The server requires two investigations before the player can commit a verdict. It ignores any generated calculation that conflicts with the deterministic profile. Preview behavior is labeled as local rather than AMD live.

## API flow

```text
CSV → validate/profile privately → return group labels only
                                  ↓
                          AMD Head Referee
                                  ↓
       store private note ← validate quest → return safe story
                                  ↓
Player investigation choice → deterministic evidence reveal
Player method question → AMD Field Guide (no case data) → limited reply
Player verdict → deterministic answer check → ending
```

Routes:

- `GET /api/samples`, `GET /api/status`
- `POST /api/profile`: validate CSV and return a temporary case ID plus a sealed, non-numeric summary.
- `POST /api/quest`: generate a scenario from the verified aggregate profile; store the private referee note server-side.
- `POST /api/investigate`: reveal count, exposure, or rate evidence for one player-chosen path.
- `POST /api/guide`: answer a bounded method question using guide-only context and remaining Lantern Sparks.
- `POST /api/answer`: require at least two investigations, then score route and evidence deterministically.

## Learner experience

1. Select one of the sample datasets or upload a CSV under 100 KB.
2. Review the sealed dossier with group labels and select Apprentice or Pathfinder.
3. Generate a unique case through the AMD Head Referee.
4. Choose at least two of three generated investigations. Each reveals actual app-calculated data: event counts, opportunity counts, or rates.
5. Spend a limited Field Guide question if desired.
6. Choose a group and supporting evidence; receive a deterministic explanation and one of the generated endings.
7. Load a different dataset to create a new campaign and compare how the world changes.

The parser accepts valid count/rate datasets even when the largest count and highest rate are the same group. The narrative adapts to the observed pattern rather than forcing a false twist.

## Build status and remaining work

### Dynamic playable slice

- Dataset-seeded AMD quest generation
- Head Referee and Field Guide separation
- Private server-side referee note
- Player-selected investigations with deterministic evidence
- Limited Field Guide questions by learner mode
- Deterministic verdict and story endings
- Sample datasets and compatible CSV upload
- Local preview path with explicit labeling

### Before submission

- Reopen the app and walk through both sample datasets in both modes.
- Check the live AMD quest and Field Guide paths with the configured key; record model, latency, and usage/cost data from actual responses.
- Refine narrative output validation if live responses reveal leaks or malformed content.
- Capture a short demo that contrasts at least two inputs, shows the AMD-powered changes, and explains how deterministic controls preserve the lesson.
- Prepare the project title, short/long descriptions, challenge and technology tags, cover image, pitch slides, public GitHub repository, README, and application URL.
- Estimate per-experience cost only from measured API usage; explain intended educator/bootcamp user and buyer hypothesis.
- Confirm the latest official submission deadline and requirements before submitting.

## AMD and deployment notes

The AMD Token Factory endpoint is configured in `.env` (`AMD_API_KEY`, optional `AMD_API_BASE_URL`, `AMD_MODEL_NAME`). Keys remain server-side and are ignored by Git. The AMD-hosted model does the core creative work for each new case and bounded player-guide answers. Python does the reliable calculations. No training or fine-tuning is needed for this demo.

Hackathon track brief: [AMD Developer Hackathon: ACT III](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii).

## Unified design principle: Demo-first Investigator's Toolkit

> **The model narrates what the data already proved. The player operates tools, not a chatbot.**

Both the feature design notes (`thoughts.md`) and the external project evaluation (`advice.md`) converge on the same architectural and UX principle, stated here as a single binding constraint for all remaining build decisions:

**Replace passive evidence reveals with 4–5 clickable in-world analytics tools. Each tool runs a deterministic backend calculation; the AMD model only generates flavor commentary on the result. Scope every tool to what fits inside the 3-minute demo script.**

### What this means in practice

| In-world tool | Real operation | Backend endpoint | AMD model role |
|---|---|---|---|
| 📜 **Inspect Ledger Samples** | `df.head()` / `df.tail()` | Reuse `/api/investigate` (counts path) | Narrates a merchant's first-hand account of top records |
| 🔍 **Audit Registry Integrity** | Null/type check, `df.info()` | Extend `/api/investigate` (exposure path) | Describes ink smudges or missing seals on the parchment |
| ⚡ **Outlier Lens** | IQR flag (`value > Q3 + 1.5×IQR`) | New: `/api/investigate?type=outliers` | Describes a bizarre ledger entry as a suspicious merchant note |
| 📊 **Compare Ratios** | Group-by rate calculation | Reuse `/api/investigate` (rates path) | Frames the rate disparity as a guild abacus revelation |

The Field Guide (Lantern Sparks) already fills the role of the "Skew Gauge" — it explains method without touching the data. No additional endpoint is needed for that.

### The one rule that must not break

The Python backend computes every number. The AMD model receives the computed result and adds narrative. Generated text that conflicts with the deterministic profile is silently discarded — the `game_engine` result is always authoritative. This is non-negotiable and already enforced by the existing game engine design.

### Scope guardrails (from external evaluation)

Build only what the 3-minute demo needs:

- ✅ 4 investigation tools (the table above) — enough to show depth
- ✅ Apprentice highlights the count/rate discrepancy; Pathfinder shows raw numbers only
- ✅ Two sample datasets producing visibly different quests — the strongest demo beat
- ❌ Skip: SVG animations, mobile layout, free-form chat, additional analytics lessons, persistent sessions
- ❌ Skip: CSV edge-case validation — basic validation is sufficient for judging

### AMD credit contingency

All four tools work in local preview mode (template fallback) so the demo runs regardless of credit status. The moment AMD credit arrives: swap the template fallback for a live model call, record latency and token counts, and use that recording as proof of AMD integration in the submission.

