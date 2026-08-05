# Sucullu Koyu kamera relay — PRE-FLIGHT (mutasyonsuz dogrulama)
#
# Kullanim:
#   preflight.ps1 -Run            tam kontrol + kisa dry-run (preflight.cmd bunu cagirir)
#   preflight.ps1 -EnsureFfmpeg   yalnizca pinli FFmpeg'i indirip dogrular (install.cmd kullanir)
#
# YAPMAZ: Windows servisi/scheduled task olusturmaz, registry/firewall/sistem
# ayari degistirmez, NVR'a yonetim komutu gondermez.
# YAZAR: yalnizca paket klasoru (ffmpeg\ ve logs\preflight.log).
# Secret degerleri (NVR parolasi, SRT passphrase) ekrana/loga YAZILMAZ.

param(
    [switch]$Run,
    [switch]$EnsureFfmpeg,
    [int]$DryRunSeconds = 20
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $Root 'logs'
$ConfigFile = Join-Path $Root 'config.env'
$RelayPs1 = Join-Path $Root 'relay.ps1'
$FfmpegDir = Join-Path $Root 'ffmpeg'
$FfmpegExe = Join-Path $FfmpegDir 'bin\ffmpeg.exe'
$FfprobeExe = Join-Path $FfmpegDir 'bin\ffprobe.exe'

# --- Pinli FFmpeg (SRT destegi bu build'de dogrulandi; hash sabittir) ---
$FfmpegUrl = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-08-04-21-26/ffmpeg-n7.1.5-12-g1fdbca85aa-win64-gpl-7.1.zip'
$FfmpegSha256 = 'a2c27f95a269f7a1ec8a6c83e911e8a5626c8871a3ed5000a8ed14030dd21d58'

$script:Failures = 0
$script:Checks = @()

function Write-Log([string]$line) {
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
    Add-Content -Path (Join-Path $LogDir 'preflight.log') -Value ("[{0}] {1}" -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $line) -Encoding UTF8
}

function Step([string]$name, [bool]$ok, [string]$detail = '') {
    $status = if ($ok) { 'OK  ' } else { 'FAIL' }
    $line = "$status $name"
    if ($detail) { $line += " -- $detail" }
    Write-Output $line
    Write-Log $line
    $script:Checks += [pscustomobject]@{ Name = $name; Ok = $ok }
    if (-not $ok) { $script:Failures++ }
}

function Mask([string]$text, $cfg) {
    if ($null -eq $text) { return '' }
    $out = $text
    if ($cfg) {
        foreach ($k in @('NVR_PASSWORD', 'SRT_PASSPHRASE', 'NVR_USER')) {
            $v = $cfg[$k]
            if ($v) {
                $out = $out.Replace($v, '***')
                $out = $out.Replace([uri]::EscapeDataString($v), '***')
            }
        }
    }
    return $out
}

function Get-Config {
    $cfg = @{}
    foreach ($line in Get-Content $ConfigFile) {
        $t = $line.Trim()
        if ($t -eq '' -or $t.StartsWith('#')) { continue }
        $i = $t.IndexOf('=')
        if ($i -lt 1) { continue }
        $cfg[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
    }
    return $cfg
}

function Test-TcpPort([string]$targetHost, [int]$port, [int]$timeoutMs = 5000) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect($targetHost, $port, $null, $null)
        $ok = $async.AsyncWaitHandle.WaitOne($timeoutMs, $false) -and $client.Connected
        $client.Close()
        return $ok
    } catch {
        return $false
    }
}

function Install-PinnedFfmpeg {
    if (Test-Path $FfmpegExe) { return $true }
    Write-Output 'FFmpeg (pinli surum) indiriliyor... bu birkac dakika surebilir.'
    $zip = Join-Path $Root 'ffmpeg-pinned.zip'
    $tmp = Join-Path $Root 'ffmpeg-tmp'
    try {
        $ProgressPreference = 'SilentlyContinue'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $FfmpegUrl -OutFile $zip -UseBasicParsing
        $got = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
        if ($got -ne $FfmpegSha256.ToLower()) {
            Remove-Item -Force $zip
            Write-Output "HASH UYUSMUYOR (beklenen $FfmpegSha256, bulunan $got) - indirme reddedildi."
            return $false
        }
        if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
        Expand-Archive -Path $zip -DestinationPath $tmp -Force
        $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
        if (Test-Path $FfmpegDir) { Remove-Item -Recurse -Force $FfmpegDir }
        Move-Item $inner.FullName $FfmpegDir
        Remove-Item -Recurse -Force $tmp
        Remove-Item -Force $zip
        return (Test-Path $FfmpegExe)
    } catch {
        Write-Output ("FFmpeg indirilemedi: " + $_.Exception.Message)
        return $false
    }
}

if ($EnsureFfmpeg) {
    if (Install-PinnedFfmpeg) { exit 0 } else { exit 1 }
}

if (-not $Run) {
    Write-Output 'Kullanim: preflight.ps1 -Run   (veya preflight.cmd)'
    exit 0
}

Write-Output ''
Write-Output '===== SUCULLU KAMERA RELAY - PRE-FLIGHT ====='
Write-Output '(Bu kontrol sisteme hicbir kalici degisiklik yapmaz.)'
Write-Output ''
Write-Log '--- preflight basladi ---'

# 1) PowerShell 5.1+ uyumlulugu
$psv = $PSVersionTable.PSVersion
Step 'Windows PowerShell 5.1+ ' ($psv.Major -gt 5 -or ($psv.Major -eq 5 -and $psv.Minor -ge 1)) "surum $psv"

# 2) Paket butunlugu
$required = @('relay.ps1', 'install.cmd', 'uninstall.cmd', 'start.cmd', 'stop.cmd', 'status.cmd', 'config.env.example')
$missing = @($required | Where-Object { -not (Test-Path (Join-Path $Root $_)) })
Step 'Paket dosyalari tam' ($missing.Count -eq 0) $(if ($missing.Count) { "eksik: $($missing -join ', ')" } else { "$($required.Count) dosya" })

# 3) relay.ps1 sozdizimi (PowerShell parser)
$parseErrors = $null
try {
    [System.Management.Automation.Language.Parser]::ParseFile($RelayPs1, [ref]$null, [ref]$parseErrors) | Out-Null
    $parseOk = ($null -eq $parseErrors -or $parseErrors.Count -eq 0)
} catch {
    $parseOk = $false
}
Step 'relay.ps1 sozdizimi gecerli' $parseOk $(if (-not $parseOk -and $parseErrors) { $parseErrors[0].Message } else { '' })
if (-not $parseOk) {
    Write-Output ''
    Write-Output 'PRE-FLIGHT FAIL - relay.ps1 hatali; kuruluma GECMEYIN.'
    exit 1
}

# 4) config.env
$cfg = $null
if (-not (Test-Path $ConfigFile)) {
    Step 'config.env mevcut' $false 'config.env.example dosyasini config.env olarak kopyalayip doldurun'
} else {
    $cfg = Get-Config
    $needed = @('NVR_HOST', 'NVR_PORT', 'NVR_USER', 'NVR_PASSWORD', 'SRT_HOST', 'SRT_PORT', 'SRT_PASSPHRASE')
    $empty = @($needed | Where-Object { -not $cfg.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($cfg[$_]) })
    Step 'config.env mevcut' $true
    # Alan ADLARI raporlanir; DEGERLER asla yazilmaz.
    Step 'config.env zorunlu alanlar dolu' ($empty.Count -eq 0) $(if ($empty.Count) { "bos alan: $($empty -join ', ')" } else { "$($needed.Count) alan" })
    if ($cfg['SRT_PASSPHRASE'] -and $cfg['SRT_PASSPHRASE'].Length -lt 10) {
        Step 'SRT passphrase uzunlugu (>=10)' $false 'SRT protokolu en az 10 karakter ister'
    }
}

# 5) FFmpeg (pinli + hash dogrulamali)
$ffOk = Install-PinnedFfmpeg
Step 'FFmpeg mevcut (pinli surum, SHA-256 dogrulandi)' $ffOk $(if ($ffOk) { 'ffmpeg\bin\ffmpeg.exe' } else { 'indirilemedi/hash uyusmadi' })

# 6) FFmpeg SRT protokol destegi
if ($ffOk) {
    $protocols = & $FfmpegExe -hide_banner -protocols 2>&1 | Out-String
    $srtOk = $protocols -match '(?m)^\s*srt\s*$'
    Step 'FFmpeg SRT protokolu destekli' $srtOk $(if (-not $srtOk) { 'bu build SRT icermiyor' } else { '' })
} else {
    Step 'FFmpeg SRT protokolu destekli' $false 'ffmpeg yok'
}

# 7) NVR erisimi (yalnizca TCP baglanti denemesi; komut gonderilmez)
if ($cfg -and $cfg['NVR_HOST']) {
    $nvrOk = Test-TcpPort $cfg['NVR_HOST'] ([int]$cfg['NVR_PORT']) 5000
    Step "NVR RTSP portu erisilebilir ($($cfg['NVR_HOST']):$($cfg['NVR_PORT']))" $nvrOk $(if (-not $nvrOk) { 'NVR kapali/ag erisimi yok/port farkli' } else { '' })
} else {
    Step 'NVR RTSP portu erisilebilir' $false 'config.env okunamadi'
}

# 8) SRT hedefi hazirligi (DNS + UDP soket; UDP yaniti beklenmez)
if ($cfg -and $cfg['SRT_HOST']) {
    $dnsOk = $false
    try {
        [System.Net.Dns]::GetHostAddresses($cfg['SRT_HOST']) | Out-Null
        $dnsOk = $true
    } catch { $dnsOk = $false }
    Step "SRT sunucu adresi cozumleniyor ($($cfg['SRT_HOST']))" $dnsOk
    try {
        $udp = New-Object System.Net.Sockets.UdpClient
        $udp.Connect($cfg['SRT_HOST'], [int]$cfg['SRT_PORT'])
        $udp.Close()
        Step "UDP $($cfg['SRT_PORT']) soketi hazir (gercek dogrulama dry-run'da)" $true
    } catch {
        Step "UDP $($cfg['SRT_PORT']) soketi hazir" $false $_.Exception.Message
    }
}

# 9) Dry-run: YALNIZCA kamera1, foreground, kisa sureli
$dryRunOk = $false
if ($script:Failures -eq 0 -and $cfg) {
    Write-Output ''
    Write-Output "Dry-run: kamera1 icin $DryRunSeconds saniyelik test yayini (yalnizca okuma)..."
    $u = [uri]::EscapeDataString($cfg['NVR_USER'])
    $p = [uri]::EscapeDataString($cfg['NVR_PASSWORD'])
    $rtsp = "rtsp://${u}:${p}@$($cfg['NVR_HOST']):$($cfg['NVR_PORT'])/Preview_01_sub"

    $codecRaw = & $FfprobeExe -v error -rtsp_transport tcp -rw_timeout 15000000 -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 $rtsp 2>&1 | Out-String
    $codec = ($codecRaw -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^[a-z0-9]+$' } | Select-Object -First 1)
    if ($codec) {
        Step "NVR kanal 01 okunabiliyor (codec: $codec)" $true
    } else {
        Step 'NVR kanal 01 okunabiliyor' $false (Mask ($codecRaw.Trim()) $cfg)
    }

    if ($codec) {
        $pp = [uri]::EscapeDataString($cfg['SRT_PASSPHRASE'])
        $sid = [uri]::EscapeDataString('#!::m=publish,r=kamera1')
        $srt = "srt://$($cfg['SRT_HOST']):$($cfg['SRT_PORT'])?mode=caller&latency=2000&pkt_size=1316&passphrase=${pp}&streamid=${sid}"
        $vArgs = if ($codec -eq 'h264') { @('-c:v', 'copy') } else { @('-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-r', '10', '-g', '20', '-b:v', '700k', '-pix_fmt', 'yuv420p') }
        $errFile = Join-Path $LogDir 'preflight-dryrun.err'
        $args = @('-hide_banner', '-loglevel', 'error', '-nostats', '-rtsp_transport', 'tcp', '-rw_timeout', '15000000',
                  '-i', $rtsp, '-map', '0:v:0', '-map', '0:a?') + $vArgs + @('-c:a', 'aac', '-b:a', '64k', '-ac', '1',
                  '-muxdelay', '0.1', '-f', 'mpegts', $srt)
        $proc = Start-Process -FilePath $FfmpegExe -ArgumentList $args -WindowStyle Hidden -PassThru -RedirectStandardError $errFile
        $elapsed = 0
        while (-not $proc.HasExited -and $elapsed -lt $DryRunSeconds) { Start-Sleep -Seconds 1; $elapsed++ }
        if (-not $proc.HasExited) {
            # Temiz kapanis: once nazikce, gerekirse zorla
            & taskkill /PID $proc.Id /T /F 2>$null | Out-Null
            Start-Sleep -Seconds 1
            $dryRunOk = $true
            Step "Dry-run: SRT yayini $DryRunSeconds sn kesintisiz surdu" $true 'FFmpeg temiz kapatildi'
        } else {
            $err = if (Test-Path $errFile) { (Get-Content $errFile -Tail 5) -join ' | ' } else { '' }
            Step 'Dry-run: SRT yayini' $false (Mask $err $cfg)
        }
        if (Test-Path $errFile) { Remove-Item -Force $errFile }
    }

    if ($dryRunOk) {
        Write-Output ''
        Write-Output 'Sunucuda dogrulayin (yayin dry-run sirasinda aciktir):'
        Write-Output '  https://sucullu-koyu-camera.46.225.123.167.sslip.io/kamera1/index.m3u8  -> 200'
    }
} else {
    Write-Output ''
    Write-Output 'Onceki kontroller basarisiz oldugu icin dry-run atlandi.'
}

# --- Sonuc ---
Write-Output ''
Write-Output '============================================='
if ($script:Failures -eq 0) {
    Write-Output 'PRE-FLIGHT PASS'
    Write-Output 'Simdi install.cmd dosyasini YONETICI olarak calistirabilirsiniz.'
    Write-Log 'PRE-FLIGHT PASS'
    Write-Output '============================================='
    exit 0
} else {
    Write-Output "PRE-FLIGHT FAIL ($($script:Failures) kontrol basarisiz)"
    Write-Output 'Kuruluma GECMEYIN; yukaridaki FAIL satirlarini duzeltin.'
    Write-Log "PRE-FLIGHT FAIL ($($script:Failures))"
    Write-Output '============================================='
    exit 1
}
