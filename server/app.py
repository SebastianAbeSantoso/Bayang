"""Bayang's small HTTP server and deterministic game engine."""
import json
import mimetypes
import os
import sys
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from data_profiler import DataError, profile_csv
from model_client import answer_guide, generate_quest

ROOT = Path(__file__).resolve().parent.parent
CASES = {}
SAMPLES = {"caravans_a": "The North Road", "caravans_b": "The Glasswood Trail"}
GUIDE_SPARKS = {"apprentice": 2, "pathfinder": 1}
INVESTIGATION_IDS = {"counts", "exposure", "rates"}


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
    return {"groups": [row["group"] for row in profile["groups"]],
            "group_count": len(profile["groups"])}


def public_quest(quest):
    """Strip the Head Referee's private note before sending a quest to the browser."""
    allowed = {"title", "setting", "premise", "stakes", "challenge",
               "characters", "investigations", "endings", "source", "mode"}
    return {key: value for key, value in quest.items() if key in allowed}


def investigation_evidence(profile, action, mode):
    if action == "counts":
        rows = [{"group": row["group"], "events": row["events"]} for row in profile["groups"]]
        label, explanation = "Incident totals", "These are raw event counts. A larger count can reflect more traffic."
    elif action == "exposure":
        rows = [{"group": row["group"], "opportunities": row["opportunities"]} for row in profile["groups"]]
        label, explanation = "Journeys recorded", "This is the amount of exposure behind each event count."
    else:
        rows = [{"group": row["group"], "events": row["events"],
                 "opportunities": row["opportunities"], "rate": row["rate"]}
                for row in profile["groups"]]
        label = "Events per journey"
        explanation = ("Rate = events ÷ journeys. Compare these to judge risk per journey."
                       if mode == "apprentice" else "Compare events ÷ journeys across groups.")
    return {"label": label, "explanation": explanation, "rows": rows}


def answer_case(profile, quest, payload, explored_count):
    group = payload.get("group")
    evidence_type = payload.get("evidence")
    if group not in {row["group"] for row in profile["groups"]} or evidence_type not in ("rate", "count"):
        raise DataError("Choose a route and one kind of evidence.")
    if explored_count < 2:
        raise DataError("Investigate at least two records before presenting your finding.")
    correct = group in profile["highest_rate_groups"] and evidence_type == "rate"
    if correct:
        rate = next(row["rate"] for row in profile["groups"] if row["group"] == group)
        if profile["ranking_differs"]:
            high_count = profile["highest_count_group"]
            feedback = (f"Your finding holds: {group} has the highest event rate at {rate:.1%}. "
                        f"{high_count} has the largest total, but it also had more journeys. The rate compares events per journey.")
        else:
            feedback = (f"Your finding holds: {group} has the highest event rate at {rate:.1%}. "
                        "The total and rate point to the same route here, and the rate still answers risk per journey.")
        ending = quest["endings"]["success"]
    else:
        high_rate = profile["highest_rate_group"]
        rate = next(row["rate"] for row in profile["groups"] if row["group"] == high_rate)
        if evidence_type != "rate":
            feedback = "The council needs evidence about events per journey. A raw count measures volume; it does not adjust for traffic."
        else:
            feedback = f"Look again at the rates: {high_rate} has the highest event rate at {rate:.1%}. Compare events with journeys, not just totals."
        ending = quest["endings"]["setback"]
    return {"correct": correct, "feedback": feedback, "ending": ending,
            "revealed_answer": profile["highest_rate_group"] if not correct else None}


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
                                        "model": os.getenv("AMD_MODEL_NAME", "DeepSeek-V4-Flash")})
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
            if route == "/api/profile":
                profile = profile_csv(payload.get("csv", ""))
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
