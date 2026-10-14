# Bayang — The Living Ledger

**Hackathon Track:** Create a New Kind of Experience  
**Technology Partners:** AMD Developer Cloud × Google DeepMind (Gemma)  
**Bonus Prize Eligible:** Dedicated Google DeepMind Gemma Prize  

Bayang turns a CSV into a one-off tabletop-style analytics mystery. A player chooses where to investigate, uncovers counts, exposure, rates, and anomalies, asks a limited-use Field Guide for method help, and commits to a finding. Each dataset seeds a different world. The core learning objective is understanding why raw counts and normalized rates can point to different conclusions.

## Technology Stack

- **Inference Engine:** Google DeepMind **Gemma** (`Gemma-4-31B-IT`) running on AMD GPUs in the cloud via AMD Developer Cloud / AMD Token Factory.
- **Generate-Verify-Repair Pipeline:**
  - Automated autonomous verification loop: Gemma's JSON output is checked against mathematical ground-truth assertions. If schema violations or factual contradictions occur, the pipeline passes the precise assertion failure back to Gemma to self-repair (up to 3 attempts).
  - Telemetry receipts: Records verification pass count, prompt/completion tokens, and real compute cost comparison.
- **Dual-Agent Isolation Architecture:**
  - **Head Referee (AMD + Gemma):** Generates dataset-specific lore, cast, premise, and private answer notes from verified aggregate data.
  - **Field Guide (AMD + Gemma):** Player-facing Socratic mentor answering method queries with strictly bounded context and zero access to the secret solution.
- **Dynamic In-World Consequences:** When a player commits a verdict, the Referee generates custom narrative fallout in the story world (e.g., diverting military escorts to a high-volume route while high-rate transit corridors burn).
- **Analytical Rationale Engine:** Players commit a finding using 3 rigorous methodological rationales rather than multiple-choice give-aways:
  - *Risk Density* (frequency relative to exposure/traffic)
  - *Incident Volume* (gross unadjusted counts)
  - *Random Variance* (isolated statistical noise)
- **Deterministic Core & Cost Model:** Python standard library profiler ensuring 100% mathematical accuracy. Live compute cost tracking ($0.0000002/token on AMD Instinct vs $0.0000050/token on proprietary closed APIs — a 96% cost reduction per generated world).
- **Investigator's Toolkit:** 4 interactive analytical tools (Incident totals, Exposure audit, Rate comparison, and Anomaly / Outlier Lens with baseline deviations).

## Run the demo

Requirements: Python 3.10 or newer. Standard library only (zero external pip dependencies required).

1. Copy `.env.example` to `.env`.
2. Add your AMD Token Factory key as `AMD_API_KEY` in `.env`.
3. Start the application:
   ```powershell
   python server/app.py
   ```
   (or double-click `run-demo.cmd` / run `.\run-demo.ps1`).
4. Run automated test suites:
   ```powershell
   python server/test_pipeline.py
   python server/test_server_api.py
   ```
5. Open `http://127.0.0.1:8000` in your browser.

Bayang uses Google DeepMind's `Gemma-4-31B-IT` on AMD Radeon Cloud when `AMD_API_KEY` is configured. If no key is set or `BAYANG_MODEL_MODE=preview`, a responsive local preview engine activates automatically with clear labeling and graceful connection fallback.

## Play

Choose either sample ledger or upload a CSV with `group`, `events`, and `opportunities` columns. Bayang validates the counts, then asks Gemma on AMD Cloud to build a new setting, cast, investigation paths, challenge, and endings from the aggregate profile. The case stays sealed until the player explores.

The player chooses between four Investigator Toolkit actions:

- **Incident totals:** reveal raw event counts.
- **Journey registers:** reveal exposure/opportunities.
- **Rate markers:** reveal events per opportunity with proportional visual bars.
- **Outlier Lens:** detect anomalous groups deviating sharply from regional baseline risk.

Investigate at least two records, consult the Field Guide with limited Lantern Sparks (2 in Apprentice, 1 in Pathfinder), select an analytical rationale, and commit your finding to witness the immediate consequence on the realm.

## Hackathon Submission Checklist

- [x] Project title, description, and challenge tags ("A New Kind of Experience")
- [x] Dedicated Google DeepMind Gemma bonus prize integration (`Gemma-4-31B-IT` on AMD Cloud)
- [x] Autonomous **Generate-Verify-Repair loop** ensuring 100% schema and factual compliance
- [x] Working prototype and public GitHub repository with zero external pip dependencies
- [x] Dynamic narrative consequences responding to player analytical choices
- [x] Real-time token and compute cost receipts proving AMD Instinct hardware cost efficiency
- [x] README with reproducible setup and test instructions
- [x] Offline/sandbox fallback guaranteeing zero-crash resilience during evaluation

See [Bayang_Concept.md](Bayang_Concept.md) for the concept and [Bayang_Implementation_Plan.md](Bayang_Implementation_Plan.md) for full implementation architecture.

Hackathon brief: [AMD Developer Hackathon: ACT III](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii).

