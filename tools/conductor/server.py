#!/usr/bin/env python3
"""Universal AI Conductor -- local server.

Runs a small HTTP server on 127.0.0.1:8000 and serves the conductor UI plus a JSON
API. No third-party packages, no cloud, no API keys. Everything lives in
data/conductor.db next to this file.

Run:  python3 server.py            (then open http://localhost:8000)
"""

import json
import os
import re
import sys
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from conductor_core import compose, db, memory as mem, modes, providers  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")
PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("CONDUCTOR_HOST", "127.0.0.1")   # loopback only; do NOT expose this on a LAN
MAX_BODY = 5 * 1024 * 1024
SEAT_KINDS = {"bridge", "ollama", "openai_compatible"}
ALLOWED_HOSTS = {"localhost", "127.0.0.1", "[::1]"}
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

LOCK = threading.RLock()
STATE = {"dispatched_idx": None, "note": ""}


# ---------------------------------------------------------------- helpers
def conn():
    c = db.connect()
    return c


def seats_list(c):
    return db.rows(c, "SELECT * FROM seats ORDER BY id")


def active_episode(c):
    row = c.execute("SELECT * FROM episodes WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1").fetchone()
    return dict(row) if row else None


def episode_steps(c, ep_id):
    if not ep_id:
        return []
    return db.rows(c, "SELECT * FROM plan_steps WHERE episode_id=? ORDER BY idx", (ep_id,))


def turns_list(c, ep_id, limit=200):
    if not ep_id:
        return []
    return db.rows(
        c, "SELECT * FROM turns WHERE episode_id=? ORDER BY id DESC LIMIT ?", (ep_id, limit)
    )[::-1]


def cursor_idx(steps):
    for s in steps:
        if s["status"] == "pending":
            return s["idx"]
    return None


def build_state(c):
    seats = seats_list(c)
    ep = active_episode(c)
    steps = episode_steps(c, ep["id"]) if ep else []
    name_by_id = {s["id"]: s["name"] for s in seats}
    for s in steps:
        s["seat_name"] = name_by_id.get(s["seat_id"], "(removed seat)")
        s["mode_label"] = modes.mode_label(s["mode"])
    cur = cursor_idx(steps)
    turns = turns_list(c, ep["id"]) if ep else []
    nxt = None
    if cur is not None:
        st = next(s for s in steps if s["idx"] == cur)
        seat = next((s for s in seats if s["id"] == st["seat_id"]), None)
        nxt = {
            "idx": st["idx"],
            "seat_id": st["seat_id"],
            "seat_name": name_by_id.get(st["seat_id"], "(removed seat)"),
            "seat_kind": (seat or {}).get("kind", "bridge"),
            "mode": st["mode"],
            "mode_label": modes.mode_label(st["mode"]),
            "step_no": st["idx"] + 1,
            "step_total": len(steps),
        }
    return {
        "seats": seats,
        "episode": ep,
        "steps": steps,
        "cursor": cur,
        "next": nxt,
        "turns": turns,
        "memory_stats": mem.stats(c),
        "modes": [{"key": k, "label": v["label"], "short": v["short"]} for k, v in modes.MODES.items()],
        "note": STATE.get("note", ""),
    }


def compose_current_prompt(c, note="", touch=False):
    ep = active_episode(c)
    if not ep:
        return None
    seats = seats_list(c)
    steps = episode_steps(c, ep["id"])
    cur = cursor_idx(steps)
    if cur is None:
        return None
    step = next(s for s in steps if s["idx"] == cur)
    seat = next((s for s in seats if s["id"] == step["seat_id"]), None)
    if not seat:
        return None
    turns = turns_list(c, ep["id"])
    query = " ".join(
        [note, turns[-1]["content"] if turns else "", ep.get("title") or ""]
    ).strip()
    mems = mem.recall(c, query, limit=14, episode_id=ep["id"], touch=touch)
    ents = mem.related_entities(c, query)
    prompt = compose.compose_prompt(
        seat=seat,
        step=step,
        seats=seats,
        turns=turns,
        memories=mems,
        entities=ents,
        session_title=ep.get("title") or "session",
        step_no=cur + 1,
        step_total=len(steps),
        user_note=note or STATE.get("note", ""),
    )
    return {
        "seat": seat,
        "step": step,
        "step_no": cur + 1,
        "step_total": len(steps),
        "prompt": prompt,
        "memories_used": [m["text"] for m in mems],
        "hint": compose.opening_note(seat, seats, step["mode"]),
    }


# ---------------------------------------------------------------- API actions
def act_create_plan(c, body):
    text = body.get("text", "")
    default_mode = modes.resolve_mode(body.get("default_mode", ""), modes.DEFAULT_MODE)
    seats = seats_list(c)
    steps, unknown = compose.parse_plan_ex(text, seats, default_mode)
    if unknown:
        raise ValueError("Seat number(s) " + ", ".join(str(n) for n in unknown) +
                         " don't exist. Existing seats: " + ", ".join(str(x["id"]) for x in seats))
    if not steps:
        raise ValueError("No seats found in that plan. Type seat numbers, e.g. 4,2,2,3,4,4")
    # close current episode
    c.execute("UPDATE episodes SET closed_at=CURRENT_TIMESTAMP WHERE closed_at IS NULL")
    cur = c.execute(
        "INSERT INTO episodes (title, plan_text, default_mode) VALUES (?,?,?)",
        (body.get("title") or "session " + mem.now()[:16], text, default_mode),
    )
    ep_id = cur.lastrowid
    for i, st in enumerate(steps):
        c.execute(
            "INSERT INTO plan_steps (episode_id, idx, seat_id, mode) VALUES (?,?,?,?)",
            (ep_id, i, st["seat_id"], st["mode"]),
        )
    c.commit()
    STATE["dispatched_idx"] = None
    STATE["note"] = body.get("note", "") or ""
    db.log(c, "plan", f"episode {ep_id}: {len(steps)} steps")
    return {"episode_id": ep_id, "steps": len(steps)}


def act_update_step(c, body):
    ep = active_episode(c)
    if not ep:
        raise ValueError("no active episode")
    idx = int(body.get("idx"))
    fields, args = [], []
    if body.get("mode"):
        fields.append("mode=?")
        args.append(modes.resolve_mode(body["mode"]))
    if body.get("seat_id"):
        sid = int(body["seat_id"])
        if sid not in {x["id"] for x in seats_list(c)}:
            raise ValueError(f"seat {sid} does not exist")
        fields.append("seat_id=?")
        args.append(sid)
    if body.get("status"):
        if body["status"] not in ("pending", "done", "skipped"):
            raise ValueError("status must be pending, done or skipped")
        fields.append("status=?")
        args.append(body["status"])
    if not fields:
        return {"ok": True}
    args += [ep["id"], idx]
    c.execute(f"UPDATE plan_steps SET {', '.join(fields)} WHERE episode_id=? AND idx=?", args)
    c.commit()
    return {"ok": True}


def act_capture(c, body):
    text = (body.get("text") or "").strip()
    if not text:
        raise ValueError("nothing to capture")
    if "=== CONDUCTOR ===" in text and "=== END ===" in text:
        raise ValueError("That is the conductor's own prompt, not a reply. Copy the AI's answer first.")
    ep = active_episode(c)
    seats = seats_list(c)
    names = [s["name"] for s in seats]
    seat_id = body.get("seat_id")
    mode = body.get("mode") or ""
    step_idx = None
    if ep:
        steps = episode_steps(c, ep["id"])
        cur = cursor_idx(steps)
        if cur is not None:
            step = next(s for s in steps if s["idx"] == cur)
            step_idx = cur
            if seat_id in (None, "", 0):
                seat_id = step["seat_id"]
            mode = mode or step["mode"]
            c.execute(
                "UPDATE plan_steps SET status='done' WHERE episode_id=? AND idx=?", (ep["id"], cur)
            )
    seat = next((s for s in seats if s["id"] == int(seat_id or 0)), None)
    seat_name = (seat or {}).get("name") or body.get("seat_name") or "Unknown seat"
    cur = c.execute(
        "INSERT INTO turns (episode_id, step_idx, seat_id, seat_name, mode, role, content) VALUES (?,?,?,?,?,?,?)",
        (ep["id"] if ep else None, step_idx, seat_id, seat_name, mode, "seat", text),
    )
    turn_id = cur.lastrowid
    c.commit()
    info = mem.ingest_turn(
        c,
        text,
        turn_id=turn_id,
        episode_id=ep["id"] if ep else None,
        seat_names=names,
        origin="ai",
    )
    db.log(c, "capture", f"turn {turn_id} from {seat_name}: +{len(info['memories'])} memories")
    return {"turn_id": turn_id, "memories_added": len(info["memories"]), "entities": info["entities"]}


def run_prepare(c, body):
    """Phase 1 (under lock): pick the step and compose its prompt."""
    ep = active_episode(c)
    if not ep:
        raise ValueError("no active episode -- build a turn plan first")
    steps = episode_steps(c, ep["id"])
    cur = cursor_idx(steps)
    if cur is None:
        raise ValueError("all steps are done -- start a new plan")
    step = next(x for x in steps if x["idx"] == cur)
    if not any(x["id"] == step["seat_id"] for x in seats_list(c)):
        raise ValueError(f"Step {cur + 1}'s seat was removed. Change that step's seat or skip it.")
    preview = compose_current_prompt(c, body.get("note", ""), touch=True)
    seat = preview["seat"]
    if (seat.get("kind") or "bridge") == "bridge":
        raise ValueError(
            f"Seat {seat['id']} ({seat['name']}) is a bridge seat. Use Copy prompt instead."
        )
    return {"ep_id": ep["id"], "idx": cur, "seat": seat, "prompt": preview["prompt"],
            "mode": preview["step"]["mode"]}


def run_finish(c, job, reply):
    """Phase 3 (under lock): store the reply -- but only if the plan did not move meanwhile."""
    ep = active_episode(c)
    cur = cursor_idx(episode_steps(c, ep["id"])) if ep else None
    if not ep or ep["id"] != job["ep_id"] or cur != job["idx"]:
        raise ValueError("The plan changed while the model was answering; the reply was discarded.")
    return act_capture(c, {"text": reply, "seat_id": job["seat"]["id"], "mode": job["mode"]})


def act_user_note(c, body):
    text = (body.get("text") or "").strip()
    STATE["note"] = text
    ep = active_episode(c)
    seats = seats_list(c)
    if text:
        cur = c.execute(
            "INSERT INTO turns (episode_id, step_idx, seat_id, seat_name, mode, role, content) VALUES (?,?,?,?,?,?,?)",
            (ep["id"] if ep else None, None, 0, "You", "user_moderated", "user", text),
        )
        c.commit()
        mem.ingest_turn(c, text, turn_id=cur.lastrowid, episode_id=ep["id"] if ep else None,
                        seat_names=[s["name"] for s in seats], origin="human")
    return {"ok": True, "note": text}


def act_memory_list(c, q):
    rows = db.rows(c, "SELECT * FROM memories ORDER BY pinned DESC, last_seen_at DESC")
    if q:
        qt = set(mem.tokens(q))
        rows = [r for r in rows if qt & set(mem.tokens(r["text"]))]
    rows = rows[:300]
    return {
        "memories": rows,
        "entities": db.rows(c, "SELECT * FROM entities ORDER BY mentions DESC LIMIT 60"),
        "relations": db.rows(c, "SELECT * FROM relations WHERE valid_to IS NULL LIMIT 60"),
        "stats": mem.stats(c),
    }


def act_export(c):
    ep = active_episode(c)
    return {
        "exported_at": mem.now(),
        "episode": ep,
        "seats": seats_list(c),
        "steps": episode_steps(c, ep["id"]) if ep else [],
        "episodes": db.rows(c, "SELECT * FROM episodes ORDER BY id"),
        "all_turns": db.rows(c, "SELECT * FROM turns ORDER BY id"),
        "turns": turns_list(c, ep["id"], 100000) if ep else [],
        "memories": db.rows(c, "SELECT * FROM memories"),
        "entities": db.rows(c, "SELECT * FROM entities"),
        "relations": db.rows(c, "SELECT * FROM relations"),
    }


def save_seat(c, body):
    """Create or MERGE-update a seat: fields that are not sent keep their stored values."""
    sid = body.get("id")
    allowed = ("name", "kind", "endpoint", "model", "persona", "color", "active")
    given = {k: body[k] for k in allowed if k in body}
    if "kind" in given and given["kind"] not in SEAT_KINDS:
        raise ValueError("kind must be one of: " + ", ".join(sorted(SEAT_KINDS)))
    if "color" in given and not COLOR_RE.match(str(given["color"])):
        raise ValueError("color must look like #7aa2f7")
    if "name" in given:
        given["name"] = str(given["name"]).strip()[:60] or "Seat"
    if "persona" in given:
        given["persona"] = str(given["persona"])[:2000]
    if "model" in given:
        given["model"] = str(given["model"])[:200]
    if "endpoint" in given:
        try:
            given["endpoint"] = providers.validate_endpoint(given["endpoint"])
        except providers.ProviderError as e:
            raise ValueError(str(e))
    if "active" in given:
        given["active"] = 1 if given["active"] else 0
    if sid:
        sid = int(sid)
        row = c.execute("SELECT id FROM seats WHERE id=?", (sid,)).fetchone()
        if not row:
            raise ValueError(f"seat {sid} does not exist")
        if given:
            sets = ", ".join(f"{k}=?" for k in given)
            c.execute(f"UPDATE seats SET {sets} WHERE id=?", (*given.values(), sid))
    else:
        used = {r["id"] for r in seats_list(c)}
        free = next((i for i in range(1, 11) if i not in used), None)
        if free is None:
            raise ValueError("10 seats is the max")
        rec = {"name": "Seat", "kind": "bridge", "endpoint": "", "model": "", "persona": "",
               "color": "#7aa2f7", "active": 1} | given
        c.execute(
            "INSERT INTO seats (id,name,kind,endpoint,model,persona,color,active) VALUES (?,?,?,?,?,?,?,?)",
            (free, rec["name"], rec["kind"], rec["endpoint"], rec["model"], rec["persona"], rec["color"], rec["active"]),
        )
    c.commit()
    return build_state(c)


# ---------------------------------------------------------------- HTTP layer
class Handler(BaseHTTPRequestHandler):
    server_version = "Conductor/1.0"

    def log_message(self, fmt, *args):  # quieter logs
        if "/api/" in (args[0] if args else ""):
            sys.stderr.write("  %s\n" % (fmt % args))

    # --- io
    def _json(self, obj, code=200):
        body = json.dumps(obj, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _err(self, msg, code=400):
        self._json({"error": str(msg)}, code)

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            raise ValueError("bad Content-Length")
        if n < 0 or n > MAX_BODY:
            raise ValueError(f"request body too large (limit {MAX_BODY // 1024 // 1024} MB)")
        if not n:
            return {}
        try:
            data = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ValueError("body must be valid JSON")
        if not isinstance(data, dict):
            raise ValueError("body must be a JSON object")
        return data

    def _host_ok(self):
        """Reject DNS-rebinding: the Host header must be a loopback name we expect."""
        host = (self.headers.get("Host") or "").strip().lower()
        name = host.rsplit(":", 1)[0] if not host.endswith("]") else host
        return name in ALLOWED_HOSTS

    def _origin_ok(self):
        """Reject cross-site requests: if a browser sent Origin, it must be this very server."""
        origin = self.headers.get("Origin")
        if not origin:
            return True
        host = (self.headers.get("Host") or "").strip().lower()
        return origin.lower() in (f"http://{host}", f"https://{host}")

    def _static(self, path):
        rel = path.lstrip("/") or "index.html"
        if rel == "index.html":
            rel = "index.html"
        full = os.path.normpath(os.path.join(WEB, rel))
        if not (full == WEB or full.startswith(WEB + os.sep)) or not os.path.isfile(full):
            self.send_error(404, "not found")
            return
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
            ".json": "application/json",
        }.get(os.path.splitext(full)[1], "application/octet-stream")
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    # --- routes
    def do_GET(self):
        if not self._host_ok():
            return self._err("bad Host header", 403)
        u = urllib.parse.urlparse(self.path)
        path, qs = u.path, urllib.parse.parse_qs(u.query)
        if not path.startswith("/api/"):
            return self._static(path)
        if not self._origin_ok():
            return self._err("cross-origin request refused", 403)
        with LOCK:
            c = conn()
            try:
                if path == "/api/state":
                    return self._json(build_state(c))
                if path == "/api/memory":
                    return self._json(act_memory_list(c, (qs.get("q") or [""])[0]))
                if path == "/api/prompt":
                    p = compose_current_prompt(c, (qs.get("note") or [""])[0])
                    if not p:
                        return self._err("no active step", 404)
                    return self._json(p)
                if path == "/api/models":
                    ep = (qs.get("endpoint") or ["http://localhost:11434"])[0]
                    return self._json({"models": providers.list_ollama_models(ep)})
                if path == "/api/export":
                    return self._json(act_export(c))
                return self._err("unknown endpoint", 404)
            finally:
                c.close()

    def do_POST(self):
        if not self._host_ok():
            return self._err("bad Host header", 403)
        if not self._origin_ok():
            return self._err("cross-origin request refused", 403)
        # JSON-only: a web page cannot send application/json cross-site without a CORS preflight,
        # and this server never answers preflights.
        if (self.headers.get("Content-Type") or "").split(";")[0].strip().lower() != "application/json":
            return self._err("Content-Type must be application/json", 415)
        u = urllib.parse.urlparse(self.path)
        path = u.path
        try:
            body = self._body()
        except ValueError as e:
            return self._err(e, 413 if "large" in str(e) else 400)
        if path == "/api/run":
            return self._run(body)
        with LOCK:
            c = conn()
            try:
                if path == "/api/seats":
                    return self._json(save_seat(c, body))
                if path.startswith("/api/seats/") and path.endswith("/delete"):
                    sid = int(path.split("/")[3])
                    c.execute("DELETE FROM seats WHERE id=?", (sid,))
                    # open steps for a removed seat would be stuck forever: skip them
                    c.execute("UPDATE plan_steps SET status='skipped' WHERE seat_id=? AND status='pending'", (sid,))
                    c.commit()
                    return self._json(build_state(c))
                if path == "/api/plan":
                    return self._json(act_create_plan(c, body) | {"state": build_state(c)})
                if path == "/api/plan/step":
                    act_update_step(c, body)
                    return self._json(build_state(c))
                if path == "/api/plan/rewind":
                    ep = active_episode(c)
                    if ep:
                        c.execute("UPDATE plan_steps SET status='pending' WHERE episode_id=?", (ep["id"],))
                        c.commit()
                    STATE["dispatched_idx"] = None
                    return self._json(build_state(c))
                if path == "/api/capture":
                    res = act_capture(c, body)
                    return self._json(res | {"state": build_state(c)})
                if path == "/api/plan/preview":
                    seats = seats_list(c)
                    mode = modes.resolve_mode(body.get("default_mode", ""), modes.DEFAULT_MODE)
                    st, unknown = compose.parse_plan_ex(body.get("text", ""), seats, mode)
                    names = {x["id"]: x["name"] for x in seats}
                    return self._json({"steps": [{"seat_id": x["seat_id"], "seat_name": names.get(x["seat_id"]),
                                                  "mode": x["mode"], "mode_label": modes.mode_label(x["mode"])}
                                                 for x in st], "unknown": unknown})
                if path == "/api/note":
                    return self._json(act_user_note(c, body) | {"state": build_state(c)})
                if path == "/api/prompt/preview":
                    p = compose_current_prompt(c, body.get("note", ""))
                    if not p:
                        return self._err("no active step", 404)
                    return self._json(p)
                if path.startswith("/api/memory/") and path.endswith("/pin"):
                    mid = int(path.split("/")[3])
                    c.execute("UPDATE memories SET pinned=? WHERE id=?", (1 if body.get("pinned") else 0, mid))
                    c.commit()
                    return self._json({"ok": True})
                if path.startswith("/api/memory/") and path.endswith("/delete"):
                    mid = int(path.split("/")[3])
                    c.execute("DELETE FROM memories WHERE id=?", (mid,))
                    c.commit()
                    return self._json({"ok": True})
                if path == "/api/memory/add":
                    txt = (body.get("text") or "").strip()
                    if not txt:
                        return self._err("empty")
                    cur = c.execute(
                        """INSERT INTO memories (text, kind, valid_from, confidence, salience, pinned, last_seen_at)
                           VALUES (?,?,?,?,?,?,?)""",
                        (txt, body.get("kind", "fact"), mem.now(), 0.95, 0.9,
                         1 if body.get("pinned") else 0, mem.now()),
                    )
                    c.commit()
                    return self._json({"id": cur.lastrowid})
                return self._err("unknown endpoint", 404)
            except ValueError as e:
                return self._err(e)
            except Exception as e:  # noqa: BLE001
                return self._err(f"{type(e).__name__}: {e}", 500)
            finally:
                c.close()

    def _run(self, body):
        """Local-model call WITHOUT holding the global lock, so the UI stays responsive."""
        try:
            with LOCK:
                c = conn()
                try:
                    job = run_prepare(c, body)
                finally:
                    c.close()
            try:
                reply = providers.generate(job["seat"], job["prompt"])
            except providers.ProviderError as e:
                raise ValueError(str(e))
            with LOCK:
                c = conn()
                try:
                    res = run_finish(c, job, reply)
                    return self._json(res | {"state": build_state(c)})
                finally:
                    c.close()
        except ValueError as e:
            return self._err(e)
        except Exception as e:  # noqa: BLE001
            return self._err(f"{type(e).__name__}: {e}", 500)

    def do_DELETE(self):
        return self.do_POST()


def main():
    db.init()
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Universal AI Conductor running -> http://localhost:{PORT}  (bound to {HOST})")
    print(f"DB: {db.DB_PATH}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
