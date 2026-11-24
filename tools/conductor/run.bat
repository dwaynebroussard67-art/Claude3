@echo off
REM Start the Universal AI Conductor on Windows.
REM   run.bat          -> native window if pywebview installed, else browser
REM   run.bat serve    -> server only
cd /d "%~dp0"
if "%1"=="serve" (
  python server.py
) else (
  python desktop.py
)
pause
