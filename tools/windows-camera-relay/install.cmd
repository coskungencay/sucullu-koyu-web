@echo off
setlocal EnableExtensions
rem Sucullu Koyu kamera relay kurulumu — "Yonetici olarak calistir" gerekir.
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo HATA: Bu dosyaya sag tiklayip "Yonetici olarak calistir" secin.
  pause & exit /b 1
)

if not exist "config.env" (
  echo HATA: config.env bulunamadi.
  echo config.env.example dosyasini "config.env" olarak kopyalayip doldurun.
  pause & exit /b 1
)

if not exist "logs" mkdir logs
if not exist "state" mkdir state

rem --- FFmpeg (pinli surum + SHA-256 dogrulama) ---
set "FFVER=7.1.1"
set "FFZIP=ffmpeg-%FFVER%-essentials_build.zip"
set "FFURL=https://www.gyan.dev/ffmpeg/builds/packages/%FFZIP%"
if exist "ffmpeg\bin\ffmpeg.exe" (
  echo FFmpeg zaten kurulu, indirme atlaniyor.
  goto :task
)
echo FFmpeg %FFVER% indiriliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ProgressPreference='SilentlyContinue';" ^
  "Invoke-WebRequest -Uri '%FFURL%' -OutFile '%FFZIP%';" ^
  "Invoke-WebRequest -Uri '%FFURL%.sha256' -OutFile '%FFZIP%.sha256'"
if errorlevel 1 ( echo HATA: FFmpeg indirilemedi. Internet baglantisini kontrol edin. & pause & exit /b 1 )

echo SHA-256 dogrulaniyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$want=(Get-Content '%FFZIP%.sha256' -Raw).Trim().Split(' ')[0].ToLower();" ^
  "$got=(Get-FileHash '%FFZIP%' -Algorithm SHA256).Hash.ToLower();" ^
  "if($want -ne $got){ Write-Error ('HASH UYUSMUYOR: beklenen '+$want+' bulunan '+$got); exit 1 };" ^
  "Write-Output ('SHA-256 dogru: '+$got)"
if errorlevel 1 ( echo HATA: FFmpeg hash dogrulamasi basarisiz; kurulum iptal. & del /q "%FFZIP%" & pause & exit /b 1 )

echo Aciliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Expand-Archive -Force '%FFZIP%' 'ffmpeg-tmp';" ^
  "$d=Get-ChildItem 'ffmpeg-tmp' -Directory | Select-Object -First 1;" ^
  "if(Test-Path 'ffmpeg'){Remove-Item 'ffmpeg' -Recurse -Force};" ^
  "Move-Item $d.FullName 'ffmpeg';" ^
  "Remove-Item 'ffmpeg-tmp' -Recurse -Force"
del /q "%FFZIP%" "%FFZIP%.sha256" 2>nul
if not exist "ffmpeg\bin\ffmpeg.exe" ( echo HATA: ffmpeg.exe bulunamadi. & pause & exit /b 1 )

:task
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
