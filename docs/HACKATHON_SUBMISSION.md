# ShiftGuard: Lablab.ai AMD Developer Hackathon ACT III Submission Package

**Track:** Reinvent Commerce  
**Partner Prize:** Google Gemma Partner Prize (`google/gemma-3-27b-it` via AMD Token Factory API)  
**Repository:** [https://github.com/SebastianAbeSantoso/Bayang](https://github.com/SebastianAbeSantoso/Bayang)  

---

## 1. Ready-to-Paste Lablab.ai Portal Fields

### Project Title
**ShiftGuard — Audit-Grade Cafe Shift Handover Reconciliation Workbench**

### Short Description (Under 150 Characters)
Reconciles messy bilingual barista shift notes against POS, stock, and supplier POs using Google Gemma 3-27B-IT on AMD Token Factory + Quote-Gate.

### Long Description (Problem, Solution & Commercial Impact)
**The Problem:**  
In high-velocity retail and specialty coffee chains (modeled on *Common Ground Coffee · Central Branch*), store operations run on shift handovers between Morning (`07:00–16:00`), Afternoon (`16:00–22:00`), and Night (`22:00–07:00`) crews. Outgoing shift leads leave informal WhatsApp/Slack notes written in rapid colloquial Indonesian/English shorthand:
> *"Tadi grinder macet 20 menit pas jam 17, buang beans 200g house blend, es batu abis dari jam 18, gak sempet deep clean steam wand kanan karena antrian rame"*

Meanwhile, official store records (POS sales exports, manual stock sheets, inventory adjustment logs, machine brew counters, and supplier purchase orders) sit in isolated silos. Without automated cross-verification, three operational breakdowns occur:
1. **Unrecorded Supply Waste (`R-STK-002`)**: Baristas dump 200g of House Blend beans during a grinder jam without posting a formal inventory waste entry (`INV-20261012-AFT`), distorting stock counts.
2. **Unassigned Equipment Malfunctions (`POL-EQP-004`)**: Equipment malfunctions (`Grinder #1 Mahlkönig E65S jammed 20 min`) get buried in chat without an assigned follow-up owner or technician dispatch.
3. **Supplier Delivery & Hygiene Gaps (`R-STK-001` & `R-CHK-001`)**: Ice hits zero at 18:00 while supplier purchase order `PO-4481` (Arctic Ice Co.) isn't scheduled until `10:00 AM` the next morning, and skipped mandatory closing tasks (`Right steam wand deep clean`) go untracked.

**The Solution — ShiftGuard:**  
ShiftGuard is a POS-tablet shift handover reconciliation workbench that pairs **Google Gemma 3-27B-IT** (via the **AMD Token Factory API**) with a **deterministic 5-rule verification engine** and an **exact Substring Quote-Gate**:
- **Perception Layer (Google Gemma 3-27B-IT on AMD Token Factory)**: Extracts structured operational claims (`equipment_issue`, `remake_waste`, `stock_action`, `task_completion`, `cash_variance`) from messy Indonesian and English notes in `~892 ms` (`347.5 tok/sec`, `$0.000157 USD` per shift).
- **Anti-Hallucination Substring Quote-Gate**: Every extracted claim must carry a `verbatim_quote` verified character-for-character against the raw shift note (`100%` pass rate).
- **Deterministic 3-Axis Verification Engine**: Cross-checks claims against POS exports (`POS-20261012-AFT`), stock sheets (`SS-20261012-AFT`), inventory logs (`INV-20261012-AFT`), machine counters (`MC-20261012-AFT`), and supplier POs (`PO-4481`), categorizing every check across **Evidence**, **Severity**, and **Workflow**.
- **Closed-Loop Handover & Timestamped Roster**: Blocks shift transfer until critical blockers are resolved or carried forward with an assigned owner, synthesizes the **Incoming Shift Briefing**, and tracks the **Current Shift Roster** (early departures, covers, and mid-shift replacements) with automatic timestamps.

### Technology & Partner Tags
`Google Gemma 3-27B-IT` · `AMD Token Factory` · `Python 3.10+` · `React 19` · `TypeScript` · `Vite` · `Reinvent Commerce`

---

## 2. Updated 2-Minute Demo Video Script (Step-by-Step)

| Timestamp | Screen / Component | Visual Action on Screen | Voiceover Script |
| :--- | :--- | :--- | :--- |
| **0:00–0:20** | **POS Login & Judging Controls** (`ShiftLogin.tsx`) | Show POS PIN keypad, **`State 1: Empty` vs `State 2: Seeded Demo`**, and click **`[Judging Only] Skip Login → Dashboard`** (or sign in as `Dimas`). | *"In busy coffee chains, POS systems think everything is fine while the outgoing barista's shift note says the grinder jammed, 200g of coffee beans were dumped unlogged, and ice ran out. We built ShiftGuard to close that gap. For hackathon judges, we included instant Judging-Only controls to toggle between a clean Empty Slate and a Seeded Demo, or jump straight to the Dashboard."* |
| **0:20–0:45** | **Dashboard & Grounded Shift Metrics** (`Dashboard.tsx`) | Highlight the **Shift Operational Metrics** strip: `200g House Blend beans` waste, `1 machine flagged` (`Grinder #1`), `3/4` closing checklist, and `3` scheduled items. | *"On the Dashboard, ShiftGuard surfaces grounded operational metrics captured in the active shift: 200g of unposted bean waste, 1 grinder malfunction needing follow-up, 1 skipped mandatory steam wand task, and 3 scheduled deliveries and maintenance checks."* |
| **0:45–1:15** | **Finish Your Shift & Telemetry Modal** (`WorkerReport.tsx` + `TelemetryModal.tsx`) | Open **Finish your shift**, show the Indonesian shorthand note & **Verbatim Quote Spans**, then click the topbar **`Gemma 3-27B-IT · 950 tok · 892ms · $0.00016 · Telemetry`** pill. | *"When shift lead Dimas submits his report in colloquial Indonesian or English, Google Gemma 3-27B-IT on AMD Token Factory extracts structured claims. Clicking our Telemetry pill reveals exact token usage—640 prompt and 310 completion tokens—an 892ms latency at 347 tokens per second, a cost of just $0.000157 per shift, and 100% verbatim Substring Quote-Gate verification."* |
| **1:15–1:40** | **Handover Ledger & Gemma Decision Support** (`Ledger.tsx`) | Open **Handover ledger**, click a Critical blocker (`FND-001` or `FND-002`), click **`Apply Gemma Recommendation`**, and click **`Carry forward` / `Mark resolved`**. | *"In the Handover Ledger, our deterministic rule engine cross-checks Gemma's claims against POS, inventory, and supplier PO-4481. Critical blockers prevent premature shift sign-off. With one click on 'Apply Gemma Recommendation', the shift lead or supervisor assigns the follow-up owner and resolves the blocker."* |
| **1:40–2:00** | **Incoming Briefing & 2-Part Staff Roster** (`Briefing.tsx` + `StaffRoster.tsx`) | Show **Incoming briefing** (3-field Schedule form: `Name`, `Schedule`, `Action`), then open **Staff roster** showing **Part 1 (Paginated Directory)** and **Part 2 (Current Shift Roster with Timestamped Log)**. | *"Incoming lead Rina gets an instant briefing with scheduled deliveries and carried-forward tasks. And in our 2-part Staff Roster, store PINs are protected for Owners only, while Part 2 lets the Shift Lead or Owner record mid-shift roster changes—like Bima leaving early at 19:30 and Reza covering—with automatic timestamps."* |

---

## 3. 10-Slide Pitch Deck Outline

1. **Title & Hook**: **ShiftGuard** — Audit-Grade Shift Handover Reconciliation with `google/gemma-3-27b-it` on AMD Token Factory.
2. **The Store Handover Blindspot**: Why WhatsApp barista notes and siloed POS/ERP logs cause unrecorded waste, peak-hour equipment stalls, and missed delivery gaps.
3. **Real-World Scenario (Common Ground Coffee)**: Breaking down Dimas's Afternoon Shift note (`grinder macet 20 menit`, `buang beans 200g`, `es batu abis`, `gak sempet deep clean steam wand`).
4. **Hybrid Epistemic Architecture**: Why LLMs should extract candidate claims while deterministic Python rules enforce store truth.
5. **Anti-Hallucination Substring Quote-Gate**: Character-for-character substring verification (`100%` pass rate across 10 bilingual benchmark scenarios).
6. **AMD Token Factory & Gemma 3-27B-IT Telemetry**: `950` tokens (`640 in / 310 out`), `892 ms` p50 latency, `347.5 tok/sec`, and `$0.000157 USD` (`~Rp 2,51 IDR`) per shift.
7. **3-Axis Handover Ledger & Sign-Off Gate**: Separating **Evidence** (*Supported / Contradicted / Unconfirmed*), **Severity** (*Critical / Review / Info*), and **Workflow** (*Open / Carried / Resolved*).
8. **Grounded Shift Metrics & Streamlined Scheduling**: Measuring real in-app operational events (supply waste, machine fixing, checklist completion, and 3-field recurring schedules).
9. **Role-Based Staff Roster & Timestamped Shift Tracking**: Owner-protected store directory (paginated 5/page) + Shift Lead/Owner editable **Current Shift Roster** recording early departures and covers with timestamps.
10. **Deployment & Commercial Scale**: Zero-dependency Python backend + React 19 POS tablet frontend, ready for multi-branch specialty coffee and QSR chains.
