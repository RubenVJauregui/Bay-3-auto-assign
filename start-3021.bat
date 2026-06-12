@echo off
setlocal
cd /d "%~dp0"
title Bay 3 Auto Assign Dashboard - Local 3021

echo ========================================
echo   Bay 3 Auto Assign Dashboard
echo   Local URL: http://localhost:3021
echo ========================================
echo.

if not exist .env.local (
  echo Creating .env.local from .env.example...
  copy .env.example .env.local >nul
)

echo Cleaning old builds...
if exist .next rmdir /s /q .next
if exist out rmdir /s /q out

echo Installing dependencies if needed...
call npm install
if errorlevel 1 (
  echo.
  echo Failed to install dependencies. Make sure Node.js 20+ is installed.
  pause
  exit /b 1
)

echo.
echo Building dashboard from current source...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Please send a screenshot of this window.
  pause
  exit /b 1
)

echo.
echo Starting dashboard at http://localhost:3021
echo Keep this window open while using the dashboard.
echo Press Ctrl+C in this window to stop it.
echo.
start "" "http://localhost:3021"
call npx next start -H 0.0.0.0 -p 3021
pause
