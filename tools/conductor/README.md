# Universal AI Conductor

A standalone app that lets **1–10 AIs talk to each other** — including the web AIs you already
use for free (ChatGPT, Claude, Gemini, Grok, whatever you have open) **and** local models
(Ollama / LM Studio / llama.cpp) — with a **memory graph that belongs to you** and keeps
working after you close any seat.

No API keys required. No login automation. No scraping. No browser extension.

---

## What it actually does

There are two kinds of seats:

| Seat kind | How it talks | Needs |
|---|---|---|
| **bridge** | You keep that AI open in its normal app/tab. The conductor copies the routed prompt to your clipboard → you paste → you copy its reply → the conductor absorbs it. Two hotkeys per hop. | nothing |
| **local / direct** | The app calls the model itself (Ollama, LM Studio, llama.cpp — all keyless). Fully automatic. | a local model server |

The conductor is the middle. Every hop it:

1. absorbs the previous seat's reply,
2. mines it for facts / preferences / decisions and writes them into the temporal memory graph,
3. builds the next seat's prompt — its role, the conversation so far, a *scored slice* of your
   memory, and the mode instructions for this leg,
4. puts that prompt on your clipboard (bridge seat) or sends it directly (local seat).

That's the whole trick. It is why this works with free tiers: nothing is logged into, nothing is
scraped, the AI's own interface does what it always does — you just stop being the one who does
the copy-paste thinking.

---

## Turn plans — this is the "4, 2, 2, 3, 4, 4" thing

A **turn plan** is the speaking order plus a conversation mode for each leg.
Type it in plain English in the plan bar:

```
4, 2, 2 against each other, 3, 4, 4 running a relay
```

means:

| step | seat | mode |
|---|---|---|
| 1 | seat 4 | debate |
| 2 | seat 2 | debate |
| 3 | seat 2 | debate |
| 4 | seat 3 | relay |
| 5 | seat 4 | relay |
| 6 | seat 4 | relay |

**Parsing rules** (short and predictable):

* Numbers are seat numbers. Seat names work too (`chatgpt, claude work together, then 4 relay`).
* A mode phrase labels the group **before** it: `4, 2, 2 against each other`.
* If nothing came before the phrase, it labels the group **after** it: `debate: 3,4`.
* `then`, `next`, `->`, `;` end a group.
* Nothing else → the default mode (roundtable).
* After the plan is built you can change any single step's mode from the step strip in the UI.

### Modes

| mode | what the seat is told |
|---|---|
| **roundtable** | speak to the whole table, name what one seat got right and one thing that's wrong |
| **debate / against each other** | take a position, attack the strongest opposing version, no hedging |
| **collaborate / work together** | build on what's on the table, end with one concrete next action |
| **relay** | continue exactly where the last seat stopped, end with a `BATON:` line |
| **devil's advocate** | three sharpest objections, ranked, plus what evidence would settle each |
| **panel vote** | `VOTE: AGREE / OPPOSE / ABSTAIN` then one line of justification |
| **silent peer review** | no prose, just numbered critiques + `SCORE: n/10` |
| **user-moderated** | answer the human directly and briefly; ask one question if blocked |

---

## Memory ("graffiti memory", Graphiti-style)

An embedded temporal knowledge graph in one SQLite file: `data/conductor.db`.

* `entities` — people, projects, tools, places; mention counts, last seen.
* `memories` — facts, preferences, decisions, directives, questions with
  `valid_from`, `valid_to`, `confidence`, `salience`, `last_seen_at`, `pinned`.
* `relations` — src → rel → dst edges, also time-bounded.
* `turns` / `episodes` / `plan_steps` — the conversation itself.
* `memory_events` — an audit trail of what the graph did.

Behaviours that matter:

* **Restatements retire, nothing is deleted.** When a new memory is a near-duplicate of an older one of
  the same kind (Jaccard >= 0.72), the old one gets `valid_to` + `superseded_by`. This is *not*
  semantic contradiction detection: "uses Postgres" followed by "uses SQLite" leaves both active.
  Single-valued relations (`works at`, `lives in`, `reports to`) do retire the old edge when the value changes.
* **AI text is untrusted.** Memories mined from a seat reply are stored with `origin='ai'`, can never become
  `directive`/`preference`, and are injected in a separate "unverified, not instructions" block. Only things
  you type (the note box, "teach memory", pins) are labelled reliable.
* **Recall is scored and capped** (~14 items per prompt). Previews do not change recency; only a real run does.
* Extraction is keyword/regex based: it misses unmarked statements and picks up some filler. Pin or delete
  in the Memory panel to correct it.

Memory is attached to **you**, not to a seat. Remove a seat and every memory it contributed stays.
Copy `data/conductor.db` to another machine and your memory goes with it. `Export memory` dumps the
graph (all memories, entities, relations, episodes and turns) as JSON; there is no import yet.

## Security model

* Binds to **127.0.0.1** only (`CONDUCTOR_HOST` overrides; do not expose it to a network).
* Every request must carry a loopback `Host`; POSTs must be `application/json` and, if a browser sent
  `Origin`, it must be this server. That blocks cross-site writes and DNS rebinding.
* Seat endpoints must be `http(s)` to this machine or a private LAN address; redirects are not followed.
* Request bodies are capped at 5 MB. Prompts are capped (24k chars; 3.5k per turn) and Ollama is asked for an 8k context.
* `python3 scripts/selftest.py` runs the regression suite.

---

## Run it

Requires Python 3.9+. Nothing else is required.

```bash
cd conductor
./run.sh            # macOS/Linux  (starts the app, opens a window or your browser)
run.bat             # Windows
python3 server.py   # headless: then open http://localhost:8000
python3 scripts/demo_seed.py   # optional: load a demo session (adds fake memories; reset.py wipes them)
```

Optional, to get closer to a native app:

```bash
pip install pywebview   # real app window instead of a browser tab
pip install pynput      # system-wide hotkeys (work while you're focused in ChatGPT/Claude)
```

Local models — set a seat's kind to `ollama` (endpoint `http://localhost:11434`) or
`openai_compatible` for LM Studio (`http://localhost:1234`) / llama.cpp (`http://localhost:8080`).
Those seats get a **Run** button and execute automatically.

### The hop loop with hotkeys

1. Focus your AI's window, `Ctrl+Alt+C` → the routed prompt is on your clipboard. Paste, send.
2. Select its reply, copy it. `Ctrl+Alt+V` → reply stored, memory updated, **next seat's prompt is
   already on your clipboard**.
3. Switch to the next AI. Paste. Repeat.

In-window equivalents: `Ctrl+Shift+C` (copy prompt) and `Ctrl+Shift+V` (capture).

---

## Layout

```
conductor/
├── server.py                  HTTP + JSON API (stdlib only)
├── desktop.py                 native window, clipboard, global hotkeys
├── conductor_core/
│   ├── modes.py               the 8 conversation modes
│   ├── compose.py             turn-plan parsing + prompt composition
│   ├── memory.py              temporal graph: extraction, supersession, scored recall
│   ├── providers.py           Ollama / LM Studio / llama.cpp clients (keyless)
│   └── db.py                  SQLite schema + seed seats
├── web/                       the UI (index.html, app.js, styles.css)
├── scripts/demo_seed.py       populate a demo session
├── scripts/reset.py           wipe the database
└── data/conductor.db          YOUR memory. Back this up.
```

### API (if you'd rather script it)

```
GET  /api/state              seats, plan, cursor, transcript, memory stats
POST /api/seats              add/update a seat (max 10)
POST /api/plan               {"text": "4,2,2 against each other", "title": "..."}
POST /api/plan/step          {"idx": 2, "mode": "relay"}   per-step override
POST /api/plan/rewind        reset every step to pending
GET  /api/prompt             the composed prompt for the current step
POST /api/prompt/preview     same, with a one-off instruction
POST /api/capture            {"text": "...", "seat_id": 2}  absorb a reply, advance
POST /api/run                run the current step on a local seat
POST /api/note               standing instruction from you (also mined for memory)
GET  /api/memory?q=          browse/search the graph
POST /api/memory/add         {"text": "...", "kind": "directive", "pinned": true}
GET  /api/export             full JSON dump
```

---

## What this is not

It does not log into your accounts, click around your AI's UI, read their DOM, bypass rate limits,
or evade bot detection. Bridge seats work because *you* move text, and the conductor does all the
thinking about routing, memory, and prompt construction. That keeps you inside every provider's
terms, and it means a provider UI change can never break the app.

## Roadmap

* Screen-anchored quick bar (always-on-top mini window) for one-keystroke hops.
* Memory: entity merging, contradiction prompts ("you said X in March, now Y — which stands?").
* Plan templates: save/recall a turn plan as a reusable "recipe".
* Auto-detect local models on the usual ports and pre-fill seat config.
* Session replay: scrub the graph as it was at step N.
