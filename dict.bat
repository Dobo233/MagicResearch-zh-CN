@echo off
chcp 65001 >nul
setlocal
set "NODE="
where node >nul 2>nul && set "NODE=node"
if not defined NODE for %%p in ("%ProgramFiles%\nodejs\node.exe" "%ProgramFiles(x86)%\nodejs\node.exe" "%LOCALAPPDATA%\Programs\nodejs\node.exe") do if not defined NODE if exist %%p set "NODE=%%p"
if not defined NODE (
  echo [X] Node.js not found. Please install it from https://nodejs.org/
  pause
  exit /b 1
)
if "%~1"=="" (
  echo Usage:
  echo   dict.bat info                      show entry count
  echo   dict.bat find ^<keyword^>           search dictionary
  echo   dict.bat get  "^<english^>"         show one entry
  echo   dict.bat set  "^<english^>" "^<chinese^>"   add or update
  echo   dict.bat rm   "^<english^>"         remove entry ^(keep English^)
  echo   dict.bat setenum ^<EnumId^> "^<chinese^>"  rename a value-as-key enum
  echo.
  pause
  exit /b 0
)
"%NODE%" "%~dp0tools\dict.js" %*
echo.
pause