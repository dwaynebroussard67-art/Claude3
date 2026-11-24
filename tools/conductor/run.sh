#!/usr/bin/env bash
# Start the Universal AI Conductor.
#   ./run.sh          -> native window if pywebview is installed, else browser
#   ./run.sh serve    -> server only (headless), open http://localhost:8000 yourself
set -e
cd "$(dirname "$0")"

PY=${PYTHON:-python3}
if [ "$1" = "serve" ]; then
  exec "$PY" server.py
fi
exec "$PY" desktop.py
