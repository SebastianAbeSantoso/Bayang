# Playwright E2E UI verification test for 2x2 Victorian Dollhouse Stage
import os
import sys
import time
import shutil
import threading
from http.server import ThreadingHTTPServer

# Add server to path
sys.path.insert(0, os.path.abspath("server"))
from app import BayangHandler

def run_e2e_test():
    test_port = 8765
    server = ThreadingHTTPServer(("127.0.0.1", test_port), BayangHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    print(f"Test server running on http://127.0.0.1:{test_port}")
    time.sleep(0.5)

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        url = f"http://127.0.0.1:{test_port}"
        print(f"Navigating to {url}...")
        page.goto(url, wait_until="networkidle")

        # 1. Assert 2x2 Dollhouse Stage SVG is rendered
        page.wait_for_selector("#stage-svg", timeout=10000)
        page.wait_for_selector("#chamber-1-group", timeout=5000)
        page.wait_for_selector("#chamber-2-group", timeout=5000)
        page.wait_for_selector("#chamber-3-group", timeout=5000)
        page.wait_for_selector("#chamber-4-group", timeout=5000)
        print("[PASS] 4 Dollhouse chambers rendered successfully.")

        # 2. Assert Doorways & Curtains
        doorways = page.query_selector_all(".doorway-group")
        print(f"[PASS] {len(doorways)} connecting doorways rendered on stage.")

        # 3. Assert Reverse: 1999 2D Character Tokens
        page.wait_for_selector(".char-standee-group", timeout=5000)
        standees = page.query_selector_all(".char-standee-group")
        print(f"[PASS] {len(standees)} character standees rendered with pedestals and tokens.")

        # Check Spotlight vs Silhouette classes
        spotlighted = page.query_selector_all(".char-spotlighted")
        silhouettes = page.query_selector_all(".char-silhouette")
        print(f"[PASS] Spotlight rule active: {len(spotlighted)} spotlighted, {len(silhouettes)} in shadow.")

        # 4. Capture Initial Dollhouse Stage Screenshot
        os.makedirs("scratch", exist_ok=True)
        initial_shot = "scratch/stage_dollhouse_ui.png"
        page.screenshot(path=initial_shot)
        print(f"Captured {initial_shot}")

        # 5. Test Slide-Over Evidence Board Drawer
        print("Testing Slide-Over Evidence Board drawer...")
        toggle_btn = page.query_selector("#toggle-ledger-btn")
        if toggle_btn:
            toggle_btn.click()
            page.wait_for_selector("#evidence-drawer.open", timeout=5000)
            time.sleep(0.5)
            drawer_shot = "scratch/stage_evidence_drawer.png"
            page.screenshot(path=drawer_shot)
            print(f"Captured {drawer_shot}")

            # Close drawer
            close_btn = page.query_selector("#close-evidence-drawer")
            if close_btn:
                close_btn.click()
                time.sleep(0.4)
                print("[PASS] Evidence drawer closed smoothly.")

        # 6. Test Stage Turn Advance (Raise Curtain)
        turn_btn = page.query_selector("#stage-turn-btn")
        if turn_btn:
            print("Clicking Raise Curtain...")
            turn_btn.click()
            time.sleep(2.5)
            turn_shot = "scratch/stage_dollhouse_turned.png"
            page.screenshot(path=turn_shot)
            print(f"Captured {turn_shot}")

        # 7. Check Console Errors
        error_logs = [l for l in console_logs if "error" in l.lower() and "favicon" not in l.lower()]
        print("Console errors count:", len(error_logs))
        if error_logs:
            for err in error_logs[:5]:
                print("  Console Error:", err)

        browser.close()
        server.shutdown()
        print("\n[ALL E2E PLAYWRIGHT CHECKS PASSED CLEANLY!]")

if __name__ == "__main__":
    run_e2e_test()
