@echo off
title ModMaster - Build installer
cd /d "%~dp0"
echo ============================================================
echo   ModMaster packager
echo   Produces a real installer + a portable .exe in  dist\
echo ============================================================
echo.
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js / npm is not installed.
  echo Install it from https://nodejs.org  then run this again.
  pause & exit /b 1
)
echo Installing build tools (first run only, downloads ~200MB)...
call npm install
if errorlevel 1 (echo. & echo npm install failed. & pause & exit /b 1)
echo.
echo Building ModMaster... (this can take a few minutes)
call npm run dist
if errorlevel 1 (echo. & echo Build failed - see the messages above. & pause & exit /b 1)
echo.
echo ============================================================
echo   Done!  Look in the  dist\  folder:
echo     - ModMaster Setup 2.0.0.exe      (installer)
echo     - ModMaster-Portable-2.0.0.exe   (double-click, no install)
echo ============================================================
pause
