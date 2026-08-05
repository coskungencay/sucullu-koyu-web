@echo off
setlocal EnableExtensions
rem Sucullu Koyu kamera relay kurulumu — "Yonetici olarak calistir" gerekir.
rem   install.cmd            normal kurulum
rem   install.cmd /dryrun    hicbir sey degistirmeden dogrulama (CI icin)
cd /d "%~dp0"

set "DRYRUN="
if /i "%~1"=="/dryrun" set "DRYRUN=1"

if not defined DRYRUN (
  net session >nul 2>&1
  if errorlevel 1 (
    echo HATA: Bu dosyaya sag tiklayip "Yonetici olarak calistir" secin.
    pause & exit /b 1
  )
)

if not exist "preflight.ps1" ( echo HATA: preflight.ps1 eksik. & exit /b 1 )
if not exist "relay.ps1" ( echo HATA: relay.ps1 eksik. & exit /b 1 )

if not defined DRYRUN (
  if not exist "config.env" (
    echo HATA: config.env bulunamadi.
    echo config.env.example dosyasini "config.env" olarak kopyalayip doldurun.
    pause & exit /b 1
  )
)

if not exist "logs" mkdir logs
if not exist "state" mkdir state

rem --- relay.ps1 sozdizimi (kurulumdan once son kontrol) ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$e=$null; [System.Management.Automation.Language.Parser]::ParseFile('%~dp0relay.ps1',[ref]$null,[ref]$e) | Out-Null; if($e -and $e.Count -gt 0){ Write-Output $e[0].Message; exit 1 }"
if errorlevel 1 ( echo HATA: relay.ps1 sozdizimi hatali; kurulum iptal. & if not defined DRYRUN pause & exit /b 1 )

if defined DRYRUN (
  echo [DRYRUN] FFmpeg indirme atlandi.
  echo [DRYRUN] Olusturulacak gorev: SucculluKameraRelay ^(ONSTART, SYSTEM, HIGHEST^)
  echo [DRYRUN] Komut: powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0relay.ps1" -Supervisor
  echo [DRYRUN] Sistem degisikligi YAPILMADI.
  exit /b 0
)

rem --- FFmpeg (pinli surum + SHA-256; tek kaynak preflight.ps1) ---
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preflight.ps1" -EnsureFfmpeg
if errorlevel 1 ( echo HATA: FFmpeg kurulamadi/dogrulanamadi. & pause & exit /b 1 )

rem --- Onceki kurulumu temizle (idempotent) ---
schtasks /End /TN "SucculluKameraRelay" >nul 2>&1
schtasks /Delete /F /TN "SucculluKameraRelay" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -match 'relay\.ps1' -and $_.ProcessId -ne $PID } | ForEach-Object { taskkill /PID $_.ProcessId /T /F } " >nul 2>&1

rem --- Acilista otomatik baslayan gorev (oturum acilmasa da SYSTEM olarak) ---
schtasks /Create /F /TN "SucculluKameraRelay" /SC ONSTART /RU SYSTEM /RL HIGHEST ^
  /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%~dp0relay.ps1\" -Supervisor"
if errorlevel 1 ( echo HATA: Gorev olusturulamadi. & pause & exit /b 1 )

echo Gorev olusturuldu; relay simdi baslatiliyor...
schtasks /Run /TN "SucculluKameraRelay" >nul
timeout /t 5 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0relay.ps1" -Status
echo.
echo KURULUM TAMAM. Durum icin status.cmd, durdurmak icin stop.cmd kullanin.
pause
