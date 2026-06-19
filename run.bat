@echo off
title DeezPDF Reader
cd /d "%~dp0"
node launcher\index.js
if errorlevel 1 (
    echo.
    echo Press any key to exit...
    pause >nul
)
