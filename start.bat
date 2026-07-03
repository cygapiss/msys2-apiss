@echo off
:: Do not run from the Cursor or VS Code integrated terminal. IDE terminals can
:: put the wrong bash or dash on PATH and break stage2 rebaseall -p.

if not defined CI_TOOLS_ROOT (
  set CI_TOOLS_ROOT=D:\CI-Tools
)

cd /d %~dp0
node scripts/start.ts %*
exit /B %ERRORLEVEL%
