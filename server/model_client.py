"""AMD-backed story referee and a separate, deliberately limited player guide."""
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request


PROMPTS = Path(__file__).resolve().parent.parent / "prompts"
SYSTEM_PROMPT = (PROMPTS / "gamemaster.txt").read_text(encoding="utf-8")
GUIDE_PROMPT = (PROMPTS / "fieldguide.txt").read_text(encoding="utf-8")


def _live_enabled():
    return os.getenv("BAYANG_MODEL_MODE", "amd").lower() == "amd" and bool(os.getenv("AMD_API_KEY"))


def _chat(messages, *, temperature=0.7, max_tokens=1000, json_output=False):
    base = os.getenv("AMD_API_BASE_URL", "https://developer.amd.com.cn/radeon/api/v1").rstrip("/")
    endpoint = base + ("/chat/completions" if base.endswith("/v1") else "/v1/chat/completions")
    body = {"model": os.getenv("AMD_MODEL_NAME", "Gemma-4-31B-IT"),
            "temperature": temperature, "messages": messages, "max_tokens": max_tokens,
            "reasoning_effort": "none"}
    if json_output:
        body["response_format"] = {"type": "json_object"}
    request = urllib.request.Request(endpoint, data=json.dumps(body).encode("utf-8"),
                                     headers={"Content-Type": "application/json",
                                              "Authorization": "Bearer " + os.getenv("AMD_API_KEY", "")},
                                     method="POST")
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read())
        return result["choices"][0]["message"]["content"]
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, TypeError, IndexError) as exc:
        raise RuntimeError("The AMD story engine could not answer. Check the connection and try again.") from exc


def _preview_quest(profile, mode):
    groups = profile["groups"]
    count = profile["highest_count_group"]
    rate = profile["highest_rate_group"]
    conflict = profile["ranking_differs"]
    if conflict:
        premise = (f"A ledger from {groups[0]['group']} and its neighboring routes tells two stories: the busiest route has the most recorded events, "
                   f"but the route with the greatest event rate may be a different one. The caravan council asks you to learn which measure deserves its warning bell.")
        stakes = "Your finding will decide where the council sends its next patrol."
        lesson = f"The highest event rate is {rate}; the largest event total is {count}. Compare events with opportunities before deciding."
    else:
        premise = (f"A new ledger has reached the caravan council. Its routes differ in traffic, and the council wants a fair comparison of events per journey, "
                   f"not just the raw totals. Your investigation will decide where the next patrol should travel.")
        stakes = "A sound comparison will keep the council from mistaking busy for dangerous."
        lesson = f"The highest event rate is {rate}. A count measures total events; a rate compares events with opportunities."
    return {
        "title": f"The {groups[0]['group']} Ledger",
        "setting": f"A caravan council post serving {len(groups)} routes",
        "premise": premise,
        "stakes": stakes,
        "challenge": "Which route has the highest event rate, and what evidence supports your finding?",
        "characters": [
            {"name": "Mira Venn", "role": "The council's ledger keeper", "voice": "Careful with records; wary of raw totals."},
            {"name": "Tamsin Reed", "role": "A scout who knows the roads", "voice": "Practical; asks what each number is measured against."},
        ],
        "investigations": [
            {"id": "counts", "title": "Open the incident ledger", "opening": "Mira lays out the raw event totals. Which route fills the most pages with recorded mishaps?"},
            {"id": "exposure", "title": "Inspect the journey registers", "opening": "Tamsin brings the traffic records. Find out how many journeys stand behind each total."},
            {"id": "rates", "title": "Compare the rate markers", "opening": "The quartermaster has prepared events-per-journey markers. Compare the routes on equal footing."},
            {"id": "outliers", "title": "Scrutinize ledger anomalies (Outlier Lens)", "opening": "Examine the ledger for bizarre deviations, extreme ratios, and distorted averages."},
        ],
        "endings": {
            "success": "The council rings the warning bell where your evidence points. The roads are safer because you asked what the totals were measured against.",
            "setback": "The council holds its patrol for one more night. Revisit the ledger and journey registers, then compare events per opportunity.",
        },
        "private_referee": {"answer_group": rate, "lesson": lesson},
        "source": "local-preview",
        "mode": mode,
    }


def _validate_quest(quest, profile):
    text_fields = ("title", "setting", "premise", "stakes", "challenge")
    if any(not isinstance(quest.get(key), str) or not quest[key].strip() for key in text_fields):
        raise ValueError("Quest text is incomplete")
    characters = quest.get("characters")
    if not isinstance(characters, list) or not 2 <= len(characters) <= 3:
        raise ValueError("Invalid characters")
    for character in characters:
        if not isinstance(character, dict) or any(not isinstance(character.get(k), str) or not character[k].strip()
                                                  for k in ("name", "role", "voice")):
            raise ValueError("Invalid character")
    investigations = quest.get("investigations")
    if not isinstance(investigations, list):
        raise ValueError("Invalid investigations")
    # Guarantee standard toolkit investigations
    existing_ids = {item.get("id") for item in investigations if isinstance(item, dict)}
    required_core = {"counts", "exposure", "rates"}
    if not required_core.issubset(existing_ids):
        raise ValueError("Missing core investigation paths")
    if "outliers" not in existing_ids:
        investigations.append({
            "id": "outliers",
            "title": "Scrutinize ledger anomalies (Outlier Lens)",
            "opening": "Examine the records for unusual spikes, severe outliers, and distorted rates."
        })
    for item in investigations:
        if not isinstance(item, dict) or any(not isinstance(item.get(k), str) or not item[k].strip() for k in ("title", "opening")):
            raise ValueError("Invalid investigation text")
    endings = quest.get("endings")
    if not isinstance(endings, dict) or any(not isinstance(endings.get(k), str) or not endings[k].strip()
                                            for k in ("success", "setback")):
        raise ValueError("Invalid endings")
    referee = quest.get("private_referee")
    if not isinstance(referee, dict) or referee.get("answer_group") not in profile["highest_rate_groups"]:
        raise ValueError("The Head Referee returned an invalid private answer")
    if not isinstance(referee.get("lesson"), str) or not referee["lesson"].strip():
        raise ValueError("The Head Referee returned no learning note")


def generate_quest(profile, mode):
    start_time = time.perf_counter()
    if not _live_enabled():
        quest = _preview_quest(profile, mode)
        quest["latency_ms"] = max(1, int((time.perf_counter() - start_time) * 1000))
        quest["model"] = "Local Preview Engine"
        return quest
    user_context = {
        "learner_mode": mode,
        "verified_aggregate_profile": profile,
        "instruction": "Create the quest and private referee note from this profile. The verified highest-rate answer is listed in highest_rate_groups.",
    }
    raw = _chat([{"role": "system", "content": SYSTEM_PROMPT},
                 {"role": "user", "content": json.dumps(user_context, ensure_ascii=False)}],
                temperature=0.85, max_tokens=1600, json_output=True)
    latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))
    try:
        quest = json.loads(raw)
        _validate_quest(quest, profile)
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError("AMD returned a quest in an unexpected format. Please open the case again.") from exc
    quest["source"] = "amd-live"
    quest["mode"] = mode
    quest["latency_ms"] = latency_ms
    quest["model"] = os.getenv("AMD_MODEL_NAME", "Gemma-4-31B-IT")
    return quest


def answer_guide(question, mode, history):
    start_time = time.perf_counter()
    if not _live_enabled():
        lowered = question.casefold()
        if any(term in lowered for term in ("answer", "which route", "which group", "tell me")):
            reply = "I can't choose a route for you. Compare each route's events with its opportunities, then tell me what the rate measures."
        elif any(term in lowered for term in ("rate", "divide", "calculate", "formula", "compare")):
            reply = "A rate is events divided by opportunities. When groups have different amounts of traffic, compare those rates instead of relying on totals alone."
        elif any(term in lowered for term in ("outlier", "anomaly", "skew", "extreme", "spike")):
            reply = "An outlier is a record that deviates sharply from the rest. Check whether a high rate comes from genuinely dangerous conditions or an extreme journey ratio."
        else:
            reply = "Start by asking what each number counts and how many opportunities sit behind it. Which two quantities could you compare?"
        if mode == "pathfinder":
            reply = "Take a moment with the evidence: " + reply
        latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))
        return {"reply": reply, "source": "local-preview", "latency_ms": latency_ms, "model": "Local Preview"}

    messages = [{"role": "system", "content": GUIDE_PROMPT + f"\nGuidance style: {mode}."}]
    for turn in history[-4:]:
        if turn.get("role") in ("user", "assistant") and isinstance(turn.get("content"), str):
            messages.append({"role": turn["role"], "content": turn["content"][:700]})
    messages.append({"role": "user", "content": question})
    reply = _chat(messages, temperature=0.45, max_tokens=220)
    latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))
    if not isinstance(reply, str) or not reply.strip():
        raise RuntimeError("The Field Guide did not answer. Please try again.")
    return {"reply": reply.strip()[:900], "source": "amd-live", "latency_ms": latency_ms, "model": os.getenv("AMD_MODEL_NAME", "Gemma-4-31B-IT")}

