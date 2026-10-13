@echo off
setlocal
set "APP=%~dp0server\app.py"
set "BUNDLED_PY=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if exist "%BUNDLED_PY%" (
  "%BUNDLED_PY%" -u "%APP%"
  goto :done
)

where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%APP%"
  if not errorlevel 1 goto :done
)

where python >nul 2>nul
if not errorlevel 1 (
  python "%APP%"
  goto :done
)

echo Python 3 was not found. Install Python or use the Codex bundled runtime.
pause

:done
endlocal
