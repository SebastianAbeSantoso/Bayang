import os, sys, time, json
from pathlib import Path
sys.path.insert(0, ".")
from server.app import load_local_env
load_local_env()
from server.stage_model_client import StageModelClient

client = StageModelClient()
print("Model ID:", client.model_id)
print("API Base:", client.api_base)
print("API Key Prefix:", client.api_key[:6] if client.api_key else "None")
sys.stdout.flush()

note = "Tadi grinder macet 20 menit pas jam 17, buang beans 200g house blend, es batu abis dari jam 18, gak sempet deep clean steam wand kanan karena antrian rame"

t0 = time.time()
claims, meta = client.extract_handover_claims(note, mode="live")
print("Elapsed:", round(time.time() - t0, 2), "s")
print("Meta:", meta)
print("Claims count:", len(claims))
for c in claims:
    print(" ", c)
