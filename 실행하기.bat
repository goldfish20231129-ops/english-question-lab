@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if not errorlevel 1 (
  set "NODE_CMD=node"
) else if exist "C:\Users\KMG\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  set "NODE_CMD=C:\Users\KMG\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
) else (
  echo.
  echo Node.js was not found.
  echo Install the LTS release from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo.
  echo Required packages are missing.
  echo Run npm install in PowerShell, then try again.
  echo.
  pause
  exit /b 1
)

echo Starting Problem Making Lab.
echo Keep this window open, then visit http://127.0.0.1:5173 in your browser.
echo.
"%NODE_CMD%" "node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 5173

pause
