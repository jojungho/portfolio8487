@echo off
setlocal
set "PORTFOLIO_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%PORTFOLIO_NODE%" (
  "%PORTFOLIO_NODE%" "%~dp0preview-server.mjs" %*
) else (
  node "%~dp0preview-server.mjs" %*
)
if errorlevel 1 pause
