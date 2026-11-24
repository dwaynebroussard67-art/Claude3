"""Conversation modes for the conductor.

Each mode changes what the conductor *tells the seat to do* when it composes the
prompt. Nothing here requires an API key: the text simply gets routed to
whatever interface the seat is (web UI via clipboard, or local model via HTTP).
"""

MODES = {
    "roundtable": {
        "label": "Roundtable",
        "short": "say your piece to the whole table",
        "instruction": (
            "Speak to the whole table. Give your own read on the question, then name "
            "one thing another seat got right and one thing you think is wrong. "
            "Keep it tight."
        ),
    },
    "debate": {
        "label": "Argue / against each other",
        "short": "argue your side, no fence-sitting",
        "instruction": (
            "This is a head-to-head argument. Take a clear position and defend it. "
            "Attack the strongest version of the opposing view, not a weak version. "
            "Concede a point only if you state what would change your mind. "
            "No hedging, no 'both sides have merit' summaries."
        ),
    },
    "collaborate": {
        "label": "Work together",
        "short": "build on what's on the table",
        "instruction": (
            "You are building something with the other seats. Take what is on the table, "
            "improve it, and end with one concrete next action that someone else could "
            "execute. Do not restate the whole thread."
        ),
    },
    "relay": {
        "label": "Relay",
        "short": "take the baton, add your leg, pass it on",
        "instruction": (
            "You are running a relay leg. Do NOT re-summarize and do NOT restart from "
            "scratch. Continue exactly from where the last seat stopped, add your leg of "
            "work, and end with a single line starting 'BATON:' that tells the next seat "
            "precisely what to do."
        ),
    },
    "devils_advocate": {
        "label": "Devil's advocate",
        "short": "try to break the leading idea",
        "instruction": (
            "Your job is to break the leading idea, not to agree. Produce the three "
            "sharpest objections you can, ranked by how damaging they are, and name the "
            "one piece of evidence that would settle each."
        ),
    },
    "panel_vote": {
        "label": "Panel vote",
        "short": "vote and justify in one line",
        "instruction": (
            "Give a verdict. Line 1 must be exactly: VOTE: AGREE | OPPOSE | ABSTAIN. "
            "Then one line of justification, then one line of what would flip your vote."
        ),
    },
    "silent_peer_review": {
        "label": "Silent peer review",
        "short": "no prose, just critique + score",
        "instruction": (
            "Do not write prose for the other seats. Output only: a numbered list of "
            "critiques of the latest proposal, then 'SCORE: n/10', then nothing else."
        ),
    },
    "user_moderated": {
        "label": "User-moderated",
        "short": "answer me, briefly",
        "instruction": (
            "The user is moderating. Answer the user directly and briefly. If you need "
            "something before you can answer, ask exactly one question and stop."
        ),
    },
}

# Aliases so "against each other" / "running a relay" / "team up" work as typed.
ALIASES = {
    "against each other": "debate",
    "against": "debate",
    "argue": "debate",
    "fight": "debate",
    "versus": "debate",
    "vs": "debate",
    "work together": "collaborate",
    "together": "collaborate",
    "team": "collaborate",
    "build": "collaborate",
    "running a relay": "relay",
    "relay": "relay",
    "baton": "relay",
    "round table": "roundtable",
    "roundtable": "roundtable",
    "table": "roundtable",
    "devil": "devils_advocate",
    "devils advocate": "devils_advocate",
    "devil's advocate": "devils_advocate",
    "vote": "panel_vote",
    "panel": "panel_vote",
    "review": "silent_peer_review",
    "silent": "silent_peer_review",
    "moderate": "user_moderated",
    "moderated": "user_moderated",
    "me": "user_moderated",
}

DEFAULT_MODE = "roundtable"


def resolve_mode(text, fallback=DEFAULT_MODE):
    """Map free text ('run a debate', 'against each other') to a mode key."""
    if not text:
        return fallback
    t = str(text).strip().lower()
    if t in MODES:
        return t
    if t in ALIASES:
        return ALIASES[t]
    for alias, mode in sorted(ALIASES.items(), key=lambda kv: -len(kv[0])):
        if alias in t:
            return mode
    return fallback


def mode_instruction(mode):
    return MODES.get(mode, MODES[DEFAULT_MODE])["instruction"]


def mode_label(mode):
    return MODES.get(mode, MODES[DEFAULT_MODE])["label"]
