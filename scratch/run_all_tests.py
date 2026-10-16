# Runner script for all test suites and zero em dash verification
import subprocess
import sys
import os
import glob

def run_suite(name, cmd):
    print(f"=== Running {name} ===")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"FAIL: {name}")
        print(res.stdout)
        print(res.stderr)
        return False
    else:
        print(f"PASS: {name}")
        lines = [l for l in res.stdout.strip().split("\n") if l.strip()]
        for l in lines[-4:]:
            print("  ", l)
        return True

all_passed = True
suites = [
    ("Epistemic Engine Tests", "python server/test_epistemic_engine.py"),
    ("Stage Engine Tests", "python server/test_stage_engine.py"),
    ("Stage Model Tests", "python server/test_stage_model.py"),
    ("Stage API Tests", "python server/test_stage_api.py"),
]

for name, cmd in suites:
    if not run_suite(name, cmd):
        all_passed = False

print("\n=== Scanning for Em Dash Violations (\\u2014 or literal —) ===")
em_dash_violations = []

extensions = [".py", ".js", ".html", ".css", ".md", ".json"]
exclude_dirs = [".git", "node_modules", ".venv", "venv", "__pycache__"]

target_dirs = ["server", "client", "docs"]

for target_dir in target_dirs:
    if not os.path.exists(target_dir):
        continue
    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if any(file.endswith(ext) for ext in extensions):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    if "—" in content or "\u2014" in content:
                        for line_idx, line in enumerate(content.split("\n"), start=1):
                            if "—" in line or "\u2014" in line:
                                em_dash_violations.append((path, line_idx, line.strip()))
                except Exception as e:
                    pass

if em_dash_violations:
    print(f"FAILED: Found {len(em_dash_violations)} em dash violations:")
    for path, line_no, line in em_dash_violations[:10]:
        print(f"  {path}:{line_no}: {line}")
    all_passed = False
else:
    print("PASS: STRICTLY ZERO EM DASHES found across the repository!")

if not all_passed:
    sys.exit(1)
print("\nALL VERIFICATION GATES PASSED SUCCESSFULLY!")
