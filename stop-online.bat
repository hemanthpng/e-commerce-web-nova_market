@echo off
title Stop NovaMart
echo Stopping NovaMart and cloudflared processes...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1
echo NovaMart server and online tunnel have been stopped.
pause
