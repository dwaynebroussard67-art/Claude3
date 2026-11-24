"""Embedded database. One SQLite file, owned by the user, travels with them.

No server, no cloud. Delete the file and the memory is gone; copy it and the
memory goes with you. That is the whole point of "the memory stays with me".
"""

import os
import sqlite3

DB_PATH = os.environ.get(
    "CONDUCTOR_DB",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "conductor.db"),
)

SCHEMA = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS seats (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'bridge',   -- bridge | ollama | openai_compatible
    endpoint    TEXT DEFAULT '',
    model       TEXT DEFAULT '',
    persona     TEXT DEFAULT '',
    color       TEXT DEFAULT '#7aa2f7',
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS episodes (
    id          INTEGER PRIMARY KEY,
    title       TEXT,
    plan_text   TEXT,
    default_mode TEXT,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    closed_at   TEXT
);

CREATE TABLE IF NOT EXISTS plan_steps (
    id          INTEGER PRIMARY KEY,
    episode_id  INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
    idx         INTEGER NOT NULL,
    seat_id     INTEGER,
    mode        TEXT NOT NULL DEFAULT 'roundtable',
    note        TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'pending'   -- pending | done | skipped
);

CREATE TABLE IF NOT EXISTS turns (
    id          INTEGER PRIMARY KEY,
    episode_id  INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
    step_idx    INTEGER,
    seat_id     INTEGER,
    seat_name   TEXT,
    mode        TEXT,
    role        TEXT NOT NULL DEFAULT 'seat',      -- seat | user | system
    content     TEXT NOT NULL,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entities (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,              -- normalized lowercase
    display     TEXT NOT NULL,
    type        TEXT DEFAULT 'thing',              -- person | project | tool | place | thing
    mentions    INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memories (
    id           INTEGER PRIMARY KEY,
    text         TEXT NOT NULL,
    kind         TEXT DEFAULT 'fact',              -- fact | preference | decision | claim | question | directive
    entities     TEXT DEFAULT '',                  -- csv of normalized entity names
    episode_id   INTEGER,
    source_turn_id INTEGER,
    valid_from   TEXT DEFAULT CURRENT_TIMESTAMP,
    valid_to     TEXT,                             -- NULL = still true (temporal graph)
    confidence   REAL DEFAULT 0.7,
    salience     REAL DEFAULT 0.5,
    last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
    superseded_by INTEGER,
    pinned       INTEGER DEFAULT 0,
    origin       TEXT DEFAULT 'human'              -- human | ai  (ai = auto-mined from a seat reply: untrusted)
);

CREATE TABLE IF NOT EXISTS relations (
    id           INTEGER PRIMARY KEY,
    src          TEXT NOT NULL,
    rel          TEXT NOT NULL,
    dst          TEXT NOT NULL,
    source_turn_id INTEGER,
    valid_from   TEXT DEFAULT CURRENT_TIMESTAMP,
    valid_to     TEXT,
    confidence   REAL DEFAULT 0.6
);

CREATE TABLE IF NOT EXISTS memory_events (
    id          INTEGER PRIMARY KEY,
    at          TEXT DEFAULT CURRENT_TIMESTAMP,
    kind        TEXT,
    detail      TEXT
);

CREATE INDEX IF NOT EXISTS idx_mem_lastseen ON memories(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_mem_kind     ON memories(kind);
CREATE INDEX IF NOT EXISTS idx_turns_ep     ON turns(episode_id, id);
CREATE INDEX IF NOT EXISTS idx_steps_ep     ON plan_steps(episode_id, idx);
"""

_SEED_SEATS = [
    (1, "ChatGPT", "bridge", "", "", "Generalist. Good at framing and plans.", "#74e0a0"),
    (2, "Claude", "bridge", "", "", "Long-context writer. Careful with details.", "#e0a374"),
    (3, "Gemini", "bridge", "", "", "Fast researcher. Good at breadth.", "#7aa2f7"),
    (4, "Local model", "ollama", "http://localhost:11434", "llama3.2", "Runs on your machine.", "#c58cf0"),
]


def connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init():
    conn = connect()
    with conn:
        conn.executescript(SCHEMA)
        cols = {r[1] for r in conn.execute("PRAGMA table_info(memories)")}
        if "origin" not in cols:   # migrate older databases; old auto-mined rows are treated as untrusted
            conn.execute("ALTER TABLE memories ADD COLUMN origin TEXT DEFAULT 'human'")
            conn.execute("UPDATE memories SET origin='ai' WHERE source_turn_id IS NOT NULL AND pinned=0")
        n = conn.execute("SELECT COUNT(*) c FROM seats").fetchone()["c"]
        if n == 0:
            conn.executemany(
                "INSERT INTO seats (id,name,kind,endpoint,model,persona,color) VALUES (?,?,?,?,?,?,?)",
                _SEED_SEATS,
            )
    conn.close()


def rows(conn, sql, args=()):
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def log(conn, kind, detail):
    conn.execute("INSERT INTO memory_events (kind, detail) VALUES (?,?)", (kind, detail))
    conn.commit()
