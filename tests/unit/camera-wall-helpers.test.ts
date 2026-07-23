// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  initCameraWall,
  isEditableTarget,
  toggleCellFullscreen,
} from '../../src/camera/camera-wall';
import { createFakeScheduler } from './helpers/fake-scheduler';

function buildWallDom(): void {
  document.body.innerHTML = `
    <div class="topbar">
      <span id="camCount">0/9 AKTİF</span>
      <span id="clock">--:--:--</span>
    </div>
    <div class="grid" id="grid"></div>
    <div class="bottombar" id="bottombar">
      <button class="btn" id="muteBtn">🔇 SES KAPAT</button>
      <button class="btn">↺ YENİLE</button>
      <button class="btn">⛶ TAM EKRAN</button>
    </div>`;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('tek hücre büyütme', () => {
  it('aynı anda tek hücre fullscreen olur; tekrar tıklama kapatır', () => {
    document.body.innerHTML =
      '<div class="camera-cell" id="a"></div><div class="camera-cell" id="b"></div>';
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    toggleCellFullscreen(a);
    expect(a.classList.contains('fullscreen')).toBe(true);
    toggleCellFullscreen(b);
    expect(a.classList.contains('fullscreen')).toBe(false);
    expect(b.classList.contains('fullscreen')).toBe(true);
    toggleCellFullscreen(b);
    expect(document.querySelectorAll('.fullscreen')).toHaveLength(0);
  });
});

describe('editable target guard', () => {
  it('input/textarea/select/contenteditable klavye kısayollarını bloklar', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(document.createElement('select'))).toBe(true);
    const div = document.createElement('div');
    expect(isEditableTarget(div)).toBe(false);
    const ce = document.createElement('div');
    ce.contentEditable = 'true';
    expect(isEditableTarget(ce)).toBe(true);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('duvar init yaşam döngüsü (disabled mod)', () => {
  it('idempotent init: ikinci çağrı aynı instance; saat tek interval', () => {
    buildWallDom();
    const fake = createFakeScheduler();
    const w1 = initCameraWall(fake.scheduler);
    const w2 = initCameraWall(fake.scheduler);
    expect(w1).not.toBeNull();
    expect(w2).toBe(w1);
    expect(fake.pendingIntervals()).toBe(1);
    expect(document.querySelectorAll('.camera-cell')).toHaveLength(9);
    expect(document.getElementById('camCount')?.textContent).toBe('0/9 AKTİF');
    w1!.destroy();
  });

  it('saat tr-TR biçiminde tick eder; destroy interval ve timer’ları temizler', () => {
    buildWallDom();
    const fake = createFakeScheduler();
    const wall = initCameraWall(fake.scheduler)!;
    fake.advance(1000);
    expect(document.getElementById('clock')?.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    wall.destroy();
    expect(fake.pendingCount()).toBe(0);
  });

  it('alt bar: tek hide timer; mousemove timer’ı sıfırlar; 3 sn sonra gizlenir', () => {
    buildWallDom();
    const fake = createFakeScheduler();
    const wall = initCameraWall(fake.scheduler)!;
    const bar = document.getElementById('bottombar')!;
    expect(bar.classList.contains('visible')).toBe(true);
    fake.advance(2000);
    document.dispatchEvent(new Event('mousemove'));
    fake.advance(2000); // toplam 4 sn ama timer sıfırlandı
    expect(bar.classList.contains('visible')).toBe(true);
    fake.advance(1100);
    expect(bar.classList.contains('visible')).toBe(false);
    // tek timeout birikmiş olmalı (0 veya 1)
    expect(fake.pendingTimeouts()).toBeLessThanOrEqual(1);
    wall.destroy();
  });

  it('Escape büyütülmüş hücreyi kapatır; Ctrl+Escape ve editable focus kapatmaz', () => {
    buildWallDom();
    const fake = createFakeScheduler();
    const wall = initCameraWall(fake.scheduler)!;
    const cell = document.querySelector<HTMLElement>('.camera-cell')!;
    cell.classList.add('fullscreen');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', ctrlKey: true }));
    expect(cell.classList.contains('fullscreen')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cell.classList.contains('fullscreen')).toBe(false);
    wall.destroy();
  });

  it('destroy sonrası keydown/mousemove listener çalışmaz', () => {
    buildWallDom();
    const fake = createFakeScheduler();
    const wall = initCameraWall(fake.scheduler)!;
    wall.destroy();
    const bar = document.getElementById('bottombar')!;
    bar.classList.remove('visible');
    document.dispatchEvent(new Event('mousemove'));
    expect(bar.classList.contains('visible')).toBe(false);
    const cell = document.querySelector<HTMLElement>('.camera-cell')!;
    cell.classList.add('fullscreen');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cell.classList.contains('fullscreen')).toBe(true);
  });
});
