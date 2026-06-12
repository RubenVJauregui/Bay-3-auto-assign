@echo off
setlocal
cd /d "%~dp0"
title Bay 3 Auto Assign Dashboard

echo ========================================
echo   Bay 3 Auto Assign Dashboard
 echo ========================================
echo.
echo Installing dependencies if needed...
call npm install
if errorlevel 1 (
  echo.
  echo Failed to install dependencies. Make sure Node.js is installed.
  pause
  exit /b 1
)

echo.
echo Building dashboard...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Please send a screenshot of this window.
  pause
  exit /b 1
)

echo.
echo Starting dashboard at http://localhost:3000
echo Keep this window open while using the dashboard.
echo Press Ctrl+C in this window to stop it.
echo.
start "" "http://localhost:3000"
call npm run start
pause
