import subprocess
import shutil

print("npm:", shutil.which("npm"))
print("node:", shutil.which("node"))
print("npx:", shutil.which("npx"))

for cmd in [["npm", "--version"], ["npx", "pnpm", "--version"]]:
    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        print(" ".join(cmd), "->", res.stdout.strip(), "err:", res.stderr.strip()[:100])
    except Exception as e:
        print(" ".join(cmd), "-> error:", e)
