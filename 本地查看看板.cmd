@echo off
setlocal
cd /d "%~dp0"
title Work Order Dashboard - Local Preview
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local-preview.ps1"
if errorlevel 1 (
  echo.
  echo Local preview could not be started.
  pause
)
endlocal
