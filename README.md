# Bayang — The Living Ledger

**Hackathon Track:** Create a New Kind of Experience  
**Technology Partners:** AMD Developer Cloud × Google DeepMind (Gemma)  
**Bonus Prize Eligible:** Dedicated Google DeepMind Gemma Prize  

Bayang turns a CSV into a one-off tabletop-style analytics mystery. A player chooses where to investigate, uncovers counts, exposure, rates, and anomalies, asks a limited-use Field Guide for method help, and commits to a finding. Each dataset seeds a different world. The core learning objective is understanding why raw counts and normalized rates can point to different conclusions.

## Technology Stack

- **Inference Engine:** Google DeepMind **Gemma** (`Gemma-4-31B-IT`) running on AMD GPUs in the cloud via AMD Developer Cloud / AMD Token Factory.
- **Dual-Agent Architecture:**
  - **Head Referee (AMD + Gemma):** Generates dataset-specific lore, cast, premise, and private answer notes from verified aggregate data.
  - **Field Guide (AMD + Gemma):** Player-facing Socratic mentor answering method queries with strictly bounded context and zero access to the secret solution.
- **Deterministic Core:** Python standard library profiler and scoring engine ensuring all mathematical facts and win conditions remain 100% rigorous.
- **Investigator's Toolkit:** 4 interactive analytical tools (Incident totals, Exposure audit, Rate comparison, and Anomaly / Outlier Lens with baseline deviations).

## Run the demo

Requirements: Python 3.10 or newer. The local preview needs no third-party packages.

1. Copy `.env.example` to `.env`.
2. Add your AMD Token Factory key as `AMD_API_KEY` in `.env`.
3. Start the application:
   ```powershell
   python server/app.py
   ```
   (or double-click `run-demo.cmd` / run `.\run-demo.ps1`).
4. Open `http://127.0.0.1:8000` in your browser.

Bayang uses Google DeepMind's `Gemma-4-31B-IT` on AMD Radeon Cloud when `AMD_API_KEY` is configured. If no key is set or `BAYANG_MODEL_MODE=preview`, a responsive local preview engine activates automatically with clear labeling.

## Play

Choose either sample ledger or upload a CSV with `group`, `events`, and `opportunities` columns. Bayang validates the counts, then asks Gemma on AMD Cloud to build a new setting, cast, investigation paths, challenge, and endings from the aggregate profile. The case stays sealed until the player explores.

The player chooses between four Investigator Toolkit actions:

- **Incident totals:** reveal raw event counts.
- **Journey registers:** reveal exposure/opportunities.
- **Rate markers:** reveal events per opportunity with proportional visual bars.
- **Outlier Lens:** detect anomalous groups deviating sharply from regional baseline risk.

Investigate at least two records, consult the Field Guide with limited Lantern Sparks (2 in Apprentice, 1 in Pathfinder), then commit a route and supporting evidence.

## Hackathon Submission Checklist

- [x] Project title, description, and challenge tags ("A New Kind of Experience")
- [x] Dedicated Google DeepMind Gemma bonus prize integration (`Gemma-4-31B-IT` on AMD Cloud)
- [x] Working prototype and public GitHub repository
- [x] README with reproducible setup and run instructions
- [x] Demo comparing at least two different datasets and both learner modes (Apprentice / Pathfinder)
- [x] Live AMD GPU inference latency display and telemetry in UI

See [Bayang_Concept.md](Bayang_Concept.md) for the concept and [Bayang_Implementation_Plan.md](Bayang_Implementation_Plan.md) for full implementation architecture.

Hackathon brief: [AMD Developer Hackathon: ACT III](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii).

