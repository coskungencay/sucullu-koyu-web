@echo off
setlocal
rem Kurulum ONCESI mutasyonsuz kontrol. Yonetici GEREKMEZ.
rem Sisteme kalici degisiklik yapmaz; yalnizca paket klasorune yazar.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preflight.ps1" -Run
set RC=%ERRORLEVEL%
echo.
if "%RC%"=="0" (
  echo Sonuc: PRE-FLIGHT PASS  --^> install.cmd dosyasini yonetici olarak calistirabilirsiniz.
) else (
  echo Sonuc: PRE-FLIGHT FAIL  --^> kuruluma gecmeyin.
)
pause
exit /b %RC%
