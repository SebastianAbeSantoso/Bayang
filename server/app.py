"""Bayang's small HTTP server and deterministic game engine."""
import json
import mimetypes
import os
import sys
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from data_profiler import DataError, profile_csv, inspect_csv_headers
from model_client import answer_guide, generate_consequence, generate_quest

ROOT = Path(__file__).resolve().parent.parent
CASES = {}
SAMPLES = {
    "caravans_a": "The North Road (Trade Caravans · Baseline)",
    "caravans_b": "The Glasswood Trail (Frontier Pass · Exposure Paradox)",
    "simpsons_paradox": "Highland vs Lowland (True Simpson's Paradox)",
    "server_logs_raw": "Live Datacenter Logs (Raw Event Ingestion)",
    "cloud_ops": "Apex Infrastructure (Cloud DevOps)",
    "clinical_trials": "BioVanguard Phase II (Clinical Trials)",
}
GUIDE_SPARKS = {"apprentice": 2, "pathfinder": 1}
INVESTIGATION_IDS = {"counts", "exposure", "rates", "outliers"}


def load_local_env():
    """Read simple KEY=value settings without adding a dotenv dependency."""
    env_file = ROOT / ".env"
    if not env_file.is_file():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip("\"'")
        if key and key not in os.environ:
            os.environ[key] = value


load_local_env()


def public_case_summary(profile):
    """Expose only group labels before the player investigates."""
    return {
        "groups": [row["group"] for row in profile["groups"]],
        "group_count": len(profile["groups"]),
        "ranking_differs": profile.get("ranking_differs", False),
        "schema_mapping": profile.get("schema_mapping", {}),
        "domain": profile.get("domain", "fantasy"),
        "is_raw_log": profile.get("is_raw_log", False),
        "raw_row_count": profile.get("raw_row_count", 0),
        "stratified": profile.get("stratified"),
    }


def public_quest(quest):
    """Strip the Head Referee's private note before sending a quest to the browser."""
    allowed = {"title", "setting", "premise", "stakes", "challenge",
               "characters", "investigations", "endings", "source", "mode",
               "latency_ms", "model", "attempts", "repaired", "tokens", "cost",
               "verification_note", "ranking_differs"}
    return {key: value for key, value in quest.items() if key in allowed}


def investigation_evidence(profile, action, mode):
    if action == "counts":
        rows = [{"group": row["group"], "events": row["events"]} for row in profile["groups"]]
        label, explanation = "Incident totals", "These are raw event counts. A larger count can reflect more traffic."
    elif action == "exposure":
        rows = [{"group": row["group"], "opportunities": row["opportunities"]} for row in profile["groups"]]
        label, explanation = "Journeys recorded", "This is the amount of exposure behind each event count."
    elif action == "outliers":
        baseline = profile.get("baseline_rate") or (profile["total_events"] / profile["total_opportunities"] if profile["total_opportunities"] else 0.0)
        rows = []
        for row in profile["groups"]:
            ratio = (row["rate"] / baseline) if baseline > 0 else 1.0
            is_anomaly = row.get("is_outlier", False)
            rows.append({
                "group": row["group"],
                "events": row["events"],
                "opportunities": row["opportunities"],
                "rate": row["rate"],
                "is_outlier": is_anomaly,
                "status": f"Anomaly: {ratio:.1f}x baseline" if is_anomaly else "Normal range",
            })
        label = "Outlier & Anomaly Lens"
        explanation = (
            f"Regional average is {baseline:.1%}. Pinpoints routes where incident rate spikes drastically above expectation."
            if mode == "apprentice"
            else f"Regional average is {baseline:.1%}. Highlighting statistical deviations and high-risk anomalies."
        )
    else:
        rows = [{"group": row["group"], "events": row["events"],
                 "opportunities": row["opportunities"], "rate": row["rate"],
                 "projected_events": row.get("projected_events", row["events"]),
                 "projected_exposure": row.get("projected_exposure", row["opportunities"])}
                for row in profile["groups"]]
        label = "Events per journey"
        explanation = ("Rate = events ÷ journeys. Compare these to judge risk per journey."
                       if mode == "apprentice" else "Compare events ÷ journeys across groups.")
    return {
        "label": label,
        "explanation": explanation,
        "rows": rows,
        "equalized_exposure": profile.get("equalized_exposure"),
        "stratified": profile.get("stratified"),
    }



def answer_case(profile, quest, payload, explored_count):
    group = payload.get("group")
    rationale = payload.get("rationale") or payload.get("evidence")
    if rationale == "rate":
        rationale = "risk_density"
    elif rationale == "count":
        rationale = "incident_volume"

    valid_rationales = {"risk_density", "incident_volume", "random_variance"}
    if group not in {row["group"] for row in profile["groups"]} or rationale not in valid_rationales:
        raise DataError("Choose a route and an analytical rationale.")
    if explored_count < 2:
        raise DataError("Investigate at least two records before presenting your finding.")

    correct = group in profile["highest_rate_groups"] and rationale == "risk_density"
    consequence = generate_consequence(quest, profile, group, rationale, correct)

    if correct:
        rate = next(row["rate"] for row in profile["groups"] if row["group"] == group)
        if profile["ranking_differs"]:
            high_count = profile["highest_count_group"]
            feedback = (f"Your deduction holds: {group} carries the highest risk density at {rate:.1%}. "
                        f"{high_count} has the largest gross count, but also much higher exposure. "
                        "Measuring risk per journey isolates the real danger.")
        else:
            feedback = (f"Your deduction holds: {group} carries the highest risk density at {rate:.1%}. "
                        "Both volume and rate peak here, but your rate-based rationale proved it rigorously.")
        ending = quest["endings"]["success"]
    else:
        high_rate = profile["highest_rate_group"]
        rate = next(row["rate"] for row in profile["groups"] if row["group"] == high_rate)
        if rationale == "incident_volume":
            feedback = (f"The council rejected raw volume: large counts often reflect traffic density rather than danger. "
                        f"The true hazard is {high_rate} with a {rate:.1%} incident rate.")
        elif rationale == "random_variance":
            feedback = (f"Dismissed as variance: the data reflects a systematic hazard, not statistical noise. "
                        f"{high_rate} remains the most hazardous route at {rate:.1%}.")
        else:
            feedback = f"Re-examine the rate distribution: {high_rate} actually carries the highest rate at {rate:.1%}."
        ending = quest["endings"]["setback"]

    return {
        "correct": correct,
        "feedback": feedback,
        "consequence": consequence,
        "ending": ending,
        "revealed_answer": profile["highest_rate_group"] if not correct else None
    }


class BayangHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise DataError("I couldn't read that request. Please try again.") from None
        if length > 130_000:
            raise DataError("That request is too large for this demo.")
        try:
            return json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise DataError("I couldn't read that request. Please try again.") from None

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == "/api/samples":
            samples = [{"id": key, "label": label,
                        "csv": (ROOT / "data" / f"{key}.csv").read_text(encoding="utf-8")}
                       for key, label in SAMPLES.items()]
            return self.send_json(200, {"samples": samples})
        if path == "/api/status":
            live = (os.getenv("BAYANG_MODEL_MODE", "amd").lower() == "amd"
                    and bool(os.getenv("AMD_API_KEY")))
            return self.send_json(200, {"mode": "amd-configured" if live else "preview",
                                        "model": os.getenv("AMD_MODEL_NAME", "Gemma-4-31B-IT")})
        relative = "index.html" if path in ("/", "") else path.lstrip("/")
        target = (ROOT / "client" / relative).resolve()
        if ROOT.joinpath("client").resolve() not in target.parents or not target.is_file():
            self.send_error(404, "Not found")
            return
        content = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(str(target))[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        route = urlparse(self.path).path
        try:
            payload = self.read_json()
            if route == "/api/inspect_headers":
                inspection = inspect_csv_headers(payload.get("csv", ""))
                return self.send_json(200, inspection)

            if route == "/api/profile":
                profile = profile_csv(payload.get("csv", ""), custom_mapping=payload.get("custom_mapping"))
                case_id = str(uuid.uuid4())
                CASES[case_id] = {"profile": profile, "quest": None,
                                  "investigated": set(), "guide_remaining": None,
                                  "guide_history": []}
                return self.send_json(200, {"case_id": case_id,
                                            "case": public_case_summary(profile)})

            case = CASES.get(payload.get("case_id"))
            if not case:
                return self.send_json(404, {"error": "That case has expired. Load the dataset again."})
            profile = case["profile"]

            if route == "/api/quest":
                mode = payload.get("mode", "apprentice")
                if mode not in GUIDE_SPARKS:
                    return self.send_json(400, {"error": "Choose a learner path first."})
                quest = generate_quest(profile, mode)
                case["quest"] = quest
                case["investigated"] = set()
                case["guide_remaining"] = GUIDE_SPARKS[mode]
                case["guide_history"] = []
                return self.send_json(200, {"quest": public_quest(quest),
                                            "guide_remaining": case["guide_remaining"]})

            if not case["quest"]:
                return self.send_json(409, {"error": "Open the case before taking an action."})

            if route == "/api/investigate":
                action = payload.get("action")
                if action not in INVESTIGATION_IDS:
                    return self.send_json(400, {"error": "Choose one of the available investigations."})
                investigation = next(item for item in case["quest"]["investigations"] if item["id"] == action)
                case["investigated"].add(action)
                evidence = investigation_evidence(profile, action, case["quest"]["mode"])
                return self.send_json(200, {"investigation": investigation,
                                            "evidence": evidence,
                                            "progress": len(case["investigated"]),
                                            "ready_to_decide": len(case["investigated"]) >= 2})

            if route == "/api/guide":
                question = payload.get("question")
                if not isinstance(question, str) or not question.strip() or len(question) > 700:
                    return self.send_json(400, {"error": "Ask a short question, up to 700 characters."})
                if case["guide_remaining"] <= 0:
                    return self.send_json(429, {"error": "Your Field Guide's Lantern Sparks are spent for this case."})
                result = answer_guide(question.strip(), case["quest"]["mode"], case["guide_history"])
                # Only the Field Guide receives this text. It is never passed to the Head Referee.
                case["guide_history"].extend([{"role": "user", "content": question.strip()},
                                               {"role": "assistant", "content": result["reply"]}])
                case["guide_remaining"] -= 1
                return self.send_json(200, {**result, "remaining": case["guide_remaining"]})

            if route == "/api/answer":
                result = answer_case(profile, case["quest"], payload, len(case["investigated"]))
                return self.send_json(200, result)
            return self.send_json(404, {"error": "That action is not available."})
        except DataError as exc:
            return self.send_json(400, {"error": str(exc)})
        except RuntimeError as exc:
            return self.send_json(502, {"error": str(exc)})


if __name__ == "__main__":
    host = os.getenv("BAYANG_HOST", "127.0.0.1")
    port = int(os.getenv("BAYANG_PORT", "8000"))
    try:
        server = ThreadingHTTPServer((host, port), BayangHandler)
    except OSError as exc:
        raise SystemExit(f"Bayang could not bind to {host}:{port}: {exc}") from exc
    print(f"Bayang is ready at http://{host}:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Bayang stopped.", flush=True)
    finally:
        server.server_close()
