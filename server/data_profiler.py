"""Strict CSV profiler for Bayang's dataset-seeded investigations."""
import csv
import io


class DataError(ValueError):
    pass


def resolve_columns(fieldnames: list[str]) -> tuple[str, str, str, bool]:
    """Smart inference mapping messy/real-world headers to (group, events, opportunities)."""
    orig_map = {name.strip().lower(): name for name in fieldnames if name and name.strip()}
    
    group_aliases = [
        "group", "name", "route", "category", "entity", "cohort", "region", 
        "ward", "cluster", "segment", "service", "system", "node", "unit", 
        "label", "item", "id", "hospital", "clinic", "department", "borough", 
        "district", "team", "account", "source", "client", "model", "pipeline"
    ]
    events_aliases = [
        "events", "incidents", "errors", "failures", "accidents", "adverse_events", 
        "adverse_reactions", "deaths", "cases", "bugs", "count", "defects", 
        "alerts", "mishaps", "positives", "violations", "complaints", "crashes", 
        "churn", "dropouts", "exceptions", "faults", "lost", "losses"
    ]
    opps_aliases = [
        "opportunities", "journeys", "trips", "exposure", "total", "population", 
        "requests", "trials", "patients", "attempts", "volume", "sample_size", 
        "tests", "inspections", "traffic", "users", "denominators", "flights", 
        "calls", "transactions", "queries", "runs", "sessions", "participants"
    ]

    g_col = next((orig_map[c] for c in group_aliases if c in orig_map), None)
    e_col = next((orig_map[c] for c in events_aliases if c in orig_map), None)
    o_col = next((orig_map[c] for c in opps_aliases if c in orig_map), None)

    # Substring search fallback
    if not g_col:
        for c in orig_map:
            if any(term in c for term in ("group", "name", "route", "cohort", "id", "region")):
                g_col = orig_map[c]
                break
    if not e_col:
        for c in orig_map:
            if any(term in c for term in ("event", "incident", "error", "fail", "accident", "case", "death", "bug", "loss")):
                e_col = orig_map[c]
                break
    if not o_col:
        for c in orig_map:
            if any(term in c for term in ("opp", "journey", "trip", "total", "pop", "request", "patient", "trial", "vol")):
                o_col = orig_map[c]
                break

    # If exactly 3 columns exist, default to 1 text column and 2 numeric columns
    if not (g_col and e_col and o_col) and len(orig_map) == 3:
        cols = list(orig_map.values())
        g_col = g_col or cols[0]
        remaining = [c for c in cols if c != g_col]
        if len(remaining) == 2:
            e_col = e_col or remaining[0]
            o_col = o_col or remaining[1]

    if not (g_col and e_col and o_col):
        missing = []
        if not g_col: missing.append("group/name/route")
        if not e_col: missing.append("events/incidents/errors")
        if not o_col: missing.append("opportunities/journeys/total")
        raise DataError(f"Could not identify columns for: {', '.join(missing)}. Available: {', '.join(fieldnames)}.")

    is_aliased = (g_col.lower() != "group" or e_col.lower() != "events" or o_col.lower() != "opportunities")
    return g_col, e_col, o_col, is_aliased


def profile_csv(source: str) -> dict:
    if not source or len(source) > 100_000:
        raise DataError("Choose a CSV under 100 KB.")
    try:
        reader = csv.DictReader(io.StringIO(source.lstrip("\ufeff")))
        if not reader.fieldnames:
            raise DataError("This file is empty. Add a header row and at least two groups.")
        
        g_col, e_col, o_col, is_aliased = resolve_columns(reader.fieldnames)
        rows = []
        for line, raw in enumerate(reader, start=2):
            if not raw or not any((value or "").strip() for value in raw.values()):
                continue
            name = (raw.get(g_col) or "").strip()
            if not name:
                raise DataError(f"Row {line} needs a {g_col} label.")
            try:
                events = float((raw.get(e_col) or "").strip())
                opportunities = float((raw.get(o_col) or "").strip())
            except ValueError:
                raise DataError(f"Row {line} needs numeric {e_col} and {o_col}.") from None
            if not events.is_integer() or not opportunities.is_integer():
                raise DataError(f"Row {line}: use whole-number counts.")
            events, opportunities = int(events), int(opportunities)
            if events < 0 or opportunities <= 0 or events > opportunities:
                raise DataError(f"Row {line}: counts must be nonnegative, opportunities above zero, and events no greater than opportunities.")
            rows.append({"group": name[:50], "events": events, "opportunities": opportunities,
                         "rate": events / opportunities})
        if len(rows) < 2:
            raise DataError("Add at least two groups so we can compare them.")
        if len(rows) > 30:
            raise DataError("The first quest supports up to 30 groups.")
        if len({row["group"].casefold() for row in rows}) != len(rows):
            raise DataError("Each group name should be unique.")
        highest_count = max(row["events"] for row in rows)
        highest_rate = max(row["rate"] for row in rows)
        highest_count_groups = [row["group"] for row in rows if row["events"] == highest_count]
        highest_rate_groups = [row["group"] for row in rows if abs(row["rate"] - highest_rate) < 1e-12]

        total_events = sum(r["events"] for r in rows)
        total_opportunities = sum(r["opportunities"] for r in rows)
        baseline_rate = (total_events / total_opportunities) if total_opportunities > 0 else 0.0
        max_opp = max(r["opportunities"] for r in rows)

        for r in rows:
            r["rate_display"] = f"{r['rate']:.1%}"
            diff_ratio = (r["rate"] / baseline_rate) if baseline_rate > 0 else 1.0
            is_volume_anomaly = r["opportunities"] < (0.12 * total_opportunities)
            is_rate_spike = diff_ratio >= 2.0
            r["is_outlier"] = is_rate_spike or (is_volume_anomaly and diff_ratio >= 1.75)
            if is_rate_spike and is_volume_anomaly:
                r["anomaly_reason"] = f"Severe anomaly: {diff_ratio:.1f}x baseline rate on thin traffic ({r['opportunities']} exposure)"
            elif is_rate_spike:
                r["anomaly_reason"] = f"Rate spike: {diff_ratio:.1f}x baseline average"
            elif is_volume_anomaly and diff_ratio >= 1.75:
                r["anomaly_reason"] = f"Thin sample exposure ({r['opportunities']}) with {diff_ratio:.1f}x baseline rate"
            else:
                r["anomaly_reason"] = "Within normal regional variance"
            
            # Counterfactual projection: What if this group had the max exposure in the dataset?
            r["projected_events"] = round(r["rate"] * max_opp)
            r["projected_exposure"] = max_opp

        outlier_groups = [r["group"] for r in rows if r.get("is_outlier")]

        return {
            "groups": rows,
            "highest_count_group": highest_count_groups[0],
            "highest_count_groups": highest_count_groups,
            "highest_rate_group": highest_rate_groups[0],
            "highest_rate_groups": highest_rate_groups,
            "outlier_groups": outlier_groups,
            "baseline_rate": baseline_rate,
            "equalized_exposure": max_opp,
            "ranking_differs": not set(highest_count_groups).intersection(highest_rate_groups),
            "lesson_pattern": "count_rate_conflict" if not set(highest_count_groups).intersection(highest_rate_groups) else "count_rate_alignment",
            "total_events": total_events,
            "total_opportunities": total_opportunities,
            "schema_mapping": {
                "group_col": g_col,
                "events_col": e_col,
                "opportunities_col": o_col,
                "is_aliased": is_aliased
            }
        }
    except csv.Error as exc:
        raise DataError("I couldn't read that CSV. Check its commas and quotation marks.") from exc

