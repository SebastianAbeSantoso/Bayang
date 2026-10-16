import shutil
import os

art_dir = r"C:\Users\INTEL\.gemini\antigravity\brain\0d7ef866-c8c0-4f02-83b0-a20d157d1b3c"
shots = [
    ("scratch/stage_dollhouse_ui.png", "stage_dollhouse_ui.png"),
    ("scratch/stage_evidence_drawer.png", "stage_evidence_drawer.png"),
    ("scratch/stage_dollhouse_turned.png", "stage_dollhouse_turned.png"),
]

for src, dst in shots:
    if os.path.exists(src):
        dst_path = os.path.join(art_dir, dst)
        shutil.copy2(src, dst_path)
        print(f"Copied {src} to {dst_path}")
