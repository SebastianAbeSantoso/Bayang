# Bayang — The Living Ledger

**Hackathon track:** Create a New Kind of Experience  
**Core idea:** Turn a learner's dataset into a replayable, choice-driven tabletop-style analytics mystery.

## Pitch

Bayang turns a small CSV into a new story world. Players choose which records to inspect, uncover evidence, ask an in-world learning guide for limited help, and make a case. An AMD-hosted Head Referee knows the verified answer and shapes the world, but it never receives the player's messages. A separate AMD-hosted Field Guide sees only the player's method questions and has no access to the dataset or answer.

## User and need

- **Primary user:** a beginner practicing data analysis in a bootcamp, classroom, or self-guided course.
- **Need:** practice interpreting evidence and selecting the right measure in a memorable, low-stakes setting.
- **Buyer hypothesis:** educators and bootcamps that want short applied exercises. This is a hypothesis to validate, not a proven learning outcome or confirmed market.

## What the player does

1. Choose a sample dataset or upload a CSV with `group`, `events`, and `opportunities` columns.
2. Bayang validates and profiles it. The player sees a sealed dossier with the group names but not the figures.
3. AMD's Head Referee receives the verified aggregate profile and creates a case: a setting, cast, stakes, investigation paths, challenge, and possible endings.
4. The player chooses at least two of three investigations: inspect event counts, journey/opportunity counts, or calculated rates. Each reveals a different view of the real dataset.
5. The player can spend limited Lantern Sparks asking the Field Guide about the method. The guide does not receive the dataset or the Head Referee's scenario.
6. The player commits to a group and evidence type. Python checks the result deterministically and reveals the ending.

## Learning objective

The first skill is knowing when a total count and a rate answer different questions. For example, a sample ledger has 12 events in 300 opportunities on one route (4%) and 4 in 40 on another (10%). The first has more events overall; the second has the higher event rate. Bayang accepts other valid CSVs too, including cases where the total and rate point to the same group; the story adapts to the pattern instead of rejecting or inventing a conflict.

## Why this is a new experience

This is not a chatbot wrapped around a fixed worksheet. The dataset changes the story seed, AMD generates a different world and cast, the player chooses an investigation order, and the resulting evidence changes what the player can conclude. Apprentice provides two Field Guide questions and more explicit evidence notes; Pathfinder provides one question and lighter guidance. Different inputs and player paths should be shown in the hackathon demo.

## AMD's role and quality controls

Bayang uses an open model served by AMD Token Factory on AMD Radeon Cloud. The Head Referee receives the verified aggregate rows, authors a dataset-specific quest, and keeps a private answer note on the server. The application validates the response shape and independently calculates every rate, clue, and verdict. Generated narrative cannot change numeric evidence or scoring.

The Field Guide has a separate system prompt and endpoint call. Its request contains the player's method question and only its own short conversation history; it does not contain the dataset, answer key, or Head Referee messages. Free-form player text is never passed to the Head Referee. With no API key, Bayang clearly labels its local preview instead of claiming live generation.

Only aggregates, not the original CSV upload, are sent to AMD for story generation. The product is an educational demo; use synthetic or non-sensitive data. Track actual request latency and usage before making a cost claim.

## Demo and submission

Show at least two different datasets creating different worlds and evidence, then compare Apprentice and Pathfinder. Explain which parts AI generated, how deterministic calculations preserve correctness, the observed cost per generated experience, the intended educator/bootcamp user, and the buyer hypothesis. The AMD workload must be visible and meaningful in the working product.

The hackathon submission includes the project descriptions and tags, working prototype, public GitHub repository with runnable README, application URL, cover image, demo video, and pitch slides. See the [official hackathon brief](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii).
