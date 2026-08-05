@echo off
setlocal
rem Kaldirma — "Yonetici olarak calistir" gerekir. Idempotenttir.
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 ( echo HATA: Yonetici olarak calistirin. & pause & exit /b 1 )

if not exist "state" mkdir state
echo stop > "state\stop.flag"
timeout /t 5 /nobreak >nul
schtasks /End /TN "SucculluKameraRelay" >nul 2>&1
schtasks /Delete /F /TN "SucculluKameraRelay" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -match 'relay\.ps1' } | ForEach-Object { taskkill /PID $_.ProcessId /T /F } " >nul 2>&1
powershell -NoProfile -Command "Get-Process ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force" >nul 2>&1
if exist "state\stop.flag" del /q "state\stop.flag"
echo Kaldirildi. (config.env, logs\ ve ffmpeg\ klasoru yerinde birakildi.)
echo Tamamen silmek icin bu klasoru silebilirsiniz.
pause
