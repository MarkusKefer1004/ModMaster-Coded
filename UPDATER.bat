@echo off
title ModMaster Updater
cd /d "%~dp0"
color 0A
echo.
echo ModMaster Updater
echo.
echo Where are your downloaded files?
echo 1. Downloads folder (default)
echo 2. Same folder as this bat file
set /p CHOICE=Enter 1 or 2: 
if "%CHOICE%"=="2" (set DL=%~dp0) else (set DL=%USERPROFILE%\Downloads)
echo.
echo Looking in: %DL%
echo.
set APP=%~dp0app
set RENDERER=%~dp0app\renderer
if not exist "%APP%" mkdir "%APP%"
if not exist "%RENDERER%" mkdir "%RENDERER%"
set FOUND=0
for %%F in (LAUNCH.bat FIX-ELECTRON.bat DEBUG.bat) do (if exist "%DL%\%%F" (copy /Y "%DL%\%%F" "%~dp0%%F" >nul & echo [OK] %%F & set /A FOUND+=1))
for %%F in (main.js preload.js package.json) do (if exist "%DL%\%%F" (copy /Y "%DL%\%%F" "%APP%\%%F" >nul & echo [OK] %%F & set /A FOUND+=1))
for %%F in (electron-bridge.js theme.js sidebar.js game-selector.js tutorial.js modmaster.html modmaster-create.html modmaster-update.html modmaster-rework.html modmaster-hub.html modmaster-settings.html modmaster-tools.html) do (if exist "%DL%\%%F" (copy /Y "%DL%\%%F" "%RENDERER%\%%F" >nul & echo [OK] %%F & set /A FOUND+=1))
echo.
if %FOUND%==0 (
    echo No files found. Try option 2 if files are in the same folder.
) else (
    echo %FOUND% file(s) updated! Run LAUNCH.bat to open ModMaster.
)
echo.
pause
