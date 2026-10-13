# Bayang — The Living Ledger

Bayang turns a CSV into a one-off tabletop-style analytics mystery. A player chooses where to investigate, uncovers counts and rates, asks a limited-use Field Guide for method help, and commits to a finding. Each dataset seeds a different story. The first learning objective is understanding why counts and rates can point to different conclusions.

## Run the demo

Requirements: Python 3.10 or newer. The local preview needs no third-party packages.

1. Copy `.env.example` to `.env` if you have not already.
2. Add your AMD Token Factory key as `AMD_API_KEY` in `.env`. Keep it private; `.env` is ignored by Git.
3. Double-click `run-demo.cmd` or start `python server/app.py` from a Windows PowerShell window.
4. Open `http://127.0.0.1:8000`.

Bayang uses the AMD-hosted model when `AMD_API_KEY` is configured. Set `BAYANG_MODEL_MODE=preview` to deliberately use the local story and guide preview.

## Play

Choose either sample ledger or upload a CSV with `group`, `events`, and `opportunities` columns. Bayang validates the counts, then asks the AMD model to build a new setting, cast, investigation paths, challenge, and endings from the aggregate profile. The case stays sealed until the player explores.

The player chooses between three investigations:

- **Incident ledger:** reveal event counts.
- **Journey registers:** reveal exposure/opportunities.
- **Rate markers:** reveal events per opportunity.

Investigate at least two records, ask the Field Guide up to two method questions (one in Pathfinder mode), then choose a group and supporting evidence. Apprentice mode includes plain-language explanations; Pathfinder uses fewer hints. Server-side calculations control all evidence and scoring.

## The two AMD roles

- **Head Referee:** receives the verified aggregate profile, generates the story, and returns a private answer note. It never receives player questions or choices. The private note is kept on the server; deterministic calculations remain authoritative.
- **Field Guide:** receives only the player's method question and prior Field Guide conversation. It never receives the dataset, values, answer, or Head Referee conversation. Its limited sparks help explain a method without solving the case.

Both roles call the AMD Token Factory OpenAI-compatible API from the Python server. The API key never enters browser code. Bayang sends aggregate rows (group labels, events, opportunities, and calculated rates) to AMD for dataset-specific generation; it does not upload the original CSV file. Use synthetic or non-sensitive data. The AMD endpoint and available models can change; configure `AMD_API_BASE_URL` and `AMD_MODEL_NAME` in `.env` if needed.

When no key is configured, clearly labeled local-preview behavior keeps the demo playable. The preview is not represented as a live AMD response.

## Hackathon submission checklist

- Project title, short description, long description, selected challenge, and technology tags
- Working prototype and public GitHub repository
- README with reproducible setup and run instructions
- Application URL / demo platform
- Cover image, demo video, and pitch presentation
- Demo showing at least two different inputs or situations changing the experience
- Explain the generated elements, consistency controls, cost per generated experience, intended user, and who would pay
- Demonstrate AMD powering a meaningful part of the working product

Bayang is aimed at educators, bootcamps, and workshop facilitators who want learners to practice data reasoning through adaptive stories. The demo should compare at least two datasets and both learner modes. Track request time and token/usage data available from AMD before estimating generation cost; do not present an unmeasured figure as fact.

See [Bayang_Concept.md](Bayang_Concept.md) for the concept and [Bayang_Implementation_Plan.md](Bayang_Implementation_Plan.md) for remaining scope.

Hackathon brief: [AMD Developer Hackathon: ACT III](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii).
