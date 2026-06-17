@echo off
setlocal
cd /d "%~dp0"
title Bay 5 Auto Assign Dashboard - Local 3021
if not exist .env.local copy .env.example .env.local >nul
if exist .next rmdir /s /q .next
call npm install
if errorlevel 1 pause & exit /b 1
call npm run build
if errorlevel 1 pause & exit /b 1
start "" "http://localhost:3021"
call npx next start -H 0.0.0.0 -p 3021
pause
