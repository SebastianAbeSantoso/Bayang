"""ShiftGuard (Commercial Shift-Handover Reconciliation Workbench) HTTP server."""
import json
import mimetypes
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

SERVER_DIR = Path(__file__).resolve().parent
ROOT = SERVER_DIR.parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from stage_engine import HandoverEngine
from stage_model_client import StageModelClient


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

HANDOVER_INSTANCE = HandoverEngine()
MODEL_CLIENT = StageModelClient()


class ShiftGuardHandler(BaseHTTPRequestHandler):
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

    def send_text(self, status, text_body, content_type="text/plain; charset=utf-8", filename=None):
        body = text_body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("I couldn't read that request. Please try again.") from None
        if length == 0:
            return {}
        if length > 250_000:
            raise ValueError("That request is too large for this workbench.")
        try:
            return json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ValueError("I couldn't read that JSON request. Please try again.") from None

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = unquote(parsed_url.path)
        query = parse_qs(parsed_url.query)

        if path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return

        if path == "/api/handover/state":
            shift_id = (query.get("shift_id", [None])[0] or None)
            return self.send_json(200, HANDOVER_INSTANCE.get_state(shift_id=shift_id))

        if path == "/api/handover/export":
            fmt = (query.get("format", ["json"])[0] or "json").lower()
            shift_id = (query.get("shift_id", [None])[0] or None)
            content, content_type = HANDOVER_INSTANCE.export_audit_record(
                fmt=fmt, shift_id=shift_id
            )
            ext = "md" if fmt in ("md", "markdown") else "json"
            sid = shift_id or HANDOVER_INSTANCE.active_shift_id
            filename = f"shiftguard_audit_{sid}.{ext}"
            return self.send_text(200, content, content_type=content_type, filename=filename)

        if path == "/api/status":
            live = bool(os.getenv("AMD_API_KEY") or os.getenv("OPENAI_API_KEY"))
            return self.send_json(
                200,
                {
                    "mode": "amd-configured" if live else "seeded-demo-ready",
                    "model": os.getenv("AMD_MODEL_ID", "google/gemma-3-27b-it"),
                },
            )

        # Serve frontend static assets from client/
        relative = "index.html" if path in ("/", "") else path.lstrip("/")
        target = (ROOT / "client" / relative).resolve()
        if ROOT.joinpath("client").resolve() not in target.parents or not target.is_file():
            self.send_error(404, "Not found")
            return
        content = target.read_bytes()
        self.send_response(200)
        self.send_header(
            "Content-Type", mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        )
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        route = urlparse(self.path).path
        try:
            payload = self.read_json()

            if route == "/api/handover/reset":
                state = HANDOVER_INSTANCE.reset()
                return self.send_json(200, state)

            if route == "/api/handover/select_shift":
                shift_id = payload.get("shift_id", "shift_pm_01")
                active_role = payload.get("active_role")
                try:
                    state = HANDOVER_INSTANCE.select_shift(
                        shift_id=shift_id, active_role=active_role
                    )
                    return self.send_json(200, state)
                except ValueError as exc:
                    return self.send_json(400, {"error": str(exc)})

            if route == "/api/handover/save_draft":
                shift_id = payload.get("shift_id") or HANDOVER_INSTANCE.active_shift_id
                note_text = payload.get("note_text")
                if note_text is None and "shift_notes" in payload:
                    note_text = payload.get("shift_notes")
                checklist_updates = payload.get("checklist_updates")
                stock_entry = payload.get("stock_entry")
                issue_entry = payload.get("issue_entry")
                actor = payload.get("actor") or HANDOVER_INSTANCE.active_role
                state = HANDOVER_INSTANCE.save_draft(
                    shift_id=shift_id,
                    note_text=note_text,
                    checklist_updates=checklist_updates,
                    stock_entry=stock_entry,
                    issue_entry=issue_entry,
                    actor=actor,
                )
                return self.send_json(200, state)

            if route == "/api/handover/run":
                mode = payload.get("mode", "seeded")
                shift_id = payload.get("shift_id") or HANDOVER_INSTANCE.active_shift_id
                resolved_sid = HANDOVER_INSTANCE._resolve_shift_id(shift_id)
                notes_override = payload.get("shift_notes")
                if notes_override is None and "note_text" in payload:
                    notes_override = payload.get("note_text")
                current_report = HANDOVER_INSTANCE.shift_reports.get(resolved_sid, {})
                notes_to_use = (
                    notes_override
                    if (isinstance(notes_override, str) and notes_override.strip())
                    else current_report.get("note_text", "")
                )
                claims, meta = MODEL_CLIENT.extract_handover_claims(
                    raw_shift_notes=notes_to_use,
                    mode=mode,
                    shift_id=resolved_sid,
                )
                actor = payload.get("actor") or HANDOVER_INSTANCE.active_role
                state = HANDOVER_INSTANCE.run_reconciliation(
                    extracted_claims=claims,
                    meta=meta,
                    raw_notes_override=notes_to_use,
                    shift_id=shift_id,
                    actor=actor,
                )
                return self.send_json(200, state)

            if route == "/api/handover/resolve":
                finding_id = payload.get("finding_id") or payload.get("claim_id") or ""
                action = payload.get("action") or payload.get("disposition") or ""
                rationale = payload.get("rationale") or payload.get("supervisor_note") or ""
                sign_off_shift = bool(payload.get("sign_off_shift", False))
                actor = (
                    payload.get("actor")
                    or payload.get("supervisor_name")
                    or HANDOVER_INSTANCE.active_role
                )
                owner_role = payload.get("owner_role") or "Opening Shift Lead (Sari Wijaya)"
                due_time = payload.get("due_time") or "Before 07:00 morning rush"
                shift_id = payload.get("shift_id") or HANDOVER_INSTANCE.active_shift_id
                try:
                    if finding_id.startswith("CLM-"):
                        findings = HANDOVER_INSTANCE.findings_by_shift.get(shift_id, [])
                        matched = next(
                            (f for f in findings if f.get("claim_id") == finding_id), None
                        )
                        if matched:
                            finding_id = matched["id"]
                    state = HANDOVER_INSTANCE.resolve_finding(
                        finding_id=finding_id,
                        action=action,
                        rationale=rationale,
                        actor=actor,
                        owner_role=owner_role,
                        due_time=due_time,
                        shift_id=shift_id,
                        sign_off_shift=sign_off_shift,
                    )
                    return self.send_json(200, state)
                except ValueError as exc:
                    return self.send_json(400, {"error": str(exc)})

            if route == "/api/handover/carryover":
                carryover_id = payload.get("carryover_id", "")
                action = payload.get("action", "")
                actor = payload.get("actor") or HANDOVER_INSTANCE.active_role
                note = payload.get("note", "")
                shift_id = payload.get("shift_id") or HANDOVER_INSTANCE.active_shift_id
                try:
                    state = HANDOVER_INSTANCE.update_carryover_item(
                        carryover_id=carryover_id,
                        action=action,
                        actor=actor,
                        note=note,
                        shift_id=shift_id,
                    )
                    return self.send_json(200, state)
                except ValueError as exc:
                    return self.send_json(400, {"error": str(exc)})

            return self.send_json(404, {"error": "That action is not available."})
        except ValueError as exc:
            return self.send_json(400, {"error": str(exc)})
        except RuntimeError as exc:
            return self.send_json(502, {"error": str(exc)})


# Alias for backwards compatibility
BayangHandler = ShiftGuardHandler


if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("BAYANG_PORT", "8000")))
    host = os.getenv("HOST", os.getenv("BAYANG_HOST", "0.0.0.0" if os.getenv("PORT") else "127.0.0.1"))
    try:
        server = ThreadingHTTPServer((host, port), ShiftGuardHandler)
    except OSError as exc:
        raise SystemExit(f"ShiftGuard could not bind to {host}:{port}: {exc}") from exc
    print(f"ShiftGuard is ready at http://{host}:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("ShiftGuard stopped.", flush=True)
    finally:
        server.server_close()
