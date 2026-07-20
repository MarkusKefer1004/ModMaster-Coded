@echo off
title ModMaster
cd /d "%~dp0"
if not exist "electron\electron.exe" (echo Run START.bat first. & pause & exit)
start "" "electron\electron.exe" "app"
