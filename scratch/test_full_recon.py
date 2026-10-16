import sys
from pathlib import Path
sys.path.insert(0, ".")
from server.stage_engine import HandoverEngine
from scratch.test_parser import parse

engine = HandoverEngine()

presets = [
    ("Preset 1: Afternoon Rush (ID)", "Tadi grinder macet 20 menit pas jam 17, buang beans 200g house blend, es batu abis dari jam 18, gak sempet deep clean steam wand kanan karena antrian rame"),
    ("Preset 2: Closing Spoilage & Cash Shortage (EN)", "Oat milk 3 cartons expired dumped unlogged, cash drawer short by Rp 50.000 at close, espresso machine portafilter gasket leaking steam."),
    ("Preset 3: Clean Shift (All Verified)", "Smooth afternoon shift. All inventory counted and matched POS, grinder calibrated at 14:00, ice restocked from backup freezer, closing cash reconciled with zero variance."),
    ("Preset 4: Custom ID Note", "Susu oat 3 karton basi dibuang, kasir kurang Rp 50.000")
]

for label, note in presets:
    engine.reset()
    claims = parse(note)
    # Map to schema required by engine
    formatted_claims = []
    for i, c in enumerate(claims, 1):
        formatted_claims.append({
            "claim_id": f"CLM-{i:02d}",
            "claim_type": c["type"],
            "entity": c["entity"],
            "action": c["action"],
            "quantity": c.get("qty"),
            "unit": c.get("unit"),
            "occurred_at": "during shift",
            "verbatim_quote": c["quote"],
            "quote_valid": True,
            "needs_review": False,
        })
    meta = {
        "mode": "seeded_demo_snapshot",
        "model_status": "seeded_demo_snapshot",
        "model": "google/gemma-3-27b-it",
        "latency_ms": 24,
        "total_claims": len(formatted_claims),
    }
    state = engine.run_reconciliation(formatted_claims, meta=meta, raw_notes_override=note)
    findings = state["findings"]
    print(f"\n==================== {label} ====================")
    print(f"Total findings: {len(findings)} | Can sign off: {state['signoff_gate']['can_sign_off']}")
    for f in findings:
        print(f"  [{f['severity'].upper()}] ({f['evidence_status']}) {f['rule_id']}: {f['title']}")
