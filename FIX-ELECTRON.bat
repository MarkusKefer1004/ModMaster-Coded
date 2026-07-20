@echo off
title Fix Electron
cd /d "%~dp0"
echo Downloading Electron (~80MB)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/electron/electron/releases/download/v28.3.3/electron-v28.3.3-win32-x64.zip' -OutFile 'electron-temp.zip' -UseBasicParsing"
if not exist "electron-temp.zip" (echo Download failed. & pause & exit)
if not exist "electron" mkdir electron
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path 'electron-temp.zip' -DestinationPath 'electron' -Force"
del electron-temp.zip
if exist "electron\electron.exe" (echo Success! Run LAUNCH.bat.) else (echo Something went wrong.)
echo.
pause
