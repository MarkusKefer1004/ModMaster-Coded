@echo off
title ModMaster
cd /d "%~dp0"
if not exist "electron\electron.exe" (
    echo Downloading Electron (~80MB, one time only)...
    ping -n 1 github.com >nul 2>&1
    if errorlevel 1 (echo No internet. & pause & exit)
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/electron/electron/releases/download/v28.3.3/electron-v28.3.3-win32-x64.zip' -OutFile 'electron-temp.zip' -UseBasicParsing"
    if not exist "electron-temp.zip" (echo Download failed. Run FIX-ELECTRON.bat. & pause & exit)
    if not exist "electron" mkdir electron
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path 'electron-temp.zip' -DestinationPath 'electron' -Force"
    del electron-temp.zip
)
start "" "electron\electron.exe" "app"
