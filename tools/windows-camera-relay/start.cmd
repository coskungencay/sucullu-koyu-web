@echo off
setlocal
cd /d "%~dp0"
schtasks /Query /TN "SucculluKameraRelay" >nul 2>&1
if errorlevel 1 (
  echo Gorev kurulu degil; once install.cmd calistirin.
  pause & exit /b 1
)
if exist "state\stop.flag" del /q "state\stop.flag"
schtasks /Run /TN "SucculluKameraRelay"
echo Relay baslatildi. Durum: status.cmd
pause
