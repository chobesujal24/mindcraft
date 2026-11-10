@echo off
cd /d "%~dp0"
start "OpenCode CLI Shim" /min cmd /c "node tools\opencode-shim\server.mjs"
timeout /t 2 /nobreak >nul
npm start
