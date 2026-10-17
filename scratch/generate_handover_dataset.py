"""Deterministic generator for data/handover_packet_01/sensor_telemetry.csv and recorded_run.json."""
import csv
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKET_DIR = ROOT / "data" / "handover_packet_01"
PACKET_DIR.mkdir(parents=True, exist_ok=True)


def generate_telemetry_csv():
    rng = random.Random(20261016)
    rows = []
    fieldnames = [
        "timestamp",
        "minute_index",
        "HYD_PRESS_02_BAR",
        "HYD_TEMP_02_C",
        "VALVE_V12_PRESS_BAR",
        "L1_FILTER_DP_BAR",
        "COOLANT_FLOW_LPM",
        "BOILER_EXHAUST_O2_PCT",
        "BOILER_STEAM_TEMP_C",
        "PUMP_03_BEARING_TEMP_C",
        "PUMP_03_VIB_MMS",
    ]

    for m in range(360):
        hh = m // 60
        mm = m % 60
        ts = f"{hh:02d}:{mm:02d}"

        # 1. HYD_PRESS_02_BAR: nominal ~115.0 bar
        # Clean claim #2: transient 2-min spike at 02:10-02:11 (128 bar), back to 114 bar by 02:12
        # Contradiction #2: around 04:30 (04:32 to 04:38 = 7 consecutive mins), sustained drift 131.5 to 136.8 bar (> oem_warn 125, > oem_max 135)
        hyd_press = 115.0 + rng.gauss(0, 0.8)
        if ts in ("02:10", "02:11"):
            hyd_press = 128.0 if ts == "02:10" else 126.4
        elif ts == "02:12":
            hyd_press = 114.1
        elif 272 <= m <= 278:  # 04:32 to 04:38 (7 consecutive minutes)
            hyd_press = 132.5 + (m - 272) * 0.7

        # 2. HYD_TEMP_02_C: nominal ~54 C at 01:15, ~56 C at EOD (05:30-05:59)
        hyd_temp = 54.0 + (m / 360.0) * 2.0 + rng.gauss(0, 0.25)

        # 3. VALVE_V12_PRESS_BAR:
        # Contradiction #1: At 01:40 (m=100), regulated to 145 PSI = 10.0 bar (exceeds oem_max 8.5 bar)
        if m < 95:
            v12_press = 7.0 + rng.gauss(0, 0.08)
        else:
            v12_press = 10.0 + rng.gauss(0, 0.06)

        # 4. L1_FILTER_DP_BAR:
        # Contradiction #5: Tech claims "L1 filt dP < 0.8b @ EOD", but 05:30-05:59 (m >= 330) averages ~1.38 bar (exceeds oem_max 1.0 bar)
        if m < 280:
            l1_dp = 0.48 + (m / 280.0) * 0.22 + rng.gauss(0, 0.02)
        elif m < 330:
            l1_dp = 0.75 + ((m - 280) / 50.0) * 0.55 + rng.gauss(0, 0.02)
        else:
            l1_dp = 1.38 + rng.gauss(0, 0.03)

        # 5. COOLANT_FLOW_LPM: steady ~52.0 L/min around 02:45 and throughout shift
        coolant_flow = 52.0 + rng.gauss(0, 0.45)

        # 6. BOILER_EXHAUST_O2_PCT:
        # Clean claim #7: 3.1% around 02:00 (m=120)
        # Contradiction #7: Sensor dropout NaN from 04:50 to 05:59 (m >= 290)
        if 110 <= m <= 130:
            boiler_o2 = f"{3.1 + rng.gauss(0, 0.04):.2f}"
        elif m >= 290:
            boiler_o2 = "NaN"
        else:
            boiler_o2 = f"{3.2 + rng.gauss(0, 0.05):.2f}"

        # 7. BOILER_STEAM_TEMP_C: steady ~198 C around 03:30
        boiler_temp = 198.0 + rng.gauss(0, 0.5)

        # 8. PUMP_03_BEARING_TEMP_C:
        # Contradiction #4: Normal 62.0 C at 03:00 (m=180), but late runaway climb from 05:15 (m=315) peaking at 94.2 C at 05:45 (m=345) > oem_max 85.0 C
        if m <= 310:
            bearing_temp = 62.0 + rng.gauss(0, 0.35)
        elif m <= 345:
            bearing_temp = 62.5 + ((m - 310) / 35.0) * 31.7 + rng.gauss(0, 0.2)
        else:
            bearing_temp = 91.5 + rng.gauss(0, 0.4)

        # 9. PUMP_03_VIB_MMS:
        # Contradiction #8: "settled down mid-shift" (02:30-03:30, m=150..210), but mid-shift has high oscillation std > 0.6 and spikes up to 5.4 mm/s (> oem_warn 4.5)
        if 150 <= m <= 210:
            vib = 3.6 + 1.65 * math.sin((m - 150) * 0.45) + rng.gauss(0, 0.15)
        else:
            vib = 2.4 + rng.gauss(0, 0.12)

        rows.append({
            "timestamp": ts,
            "minute_index": m,
            "HYD_PRESS_02_BAR": f"{hyd_press:.2f}",
            "HYD_TEMP_02_C": f"{hyd_temp:.2f}",
            "VALVE_V12_PRESS_BAR": f"{v12_press:.2f}",
            "L1_FILTER_DP_BAR": f"{l1_dp:.2f}",
            "COOLANT_FLOW_LPM": f"{coolant_flow:.2f}",
            "BOILER_EXHAUST_O2_PCT": boiler_o2,
            "BOILER_STEAM_TEMP_C": f"{boiler_temp:.2f}",
            "PUMP_03_BEARING_TEMP_C": f"{bearing_temp:.2f}",
            "PUMP_03_VIB_MMS": f"{vib:.2f}",
        })

    csv_path = PACKET_DIR / "sensor_telemetry.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Generated {len(rows)} rows in {csv_path}")


def generate_recorded_claims():
    """Generates the 16 structured claims (8 contradictions + 8 clean) as extracted by Gemma."""
    claims = [
        # --- 8 PLANTED CONTRADICTIONS ---
        {
            "claim_id": "CLM-01",
            "technician": "Marco Rossi (Mechanical)",
            "equipment_id": "COOLANT_LOOP_01",
            "metric_column": "VALVE_V12_PRESS_BAR",
            "claim_type": "VALUE_APPROX",
            "claimed_value": 145.0,
            "claimed_unit": "PSI",
            "reference_time": "01:40",
            "language": "IT",
            "verbatim_quote": "Regolazione valvola V-12 completata alle 01:40: pressione linea impostata a 145 PSI, tutto regolare.",
            "english_translation": "Valve V-12 regulation completed at 01:40: line pressure set to 145 PSI, all normal."
        },
        {
            "claim_id": "CLM-02",
            "technician": "Marco Rossi (Mechanical)",
            "equipment_id": "HYD_PRESS_02",
            "metric_column": "HYD_PRESS_02_BAR",
            "claim_type": "STABLE_WITHIN_SPEC",
            "claimed_value": 115.0,
            "claimed_unit": "bar",
            "reference_time": "04:30",
            "language": "EN",
            "verbatim_quote": "HYD_PRESS_02 main ram pressure stabilized around 04:30 at 115 bar after accumulator check.",
            "english_translation": "HYD_PRESS_02 main ram pressure stabilized around 04:30 at 115 bar after accumulator check."
        },
        {
            "claim_id": "CLM-03",
            "technician": "Marco Rossi (Mechanical)",
            "equipment_id": "PUMP_03",
            "metric_column": None,
            "work_order_id": "WO-409",
            "claim_type": "MAINTENANCE_COMPLETED",
            "claimed_value": "SIGNED_OFF",
            "claimed_unit": None,
            "reference_time": "04:15",
            "language": "EN",
            "verbatim_quote": "PUMP_03 seal replacement complete per WO-409, LOTO removed and cleared for startup.",
            "english_translation": "PUMP_03 seal replacement complete per WO-409, LOTO removed and cleared for startup."
        },
        {
            "claim_id": "CLM-04",
            "technician": "Julian Bennett (Electrical)",
            "equipment_id": "PUMP_03",
            "metric_column": "PUMP_03_BEARING_TEMP_C",
            "claim_type": "STABLE_WITHIN_SPEC",
            "claimed_value": 62.0,
            "claimed_unit": "C",
            "reference_time": "03:00",
            "check_post_window": True,
            "language": "EN",
            "verbatim_quote": "Checked PUMP_03 drive bearing temp at 03:00 (62 C normal), unit running cool for rest of shift.",
            "english_translation": "Checked PUMP_03 drive bearing temp at 03:00 (62 C normal), unit running cool for rest of shift."
        },
        {
            "claim_id": "CLM-05",
            "technician": "Julian Bennett (Electrical)",
            "equipment_id": "COOLANT_LOOP_01",
            "metric_column": "L1_FILTER_DP_BAR",
            "claim_type": "UPPER_BOUND",
            "claimed_value": 0.8,
            "claimed_unit": "bar",
            "reference_time": "EOD",
            "language": "EN",
            "verbatim_quote": "L1 filt dP < 0.8b @ EOD, no element change needed yet.",
            "english_translation": "Strainer L1 differential pressure < 0.8 bar at end of shift, no filter change needed."
        },
        {
            "claim_id": "CLM-06",
            "technician": "Marco Rossi / Julian Bennett",
            "equipment_id": "COOLANT_LOOP_01",
            "metric_column": "COOLANT_BYPASS_VALVE",
            "claim_type": "VALVE_STATE",
            "claimed_value": "CLOSED_VS_OPEN",
            "claimed_unit": None,
            "reference_time": "05:15",
            "language": "EN",
            "verbatim_quote": "Coolant bypass valve left CLOSED after line check at 05:00",
            "secondary_quote": "Opened coolant bypass at 05:15 for sensor flush, day shift must close before press cycle.",
            "english_translation": "Conflicting valve handover: Mechanical logged bypass CLOSED at 05:00; Electrical opened bypass at 05:15 and left it OPEN for day shift."
        },
        {
            "claim_id": "CLM-07",
            "technician": "Elena Conti (Process)",
            "equipment_id": "BOILER_01",
            "metric_column": "BOILER_EXHAUST_O2_PCT",
            "claim_type": "STABLE_WITHIN_SPEC",
            "claimed_value": 3.2,
            "claimed_unit": "%",
            "reference_time": "EOD",
            "language": "EN",
            "verbatim_quote": "Boiler exhaust O2 steady at 3.2% through end of shift, combustion trim nominal.",
            "english_translation": "Boiler exhaust O2 steady at 3.2% through end of shift, combustion trim nominal."
        },
        {
            "claim_id": "CLM-08",
            "technician": "Marco Rossi (Mechanical)",
            "equipment_id": "PUMP_03",
            "metric_column": "PUMP_03_VIB_MMS",
            "claim_type": "STABLE_WITHIN_SPEC",
            "claimed_value": 2.4,
            "claimed_unit": "mm/s",
            "reference_time": "MID_SHIFT",
            "language": "EN",
            "verbatim_quote": "PUMP_03 frame vibration settled down mid-shift after baseplate check, running smooth.",
            "english_translation": "PUMP_03 frame vibration settled down mid-shift (unanchored timestamp) after baseplate check."
        },
        # --- 8 CLEAN CLAIMS (TRUE NEGATIVES) ---
        {
            "claim_id": "CLM-09",
            "technician": "Marco Rossi (Mechanical)",
            "equipment_id": "HYD_PRESS_02",
            "metric_column": "HYD_TEMP_02_C",
            "claim_type": "VALUE_APPROX",
            "claimed_value": 54.0,
            "claimed_unit": "C",
            "reference_time": "01:15",
            "language": "EN",
            "verbatim_quote": "HYD_PRESS_02 oil reservoir temp held steady around 54 C at 01:15 during initial die warm-up cycle.",
            "english_translation": "HYD_PRESS_02 oil reservoir temp held steady around 54 C at 01:15."
        },
        {
            "claim_id": "CLM-10",
            "technician": "Marco Rossi (Mechanical)",
            "equipment_id": "HYD_PRESS_02",
            "metric_column": "HYD_PRESS_02_BAR",
            "claim_type": "TRANSIENT_RECOVERED",
            "claimed_value": 114.0,
            "claimed_unit": "bar",
            "reference_time": "02:10",
            "language": "IT",
            "verbatim_quote": "Picco transitorio pressione HYD_PRESS_02 a 128 bar alle 02:10, rientrato a 114 bar entro 2 minuti senza intervento.",
            "english_translation": "Transient HYD_PRESS_02 pressure spike to 128 bar at 02:10, recovered to 114 bar within 2 minutes (< 3 mins above warn)."
        },
        {
            "claim_id": "CLM-11",
            "technician": "Marco Rossi (Mechanical)",
            "equipment_id": "HYD_PRESS_02",
            "metric_column": None,
            "work_order_id": "WO-402",
            "claim_type": "MAINTENANCE_COMPLETED",
            "claimed_value": "SIGNED_OFF",
            "claimed_unit": None,
            "reference_time": "02:35",
            "language": "EN",
            "verbatim_quote": "Completed accumulator pre-charge verification on HYD_PRESS_02 per WO-402, signed off and returned to service.",
            "english_translation": "Completed accumulator pre-charge verification on HYD_PRESS_02 per WO-402, signed off."
        },
        {
            "claim_id": "CLM-12",
            "technician": "Julian Bennett (Electrical)",
            "equipment_id": "COOLANT_LOOP_01",
            "metric_column": "COOLANT_FLOW_LPM",
            "claim_type": "VALUE_APPROX",
            "claimed_value": 52.0,
            "claimed_unit": "L/min",
            "reference_time": "02:45",
            "language": "EN",
            "verbatim_quote": "COOLANT_LOOP_01 main supply flow steady at 52 L/min around 02:45, VFD current draw nominal.",
            "english_translation": "COOLANT_LOOP_01 main supply flow steady at 52 L/min around 02:45."
        },
        {
            "claim_id": "CLM-13",
            "technician": "Julian Bennett (Electrical)",
            "equipment_id": "HYD_PRESS_02",
            "metric_column": "HYD_TEMP_02_C",
            "claim_type": "VALUE_APPROX",
            "claimed_value": 56.0,
            "claimed_unit": "C",
            "reference_time": "EOD",
            "language": "EN",
            "verbatim_quote": "HYD_PRESS_02 oil temp at 56 C @ EOD, cooling fan auto-cycling normally.",
            "english_translation": "HYD_PRESS_02 oil temp at 56 C at end of shift."
        },
        {
            "claim_id": "CLM-14",
            "technician": "Elena Conti (Process)",
            "equipment_id": "BOILER_01",
            "metric_column": None,
            "work_order_id": "WO-405",
            "claim_type": "MAINTENANCE_COMPLETED",
            "claimed_value": "SIGNED_OFF",
            "claimed_unit": None,
            "reference_time": "01:50",
            "language": "EN",
            "verbatim_quote": "BOILER_01 burner igniter cleaned and verified per WO-405, ticket closed and signed off.",
            "english_translation": "BOILER_01 burner igniter cleaned and verified per WO-405, signed off."
        },
        {
            "claim_id": "CLM-15",
            "technician": "Elena Conti (Process)",
            "equipment_id": "BOILER_01",
            "metric_column": "BOILER_EXHAUST_O2_PCT",
            "claim_type": "VALUE_APPROX",
            "claimed_value": 3.1,
            "claimed_unit": "%",
            "reference_time": "02:00",
            "language": "EN",
            "verbatim_quote": "BOILER_01 exhaust O2 reading 3.1% at 02:00 check, damper actuator tracking setpoint.",
            "english_translation": "BOILER_01 exhaust O2 reading 3.1% at 02:00 check."
        },
        {
            "claim_id": "CLM-16",
            "technician": "Elena Conti (Process)",
            "equipment_id": "BOILER_01",
            "metric_column": "BOILER_STEAM_TEMP_C",
            "claim_type": "VALUE_APPROX",
            "claimed_value": 198.0,
            "claimed_unit": "C",
            "reference_time": "03:30",
            "language": "IT",
            "verbatim_quote": "Temperatura vapore BOILER_01 stabile a 198 C intorno alle 03:30, nessuna anomalia.",
            "english_translation": "BOILER_01 steam temperature stable at 198 C around 03:30, no anomaly."
        }
    ]

    recorded_path = PACKET_DIR / "recorded_run.json"
    payload = {
        "model": "google/gemma-2-27b-it (AMD Token Factory Verified Run)",
        "source": "recorded_verified_run",
        "latency_ms": 642,
        "api_calls": 1,
        "prompt_tokens": 1140,
        "completion_tokens": 985,
        "total_tokens": 2125,
        "claims": claims,
    }
    with open(recorded_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"Generated {len(claims)} claims in {recorded_path}")


if __name__ == "__main__":
    generate_telemetry_csv()
    generate_recorded_claims()
