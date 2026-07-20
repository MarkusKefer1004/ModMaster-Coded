@echo off
title ModMaster DEBUG
cd /d "%~dp0"
echo.
echo Checking files...
if exist "app\main.js" (echo [OK] main.js) else (echo [MISSING] main.js)
if exist "electron\electron.exe" (echo [OK] electron.exe) else (echo [MISSING] electron.exe)
if exist "app\renderer\modmaster.html" (echo [OK] modmaster.html) else (echo [MISSING] modmaster.html)
if exist "app\renderer\theme.js" (echo [OK] theme.js) else (echo [MISSING] theme.js)
if exist "app\renderer\sidebar.js" (echo [OK] sidebar.js) else (echo [MISSING] sidebar.js)
echo.
electron\electron.exe app --enable-logging
echo.
echo Closed. Scroll up for errors.
pause
