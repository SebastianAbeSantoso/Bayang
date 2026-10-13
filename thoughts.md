# Bayang: Evolving from Static Narrative to Interactive Data Sleuthing

**Date:** 13 October 2026  
**Status:** Evaluation & Feature Enhancement Proposal  
**Core Goal:** Make learning dataset intricacies (skewness, outliers, distributions, rates vs counts) genuinely fun and gamified using direct spreadsheet exploration and interactive analytical "actions" (pandas-style toolkit).

---

## 1. Critique & Verdict on Your Idea

### Verdict: **Strongly Agree, with One Vital Design Guardrail**

Your intuition is spot on:
- Reading narrative text passively can feel like a dressed-up multiple-choice quiz.
- But if the player actually **interacts with the raw ledger / parchment (the dataset)** using tactile tools, they transition from a *reader* into an *investigator*.
- Translating standard pandas concepts (`.head()`, `.info()`, `.describe()`, sorting, filtering outliers) into **in-world investigator tools** directly bridges fantasy investigation with real-world exploratory data analysis (EDA).

### The Danger to Avoid
Don't turn it into a dry web Jupyter notebook or another boring dashboard. The magic is in the **framing**:
Instead of typing code or looking at unstyled tables, the dataset is framed as the **"Guildmaster’s Caravan Ledger"** or **"Kingdom Registry"**, and the analytics actions are framed as **"Investigative Spells / Techniques"**.

---

## 2. The Core Concept: The "Investigator's Toolkit" (In-World Pandas)

Instead of the app pre-calculating everything upfront and giving the player the answers, the player starts with the raw ledger and must **cast / activate analytical tools** to uncover hidden anomalies.

### The Mechanics: Analytical Actions as Investigation Skills

| Real-World Pandas Concept | In-Game Detective Tool | What It Does in UI | What It Teaches |
|---|---|---|---|
| `df.head(5)` / `df.tail()` | **"Inspect Ledger Samples"** | Flips open the top/bottom pages of the physical parchment | Understanding row structures, raw records, sample bias |
| `df.info()` | **"Audit Registry Integrity"** | Highlights data types, missing records, corrupted / null entries | Data cleanliness, missingness, schema validation |
| `df.describe()` | **"Consult Guild Abacus"** | Calculates min, median, mean, max, and spread | Central tendency vs dispersion |
| **Outlier Detection** (`IQR / z-score`) | **"Detect Anomalies (Outlier Lens)"** | Lights up bizarre records in gold/red (e.g. 1 trip with 500 losses, or an impossible distance) | Outliers skewing averages; entry errors vs genuine extremes |
| **Skewness / Distribution** (`df.skew()`, histogram) | **"Balance the Scales (Skew Gauge)"** | Shows whether most events are clustered or if a long tail is dragging the mean | Mean vs Median divergence, why averages lie on skewed data |
| **Groupby & Rate Calculation** | **"Compare Ratios (Counts vs Rates)"** | Aggregates routes and reveals the numerator/denominator ratio | Group-level normalization, Simpson's Paradox |

---

## 3. How This Makes the Game Much More Fun

### 1. Clues Point to Data Actions (The Detective Loop)
Instead of an NPC just talking:
1. **The Town Constable says:** *"The North Road is cursed! Over a hundred wagons vanished there, while the Marsh Road barely lost ten!"*
2. **The Player's Objective:** Check if the Constable is right or misleading people.
3. **Player Action:** 
   - Player clicks **"Consult Guild Abacus"** → sees the total count (North Road: 100, Marsh: 10).
   - Player clicks **"Audit Trip Counts" (Group Aggregation)** → discovers North Road had 10,000 trips (1%), Marsh had 20 trips (50%!).
   - Player clicks **"Detect Anomalies"** → spots that one wagon recorded 80 lost horses due to a clerical typo.
4. **NPC Reaction:** Player presents this evidence to the Guildmaster, debunking the Constable's superstition with concrete rate & outlier proof.

### 2. Action Points or "Investigation Focus"
To make it feel like an actual game rather than a spreadsheet:
- Give the player **Investigation Tokens** (or Stamina/Focus, e.g., 3 actions per day/round).
- Choosing *which* tool to use first matters:
  - Do you check data integrity first?
  - Do you look at outliers?
  - Do you calculate rates?
- This creates stakes and rewards players for asking the right questions rather than blindly clicking every button.

---

## 4. UI/UX Layout Mockup

```
+-----------------------------------------------------------------------------------+
|  BAYANG: The Guildmaster's Secret Ledger                    Mode: Pathfinder [?]  |
+---------------------------------------------------------+-------------------------+
|                                                         |  [INVESTIGATOR TOOLKIT] |
|  SCENE & NPC DIALOGUE:                                  |                         |
|  "The Caravan Master claims an evil beast stalks the    |  [ 📜 Inspect Head (5) ]|
|   Marshlands because the average losses are so high.    |                         |
|   Inspect the ledger before dispatching our knights!"   |  [ 🔍 Audit Schema     ]|
|                                                         |    (nulls / types)      |
+---------------------------------------------------------+                         |
|  THE INTERACTIVE LEDGER (The Dataset):                  |  [ ⚖️ Balance Scales   ]|
|  [ Showing 40 records ] [ Filter: All Routes v ]        |    (Skewness / Spread)  |
|  +----+------------+------------+-------+------------+  |                         |
|  | ID | Route      | Wagons Lost| Trips | Cargo Type |  |  [ ⚡ Outlier Lens     ]|
|  +----+------------+------------+-------+------------+  |    (Highlight extremes) |
|  | 01 | North Road | 2          | 50    | Grain      |  |                         |
|  | 02 | North Road | 1          | 40    | Iron       |  |  [ 📊 Aggregate Rates  ]|
|  | .. | ...        | ...        | ...   | ...        |  |    (Counts vs Rates)    |
|  | 38 | Marsh Road | 42 [!]     | 1     | Silk       |  |                         |
|  +----+------------+------------+-------+------------+  +-------------------------+
|  [!] Anomaly detected: Record 38 has 42 losses in 1 trip! Clue uncovered!         |
+-----------------------------------------------------------------------------------+
|  YOUR ACCUSATION / CONCLUSION:                                                    |
|  [ The Marsh route is truly cursed.                                         ]     |
|  [ The average is skewed by a single extreme outlier (Record 38). (Selected)]     |
|  [ Submit Findings to the Council ]                                               |
+-----------------------------------------------------------------------------------+
```

---

## 5. Scope & Engineering Reality Check (For 5-Day Hackathon)

How do you implement this in 4–5 days without exploding scope?

### Backend Implementation (Python stdlib or lightweight Pandas)
Each button maps to a dead-simple server endpoint or even client-side calculation:
- **`GET /api/dataset/head?n=5`** -> returns slice of records.
- **`GET /api/dataset/info`** -> returns column names, non-null counts, types.
- **`GET /api/dataset/describe`** -> returns min, max, mean, median, IQR.
- **`GET /api/dataset/outliers`** -> flags rows where `value > Q3 + 1.5*IQR`.
- **`GET /api/dataset/skew`** -> returns whether distribution is left/right skewed.

### AMD LLM Role Remains Clean & Safe
The model doesn't compute these statistics.
Instead, when the user triggers an analytical tool (e.g., clicks **Outlier Lens**):
- The deterministic backend finds the outlier.
- The AMD model is fed:
  `"Player activated Outlier Lens. Detected outlier: Record #38 (42 losses). Generate Game Master commentary on the strange ink smudge or unusual merchant note on this ledger entry."`
- The LLM creates immersive narrative context for the mathematical discovery!

---

## 6. Summary Recommendations

1. **Adopt the Investigator's Toolkit**: Replace passive tables with 4–5 clickable analytical actions (`Head`, `Schema/Nulls`, `Outlier Lens`, `Rates/Aggregates`).
2. **Keep computation deterministic**: The Python backend computes statistics, pandas-style; the LLM merely translates those findings into fantasy flavor text.
3. **One case at a time**: Don't build 10 concepts at once. Build one case focused on **Counts vs. Rates**, and optionally one case focused on **Averages vs. Outliers**. That is more than enough to blow away hackathon judges.
