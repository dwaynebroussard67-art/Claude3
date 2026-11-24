#!/usr/bin/env python3
"""Wipe the local database. Your memory dies here -- back up data/conductor.db first."""

import glob
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db = os.path.join(HERE, "data", "conductor.db")

for path in glob.glob(db + "*"):
    os.remove(path)
    print("removed", path)
print("fresh start")
