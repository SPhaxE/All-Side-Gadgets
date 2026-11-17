@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch_claude_safe.ps1"
if errorlevel 1 pause
