# ShiftGuard — 2-Minute Demo Video Recording Script
**Track**: Reinvent Commerce | **Partner Prize**: Google Gemma 3-27B-IT on AMD Token Factory  
**Demo URL to Open in Browser**: `https://bentoso-shiftguard.static.hf.space/` (or `http://localhost:8000`)

---

## Quick Recording Tips Before You Press Record
1. **Screen Resolution**: Set browser to 100% zoom (1920x1080 fullscreen recommended).
2. **Preset Setup**: Have the page open at the POS Login screen in **State 2: Seeded Demo** (default).
3. **Cursor Movement**: Move smoothly; pause for half a second when pointing at key elements (Telemetry pill, `<mark>` quotes, Gemma recommendation button).

---

## 🎬 Act 1: The Hook & POS Login Screen (0:00 – 0:20)

### 🖥️ WHAT TO SHOW:
1. Start recording on the **POS Login Screen** (`ShiftLogin.tsx`).
2. Point your cursor briefly at the PIN keypad and the branch title: *"Common Ground Coffee · Central Branch"*.
3. Hover over the topbar toggle showing **`State 1: Empty`** and **`State 2: Seeded Demo`**.
4. Click the amber button: **`[Judging Only] Skip Login → Dashboard`** (or click staff lead **`Dimas`**).

### 🎙️ WHAT TO SAY:
> *"In high-volume coffee and retail chains, POS cash registers look completely normal at closing time—while the outgoing barista's messy WhatsApp note says the grinder jammed, 200 grams of coffee beans were dumped unlogged, and ice ran out hours ago.*
> 
> *Over a hundred billion dollars leaks through this shift-handover blindspot every year. We built **ShiftGuard** to close that gap.*
> 
> *For hackathon judges, our workbench includes instant judging controls to test both a clean slate and seeded demo runs."*

---

## 🎬 Act 2: The Dashboard & Grounded Shift Metrics (0:20 – 0:45)

### 🖥️ WHAT TO SHOW:
1. The **Dashboard** loads.
2. Slowly move your cursor across the **Shift Operational Metrics** bar:
   - Point at **200g House Blend beans** (Supply Waste & Stock Status).
   - Point at **1 machine flagged · Grinder #1** (Equipment & Machine Fixing).
   - Point at **3/4 tasks completed** (Closing Checklist).
   - Point at **3 active items** (Scheduled Deliveries & Tasks).

### 🎙️ WHAT TO SAY:
> *"Here on the Dashboard, ShiftGuard surfaces grounded operational metrics captured directly in the active shift—not arbitrary vanity charts.*
> 
> *We immediately see 200 grams of unlogged bean waste, one flagged Mahlkönig grinder needing inspection, a skipped steam wand cleaning task, and three upcoming scheduled deliveries."*

---

## 🎬 Act 3: Finish Your Shift, Gemma 3-27B & Telemetry (0:45 – 1:15)

### 🖥️ WHAT TO SHOW:
1. Click **`Finish your shift`** in the top navigation bar.
2. Scroll to the **Shift Notes & Verbatim Quote Spans** box:
   - Highlight the raw Indonesian note:  
     `"Tadi grinder macet 20 menit pas jam 17, buang beans 200g house blend, es batu abis dari jam 18, gak sempet deep clean steam wand kanan karena antrian rame"`
   - Point at the yellow highlighted `<mark>` quote spans (`grinder macet 20 menit`, `buang beans 200g`).
3. Click the topbar pill: **`Gemma 3-27B-IT · 950 tok · 892ms · $0.00016 · Telemetry`**.
4. The **Telemetry Modal** opens:
   - Point at **Token Breakdown** (640 in, 310 out = 950 total).
   - Point at **Latency (892 ms)** and **Throughput (347.5 tok/sec)** on AMD Token Factory.
   - Point at **Cost: $0.000157 USD** (~Rp 2,51 IDR) per shift.
   - Point at **100% Substring Quote-Gate Pass Rate**.
5. Close the modal by clicking the `×` or clicking outside.

### 🎙️ WHAT TO SAY:
> *"When shift lead Dimas closes his shift, he types or speaks his natural handover note in colloquial Indonesian or English shorthand.*
> 
> *Google Gemma 3-27B-IT—running on AMD Instinct GPUs via AMD Token Factory—extracts structured candidate claims.*
> 
> *Clicking our live Telemetry Inspector reveals the real run metrics: 950 tokens processed in just 892 milliseconds at 347 tokens per second, costing a fraction of a cent per shift. Crucially, our exact Substring Quote Gate verifies 100% of quotes character-for-character to eliminate hallucination."*

---

## 🎬 Act 4: The Handover Ledger & Gemma Decision Support (1:15 – 1:40)

### 🖥️ WHAT TO SHOW:
1. Click **`Handover ledger`** in the top navigation.
2. Show the **Handover Ledger table**:
   - Point at the red **Critical** blocker badges.
   - Show the 3 orthogonal axes: **Severity**, **Evidence Status** (*Supported / Contradicted / Not confirmed*), and **Workflow Status**.
3. Click on the finding: **`Grinder #1 (Mahlkönig E65S) Jammed`** (or **`Unrecorded Bean Waste`**).
4. The **Finding Drawer** slides open on the right:
   - Point at the amber **`Gemma Decision Support`** box.
   - Click the button: **`⚡ Apply Gemma Recommendation`**.
   - Show how it instantly populates the follow-up owner (*Opening Shift Lead*) and due time (*Before 07:00 morning rush*).
5. Click **`Carry forward`** or **`Mark resolved`**.
6. Point to the **Sign-Off Blocker Gate** status turning green.

### 🎙️ WHAT TO SAY:
> *"In the Handover Ledger, ShiftGuard’s deterministic rule engine cross-checks Gemma’s claims against 10 store records: POS sales, espresso machine counters, inventory adjustments, and supplier purchase orders.*
> 
> *Critical blockers stop the shift from being signed off prematurely.*
> 
> *Opening any finding displays Gemma Decision Support. With one click on 'Apply Gemma Recommendation', the supervisor populates the technician assignment and due window, resolving the blocker for audit compliance."*

---

## 🎬 Act 5: Incoming Briefing, The Concrete Catch & Staff Roster (1:40 – 2:05)

### 🖥️ WHAT TO SHOW:
1. Click **`Incoming briefing`** in the navigation:
   - Point at the **Synthesized 30-Second Briefing**.
   - **Highlight the Concrete Catch**: Point at the alert showing **0 bags of ice at closing vs Arctic Ice Co. PO-4481 arriving at 10:00 AM**, leaving a 3-hour morning gap.
2. Click **`Staff roster`** in the navigation:
   - Point out **Part 1: Store Staff Directory** (PINs protected for Store Owners only).
   - Point out **Part 2: Current Shift Roster** with the **Timestamped Roster Log** recording that Bima left early and was covered by Reza at [19:30].
3. Finish on the clean dashboard or briefing screen.

### 🎙️ WHAT TO SAY:
> *"When incoming shift lead Rina opens the store, she gets an instant 30-second briefing.*
> 
> *Here is a concrete commercial catch from our demo: ShiftGuard cross-referenced the stock sheet showing zero ice bags at closing against Arctic Ice Co.'s purchase order arriving at 10:00 AM—flagging a 3-hour stockout gap before the morning rush even starts.*
> 
> *Finally, our two-part Staff Roster secures POS PINs for owners while giving shift leads an automated, timestamped roster log.*
> 
> *ShiftGuard combines Google Gemma 3-27B-IT, AMD Instinct hardware, and deterministic verification to reinvent commerce operations. Thank you!"*
