# Sucullu Koyu kamera relay — NVR RTSP -> sifreli SRT (MediaMTX)
# Kullanim (normalde .cmd sargilari uzerinden):
#   relay.ps1 -Supervisor        9 kamerayi yonetir (scheduled task bunu calistirir)
#   relay.ps1 -Worker kamera1    tek kamera icin tek ffmpeg calistirir (ic kullanim)
#   relay.ps1 -Status            durum ozeti yazar
#
# Guvenlik: NVR kullanici adi/parolasi yalnizca config.env icindedir; loglara
# yazilmadan once maskelenir, komut satirinda echo edilmez, Git'e girmez.

param(
    [switch]$Supervisor,
    [string]$Worker = '',
    [switch]$Status
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $Root 'logs'
$StateDir = Join-Path $Root 'state'
$StopFlag = Join-Path $StateDir 'stop.flag'
$ConfigFile = Join-Path $Root 'config.env'
$FfmpegExe = Join-Path $Root 'ffmpeg\bin\ffmpeg.exe'
$FfprobeExe = Join-Path $Root 'ffmpeg\bin\ffprobe.exe'

# HLS path -> NVR kanal eslemesi (KESIN sozlesme; degistirme)
$CameraMap = [ordered]@{
    'kamera1'  = '01'
    'kamera2'  = '02'
    'kamera6'  = '04'
    'kamera5'  = '05'
    'kamera7'  = '07'
    'kamera8'  = '08'
    'kamera11' = '11'
    'kamera10' = '10'
    'p850'     = '12'
}

function Read-Config {
    if (-not (Test-Path $ConfigFile)) {
        throw "config.env bulunamadi: $ConfigFile  (config.env.example dosyasini kopyalayip doldurun)"
    }
    $cfg = @{}
    foreach ($line in Get-Content $ConfigFile) {
        $t = $line.Trim()
        if ($t -eq '' -or $t.StartsWith('#')) { continue }
        $i = $t.IndexOf('=')
        if ($i -lt 1) { continue }
        $cfg[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
    }
    foreach ($k in @('NVR_HOST','NVR_PORT','NVR_USER','NVR_PASSWORD','SRT_HOST','SRT_PORT','SRT_PASSPHRASE')) {
        if (-not $cfg.ContainsKey($k) -or $cfg[$k] -eq '') { throw "config.env eksik alan: $k" }
    }
    return $cfg
}

function Mask-Secrets([string]$text, [hashtable]$cfg) {
    if ($null -eq $text) { return '' }
    $out = $text
    foreach ($s in @($cfg.NVR_PASSWORD, [uri]::EscapeDataString($cfg.NVR_PASSWORD),
                     $cfg.SRT_PASSPHRASE, [uri]::EscapeDataString($cfg.SRT_PASSPHRASE),
                     $cfg.NVR_USER, [uri]::EscapeDataString($cfg.NVR_USER))) {
        if ($s -and $s.Length -gt 0) { $out = $out.Replace($s, '***') }
    }
    return $out
}

function Write-CamLog([string]$cam, [string]$line, [hashtable]$cfg) {
    $log = Join-Path $LogDir "$cam.log"
    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $log -Value "[$stamp] $(Mask-Secrets $line $cfg)" -Encoding UTF8
}

function Rotate-Log([string]$cam) {
    $log = Join-Path $LogDir "$cam.log"
    if ((Test-Path $log) -and ((Get-Item $log).Length -gt 5MB)) {
        for ($i = 2; $i -ge 1; $i--) {
            $src = "$log.$i"; $dst = "$log.$($i + 1)"
            if (Test-Path $src) { Move-Item -Force $src $dst }
        }
        Move-Item -Force $log "$log.1"
    }
}

function Get-RtspUrl([hashtable]$cfg, [string]$channel) {
    $u = [uri]::EscapeDataString($cfg.NVR_USER)
    $p = [uri]::EscapeDataString($cfg.NVR_PASSWORD)
    return "rtsp://${u}:${p}@$($cfg.NVR_HOST):$($cfg.NVR_PORT)/Preview_${channel}_sub"
}

function Get-SrtUrl([hashtable]$cfg, [string]$cam) {
    $pp = [uri]::EscapeDataString($cfg.SRT_PASSPHRASE)
    # MediaMTX SRT streamid sozlesmesi: 'action:pathname'
    # (sunucu logundan dogrulandi; FFmpeg streamid'yi URL-decode ETMEZ,
    # bu yuzden encode edilmemis halde gonderilir).
    return "srt://$($cfg.SRT_HOST):$($cfg.SRT_PORT)?mode=caller&latency=2000&pkt_size=1316&passphrase=${pp}&streamid=publish:${cam}"
}

function Detect-Codec([hashtable]$cfg, [string]$cam, [string]$rtspUrl) {
    # Video codec tespiti (h264 -> stream copy; hevc -> H.264 transcode)
    $out = & $FfprobeExe -v error -rtsp_transport tcp -rw_timeout 15000000 `
        -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 $rtspUrl 2>&1 |
        ForEach-Object { "$_" }
    $codec = ($out | Where-Object { $_ -match '^[a-z0-9]+$' } | Select-Object -First 1)
    foreach ($l in $out) { if ($l -notmatch '^[a-z0-9]+$') { Write-CamLog $cam "ffprobe: $l" $cfg } }
    return $codec
}

function Run-Worker([string]$cam) {
    $cfg = Read-Config
    if (-not $CameraMap.Contains($cam)) { throw "bilinmeyen kamera: $cam" }
    if (-not (Test-Path $FfmpegExe)) { throw "ffmpeg bulunamadi; once install.cmd calistirin" }

    Rotate-Log $cam
    $rtsp = Get-RtspUrl $cfg $CameraMap[$cam]
    $srt = Get-SrtUrl $cfg $cam

    $codec = Detect-Codec $cfg $cam $rtsp
    if (-not $codec) {
        Write-CamLog $cam 'HATA: codec tespit edilemedi (NVR erisimi/parola kontrol edin)' $cfg
        exit 1
    }
    Write-CamLog $cam "baglaniyor (video codec: $codec)" $cfg

    $common = @('-hide_banner', '-loglevel', 'warning', '-nostats',
                '-rtsp_transport', 'tcp', '-rw_timeout', '15000000', '-i', $rtsp,
                '-map', '0:v:0', '-map', '0:a?')
    if ($codec -eq 'h264') {
        $vArgs = @('-c:v', 'copy')
    } else {
        # H.265 vb. -> tarayici uyumlu H.264 (substream ~896x512@10fps hedefi)
        $vArgs = @('-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
                   '-vf', 'scale=896:512:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2',
                   '-r', '10', '-g', '20', '-b:v', '700k', '-maxrate', '900k',
                   '-bufsize', '1400k', '-pix_fmt', 'yuv420p')
    }
    $aArgs = @('-c:a', 'aac', '-b:a', '64k', '-ac', '1')   # ses yoksa -map 0:a? sayesinde sorun olmaz
    $outArgs = @('-muxdelay', '0.1', '-f', 'mpegts', $srt)

    # ffmpeg cikisi maskelenerek loga akar; parola diske asla yazilmaz.
    & $FfmpegExe @common @vArgs @aArgs @outArgs 2>&1 | ForEach-Object {
        Write-CamLog $cam "$_" $cfg
    }
    $code = $LASTEXITCODE
    Write-CamLog $cam "ffmpeg sonlandi (exit=$code)" $cfg
    exit $code
}

function Run-Supervisor {
    New-Item -ItemType Directory -Force -Path $LogDir, $StateDir | Out-Null
    if (Test-Path $StopFlag) { Remove-Item -Force $StopFlag }

    # Tek instance garantisi
    $mutex = New-Object System.Threading.Mutex($false, 'Global\SucculluKameraRelay')
    if (-not $mutex.WaitOne(0)) {
        Write-Output 'Relay zaten calisiyor (mutex); ikinci kopya baslatilmadi.'
        exit 0
    }

    $cfg = Read-Config
    Set-Content -Path (Join-Path $StateDir 'supervisor.pid') -Value $PID
    Write-Output "Supervisor basladi (pid=$PID); 9 kamera yonetiliyor."

    $workers = @{}
    foreach ($cam in $CameraMap.Keys) {
        $workers[$cam] = [pscustomobject]@{
            Process = $null; Fails = 0; NextStart = Get-Date; StartedAt = $null
        }
    }

    try {
        while ($true) {
            if (Test-Path $StopFlag) { break }
            foreach ($cam in $CameraMap.Keys) {
                $w = $workers[$cam]
                if ($w.Process -and -not $w.Process.HasExited) {
                    # 60 sn stabil calisma -> backoff sifirla
                    if ($w.Fails -gt 0 -and ((Get-Date) - $w.StartedAt).TotalSeconds -ge 60) { $w.Fails = 0 }
                    continue
                }
                if ($w.Process) {
                    # dustu -> bounded backoff
                    $w.Fails = [Math]::Min($w.Fails + 1, 8)
                    $delay = [Math]::Min(5 * [Math]::Pow(2, $w.Fails - 1), 300)
                    $w.NextStart = (Get-Date).AddSeconds($delay)
                    $w.Process = $null
                }
                if ((Get-Date) -ge $w.NextStart) {
                    Rotate-Log $cam
                    $w.Process = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -PassThru `
                        -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass',
                                        '-File', (Join-Path $Root 'relay.ps1'), '-Worker', $cam)
                    $w.StartedAt = Get-Date
                    Set-Content -Path (Join-Path $StateDir "$cam.pid") -Value $w.Process.Id
                }
            }
            Start-Sleep -Seconds 3
        }
    } finally {
        Write-Output 'Durduruluyor: worker sureclari sonlandiriliyor...'
        foreach ($cam in $CameraMap.Keys) {
            $w = $workers[$cam]
            if ($w.Process -and -not $w.Process.HasExited) {
                # worker + ffmpeg cocugu birlikte (process tree)
                & taskkill /PID $w.Process.Id /T /F 2>$null | Out-Null
            }
            Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $StateDir "$cam.pid")
        }
        Remove-Item -Force -ErrorAction SilentlyContinue $StopFlag, (Join-Path $StateDir 'supervisor.pid')
        $mutex.ReleaseMutex(); $mutex.Dispose()
        Write-Output 'Relay durdu.'
    }
}

function Show-Status {
    Write-Output '=== Sucullu Kamera Relay Durumu ==='
    $task = schtasks /Query /TN 'SucculluKameraRelay' 2>$null
    Write-Output ("Scheduled task: " + $(if ($LASTEXITCODE -eq 0) { 'KURULU' } else { 'KURULU DEGIL (install.cmd calistirin)' }))
    $supPidFile = Join-Path $StateDir 'supervisor.pid'
    $supRunning = $false
    if (Test-Path $supPidFile) {
        $supPid = Get-Content $supPidFile
        $supRunning = [bool](Get-Process -Id $supPid -ErrorAction SilentlyContinue)
    }
    Write-Output ("Supervisor: " + $(if ($supRunning) { "CALISIYOR (pid=$supPid)" } else { 'DURDU' }))
    foreach ($cam in $CameraMap.Keys) {
        $pidFile = Join-Path $StateDir "$cam.pid"
        $alive = $false
        if (Test-Path $pidFile) {
            $wpid = Get-Content $pidFile
            $alive = [bool](Get-Process -Id $wpid -ErrorAction SilentlyContinue)
        }
        $log = Join-Path $LogDir "$cam.log"
        $last = if (Test-Path $log) { (Get-Content $log -Tail 1) } else { '(log yok)' }
        Write-Output ("{0,-9} {1,-8} {2}" -f $cam, $(if ($alive) { 'AKTIF' } else { 'KAPALI' }), $last)
    }
}

if ($Worker) { Run-Worker $Worker }
elseif ($Supervisor) { Run-Supervisor }
elseif ($Status) { Show-Status }
else {
    Write-Output 'Kullanim: relay.ps1 -Supervisor | -Worker <kamera> | -Status'
}
