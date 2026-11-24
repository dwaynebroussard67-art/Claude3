#!/usr/bin/env python3
"""Desktop launcher for the Universal AI Conductor.

This is the "standalone app" entry point. It:
  * starts the local conductor server in-process,
  * opens the UI in a native window (pywebview) or your default browser,
  * registers GLOBAL hotkeys so you never touch the conductor UI during a hop,
  * reads/writes the system clipboard so the bridge is two keystrokes.

Hotkeys (work while you are focused in ChatGPT / Claude / Gemini):
  Ctrl+Alt+C   compose the next prompt and put it on the clipboard
  Ctrl+Alt+V   take whatever is on the clipboard, treat it as the current
               seat's reply, store it in memory, then put the NEXT prompt
               on the clipboard automatically

Optional extras (pip install pywebview pynput). Everything degrades gracefully:
  * no pywebview -> opens your browser
  * no pynput     -> in-window hotkeys still work (Ctrl+Shift+C / Ctrl+Shift+V)
  * no clipboard tool (xclip/xsel/wl-clipboard on Linux) -> hotkeys disabled, buttons still work
"""

import json
import os
import sys
import threading
import time
import urllib.request
import webbrowser
from http.server import ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import server as srv  # noqa: E402

PORT = int(os.environ.get("PORT", "8000"))
BASE = f"http://127.0.0.1:{PORT}"

# ------------------------------------------------------------------ clipboard
class Clipboard:
    """Thread-safe system clipboard via OS tools (no Tk: hotkeys fire on worker threads).

    macOS pbcopy/pbpaste | Windows PowerShell | Linux wl-clipboard, xclip or xsel.
    """

    def __init__(self):
        import shutil

        self.get_cmd = self.put_cmd = None
        if sys.platform == "darwin":
            self.get_cmd, self.put_cmd = ["pbpaste"], ["pbcopy"]
        elif sys.platform.startswith("win"):
            self.get_cmd = ["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"]
            self.put_cmd = ["powershell", "-NoProfile", "-Command",
                            "[Console]::InputEncoding=[Text.Encoding]::UTF8; $t=[Console]::In.ReadToEnd(); Set-Clipboard -Value $t"]
        elif shutil.which("wl-paste"):
            self.get_cmd, self.put_cmd = ["wl-paste", "-n"], ["wl-copy"]
        elif shutil.which("xclip"):
            self.get_cmd = ["xclip", "-selection", "clipboard", "-o"]
            self.put_cmd = ["xclip", "-selection", "clipboard", "-i"]
        elif shutil.which("xsel"):
            self.get_cmd, self.put_cmd = ["xsel", "-b", "-o"], ["xsel", "-b", "-i"]
        self.ok = bool(self.get_cmd)
        if not self.ok:
            print("[clipboard] no clipboard tool found (install xclip, xsel or wl-clipboard on Linux).")

    def get(self):
        import subprocess

        if not self.ok:
            return ""
        try:
            return subprocess.run(self.get_cmd, capture_output=True, timeout=5).stdout.decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            return ""

    def put(self, text):
        import subprocess

        if not self.ok:
            return False
        try:
            subprocess.run(self.put_cmd, input=text.encode("utf-8"), timeout=5, check=True)
            return True
        except Exception:  # noqa: BLE001
            return False


CLIP = None


# --------------------------------------------------------------------- api io
def api(path, payload=None):
    url = BASE + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return json.loads(r.read().decode())
    except Exception as e:  # noqa: BLE001
        print(f"[api] {path} failed: {e}")
        return {"error": str(e)}


def file_log(msg):
    try:
        with open(os.path.join(HERE, "data", "conductor.log"), "a") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}\n")
    except Exception:  # noqa: BLE001
        pass


def hop_compose():
    """Ctrl+Alt+C -- put the next routed prompt on the clipboard."""
    r = api("/api/prompt/preview", {"note": ""})
    if r.get("error"):
        return notify("Nothing to route -- start a plan in the conductor window.")
    if CLIP and CLIP.put(r["prompt"]):
        seat = r["seat"]["name"]
        return notify(f"Prompt for seat {r['seat']['id']} ({seat}) is on your clipboard. Paste it there.")
    return notify("Clipboard unavailable -- use the conductor window.")


def hop_capture():
    """Ctrl+Alt+V -- absorb the clipboard as the current reply, then queue the next hop."""
    text = (CLIP.get() if CLIP else "").strip()
    if not text:
        return notify("Clipboard is empty -- copy the AI's reply first.")
    r = api("/api/capture", {"text": text})
    if r.get("error"):
        return notify(f"Capture failed: {r['error']}")
    added = r.get("memories_added", 0)
    nxt = (r.get("state") or {}).get("next")
    if nxt:
        p = api("/api/prompt/preview", {"note": ""})
        if not p.get("error"):
            CLIP.put(p["prompt"])
        return notify(
            f"Stored (+{added} memories). Next: seat {nxt['seat_id']} ({nxt['seat_name']}, "
            f"{nxt['mode_label']}) -- prompt is on your clipboard already."
        )
    return notify(f"Stored (+{added} memories). Plan complete.")


def notify(msg):
    print("[hop]", msg)
    file_log(msg)
    try:  # best-effort desktop notification
        import subprocess

        if sys.platform == "darwin":
            subprocess.run(["osascript", "-e", "on run argv", "-e", "display notification (item 1 of argv)",
                            "-e", "end run", msg], check=False, timeout=3)
        elif sys.platform.startswith("linux"):
            subprocess.run(["notify-send", "--", "Conductor", msg], check=False, timeout=3)
    except Exception:  # noqa: BLE001
        pass
    return msg


def register_hotkeys():
    try:
        from pynput import keyboard
    except Exception:  # noqa: BLE001
        print("[hotkeys] pynput not installed (or no display) -> in-window hotkeys only.")
        print("         pip install pynput   for Ctrl+Alt+C / Ctrl+Alt+V system-wide.")
        return

    def run(fn):
        return lambda: threading.Thread(target=fn, daemon=True).start()

    # GlobalHotKeys handles left/right modifiers and ctrl-char quirks that a hand-rolled matcher misses.
    keyboard.GlobalHotKeys({"<ctrl>+<alt>+c": run(hop_compose), "<ctrl>+<alt>+v": run(hop_capture)}).start()
    print("[hotkeys] Ctrl+Alt+C compose | Ctrl+Alt+V capture  (system-wide)")


# ---------------------------------------------------------------------- main
def serve():
    srv.db.init()
    httpd = ThreadingHTTPServer((srv.HOST, PORT), srv.Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    global CLIP
    serve()
    CLIP = Clipboard()
    register_hotkeys()
    print(f"Universal AI Conductor -> {BASE}")
    try:
        import webview

        webview.create_window(
            "Universal AI Conductor", BASE, width=1440, height=940, min_size=(980, 640)
        )
        webview.start()
    except Exception:  # noqa: BLE001
        webbrowser.open(BASE)
        print("Native window unavailable -- opened in your browser. Ctrl+C to quit.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nbye")


if __name__ == "__main__":
    main()
