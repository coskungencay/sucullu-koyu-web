# Windows relay config/parser birim testleri (Pester bagimliligi yok).
# CI: windows-latest uzerinde calisir. Hicbir sistem degisikligi yapmaz.
# Gercek secret kullanmaz; sentetik degerlerle calisir.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$RelayDir = Join-Path $Root 'tools\windows-camera-relay'
$RelayPs1 = Join-Path $RelayDir 'relay.ps1'

$script:Fail = 0
function Assert([string]$name, [bool]$cond, [string]$detail = '') {
    if ($cond) {
        Write-Output "OK   $name"
    } else {
        Write-Output "FAIL $name $detail"
        $script:Fail++
    }
}

# relay.ps1'i parametresiz dot-source etmek fonksiyonlari yukler
# (dosya sonundaki dallanma yalnizca kullanim metni yazar).
. $RelayPs1 | Out-Null

Write-Output '--- CameraMap sozlesmesi ---'
$expected = [ordered]@{
    'kamera1' = '01'; 'kamera2' = '02'; 'kamera6' = '04'; 'kamera5' = '05'
    'kamera7' = '07'; 'kamera8' = '08'; 'kamera11' = '11'; 'kamera10' = '10'; 'p850' = '12'
}
Assert 'CameraMap 9 kamera icerir' ($CameraMap.Count -eq 9) "bulunan: $($CameraMap.Count)"
foreach ($k in $expected.Keys) {
    Assert "  $k -> Preview_$($expected[$k])_sub" ($CameraMap[$k] -eq $expected[$k]) "bulunan: $($CameraMap[$k])"
}

Write-Output '--- config parser ---'
$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("relaytest-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
try {
    $cfgPath = Join-Path $tmpDir 'config.env'
    @'
# yorum satiri gormezden gelinir

NVR_HOST=192.168.1.113
NVR_PORT=554
NVR_USER=test user
NVR_PASSWORD=p@ss:w/rd#1
SRT_HOST=example.test
SRT_PORT=8890
SRT_PASSPHRASE=0123456789abcdef
'@ | Set-Content -Path $cfgPath -Encoding UTF8

    # Read-Config modul-degiskeni $ConfigFile'i kullanir; test icin gecici olarak degistir
    $origConfigFile = $ConfigFile
    $ConfigFile = $cfgPath
    $cfg = Read-Config
    Assert 'yorum ve bos satirlar atlanir' ($cfg.Count -eq 7) "anahtar sayisi: $($cfg.Count)"
    Assert 'bosluklu deger korunur' ($cfg['NVR_USER'] -eq 'test user')
    Assert 'ozel karakterli parola aynen okunur' ($cfg['NVR_PASSWORD'] -eq 'p@ss:w/rd#1')

    Write-Output '--- URL uretimi ---'
    $rtsp = Get-RtspUrl $cfg '01'
    Assert 'RTSP substream kalibi' ($rtsp -like '*/Preview_01_sub')
    Assert 'RTSP credential URL-encode edilir' ($rtsp -like '*test%20user:p%40ss%3Aw%2Frd%231@*') $rtsp.Replace($cfg['NVR_PASSWORD'], '***')
    Assert 'RTSP ham parola icermez' (-not $rtsp.Contains('p@ss:w/rd#1'))

    $srt = Get-SrtUrl $cfg 'kamera1'
    Assert 'SRT caller modu + latency' ($srt -like '*mode=caller*' -and $srt -like '*latency=2000*')
    # Escape detayina degil, DECODE edilmis degere bakilir:
    # .NET EscapeDataString '!' karakterini escape etmez, '%21' de gecerlidir.
    $sidEncoded = if ($srt -match 'streamid=([^&]+)') { $Matches[1] } else { '' }
    $sidDecoded = [uri]::UnescapeDataString($sidEncoded)
    Assert 'SRT streamid MediaMTX sozlesmesi (decode edilmis)' ($sidDecoded -eq '#!::m=publish,r=kamera1') "bulunan: $sidDecoded"
    Assert 'streamid ham bosluk/ayirici icermez' ($sidEncoded -notmatch '[\s&]')
    Assert 'SRT passphrase parametresi var' ($srt -like '*passphrase=*')

    Write-Output '--- secret maskeleme ---'
    $masked = Mask-Secrets "baglanti: $rtsp parola=$($cfg['NVR_PASSWORD']) pp=$($cfg['SRT_PASSPHRASE'])" $cfg
    Assert 'ham parola maskelenir' (-not $masked.Contains('p@ss:w/rd#1'))
    Assert 'URL-encoded parola maskelenir' (-not $masked.Contains('p%40ss%3Aw%2Frd%231'))
    Assert 'SRT passphrase maskelenir' (-not $masked.Contains('0123456789abcdef'))
    Assert 'kullanici adi maskelenir' (-not $masked.Contains('test user'))

    Write-Output '--- eksik alan korumasi ---'
    "NVR_HOST=192.168.1.113" | Set-Content -Path $cfgPath -Encoding UTF8
    $threw = $false
    try { Read-Config | Out-Null } catch { $threw = $true }
    Assert 'eksik zorunlu alanda hata firlatir' $threw

    $ConfigFile = $origConfigFile
} finally {
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}

Write-Output ''
if ($script:Fail -eq 0) {
    Write-Output 'WINDOWS RELAY TESTLERI: TUMU GECTI'
    exit 0
} else {
    Write-Output "WINDOWS RELAY TESTLERI: $($script:Fail) BASARISIZ"
    exit 1
}
