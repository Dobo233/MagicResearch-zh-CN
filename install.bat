@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Magic Research - Chinese Patch Installer

echo ==================================================
echo    Magic Research - Chinese Localization Patch
echo ==================================================
echo.

set "HERE=%~dp0"
set "GAME=%~1"
set "NODE="

where node >nul 2>nul && set "NODE=node"

if not defined NODE for %%d in (C D E F G H I J) do call :probe "%%d"

if not defined NODE (
  echo [X] Node runtime not found.
  echo     Please install Node.js from https://nodejs.org/ and run again.
  echo.
  pause
  exit /b 1
)

set "ELECTRON_NO_ASAR=1"
set "ELECTRON_RUN_AS_NODE=1"
"%NODE%" "%HERE%patch\patch.js" "%GAME%"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo [X] Failed with exit code %RC%
pause
exit /b %RC%

:probe
if defined NODE exit /b 0
if not "%~1"=="" if exist "%~1\SteamLibrary\steamapps\common\Magic Research\Magic Research.exe" set "NODE=%~1\SteamLibrary\steamapps\common\Magic Research\Magic Research.exe"
if defined NODE exit /b 0
if exist "%~1\Steam\steamapps\common\Magic Research\Magic Research.exe" set "NODE=%~1\Steam\steamapps\common\Magic Research\Magic Research.exe"
if defined NODE exit /b 0
if exist "%~1\Program Files (x86)\Steam\steamapps\common\Magic Research\Magic Research.exe" set "NODE=%~1\Program Files (x86)\Steam\steamapps\common\Magic Research\Magic Research.exe"
if defined NODE exit /b 0
if exist "%~1\Program Files\Steam\steamapps\common\Magic Research\Magic Research.exe" set "NODE=%~1\Program Files\Steam\steamapps\common\Magic Research\Magic Research.exe"
exit /b 0