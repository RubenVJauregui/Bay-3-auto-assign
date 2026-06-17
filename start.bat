@echo off
echo ======================================
echo   Bay 5 Dashboard - Valley View (LT_F1)
echo ======================================
echo.
echo Installing dependencies...
call npm install
echo.
echo Building...
call npm run build
echo.
echo Starting server on http://localhost:3000
echo Press Ctrl+C to stop.
npm run start
