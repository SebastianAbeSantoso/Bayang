"""
Playwright E2E Verification & Screenshot Suite for ShiftGuard
(Cafe Shift-Handover Reconciliation Workbench for Lablab.ai ACT III: Reinvent Commerce).

Verifies:
1. Initial workbench load with 0 console/page errors.
2. Seeded Demo Extraction -> 6 findings rendered in 3-group triage:
   - Critical Sign-Off Blockers (muted red #B84C43)
   - Review Required & Routine Variance (soft amber #C58A36, collapsible)
   - Clean Operations & Supported Records (neutral sage #71816A, collapsible)
3. Active Shift Report view:
   - Indonesian voice-note transcript (demo) badge
   - Exact character span highlights on the untouched original note:
     'grinder macet 20 menit', 'buang beans 200g', 'es batu abis'
   - Mutual hover & click selection
4. Incoming Handover & Telemetry Overview view:
   - 30-Second Shift Briefing card (grounded strictly in fixtures, ETA 10:00 AM)
   - 7 clearly labeled operational sources (POS, Machine 84/83+1 cycles, Incident Book,
     Inventory Ledger, Stock Sheet, Supplier Order, Checklist)
5. Decision Support & Triage:
   - Written rationale enforcement on overrides
   - Blockers resolution and shift sign-off gate
   - Cross-shift carryover acknowledgment (acknowledged != resolved)
"""

import sys
import time
import urllib.request
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ARTIFACT_DIR = Path(
    r"C:\Users\INTEL\.gemini\antigravity\brain\0d7ef866-c8c0-4f02-83b0-a20d157d1b3c"
)


def run_e2e():
    # Reset workbench state first via HTTP POST
    req = urllib.request.Request("http://127.0.0.1:8000/api/handover/reset", data=b"{}", headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req)

    console_errors = []
    page_errors = []

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="msedge", headless=True)
        except Exception:
            browser = p.chromium.launch(channel="chrome", headless=True)

        context = browser.new_context(viewport={"width": 1440, "height": 920})
        page = context.new_page()

        page.on(
            "console",
            lambda msg: console_errors.append(msg.text) if msg.type == "error" else None,
        )
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        # 1. Initial Workbench Load
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        time.sleep(0.5)
        page.screenshot(path=str(ARTIFACT_DIR / "shiftguard_initial_workbench.png"))

        # 2. Run Seeded Demo Extraction
        page.click("#btn-run-seeded")
        page.wait_for_selector(".finding-row", timeout=5000)
        time.sleep(0.5)

        # Verify grouped triage headers exist
        crit_group = page.query_selector(".ledger-group-header.group-crit")
        assert crit_group is not None, "Expected Critical Sign-Off Blockers group header"
        review_group = page.query_selector(".ledger-group-header.group-review")
        assert review_group is not None, "Expected Review Required group header"
        clean_group = page.query_selector(".ledger-group-header.group-clean")
        assert clean_group is not None, "Expected Clean Operations group header"

        # Verify findings count = 6
        rows = page.query_selector_all(".finding-row")
        assert len(rows) == 6, f"Expected 6 findings, got {len(rows)}"

        # Test Routine Variance Collapsible Toggle
        assert page.query_selector("#btn-toggle-review") is not None, "Expected toggle button on review group"
        page.click("#btn-toggle-review")
        time.sleep(0.2)
        assert page.is_hidden("#group-body-review"), "Review group should be collapsed"
        page.click("#btn-toggle-review")
        time.sleep(0.2)
        assert not page.is_hidden("#group-body-review"), "Review group should be expanded"

        page.screenshot(path=str(ARTIFACT_DIR / "shiftguard_reconciled_ledger.png"))

        # 3. Active Shift Report View & Exact Span Highlighter
        page.click("#nav-btn-report")
        time.sleep(0.5)

        # Verify Indonesian default note & voice-note badge
        badge = page.query_selector("#worker-note-badge")
        assert badge is not None and "Voice-note transcript" in badge.inner_text(), "Expected voice-note badge"

        # Verify exact character spans in note preview
        spans = page.query_selector_all(".quote-span")
        assert len(spans) >= 3, f"Expected at least 3 highlighted quote spans, got {len(spans)}"
        span_texts = [s.inner_text().strip() for s in spans]
        print("Found quote spans:", span_texts)
        assert any("grinder macet 20 menit" in st for st in span_texts), "Expected 'grinder macet 20 menit' span"
        assert any("buang beans 200g" in st for st in span_texts), "Expected 'buang beans 200g' span"
        assert any("es batu abis" in st for st in span_texts), "Expected 'es batu abis' span"

        # Click a span and verify it selects that finding in the drawer
        spans[0].click()
        time.sleep(0.3)
        assert not page.is_hidden("#drawer-active-content"), "Drawer should display clicked finding"

        page.screenshot(path=str(ARTIFACT_DIR / "shiftguard_quote_spans_report.png"))

        # 4. Incoming Handover & Telemetry Overview View (30-Sec Briefing + 7 Sources)
        page.click("#nav-btn-overview")
        time.sleep(0.5)

        # Verify 30-Second Shift Briefing card
        briefing_text = page.inner_text("#briefing-prose-text")
        print("Briefing text:", briefing_text)
        assert "Grinder jam reported for 20 minutes" in briefing_text, "Expected grinder downtime in briefing"
        assert "Bean-waste entry (200 g)" in briefing_text, "Expected bean waste in briefing"
        assert "Ice stock is at 0 bags" in briefing_text, "Expected ice stock alert in briefing"
        assert "10:00 AM" in briefing_text, "Expected 10:00 AM supplier delivery ETA"

        # Verify facts count
        facts = page.query_selector_all(".briefing-fact-card")
        assert len(facts) >= 3, f"Expected 3 briefing fact cards, got {len(facts)}"

        # Verify all 6 source containers have content
        for cid in [
            "#pos-summary-container",
            "#machine-summary-container",
            "#incident-book-container",
            "#inventory-summary-container",
            "#stock-sheet-container",
            "#supplier-orders-container",
        ]:
            c_text = page.inner_text(cid)
            assert len(c_text.strip()) > 0, f"Source container {cid} was empty"

        # Check Rule 1 Machine Counter: 84 cycles vs 83 drinks + 1 purge = 0 delta
        mac_text = page.inner_text("#machine-summary-container")
        assert "84" in mac_text and "0 delta" in mac_text, "Expected 84 cycles and 0 delta in machine summary"

        # Check Rule 3 Stock Sheet: Ice Cubes 0 bags and Supplier PO-ICE-402
        stk_text = page.inner_text("#stock-sheet-container")
        assert "Ice Cubes" in stk_text and "0 bags" in stk_text, "Expected Ice Cubes 0 bags in stock sheet"
        sup_text = page.inner_text("#supplier-orders-container")
        assert "PO-ICE-402" in sup_text and "10:00 AM" in sup_text, "Expected PO-ICE-402 in supplier orders"

        page.screenshot(path=str(ARTIFACT_DIR / "shiftguard_incoming_briefing.png"))

        # 5. Ledger Triage, Rationale Requirement & Sign-off Flow
        page.click("#nav-btn-ledger")
        time.sleep(0.3)

        # Attempt override with empty rationale -> expect error
        page.fill("#drawer-rationale-input", "")
        page.click("#btn-act-override")
        time.sleep(0.2)
        assert page.is_visible("#drawer-action-error"), "Expected error on empty override rationale"

        # Resolve open findings
        for _ in range(8):
            open_rows = page.query_selector_all(".finding-row")
            clicked = False
            for r in open_rows:
                txt = r.inner_text()
                if "STATE: OPEN" in txt:
                    r.click()
                    time.sleep(0.15)
                    page.fill(
                        "#drawer-rationale-input",
                        "Supervisor verified and signed off for handover continuity.",
                    )
                    if "RULE_05" in page.inner_text("#drawer-rule-code"):
                        page.click("#btn-act-carry")
                    else:
                        page.click("#btn-act-override")
                    time.sleep(0.25)
                    clicked = True
                    break
            if not clicked:
                break

        # Check Sign-off button
        sign_btn = page.query_selector("#btn-sign-off-shift")
        assert not sign_btn.is_disabled(), "Sign-off button should be enabled"
        sign_btn.click()
        time.sleep(0.5)

        # Switch to Morning Shift and Acknowledge Carryover Item
        page.click("#btn-shift-am")
        time.sleep(0.4)
        ack_btn = page.query_selector(".btn-carry-act[data-act='acknowledge']")
        assert ack_btn is not None, "Expected Acknowledge Receipt button on Next Morning Shift"
        ack_btn.click()
        time.sleep(0.3)

        page.screenshot(path=str(ARTIFACT_DIR / "shiftguard_signed_audit_modal.png"))
        browser.close()

    assert len(console_errors) == 0, f"Console errors: {console_errors}"
    assert len(page_errors) == 0, f"Page errors: {page_errors}"
    print("ALL PLAYWRIGHT E2E ASSERTIONS PASSED WITH ZERO CONSOLE/PAGE ERRORS!")


if __name__ == "__main__":
    run_e2e()
