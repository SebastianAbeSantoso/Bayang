# Implementation Plan: ShiftGuard (Industrial Shift-Handover & Maintenance Auditor)

## Goal Description

Pivot the codebase into **ShiftGuard** (`bayang-handover-auditor`), a shift-handover reconciliation workbench built for the **Intelligent Industry** track (Lablab.ai AMD Developer Hackathon: ACT III) and the **Google Gemma Partner Prize**.

At every 8-hour shift change, an incoming plant supervisor has 10 to 15 minutes to review messy bilingual (English/Italian) technician notes, pending maintenance work orders, OEM operating limits, and 360 minutes of noisy PLC sensor telemetry. **ShiftGuard** pairs **Gemma** (hosted on the **AMD Token Factory API**) for unstructured, cited claim extraction with a **Deterministic Telemetry & Spec Verifier** in Python that cross-checks every claim against time-series sensor CSV slices, work order sign-offs, and OEM safety thresholds. The supervisor reviews ranked discrepancies with verbatim quotes and telemetry slices, logs formal dispositions, and exports a signed Shift Handover Audit Record.

---

## Refactor Map & Task Breakdown

1. **Task 1: Synthetic Industrial Dataset (`data/handover_packet_01/`)**
   - Files: `oem_specs.json`, `work_orders.json`, `shift_notes.txt`, `sensor_telemetry.csv` (360 rows, 00:00 to 05:59), `recorded_run.json`.
   - Embeds 8 Clean Claims (True Negatives) and 8 Planted Contradictions (True Positives).
   - Done Criteria: Dataset loads cleanly and contains all 16 verifiable claims.

2. **Task 2: Deterministic Telemetry & Spec Verifier (`server/stage_engine.py`)**
   - Repurpose into `HandoverEngine` (aliasing `StageEngine = HandoverEngine`).
   - Implement Rule 1 (`resolve_time_window`), Rule 2 (`VALUE_APPROX` + PSI-to-Bar conversion), Rule 3 (`STABLE_WITHIN_SPEC` + post-check runaway tail check), Rule 4 (`MAINTENANCE_COMPLETED` + `CROSS_LOG_CONFLICT`), and Rule 5 (`verify_quote_exists` >= 12 chars).
   - Done Criteria: `python server/test_handover_engine.py` passes 100% (8/8 TP, 0/8 FP).

3. **Task 3: Gemma Claim Extractor & Schema Gate (`server/stage_model_client.py`)**
   - Replace character dialogue prompt with `GEMMA_EXTRACTION_SYSTEM_PROMPT` targeting AMD Token Factory (`google/gemma-2-9b-it` / `google/gemma-2-27b-it`).
   - Implement 1-retry JSON schema validator, `verify_quote_exists` anti-hallucination gate, and recorded-run fallback loader.
   - Done Criteria: Live and fallback extraction return valid, quote-verified JSON claims with latency and token telemetry.

4. **Task 4: HTTP API Endpoints (`server/app.py`)**
   - Add `GET /api/handover/state`, `POST /api/handover/run`, `POST /api/handover/resolve`, `POST /api/handover/reset`, and `GET /api/handover/export`.
   - Done Criteria: `python server/test_handover_api.py` passes all endpoint assertions.

5. **Task 5: Two-Pane Industrial Workbench UI (`client/index.html`, `client/style.css`, `client/app.js`)**
   - Left Pane: 4-tab raw data inspector (`Shift Notes`, `Work Orders`, `OEM Specs`, `PLC Telemetry`) with interactive quote highlighting and time-window slicing.
   - Right Pane: Ranked Discrepancies Queue with 3 disposition actions (`Hold & Escalate`, `Acknowledge & Override`, `Mark False Positive`), Collapsible Verified Clean Claims Accordion, and Locked Shift Sign-Off Footer.
   - Done Criteria: Playwright E2E test (`scratch/test_shiftguard_ui.py`) verifies full workflow and sign-off unlock with 0 console errors.

6. **Task 6: Documentation & Submission Compliance (`LICENSE`, `README.md`)**
   - Add MIT `LICENSE` and comprehensive `README.md` documenting the deterministic verification math, dataset benchmark table, and setup instructions.
   - Enforce strictly zero em dashes across the repository.
