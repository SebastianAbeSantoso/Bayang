import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        print("Navigating to http://127.0.0.1:8000...")
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")

        # Wait for SVG and stage tokens
        page.wait_for_selector(".char-standee-group", timeout=10000)
        time.sleep(1.5)

        # 1. Capture initial state with 2D character tokens
        page.screenshot(path="scratch/stage_2d_tokens.png")
        print("Captured scratch/stage_2d_tokens.png")

        # 2. Wait for autonomous metronome step or click Raise Curtain
        print("Waiting for dynamic turn execution...")
        time.sleep(4.0)

        # Capture dynamic movement state
        page.screenshot(path="scratch/stage_dynamic_move.png")
        print("Captured scratch/stage_dynamic_move.png")

        # Check for error logs
        errors = [l for l in console_logs if "error" in l.lower() and "favicon" not in l.lower()]
        print("Console errors count:", len(errors))
        if errors:
            for e in errors[:5]:
                print("  ", e)

        browser.close()
        print("Playwright test completed successfully.")

if __name__ == "__main__":
    run()
