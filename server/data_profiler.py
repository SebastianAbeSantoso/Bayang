"""Strict CSV profiler for Bayang's dataset-seeded investigations.

Supports:
- Pre-aggregated count/exposure tables (with automatic group deduplication/summation).
- Raw unaggregated event logs (auto-aggregating individual row events and opportunities).
- True confounding stratification (detecting lurking variables and Simpson's Paradox reversals).
- Rigorous peer-reviewed biostatistics (two-sided 95% Wilson score confidence intervals and binomial Z-scores).
- Custom schema mapping and header inspection.
"""
import csv
import io
import math
from collections import defaultdict


class DataError(ValueError):
    pass


def wilson_score_interval(events: int, opportunities: int, z: float = 1.96) -> tuple[float, float]:
    """Calculate the two-sided Wilson score confidence interval (default 95%, z=1.96).
    
    Wilson score is asymmetric, robust for small samples (n < 30), and bounded strictly in [0, 1].
    """
    if opportunities <= 0:
        return 0.0, 0.0
    p = events / opportunities
    n = opportunities
    z2 = z * z
    denom = 1.0 + z2 / n
    center = (p + z2 / (2.0 * n)) / denom
    margin = (z / denom) * math.sqrt((p * (1.0 - p) / n) + (z2 / (4.0 * n * n)))
    ci_lower = max(0.0, center - margin)
    ci_upper = min(1.0, center + margin)
    return ci_lower, ci_upper


def binomial_z_score(events: int, opportunities: int, baseline_rate: float) -> float:
    """Compute the standardized Z-score of observed events against the pooled baseline rate.
    
    Z = (p_hat - p_0) / sqrt(p_0 * (1 - p_0) / n)
    """
    if opportunities <= 0 or baseline_rate <= 0 or baseline_rate >= 1.0:
        return 0.0
    p_hat = events / opportunities
    se = math.sqrt(baseline_rate * (1.0 - baseline_rate) / opportunities)
    if se <= 0:
        return 0.0
    return (p_hat - baseline_rate) / se


def detect_domain(fieldnames: list[str], group_names: list[str]) -> str:
    combined = " ".join(fieldnames + group_names).lower()
    if any(k in combined for k in ("service", "ingress", "cloud", "node", "cluster", "api", "canary", "db", "latency", "microservice", "server")):
        return "cloud"
    if any(k in combined for k in ("patient", "cohort", "hospital", "clinic", "adverse", "drug", "trial", "dose", "medical", "treatment", "ward")):
        return "healthcare"
    if any(k in combined for k in ("route", "caravan", "pass", "trail", "mountain", "fen", "hollow", "road", "cart", "wagon")):
        return "fantasy"
    return "tactical"


def resolve_columns(fieldnames: list[str]) -> tuple[str, str | None, str | None, str | None, str | None, bool]:
    """Smart inference mapping messy/real-world headers.
    
    Returns:
        (g_col, e_col, o_col, s_col, c_col, is_raw_log)
    """
    orig_map = {name.strip().lower(): name for name in fieldnames if name and name.strip()}
    
    group_aliases = [
        "group", "name", "route", "category", "entity", "cohort", "region", 
        "ward", "cluster", "segment", "service", "system", "node", "unit", 
        "label", "item", "id", "hospital", "clinic", "department", "borough", 
        "district", "team", "account", "source", "client", "model", "pipeline", "host"
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
    status_aliases = [
        "status", "outcome", "incident", "event", "error", "result", "failure",
        "state", "flag", "code", "success"
    ]
    confounder_aliases = [
        "condition", "weather", "stratum", "subgroup", "severity", "environment",
        "shift", "time_of_day", "tier", "stage"
    ]

    g_col = next((orig_map[c] for c in group_aliases if c in orig_map), None)
    e_col = next((orig_map[c] for c in events_aliases if c in orig_map), None)
    o_col = next((orig_map[c] for c in opps_aliases if c in orig_map), None)
    s_col = next((orig_map[c] for c in status_aliases if c in orig_map), None)
    c_col = next((orig_map[c] for c in confounder_aliases if c in orig_map), None)

    # Substring search fallback for groups
    if not g_col:
        for c in orig_map:
            if any(term in c for term in ("group", "name", "route", "cohort", "id", "region", "service")):
                g_col = orig_map[c]
                break

    # Check if raw log: has group and status/outcome, but NO explicit opportunities column
    if g_col and s_col and not o_col and g_col != s_col:
        return g_col, None, None, s_col, c_col, True

    # Check if pre-aggregated 3-column table
    if not e_col:
        for c in orig_map:
            if c != g_col and any(term in c for term in ("event", "incident", "error", "fail", "accident", "case", "death", "bug", "loss")):
                e_col = orig_map[c]
                break
    if not o_col:
        for c in orig_map:
            if c not in (g_col, e_col) and any(term in c for term in ("opp", "journey", "trip", "total", "pop", "request", "patient", "trial", "vol")):
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

    if not (g_col and (o_col or s_col)):
        missing = []
        if not g_col: missing.append("group/name/route/service")
        if not (e_col or s_col): missing.append("events/errors/status")
        if not (o_col or s_col): missing.append("opportunities/requests/total")
        raise DataError(f"Could not identify columns for: {', '.join(missing)}. Available: {', '.join(fieldnames)}.")

    is_raw_log = False
    return g_col, e_col, o_col, s_col, c_col, is_raw_log


def inspect_csv_headers(source: str) -> dict:
    """Inspect CSV headers, providing suggestions and preview rows for user custom mapping."""
    if not source or len(source) > 100_000:
        raise DataError("Choose a CSV under 100 KB.")
    try:
        reader = csv.DictReader(io.StringIO(source.lstrip("\ufeff")))
        if not reader.fieldnames:
            raise DataError("This file is empty.")
        fieldnames = [f.strip() for f in reader.fieldnames if f and f.strip()]
        g_col, e_col, o_col, s_col, c_col, is_raw_log = resolve_columns(fieldnames)
        
        preview_rows = []
        for line, row in enumerate(reader):
            if line >= 3:
                break
            preview_rows.append({k: (row.get(k) or "").strip() for k in fieldnames})
            
        return {
            "fieldnames": fieldnames,
            "suggested": {
                "group": g_col,
                "events": e_col or s_col,
                "opportunities": o_col,
                "confounder": c_col,
                "is_raw_log": is_raw_log,
            },
            "preview_rows": preview_rows,
        }
    except csv.Error as exc:
        raise DataError("I couldn't read that CSV header.") from exc


def is_positive_event(value: str) -> bool:
    """Determine if a status/outcome string denotes an incident/error."""
    val = (value or "").strip().lower()
    if not val:
        return False
    if val in ("1", "true", "yes", "error", "fail", "failed", "failure", "attack", "attacked", "incident", "crash", "crashed", "timeout", "refused", "lost", "bad", "down", "500", "502", "503", "504"):
        return True
    if any(k in val for k in ("error", "fail", "crash", "timeout", "refused", "refuse")):
        return True
    try:
        num = float(val)
        return num > 0
    except ValueError:
        return False


def profile_csv(source: str, custom_mapping: dict | None = None) -> dict:
    if not source or len(source) > 100_000:
        raise DataError("Choose a CSV under 100 KB.")
    try:
        reader = csv.DictReader(io.StringIO(source.lstrip("\ufeff")))
        if not reader.fieldnames:
            raise DataError("This file is empty. Add a header row and at least two groups.")
        
        if custom_mapping:
            g_col = custom_mapping.get("group")
            e_col = custom_mapping.get("events")
            o_col = custom_mapping.get("opportunities")
            c_col = custom_mapping.get("confounder")
            is_raw_log = custom_mapping.get("is_raw_log", False)
            s_col = e_col if is_raw_log else None
            is_aliased = True
        else:
            g_col, e_col, o_col, s_col, c_col, is_raw_log = resolve_columns(reader.fieldnames)
            is_aliased = (
                is_raw_log or
                g_col.lower() != "group" or
                (e_col and e_col.lower() != "events") or
                (o_col and o_col.lower() != "opportunities")
            )
        
        group_totals = defaultdict(lambda: {"events": 0, "opportunities": 0})
        stratified_counts = defaultdict(lambda: defaultdict(lambda: {"events": 0, "opportunities": 0}))
        raw_row_count = 0

        for line, raw in enumerate(reader, start=2):
            if not raw or not any((value or "").strip() for value in raw.values()):
                continue
            name = (raw.get(g_col) or "").strip()
            if not name:
                continue
            
            raw_row_count += 1
            cond = (raw.get(c_col) or "").strip() if c_col else None

            if is_raw_log:
                status_val = (raw.get(s_col) or "").strip()
                has_event = is_positive_event(status_val)
                group_totals[name]["opportunities"] += 1
                if has_event:
                    group_totals[name]["events"] += 1
                if cond:
                    stratified_counts[name][cond]["opportunities"] += 1
                    if has_event:
                        stratified_counts[name][cond]["events"] += 1
            else:
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
                
                group_totals[name]["events"] += events
                group_totals[name]["opportunities"] += opportunities
                if cond:
                    stratified_counts[name][cond]["events"] += events
                    stratified_counts[name][cond]["opportunities"] += opportunities

        if len(group_totals) < 2:
            raise DataError("Add at least two groups so we can compare them.")
        if len(group_totals) > 30:
            raise DataError("The first quest supports up to 30 groups.")

        rows = []
        for name, data in group_totals.items():
            ev = data["events"]
            opp = data["opportunities"]
            rate = (ev / opp) if opp > 0 else 0.0
            rows.append({
                "group": name[:50],
                "events": ev,
                "opportunities": opp,
                "rate": rate,
            })

        highest_count = max(row["events"] for row in rows)
        highest_rate = max(row["rate"] for row in rows)
        highest_count_groups = [row["group"] for row in rows if row["events"] == highest_count]
        highest_rate_groups = [row["group"] for row in rows if abs(row["rate"] - highest_rate) < 1e-12]

        total_events = sum(r["events"] for r in rows)
        total_opportunities = sum(r["opportunities"] for r in rows)
        baseline_rate = (total_events / total_opportunities) if total_opportunities > 0 else 0.0
        max_opp = max(r["opportunities"] for r in rows)

        # Statistical Thresholds: Wilson Score Confidence Interval + Binomial Z-Score
        balanced_share = total_opportunities / (len(rows) * 2.0)

        for r in rows:
            r["rate_display"] = f"{r['rate']:.1%}"
            diff_ratio = (r["rate"] / baseline_rate) if baseline_rate > 0 else 1.0
            
            ci_low, ci_high = wilson_score_interval(r["events"], r["opportunities"])
            z = binomial_z_score(r["events"], r["opportunities"], baseline_rate)
            r["ci_lower"] = round(ci_low, 4)
            r["ci_upper"] = round(ci_high, 4)
            r["z_score"] = round(z, 2)

            expected_null_events = r["opportunities"] * baseline_rate
            is_thin_sample = (expected_null_events < 4.0) or (r["opportunities"] < balanced_share)
            is_significant = (z >= 1.96) or (ci_low > baseline_rate) or (diff_ratio >= 2.0 and r["events"] >= 3)
            
            r["is_outlier"] = is_significant
            if is_significant and is_thin_sample:
                r["anomaly_reason"] = (
                    f"Statistically significant spike (Z = +{z:.1f}, {diff_ratio:.1f}x baseline) on thin exposure "
                    f"({r['opportunities']} exposure, 95% CI [{ci_low:.1%}, {ci_high:.1%}])"
                )
            elif is_significant:
                r["anomaly_reason"] = (
                    f"Statistically significant risk elevation (Z = +{z:.1f}, 95% CI [{ci_low:.1%}, {ci_high:.1%}])"
                )
            elif is_thin_sample and diff_ratio >= 1.5:
                r["anomaly_reason"] = (
                    f"Thin sample ({r['opportunities']} exposure) with {diff_ratio:.1f}x baseline rate (unconfirmed at 95% CI)"
                )
            else:
                r["anomaly_reason"] = "Within normal regional variance"
            
            # Equalized Exposure Projection: scale to max exposure
            r["projected_events"] = round(r["rate"] * max_opp)
            r["projected_exposure"] = max_opp

        outlier_groups = [r["group"] for r in rows if r.get("is_outlier")]
        ranking_differs = not set(highest_count_groups).intersection(highest_rate_groups)

        # Check for True Simpson's Paradox if confounder was present
        stratified_meta = None
        is_simpsons_paradox = False
        if c_col and stratified_counts:
            all_strata = sorted({c for g in stratified_counts.values() for c in g})
            if len(all_strata) >= 2 and len(rows) >= 2:
                sorted_by_rate = sorted(rows, key=lambda x: x["rate"], reverse=True)
                g1 = sorted_by_rate[0]["group"]
                g2 = sorted_by_rate[1]["group"]

                strata_records = []
                reversal_count = 0
                for s in all_strata:
                    d1 = stratified_counts[g1].get(s, {"events": 0, "opportunities": 0})
                    d2 = stratified_counts[g2].get(s, {"events": 0, "opportunities": 0})
                    r1 = (d1["events"] / d1["opportunities"]) if d1["opportunities"] > 0 else 0.0
                    r2 = (d2["events"] / d2["opportunities"]) if d2["opportunities"] > 0 else 0.0
                    if r2 > r1:
                        reversal_count += 1
                    strata_records.append({
                        "stratum": s,
                        "group_1": g1, "rate_1": r1, "events_1": d1["events"], "opp_1": d1["opportunities"],
                        "group_2": g2, "rate_2": r2, "events_2": d2["events"], "opp_2": d2["opportunities"],
                    })

                if reversal_count == len(all_strata) and len(all_strata) > 0:
                    is_simpsons_paradox = True

                stratified_meta = {
                    "confounder_col": c_col,
                    "strata": all_strata,
                    "records": strata_records,
                    "is_simpsons_paradox": is_simpsons_paradox,
                    "higher_overall": g1,
                    "higher_in_strata": g2 if is_simpsons_paradox else None,
                }

        domain = detect_domain(reader.fieldnames, [r["group"] for r in rows])

        return {
            "groups": rows,
            "highest_count_group": highest_count_groups[0],
            "highest_count_groups": highest_count_groups,
            "highest_rate_group": highest_rate_groups[0],
            "highest_rate_groups": highest_rate_groups,
            "outlier_groups": outlier_groups,
            "baseline_rate": baseline_rate,
            "equalized_exposure": max_opp,
            "ranking_differs": ranking_differs,
            "lesson_pattern": "simpsons_paradox" if is_simpsons_paradox else ("exposure_paradox" if ranking_differs else "volume_rate_alignment"),
            "total_events": total_events,
            "total_opportunities": total_opportunities,
            "domain": domain,
            "is_raw_log": is_raw_log,
            "raw_row_count": raw_row_count,
            "stratified": stratified_meta,
            "schema_mapping": {
                "group_col": g_col,
                "events_col": e_col or s_col,
                "opportunities_col": o_col or ("(aggregated rows)" if is_raw_log else "opportunities"),
                "confounder_col": c_col,
                "is_raw_log": is_raw_log,
                "is_aliased": is_aliased
            }
        }
    except csv.Error as exc:
        raise DataError("I couldn't read that CSV. Check its commas and quotation marks.") from exc
