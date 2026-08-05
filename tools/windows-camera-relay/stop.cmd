@echo off
setlocal
cd /d "%~dp0"
if not exist "state" mkdir state
echo stop > "state\stop.flag"
echo Durdurma isareti birakildi; supervisor birkac saniye icinde temiz duracak.
timeout /t 8 /nobreak >nul
rem Hala calisan kalirsa zorla kapat (idempotent)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -match 'relay\.ps1' } | ForEach-Object { taskkill /PID $_.ProcessId /T /F } " >nul 2>&1
powershell -NoProfile -Command "Get-Process ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force" >nul 2>&1
if exist "state\stop.flag" del /q "state\stop.flag"
echo Relay durduruldu.
pause
