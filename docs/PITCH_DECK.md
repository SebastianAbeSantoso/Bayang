# ShiftGuard: Commercial Shift-Handover Reconciliation Workbench
## 5-Slide Pitch Deck (Lablab.ai AMD Developer Hackathon: ACT III)

---

### Slide 1: Title & Hook
**Title**: ShiftGuard: Commercial Shift-Handover Reconciliation Workbench  
**Subtitle**: Closing the gap between messy frontline shift notes and store ERP truth using Google Gemma 3-27B-IT on AMD Instinct GPUs.  
**Track**: Reinvent Commerce  
**Partner Prize**: Google Gemma Partner Prize (`google/gemma-3-27b-it` on AMD Token Factory)  
**Live Demo (Direct App)**: [https://bentoso-shiftguard.static.hf.space/](https://bentoso-shiftguard.static.hf.space/)  
**Hugging Face Space**: [https://huggingface.co/spaces/bentoso/shiftguard](https://huggingface.co/spaces/bentoso/shiftguard)  
**GitHub Repository**: [https://github.com/SebastianAbeSantoso/Bayang](https://github.com/SebastianAbeSantoso/Bayang)  

> *"Between shift changes, $100B+ of commercial retail revenue leaks through the cracks of WhatsApp handover notes that never reach ERP reality."*

---

### Slide 2: The Commerce Problem
**The 10-Minute Shift Change Reality:**
During a 10-minute shift handover at a high-volume coffee chain (*Common Ground Coffee · Central Branch*), baristas leave hurried, multilingual voice and WhatsApp notes:
> *"Tadi grinder macet 20 menit pas jam 17, buang beans 200g house blend, es batu abis dari jam 18, gak sempet deep clean steam wand kanan karena antrian rame"*

**The Three Operational Blindspots:**
1. **Unrecorded Supply Shrinkage (`R-STK-002`)**: Baristas dump 200g of espresso beans during a jam without posting a formal inventory waste adjustment (`INV-20261012-AFT`). POS logs look spotless, creating "phantom inventory" that triggers sudden stockouts.
2. **Unassigned Equipment Jams (`POL-EQP-004`)**: A 20-minute Mahlkönig grinder stoppage is casually mentioned in a group chat, but no maintenance ticket is created or assigned before the next morning's 7:00 AM rush.
3. **Supply-Chain Delivery Gaps (`R-STK-001`)**: Ice hits 0 bags at 18:00 closing, while supplier PO-4481 (*Arctic Ice Co.*) is scheduled for 10:00 AM—leaving the critical 07:00–10:00 AM morning rush completely unsupplied.

---

### Slide 3: How ShiftGuard Works (The Product)
**The Closed-Loop Operational Workflow:**
ShiftGuard turns informal notes into an audit-grade reconciliation workflow in 3 steps:

1. **Outgoing Lead (Dimas) Submits (`WorkerReport.tsx`)**:
   - Outgoing lead enters or speaks informal shift notes in colloquial Indonesian or English.
   - Built-in **Exact Substring Quote-Gate** validates every claimed event character-for-character, highlighting `<mark>` quote spans directly inside the worker's text.
2. **Supervisor (Kevin) Resolves Blockers (`Ledger.tsx` & Finding Drawer)**:
   - Discrepancies are organized on the **Handover Ledger** across 3 orthogonal axes.
   - **Gemma Decision Support** provides 1-click actionable recommendations ("Apply Gemma Recommendation") populating follow-up owners, target windows, and audit justifications.
   - **Sign-Off Blocker Gate** prevents closing until critical exceptions are assigned or resolved.
3. **Incoming Lead (Rina) Opens (`Briefing.tsx` & `StaffRoster.tsx`)**:
   - Incoming lead receives a synthesized 30-second operational briefing before unlocking the doors.
   - Live **Current Shift Roster** tracks on-duty staff, covers, and early departures with automatic timestamps (`[HH:MM]`).

---

### Slide 4: Under the Hood: Gemma 3-27B on AMD + Deterministic Verification
**Why Neither an LLM Alone nor Rules Alone Can Solve This:**
- An LLM alone hallucinates phantom store numbers, confuses store stock codes, and cannot be trusted with legal audit logs.
- Rules alone cannot parse colloquial Indonesian/English barista shorthand (`"macet 20 menit"`, `"buang beans 200g"`, `"abis dari jam 18"`).

**The Hybrid Epistemic Architecture:**
- **Perception Layer — Google Gemma 3-27B-IT on AMD Token Factory**:
  - Translates rapid bilingual shorthand into structured candidate claims (`claim_type`, `entity`, `action`, `quantity`, `unit`, `verbatim_quote`).
  - Observed Latency: **~700–900 ms** (`p50 = 892 ms`, throughput `347.5 tok/sec`).
  - Ultra-low cost: **`$0.000157 USD`** (`~Rp 2,51 IDR`) per shift at 950 tokens.
- **Verification Layer — Anti-Hallucination Substring Gate & 5 Deterministic Rules**:
  - **100% Quote Verification**: Rejects any candidate claim whose verbatim quote does not exist verbatim in the note.
  - Cross-checks verified claims against **10 physical and digital store records** (`POS`, `MC`, `CD`, `SS`, `INV`, `PO-4481`, `CHK`, `INC`, `SCH-HYG-204`, `SCH-MNT-108`).
  - Classifies findings across the **3-Axis Model**:
    - **Severity**: *Critical* (blocker) · *Needs Review* (warning) · *Info* (corroborated)
    - **Evidence Status**: *Supported* · *Contradicted* · *Not Confirmed*
    - **Workflow Status**: *Open* · *Carry Forward* · *Resolved*

---

### Slide 5: Measurable Operational Impact & Verification
**Manual Reconciliation vs. ShiftGuard:**

| Operational Dimension | Manual Shift Handover | ShiftGuard Automated Workbench |
| :--- | :--- | :--- |
| **Reconciliation Time** | 25–45 minutes of manual cross-referencing | **< 1 second** (`892 ms` AMD Token Factory latency) |
| **Inventory Shrinkage Catch** | Unlogged waste discovered weeks later at audit | **Immediate catch**: 200g unposted bean purge flagged on submit |
| **Equipment Downtime Risk** | Barista note forgotten; machine jams during 7 AM rush | **1-Click Ticket & Owner**: Grinder maintenance ticket assigned |
| **Delivery Gap Detection** | Surprised by stockout during morning peak | **Predictive 3-Hour Warning**: Ice gap flagged 14 hours ahead |
| **Audit Compliance** | Unsigned paper clipboards & lost chats | **Immutable JSON/Markdown Audit Log** with actor timestamps |

**A Concrete Catch from the Demo:**
ShiftGuard cross-checks Physical Stock Sheet `SS-20261012-AFT` (0 bags of ice at 22:00 closing) against Supplier PO-4481 (*Arctic Ice Co.*, ETA 10:00 AM).
**Result:** Detects that the cafe opens at 07:00 AM with **zero ice** for the first 3 hours of peak cold beverage demand—alerting the team to arrange an emergency 06:30 AM supplier courier before opening.

---
