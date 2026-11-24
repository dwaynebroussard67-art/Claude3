#!/usr/bin/env python3
"""Seed a demo session so the UI isn't empty on first open.

Run:  python3 scripts/demo_seed.py            (adds a demo session + memories)
      python3 scripts/reset.py                (wipes everything, fresh start)
"""

import json
import os
import sys
import urllib.request

BASE = os.environ.get("CONDUCTOR_URL", "http://127.0.0.1:8000")


def post(path, payload):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def main():
    post("/api/note", {"text": "I'm Ray. I prefer blunt answers and no filler. My project is the conductor app. Deadline is next Friday."})
    post("/api/plan", {"text": "4, 2, 2 against each other, 3, 4, 4 running a relay", "title": "demo: should memory live in the app or per AI?"})

    post("/api/capture", {"seat_id": 4, "text":
        "Seat 4. Memory has to live in the conductor, not inside any one AI. "
        "We decided we'll go with an embedded SQLite graph because it travels with the user and "
        "survives any seat leaving. ChatGPT-style web chats are stateless to us, so we re-inject the "
        "relevant slice every hop. Risk: stale facts. Mitigation: temporal validity, not overwrites."})
    post("/api/capture", {"seat_id": 2, "text":
        "Seat 2. I disagree with injecting everything. My position: recall should be capped at ~12 "
        "memories and scored, otherwise the prompt drowns and the seat starts arguing with old "
        "context instead of the current question. I'll concede if you can show a case where a "
        "low-salience memory changes the answer."})
    post("/api/capture", {"seat_id": 2, "text":
        "Seat 2. Conceding half: cap it, but always keep pinned directives regardless of score. "
        "BATON: seat 3, define the scoring formula and show what gets dropped first."})
    print("demo seeded -> reload the conductor window")


if __name__ == "__main__":
    main()
