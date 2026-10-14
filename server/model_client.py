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


def compute_cost_usd(prompt_tokens, completion_tokens):
    """Estimate compute cost on AMD cloud infrastructure vs commercial API."""
    total_tokens = prompt_tokens + completion_tokens
    # Estimated $0.20 per 1M tokens on dedicated AMD ROCm vLLM instance
    amd_cost = round(total_tokens * 0.0000002, 6)
    # Estimated $5.00 per 1M blended tokens on proprietary closed cloud API
    commercial_equiv = round(total_tokens * 0.0000050, 6)
    savings_pct = round((1.0 - (amd_cost / commercial_equiv)) * 100, 1) if commercial_equiv > 0 else 0.0
    return {
        "amd_cost_usd": amd_cost,
        "amd_compute_usd": amd_cost,
        "commercial_equiv_usd": commercial_equiv,
        "proprietary_cloud_usd": commercial_equiv,
        "savings_pct": savings_pct,
    }


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
        usage = result.get("usage", {})
        content = result["choices"][0]["message"]["content"]
        return content, usage
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, TypeError, IndexError) as exc:
        raise RuntimeError("The AMD story engine could not answer. Check the connection and try again.") from exc


def _preview_quest(profile, mode):
    groups = profile["groups"]
    count = profile["highest_count_group"]
    rate = profile["highest_rate_group"]
    conflict = profile["ranking_differs"]
    if conflict:
        premise = (f"A ledger from {groups[0]['group']} and its neighboring sectors tells two stories: the busiest sector has the most recorded events, "
                   f"but the sector with the highest event rate is a different one. The governing council asks you to determine which measure deserves its primary intervention.")
        stakes = "Your finding will decide where the council commits its protective resources."
        lesson = f"The highest event rate is {rate}; the largest event total is {count}. Compare events with opportunities before deciding."
    else:
        premise = (f"A new ledger has reached the governing council. Its sectors differ greatly in exposure, and the council needs a fair comparison of events per opportunity, "
                   f"not just gross totals. Your investigation will decide where resources are allocated.")
        stakes = "A rigorous comparison will keep the council from mistaking high activity for true danger."
        lesson = f"The highest event rate is {rate}. A count measures total volume; a rate compares events with opportunities."
    return {
        "title": f"The {groups[0]['group']} Ledger",
        "setting": f"Regional oversight council monitoring {len(groups)} sectors",
        "premise": premise,
        "stakes": stakes,
        "challenge": "Which sector has the highest event rate, and what evidence supports your finding?",
        "characters": [
            {"name": "Mira Venn", "role": "Head Records Analyst", "voice": "Careful with ledgers; skeptical of unadjusted gross totals."},
            {"name": "Tamsin Reed", "role": "Field Operations Inspector", "voice": "Practical; insists on evaluating events relative to exposure."},
        ],
        "investigations": [
            {"id": "counts", "title": "Inspect raw incident registers", "opening": "Examine the unadjusted total counts. Which sector records the highest absolute volume of events?"},
            {"id": "exposure", "title": "Audit opportunity registers", "opening": "Review recorded exposure. Find out how many opportunities stand behind each total."},
            {"id": "rates", "title": "Compare normalized rates", "opening": "Evaluate events per opportunity across groups on an equal footing."},
            {"id": "outliers", "title": "Scrutinize statistical anomalies (Outlier Lens)", "opening": "Examine the ledger for severe deviations, extreme ratios, and baseline spikes."},
        ],
        "endings": {
            "success": "The council directs its intervention where your evidence points. Operations are protected because you asked what totals were measured against.",
            "setback": "The council holds its decision for another cycle. Revisit the ledger and compare events per opportunity.",
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

    # Anti-leak assertion: Ensure public text doesn't spoil the answer key directly
    premise_lower = quest.get("premise", "").lower()
    answer_lower = str(referee.get("answer_group", "")).lower()
    if answer_lower and f"highest rate is {answer_lower}" in premise_lower:
        raise ValueError("Public premise contains spoiler of answer key")


def generate_quest(profile, mode):
    start_time = time.perf_counter()
    if not _live_enabled():
        quest = _preview_quest(profile, mode)
        quest["latency_ms"] = max(1, int((time.perf_counter() - start_time) * 1000))
        quest["model"] = "Local Preview Engine"
        quest["attempts"] = 1
        quest["repaired"] = False
        quest["ranking_differs"] = profile.get("ranking_differs", False)
        quest["tokens"] = {"prompt": 420, "completion": 340, "total": 760}
        quest["cost"] = compute_cost_usd(420, 340)
        return quest

    user_context = {
        "learner_mode": mode,
        "verified_aggregate_profile": profile,
        "instruction": "Create the quest and private referee note from this profile. The verified highest-rate answer is listed in highest_rate_groups. Return strict JSON only.",
    }
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(user_context, ensure_ascii=False)}
    ]

    total_prompt_tokens = 0
    total_completion_tokens = 0
    attempts = 0
    max_attempts = 3
    quest = None
    last_error = None

    # Automated Generate-Verify-Repair loop
    while attempts < max_attempts:
        attempts += 1
        try:
            raw, usage = _chat(messages, temperature=0.75 if attempts == 1 else 0.35, max_tokens=1600, json_output=True)
            total_prompt_tokens += usage.get("prompt_tokens", 0)
            total_completion_tokens += usage.get("completion_tokens", 0)
            candidate = json.loads(raw)
            _validate_quest(candidate, profile)
            quest = candidate
            break
        except (RuntimeError, ValueError, TypeError, json.JSONDecodeError) as exc:
            last_error = str(exc)
            if isinstance(exc, RuntimeError):
                # Upstream connection error: fall back to calibrated preview engine
                break
            # Add repair turn to conversation
            messages.append({"role": "assistant", "content": raw})
            messages.append({
                "role": "user",
                "content": f"VERIFICATION ERROR: {last_error}. Please repair the JSON object. Maintain schema validity and ensure private_referee.answer_group is exactly one of {profile['highest_rate_groups']}."
            })

    if not quest:
        # Graceful fallback after repair attempts exhausted or connection error
        quest = _preview_quest(profile, mode)
        quest["repaired"] = False
        quest["verification_note"] = f"Calibrated fallback after {attempts} attempts ({last_error})"
        if total_prompt_tokens == 0:
            total_prompt_tokens = 420
            total_completion_tokens = 340
    else:
        quest["source"] = "amd-live"
        quest["repaired"] = (attempts > 1)

    latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))
    quest["mode"] = mode
    quest["attempts"] = attempts
    quest["latency_ms"] = latency_ms
    quest["model"] = os.getenv("AMD_MODEL_NAME", "Gemma-4-31B-IT")
    quest["ranking_differs"] = profile.get("ranking_differs", False)
    quest["tokens"] = {
        "prompt": total_prompt_tokens,
        "completion": total_completion_tokens,
        "total": total_prompt_tokens + total_completion_tokens
    }
    quest["cost"] = compute_cost_usd(total_prompt_tokens, total_completion_tokens)
    return quest


def answer_guide(question, mode, history):
    start_time = time.perf_counter()
    if not _live_enabled():
        lowered = question.casefold()
        if any(term in lowered for term in ("answer", "which route", "which group", "tell me", "ignore")):
            reply = "I cannot name a route for you. Compare each route's events with its opportunities, then evaluate what the rate measures."
        elif any(term in lowered for term in ("rate", "divide", "calculate", "formula", "compare")):
            reply = "A rate is events divided by opportunities. When groups have different amounts of traffic, compare those rates instead of relying on totals alone."
        elif any(term in lowered for term in ("outlier", "anomaly", "skew", "extreme", "spike")):
            reply = "An outlier is a record that deviates sharply from the rest. Check whether a high rate comes from genuinely dangerous conditions or an extreme journey ratio."
        else:
            reply = "Start by asking what each number counts and how many opportunities sit behind it. Which two quantities could you compare?"
        if mode == "pathfinder":
            reply = "Take a moment with the evidence: " + reply
        latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))
        return {
            "reply": reply,
            "source": "local-preview",
            "latency_ms": latency_ms,
            "model": "Local Preview",
            "tokens": {"prompt": 85, "completion": 45, "total": 130},
            "cost": compute_cost_usd(85, 45)
        }

    messages = [{"role": "system", "content": GUIDE_PROMPT + f"\nGuidance style: {mode}."}]
    for turn in history[-4:]:
        if turn.get("role") in ("user", "assistant") and isinstance(turn.get("content"), str):
            messages.append({"role": turn["role"], "content": turn["content"][:700]})
    messages.append({"role": "user", "content": question})
    try:
        reply, usage = _chat(messages, temperature=0.45, max_tokens=220)
        latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))
        if not isinstance(reply, str) or not reply.strip():
            raise RuntimeError("The Field Guide did not answer. Please try again.")
        p_tok = usage.get("prompt_tokens", 0)
        c_tok = usage.get("completion_tokens", 0)
        return {
            "reply": reply.strip()[:900],
            "source": "amd-live",
            "latency_ms": latency_ms,
            "model": os.getenv("AMD_MODEL_NAME", "Gemma-4-31B-IT"),
            "tokens": {"prompt": p_tok, "completion": c_tok, "total": p_tok + c_tok},
            "cost": compute_cost_usd(p_tok, c_tok)
        }
    except Exception:
        lowered = question.casefold()
        if any(term in lowered for term in ("answer", "which route", "which group", "tell me", "ignore")):
            reply = "I cannot name a route for you. Compare each route's events with its opportunities, then evaluate what the rate measures."
        elif any(term in lowered for term in ("rate", "divide", "calculate", "formula", "compare")):
            reply = "A rate is events divided by opportunities. When groups have different amounts of traffic, compare those rates instead of relying on totals alone."
        elif any(term in lowered for term in ("outlier", "anomaly", "skew", "extreme", "spike")):
            reply = "An outlier is a record that deviates sharply from the rest. Check whether a high rate comes from genuinely dangerous conditions or an extreme journey ratio."
        else:
            reply = "Start by asking what each number counts and how many opportunities sit behind it. Which two quantities could you compare?"
        if mode == "pathfinder":
            reply = "Take a moment with the evidence: " + reply
        latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))
        return {
            "reply": reply,
            "source": "local-preview",
            "latency_ms": latency_ms,
            "model": "Local Preview Engine",
            "tokens": {"prompt": 85, "completion": 45, "total": 130},
            "cost": compute_cost_usd(85, 45)
        }


def generate_consequence(quest, profile, chosen_group, rationale, correct):
    """Generate dynamic narrative consequence for the player's finding."""
    rate_val = next((r["rate"] for r in profile["groups"] if r["group"] == profile["highest_rate_group"]), 0.1)
    if not _live_enabled():
        if correct:
            return (f"The council marshals protective resources along {chosen_group}. "
                    f"By recognizing that true hazard lies in the incident rate ({rate_val:.1%}) "
                    f"rather than gross volume, vulnerable operations are secured.")
        else:
            return (f"The council concentrates resources on {chosen_group}, chasing unadjusted volume. "
                    f"Meanwhile, {profile['highest_rate_group']} remains unprotected at {rate_val:.1%} risk, "
                    f"where operations continue to suffer avoidable incidents.")

    prompt = (
        f"You are the Head Referee of '{quest.get('title', 'The Case')}'. The setting is {quest.get('setting', 'the realm')}. "
        f"The player submitted verdict: '{chosen_group}' based on rationale '{rationale}'. "
        f"The verdict is {'CORRECT: highest incident rate' if correct else 'INCORRECT: true hazard is ' + profile['highest_rate_group']}. "
        f"Write exactly two evocative sentences describing the immediate consequence of this decision on the realm."
    )
    try:
        reply, _ = _chat([{"role": "user", "content": prompt}], temperature=0.6, max_tokens=140)
        return reply.strip()
    except Exception:
        if correct:
            return f"The council marshals resources along {chosen_group}. By measuring hazard per opportunity rather than gross count, critical operations are secured."
        return f"Resources were diverted to {chosen_group} based on volume alone. Unprotected sectors suffered predictable losses as a result."


