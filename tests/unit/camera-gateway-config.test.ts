import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cameras } from '../../src/camera/camera-config';

/**
 * Gateway + relay yapılandırma sözleşme testleri:
 * frontend streamPath seti ↔ MediaMTX path'leri ↔ Windows relay kanal eşlemesi
 * birbirinden kopamaz; secret sızıntısı ve floating sürüm engellenir.
 */

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const EXPECTED_PATHS = [
  'kamera1',
  'kamera2',
  'kamera6',
  'kamera5',
  'kamera7',
  'kamera8',
  'kamera11',
  'kamera10',
  'p850',
];

const EXPECTED_NVR_MAP: Record<string, string> = {
  kamera1: '01',
  kamera2: '02',
  kamera6: '04',
  kamera5: '05',
  kamera7: '07',
  kamera8: '08',
  kamera11: '11',
  kamera10: '10',
  p850: '12',
};

describe('mediamtx.yml sözleşmesi', () => {
  const yml = read('deploy/camera-gateway/mediamtx.yml');

  it('tam olarak 9 path tanımlı ve frontend streamPath seti ile birebir', () => {
    const pathsSection = yml.split(/^paths:\s*$/m)[1] ?? '';
    const defined = [...pathsSection.matchAll(/^ {2}([a-z0-9]+):/gm)].map((m) => m[1]);
    expect(defined).toEqual(EXPECTED_PATHS);
    expect(new Set(defined)).toEqual(new Set(cameras.map((c) => c.streamPath)));
  });

  it('catch-all path yok (all / all_others / ~^ regex)', () => {
    expect(yml).not.toMatch(/^\s{2}all:/m);
    expect(yml).not.toMatch(/^\s{2}all_others:/m);
    expect(yml).not.toMatch(/^\s{2}['"]?~/m);
  });

  it('yalnızca SRT + HLS açık; diğer protokoller, kayıt ve API kapalı', () => {
    for (const line of [
      'api: no',
      'metrics: no',
      'playback: no',
      'rtsp: no',
      'rtmp: no',
      'webrtc: no',
      'moq: no',
      'srt: yes',
      'hls: yes',
      'record: no',
    ]) {
      expect(yml).toContain(line);
    }
  });

  it('config dosyasında gerçek secret yok (env üzerinden gelir)', () => {
    expect(yml).toContain("srtPublishPassphrase: ''");
    expect(yml).toContain('hlsAllowOrigins: []');
  });
});

describe('docker-compose sözleşmesi', () => {
  const compose = read('deploy/camera-gateway/docker-compose.yml');

  it('MediaMTX imajı tam sürüme pinli (Dockerfile); latest yasak', () => {
    const dockerfile = read('deploy/camera-gateway/mediamtx.Dockerfile');
    expect(dockerfile).toMatch(/FROM bluenviron\/mediamtx:\d+\.\d+\.\d+/);
    expect(dockerfile).not.toContain(':latest');
    expect(compose).not.toContain(':latest');
    expect(dockerfile).toContain('COPY mediamtx.yml /mediamtx.yml');
  });

  it('SRT 8890/udp host mapping ve HLS 8888 expose tanımlı', () => {
    expect(compose).toContain('"8890:8890/udp"');
    expect(compose).toContain('"8888"');
    expect(compose).toContain('SERVICE_FQDN_MEDIAMTX_8888');
  });

  it('secretlar zorunlu env olarak geçer; değer repoda yok', () => {
    expect(compose).toMatch(
      /MTX_PATHDEFAULTS_SRTPUBLISHPASSPHRASE=\$\{MTX_PATHDEFAULTS_SRTPUBLISHPASSPHRASE:\?/,
    );
    expect(compose).toMatch(/MTX_HLSALLOWORIGINS=\$\{MTX_HLSALLOWORIGINS:\?/);
  });
});

describe('windows relay sözleşmesi', () => {
  const ps1 = read('tools/windows-camera-relay/relay.ps1');

  it('kanal eşlemesi kesin sözleşmeyle birebir (kamera6→04, p850→12 dahil)', () => {
    for (const [cam, ch] of Object.entries(EXPECTED_NVR_MAP)) {
      const re = new RegExp(`'${cam}'\\s*=\\s*'${ch}'`);
      expect(ps1).toMatch(re);
    }
    const mapCount = [...ps1.matchAll(/'\w+'\s*=\s*'\d{2}'/g)].length;
    expect(mapCount).toBe(9);
  });

  it('RTSP substream kalıbı ve TCP transport + 15 sn timeout kullanılıyor', () => {
    expect(ps1).toContain('Preview_${channel}_sub');
    expect(ps1).toContain("'-rtsp_transport', 'tcp'");
    expect(ps1).toContain("'-rw_timeout', '15000000'");
  });

  it('credential URL-encode ediliyor ve loglar maskeleniyor', () => {
    expect(ps1).toContain('EscapeDataString($cfg.NVR_PASSWORD)');
    expect(ps1).toContain('EscapeDataString($cfg.NVR_USER)');
    expect(ps1).toContain('Mask-Secrets');
  });

  it('SRT çıkışı MediaMTX streamid sözleşmesinde (publish:<path>)', () => {
    // Sunucu logu ile doğrulandı: "stream ID must be 'action:pathname[:query]'"
    expect(ps1).toContain('streamid=publish:${cam}');
    expect(ps1).not.toContain('#!::m=publish');
    expect(ps1).toContain("'-f', 'mpegts'");
    const pf = read('tools/windows-camera-relay/preflight.ps1');
    expect(pf).toContain('streamid=publish:kamera1');
  });

  it('preflight mutasyonsuz: servis/task/registry/firewall değiştirmez', () => {
    const pf = read('tools/windows-camera-relay/preflight.ps1');
    expect(pf).not.toMatch(/schtasks\s+\/Create/i);
    expect(pf).not.toMatch(/New-Service|Set-Service/i);
    expect(pf).not.toMatch(/netsh\s+advfirewall|New-NetFirewallRule/i);
    expect(pf).not.toMatch(/Set-ItemProperty\s+.*HKLM|reg\s+add/i);
    // dry-run tek kamera ve temiz kapanış
    expect(pf).toContain('Preview_01_sub');
    expect(pf).toContain('taskkill /PID $proc.Id /T /F');
    expect(pf).toMatch(/PRE-FLIGHT PASS/);
    expect(pf).toMatch(/PRE-FLIGHT FAIL/);
  });

  it('FFmpeg pini tek kaynakta ve SHA-256 doğrulamalı; install onu kullanır', () => {
    const pf = read('tools/windows-camera-relay/preflight.ps1');
    expect(pf).toMatch(/\$FfmpegSha256 = '[0-9a-f]{64}'/);
    expect(pf).toMatch(
      /FfmpegUrl = 'https:\/\/github\.com\/BtbN\/FFmpeg-Builds\/releases\/download\/autobuild-/,
    );
    expect(pf).toContain('HASH UYUSMUYOR');
    const install = read('tools/windows-camera-relay/install.cmd');
    expect(install).toContain('preflight.ps1" -EnsureFfmpeg');
    // install kendi indirme mantigini tasimaz (tek kaynak)
    expect(install).not.toMatch(/Invoke-WebRequest/);
  });

  it('install/uninstall dry-run sistem değişikliği yapmaz', () => {
    const install = read('tools/windows-camera-relay/install.cmd');
    const uninstall = read('tools/windows-camera-relay/uninstall.cmd');
    for (const s of [install, uninstall]) {
      expect(s).toContain('/dryrun');
      expect(s).toContain('[DRYRUN]');
    }
    // dry-run dalı schtasks satırlarından ÖNCE çıkar
    expect(install.indexOf('[DRYRUN] Sistem degisikligi YAPILMADI')).toBeLessThan(
      install.indexOf('schtasks /Create'),
    );
  });

  it('config.env.example gerçek secret içermiyor', () => {
    const env = read('tools/windows-camera-relay/config.env.example');
    expect(env).toMatch(/^NVR_USER=$/m);
    expect(env).toMatch(/^NVR_PASSWORD=$/m);
    expect(env).toMatch(/^SRT_PASSPHRASE=$/m);
  });
});

describe('frontend sözleşmesi değişmedi', () => {
  it('URL kalıbı {base}/{streamPath}/index.m3u8 ve 9 kamera korunuyor', () => {
    expect(cameras).toHaveLength(9);
    expect(new Set(cameras.map((c) => c.streamPath))).toEqual(new Set(EXPECTED_PATHS));
  });

  it('frontend kaynaklarında NVR IP/credential/SRT izi yok', () => {
    const files = [
      'src/camera/camera-config.ts',
      'src/camera/camera-url.ts',
      'src/camera/camera-mode.ts',
      'src/camera/camera-manager.ts',
      'src/camera/hls-driver.ts',
      'src/camera/camera-current-map.json',
      '.env.example',
    ];
    for (const f of files) {
      const s = read(f);
      expect(s, f).not.toMatch(/192\.168\.\d+\.\d+/);
      expect(s, f).not.toMatch(/rtsp:\/\//i);
      expect(s, f).not.toMatch(/passphrase/i);
      expect(s, f).not.toMatch(/Preview_/);
    }
  });
});
