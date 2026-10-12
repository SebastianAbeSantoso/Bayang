# Bayang — Definite Project Concept

**Working title:** Bayang: The Vanishing Caravans  
**Hackathon track:** Create a New Kind of Experience  
**Core idea:** A choice-driven, tabletop-RPG-style campaign that teaches beginners to reason with data by solving story cases.

## One-sentence pitch

Bayang turns introductory data analytics into a fantasy investigation: learners question characters, inspect evidence, and make consequential choices while an AMD-hosted AI game master adapts the story and coaching to how they play.

## The user and need

- **Primary user:** someone learning introductory data analytics in a bootcamp, class, or self-guided course.
- **Need:** practice interpreting data and choosing evidence in context, instead of only memorizing formulas or reading charts.
- **Buyer hypothesis:** bootcamps and educators who want short, engaging applied exercises. The hackathon demo will illustrate this use case; it will not claim proven learning gains or confirmed demand.

## The first quest

The guild must decide which caravan route has the higher observed loss rate. The ledger shows:

| Route | Lost caravans | Trips | Loss rate |
|---|---:|---:|---:|
| North Road | 12 | 300 | 4% |
| Marsh Road | 4 | 40 | 10% |

The North Road has more losses in total, while the Marsh Road has the higher loss rate per trip. The learner discovers why comparing raw counts alone can mislead when the group sizes differ. They finish by choosing a conclusion and citing the numerator and denominator that support it.

## How it plays

1. **Choose a play style:** Apprentice mode provides more scaffolding; Pathfinder mode starts with a less guided investigation. Both use the same evidence and learning objective.
2. **Enter the scene:** a guildmaster presents the question; a caravan captain and a ledger keeper offer different perspectives.
3. **Investigate:** the player asks questions, inspects the ledger, and switches between total losses and loss rate.
4. **Make a case:** the player selects a conclusion and the evidence supporting it. The app checks the arithmetic and reasoning criteria.
5. **Transfer the skill:** a short new case asks the learner to compare rates with different group sizes.

This borrows tabletop RPG structure—character roles, a quest, NPCs, clues, and consequences—while keeping the first build to one complete case rather than a sprawling campaign.

## What AMD does

An open-weight language model served on AMD Developer Cloud acts as the game master. It responds to player choices, voices characters, and selects or phrases the next hint based on the learner's progress. This makes the story responsive during play.

The application keeps campaign state, facts, arithmetic, and answer checks deterministic. The model cannot change the dataset, invent evidence, or decide whether a numeric answer is correct. The demo will make the live AMD-backed generation path visible and record request latency and token usage.

## First-build boundary

**Included:** one quest, one small fixed dataset, two guidance styles, a few NPC interactions, an interactive comparison, an evidence-backed conclusion, and one transfer question.

**Deferred:** multiple chapters, multiplayer, custom user-uploaded datasets, accounts, voice acting, complex dice or combat systems, fine-tuning, and LMS integrations.

## Success for the demo

- A reviewer can complete the quest and see how the learner's mode or choices change the experience.
- The learner can explain why the higher count and higher rate point to different routes.
- Numeric results and answer checks are reproducible.
- The game master uses an open model running on AMD infrastructure during the live experience.
- The submission describes latency and per-session inference cost, and presents bootcamps or educators as the initial buyer hypothesis.

## Technology starting point

Reuse Bayang's lightweight Python server and static browser interface. Render the ledger and comparison with HTML/SVG. Keep the dataset and scoring rules in application code; call the AMD-hosted model through a server-side endpoint so credentials stay out of the browser. Start with inference only; no training or fine-tuning is needed for the first quest.

The New Experience brief asks for an adaptive experience and a demonstration across at least two audiences, situations, or inputs. Bayang's Apprentice and Pathfinder modes provide that comparison through the same story and evidence. See the [official ACT III brief](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii).
