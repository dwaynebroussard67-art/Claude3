"""Graphiti-style temporal memory, embedded.

The important properties (this is the part that makes it *yours* rather than a
chat vendor's):
  * memories and relations are versioned in time (valid_from / valid_to), never
    silently overwritten -- so "what did I believe last month" is answerable;
  * memory is tied to YOU and the seat id is only metadata, so when a seat is
    removed the memory survives;
  * recall is scored, so each prompt gets a small relevant slice instead of the
    whole history.
"""

import re
from datetime import datetime, timezone

STOP = set(
    """a an the and or but if then than that this these those i we you he she it they me us them
    my our your his her its their is are was were be been being do does did doing have has had
    having to of in on at by for with about as from into over under again further once here there
    when where why how all any both each few more most other some such no nor not only own same
    so too very can will just dont should now what which who whom while also really maybe
    """.split()
)

SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")

MEMORY_MARKERS = [
    ("preference", r"\b(i|we)\s+(prefer|like|love|hate|want|need|always|never)\b"),
    ("preference", r"\bmy (name|email|goal|budget|deadline|job|project)\b"),
    ("directive", r"\b(remember|from now on|always|never|don'?t ever|make sure)\b"),
    ("decision", r"\b(decided|decision|we'?ll go with|final answer|conclusion is|settled on)\b"),
    ("decision", r"\b(let'?s|let us)\s+(use|go|pick|choose)\b"),
    ("fact", r"\bis\s+(a|an|the)\s+\w+"),
    ("fact", r"\b\d{3,}\b|\$\d+|\bnext (week|month|monday|tuesday|wednesday|thursday|friday)\b"),
]

RELATION_PATTERNS = [
    (r"(?P<src>[A-Z][\w-]*(?: [A-Z][\w-]*){0,3})\s+(?P<rel>is a|is an|is the|are a|are the)\s+(?P<dst>[\w-]+(?: [\w-]+){0,3})", False),
    (r"(?P<src>[A-Z][\w-]*(?: [A-Z][\w-]*){0,3})\s+(?P<rel>uses|needs|depends on|requires|calls|includes)\s+(?P<dst>[\w-]+(?: [\w-]+){0,3})", False),
    # single-valued relations: a new value retires the old one
    (r"(?P<src>[A-Z][\w-]*(?: [A-Z][\w-]*){0,3})\s+(?P<rel>works at|works for|lives in|reports to)\s+(?P<dst>[\w-]+(?: [\w-]+){0,3})", True),
]

NOISE_ENTITIES = {
    # roles and scaffolding
    "seat", "seats", "user", "the user", "human", "conductor", "ai", "ais", "you", "i",
    "ok", "okay", "yes", "no", "note", "notes", "step", "vote", "score", "baton", "baton:",
    "session", "mode", "turn", "answer", "question", "context", "prompt", "format",
    # generic prose openers that look like proper nouns
    "risk", "risks", "mitigation", "benefit", "benefits", "example", "position", "take",
    "my", "our", "your", "first", "second", "third", "last", "next", "finally", "however",
    "conceding", "conclusion", "summary", "pros", "cons", "upshot", "problem", "solution",
    "never", "always", "instead", "therefore", "because", "although", "also", "still", "then",
    "thus", "hence", "otherwise", "meanwhile", "maybe", "perhaps", "sure", "yes", "right", "well",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
}

CAP_PHRASE = re.compile(r"\b([A-Z][a-zA-Z0-9][\w.-]*(?:\s+[A-Z][a-zA-Z0-9][\w.-]*){0,3})\b")


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def norm(s):
    return re.sub(r"\s+", " ", (s or "").strip().lower()).strip(" .,:;\"'")


def tokens(text):
    return [t for t in re.findall(r"[\w']+", (text or "").lower()) if t not in STOP and len(t) > 2]


def jaccard(a, b):
    A, B = set(tokens(a)), set(tokens(b))
    if not A or not B:
        return 0.0
    return len(A & B) / len(A | B)


# --------------------------------------------------------------------- extract
def extract_entities(text, seat_names=()):
    found = {}
    for m in CAP_PHRASE.finditer(text or ""):
        phrase = m.group(1).strip()
        if not phrase:
            continue
        first = phrase.split()[0].lower()
        if first in STOP:
            continue
        # drop phrases that begin mid-sentence with a lowercase continuation only
        if len(phrase) < 2:
            continue
        if norm(phrase) in NOISE_ENTITIES:
            continue
        if re.search(r"[.,:;!?()\[\]\"']", phrase):   # sentence punctuation = not a name
            continue
        if phrase.split()[0].lower() in NOISE_ENTITIES:
            continue
        found.setdefault(norm(phrase), phrase)
    for name in seat_names:
        if name and re.search(rf"\b{re.escape(name)}\b", text or "", re.I):
            found.setdefault(norm(name), name)
    return found


def guess_type(display, text):
    low = display.lower()
    if re.search(r"\b(he|she|they|him|her)\b", text.lower()) and re.match(r"^[A-Z][a-z]+$", display):
        return "person"
    if any(k in low for k in ("app", "tool", "model", "api", "sqlite", "tauri", "ollama", "python", "react")):
        return "tool"
    if any(k in low for k in ("project", "plan", "system", "memory", "conductor")):
        return "project"
    if re.match(r"^[A-Z][a-z]+$", display):
        return "person"
    return "thing"


def extract_memories(text, seat_names=()):
    """Return candidate memories: [{text, kind, confidence, salience, entities}]"""
    out = []
    for raw in SENTENCE_SPLIT.split(text or ""):
        s = (raw or "").strip()
        if len(s) < 12 or len(s) > 600:
            continue
        kind, conf = None, 0.6
        for k, pat in MEMORY_MARKERS:
            if re.search(pat, s, re.I):
                kind = k
                conf = 0.8 if k in ("preference", "decision", "directive") else 0.65
                break
        if s.endswith("?"):
            kind, conf = "question", 0.5
        if kind is None:
            continue
        ents = list(extract_entities(s, seat_names).keys())
        salience = 0.5
        if kind in ("preference", "decision", "directive"):
            salience += 0.25
        if len(tokens(s)) > 6:
            salience += 0.1
        if ents:
            salience += 0.1
        out.append(
            {
                "text": s,
                "kind": kind,
                "confidence": round(min(conf, 0.95), 2),
                "salience": round(min(salience, 1.0), 2),
                "entities": ",".join(ents),
            }
        )
    return out[:25]


def extract_relations(text):
    out = []
    for pat, single in RELATION_PATTERNS:
        for m in re.finditer(pat, text or ""):
            src = norm(re.split(r"[.,;:!?]", m.group("src"))[0])
            dst = norm(re.split(r"[.,;:!?]", m.group("dst"))[0])
            if not src or not dst or src == dst or len(dst) > 40:
                continue
            out.append({"src": src, "rel": m.group("rel").replace(" ", "_"), "dst": dst,
                        "confidence": 0.55, "single": single})
    return out[:15]


def add_relation(conn, r, turn_id):
    """Dedupe identical active edges; retire the old edge when a single-valued relation changes."""
    same = conn.execute(
        "SELECT id FROM relations WHERE src=? AND rel=? AND dst=? AND valid_to IS NULL",
        (r["src"], r["rel"], r["dst"]),
    ).fetchone()
    if same:
        return
    if r.get("single"):
        conn.execute(
            "UPDATE relations SET valid_to=? WHERE src=? AND rel=? AND valid_to IS NULL",
            (now(), r["src"], r["rel"]),
        )
    conn.execute(
        "INSERT INTO relations (src, rel, dst, source_turn_id, valid_from, confidence) VALUES (?,?,?,?,?,?)",
        (r["src"], r["rel"], r["dst"], turn_id, now(), r["confidence"]),
    )


# ---------------------------------------------------------------------- ingest
def upsert_entity(conn, name_norm, display, etype):
    row = conn.execute("SELECT id FROM entities WHERE name=?", (name_norm,)).fetchone()
    if row:
        conn.execute(
            "UPDATE entities SET mentions=mentions+1, last_seen_at=?, display=? WHERE id=?",
            (now(), display, row["id"]),
        )
        return row["id"]
    cur = conn.execute(
        "INSERT INTO entities (name, display, type, mentions, created_at, last_seen_at) VALUES (?,?,?,1,?,?)",
        (name_norm, display, etype, now(), now()),
    )
    return cur.lastrowid


def supersede_if_conflict(conn, new_id, new_text, kind):
    """Temporal graph behaviour: don't overwrite, retire the old edge."""
    old_ids = [
        r["id"]
        for r in conn.execute(
            "SELECT id, text FROM memories WHERE valid_to IS NULL AND kind=? AND id!=?", (kind, new_id)
        ).fetchall()
        if True
    ]
    for oid in old_ids:
        row = conn.execute("SELECT text FROM memories WHERE id=?", (oid,)).fetchone()
        if row and jaccard(row["text"], new_text) >= 0.72:
            conn.execute(
                "UPDATE memories SET valid_to=?, superseded_by=?, salience=max(salience-0.15,0.1) WHERE id=?",
                (now(), new_id, oid),
            )


def ingest_turn(conn, text, turn_id=None, episode_id=None, seat_names=(), extract=True, origin="ai"):
    """Store a turn *and* fold it into the graph. Returns ids created."""
    ents = extract_entities(text, seat_names) if extract else {}
    for name_norm, display in ents.items():
        upsert_entity(conn, name_norm, display, guess_type(display, text))

    mem_ids = []
    if extract:
        for m in extract_memories(text, seat_names):
            kind = m["kind"]
            if origin != "human" and kind in ("directive", "preference"):
                kind = "claim"   # an AI reply cannot set standing instructions or human preferences
            dup = conn.execute(
                "SELECT id FROM memories WHERE valid_to IS NULL AND lower(text)=lower(?)", (m["text"],)
            ).fetchone()
            if dup:
                conn.execute("UPDATE memories SET last_seen_at=? WHERE id=?", (now(), dup["id"]))
                continue
            cur = conn.execute(
                """INSERT INTO memories
                   (text, kind, entities, episode_id, source_turn_id, valid_from,
                    confidence, salience, last_seen_at, origin)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (m["text"], kind, m["entities"], episode_id, turn_id,
                 now(), m["confidence"], m["salience"], now(), "human" if origin == "human" else "ai"),
            )
            mid = cur.lastrowid
            mem_ids.append(mid)
            supersede_if_conflict(conn, mid, m["text"], kind)
        for r in extract_relations(text):
            add_relation(conn, r, turn_id)
    conn.commit()
    return {"entities": len(ents), "memories": mem_ids}


# ---------------------------------------------------------------------- recall
def recall(conn, query="", limit=14, episode_id=None, touch=False):
    rows = [
        dict(r)
        for r in conn.execute(
            "SELECT * FROM memories WHERE valid_to IS NULL OR pinned=1"
        ).fetchall()
    ]
    if not rows:
        return []
    q = set(tokens(query))
    scored = []
    for r in rows:
        score = float(r["salience"] or 0.5) * 1.2 + float(r["confidence"] or 0.5) * 0.4
        if r["pinned"]:
            score += 1.5
        mt = set(tokens(r["text"]))
        if q:
            overlap = len(q & mt)
            score += overlap * 1.1
            if overlap == 0:
                score -= 0.35
        if episode_id and r["episode_id"] == episode_id:
            score += 0.6
        # recency bonus (last_seen_at ISO string compares lexicographically)
        if r["last_seen_at"] and r["last_seen_at"] > _days_ago(7):
            score += 0.3
        if r["valid_to"]:
            score -= 0.2
        if (r.get("origin") or "human") != "human":
            score -= 0.25
        scored.append((score, r))
    scored.sort(key=lambda t: -t[0])
    out = [r for _, r in scored[:limit]]
    if touch:   # only bump recency when a prompt is really used, never on a mere preview/GET
        conn.executemany("UPDATE memories SET last_seen_at=? WHERE id=?", [(now(), r["id"]) for r in out])
        conn.commit()
    return out


def _days_ago(n):
    from datetime import timedelta

    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat(timespec="seconds")


def related_entities(conn, query, limit=10):
    q = set(tokens(query))
    out = []
    for r in conn.execute("SELECT * FROM entities ORDER BY mentions DESC, last_seen_at DESC LIMIT 200").fetchall():
        d = dict(r)
        if q & set(tokens(d["display"])):
            out.append(d)
    return (out or [dict(r) for r in conn.execute(
        "SELECT * FROM entities ORDER BY mentions DESC, last_seen_at DESC LIMIT 8").fetchall()])[:limit]


def stats(conn):
    one = lambda sql: conn.execute(sql).fetchone()[0]
    return {
        "memories": one("SELECT COUNT(*) FROM memories"),
        "active_memories": one("SELECT COUNT(*) FROM memories WHERE valid_to IS NULL"),
        "entities": one("SELECT COUNT(*) FROM entities"),
        "relations": one("SELECT COUNT(*) FROM relations"),
        "turns": one("SELECT COUNT(*) FROM turns"),
        "episodes": one("SELECT COUNT(*) FROM episodes"),
    }
