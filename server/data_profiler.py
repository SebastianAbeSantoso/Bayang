"""Strict CSV profiler for Bayang's dataset-seeded investigations."""
import csv
import io


class DataError(ValueError):
    pass


def profile_csv(source: str) -> dict:
    if not source or len(source) > 100_000:
        raise DataError("Choose a CSV under 100 KB.")
    try:
        reader = csv.DictReader(io.StringIO(source.lstrip("\ufeff")))
        if not reader.fieldnames:
            raise DataError("This file is empty. Add a header row and at least two groups.")
        reader.fieldnames = [name.strip().lower() for name in reader.fieldnames]
        required = {"group", "events", "opportunities"}
        if not required.issubset(reader.fieldnames):
            raise DataError("Use these column headers: group, events, opportunities.")
        rows = []
        for line, raw in enumerate(reader, start=2):
            if not raw or not any((value or "").strip() for value in raw.values()):
                continue
            name = (raw.get("group") or "").strip()
            if not name:
                raise DataError(f"Row {line} needs a group name.")
            try:
                events = float((raw.get("events") or "").strip())
                opportunities = float((raw.get("opportunities") or "").strip())
            except ValueError:
                raise DataError(f"Row {line} needs numeric events and opportunities.") from None
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
        return {"groups": rows, "highest_count_group": highest_count_groups[0],
                "highest_count_groups": highest_count_groups,
                "highest_rate_group": highest_rate_groups[0],
                "highest_rate_groups": highest_rate_groups,
                "ranking_differs": not set(highest_count_groups).intersection(highest_rate_groups),
                "lesson_pattern": "count_rate_conflict" if not set(highest_count_groups).intersection(highest_rate_groups) else "count_rate_alignment",
                "total_events": sum(r["events"] for r in rows),
                "total_opportunities": sum(r["opportunities"] for r in rows)}
    except csv.Error as exc:
        raise DataError("I couldn't read that CSV. Check its commas and quotation marks.") from exc
