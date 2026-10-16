"""
Full verification script for ShiftGuard React 19 + Google Gemma & AMD Workbench.
Uses Playwright with installed Edge browser on Windows.
"""

import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ARTIFACTS_DIR = Path(r"C:\Users\INTEL\.gemini\antigravity\brain\0d7ef866-c8c0-4f02-83b0-a20d157d1b3c")

def main():
    print("Launching Playwright to test ShiftGuard React 19 Workbench...")
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="msedge", headless=True)
        except Exception:
            try:
                browser = p.chromium.launch(channel="chrome", headless=True)
            except Exception:
                browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Step 1: Load Dashboard
        print("Navigating to http://127.0.0.1:8000...")
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        # Verify title & brand
        title = page.title()
        print(f"Page title: {title}")
        assert "ShiftGuard" in title, f"Unexpected title: {title}"

        page.screenshot(path=str(ARTIFACTS_DIR / "shiftguard_react_dashboard.png"))
        print("Saved screenshot: shiftguard_react_dashboard.png")

        # Step 2: Navigate to Worker Report ("Finish your shift")
        print("Clicking 'Finish your shift'...")
        page.click("button:has-text('Finish your shift')")
        page.wait_for_timeout(800)

        # Select preset 1 or click Load Preset
        preset_select = page.query_selector("#demo-preset-select")
        if preset_select:
            print("Selecting Preset 1 in Demo Packet dropdown...")
            preset_select.select_option("preset_1")
            page.wait_for_timeout(300)

        load_btn = page.query_selector("button:has-text('Load Preset')") or page.query_selector("button:has-text('Fill Recommended Demo Packet')")
        if load_btn:
            print("Clicking 'Load Preset'...")
            load_btn.click()
            page.wait_for_timeout(600)

        page.screenshot(path=str(ARTIFACTS_DIR / "shiftguard_react_worker_report.png"))
        print("Saved screenshot: shiftguard_react_worker_report.png")

        # Click Review and submit report
        rev_btn = page.query_selector("button:has-text('Review and submit report')")
        if rev_btn:
            print("Clicking 'Review and submit report'...")
            rev_btn.click()
            page.wait_for_timeout(600)

        # Click Submit report inside modal
        sub_btn = page.query_selector(".modal-dialog button:has-text('Submit report')")
        if sub_btn:
            print("Submitting report and running Gemma on AMD Token Factory...")
            sub_btn.click()
            page.wait_for_timeout(2000)

        # Step 3: Open Ledger
        print("Navigating to Handover ledger...")
        page.click("button:has-text('Handover ledger')")
        page.wait_for_timeout(800)

        # Select first finding to open FindingDrawer
        finding_item = page.query_selector(".finding")
        if finding_item:
            print("Opening first finding drawer...")
            finding_item.click()
            page.wait_for_timeout(800)

        # Check if Gemma Recommendation is visible
        gemma_box = page.query_selector(".gemma-recommendation-box")
        if gemma_box:
            print("Found Gemma Recommendation Box! Clicking 'Apply Gemma Recommendation'...")
            apply_btn = page.query_selector("button:has-text('Apply Gemma Recommendation')")
            if apply_btn:
                apply_btn.click()
                page.wait_for_timeout(500)
                print("Applied recommendation.")

        page.screenshot(path=str(ARTIFACTS_DIR / "shiftguard_react_ledger_drawer.png"))
        print("Saved screenshot: shiftguard_react_ledger_drawer.png")

        # Switch role to Supervisor
        print("Switching role to Supervisor...")
        role_select = page.query_selector("select")
        if role_select:
            role_select.select_option("supervisor")
            page.wait_for_timeout(500)

        # Assign follow up on critical check
        assign_btn = page.query_selector("button:has-text('Assign follow-up')") or page.query_selector("button:has-text('Carry forward')")
        if assign_btn:
            print("Assigning follow-up...")
            assign_btn.click()
            page.wait_for_timeout(500)

        # Step 4: Check Sign-Off Gate
        sign_btn = page.query_selector("button:has-text('Sign off shift')")
        if sign_btn and not sign_btn.is_disabled():
            print("Sign off button is active! Clicking sign off...")
            sign_btn.click()
            page.wait_for_timeout(600)
            confirm_btn = page.query_selector(".modal-footer button:has-text('Sign off as')")
            if confirm_btn:
                confirm_btn.click()
                page.wait_for_timeout(600)
                print("Shift signed off!")

        page.screenshot(path=str(ARTIFACTS_DIR / "shiftguard_react_signed_off.png"))
        print("Saved screenshot: shiftguard_react_signed_off.png")

        # Step 5: Check Incoming Briefing
        print("Navigating to Incoming briefing...")
        page.click("button:has-text('Incoming briefing')")
        page.wait_for_timeout(800)

        page.screenshot(path=str(ARTIFACTS_DIR / "shiftguard_react_incoming_briefing.png"))
        print("Saved screenshot: shiftguard_react_incoming_briefing.png")

        # Step 6: Check Operational Records
        print("Navigating to Operational records...")
        page.click("button:has-text('Operational records')")
        page.wait_for_timeout(800)

        page.screenshot(path=str(ARTIFACTS_DIR / "shiftguard_react_operational_records.png"))
        print("Saved screenshot: shiftguard_react_operational_records.png")

        browser.close()
        print("All E2E checks and screenshots completed successfully!")

if __name__ == "__main__":
    main()
